import {
  mobileAccountsResponseSchema,
  type MobileAccountsResponse,
} from "@finhealth/contracts";

import { apiJson } from "@/api/client";

export async function getAccounts(): Promise<MobileAccountsResponse> {
  const response = await apiJson<unknown>("/api/mobile/v1/accounts", { method: "GET" });
  return mobileAccountsResponseSchema.parse(response);
}
