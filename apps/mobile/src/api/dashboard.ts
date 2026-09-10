import { mobileDashboardResponseSchema } from "@finhealth/contracts";

import { apiJson } from "@/api/client";

export async function getDashboard() {
  const response = await apiJson<unknown>("/api/mobile/v1/dashboard", {
    method: "GET",
  });
  return mobileDashboardResponseSchema.parse(response);
}
