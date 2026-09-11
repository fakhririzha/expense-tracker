"use server";

import { auth } from "@/auth";
import { getExecutiveMetricsForUser } from "@/lib/executive-service";
import type { ExecutiveMetrics } from "@/lib/executive-types";

export async function getExecutiveMetrics(): Promise<{
  success: boolean;
  error?: string;
  data?: ExecutiveMetrics;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false as const, error: "Unauthorized" };
  }

  return getExecutiveMetricsForUser(session.user.id);
}
