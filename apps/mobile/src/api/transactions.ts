import {
  mobileCreateTransactionSchema,
  mobileTransactionDetailSchema,
  mobileTransactionListResponseSchema,
  mobileUpdateTransactionSchema,
  transactionOcrResponseSchema,
  type MobileCreateTransaction,
  type MobileTransactionDetail,
  type MobileTransactionListResponse,
  type MobileUpdateTransaction,
  type TransactionListQuery,
} from "@finhealth/contracts";

import { apiFormData, apiJson } from "@/api/client";

export async function getTransactions(
  query: Partial<TransactionListQuery> & { page: number; pageSize: number },
): Promise<MobileTransactionListResponse> {
  const params = new URLSearchParams();
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));
  params.set("sortBy", query.sortBy ?? "date");
  params.set("sortOrder", query.sortOrder ?? "desc");
  if (query.accountId) params.set("accountId", query.accountId);
  if (query.categoryId) params.set("categoryId", query.categoryId);
  if (query.type) params.set("type", query.type);
  if (query.startDate) params.set("startDate", query.startDate);
  if (query.endDate) params.set("endDate", query.endDate);
  const response = await apiJson<unknown>(
    `/api/mobile/v1/transactions?${params.toString()}`,
    { method: "GET" },
  );
  return mobileTransactionListResponseSchema.parse(response);
}
export async function getTransaction(id: string): Promise<MobileTransactionDetail> {
  const response = await apiJson<unknown>(`/api/mobile/v1/transactions/${encodeURIComponent(id)}`, {
    method: "GET",
  });
  return mobileTransactionDetailSchema.parse(response);
}

export async function createTransaction(input: MobileCreateTransaction) {
  const payload = mobileCreateTransactionSchema.parse(input);
  const response = await apiJson<unknown>("/api/mobile/v1/transactions", {
    method: "POST",
    body: payload,
  });
  return mobileTransactionDetailSchema.parse(response);
}

export async function updateTransaction(id: string, input: MobileUpdateTransaction) {
  const payload = mobileUpdateTransactionSchema.parse(input);
  const response = await apiJson<unknown>(`/api/mobile/v1/transactions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: payload,
  });
  return mobileTransactionDetailSchema.parse(response);
}

export async function deleteTransaction(id: string) {
  return apiJson<{ success: boolean }>(`/api/mobile/v1/transactions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function scanTransactionReceipt(file: Blob) {
  const formData = new FormData();
  formData.append("image", file, "receipt.jpg");
  const response = await apiFormData<unknown>(
    "/api/mobile/v1/transactions/ocr",
    formData,
    { timeoutMs: 60_000 },
  );
  return transactionOcrResponseSchema.parse(response);
}
