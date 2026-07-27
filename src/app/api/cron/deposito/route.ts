import { NextResponse } from "next/server";

import { processDepositoInterest } from "@/actions/deposito-actions";
import { isCronRequestAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!isCronRequestAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await processDepositoInterest(process.env.CRON_SECRET!);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Failed to process deposito interest." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result.data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Deposito cron error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
