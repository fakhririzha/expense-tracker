"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import {
  getNotificationSettingsForUser,
  removePushSubscriptionForUser,
  sendTestNotificationToUser,
  syncPushSubscriptionForUser,
  updateNotificationPreferencesForUser,
} from "@/lib/notification-service";

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url("Invalid push subscription endpoint"),
  expirationTime: z.number().int().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1, "Missing browser push key"),
    auth: z.string().min(1, "Missing browser auth key"),
  }),
  userAgent: z.string().trim().nullable().optional(),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url("Invalid push subscription endpoint"),
});

const notificationPreferencesSchema = z.object({
  pushEnabled: z.boolean().optional(),
  subscriptionRenewalEnabled: z.boolean().optional(),
  recurringTransactionEnabled: z.boolean().optional(),
  budgetThresholdEnabled: z.boolean().optional(),
  lowCashForecastEnabled: z.boolean().optional(),
  monthlySnapshotEnabled: z.boolean().optional(),
  goalProgressEnabled: z.boolean().optional(),
  importExportCompletionEnabled: z.boolean().optional(),
  subscriptionReminderLeadDays: z.number().int().min(0).max(30).optional(),
  recurringReminderLeadDays: z.number().int().min(0).max(30).optional(),
  budgetThresholdPercent: z.number().int().min(1).max(100).optional(),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
export type NotificationPreferencesInput = z.infer<
  typeof notificationPreferencesSchema
>;

function revalidateNotificationPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
}

async function requireUserId(): Promise<{ userId: string } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  return { userId: session.user.id };
}

export async function getNotificationSettings() {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error };
    }

    const data = await getNotificationSettingsForUser(authResult.userId);
    return { success: true, data };
  } catch (error) {
    console.error("Get notification settings error:", error);
    return { success: false, error: "Failed to fetch notification settings" };
  }
}

export async function subscribeToPush(input: PushSubscriptionInput) {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error };
    }

    const validated = pushSubscriptionSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message };
    }

    const data = await syncPushSubscriptionForUser(
      authResult.userId,
      validated.data
    );

    revalidateNotificationPaths();
    return { success: true, data };
  } catch (error) {
    console.error("Subscribe to push error:", error);
    return { success: false, error: "Failed to enable push notifications" };
  }
}

export async function unsubscribeFromPush(input: { endpoint: string }) {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error };
    }

    const validated = unsubscribeSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message };
    }

    const data = await removePushSubscriptionForUser(
      authResult.userId,
      validated.data.endpoint
    );

    revalidateNotificationPaths();
    return { success: true, data };
  } catch (error) {
    console.error("Unsubscribe from push error:", error);
    return { success: false, error: "Failed to disable push notifications" };
  }
}

export async function updateNotificationPreferences(
  input: NotificationPreferencesInput
) {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error };
    }

    const validated = notificationPreferencesSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message };
    }

    const data = await updateNotificationPreferencesForUser(
      authResult.userId,
      validated.data
    );

    revalidateNotificationPaths();
    return { success: true, data };
  } catch (error) {
    console.error("Update notification preferences error:", error);
    return { success: false, error: "Failed to update notification preferences" };
  }
}

export async function sendTestNotification() {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error };
    }

    const result = await sendTestNotificationToUser(authResult.userId);
    if (!result.success) {
      return {
        success: false,
        error:
          result.skippedReason === "no_active_subscriptions"
            ? "No active browser subscriptions found"
            : "Failed to send test notification",
      };
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("Send test notification error:", error);
    return { success: false, error: "Failed to send test notification" };
  }
}
