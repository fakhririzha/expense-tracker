import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";

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
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color, focused }) => <SymbolView name={{ ios: focused ? "house.fill" : "house", android: focused ? "home_filled" : "home", web: focused ? "home_filled" : "home" }} tintColor={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
          tabBarLabel: "Activity",
          tabBarIcon: ({ color, focused }) => <SymbolView name={{ ios: focused ? "list.bullet.rectangle.portrait.fill" : "list.bullet.rectangle.portrait", android: focused ? "list_alt" : "format_list_bulleted", web: focused ? "list_alt" : "format_list_bulleted" }} tintColor={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: "Accounts",
          tabBarLabel: "Accounts",
          tabBarIcon: ({ color, focused }) => <SymbolView name={{ ios: focused ? "wallet.pass.fill" : "wallet.pass", android: focused ? "account_balance_wallet" : "wallet", web: focused ? "account_balance_wallet" : "wallet" }} tintColor={color} size={22} />,
        }}
      />
    </Tabs>
  );
}
