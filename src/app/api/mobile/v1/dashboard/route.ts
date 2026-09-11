import { NextResponse } from "next/server";

import { getExecutiveMetricsForUser } from "@/lib/executive-service";
import { authenticateMobileRequest } from "@/server/auth/mobile-session";
import { createMobileDashboardResponse } from "@/server/mobile-api/dashboard-dto";

export async function GET(request: Request) {
  try {
    const authenticated = await authenticateMobileRequest(request);
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await getExecutiveMetricsForUser(authenticated.userId);
    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error ?? "Failed to fetch dashboard" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      createMobileDashboardResponse(result.data),
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Mobile dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard" },
      { status: 500 }
    );
  }
}
