import { NextResponse } from "next/server";

import { sendDailyNotificationBatch } from "@/lib/notification-service";
import { isCronRequestAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!isCronRequestAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await sendDailyNotificationBatch();
    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error) {
    console.error("Notification cron error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
