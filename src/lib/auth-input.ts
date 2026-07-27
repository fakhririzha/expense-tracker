import { z } from "zod";

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

function fitsBcryptPasswordLimit(password: string): boolean {
  return new TextEncoder().encode(password).byteLength <= 72;
}

const emailSchema = z
  .string()
  .transform(normalizeAuthEmail)
  .pipe(z.string().email("Invalid email address").max(254));

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, "Password is required")
    .max(1024)
    .refine(
      fitsBcryptPasswordLimit,
      "Password must be at most 72 bytes"
    ),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .refine(
      fitsBcryptPasswordLimit,
      "Password must be at most 72 bytes"
    ),
  mainCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default("IDR"),
});

export type RegisterInput = z.input<typeof registerSchema>;
export type LoginInput = z.input<typeof loginSchema>;
