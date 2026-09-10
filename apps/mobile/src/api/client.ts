import { fetch as expoFetch } from "expo/fetch";

import { clearStoredSession, getStoredToken } from "@/auth/secure-session";

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const LOCAL_HTTP_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "10.0.2.2"]);

function resolveApiUrl(value: string): string {
  const normalized = value.replace(/\/$/, "");
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("EXPO_PUBLIC_API_URL must be a valid absolute URL.");
  }

  const isLocalDevelopmentTarget =
    process.env.NODE_ENV !== "production" &&
    parsed.protocol === "http:" &&
    LOCAL_HTTP_HOSTS.has(parsed.hostname);
  if (parsed.protocol !== "https:" && !isLocalDevelopmentTarget) {
    throw new Error(
      "EXPO_PUBLIC_API_URL must use HTTPS. HTTP is limited to local emulators during development.",
    );
  }

  return normalized;
}

const apiUrl = resolveApiUrl(
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
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
  timeoutMs?: number;
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
  const {
    skipUnauthorizedHandler,
    authenticated = true,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    ...fetchOptions
  } = options;
  const token = authenticated ? await getStoredToken() : null;
  const headers = new Headers(fetchOptions.headers);
  headers.set("Accept", "application/json");
  if (fetchOptions.body && !(fetchOptions.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  const timeoutController = new AbortController();
  const callerSignal = fetchOptions.signal;
  const abortFromCaller = () => timeoutController.abort();
  if (callerSignal?.aborted) abortFromCaller();
  else callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeoutId = setTimeout(
    () => timeoutController.abort(),
    Math.max(1, timeoutMs),
  );
  try {
    response = await expoFetch(`${apiUrl}${path}`, {
      ...fetchOptions,
      headers,
      signal: timeoutController.signal,
    });
  } catch {
    if (timeoutController.signal.aborted && !callerSignal?.aborted) {
      throw new ApiError(
        "FinHealth took too long to respond. Try again.",
        0,
        "REQUEST_TIMEOUT",
      );
    }
    throw new ApiError(
      "Unable to reach FinHealth. Check your connection and try again.",
      0,
      "NETWORK_ERROR",
    );
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener("abort", abortFromCaller);
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

export async function apiFormData<T>(
  path: string,
  formData: FormData,
  options: Pick<RequestOptions, "timeoutMs"> = {},
) {
  return apiRequest<T>(path, { ...options, method: "POST", body: formData });
}
