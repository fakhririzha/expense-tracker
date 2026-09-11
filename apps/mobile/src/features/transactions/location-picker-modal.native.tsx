import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import {
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, type MapPressEvent, type Region } from "react-native-maps";

import { Button } from "@/components/ui";
import { colors, radii, spacing } from "@/theme/tokens";

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

const defaultCoordinate: Coordinate = {
  latitude: -6.2,
  longitude: 106.816666,
};

function regionFor(coordinate: Coordinate): Region {
  return {
    ...coordinate,
    latitudeDelta: 0.012,
    longitudeDelta: 0.012,
  };
}

function buildGoogleMapsLink({ latitude, longitude }: Coordinate) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

function formatAddress(address?: Location.LocationGeocodedAddress) {
  if (!address) return null;
  const parts = [
    address.name,
    address.street,
    address.district,
    address.city,
    address.region,
  ].filter((part, index, values): part is string => Boolean(part) && values.indexOf(part) === index);
  return parts.join(", ") || null;
}

export function LocationPickerModal({
  visible,
  initialCoordinate,
  initialLabel,
  onClose,
  onSelect,
}: LocationPickerModalProps) {
  const startingCoordinate = initialCoordinate ?? defaultCoordinate;
  const initialLatitude = initialCoordinate?.latitude;
  const initialLongitude = initialCoordinate?.longitude;
  const mapRef = useRef<MapView>(null);
  const resolveSequenceRef = useRef(0);
  const [coordinate, setCoordinate] = useState<Coordinate>(startingCoordinate);
  const [region, setRegion] = useState<Region>(() => regionFor(startingCoordinate));
  const [isLocating, setIsLocating] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    resolveSequenceRef.current += 1;
    if (!visible) {
      setIsResolving(false);
      return;
    }
    const nextCoordinate = initialLatitude !== undefined && initialLongitude !== undefined
      ? { latitude: initialLatitude, longitude: initialLongitude }
      : defaultCoordinate;
    const nextRegion = regionFor(nextCoordinate);
    setCoordinate(nextCoordinate);
    setRegion(nextRegion);
    setError(null);
    mapRef.current?.animateToRegion(nextRegion, 250);
  }, [initialLatitude, initialLongitude, visible]);

  const chooseCoordinate = (nextCoordinate: Coordinate) => {
    if (isResolving) return;
    setCoordinate(nextCoordinate);
    setError(null);
  };

  const handleMapPress = (event: MapPressEvent) => {
    chooseCoordinate(event.nativeEvent.coordinate);
  };

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError("Allow location access to use your current position.");
        return;
      }
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const nextCoordinate = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      const nextRegion = regionFor(nextCoordinate);
      setCoordinate(nextCoordinate);
      setRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 300);
    } catch {
      setError("Unable to retrieve your current location. Try again or place the pin manually.");
    } finally {
      setIsLocating(false);
    }
  };

  const confirmLocation = async () => {
    const sequence = ++resolveSequenceRef.current;
    const selectedCoordinate = { ...coordinate };
    setIsResolving(true);
    setError(null);
    try {
      const addresses = await Location.reverseGeocodeAsync(selectedCoordinate);
      if (sequence !== resolveSequenceRef.current) return;
      onSelect({
        ...selectedCoordinate,
        location: formatAddress(addresses[0]) || initialLabel?.trim() || "Pinned location",
        googleMapsLink: buildGoogleMapsLink(selectedCoordinate),
      });
    } catch {
      if (sequence !== resolveSequenceRef.current) return;
      onSelect({
        ...selectedCoordinate,
        location: initialLabel?.trim() || "Pinned location",
        googleMapsLink: buildGoogleMapsLink(selectedCoordinate),
      });
    } finally {
      if (sequence === resolveSequenceRef.current) {
        setIsResolving(false);
      }
    }
  };

  const cancel = () => {
    resolveSequenceRef.current += 1;
    setIsResolving(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={cancel}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text selectable style={styles.title}>Choose location</Text>
            <Text selectable style={styles.subtitle}>Tap the map to move the pin.</Text>
          </View>
          <Button variant="ghost" onPress={cancel}>Cancel</Button>
        </View>
        <MapView
          ref={mapRef}
          style={styles.map}
          region={region}
          onRegionChangeComplete={setRegion}
          onPress={handleMapPress}
          showsCompass
          showsUserLocation>
          <Marker coordinate={coordinate} draggable onDragEnd={(event) => chooseCoordinate(event.nativeEvent.coordinate)} />
        </MapView>
        <View style={styles.footer}>
          <Text selectable style={styles.coordinateText}>
            {coordinate.latitude.toFixed(6)}, {coordinate.longitude.toFixed(6)}
          </Text>
          {error ? <Text selectable style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Button variant="secondary" onPress={() => void handleUseCurrentLocation()} disabled={isResolving || isLocating}>
              {isLocating ? "Locating…" : "Use current location"}
            </Button>
            <Button onPress={() => void confirmLocation()} disabled={isLocating} loading={isResolving}>
              Use this location
            </Button>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: {
    alignItems: "center",
    backgroundColor: colors.surface,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 20, fontWeight: "800" },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  map: { flex: 1 },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  coordinateText: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  error: { color: colors.danger, lineHeight: 20 },
  actions: { gap: spacing.sm },
});
