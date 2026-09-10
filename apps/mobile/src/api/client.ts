import { fetch as expoFetch } from "expo/fetch";

import { clearStoredSession, getStoredToken } from "@/auth/secure-session";

const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}
type UnauthorizedHandler = () => void | Promise<void>;
let unauthorizedHandler: UnauthorizedHandler | undefined;
let unauthorizedPromise: Promise<void> | null = null;

export function setUnauthorizedHandler(handler?: UnauthorizedHandler) {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = undefined;
  };
}

export function getApiUrl() {
  return apiUrl;
}

interface RequestOptions extends RequestInit {
  skipUnauthorizedHandler?: boolean;
  authenticated?: boolean;
}

async function handleUnauthorized() {
  if (!unauthorizedHandler) {
    await clearStoredSession();
    return;
  }
  if (!unauthorizedPromise) {
    unauthorizedPromise = Promise.resolve(unauthorizedHandler()).finally(() => {
      unauthorizedPromise = null;
    });
  }
  await unauthorizedPromise;
}

async function readError(response: Response) {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "error" in body) {
      const error = body.error;
      if (typeof error === "string" && error.length > 0) return error;
    }
  } catch {
    // Fall through to the status-based message.
  }
  return response.statusText || "Request failed";
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { skipUnauthorizedHandler, authenticated = true, ...fetchOptions } = options;
  const token = authenticated ? await getStoredToken() : null;
  const headers = new Headers(fetchOptions.headers);
  headers.set("Accept", "application/json");
  if (fetchOptions.body && !(fetchOptions.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await expoFetch(`${apiUrl}${path}`, { ...fetchOptions, headers });
  } catch {
    throw new ApiError(
      "Unable to reach FinHealth. Check your connection and try again.",
      0,
      "NETWORK_ERROR",
    );
  }

  if (response.status === 401 && !skipUnauthorizedHandler) {
    await handleUnauthorized();
  }
  if (!response.ok) {
    throw new ApiError(await readError(response), response.status);
  }

  if (response.status === 204) return undefined as T;
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError("FinHealth returned an invalid response.", response.status);
  }
}

export async function apiJson<T>(
  path: string,
  options: Omit<RequestOptions, "body"> & { body?: unknown } = {},
) {
  const body = options.body === undefined ? undefined : JSON.stringify(options.body);
  return apiRequest<T>(path, { ...options, body });
}

export async function apiFormData<T>(path: string, formData: FormData) {
  return apiRequest<T>(path, { method: "POST", body: formData });
}
