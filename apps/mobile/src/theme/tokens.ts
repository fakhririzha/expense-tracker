import { Platform, StyleSheet } from "react-native";

export const colors = {
  background: "#F6F8FB",
  surface: "#FFFFFF",
  surfaceMuted: "#EEF2F6",
  text: "#14202E",
  textMuted: "#6D7A89",
  border: "#DCE3EA",
  primary: "#157A6E",
  primaryDark: "#0E5A52",
  primarySoft: "#DDF3EF",
  danger: "#C84B4B",
  dangerSoft: "#FDE8E8",
  warning: "#A66A00",
  warningSoft: "#FFF3D6",
  income: "#16794A",
  expense: "#C84B4B",
  transfer: "#3867C7",
  white: "#FFFFFF",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
};

export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: "#14202E",
      shadowOpacity: 0.07,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 2 },
    default: { boxShadow: "0 2px 10px rgba(20, 32, 46, 0.07)" },
  }),
};

export const commonStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  title: { color: colors.text, fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 21 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderCurve: "continuous",
    padding: spacing.lg,
    ...shadows.card,
  },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  value: { color: colors.text, fontSize: 16, fontWeight: "600" },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
});

export function typeColor(type: string) {
  if (type === "INCOME") return colors.income;
  if (type === "TRANSFER") return colors.transfer;
  return colors.expense;
}
