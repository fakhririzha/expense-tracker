import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getNotificationSettings,
  sendTestNotification,
  subscribeToPush,
  unsubscribeFromPush,
  updateNotificationPreferences,
  type NotificationPreferencesInput,
  type PushSubscriptionInput,
} from "@/actions/notification-actions";

export const notificationKeys = {
  all: ["notifications"] as const,
  settings: () => [...notificationKeys.all, "settings"] as const,
};

function invalidateNotifications(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: notificationKeys.all });
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: notificationKeys.settings(),
    queryFn: async () => {
      const result = await getNotificationSettings();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data!;
    },
  });
}

export function useSubscribeToPush() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PushSubscriptionInput) => {
      const result = await subscribeToPush(input);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data!;
    },
    onSuccess: () => {
      invalidateNotifications(queryClient);
    },
  });
}

export function useUnsubscribeFromPush() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (endpoint: string) => {
      const result = await unsubscribeFromPush({ endpoint });
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data!;
    },
    onSuccess: () => {
      invalidateNotifications(queryClient);
    },
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NotificationPreferencesInput) => {
      const result = await updateNotificationPreferences(input);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data!;
    },
    onSuccess: () => {
      invalidateNotifications(queryClient);
    },
  });
}

export function useSendTestNotification() {
  return useMutation({
    mutationFn: async () => {
      const result = await sendTestNotification();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data!;
    },
  });
}
