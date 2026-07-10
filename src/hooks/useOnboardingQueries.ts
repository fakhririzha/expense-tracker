import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  completeMainTour,
  getOnboardingProgress,
  getOnboardingState,
  markWelcomeSeen,
  restartDashboardTour,
  restartWelcome,
  showChecklistAgain,
  skipOnboarding,
  updateChecklistState,
  upsertOnboardingState,
} from "@/actions/onboarding-actions";
import type {
  MarkWelcomeSeenInput,
  UpdateChecklistStateInput,
  UpsertOnboardingStateInput,
} from "@/lib/onboarding/schemas";

export const onboardingKeys = {
  all: ["onboarding"] as const,
  state: () => [...onboardingKeys.all, "state"] as const,
  progress: () => [...onboardingKeys.all, "progress"] as const,
};

function invalidateOnboarding(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: onboardingKeys.all });
}

export function useOnboardingState() {
  return useQuery({
    queryKey: onboardingKeys.state(),
    queryFn: async () => {
      const result = await getOnboardingState();
      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data!;
    },
  });
}

export function useOnboardingProgress() {
  return useQuery({
    queryKey: onboardingKeys.progress(),
    queryFn: async () => {
      const result = await getOnboardingProgress();
      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data!;
    },
  });
}

export function useMarkWelcomeSeen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MarkWelcomeSeenInput) => {
      const result = await markWelcomeSeen(input);
      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data!;
    },
    onSuccess: () => {
      invalidateOnboarding(queryClient);
    },
  });
}

export function useSkipOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await skipOnboarding();
      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data!;
    },
    onSuccess: () => {
      invalidateOnboarding(queryClient);
    },
  });
}

export function useCompleteMainTour() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await completeMainTour();
      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data!;
    },
    onSuccess: () => {
      invalidateOnboarding(queryClient);
    },
  });
}

export function useUpsertOnboardingState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpsertOnboardingStateInput) => {
      const result = await upsertOnboardingState(input);
      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data!;
    },
    onSuccess: () => {
      invalidateOnboarding(queryClient);
    },
  });
}

export function useUpdateChecklistState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateChecklistStateInput) => {
      const result = await updateChecklistState(input);
      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data!;
    },
    onSuccess: () => {
      invalidateOnboarding(queryClient);
    },
  });
}

export function useRestartWelcome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await restartWelcome();
      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data!;
    },
    onSuccess: () => {
      invalidateOnboarding(queryClient);
    },
  });
}

export function useRestartDashboardTour() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await restartDashboardTour();
      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data!;
    },
    onSuccess: () => {
      invalidateOnboarding(queryClient);
    },
  });
}

export function useShowChecklistAgain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const result = await showChecklistAgain();
      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data!;
    },
    onSuccess: () => {
      invalidateOnboarding(queryClient);
    },
  });
}
