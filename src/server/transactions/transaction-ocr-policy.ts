const JAKARTA_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

export function getJakartaDayBounds(now = new Date()) {
  const jakartaDate = new Date(now.getTime() + JAKARTA_UTC_OFFSET_MS);
  const startUtcMs =
    Date.UTC(
      jakartaDate.getUTCFullYear(),
      jakartaDate.getUTCMonth(),
      jakartaDate.getUTCDate()
    ) - JAKARTA_UTC_OFFSET_MS;

  return {
    start: new Date(startUtcMs),
    end: new Date(startUtcMs + 24 * 60 * 60 * 1000),
  };
}

export function hasRemainingOcrQuota(
  completedToday: number,
  dailyLimit: number
): boolean {
  return completedToday < dailyLimit;
}
