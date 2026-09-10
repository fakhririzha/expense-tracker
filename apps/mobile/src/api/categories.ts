import {
  mobileCategoriesResponseSchema,
  type CategoryTransactionType,
  type MobileCategoriesResponse,
} from "@finhealth/contracts";

import { apiJson } from "@/api/client";

export async function getCategories(type?: CategoryTransactionType): Promise<MobileCategoriesResponse> {
  const query = type ? `?type=${encodeURIComponent(type)}` : "";
  const response = await apiJson<unknown>(`/api/mobile/v1/categories${query}`, {
    method: "GET",
  });
  return mobileCategoriesResponseSchema.parse(response);
}
