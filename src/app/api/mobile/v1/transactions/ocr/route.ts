import { NextResponse } from "next/server";

import { authenticateMobileRequest } from "@/server/auth/mobile-session";
import { scanTransactionBillForUser } from "@/server/transactions/transaction-ocr-service";

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateMobileRequest(request);
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const result = await scanTransactionBillForUser(
      authenticated.userId,
      formData
    );
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ data: result.data });
  } catch (error) {
    console.error("Mobile OCR error:", error);
    return NextResponse.json(
      { error: "Failed to scan bill photo" },
      { status: 500 }
    );
  }
}
