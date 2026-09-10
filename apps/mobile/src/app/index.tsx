import { Redirect } from "expo-router";

import { useAuth } from "@/auth/auth-provider";

export default function IndexRoute() {
  const { status } = useAuth();
  if (status === "loading") return null;
  return <Redirect href={status === "authenticated" ? "/(tabs)/transactions" : "/(auth)/login"} />;
}
