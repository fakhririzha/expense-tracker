import { Redirect } from "expo-router";
import type { Href } from "expo-router";

import { useAuth } from "@/auth/auth-provider";

export default function IndexRoute() {
  const { status } = useAuth();
  if (status === "loading") return null;
  const href = status === "authenticated" ? "/(tabs)/dashboard" : "/(auth)/login";
  return <Redirect href={href as Href} />;
}
