import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type ScrollViewProps,
  type TextInputProps,
  View,
} from "react-native";

import { colors, commonStyles, radii, shadows, spacing } from "@/theme/tokens";

export function ScreenScroll({ children, contentContainerStyle, refreshControl }: {
  children: ReactNode;
  contentContainerStyle?: object;
  refreshControl?: ScrollViewProps["refreshControl"];
}) {
  return (
    <ScrollView
      style={commonStyles.screen}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}>
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[commonStyles.card, style]}>{children}</View>;
}

export function Button({
  children,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  style?: object;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "secondary" && styles.buttonSecondary,
        variant === "danger" && styles.buttonDanger,
        variant === "ghost" && styles.buttonGhost,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === "ghost" ? colors.primary : colors.white} />
      ) : (
        <Text
          selectable
          style={[
            styles.buttonText,
            variant === "secondary" && styles.buttonSecondaryText,
            variant === "ghost" && styles.buttonGhostText,
          ]}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({ label, error, children }: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text selectable style={commonStyles.label}>{label}</Text>
      {children}
      {error ? <Text selectable style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function TextField({ error, label, style, ...props }: TextInputProps & { error?: string; label?: string }) {
  return (
    <View style={styles.field}>
      {label ? <Text selectable style={commonStyles.label}>{label}</Text> : null}
      <TextInput
        {...props}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, style]}
        accessibilityLabel={props.accessibilityLabel ?? props.placeholder}
      />
      {error ? <Text selectable style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <View style={styles.centerState}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text selectable style={commonStyles.subtitle}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, description, action }: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.centerState}>
      <Text selectable style={styles.emptyTitle}>{title}</Text>
      <Text selectable style={[commonStyles.subtitle, styles.centerText]}>{description}</Text>
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.centerState}>
      <Text selectable style={styles.emptyTitle}>Something went wrong</Text>
      <Text selectable style={[commonStyles.subtitle, styles.centerText]}>{message}</Text>
      <Button onPress={onRetry} variant="secondary">Try again</Button>
    </View>
  );
}

export function OfflineBanner({ isOnline }: { isOnline: boolean }) {
  if (isOnline) return null;
  return (
    <View style={styles.offlineBanner}>
      <Text selectable style={styles.offlineText}>Offline — showing cached data. Changes need a connection.</Text>
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text selectable style={commonStyles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function Pill({ label, color = colors.surfaceMuted, textColor = colors.textMuted }: {
  label: string;
  color?: string;
  textColor?: string;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: color }]}>
      <Text selectable style={[styles.pillText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

export function SelectField({
  value,
  placeholder,
  onPress,
  disabled = false,
  error,
}: {
  value?: string;
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.select, disabled && styles.disabled, pressed && !disabled && styles.buttonPressed]}>
      <Text selectable style={value ? styles.selectValue : styles.selectPlaceholder}>{value ?? placeholder}</Text>
      <Text selectable style={styles.selectChevron}>⌄</Text>
      {error ? <Text selectable style={styles.errorText}>{error}</Text> : null}
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  scrollContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  button: {
    minHeight: 48,
    borderRadius: radii.md,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  buttonDanger: { backgroundColor: colors.danger },
  buttonGhost: { backgroundColor: "transparent" },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: "700" },
  buttonSecondaryText: { color: colors.text },
  buttonGhostText: { color: colors.primary },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.72 },
  field: { gap: spacing.sm },
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: spacing.md,
  },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  centerState: { alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xxl, minHeight: 220 },
  centerText: { textAlign: "center" },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: "700", textAlign: "center" },
  offlineBanner: { backgroundColor: colors.warningSoft, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  offlineText: { color: colors.warning, fontSize: 13, fontWeight: "600", textAlign: "center" },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  pill: { borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  pillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  select: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  selectValue: { color: colors.text, fontSize: 16, paddingRight: spacing.xl },
  selectPlaceholder: { color: colors.textMuted, fontSize: 16, paddingRight: spacing.xl },
  selectChevron: { color: colors.textMuted, fontSize: 22, position: "absolute", right: spacing.md, top: 8 },
  disabled: { opacity: 0.5 },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderCurve: "continuous",
    padding: spacing.lg,
    gap: spacing.md,
    maxHeight: "80%",
    ...shadows.card,
  },
});
