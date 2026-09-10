import prisma from "@/lib/db";
import {
  createMobileSessionToken,
  hashMobileSessionToken,
} from "@/server/auth/mobile-session-token";
import {
  authenticateMobileRequestWithStore,
  deleteMobileSessionWithStore,
  type MobileSessionStore,
} from "@/server/auth/mobile-session-auth";

const MOBILE_SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export interface AuthenticatedMobileUser {
  id: string;
  name: string | null;
  email: string;
  mainCurrency: string;
}

export interface AuthenticatedMobileRequest {
  token: string;
  sessionId: string;
  userId: string;
  user: AuthenticatedMobileUser;
}

const mobileSessionStore: MobileSessionStore = {
  findByTokenHash: (tokenHash) =>
    prisma.mobileSession.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mainCurrency: true,
          },
        },
      },
    }),
  deleteById: async (id) => {
    await prisma.mobileSession.deleteMany({ where: { id } });
  },
  deleteByTokenHash: async (tokenHash) => {
    const result = await prisma.mobileSession.deleteMany({ where: { tokenHash } });
    return result.count > 0;
  },
};

export async function createMobileSession(
  userId: string,
  now = new Date()
): Promise<{ token: string; expiresAt: Date }> {
  const token = createMobileSessionToken();
  const expiresAt = new Date(now.getTime() + MOBILE_SESSION_LIFETIME_MS);

  await prisma.mobileSession.create({
    data: {
      userId,
      tokenHash: hashMobileSessionToken(token),
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function authenticateMobileRequest(
  request: Request,
  now = new Date()
): Promise<AuthenticatedMobileRequest | null> {
  return authenticateMobileRequestWithStore(request, mobileSessionStore, now);
}

export async function deleteMobileSession(token: string): Promise<boolean> {
  return deleteMobileSessionWithStore(token, mobileSessionStore);
}
