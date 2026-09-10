import { NextResponse } from "next/server";

import {
  authenticateMobileRequest,
  deleteMobileSession,
} from "@/server/auth/mobile-session";

export async function DELETE(request: Request) {
  try {
    const authenticated = await authenticateMobileRequest(request);
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await deleteMobileSession(authenticated.token);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mobile logout error:", error);
    return NextResponse.json({ error: "Unable to sign out" }, { status: 500 });
  }
}
