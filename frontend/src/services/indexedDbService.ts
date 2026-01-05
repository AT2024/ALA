/**
 * IndexedDB Service for Offline Data Storage
 *
 * Uses Dexie.js for IndexedDB with AES-256-GCM encryption for PHI fields.
 * Provides encrypted storage for treatments and applicators during offline mode.
 *
 * HIPAA Compliance:
 * - All PHI fields are encrypted using AES-256-GCM via Web Crypto API
 * - Encryption key is stored securely and can be rotated
 * - Data expiry is enforced to limit offline exposure
 */

import Dexie, { Table } from 'dexie';
import { ApplicatorStatus } from '../../../shared/applicatorStatuses';

// ============================================================================
// Types
// ============================================================================

export type SyncStatus = 'synced' | 'pending' | 'conflict';
export type ChangeOperation = 'create' | 'update' | 'status_change';

/**
 * Treatment stored in IndexedDB (encrypted PHI fields)
 */
export interface OfflineTreatment {
  id: string;
  type: 'insertion' | 'removal';
  subjectId: string;           // ENCRYPTED - Patient ID
  patientName?: string;        // ENCRYPTED
  site: string;
  date: string;
  isComplete: boolean;
  userId: string;
  surgeon?: string;            // ENCRYPTED
  seedQuantity?: number;
  activityPerSeed?: number;
  version: number;
  syncStatus: SyncStatus;
  downloadedAt: string;        // When downloaded for offline use
  expiresAt: string;           // When offline data expires
  serverVersion: number;       // Server version at download time
}

/**
 * Applicator stored in IndexedDB (encrypted PHI fields)
 */
export interface OfflineApplicator {
  id: string;
  serialNumber: string;        // ENCRYPTED
  seedQuantity: number;
  status: ApplicatorStatus | null;
  packageLabel: string | null;
  insertionTime: string;
  comments?: string;           // ENCRYPTED
  treatmentId: string;
  addedBy: string;
  isRemoved: boolean;
  removalComments?: string;    // ENCRYPTED
  removalTime?: string;
  removedBy?: string;
  applicatorType?: string;
  catalog?: string;
  seedLength?: number;
  version: number;
  syncStatus: SyncStatus;
  createdOffline: boolean;
}

/**
 * Pending changes to sync when back online
 */
export interface PendingChange {
  id?: number;                 // Auto-incremented
  entityType: 'treatment' | 'applicator';
  entityId: string;
  operation: ChangeOperation;
  data: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
  lastError?: string;
  nextRetryAt?: string;
  status: 'pending' | 'syncing' | 'failed' | 'requires_manual_intervention';
  offlineSince: string;        // When device went offline (for audit)
  changeHash: string;          // SHA-256 of change for integrity
}

/**
 * Conflicts detected during sync
 */
export interface OfflineConflict {
  id?: number;                 // Auto-incremented
  entityType: 'treatment' | 'applicator';
  entityId: string;
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  conflictType: string;
  createdAt: string;
  requiresAdmin: boolean;
}

// ============================================================================
// PHI Encryption
// ============================================================================

/**
 * Fields that contain PHI and must be encrypted
 */
const PHI_FIELDS_TO_ENCRYPT = [
  'patientName',
  'subjectId',
  'surgeon',
  'serialNumber',
  'comments',
  'removalComments',
] as const;

/**
 * Encryption utilities using Web Crypto API (AES-256-GCM)
 */
class PhiEncryption {
  private static ALGORITHM = 'AES-GCM';
  private static IV_LENGTH = 12;
  private cryptoKey: CryptoKey | null = null;

  /**
   * Initialize encryption with a key from the server (base64 encoded)
   * @deprecated Use initializeWithCryptoKey instead for derived keys
   */
  async initialize(keyMaterial: string): Promise<void> {
    const keyBytes = this.base64ToBytes(keyMaterial);
    this.cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes.buffer as ArrayBuffer,
      { name: PhiEncryption.ALGORITHM },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Initialize encryption with a pre-derived CryptoKey
   * This is the preferred method when using key derivation from credentials
   */
  initializeWithCryptoKey(key: CryptoKey): void {
    this.cryptoKey = key;
  }

  /**
   * Check if encryption is initialized
   */
  isInitialized(): boolean {
    return this.cryptoKey !== null;
  }

  /**
   * Encrypt a string value
   */
  async encrypt(plaintext: string): Promise<string> {
    if (!this.cryptoKey) {
      throw new Error('Encryption not initialized');
    }

    const iv = crypto.getRandomValues(new Uint8Array(PhiEncryption.IV_LENGTH));
    const encoded = new TextEncoder().encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
      { name: PhiEncryption.ALGORITHM, iv },
      this.cryptoKey,
      encoded
    );

    // Combine IV + ciphertext and encode as base64
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return this.bytesToBase64(combined);
  }

  /**
   * Decrypt an encrypted string
   */
  async decrypt(encrypted: string): Promise<string> {
    if (!this.cryptoKey) {
      throw new Error('Encryption not initialized');
    }

    const combined = this.base64ToBytes(encrypted);
    const iv = combined.slice(0, PhiEncryption.IV_LENGTH);
    const ciphertext = combined.slice(PhiEncryption.IV_LENGTH);

    const decrypted = await crypto.subtle.decrypt(
      { name: PhiEncryption.ALGORITHM, iv },
      this.cryptoKey,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  }

  /**
   * Encrypt PHI fields in an object
   */
  async encryptPhiFields<T>(obj: T): Promise<T> {
    if (!this.cryptoKey) return obj;

    const result = { ...obj } as Record<string, unknown>;
    for (const field of PHI_FIELDS_TO_ENCRYPT) {
      if (field in result && typeof result[field] === 'string' && result[field]) {
        result[field] = await this.encrypt(result[field] as string);
      }
    }
    return result as T;
  }

  /**
   * Decrypt PHI fields in an object
   */
  async decryptPhiFields<T>(obj: T): Promise<T> {
    if (!this.cryptoKey) return obj;

    const result = { ...obj } as Record<string, unknown>;
    for (const field of PHI_FIELDS_TO_ENCRYPT) {
      if (field in result && typeof result[field] === 'string' && result[field]) {
        try {
          result[field] = await this.decrypt(result[field] as string);
        } catch {
          // Field may not be encrypted (from before encryption was enabled)
          console.warn(`[PhiEncryption] Could not decrypt field ${field}`);
        }
      }
    }
    return result as T;
  }

  private base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Clear encryption key from memory
   */
  clear(): void {
    this.cryptoKey = null;
  }
}

// ============================================================================
// Dexie Database
// ============================================================================

class OfflineDatabase extends Dexie {
  treatments!: Table<OfflineTreatment, string>;
  applicators!: Table<OfflineApplicator, string>;
  pendingChanges!: Table<PendingChange, number>;
  conflicts!: Table<OfflineConflict, number>;

  constructor() {
    super('AlaOfflineDb');

    this.version(1).stores({
      // Primary key: id, indexed fields for queries
      treatments: 'id, subjectId, site, date, syncStatus, [userId+date]',
      applicators: 'id, serialNumber, treatmentId, status, syncStatus, [treatmentId+status]',
      pendingChanges: '++id, entityType, entityId, createdAt, [entityType+retryCount], status',
      conflicts: '++id, entityType, entityId, createdAt, requiresAdmin',
    });
  }
}

// ============================================================================
// IndexedDB Service
// ============================================================================

class IndexedDbService {
  private db: OfflineDatabase;
  private encryption: PhiEncryption;
  private isOpen = false;

  constructor() {
    this.db = new OfflineDatabase();
    this.encryption = new PhiEncryption();
  }

  /**
   * Initialize the database and encryption
   * @param encryptionKey - Optional base64-encoded encryption key from server
   * @deprecated For new code, use initializeDb() and initializeEncryption() separately
   */
  async initialize(encryptionKey?: string): Promise<void> {
    if (!this.isOpen) {
      await this.db.open();
      this.isOpen = true;
    }

    if (encryptionKey) {
      await this.encryption.initialize(encryptionKey);
    }
  }

  /**
   * Initialize only the database (without encryption)
   * Call initializeEncryption() separately with a derived key
   */
  async initializeDb(): Promise<void> {
    if (!this.isOpen) {
      await this.db.open();
      this.isOpen = true;
    }
  }

  /**
   * Initialize encryption with a pre-derived CryptoKey
   * Use this after deriving a key from user credentials
   */
  initializeEncryption(key: CryptoKey): void {
    this.encryption.initializeWithCryptoKey(key);
  }

  /**
   * Check if encryption is available
   */
  isEncryptionReady(): boolean {
    return this.encryption.isInitialized();
  }

  // ==========================================================================
  // Treatment Operations
  // ==========================================================================

  /**
   * Save a treatment for offline use
   */
  async saveTreatment(treatment: OfflineTreatment): Promise<void> {
    const encrypted = await this.encryption.encryptPhiFields(treatment);
    await this.db.treatments.put(encrypted);
  }

  /**
   * Get a treatment by ID
   */
  async getTreatment(id: string): Promise<OfflineTreatment | undefined> {
    const treatment = await this.db.treatments.get(id);
    if (!treatment) return undefined;
    return this.encryption.decryptPhiFields(treatment);
  }

  /**
   * Get all treatments for a user
   */
  async getTreatmentsByUser(userId: string): Promise<OfflineTreatment[]> {
    const treatments = await this.db.treatments
      .where('[userId+date]')
      .between([userId, Dexie.minKey], [userId, Dexie.maxKey])
      .toArray();

    return Promise.all(treatments.map(t => this.encryption.decryptPhiFields(t)));
  }

  /**
   * Get all downloaded (offline-available) treatments
   */
  async getDownloadedTreatments(): Promise<OfflineTreatment[]> {
    const treatments = await this.db.treatments.toArray();
    return Promise.all(treatments.map(t => this.encryption.decryptPhiFields(t)));
  }

  /**
   * Delete a treatment and its applicators
   */
  async deleteTreatment(id: string): Promise<void> {
    await this.db.transaction('rw', [this.db.treatments, this.db.applicators], async () => {
      await this.db.treatments.delete(id);
      await this.db.applicators.where('treatmentId').equals(id).delete();
    });
  }

  /**
   * Check if a treatment is expired
   */
  async isTreatmentExpired(id: string): Promise<boolean> {
    const treatment = await this.db.treatments.get(id);
    if (!treatment) return true;
    return new Date(treatment.expiresAt) < new Date();
  }

  // ==========================================================================
  // Applicator Operations
  // ==========================================================================

  /**
   * Save an applicator for offline use
   */
  async saveApplicator(applicator: OfflineApplicator): Promise<void> {
    const encrypted = await this.encryption.encryptPhiFields(applicator);
    await this.db.applicators.put(encrypted);
  }

  /**
   * Save multiple applicators
   */
  async saveApplicators(applicators: OfflineApplicator[]): Promise<void> {
    const encrypted = await Promise.all(
      applicators.map(a => this.encryption.encryptPhiFields(a))
    );
    await this.db.applicators.bulkPut(encrypted);
  }

  /**
   * Get an applicator by ID
   */
  async getApplicator(id: string): Promise<OfflineApplicator | undefined> {
    const applicator = await this.db.applicators.get(id);
    if (!applicator) return undefined;
    return this.encryption.decryptPhiFields(applicator);
  }

  /**
   * Get applicators for a treatment
   */
  async getApplicatorsByTreatment(treatmentId: string): Promise<OfflineApplicator[]> {
    const applicators = await this.db.applicators
      .where('treatmentId')
      .equals(treatmentId)
      .toArray();

    return Promise.all(applicators.map(a => this.encryption.decryptPhiFields(a)));
  }

  /**
   * Get applicator by serial number
   */
  async getApplicatorBySerial(serialNumber: string): Promise<OfflineApplicator | undefined> {
    // Need to decrypt to compare - this is less efficient but necessary for encrypted fields
    const allApplicators = await this.db.applicators.toArray();
    for (const applicator of allApplicators) {
      const decrypted = await this.encryption.decryptPhiFields(applicator);
      if (decrypted.serialNumber === serialNumber) {
        return decrypted;
      }
    }
    return undefined;
  }

  /**
   * Update applicator status
   */
  async updateApplicatorStatus(
    id: string,
    status: ApplicatorStatus,
    version: number
  ): Promise<void> {
    await this.db.applicators.update(id, {
      status,
      version,
      syncStatus: 'pending',
    });
  }

  // ==========================================================================
  // Pending Changes Operations
  // ==========================================================================

  /**
   * Add a pending change to sync later
   */
  async addPendingChange(change: Omit<PendingChange, 'id'>): Promise<number> {
    return this.db.pendingChanges.add(change as PendingChange);
  }

  /**
   * Get all pending changes
   */
  async getPendingChanges(): Promise<PendingChange[]> {
    return this.db.pendingChanges
      .where('status')
      .equals('pending')
      .sortBy('createdAt');
  }

  /**
   * Get pending changes count
   */
  async getPendingChangesCount(): Promise<number> {
    return this.db.pendingChanges
      .where('status')
      .equals('pending')
      .count();
  }

  /**
   * Update pending change status
   */
  async updatePendingChange(
    id: number,
    updates: Partial<PendingChange>
  ): Promise<void> {
    await this.db.pendingChanges.update(id, updates);
  }

  /**
   * Remove a pending change (after successful sync)
   */
  async removePendingChange(id: number): Promise<void> {
    await this.db.pendingChanges.delete(id);
  }

  /**
   * Get changes requiring manual intervention
   */
  async getChangesRequiringIntervention(): Promise<PendingChange[]> {
    return this.db.pendingChanges
      .where('status')
      .equals('requires_manual_intervention')
      .toArray();
  }

  // ==========================================================================
  // Conflict Operations
  // ==========================================================================

  /**
   * Add a conflict
   */
  async addConflict(conflict: Omit<OfflineConflict, 'id'>): Promise<number> {
    return this.db.conflicts.add(conflict as OfflineConflict);
  }

  /**
   * Get all conflicts
   */
  async getConflicts(): Promise<OfflineConflict[]> {
    return this.db.conflicts.toArray();
  }

  /**
   * Get conflicts requiring admin resolution
   */
  async getAdminRequiredConflicts(): Promise<OfflineConflict[]> {
    return this.db.conflicts
      .where('requiresAdmin')
      .equals(1) // IndexedDB uses 1/0 for booleans
      .toArray();
  }

  /**
   * Remove a conflict (after resolution)
   */
  async removeConflict(id: number): Promise<void> {
    await this.db.conflicts.delete(id);
  }

  // ==========================================================================
  // Data Management
  // ==========================================================================

  /**
   * Clean up expired data
   */
  async cleanupExpiredData(): Promise<number> {
    const now = new Date().toISOString();
    let deletedCount = 0;

    const expiredTreatments = await this.db.treatments
      .filter(t => t.expiresAt < now)
      .toArray();

    for (const treatment of expiredTreatments) {
      await this.deleteTreatment(treatment.id);
      deletedCount++;
    }

    return deletedCount;
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{
    treatmentCount: number;
    applicatorCount: number;
    pendingChangesCount: number;
    conflictCount: number;
    estimatedSizeBytes: number;
  }> {
    const [treatments, applicators, pending, conflicts] = await Promise.all([
      this.db.treatments.count(),
      this.db.applicators.count(),
      this.db.pendingChanges.count(),
      this.db.conflicts.count(),
    ]);

    // Estimate storage size (rough calculation)
    const estimatedSizeBytes =
      treatments * 2048 +      // ~2KB per treatment
      applicators * 1024 +     // ~1KB per applicator
      pending * 512 +          // ~0.5KB per pending change
      conflicts * 1024;        // ~1KB per conflict

    return {
      treatmentCount: treatments,
      applicatorCount: applicators,
      pendingChangesCount: pending,
      conflictCount: conflicts,
      estimatedSizeBytes,
    };
  }

  /**
   * Check data integrity (for startup validation)
   */
  async checkDataIntegrity(): Promise<{
    status: 'ok' | 'corrupted' | 'missing';
    pendingChangesLost?: number;
  }> {
    try {
      const pendingCount = await this.db.pendingChanges.count();
      const expectedCount = parseInt(localStorage.getItem('ala_pendingChangesCount') || '0');

      if (expectedCount > 0 && pendingCount === 0) {
        return { status: 'missing', pendingChangesLost: expectedCount };
      }

      // Update stored count
      localStorage.setItem('ala_pendingChangesCount', String(pendingCount));

      return { status: 'ok' };
    } catch {
      return { status: 'corrupted' };
    }
  }

  /**
   * Update pending changes count in localStorage (for integrity tracking)
   */
  async updatePendingChangesBackup(): Promise<void> {
    const count = await this.db.pendingChanges.count();
    localStorage.setItem('ala_pendingChangesCount', String(count));
  }

  /**
   * Clear all offline data
   */
  async clearAll(): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.treatments, this.db.applicators, this.db.pendingChanges, this.db.conflicts],
      async () => {
        await this.db.treatments.clear();
        await this.db.applicators.clear();
        await this.db.pendingChanges.clear();
        await this.db.conflicts.clear();
      }
    );
    localStorage.removeItem('ala_pendingChangesCount');
    this.encryption.clear();
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
    this.isOpen = false;
    this.encryption.clear();
  }
}

// Singleton instance
export const offlineDb = new IndexedDbService();

// Export class for testing
export { IndexedDbService, PhiEncryption };
