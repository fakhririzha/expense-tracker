import { createECDH, timingSafeEqual } from "node:crypto";

export function vapidKeysMatch(publicKey: string, privateKey: string): boolean {
  try {
    const publicBytes = Buffer.from(publicKey, "base64url");
    const privateBytes = Buffer.from(privateKey, "base64url");
    if (publicBytes.length !== 65 || privateBytes.length !== 32 ||
      publicBytes.toString("base64url") !== publicKey || privateBytes.toString("base64url") !== privateKey) return false;
    const curve = createECDH("prime256v1");
    curve.setPrivateKey(privateBytes);
    return timingSafeEqual(curve.getPublicKey(), publicBytes);
  } catch { return false; }
}
