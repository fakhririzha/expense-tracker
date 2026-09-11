export function hasTransactionCoordinate(value: number | null | undefined) {
  return value !== undefined && value !== null;
}

export function hasValidTransactionCoordinatePair(
  latitude: number | null | undefined,
  longitude: number | null | undefined
) {
  return (
    hasTransactionCoordinate(latitude) === hasTransactionCoordinate(longitude)
  );
}

export function haveTransactionCoordinatesChanged(
  next: { latitude?: number | null; longitude?: number | null },
  current: { latitude: number | null; longitude: number | null }
) {
  return (
    (next.latitude !== undefined && next.latitude !== current.latitude) ||
    (next.longitude !== undefined && next.longitude !== current.longitude)
  );
}

function normalizeMapsLink(value: string | null | undefined) {
  return value?.trim() || null;
}

export function haveTransactionMapsLinksChanged(
  next: string | null | undefined,
  current: string | null
) {
  return next !== undefined && normalizeMapsLink(next) !== normalizeMapsLink(current);
}

export function isHttpsTransactionMapsLinkOrEmpty(value: string) {
  const normalizedValue = value.trim();
  if (normalizedValue.length === 0) {
    return true;
  }

  try {
    return new URL(normalizedValue).protocol === "https:";
  } catch {
    return false;
  }
}
