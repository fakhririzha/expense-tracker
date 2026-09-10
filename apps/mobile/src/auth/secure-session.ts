import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "finhealth.mobile.token";
const EXPIRES_AT_KEY = "finhealth.mobile.expiresAt";

export interface StoredSession {
  token: string;
  expiresAt: string;
}
export async function getStoredSession(): Promise<StoredSession | null> {
  const [token, expiresAt] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEY),
    SecureStore.getItemAsync(EXPIRES_AT_KEY),
  ]);
  if (!token || !expiresAt) return null;
  if (new Date(expiresAt).getTime() <= Date.now()) {
    await clearStoredSession();
    return null;
  }
  return { token, expiresAt };
}

export async function saveStoredSession(session: StoredSession) {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, session.token),
    SecureStore.setItemAsync(EXPIRES_AT_KEY, session.expiresAt),
  ]);
}

export async function getStoredToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearStoredSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(EXPIRES_AT_KEY),
  ]);
}
