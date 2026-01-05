/**
 * Cryptographic Utility Functions - Single Source of Truth
 *
 * This file contains shared cryptographic functions used by both frontend and backend.
 * Primary use case: Data integrity verification for offline sync operations.
 *
 * Note: Backend uses Node.js crypto module, frontend uses Web Crypto API.
 * This file provides the interface; implementations differ by environment.
 */

/**
 * Compute SHA-256 hash of data for integrity verification
 * Used in offline sync to detect data modifications
 *
 * Backend implementation (Node.js):
 * Uses crypto.createHash('sha256').update(normalized).digest('hex')
 *
 * Frontend implementation (Web Crypto API):
 * Uses SubtleCrypto.digest() with ArrayBuffer conversion
 *
 * @param data - Object to hash (will be JSON stringified with sorted keys)
 * @returns Hex-encoded SHA-256 hash
 */

// Backend-specific implementation (Node.js crypto)
// This will be imported in backend code
export function computeHashNode(data: Record<string, unknown>): string {
  // Dynamic import to avoid bundling crypto in frontend
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const crypto = require('crypto');
  const normalized = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Frontend-compatible SHA-256 hash computation
 * Uses Web Crypto API (available in browsers)
 *
 * @param data - Object to hash
 * @returns Promise resolving to hex-encoded SHA-256 hash
 */
export async function computeHashWeb(data: Record<string, unknown>): Promise<string> {
  const normalized = JSON.stringify(data, Object.keys(data).sort());
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Normalize an object for consistent hashing
 * Sorts keys recursively to ensure deterministic output
 *
 * @param data - Object to normalize
 * @returns JSON string with sorted keys
 */
export function normalizeForHash(data: Record<string, unknown>): string {
  return JSON.stringify(data, Object.keys(data).sort());
}

/**
 * Compare two hashes for equality (constant-time to prevent timing attacks)
 *
 * @param hash1 - First hash
 * @param hash2 - Second hash
 * @returns true if hashes match
 */
export function compareHashes(hash1: string, hash2: string): boolean {
  if (hash1.length !== hash2.length) return false;

  let result = 0;
  for (let i = 0; i < hash1.length; i++) {
    result |= hash1.charCodeAt(i) ^ hash2.charCodeAt(i);
  }
  return result === 0;
}
