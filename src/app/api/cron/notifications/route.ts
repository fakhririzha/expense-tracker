import { NextResponse } from "next/server";

import { sendDailyNotificationBatch } from "@/lib/notification-service";

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
