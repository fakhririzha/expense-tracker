import { mobileLoginRequestSchema } from "@finhealth/contracts";
import { NextResponse } from "next/server";

import { createMobileSession } from "@/server/auth/mobile-session";
import { verifyCredentials } from "@/server/auth/verify-credentials";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = mobileLoginRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid login request" },
        { status: 400 }
      );
    }

    const user = await verifyCredentials(parsed.data, request);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const session = await createMobileSession(user.id);
    return NextResponse.json({
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mainCurrency: user.mainCurrency,
      },
    });
  } catch (error) {
    console.error("Mobile login error:", error);
    return NextResponse.json({ error: "Unable to sign in" }, { status: 500 });
  }
}
