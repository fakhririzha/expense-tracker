import type { MobileUser, MobileLoginRequest } from "@finhealth/contracts";
import { useRouter } from "expo-router";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { getMe, login as loginRequest, logout as logoutRequest } from "@/api/auth";
import { setUnauthorizedHandler } from "@/api/client";
import { queryClient } from "@/api/query-client";
import { clearStoredSession, getStoredSession } from "@/auth/secure-session";

interface AuthContextValue {
  status: "loading" | "authenticated" | "unauthenticated";
  user: MobileUser | null;
  signIn: (credentials: MobileLoginRequest) => Promise<MobileUser>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [user, setUser] = useState<MobileUser | null>(null);

  useEffect(() => {
    let active = true;
    const clearAndRedirect = async () => {
      await clearStoredSession();
      queryClient.clear();
      if (active) {
        setUser(null);
        setStatus("unauthenticated");
        router.replace("/(auth)/login");
      }
    };

    const cleanupHandler = setUnauthorizedHandler(clearAndRedirect);
    void (async () => {
      const session = await getStoredSession();
      if (!active) return;
      if (!session) {
        setStatus("unauthenticated");
        return;
      }
      try {
        const currentUser = await getMe();
        if (!active) return;
        setUser(currentUser);
      } catch {
        // Keep a valid local session usable for cached data when the device is offline.
        // A server 401 invokes clearAndRedirect through the shared API client.
      } finally {
        if (active) {
          const sessionStillExists = await getStoredSession();
          if (active) setStatus(sessionStillExists ? "authenticated" : "unauthenticated");
        }
      }
    })();

    return () => {
      active = false;
      cleanupHandler();
    };
  }, [router]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user,
    signIn: async (credentials) => {
      const response = await loginRequest(credentials);
      queryClient.clear();
      setUser(response.user);
      setStatus("authenticated");
      return response.user;
    },
    signOut: async () => {
      await logoutRequest();
      await clearStoredSession();
      queryClient.clear();
      setUser(null);
      setStatus("unauthenticated");
      router.replace("/(auth)/login");
    },
  }), [router, status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
