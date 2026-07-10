import { Prisma } from "@/generated/prisma/client/client";
import {
  ONBOARDING_CHECKLIST_IDS,
  ONBOARDING_SELECTED_GOALS,
  ONBOARDING_TOUR_VERSION,
  type OnboardingChecklistId,
  type OnboardingSelectedGoal,
} from "@/lib/onboarding/constants";
import type {
  OnboardingChecklistStateInput,
  UpsertOnboardingStateInput,
} from "@/lib/onboarding/schemas";

export interface OnboardingChecklistItem {
  completed: boolean;
  skipped: boolean;
  completedAt: string | null;
  skippedAt: string | null;
}

export type OnboardingChecklistState = Record<
  OnboardingChecklistId,
  OnboardingChecklistItem
>;

export interface PublicOnboardingState {
  id: string | null;
  userId: string;
  selectedGoal: OnboardingSelectedGoal | null;
  hasSeenWelcome: boolean;
  hasCompletedMainTour: boolean;
  hasSkippedOnboarding: boolean;
  checklistState: OnboardingChecklistState;
  lastTourStep: number | null;
  tourVersion: string;
  completedAt: string | null;
  skippedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  currentTourVersion: string;
  isCurrentTourVersion: boolean;
}

export interface OnboardingStateRow {
  id: string;
  userId: string;
  selectedGoal: string | null;
  hasSeenWelcome: boolean;
  hasCompletedMainTour: boolean;
  hasSkippedOnboarding: boolean;
  checklistState: Prisma.JsonValue | null;
  lastTourStep: number | null;
  tourVersion: string;
  completedAt: Date | null;
  skippedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTimestamp(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeSelectedGoal(value: string | null): OnboardingSelectedGoal | null {
  return ONBOARDING_SELECTED_GOALS.includes(value as OnboardingSelectedGoal)
    ? (value as OnboardingSelectedGoal)
    : null;
}

export function createDefaultChecklistState(): OnboardingChecklistState {
  return ONBOARDING_CHECKLIST_IDS.reduce((state, id) => {
    state[id] = {
      completed: false,
      skipped: false,
      completedAt: null,
      skippedAt: null,
    };

    return state;
  }, {} as OnboardingChecklistState);
}

export function normalizeChecklistState(
  value: unknown
): OnboardingChecklistState {
  const defaults = createDefaultChecklistState();

  if (!isRecord(value)) {
    return defaults;
  }

  for (const id of ONBOARDING_CHECKLIST_IDS) {
    const item = value[id];
    if (!isRecord(item)) {
      continue;
    }

    defaults[id] = {
      completed: item.completed === true,
      skipped: item.skipped === true,
      completedAt: normalizeTimestamp(item.completedAt),
      skippedAt: normalizeTimestamp(item.skippedAt),
    };
  }

  return defaults;
}

export function checklistStateToJson(
  value: OnboardingChecklistStateInput | OnboardingChecklistState | null
): Prisma.InputJsonValue {
  return normalizeChecklistState(value) as unknown as Prisma.InputJsonValue;
}

export function buildDefaultOnboardingState(
  userId: string
): PublicOnboardingState {
  return {
    id: null,
    userId,
    selectedGoal: null,
    hasSeenWelcome: false,
    hasCompletedMainTour: false,
    hasSkippedOnboarding: false,
    checklistState: createDefaultChecklistState(),
    lastTourStep: null,
    tourVersion: ONBOARDING_TOUR_VERSION,
    completedAt: null,
    skippedAt: null,
    createdAt: null,
    updatedAt: null,
    currentTourVersion: ONBOARDING_TOUR_VERSION,
    isCurrentTourVersion: true,
  };
}

export function normalizeOnboardingState(
  userId: string,
  row: OnboardingStateRow | null
): PublicOnboardingState {
  if (!row) {
    return buildDefaultOnboardingState(userId);
  }

  const tourVersion = row.tourVersion || ONBOARDING_TOUR_VERSION;

  return {
    id: row.id,
    userId: row.userId,
    selectedGoal: normalizeSelectedGoal(row.selectedGoal),
    hasSeenWelcome: row.hasSeenWelcome,
    hasCompletedMainTour: row.hasCompletedMainTour,
    hasSkippedOnboarding: row.hasSkippedOnboarding,
    checklistState: normalizeChecklistState(row.checklistState),
    lastTourStep: row.lastTourStep,
    tourVersion,
    completedAt: row.completedAt?.toISOString() ?? null,
    skippedAt: row.skippedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    currentTourVersion: ONBOARDING_TOUR_VERSION,
    isCurrentTourVersion: tourVersion === ONBOARDING_TOUR_VERSION,
  };
}

export function parseOnboardingTimestamp(
  value: UpsertOnboardingStateInput["completedAt"] | undefined
): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
}
