import { NextResponse } from "next/server";

import { authenticateMobileRequest } from "@/server/auth/mobile-session";

export async function GET(request: Request) {
  try {
    const authenticated = await authenticateMobileRequest(request);
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(authenticated.user);
  } catch (error) {
    console.error("Mobile user error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}
