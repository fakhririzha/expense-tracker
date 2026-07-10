import { z } from "zod";

import {
  ONBOARDING_CHECKLIST_IDS,
  ONBOARDING_SELECTED_GOALS,
  ONBOARDING_TOUR_VERSION,
} from "@/lib/onboarding/constants";

const nullableTimestampSchema = z
  .union([z.string().datetime(), z.date()])
  .nullable();

export const onboardingSelectedGoalSchema = z
  .enum(ONBOARDING_SELECTED_GOALS)
  .nullable();

export const onboardingChecklistItemSchema = z
  .object({
    completed: z.boolean().optional(),
    skipped: z.boolean().optional(),
    completedAt: nullableTimestampSchema.optional(),
    skippedAt: nullableTimestampSchema.optional(),
  })
  .strict();

export const onboardingChecklistStateSchema = z
  .object({
    create_first_account: onboardingChecklistItemSchema.optional(),
    review_categories: onboardingChecklistItemSchema.optional(),
    add_first_transaction: onboardingChecklistItemSchema.optional(),
    create_first_budget: onboardingChecklistItemSchema.optional(),
    add_recurring_or_subscription: onboardingChecklistItemSchema.optional(),
    review_reports_or_insights: onboardingChecklistItemSchema.optional(),
  })
  .strict();

export const onboardingLastTourStepSchema = z.number().int().min(0).nullable();

export const upsertOnboardingStateSchema = z
  .object({
    selectedGoal: onboardingSelectedGoalSchema.optional(),
    hasSeenWelcome: z.boolean().optional(),
    hasCompletedMainTour: z.boolean().optional(),
    hasSkippedOnboarding: z.boolean().optional(),
    checklistState: onboardingChecklistStateSchema.nullable().optional(),
    lastTourStep: onboardingLastTourStepSchema.optional(),
    tourVersion: z.literal(ONBOARDING_TOUR_VERSION).optional(),
    completedAt: nullableTimestampSchema.optional(),
    skippedAt: nullableTimestampSchema.optional(),
  })
  .strict();

export const markWelcomeSeenInputSchema = z
  .object({
    selectedGoal: onboardingSelectedGoalSchema.optional(),
    lastTourStep: onboardingLastTourStepSchema.optional(),
  })
  .strict()
  .optional();

export const updateChecklistStateSchema = z
  .object({
    checklistState: onboardingChecklistStateSchema,
  })
  .strict();

export type OnboardingChecklistItemInput = z.infer<
  typeof onboardingChecklistItemSchema
>;
export type OnboardingChecklistStateInput = z.infer<
  typeof onboardingChecklistStateSchema
>;
export type UpsertOnboardingStateInput = z.infer<
  typeof upsertOnboardingStateSchema
>;
export type MarkWelcomeSeenInput = z.infer<typeof markWelcomeSeenInputSchema>;
export type UpdateChecklistStateInput = z.infer<
  typeof updateChecklistStateSchema
>;

export const onboardingChecklistIdSet = new Set<string>(
  ONBOARDING_CHECKLIST_IDS
);
