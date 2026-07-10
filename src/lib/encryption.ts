/**
 * FinHealth Encryption Module
 * 
 * Provides AES-256-GCM encryption with per-user key derivation.
 * This module handles field-level encryption for sensitive financial data.
 * 
 * Key Hierarchy:
 * 1. Master Key (ENV: ENCRYPTION_MASTER_KEY) - Base64-encoded 256-bit key
 * 2. User Salt - Unique per user, stored in database
 * 3. User Encryption Key - Derived via PBKDF2-SHA512
 * 4. Field Keys - Optional HKDF-derived keys per field
 * 
 * @module lib/encryption
 */

import { 
  createCipheriv, 
  createDecipheriv, 
  randomBytes, 
  pbkdf2Sync, 
  createHash,
  createHmac,
  timingSafeEqual
} from "crypto";

// ==================== Constants ====================

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12;  // 96 bits (recommended for GCM)
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_DIGEST = "sha512";

// ==================== Type Definitions ====================

/**
 * Encrypted payload containing all components needed for decryption
 */
export interface EncryptedPayload {
  /** Base64-encoded ciphertext */
  ciphertext: string;
  /** Base64-encoded initialization vector */
  iv: string;
  /** Base64-encoded authentication tag */
  authTag: string;
}

/**
 * Combined encrypted data (IV + AuthTag + Ciphertext)
 */
export type EncryptedData = string;

/**
 * User encryption context containing derived keys and metadata
 */
export interface UserEncryptionContext {
  userId: string;
  encryptionKey: Buffer;
  salt: string;
  version: number;
}

/**
 * Field classification levels for encryption decisions
 */
export enum FieldClassification {
  CRITICAL = "critical",   // PII, security-related
  HIGH = "high",          // Financial details, identifiers
  MEDIUM = "medium",      // User-created content
  LOW = "low"             // Numeric values (protected by user isolation)
}

/**
 * Mapping of model/field to classification level
 */
export const FIELD_CLASSIFICATIONS: Record<string, FieldClassification> = {
  // User model
  "user.name": FieldClassification.MEDIUM,
  "user.email": FieldClassification.CRITICAL,
  
  // FinancialAccount model
  "account.name": FieldClassification.MEDIUM,
  "account.description": FieldClassification.HIGH,

  // Budget model
  "budget.name": FieldClassification.MEDIUM,
  
  // Transaction model
  "transaction.description": FieldClassification.HIGH,
  "transaction.referenceNumber": FieldClassification.HIGH,
  "transaction.createdBy": FieldClassification.MEDIUM,
  "transactionSplit.description": FieldClassification.HIGH,
  
  // TradeHistory model
  "tradeHistory.notes": FieldClassification.HIGH,
  
  // RecurringRule model
  "recurringRule.name": FieldClassification.MEDIUM,
  "recurringRule.description": FieldClassification.HIGH,

  // Subscription model
  "subscription.name": FieldClassification.MEDIUM,
  "subscription.provider": FieldClassification.MEDIUM,
  "subscription.description": FieldClassification.HIGH,
  "subscription.cancellationUrl": FieldClassification.HIGH,
  "subscription.notes": FieldClassification.HIGH,
  
  // SavingsGoal model
  "savingsGoal.name": FieldClassification.MEDIUM,
  "savingsGoal.description": FieldClassification.HIGH,

  // PersonalAsset model
  "personalAsset.name": FieldClassification.MEDIUM,
  "personalAsset.notes": FieldClassification.HIGH,
  
  // LiabilityPaymentAudit model (Critical - security related)
  "liabilityPaymentAudit.ipAddress": FieldClassification.CRITICAL,
  "liabilityPaymentAudit.userAgent": FieldClassification.CRITICAL,

  // PushSubscription model
  "pushSubscription.endpoint": FieldClassification.CRITICAL,
  "pushSubscription.p256dh": FieldClassification.CRITICAL,
  "pushSubscription.auth": FieldClassification.CRITICAL,
  "pushSubscription.userAgent": FieldClassification.MEDIUM,
};

// ==================== Master Key Management ====================

/**
 * Get the master encryption key from environment variable
 * @throws Error if ENCRYPTION_MASTER_KEY is not set
 */
export function getMasterKey(): Buffer {
  const key = process.env.ENCRYPTION_MASTER_KEY;
  if (!key) {
    throw new Error(
      "ENCRYPTION_MASTER_KEY environment variable is not set. " +
      "Generate with: openssl rand -base64 32"
    );
  }
  
  const decoded = Buffer.from(key, "base64");
  if (decoded.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_MASTER_KEY must be ${KEY_LENGTH} bytes (256 bits). ` +
      `Current length: ${decoded.length}`
    );
  }
  
  return decoded;
}

/**
 * Check if encryption is properly configured
 */
export function isEncryptionConfigured(): boolean {
  try {
    getMasterKey();
    return true;
  } catch {
    return false;
  }
}

// ==================== Random Value Generation ====================

/**
 * Generate cryptographically secure random bytes
 */
export function generateRandomBytes(length: number): Buffer {
  return randomBytes(length);
}

/**
 * Generate a new user salt for key derivation
 * @returns Base64-encoded 32-byte salt
 */
export function generateUserSalt(): string {
  return generateRandomBytes(SALT_LENGTH).toString("base64");
}

/**
 * Generate a new encryption IV
 * @returns Base64-encoded 12-byte IV
 */
export function generateIV(): string {
  return generateRandomBytes(IV_LENGTH).toString("base64");
}

// ==================== Key Derivation ====================

/**
 * Derive user encryption key from master key and user salt using PBKDF2
 * 
 * @param masterKey - The master encryption key from environment
 * @param userSalt - Base64-encoded user-specific salt
 * @returns 256-bit derived encryption key
 */
export function deriveUserKey(masterKey: Buffer, userSalt: string): Buffer {
  if (!userSalt) {
    throw new Error("User salt is required for key derivation");
  }
  
  const salt = Buffer.from(userSalt, "base64");
  if (salt.length !== SALT_LENGTH) {
    throw new Error(`User salt must be ${SALT_LENGTH} bytes. Current: ${salt.length}`);
  }
  
  return pbkdf2Sync(
    masterKey,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    PBKDF2_DIGEST
  );
}

/**
 * Derive a field-specific key from user key using HKDF-like construction
 * This provides additional isolation between different fields
 * 
 * @param userKey - The user's derived encryption key
 * @param fieldName - Name of the field (e.g., "transaction.description")
 * @returns 256-bit field-specific key
 */
export function deriveFieldKey(userKey: Buffer, fieldName: string): Buffer {
  // Create field context hash
  const fieldContext = createHash("sha256")
    .update(fieldName)
    .digest();
  
  // Combine user key with field context
  const combined = Buffer.concat([userKey, fieldContext]);
  
  // Derive field-specific key
  return createHash("sha256").update(combined).digest();
}

/**
 * Create an encryption key from password/passphrase (for backup recovery)
 * 
 * @param passphrase - User-provided passphrase
 * @param salt - Salt for key derivation
 * @returns Derived encryption key
 */
export function deriveKeyFromPassphrase(
  passphrase: string, 
  salt: Buffer
): Buffer {
  return pbkdf2Sync(
    passphrase,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    PBKDF2_DIGEST
  );
}

// ==================== Encryption ====================

/**
 * Encrypt plaintext using AES-256-GCM
 * 
 * @param plaintext - Text to encrypt
 * @param key - 256-bit encryption key
 * @param iv - Optional IV (generated if not provided)
 * @returns Combined encrypted data (IV + AuthTag + Ciphertext) as base64
 */
export function encrypt(
  plaintext: string, 
  key: Buffer,
  iv?: string
): EncryptedData {
  if (!plaintext) {
    return "";
  }
  
  const ivBuffer = iv ? Buffer.from(iv, "base64") : randomBytes(IV_LENGTH);
  
  if (ivBuffer.length !== IV_LENGTH) {
    throw new Error(`IV must be ${IV_LENGTH} bytes. Received: ${ivBuffer.length}`);
  }
  
  const cipher = createCipheriv(ALGORITHM, key, ivBuffer, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Combine: IV + AuthTag + Ciphertext
  const combined = Buffer.concat([ivBuffer, authTag, encrypted]);
  return combined.toString("base64");
}

/**
 * Encrypt plaintext with field-specific key derivation
 * 
 * @param plaintext - Text to encrypt
 * @param userKey - User's derived encryption key
 * @param fieldName - Field name for key derivation
 * @returns Encrypted data as base64
 */
export function encryptField(
  plaintext: string,
  userKey: Buffer,
  fieldName: string
): EncryptedData {
  const fieldKey = deriveFieldKey(userKey, fieldName);
  return encrypt(plaintext, fieldKey);
}

// ==================== Decryption ====================

/**
 * Decrypt data using AES-256-GCM
 * 
 * @param encryptedData - Combined encrypted data (IV + AuthTag + Ciphertext) as base64
 * @param key - 256-bit encryption key
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedData: string, key: Buffer): string {
  if (!encryptedData) {
    return "";
  }
  
  const combined = Buffer.from(encryptedData, "base64");
  
  // Extract components
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  
  return decrypted.toString("utf8");
}

/**
 * Decrypt data with field-specific key derivation
 * 
 * @param encryptedData - Encrypted data as base64
 * @param userKey - User's derived encryption key
 * @param fieldName - Field name for key derivation
 * @returns Decrypted plaintext
 */
export function decryptField(
  encryptedData: string,
  userKey: Buffer,
  fieldName: string
): string {
  const fieldKey = deriveFieldKey(userKey, fieldName);
  return decrypt(encryptedData, fieldKey);
}

// ==================== Helper Functions ====================

/**
 * Check if a field should be encrypted based on classification
 */
export function shouldEncrypt(modelField: string): boolean {
  const classification = FIELD_CLASSIFICATIONS[modelField];
  return classification !== undefined && classification !== FieldClassification.LOW;
}

/**
 * Get the encryption classification for a field
 */
export function getFieldClassification(modelField: string): FieldClassification {
  return FIELD_CLASSIFICATIONS[modelField] || FieldClassification.LOW;
}

/**
 * Create HMAC for data integrity verification
 */
export function createHmacSignature(data: string, key: Buffer): string {
  return createHmac("sha256", key).update(data).digest("base64");
}

/**
 * Verify HMAC signature
 */
export function verifyHmacSignature(
  data: string, 
  signature: string, 
  key: Buffer
): boolean {
  const expected = createHmac("sha256", key).update(data).digest("base64");
  const sigBuffer = Buffer.from(signature, "base64");
  const expBuffer = Buffer.from(expected, "base64");
  
  if (sigBuffer.length !== expBuffer.length) {
    return false;
  }
  
  return timingSafeEqual(sigBuffer, expBuffer);
}

// ==================== Utility Functions ====================

/**
 * Generate a secure random key for backup purposes
 */
export function generateBackupKey(): string {
  return generateRandomBytes(KEY_LENGTH).toString("base64");
}

/**
 * Hash a backup key for storage (not reversible)
 */
export function hashBackupKey(backupKey: string): string {
  return createHash("sha256").update(backupKey).digest("hex");
}

/**
 * Validate that a key is properly formatted
 */
export function isValidKey(key: string): boolean {
  try {
    const decoded = Buffer.from(key, "base64");
    return decoded.length === KEY_LENGTH;
  } catch {
    return false;
  }
}

/**
 * Encrypt data with a backup key (for key escrow/recovery)
 */
export function encryptWithBackupKey(
  plaintext: string,
  backupKey: string
): EncryptedData {
  const key = Buffer.from(backupKey, "base64");
  return encrypt(plaintext, key);
}

/**
 * Decrypt data with a backup key (for key escrow/recovery)
 */
export function decryptWithBackupKey(
  encryptedData: string,
  backupKey: string
): string {
  const key = Buffer.from(backupKey, "base64");
  return decrypt(encryptedData, key);
}
