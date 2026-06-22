/**
 * User Encryption Context Module
 * 
 * Provides user-specific encryption context management.
 * Handles user key derivation, caching, and field-level encryption operations.
 * 
 * @module lib/user-encryption
 */

import { auth } from "@/auth";
import prisma from "@/lib/db";
import {
  getMasterKey,
  deriveUserKey,
  encryptField,
  decryptField,
  generateUserSalt,
  UserEncryptionContext,
  isEncryptionConfigured,
} from "./encryption";

/**
 * Cache for user encryption contexts
 * In production, consider using Redis for distributed caching
 */
const userKeyCache = new Map<string, {
  context: UserEncryptionContext;
  expiresAt: number;
}>();
const pendingUserKeyContexts = new Map<string, Promise<UserEncryptionContext>>();
const userKeyCacheGenerations = new Map<string, number>();
let userKeyCacheGeneration = 0;

// Cache TTL: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Get or create encryption context for a user
 * 
 * @param userId - User ID
 * @returns User encryption context with derived key
 * @throws Error if encryption is not configured or user not found
 */
export async function getUserEncryptionContext(
  userId: string
): Promise<UserEncryptionContext> {
  // Check cache first
  const cached = userKeyCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.context;
  }

  const pendingContext = pendingUserKeyContexts.get(userId);
  if (pendingContext) {
    return pendingContext;
  }

  const cacheGeneration = userKeyCacheGeneration;
  const userCacheGeneration = userKeyCacheGenerations.get(userId) ?? 0;
  const contextPromise = (async (): Promise<UserEncryptionContext> => {
    const masterKey = getMasterKey();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        encryptionSalt: true,
        encryptionVersion: true,
      },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    let salt = user.encryptionSalt;
    const version = user.encryptionVersion || 1;

    if (!salt) {
      salt = generateUserSalt();
      await prisma.user.update({
        where: { id: userId },
        data: {
          encryptionSalt: salt,
          encryptionVersion: 1,
        },
      });
    }

    const context: UserEncryptionContext = {
      userId: user.id,
      encryptionKey: deriveUserKey(masterKey, salt),
      salt,
      version,
    };

    if (
      cacheGeneration === userKeyCacheGeneration &&
      userCacheGeneration === (userKeyCacheGenerations.get(userId) ?? 0)
    ) {
      userKeyCache.set(userId, {
        context,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
    }

    return context;
  })();

  pendingUserKeyContexts.set(userId, contextPromise);

  try {
    return await contextPromise;
  } finally {
    if (pendingUserKeyContexts.get(userId) === contextPromise) {
      pendingUserKeyContexts.delete(userId);
    }
  }
}

/**
 * Get encryption context for the currently authenticated user
 * 
 * @returns User encryption context for the current session
 * @throws Error if user is not authenticated
 */
export async function getCurrentUserEncryptionContext(): Promise<UserEncryptionContext> {
  const session = await auth();
  
  if (!session?.user?.id) {
    throw new Error("No authenticated user found");
  }
  
  return getUserEncryptionContext(session.user.id);
}

/**
 * Encrypt a field value for a specific user
 * 
 * @param userId - User ID
 * @param fieldName - Field name (e.g., "transaction.description")
 * @param plaintext - Plain text value to encrypt
 * @returns Encrypted value as base64 string, or empty string if plaintext is empty
 */
export async function encryptUserField(
  userId: string,
  fieldName: string,
  plaintext: string
): Promise<string> {
  if (!plaintext) {
    return "";
  }
  
  if (!isEncryptionConfigured()) {
    // Return plaintext if encryption is not configured (development mode)
    return plaintext;
  }
  
  const context = await getUserEncryptionContext(userId);
  return encryptField(plaintext, context.encryptionKey, fieldName);
}

/**
 * Decrypt a field value for a specific user
 * 
 * @param userId - User ID
 * @param fieldName - Field name (e.g., "transaction.description")
 * @param encryptedValue - Encrypted value as base64 string
 * @returns Decrypted plain text value
 */
export async function decryptUserField(
  userId: string,
  fieldName: string,
  encryptedValue: string
): Promise<string> {
  if (!encryptedValue) {
    return "";
  }
  
  if (!isEncryptionConfigured()) {
    // Return as-is if encryption is not configured (development mode)
    return encryptedValue;
  }
  
  const context = await getUserEncryptionContext(userId);
  return decryptField(encryptedValue, context.encryptionKey, fieldName);
}

/**
 * Encrypt a field for the current authenticated user
 * 
 * @param fieldName - Field name
 * @param plaintext - Plain text to encrypt
 * @returns Encrypted value
 */
export async function encryptCurrentUserField(
  fieldName: string,
  plaintext: string
): Promise<string> {
  const context = await getCurrentUserEncryptionContext();
  return encryptField(plaintext, context.encryptionKey, fieldName);
}

/**
 * Decrypt a field for the current authenticated user
 * 
 * @param fieldName - Field name
 * @param encryptedValue - Encrypted value to decrypt
 * @returns Decrypted value
 */
export async function decryptCurrentUserField(
  fieldName: string,
  encryptedValue: string
): Promise<string> {
  const context = await getCurrentUserEncryptionContext();
  return decryptField(encryptedValue, context.encryptionKey, fieldName);
}

/**
 * Clear the user key cache (useful for testing or key rotation)
 * 
 * @param userId - Optional specific user ID to clear, or all if not provided
 */
export function clearUserKeyCache(userId?: string): void {
  if (userId) {
    userKeyCache.delete(userId);
    pendingUserKeyContexts.delete(userId);
    userKeyCacheGenerations.set(
      userId,
      (userKeyCacheGenerations.get(userId) ?? 0) + 1
    );
  } else {
    userKeyCache.clear();
    pendingUserKeyContexts.clear();
    userKeyCacheGenerations.clear();
    userKeyCacheGeneration += 1;
  }
}

/**
 * Invalidate a user's key cache (e.g., after key rotation)
 * 
 * @param userId - User ID to invalidate
 */
export function invalidateUserKey(userId: string): void {
  clearUserKeyCache(userId);
}

/**
 * Check if a user has encryption enabled
 * 
 * @param userId - User ID to check
 * @returns true if user has encryption salt configured
 */
export async function userHasEncryption(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { encryptionSalt: true },
  });
  
  return !!user?.encryptionSalt;
}

/**
 * Initialize encryption for a user (generate salt if not exists)
 * 
 * @param userId - User ID to initialize
 * @returns true if encryption was initialized
 */
export async function initializeUserEncryption(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { encryptionSalt: true },
  });
  
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }
  
  if (user.encryptionSalt) {
    return false; // Already initialized
  }
  
  const salt = generateUserSalt();
  
  await prisma.user.update({
    where: { id: userId },
    data: {
      encryptionSalt: salt,
      encryptionVersion: 1,
    },
  });
  
  return true;
}

/**
 * Rotate user encryption key (for key rotation support)
 * 
 * @param userId - User ID
 * @returns New encryption context after rotation
 */
export async function rotateUserEncryptionKey(
  userId: string
): Promise<UserEncryptionContext> {
  // Invalidate current cache
  invalidateUserKey(userId);
  
  // Generate new salt
  const newSalt = generateUserSalt();
  
  // Update user with new salt and increment version
  await prisma.user.update({
    where: { id: userId },
    data: {
      encryptionSalt: newSalt,
      encryptionVersion: {
        increment: 1,
      },
    },
  });
  
  // Return new encryption context
  return getUserEncryptionContext(userId);
}
