import { NextResponse } from "next/server";

import { saveLatestPegadaianGoldPriceSnapshot } from "@/lib/pegadaian-gold-service";

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

    const snapshot = await saveLatestPegadaianGoldPriceSnapshot();

    return NextResponse.json(
      {
        success: true,
        data: snapshot,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Pegadaian gold price cron error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
