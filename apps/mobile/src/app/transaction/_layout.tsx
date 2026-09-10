import { Stack } from "expo-router";

import { colors } from "@/theme/tokens";

export default function TransactionLayout() {
  return <Stack screenOptions={{ headerTintColor: colors.primary, headerTitleStyle: { color: colors.text, fontWeight: "800" } }} />;
}
