import { NextResponse } from "next/server";

import { saveLatestPegadaianGoldPriceSnapshot } from "@/lib/pegadaian-gold-service";
import { isCronRequestAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!isCronRequestAuthorized(request)) {
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
