import { z } from "zod";

export const mobileLoginRequestSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(1024),
});

export type MobileLoginRequest = z.infer<typeof mobileLoginRequestSchema>;

export const mobileUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().nullable(),
  email: z.string().email(),
  mainCurrency: z.string().regex(/^[A-Z]{3}$/),
});

export type MobileUser = z.infer<typeof mobileUserSchema>;

export const mobileLoginResponseSchema = z.object({
  token: z.string().min(1),
  expiresAt: z.string().datetime({ offset: true }),
  user: mobileUserSchema,
});

export type MobileLoginResponse = z.infer<typeof mobileLoginResponseSchema>;

export const mobileMeResponseSchema = mobileUserSchema;
export type MobileMeResponse = z.infer<typeof mobileMeResponseSchema>;

export const mobileLogoutResponseSchema = z.object({
  success: z.boolean(),
});

export type MobileLogoutResponse = z.infer<typeof mobileLogoutResponseSchema>;
