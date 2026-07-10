"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client/client";
import prisma from "@/lib/db";
import {
  ONBOARDING_CHECKLIST_ITEMS,
  ONBOARDING_TOUR_VERSION,
  type OnboardingChecklistId,
} from "@/lib/onboarding/constants";
import {
  markWelcomeSeenInputSchema,
  updateChecklistStateSchema,
  upsertOnboardingStateSchema,
  type MarkWelcomeSeenInput,
  type UpdateChecklistStateInput,
  type UpsertOnboardingStateInput,
} from "@/lib/onboarding/schemas";
import {
  checklistStateToJson,
  createDefaultChecklistState,
  normalizeChecklistState,
  normalizeOnboardingState,
  parseOnboardingTimestamp,
  type OnboardingStateRow,
} from "@/lib/onboarding/state";

export type OnboardingChecklistStatus = "complete" | "skipped" | "incomplete";
export type OnboardingChecklistCompletionSource = "auto" | "manual" | null;

export interface OnboardingProgressItem {
  id: OnboardingChecklistId;
  title: string;
  description: string;
  href: string;
  alternateHref?: string;
  ctaLabel: "Start" | "Continue" | "Review";
  status: OnboardingChecklistStatus;
  completionSource: OnboardingChecklistCompletionSource;
  canManuallyComplete: boolean;
  canSkip: boolean;
}

export interface OnboardingProgress {
  items: OnboardingProgressItem[];
  completedCount: number;
  totalCount: number;
  isComplete: boolean;
  shouldShowChecklist: boolean;
}

const onboardingStateSelect = {
  id: true,
  userId: true,
  selectedGoal: true,
  hasSeenWelcome: true,
  hasCompletedMainTour: true,
  hasSkippedOnboarding: true,
  checklistState: true,
  lastTourStep: true,
  tourVersion: true,
  completedAt: true,
  skippedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserOnboardingStateSelect;

async function requireUserId(): Promise<{ userId: string } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  return { userId: session.user.id };
}

function revalidateOnboardingPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
}

async function getOnboardingRow(
  userId: string
): Promise<OnboardingStateRow | null> {
  return prisma.userOnboardingState.findUnique({
    where: { userId },
    select: onboardingStateSelect,
  });
}

function buildCreateData(
  userId: string,
  input: UpsertOnboardingStateInput = {}
): Prisma.UserOnboardingStateCreateInput {
  return {
    user: {
      connect: { id: userId },
    },
    selectedGoal: input.selectedGoal ?? null,
    hasSeenWelcome: input.hasSeenWelcome ?? false,
    hasCompletedMainTour: input.hasCompletedMainTour ?? false,
    hasSkippedOnboarding: input.hasSkippedOnboarding ?? false,
    checklistState: checklistStateToJson(input.checklistState ?? null),
    lastTourStep: input.lastTourStep ?? null,
    tourVersion: input.tourVersion ?? ONBOARDING_TOUR_VERSION,
    completedAt: parseOnboardingTimestamp(input.completedAt) ?? null,
    skippedAt: parseOnboardingTimestamp(input.skippedAt) ?? null,
  };
}

function buildUpdateData(
  input: UpsertOnboardingStateInput
): Prisma.UserOnboardingStateUpdateInput {
  const data: Prisma.UserOnboardingStateUpdateInput = {};

  if ("selectedGoal" in input) {
    data.selectedGoal = input.selectedGoal;
  }

  if ("hasSeenWelcome" in input) {
    data.hasSeenWelcome = input.hasSeenWelcome;
  }

  if ("hasCompletedMainTour" in input) {
    data.hasCompletedMainTour = input.hasCompletedMainTour;
  }

  if ("hasSkippedOnboarding" in input) {
    data.hasSkippedOnboarding = input.hasSkippedOnboarding;
  }

  if ("checklistState" in input) {
    data.checklistState = checklistStateToJson(input.checklistState ?? null);
  }

  if ("lastTourStep" in input) {
    data.lastTourStep = input.lastTourStep;
  }

  if ("tourVersion" in input) {
    data.tourVersion = input.tourVersion;
  }

  if ("completedAt" in input) {
    data.completedAt = parseOnboardingTimestamp(input.completedAt);
  }

  if ("skippedAt" in input) {
    data.skippedAt = parseOnboardingTimestamp(input.skippedAt);
  }

  return data;
}

export async function getOnboardingState() {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error };
    }

    const row = await getOnboardingRow(authResult.userId);
    return {
      success: true,
      data: normalizeOnboardingState(authResult.userId, row),
    };
  } catch (error) {
    console.error("Get onboarding state error:", error);
    return { success: false, error: "Failed to fetch onboarding state" };
  }
}

function isAutoComplete(
  id: OnboardingChecklistId,
  counts: {
    accountCount: number;
    transactionCount: number;
    budgetCount: number;
    recurringCount: number;
    subscriptionCount: number;
  }
) {
  switch (id) {
    case "create_first_account":
      return counts.accountCount > 0;
    case "add_first_transaction":
      return counts.transactionCount > 0;
    case "create_first_budget":
      return counts.budgetCount > 0;
    case "add_recurring_or_subscription":
      return counts.recurringCount > 0 || counts.subscriptionCount > 0;
    default:
      return false;
  }
}

export async function getOnboardingProgress() {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error };
    }

    const [
      row,
      accountCount,
      transactionCount,
      budgetCount,
      recurringCount,
      subscriptionCount,
    ] = await Promise.all([
      getOnboardingRow(authResult.userId),
      prisma.financialAccount.count({ where: { userId: authResult.userId } }),
      prisma.transaction.count({ where: { userId: authResult.userId } }),
      prisma.budget.count({ where: { userId: authResult.userId } }),
      prisma.recurringRule.count({ where: { userId: authResult.userId } }),
      prisma.subscription.count({ where: { userId: authResult.userId } }),
    ]);

    const checklistState = normalizeChecklistState(row?.checklistState ?? null);
    const counts = {
      accountCount,
      transactionCount,
      budgetCount,
      recurringCount,
      subscriptionCount,
    };
    const baseItems = ONBOARDING_CHECKLIST_ITEMS.map((item) => {
      const persisted = checklistState[item.id];
      const autoCompleted =
        item.mode === "auto" ? isAutoComplete(item.id, counts) : false;
      const status: OnboardingChecklistStatus = autoCompleted || persisted.completed
        ? "complete"
        : persisted.skipped
          ? "skipped"
          : "incomplete";
      const completionSource: OnboardingChecklistCompletionSource = autoCompleted
        ? "auto"
        : persisted.completed
          ? "manual"
          : null;

      return {
        id: item.id,
        title: item.title,
        description: item.description,
        href: item.href,
        alternateHref: item.alternateHref,
        status,
        completionSource,
        canManuallyComplete: item.mode === "manual" && status === "incomplete",
        canSkip: item.mode === "manual" && status === "incomplete",
      };
    });
    const completedCount = baseItems.filter((item) => item.status === "complete").length;
    const totalCount = baseItems.length;
    const isComplete = baseItems.every((item) => item.status !== "incomplete");
    const items: OnboardingProgressItem[] = baseItems.map((item) => ({
      ...item,
      ctaLabel:
        item.status !== "incomplete"
          ? "Review"
          : completedCount > 0
            ? "Continue"
            : "Start",
    }));

    return {
      success: true,
      data: {
        items,
        completedCount,
        totalCount,
        isComplete,
        shouldShowChecklist: !isComplete && row?.hasSkippedOnboarding !== true,
      } satisfies OnboardingProgress,
    };
  } catch (error) {
    console.error("Get onboarding progress error:", error);
    return { success: false, error: "Failed to fetch onboarding progress" };
  }
}

export async function upsertOnboardingState(input: UpsertOnboardingStateInput) {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error };
    }

    const validated = upsertOnboardingStateSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message };
    }

    const row = await prisma.userOnboardingState.upsert({
      where: { userId: authResult.userId },
      create: buildCreateData(authResult.userId, validated.data),
      update: buildUpdateData(validated.data),
      select: onboardingStateSelect,
    });

    revalidateOnboardingPaths();
    return {
      success: true,
      data: normalizeOnboardingState(authResult.userId, row),
    };
  } catch (error) {
    console.error("Upsert onboarding state error:", error);
    return { success: false, error: "Failed to update onboarding state" };
  }
}

export async function markWelcomeSeen(input?: MarkWelcomeSeenInput) {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error };
    }

    const validated = markWelcomeSeenInputSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message };
    }

    const data = validated.data ?? {};
    const updateData: Prisma.UserOnboardingStateUpdateInput = {
      hasSeenWelcome: true,
      tourVersion: ONBOARDING_TOUR_VERSION,
    };

    if ("selectedGoal" in data) {
      updateData.selectedGoal = data.selectedGoal;
    }

    if ("lastTourStep" in data) {
      updateData.lastTourStep = data.lastTourStep;
    }

    const createData: UpsertOnboardingStateInput = {
      hasSeenWelcome: true,
      tourVersion: ONBOARDING_TOUR_VERSION,
    };

    if ("selectedGoal" in data) {
      createData.selectedGoal = data.selectedGoal;
    }

    if ("lastTourStep" in data) {
      createData.lastTourStep = data.lastTourStep;
    }

    const row = await prisma.userOnboardingState.upsert({
      where: { userId: authResult.userId },
      create: buildCreateData(authResult.userId, createData),
      update: updateData,
      select: onboardingStateSelect,
    });

    revalidateOnboardingPaths();
    return {
      success: true,
      data: normalizeOnboardingState(authResult.userId, row),
    };
  } catch (error) {
    console.error("Mark welcome seen error:", error);
    return { success: false, error: "Failed to update onboarding state" };
  }
}

export async function skipOnboarding() {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error };
    }

    const now = new Date();
    const updateData: Prisma.UserOnboardingStateUpdateInput = {
      hasSkippedOnboarding: true,
      skippedAt: now,
      tourVersion: ONBOARDING_TOUR_VERSION,
    };
    const createData: UpsertOnboardingStateInput = {
      hasSkippedOnboarding: true,
      skippedAt: now,
      tourVersion: ONBOARDING_TOUR_VERSION,
    };

    const row = await prisma.userOnboardingState.upsert({
      where: { userId: authResult.userId },
      create: buildCreateData(authResult.userId, createData),
      update: updateData,
      select: onboardingStateSelect,
    });

    revalidateOnboardingPaths();
    return {
      success: true,
      data: normalizeOnboardingState(authResult.userId, row),
    };
  } catch (error) {
    console.error("Skip onboarding error:", error);
    return { success: false, error: "Failed to skip onboarding" };
  }
}

export async function completeMainTour() {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error };
    }

    const now = new Date();
    const updateData: Prisma.UserOnboardingStateUpdateInput = {
      hasCompletedMainTour: true,
      completedAt: now,
      lastTourStep: null,
      tourVersion: ONBOARDING_TOUR_VERSION,
    };
    const createData: UpsertOnboardingStateInput = {
      hasCompletedMainTour: true,
      completedAt: now,
      lastTourStep: null,
      tourVersion: ONBOARDING_TOUR_VERSION,
    };

    const row = await prisma.userOnboardingState.upsert({
      where: { userId: authResult.userId },
      create: buildCreateData(authResult.userId, createData),
      update: updateData,
      select: onboardingStateSelect,
    });

    revalidateOnboardingPaths();
    return {
      success: true,
      data: normalizeOnboardingState(authResult.userId, row),
    };
  } catch (error) {
    console.error("Complete main tour error:", error);
    return { success: false, error: "Failed to complete onboarding tour" };
  }
}

export async function resetOnboarding() {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error };
    }

    const resetData: Prisma.UserOnboardingStateUpdateInput = {
      selectedGoal: null,
      hasSeenWelcome: false,
      hasCompletedMainTour: false,
      hasSkippedOnboarding: false,
      checklistState: checklistStateToJson(createDefaultChecklistState()),
      lastTourStep: null,
      tourVersion: ONBOARDING_TOUR_VERSION,
      completedAt: null,
      skippedAt: null,
    };

    const row = await prisma.userOnboardingState.upsert({
      where: { userId: authResult.userId },
      create: buildCreateData(authResult.userId),
      update: resetData,
      select: onboardingStateSelect,
    });

    revalidateOnboardingPaths();
    return {
      success: true,
      data: normalizeOnboardingState(authResult.userId, row),
    };
  } catch (error) {
    console.error("Reset onboarding error:", error);
    return { success: false, error: "Failed to reset onboarding" };
  }
}

export async function restartWelcome() {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error };
    }

    const updateData: Prisma.UserOnboardingStateUpdateInput = {
      selectedGoal: null,
      hasSeenWelcome: false,
      hasSkippedOnboarding: false,
      skippedAt: null,
      lastTourStep: null,
      tourVersion: ONBOARDING_TOUR_VERSION,
    };
    const createData: UpsertOnboardingStateInput = {
      selectedGoal: null,
      hasSeenWelcome: false,
      hasSkippedOnboarding: false,
      skippedAt: null,
      lastTourStep: null,
      tourVersion: ONBOARDING_TOUR_VERSION,
    };

    const row = await prisma.userOnboardingState.upsert({
      where: { userId: authResult.userId },
      create: buildCreateData(authResult.userId, createData),
      update: updateData,
      select: onboardingStateSelect,
    });

    revalidateOnboardingPaths();
    return {
      success: true,
      data: normalizeOnboardingState(authResult.userId, row),
    };
  } catch (error) {
    console.error("Restart welcome error:", error);
    return { success: false, error: "Failed to restart welcome flow" };
  }
}

export async function restartDashboardTour() {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error };
    }

    const updateData: Prisma.UserOnboardingStateUpdateInput = {
      hasCompletedMainTour: false,
      hasSkippedOnboarding: false,
      completedAt: null,
      skippedAt: null,
      lastTourStep: 0,
      tourVersion: ONBOARDING_TOUR_VERSION,
    };
    const createData: UpsertOnboardingStateInput = {
      hasCompletedMainTour: false,
      hasSkippedOnboarding: false,
      completedAt: null,
      skippedAt: null,
      lastTourStep: 0,
      tourVersion: ONBOARDING_TOUR_VERSION,
    };

    const row = await prisma.userOnboardingState.upsert({
      where: { userId: authResult.userId },
      create: buildCreateData(authResult.userId, createData),
      update: updateData,
      select: onboardingStateSelect,
    });

    revalidateOnboardingPaths();
    return {
      success: true,
      data: normalizeOnboardingState(authResult.userId, row),
    };
  } catch (error) {
    console.error("Restart dashboard tour error:", error);
    return { success: false, error: "Failed to restart dashboard tour" };
  }
}

export async function showChecklistAgain() {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error };
    }

    const checklistState = createDefaultChecklistState();
    const updateData: Prisma.UserOnboardingStateUpdateInput = {
      checklistState: checklistStateToJson(checklistState),
      hasSkippedOnboarding: false,
      skippedAt: null,
      tourVersion: ONBOARDING_TOUR_VERSION,
    };
    const createData: UpsertOnboardingStateInput = {
      checklistState,
      hasSkippedOnboarding: false,
      skippedAt: null,
      tourVersion: ONBOARDING_TOUR_VERSION,
    };

    const row = await prisma.userOnboardingState.upsert({
      where: { userId: authResult.userId },
      create: buildCreateData(authResult.userId, createData),
      update: updateData,
      select: onboardingStateSelect,
    });

    revalidateOnboardingPaths();
    return {
      success: true,
      data: normalizeOnboardingState(authResult.userId, row),
    };
  } catch (error) {
    console.error("Show checklist again error:", error);
    return { success: false, error: "Failed to show checklist again" };
  }
}

export async function updateChecklistState(input: UpdateChecklistStateInput) {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error };
    }

    const validated = updateChecklistStateSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message };
    }

    const existing = await getOnboardingRow(authResult.userId);
    const nextChecklistState = normalizeChecklistState(
      existing?.checklistState ?? null
    );
    const patchChecklistState = normalizeChecklistState(
      validated.data.checklistState
    );

    for (const key of Object.keys(validated.data.checklistState)) {
      const checklistId = key as keyof typeof nextChecklistState;
      nextChecklistState[checklistId] = patchChecklistState[checklistId];
    }

    const updateData: Prisma.UserOnboardingStateUpdateInput = {
      checklistState: checklistStateToJson(nextChecklistState),
      tourVersion: ONBOARDING_TOUR_VERSION,
    };
    const createData: UpsertOnboardingStateInput = {
      checklistState: nextChecklistState,
      tourVersion: ONBOARDING_TOUR_VERSION,
    };

    const row = await prisma.userOnboardingState.upsert({
      where: { userId: authResult.userId },
      create: buildCreateData(authResult.userId, createData),
      update: updateData,
      select: onboardingStateSelect,
    });

    revalidateOnboardingPaths();
    return {
      success: true,
      data: normalizeOnboardingState(authResult.userId, row),
    };
  } catch (error) {
    console.error("Update checklist state error:", error);
    return { success: false, error: "Failed to update onboarding checklist" };
  }
}
