import {
  extractBearerToken,
  hashMobileSessionToken,
  isMobileSessionExpired,
} from "./mobile-session-token";

export interface MobileSessionRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    mainCurrency: string;
  };
}

export interface MobileSessionStore {
  findByTokenHash(tokenHash: string): Promise<MobileSessionRecord | null>;
  deleteById(id: string): Promise<void>;
  deleteByTokenHash(tokenHash: string): Promise<boolean>;
}

export async function authenticateMobileRequestWithStore(
  request: Request,
  store: MobileSessionStore,
  now = new Date()
) {
  const token = extractBearerToken(request);
  if (!token) return null;

  const session = await store.findByTokenHash(hashMobileSessionToken(token));
  if (!session) return null;

  if (isMobileSessionExpired(session.expiresAt, now)) {
    await store.deleteById(session.id);
    return null;
  }

  return {
    token,
    sessionId: session.id,
    userId: session.userId,
    user: session.user,
  };
}

export function deleteMobileSessionWithStore(
  token: string,
  store: MobileSessionStore
): Promise<boolean> {
  return store.deleteByTokenHash(hashMobileSessionToken(token));
}
