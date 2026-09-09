export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export function applicationServerKeyMatches(key: ArrayBuffer | null, configured: string | null | undefined): boolean {
  if (!key || !configured) return false;
  try {
    const expected = urlBase64ToUint8Array(configured);
    const actual = new Uint8Array(key);
    return expected.length === 65 && actual.length === expected.length && actual.every((byte, index) => byte === expected[index]);
  } catch { return false; }
}

export function pushRegistrationError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Failed to enable push notifications.";
  if (/registration failed.*push service error/i.test(message)) {
    return "Chrome could not register with Google's push service. Retry, update Chrome, check VPN or firewall restrictions, then reset this site's notification permission and enable again.";
  }
  return message;
}
