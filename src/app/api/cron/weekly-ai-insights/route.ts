import { NextResponse } from "next/server";

import { sendWeeklyAiInsightReadyNotification } from "@/lib/notification-service";
import { generateMissingWeeklyAiInsights } from "@/lib/weekly-ai-insight-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isCronAuthorized(request: Request): boolean {
  const configuredSecret = process.env.CRON_SECRET;
  return configuredSecret
    ? request.headers.get("authorization") === `Bearer ${configuredSecret}`
    : process.env.NODE_ENV !== "production";
}

export async function GET(request: Request) {
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await generateMissingWeeklyAiInsights();
    for (const insight of result.createdInsights) {
      try {
        await sendWeeklyAiInsightReadyNotification(insight.userId, insight.periodStart);
      } catch (error) {
        console.error(`Weekly AI insight notification error for user ${insight.userId}:`, error);
      }
    }

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error) {
    console.error("Weekly AI insights cron error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
