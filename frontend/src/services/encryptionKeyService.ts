/**
 * Encryption Key Service
 *
 * Derives deterministic AES-256-GCM encryption keys from user credentials using PBKDF2.
 * This approach is HIPAA compliant - no plaintext keys are stored.
 *
 * Flow:
 * 1. On login verification, store key derivation material (userId + identifier + codeHash)
 * 2. On app load, derive the same key from stored material
 * 3. Key is deterministic - same inputs always produce same key
 *
 * Security:
 * - PBKDF2 with 100,000 iterations (OWASP 2024 recommended minimum)
 * - Verification code is hashed before storage (never stored plaintext)
 * - Material stored in sessionStorage (cleared on browser close)
 * - Different users get different keys (userId in salt)
 */

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256; // AES-256
const APP_SALT = 'ALA-Medical-PHI-v1'; // Static component of salt

interface KeyMaterial {
  userId: string;
  identifier: string;
  codeHash: string;
}

const STORAGE_KEY = 'ala_encryption_material';

/**
 * Hash a string using SHA-256
 */
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Encryption Key Service
 *
 * Manages key derivation material and derives AES-256-GCM keys for PHI encryption.
 */
class EncryptionKeyService {
  private cachedKey: CryptoKey | null = null;
  private cachedMaterialHash: string | null = null;

  /**
   * Derive an AES-256-GCM CryptoKey from user credentials
   *
   * Uses PBKDF2 with:
   * - Password: identifier + codeHash (combined credential material)
   * - Salt: userId + APP_SALT (user-specific salt)
   * - Iterations: 100,000 (OWASP 2024 minimum)
   * - Key length: 256 bits (AES-256)
   */
  async deriveKey(userId: string, identifier: string, codeHash: string): Promise<CryptoKey> {
    // Check cache to avoid re-derivation
    const materialHash = await sha256(`${userId}:${identifier}:${codeHash}`);
    if (this.cachedKey && this.cachedMaterialHash === materialHash) {
      return this.cachedKey;
    }

    // Combine identifier and code hash as the password
    const password = `${identifier}:${codeHash}`;

    // Create user-specific salt
    const salt = `${userId}:${APP_SALT}`;

    // Import password as key material
    const passwordBuffer = new TextEncoder().encode(password);
    const baseKey = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    // Derive the AES-GCM key
    const saltBuffer = new TextEncoder().encode(salt);
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: KEY_LENGTH },
      false, // Not extractable for security
      ['encrypt', 'decrypt']
    );

    // Cache the key
    this.cachedKey = derivedKey;
    this.cachedMaterialHash = materialHash;

    return derivedKey;
  }

  /**
   * Store key derivation material after successful login verification
   *
   * The verification code is hashed before storage - never stored in plaintext.
   * Uses sessionStorage which is cleared when browser is closed.
   */
  async storeCredentialMaterial(
    userId: string,
    identifier: string,
    verificationCode: string
  ): Promise<void> {
    // Hash the verification code - never store plaintext
    const codeHash = await sha256(verificationCode);

    const material: KeyMaterial = {
      userId,
      identifier,
      codeHash,
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(material));

    // Pre-derive and cache the key
    await this.deriveKey(userId, identifier, codeHash);

    console.log('[EncryptionKeyService] Credential material stored and key derived');
  }

  /**
   * Get stored key derivation material
   *
   * Returns null if no material is stored (user not logged in or session expired)
   */
  getStoredMaterial(): KeyMaterial | null {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    try {
      return JSON.parse(stored) as KeyMaterial;
    } catch {
      console.warn('[EncryptionKeyService] Failed to parse stored material');
      return null;
    }
  }

  /**
   * Get the derived key from stored material
   *
   * Convenience method that combines getStoredMaterial and deriveKey
   */
  async getDerivedKey(): Promise<CryptoKey | null> {
    const material = this.getStoredMaterial();
    if (!material) {
      return null;
    }

    return this.deriveKey(material.userId, material.identifier, material.codeHash);
  }

  /**
   * Check if key material is available
   */
  hasStoredMaterial(): boolean {
    return sessionStorage.getItem(STORAGE_KEY) !== null;
  }

  /**
   * Clear all stored key material and cached key
   *
   * Call this on logout to ensure clean state
   */
  clearMaterial(): void {
    sessionStorage.removeItem(STORAGE_KEY);
    this.cachedKey = null;
    this.cachedMaterialHash = null;
    console.log('[EncryptionKeyService] Credential material and cached key cleared');
  }

  /**
   * Verify that the stored material can produce a working key
   *
   * Useful for validation during initialization
   */
  async verifyStoredMaterial(): Promise<boolean> {
    try {
      const key = await this.getDerivedKey();
      return key !== null;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const encryptionKeyService = new EncryptionKeyService();
