import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing } from "@/theme/tokens";
import { Button, styles as uiStyles } from "@/components/ui";

export interface PickerOption {
  id: string;
  label: string;
  detail?: string;
  disabled?: boolean;
}

export function ModalPicker({
  visible,
  title,
  options,
  onSelect,
  onClose,
  emptyMessage = "No options available",
  footer,
}: {
  visible: boolean;
  title: string;
  options: PickerOption[];
  onSelect: (option: PickerOption) => void;
  onClose: () => void;
  emptyMessage?: string;
  footer?: ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={uiStyles.modalCard}>
          <View style={styles.header}>
            <Text selectable style={styles.title}>{title}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
              <Text selectable style={styles.close}>Close</Text>
            </Pressable>
          </View>
          <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.options}>
            {options.length === 0 ? (
              <Text selectable style={styles.empty}>{emptyMessage}</Text>
            ) : options.map((option) => (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ disabled: option.disabled }}
                disabled={option.disabled}
                onPress={() => onSelect(option)}
                style={({ pressed }) => [styles.option, option.disabled && styles.disabled, pressed && styles.pressed]}>
                <Text selectable style={styles.optionLabel}>{option.label}</Text>
                {option.detail ? <Text selectable style={styles.optionDetail}>{option.detail}</Text> : null}
              </Pressable>
            ))}
          </ScrollView>
          {footer ?? <Button variant="secondary" onPress={onClose}>Cancel</Button>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(20, 32, 46, 0.35)", flex: 1, justifyContent: "flex-end" },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  title: { color: colors.text, fontSize: 20, fontWeight: "800" },
  close: { color: colors.primary, fontSize: 15, fontWeight: "700" },
  options: { gap: spacing.sm, paddingVertical: spacing.sm },
  option: { borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 2 },
  optionLabel: { color: colors.text, fontSize: 16, fontWeight: "600" },
  optionDetail: { color: colors.textMuted, fontSize: 13 },
  empty: { color: colors.textMuted, paddingVertical: spacing.lg, textAlign: "center" },
  disabled: { opacity: 0.45 },
  pressed: { backgroundColor: colors.surfaceMuted },
});
