export function isCronRequestAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("Cron request rejected: CRON_SECRET is not configured.");
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}
