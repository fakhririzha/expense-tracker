"use client";

import { useState } from "react";

import { WelcomeDialog } from "@/components/onboarding/WelcomeDialog";
import {
  useMarkWelcomeSeen,
  useOnboardingState,
  useSkipOnboarding,
} from "@/hooks/useOnboardingQueries";
import type { OnboardingSelectedGoal } from "@/lib/onboarding/constants";

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Failed to update Guided Setup. Please try again.";
}

export function OnboardingBootstrap() {
  const { data: onboardingState, isError } = useOnboardingState();
  const markWelcomeSeenMutation = useMarkWelcomeSeen();
  const skipOnboardingMutation = useSkipOnboarding();
  const [dismissedForSession, setDismissedForSession] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  if (isError || !onboardingState) {
    return null;
  }

  const shouldShowWelcome =
    !dismissedForSession &&
    !onboardingState.hasSeenWelcome &&
    !onboardingState.hasSkippedOnboarding;
  const isSubmitting =
    markWelcomeSeenMutation.isPending || skipOnboardingMutation.isPending;

  async function handleStartChecklist(selectedGoal: OnboardingSelectedGoal) {
    setMutationError(null);

    try {
      await markWelcomeSeenMutation.mutateAsync({ selectedGoal });
      setDismissedForSession(true);
    } catch (error) {
      setMutationError(getErrorMessage(error));
    }
  }

  async function handleStartTour(selectedGoal: OnboardingSelectedGoal) {
    setMutationError(null);

    try {
      await markWelcomeSeenMutation.mutateAsync({
        selectedGoal,
        lastTourStep: 0,
      });
      setDismissedForSession(true);
    } catch (error) {
      setMutationError(getErrorMessage(error));
    }
  }

  async function handleSkip() {
    setMutationError(null);

    try {
      await skipOnboardingMutation.mutateAsync();
      setDismissedForSession(true);
    } catch (error) {
      setMutationError(getErrorMessage(error));
    }
  }

  return (
    <WelcomeDialog
      open={shouldShowWelcome}
      isSubmitting={isSubmitting}
      error={mutationError}
      onStartChecklist={(selectedGoal) => void handleStartChecklist(selectedGoal)}
      onStartTour={(selectedGoal) => void handleStartTour(selectedGoal)}
      onSkip={() => void handleSkip()}
    />
  );
}
