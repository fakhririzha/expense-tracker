import {
  mobileLoginRequestSchema,
  mobileLoginResponseSchema,
  mobileMeResponseSchema,
  mobileLogoutResponseSchema,
  type MobileLoginRequest,
} from "@finhealth/contracts";

import { apiJson, ApiError } from "@/api/client";
import { clearStoredSession, saveStoredSession } from "@/auth/secure-session";

export async function login(input: MobileLoginRequest) {
  const payload = mobileLoginRequestSchema.parse(input);
  const response = await apiJson<unknown>("/api/mobile/v1/auth/login", {
    method: "POST",
    authenticated: false,
    skipUnauthorizedHandler: true,
    body: payload,
  });
  const parsed = mobileLoginResponseSchema.parse(response);
  await saveStoredSession({ token: parsed.token, expiresAt: parsed.expiresAt });
  return parsed;
}

export async function getMe() {
  const response = await apiJson<unknown>("/api/mobile/v1/me", {
    method: "GET",
  });
  return mobileMeResponseSchema.parse(response);
}

export async function logout() {
  try {
    const response = await apiJson<unknown>("/api/mobile/v1/auth/session", {
      method: "DELETE",
      skipUnauthorizedHandler: true,
    });
    const parsed = mobileLogoutResponseSchema.parse(response);
    await clearStoredSession();
    return parsed;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await clearStoredSession();
      return { success: true };
    }
    throw error;
  }
}
