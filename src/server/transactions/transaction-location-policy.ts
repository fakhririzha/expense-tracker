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
