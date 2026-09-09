import "dotenv/config";
import prisma from "../lib/db.ts";
import { vapidKeysMatch } from "../lib/vapid-key-validation.ts";

async function main() {
  const cutoffText = process.argv.find((arg) => arg.startsWith("--before="))?.slice(9);
  const cutoff = new Date(cutoffText ?? "");
  if (!cutoffText || !Number.isFinite(cutoff.getTime()) || cutoff > new Date()) {
    throw new Error("Supply --before=<UTC deployment cutoff> in the past.");
  }
  if (!vapidKeysMatch(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "", process.env.VAPID_PRIVATE_KEY ?? "")) {
    throw new Error("Configure a matching replacement VAPID key pair first.");
  }
  // Run with senders and registration paused; exclude registrations refreshed after the cutoff.
  const where = { disabledAt: null, createdAt: { lt: cutoff }, lastSeenAt: { lt: cutoff } };
  if (!process.argv.includes("--apply")) {
    console.log({ mode: "dry-run", count: await prisma.pushSubscription.count({ where }), cutoff: cutoff.toISOString() });
    return;
  }
  const result = await prisma.pushSubscription.updateMany({ where, data: { disabledAt: new Date() } });
  console.log({ mode: "applied", count: result.count, cutoff: cutoff.toISOString() });
}
main().catch(() => {
  console.error("Subscription retirement failed. Verify configuration and cutoff; no credentials are logged.");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
