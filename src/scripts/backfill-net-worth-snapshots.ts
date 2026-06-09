/**
 * Backfill missing net worth snapshots using the current state at run time.
 *
 * Usage:
 * pnpm tsx src/scripts/backfill-net-worth-snapshots.ts --year=2026 --month=6 [--user-id=...] [--dry-run]
 */

import "dotenv/config";

import prisma from "@/lib/db";
import { createNetWorthSnapshotIfMissing } from "@/lib/net-worth-snapshot-service";
import type { NetWorthPeriod } from "@/lib/net-worth-types";

interface ScriptArgs {
  year: number;
  month: number;
  userId?: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): ScriptArgs {
  const args = new Map<string, string>();
  let dryRun = false;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    const [key, value] = arg.split("=");
    if (key.startsWith("--") && value) {
      args.set(key.slice(2), value);
    }
  }

  const year = Number(args.get("year"));
  const month = Number(args.get("month"));

  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new Error("Provide a valid --year value");
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Provide a valid --month value between 1 and 12");
  }

  return {
    year,
    month,
    userId: args.get("user-id"),
    dryRun,
  };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const period: NetWorthPeriod = { year: parsed.year, month: parsed.month };
  const users = parsed.userId
    ? [{ id: parsed.userId }]
    : await prisma.user.findMany({
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });

  let created = 0;
  let skipped = 0;
  let failed = 0;

  console.log(
    `Backfilling net worth snapshots for ${period.year}-${String(period.month).padStart(2, "0")}${parsed.dryRun ? " (dry run)" : ""}`
  );

  for (const user of users) {
    try {
      if (parsed.dryRun) {
        const existing = await prisma.netWorthSnapshot.findUnique({
          where: {
            userId_periodYear_periodMonth: {
              userId: user.id,
              periodYear: period.year,
              periodMonth: period.month,
            },
          },
        });

        if (existing) {
          skipped += 1;
          console.log(`SKIP ${user.id}: snapshot already exists`);
        } else {
          created += 1;
          console.log(`CREATE ${user.id}: snapshot would be created`);
        }
        continue;
      }

      const result = await createNetWorthSnapshotIfMissing(user.id, period, {
        trigger: "manual_backfill",
        calculationMode: "current_state_at_run_time",
      });

      if (result.created) {
        created += 1;
        console.log(`CREATE ${user.id}: snapshot created`);
      } else {
        skipped += 1;
        console.log(`SKIP ${user.id}: snapshot already exists`);
      }
    } catch (error) {
      failed += 1;
      console.error(
        `FAIL ${user.id}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  console.log(
    `Done. Created=${created} Skipped=${skipped} Failed=${failed}`
  );
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
