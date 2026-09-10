import { loginSchema } from "@/lib/auth-input";

const DUMMY_PASSWORD_HASH =
  "$2b$10$7gh//9KVPnDLDEUK40hcM.XXtmiIodzdzEOIp4nL/NHLMNyynFL9C";

export interface VerifiedCredentialsUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  mainCurrency: string;
}

interface CredentialsUserRecord extends VerifiedCredentialsUser {
  password: string | null;
}

export interface VerifyCredentialsDependencies {
  consumeRateLimits(email: string, request: Request): Promise<boolean>;
  findUser(email: string): Promise<CredentialsUserRecord | null>;
  comparePassword(password: string, hash: string): Promise<boolean>;
  clearEmailRateLimit(email: string): Promise<void>;
}

export async function verifyCredentialsWithDependencies(
  credentials: unknown,
  request: Request,
  dependencies: VerifyCredentialsDependencies
): Promise<VerifiedCredentialsUser | null> {
  const validatedFields = loginSchema.safeParse(credentials);
  if (!validatedFields.success) return null;

  const { email, password } = validatedFields.data;
  if (!(await dependencies.consumeRateLimits(email, request))) return null;

  const user = await dependencies.findUser(email);
  if (!user?.password) {
    await dependencies.comparePassword(password, DUMMY_PASSWORD_HASH);
    return null;
  }

  if (!(await dependencies.comparePassword(password, user.password))) return null;

  await dependencies.clearEmailRateLimit(email);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    mainCurrency: user.mainCurrency,
  };
}
