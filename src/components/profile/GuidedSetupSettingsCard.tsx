"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, ClipboardList, Loader2, Play, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  useOnboardingProgress,
  useOnboardingState,
  useRestartDashboardTour,
  useRestartWelcome,
  useShowChecklistAgain,
} from "@/hooks/useOnboardingQueries";
import { ONBOARDING_TOUR_VERSION } from "@/lib/onboarding/constants";

function formatDate(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function StatusRow({
  label,
  value,
  detail,
  variant = "outline",
}: {
  label: string;
  value: string;
  detail?: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
}) {
  return (
    <div className="flex flex-col gap-2 border-b-2 border-border pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-black uppercase tracking-widest">{label}</p>
        {detail ? (
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {detail}
          </p>
        ) : null}
      </div>
      <Badge variant={variant}>{value}</Badge>
    </div>
  );
}

export function GuidedSetupSettingsCard() {
  const router = useRouter();
  const onboardingStateQuery = useOnboardingState();
  const onboardingProgressQuery = useOnboardingProgress();
  const restartWelcomeMutation = useRestartWelcome();
  const restartDashboardTourMutation = useRestartDashboardTour();
  const showChecklistAgainMutation = useShowChecklistAgain();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onboardingState = onboardingStateQuery.data;
  const progress = onboardingProgressQuery.data;
  const isLoading =
    onboardingStateQuery.isLoading || onboardingProgressQuery.isLoading;
  const isBusy =
    restartWelcomeMutation.isPending ||
    restartDashboardTourMutation.isPending ||
    showChecklistAgainMutation.isPending;
  const checklistProgressValue =
    progress && progress.totalCount > 0
      ? (progress.completedCount / progress.totalCount) * 100
      : 0;

  async function runAction(
    action: () => Promise<unknown>,
    successMessage: string,
    afterSuccess?: () => void
  ) {
    setError(null);
    setMessage(null);

    try {
      await action();
      setMessage(successMessage);
      afterSuccess?.();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Failed to update Guided Setup."
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex h-12 w-12 items-center justify-center neo-border bg-secondary">
          <ClipboardList className="h-6 w-6" />
        </div>
        <CardTitle className="text-xl font-black uppercase font-heading">
          Guided Setup
        </CardTitle>
        <CardDescription>
          Review onboarding progress and restart individual setup flows when you
          want to revisit them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Guided Setup status...
          </div>
        ) : onboardingState && progress ? (
          <>
            <div className="space-y-3">
              <StatusRow
                label="Welcome"
                value={onboardingState.hasSeenWelcome ? "Seen" : "Not seen"}
                variant={onboardingState.hasSeenWelcome ? "default" : "outline"}
                detail={
                  onboardingState.selectedGoal
                    ? `Goal: ${onboardingState.selectedGoal.replaceAll("_", " ")}`
                    : "No goal selected yet."
                }
              />
              <StatusRow
                label="Checklist"
                value={
                  progress.isComplete
                    ? "Resolved"
                    : `${progress.completedCount} of ${progress.totalCount}`
                }
                variant={progress.isComplete ? "default" : "secondary"}
                detail="Skipped checklist items are resolved, but the progress count only includes completed items."
              />
              <Progress value={checklistProgressValue} />
              <StatusRow
                label="Dashboard tour"
                value={
                  onboardingState.hasCompletedMainTour
                    ? "Completed"
                    : onboardingState.lastTourStep === 0
                      ? "Ready to start"
                      : "Not completed"
                }
                variant={
                  onboardingState.hasCompletedMainTour ? "default" : "outline"
                }
                detail={
                  onboardingState.completedAt
                    ? `Completed ${formatDate(onboardingState.completedAt)}`
                    : "Desktop only. On smaller screens, use the checklist instead."
                }
              />
              <StatusRow
                label="Skipped"
                value={onboardingState.hasSkippedOnboarding ? "Skipped" : "Active"}
                variant={
                  onboardingState.hasSkippedOnboarding ? "secondary" : "outline"
                }
                detail={
                  onboardingState.skippedAt
                    ? `Skipped ${formatDate(onboardingState.skippedAt)}`
                    : "Profile controls clear skipped state when you restart a flow."
                }
              />
              <StatusRow
                label="Version"
                value={
                  onboardingState.isCurrentTourVersion ? "Current" : "Stale"
                }
                variant={
                  onboardingState.isCurrentTourVersion ? "default" : "secondary"
                }
                detail={`Stored: ${onboardingState.tourVersion || "none"} | Current: ${
                  onboardingState.currentTourVersion || ONBOARDING_TOUR_VERSION
                }`}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Button
                  type="button"
                  className="w-full"
                  variant="outline"
                  onClick={() =>
                    void runAction(
                      () => restartWelcomeMutation.mutateAsync(),
                      "Welcome flow restarted."
                    )
                  }
                  disabled={isBusy}
                >
                  <RotateCcw className="h-4 w-4" />
                  Restart welcome
                </Button>
                <p className="text-xs font-medium text-muted-foreground">
                  Reopens the welcome dialog and lets you choose a setup goal
                  again.
                </p>
              </div>
              <div className="space-y-2">
                <Button
                  type="button"
                  className="w-full"
                  onClick={() =>
                    void runAction(
                      () => restartDashboardTourMutation.mutateAsync(),
                      "Dashboard tour restarted.",
                      () => router.push("/dashboard")
                    )
                  }
                  disabled={isBusy}
                >
                  <Play className="h-4 w-4" />
                  Restart tour
                </Button>
                <p className="text-xs font-medium text-muted-foreground">
                  Sends you to the desktop dashboard tour. It is gracefully
                  disabled on small screens.
                </p>
              </div>
              <div className="space-y-2">
                <Button
                  type="button"
                  className="w-full"
                  variant="outline"
                  onClick={() =>
                    void runAction(
                      () => showChecklistAgainMutation.mutateAsync(),
                      "Checklist reset. Open the dashboard to review it."
                    )
                  }
                  disabled={isBusy}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Show checklist again
                </Button>
                <p className="text-xs font-medium text-muted-foreground">
                  Resets manual checklist progress. Items backed by existing data
                  may still auto-complete.
                </p>
              </div>
            </div>

            {message ? (
              <p className="neo-border bg-green-50 p-3 text-sm font-bold text-green-700">
                {message}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Guided Setup status is unavailable right now.
          </p>
        )}

        {error ? (
          <p className="neo-border bg-destructive/10 p-3 text-sm font-bold text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
