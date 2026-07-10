"use server";

import { auth } from "@/auth";
import { getWeeklyAiInsightsForUser } from "@/lib/weekly-ai-insight-service";

export async function getWeeklyAiInsights() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    return { success: true, data: await getWeeklyAiInsightsForUser(session.user.id) };
  } catch (error) {
    console.error("Get weekly AI insights error:", error);
    return { success: false, error: "Weekly AI insights are unavailable right now." };
  }
}
