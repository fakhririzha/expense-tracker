import { createMissingMonthlyNetWorthSnapshots } from "@/actions/net-worth-snapshot-actions";
import {
  getPreviousMonthPeriod,
  shouldRunMonthlySnapshot,
} from "@/lib/net-worth-period";
import { sendMonthlySnapshotReadyNotification } from "@/lib/notification-service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isCronAuthorized(request: Request): boolean {
  const configuredSecret = process.env.CRON_SECRET;

  if (!configuredSecret) {
    return process.env.NODE_ENV !== "production";
  }

  return request.headers.get("authorization") === `Bearer ${configuredSecret}`;
}

export async function GET(request: Request) {
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const nowUtc = new Date();
    if (!shouldRunMonthlySnapshot(nowUtc)) {
      return NextResponse.json(
        {
          skipped: true,
          reason: "not_first_day",
          date: nowUtc.toISOString(),
        },
        { status: 200 }
      );
    }

    const targetPeriod = getPreviousMonthPeriod(nowUtc);
    const result = await createMissingMonthlyNetWorthSnapshots(targetPeriod);

    for (const userId of result.createdUserIds) {
      try {
        await sendMonthlySnapshotReadyNotification(
          userId,
          `${targetPeriod.year}-${String(targetPeriod.month).padStart(2, "0")}`
        );
      } catch (error) {
        console.error(
          `Monthly snapshot notification error for user ${userId}:`,
          error
        );
      }
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Monthly net worth snapshot cron error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
