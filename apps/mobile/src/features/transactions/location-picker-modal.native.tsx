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

function isValidCoordinate(coordinate: Coordinate | undefined): coordinate is Coordinate {
  return Boolean(
    coordinate &&
    Number.isFinite(coordinate.latitude) &&
    Number.isFinite(coordinate.longitude) &&
    coordinate.latitude >= -90 &&
    coordinate.latitude <= 90 &&
    coordinate.longitude >= -180 &&
    coordinate.longitude <= 180
  );
}

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

function hasSameCoordinate(left: Coordinate, right?: Coordinate) {
  return Boolean(
    right &&
    left.latitude === right.latitude &&
    left.longitude === right.longitude
  );
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
  const startingCoordinate = isValidCoordinate(initialCoordinate) ? initialCoordinate : defaultCoordinate;
  const initialLatitude = isValidCoordinate(initialCoordinate) ? initialCoordinate.latitude : undefined;
  const initialLongitude = isValidCoordinate(initialCoordinate) ? initialCoordinate.longitude : undefined;
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
      setIsLocating(false);
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
    if (isResolving || !isValidCoordinate(nextCoordinate)) return;
    resolveSequenceRef.current += 1;
    setIsLocating(false);
    setCoordinate(nextCoordinate);
    setError(null);
  };

  const handleMapPress = (event: MapPressEvent) => {
    chooseCoordinate(event.nativeEvent.coordinate);
  };

  const handleUseCurrentLocation = async () => {
    const sequence = ++resolveSequenceRef.current;
    setIsLocating(true);
    setError(null);
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (sequence !== resolveSequenceRef.current) return;
      if (!servicesEnabled) {
        setError("Turn on Location Services in Settings, then try again.");
        return;
      }
      const existingPermission = await Location.getForegroundPermissionsAsync();
      if (sequence !== resolveSequenceRef.current) return;
      const permission = existingPermission.granted
        ? existingPermission
        : await Location.requestForegroundPermissionsAsync();
      if (sequence !== resolveSequenceRef.current) return;
      if (!permission.granted) {
        setError(permission.canAskAgain
          ? "Allow location access to use your current position."
          : "Location access is denied. Enable it in Settings to use your current position.");
        return;
      }
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (sequence !== resolveSequenceRef.current) return;
      const nextCoordinate = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      if (!isValidCoordinate(nextCoordinate)) {
        setError("Your device returned an invalid location. Try again or place the pin manually.");
        return;
      }
      const nextRegion = regionFor(nextCoordinate);
      setCoordinate(nextCoordinate);
      setRegion(nextRegion);
      mapRef.current?.animateToRegion(nextRegion, 300);
    } catch {
      if (sequence === resolveSequenceRef.current) {
        setError("Unable to retrieve your current location. Try again or place the pin manually.");
      }
    } finally {
      if (sequence === resolveSequenceRef.current) {
        setIsLocating(false);
      }
    }
  };

  const confirmLocation = async () => {
    const sequence = ++resolveSequenceRef.current;
    const selectedCoordinate = { ...coordinate };
    if (!isValidCoordinate(selectedCoordinate)) {
      setError("Choose a valid location on the map before continuing.");
      return;
    }
    const fallbackLabel = hasSameCoordinate(selectedCoordinate, initialCoordinate)
      ? initialLabel?.trim() || "Pinned location"
      : "Pinned location";
    setIsResolving(true);
    setError(null);
    try {
      const addresses = await Location.reverseGeocodeAsync(selectedCoordinate);
      if (sequence !== resolveSequenceRef.current) return;
      onSelect({
        ...selectedCoordinate,
        location: formatAddress(addresses[0]) || fallbackLabel,
        googleMapsLink: buildGoogleMapsLink(selectedCoordinate),
      });
    } catch {
      if (sequence !== resolveSequenceRef.current) return;
      onSelect({
        ...selectedCoordinate,
        location: fallbackLabel,
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
    setIsLocating(false);
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
          onRegionChangeComplete={(nextRegion) => {
            if (isValidCoordinate(nextRegion)) setRegion(nextRegion);
          }}
          onPress={handleMapPress}
          showsCompass>
          <Marker coordinate={coordinate} draggable onDragEnd={(event) => chooseCoordinate(event.nativeEvent.coordinate)} />
        </MapView>
        <View style={styles.footer}>
          <Text selectable style={styles.coordinateText}>
            {coordinate.latitude.toFixed(6)}, {coordinate.longitude.toFixed(6)}
          </Text>
          {error ? <Text selectable style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Button variant="secondary" onPress={() => void handleUseCurrentLocation()} disabled={isResolving} loading={isLocating}>
              Use current location
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
