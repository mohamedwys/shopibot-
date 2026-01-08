/**
 * Encryption Utility for Securing Sensitive Data
 *
 * Uses AES-256-GCM encryption for storing sensitive information like API keys
 * Requires ENCRYPTION_KEY environment variable (32-byte hex string)
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For AES, this is always 16
const AUTH_TAG_LENGTH = 16;

/**
 * Get encryption key from environment variable
 * @throws {Error} if ENCRYPTION_KEY is not set or invalid
 */
function getEncryptionKey(): Buffer {
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  // Convert hex string to buffer
  const keyBuffer = Buffer.from(encryptionKey, 'hex');

  if (keyBuffer.length !== 32) {
    throw new Error(
      'ENCRYPTION_KEY must be a 32-byte hex string (64 hex characters). ' +
      'Current length: ' + keyBuffer.length + ' bytes. ' +
      'Generate a new one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  return keyBuffer;
}

/**
 * Encrypt a string using AES-256-GCM
 *
 * @param plaintext - The text to encrypt (e.g., API key)
 * @returns Encrypted string in format: iv:authTag:encryptedData (all hex encoded)
 *
 * @example
 * const encrypted = encryptApiKey('sk-proj-abc123...');
 * // Returns: "a1b2c3d4....:e5f6g7h8....:i9j0k1l2...."
 */
export function encryptApiKey(plaintext: string): string {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Invalid input: plaintext must be a non-empty string');
  }

  try {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return in format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    throw new Error(
      `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Decrypt a string that was encrypted with encryptApiKey
 *
 * @param encrypted - Encrypted string in format: iv:authTag:encryptedData
 * @returns Decrypted plaintext
 *
 * @example
 * const decrypted = decryptApiKey('a1b2c3d4....:e5f6g7h8....:i9j0k1l2....');
 * // Returns: "sk-proj-abc123..."
 */
export function decryptApiKey(encrypted: string): string {
  if (!encrypted || typeof encrypted !== 'string') {
    throw new Error('Invalid input: encrypted must be a non-empty string');
  }

  try {
    const parts = encrypted.split(':');

    if (parts.length !== 3) {
      throw new Error(
        'Invalid encrypted format. Expected format: iv:authTag:encryptedData'
      );
    }

    const [ivHex, authTagHex, encryptedHex] = parts;

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encryptedData = Buffer.from(encryptedHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error(
      `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
      'The data may be corrupted or the encryption key may have changed.'
    );
  }
}

/**
 * Validate that a string is a valid OpenAI API key format
 *
 * @param apiKey - The API key to validate
 * @returns true if valid format, false otherwise
 */
export function isValidOpenAIKey(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  // OpenAI API keys start with "sk-" or "sk-proj-" and have a minimum length
  return (
    (apiKey.startsWith('sk-') || apiKey.startsWith('sk-proj-')) &&
    apiKey.length >= 20
  );
}

/**
 * Generate a new encryption key (for setup/documentation purposes)
 * DO NOT USE IN PRODUCTION CODE - This is for generating keys during setup
 *
 * @returns A new 32-byte hex encryption key
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex');
}
