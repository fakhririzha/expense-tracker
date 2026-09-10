import { Tabs } from "expo-router";

import { colors } from "@/theme/tokens";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontWeight: "800" },
      }}>
      <Tabs.Screen name="transactions" options={{ title: "Transactions", tabBarLabel: "Activity" }} />
      <Tabs.Screen name="accounts" options={{ title: "Accounts", tabBarLabel: "Accounts" }} />
    </Tabs>
  );
}
