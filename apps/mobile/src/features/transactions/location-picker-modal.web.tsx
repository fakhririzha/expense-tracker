import { Modal, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui";
import { colors, spacing } from "@/theme/tokens";

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface LocationSelection extends Coordinate {
  location: string;
  googleMapsLink: string;
}

interface LocationPickerModalProps {
  visible: boolean;
  initialCoordinate?: Coordinate;
  initialLabel?: string;
  onClose: () => void;
  onSelect: (selection: LocationSelection) => void;
}

export function LocationPickerModal({ visible, onClose }: LocationPickerModalProps) {
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Text selectable style={styles.title}>Map picker unavailable</Text>
          <Text selectable style={styles.description}>
            Choose a transaction location from the FinHealth app on Android or iOS.
          </Text>
          <Button onPress={onClose}>Close</Button>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { flex: 1, gap: spacing.lg, justifyContent: "center", padding: spacing.xl },
  title: { color: colors.text, fontSize: 24, fontWeight: "800" },
  description: { color: colors.textMuted, fontSize: 16, lineHeight: 24 },
});
