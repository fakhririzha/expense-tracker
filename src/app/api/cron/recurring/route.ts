import { processRecurringTransactions } from "@/lib/recurring-processing-service";
import { isCronRequestAuthorized } from "@/lib/cron-auth";
import { NextResponse } from "next/server";

// Vercel Cron configuration
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This endpoint should be called by Vercel Cron daily
// Configure in vercel.json:
// {
//   "crons": [{
//     "path": "/api/cron/recurring",
//     "schedule": "15 0 * * *"
//   }]
// }

export async function GET(request: Request) {
  try {
    if (!isCronRequestAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await processRecurringTransactions();

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Recurring transactions processed",
      data: result.data,
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
