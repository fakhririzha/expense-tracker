import bcrypt from "bcryptjs";

import {
  clearLoginEmailRateLimit,
  consumeLoginRateLimits,
} from "@/lib/auth-rate-limit";
import prisma from "@/lib/db";
import {
  verifyCredentialsWithDependencies,
  type VerifiedCredentialsUser,
} from "@/server/auth/verify-credentials-core";

export type { VerifiedCredentialsUser };

export async function verifyCredentials(
  credentials: unknown,
  request: Request
): Promise<VerifiedCredentialsUser | null> {
  return verifyCredentialsWithDependencies(credentials, request, {
    consumeRateLimits: consumeLoginRateLimits,
    findUser: (email) =>
      prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          mainCurrency: true,
          password: true,
        },
      }),
    comparePassword: bcrypt.compare,
    clearEmailRateLimit: clearLoginEmailRateLimit,
  });
}
