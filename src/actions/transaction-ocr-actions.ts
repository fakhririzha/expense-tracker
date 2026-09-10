"use server";

import { auth } from "@/auth";
import {
  scanTransactionBillForUser,
  type ScanTransactionBillResult,
  type TransactionOcrResult,
} from "@/server/transactions/transaction-ocr-service";

export type { ScanTransactionBillResult, TransactionOcrResult };

export async function scanTransactionBill(
  formData: FormData
): Promise<ScanTransactionBillResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  return scanTransactionBillForUser(session.user.id, formData);
}
