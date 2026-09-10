import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, usePathname, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { queryClient } from "@/api/query-client";
import { AuthProvider, useAuth } from "@/auth/auth-provider";
import { colors } from "@/theme/tokens";

void SplashScreen.preventAutoHideAsync();

function AuthNavigationGuard({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isAuthRoute = pathname.startsWith("/(auth)") || pathname.startsWith("/login");

  useEffect(() => {
    if (status === "loading") return;
    void SplashScreen.hideAsync();
    if (status === "unauthenticated" && !isAuthRoute) {
      router.replace("/(auth)/login");
    } else if (status === "authenticated" && isAuthRoute) {
      router.replace("/(tabs)/transactions");
    }
  }, [isAuthRoute, router, status]);

  if (status === "loading") {
    return (
      <View style={styles.loading}>
        <Text selectable style={styles.brand}>FinHealth</Text>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthNavigationGuard>
          <Stack screenOptions={{ headerBackTitle: "Back", headerTintColor: colors.primary }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="transaction" options={{ headerShown: false }} />
          </Stack>
        </AuthNavigationGuard>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: "center", backgroundColor: colors.background, flex: 1, gap: 20, justifyContent: "center" },
  brand: { color: colors.primary, fontSize: 30, fontWeight: "800", letterSpacing: -0.6 },
});
