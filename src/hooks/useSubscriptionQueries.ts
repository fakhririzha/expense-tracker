import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createRecurringRuleFromSubscription,
  createSubscription,
  deleteSubscription,
  getSubscriptionById,
  getSubscriptions,
  getSubscriptionSummary,
  linkSubscriptionToRecurringRule,
  unlinkSubscriptionFromRecurringRule,
  updateSubscription,
} from "@/actions/subscription-actions";
import { forecastKeys } from "@/hooks/useCashFlowForecast";
import { calendarKeys } from "@/hooks/useCalendarQueries";
import { recurringKeys } from "@/hooks/useRecurringQueries";
import { reportKeys } from "@/hooks/useReportQueries";
import { type SubscriptionStatusFilter } from "@/lib/subscription-constants";

export const subscriptionKeys = {
  all: ["subscriptions"] as const,
  lists: () => [...subscriptionKeys.all, "list"] as const,
  list: (filters?: { status?: SubscriptionStatusFilter }) =>
    [...subscriptionKeys.lists(), filters] as const,
  detail: (id: string) => [...subscriptionKeys.all, "detail", id] as const,
  summary: () => [...subscriptionKeys.all, "summary"] as const,
};

export function useSubscriptions(filters?: { status?: SubscriptionStatusFilter }) {
  return useQuery({
    queryKey: subscriptionKeys.list(filters),
    queryFn: async () => {
      const result = await getSubscriptions(filters);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
  });
}

export function useSubscription(id?: string) {
  return useQuery({
    queryKey: subscriptionKeys.detail(id ?? ""),
    queryFn: async () => {
      if (!id) {
        return null;
      }

      const result = await getSubscriptionById(id);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data!;
    },
    enabled: !!id,
  });
}

export function useSubscriptionSummary() {
  return useQuery({
    queryKey: subscriptionKeys.summary(),
    queryFn: async () => {
      const result = await getSubscriptionSummary();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data!;
    },
  });
}

function invalidateSubscriptionConsumers(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
  queryClient.invalidateQueries({ queryKey: recurringKeys.all });
  queryClient.invalidateQueries({ queryKey: calendarKeys.all });
  queryClient.invalidateQueries({ queryKey: reportKeys.all });
  queryClient.invalidateQueries({ queryKey: forecastKeys.all });
}

export function useCreateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Parameters<typeof createSubscription>[0]) => {
      const result = await createSubscription(data);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: () => {
      invalidateSubscriptionConsumers(queryClient);
    },
  });
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateSubscription>[1];
    }) => {
      const result = await updateSubscription(id, data);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: () => {
      invalidateSubscriptionConsumers(queryClient);
    },
  });
}

export function useDeleteSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteSubscription(id);
      if (!result.success) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      invalidateSubscriptionConsumers(queryClient);
    },
  });
}

export function useLinkSubscriptionToRecurringRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      subscriptionId,
      recurringRuleId,
    }: {
      subscriptionId: string;
      recurringRuleId: string;
    }) => {
      const result = await linkSubscriptionToRecurringRule(subscriptionId, recurringRuleId);
      if (!result.success) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      invalidateSubscriptionConsumers(queryClient);
    },
  });
}

export function useUnlinkSubscriptionFromRecurringRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      const result = await unlinkSubscriptionFromRecurringRule(subscriptionId);
      if (!result.success) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      invalidateSubscriptionConsumers(queryClient);
    },
  });
}

export function useCreateRecurringRuleFromSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      const result = await createRecurringRuleFromSubscription(subscriptionId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: () => {
      invalidateSubscriptionConsumers(queryClient);
    },
  });
}
