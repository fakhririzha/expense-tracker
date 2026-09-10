import { NextResponse } from "next/server";

import { authenticateMobileRequest } from "@/server/auth/mobile-session";
import { readFormDataWithLimit } from "@/server/mobile-api/bounded-form-data";
import { scanTransactionBillForUser } from "@/server/transactions/transaction-ocr-service";
import { MAX_OCR_IMAGE_SIZE } from "@/server/transactions/transaction-ocr-validation";

const MAX_OCR_MULTIPART_BODY_SIZE = MAX_OCR_IMAGE_SIZE + 64 * 1024;

export async function POST(request: Request) {
  try {
    const authenticated = await authenticateMobileRequest(request);
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formDataResult = await readFormDataWithLimit(
      request,
      MAX_OCR_MULTIPART_BODY_SIZE
    );
    if (!formDataResult.success) {
      return NextResponse.json(
        { error: formDataResult.error },
        { status: formDataResult.tooLarge ? 413 : 400 }
      );
    }

    const result = await scanTransactionBillForUser(
      authenticated.userId,
      formDataResult.data
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
