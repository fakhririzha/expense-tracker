"use server";

import { isWithinInterval } from "date-fns";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { decryptAccountName } from "@/lib/account-crypto";
import {
  Prisma,
  SubscriptionBillingCycle,
  SubscriptionStatus,
  TransactionType,
  type RecurringInterval,
} from "@/generated/prisma/client/client";
import { isDepositoAccountType } from "@/lib/account-types";
import prisma from "@/lib/db";
import { getExchangeRate } from "@/lib/finance-service";
import {
  billingCycleToRecurringInterval,
  EDITABLE_SUBSCRIPTION_STATUSES,
  isRenewalEligibleSubscriptionStatus,
  isSpendActiveSubscriptionStatus,
  isTrialSubscriptionStatus,
  normalizeSubscriptionCurrency,
  resolveSubscriptionStatus,
  SUBSCRIPTION_STATUS_FILTERS,
  toMonthlyEquivalent,
  toYearlyEquivalent,
  TRIAL_ENDING_SOON_DAYS,
  type SubscriptionStatusFilter,
  UPCOMING_RENEWALS_DAYS,
} from "@/lib/subscription-utils";
import {
  decryptOptionalCompanion,
  decryptRequiredCompanion,
  encryptOptionalCompanion,
  encryptRequiredCompanion,
} from "@/lib/encrypted-companion-crypto";

const editableStatusSchema = z.enum(EDITABLE_SUBSCRIPTION_STATUSES);
const billingCycleSchema = z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]);
const listFilterSchema = z
  .object({
    status: z.enum(SUBSCRIPTION_STATUS_FILTERS).optional(),
  })
  .optional();

const subscriptionSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  provider: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().trim().min(3, "Currency is required").max(3),
  billingCycle: billingCycleSchema,
  nextBillingDate: z.date(),
  startDate: z.date().optional().nullable(),
  trialEndDate: z.date().optional().nullable(),
  cancellationDate: z.date().optional().nullable(),
  status: editableStatusSchema,
  categoryId: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
  cancellationUrl: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

const subscriptionUpdateSchema = subscriptionSchema.partial();

export type SubscriptionInput = z.infer<typeof subscriptionSchema>;
export type SubscriptionUpdateInput = z.infer<typeof subscriptionUpdateSchema>;

type SubscriptionWithRelations = Prisma.SubscriptionGetPayload<{
  include: {
    category: {
      select: {
        id: true;
        name: true;
        icon: true;
        color: true;
      };
    };
    account: {
      select: {
        id: true;
        nameEncrypted: true;
        currency: true;
        type: true;
      };
    };
    recurringRule: {
      select: {
        id: true;
        name: true;
        nameEncrypted: true;
        amount: true;
        currency: true;
        interval: true;
        nextDueDate: true;
        isActive: true;
        categoryId: true;
        accountId: true;
      };
    };
  };
}>;

export interface SubscriptionRecurringRuleSummary {
  id: string;
  name: string;
  amount: number;
  currency: string;
  interval: RecurringInterval;
  nextDueDate: Date;
  isActive: boolean;
  categoryId: string | null;
  accountId: string | null;
}

export interface SubscriptionListItem {
  id: string;
  name: string;
  provider: string | null;
  description: string | null;
  amount: number;
  currency: string;
  billingCycle: SubscriptionBillingCycle;
  nextBillingDate: Date;
  startDate: Date | null;
  trialEndDate: Date | null;
  cancellationDate: Date | null;
  status: SubscriptionStatus;
  effectiveStatus: SubscriptionStatus;
  categoryId: string | null;
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  accountId: string | null;
  account: {
    id: string;
    name: string;
    currency: string;
    type: string;
  } | null;
  recurringRuleId: string | null;
  recurringRule: SubscriptionRecurringRuleSummary | null;
  cancellationUrl: string | null;
  notes: string | null;
  monthlyEquivalent: number;
  yearlyEquivalent: number;
  recurringSyncStatus: "not_linked" | "in_sync" | "out_of_sync";
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionSummaryItem {
  id: string;
  name: string;
  provider: string | null;
  amount: number;
  currency: string;
  nextBillingDate: Date;
  trialEndDate: Date | null;
  effectiveStatus: SubscriptionStatus;
  monthlyEquivalent: number;
  yearlyEquivalent: number;
}

export interface SubscriptionSummary {
  displayCurrency: string;
  totalMonthlyCost: number;
  projectedYearlyCost: number;
  activeCount: number;
  trialEndingSoonCount: number;
  rateFallbackCount: number;
  statusCounts: Record<SubscriptionStatus, number>;
  upcomingRenewals: SubscriptionSummaryItem[];
  trialEndingSoon: SubscriptionSummaryItem[];
}

function normalizeOptionalText(value?: string | null): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function revalidateSubscriptionPaths(includeRelated: boolean = false): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/subscriptions");

  if (includeRelated) {
    revalidatePath("/dashboard/recurring");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/reports");
  }
}

function getManagedRecurringRuleState(status: SubscriptionStatus): boolean {
  return status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.TRIAL;
}

function validateSubscriptionLifecycle(data: {
  nextBillingDate?: Date | null;
  startDate?: Date | null;
  trialEndDate?: Date | null;
  cancellationDate?: Date | null;
  status?: SubscriptionStatus | z.infer<typeof editableStatusSchema>;
}): string | null {
  if (data.startDate && data.nextBillingDate && data.startDate > data.nextBillingDate) {
    return "Start date cannot be after the next billing date";
  }

  if (data.status === "TRIAL" && !data.trialEndDate) {
    return "Trial end date is required for trial subscriptions";
  }

  if (data.trialEndDate && data.nextBillingDate && data.trialEndDate > data.nextBillingDate) {
    return "Trial end date cannot be after the next billing date";
  }

  return null;
}

async function requireUserId(): Promise<{ userId: string } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  return { userId: session.user.id };
}

async function validateOwnedCategory(userId: string, categoryId?: string | null) {
  if (!categoryId) {
    return { success: true as const };
  }

  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
    select: { id: true },
  });

  if (!category) {
    return { success: false as const, error: "Category not found" };
  }

  return { success: true as const };
}

async function validateOwnedAccount(userId: string, accountId?: string | null) {
  if (!accountId) {
    return { success: true as const };
  }

  const account = await prisma.financialAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true, nameEncrypted: true, currency: true, type: true },
  });

  if (!account) {
    return { success: false as const, error: "Account not found" };
  }

  if (isDepositoAccountType(account.type)) {
    return {
      success: false as const,
      error: "Deposito accounts cannot be used for subscriptions.",
    };
  }

  return {
    success: true as const,
    account: {
      ...account,
      name: await decryptAccountName(userId, account.nameEncrypted),
    },
  };
}

async function getSubscriptionRecord(userId: string, id: string) {
  return prisma.subscription.findFirst({
    where: { id, userId },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          icon: true,
          color: true,
        },
      },
      account: {
        select: {
          id: true,
          nameEncrypted: true,
          currency: true,
          type: true,
        },
      },
      recurringRule: {
        select: {
          id: true,
          name: true,
          nameEncrypted: true,
          amount: true,
          currency: true,
          interval: true,
          nextDueDate: true,
          isActive: true,
          categoryId: true,
          accountId: true,
        },
      },
    },
  });
}

async function decryptSubscriptionText(
  userId: string,
  field: "subscription.name" | "subscription.provider" | "subscription.description" | "subscription.cancellationUrl" | "subscription.notes",
  encrypted: string | null,
  plaintext: string | null
): Promise<string | null> {
  return decryptOptionalCompanion(userId, field, encrypted, plaintext);
}

async function toSubscriptionListItem(
  userId: string,
  subscription: SubscriptionWithRelations
): Promise<SubscriptionListItem> {
  const [name, provider, description, cancellationUrl, notes, recurringRuleName] =
    await Promise.all([
      decryptRequiredCompanion(
        userId,
        "subscription.name",
        subscription.nameEncrypted,
        subscription.name
      ),
      decryptSubscriptionText(
        userId,
        "subscription.provider",
        subscription.providerEncrypted,
        subscription.provider
      ),
      decryptSubscriptionText(
        userId,
        "subscription.description",
        subscription.descriptionEncrypted,
        subscription.description
      ),
      decryptSubscriptionText(
        userId,
        "subscription.cancellationUrl",
        subscription.cancellationUrlEncrypted,
        subscription.cancellationUrl
      ),
      decryptSubscriptionText(
        userId,
        "subscription.notes",
        subscription.notesEncrypted,
        subscription.notes
      ),
      subscription.recurringRule
        ? decryptRequiredCompanion(
            userId,
            "recurringRule.name",
            subscription.recurringRule.nameEncrypted,
            subscription.recurringRule.name
          )
        : Promise.resolve(null),
    ]);
  const accountName = subscription.account
    ? await decryptAccountName(userId, subscription.account.nameEncrypted)
    : null;

  const effectiveStatus = resolveSubscriptionStatus(subscription);
  const monthlyEquivalent = toMonthlyEquivalent(
    subscription.amount,
    subscription.billingCycle
  );
  const yearlyEquivalent = toYearlyEquivalent(
    subscription.amount,
    subscription.billingCycle
  );

  const recurringRule = subscription.recurringRule
    ? {
      id: subscription.recurringRule.id,
        name: recurringRuleName ?? "Recurring rule",
        amount: subscription.recurringRule.amount,
        currency: subscription.recurringRule.currency,
        interval: subscription.recurringRule.interval,
        nextDueDate: subscription.recurringRule.nextDueDate,
        isActive: subscription.recurringRule.isActive,
        categoryId: subscription.recurringRule.categoryId,
        accountId: subscription.recurringRule.accountId,
      }
    : null;

  const recurringSyncStatus = !recurringRule
    ? "not_linked"
    : recurringRule.amount === subscription.amount &&
        recurringRule.currency === subscription.currency &&
        recurringRule.interval === billingCycleToRecurringInterval(subscription.billingCycle) &&
        recurringRule.nextDueDate.getTime() === subscription.nextBillingDate.getTime() &&
        recurringRule.categoryId === subscription.categoryId &&
        recurringRule.accountId === subscription.accountId &&
        recurringRule.isActive === getManagedRecurringRuleState(effectiveStatus)
      ? "in_sync"
      : "out_of_sync";

  return {
    id: subscription.id,
    name,
    provider,
    description,
    amount: subscription.amount,
    currency: subscription.currency,
    billingCycle: subscription.billingCycle,
    nextBillingDate: subscription.nextBillingDate,
    startDate: subscription.startDate,
    trialEndDate: subscription.trialEndDate,
    cancellationDate: subscription.cancellationDate,
    status: subscription.status,
    effectiveStatus,
    categoryId: subscription.categoryId,
    category: subscription.category,
    accountId: subscription.accountId,
    account: subscription.account
      ? {
          ...subscription.account,
          name: accountName ?? "Unknown account",
        }
      : null,
    recurringRuleId: subscription.recurringRuleId,
    recurringRule,
    cancellationUrl,
    notes,
    monthlyEquivalent,
    yearlyEquivalent,
    recurringSyncStatus,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}

function filterAndSortSubscriptions(
  subscriptions: SubscriptionListItem[],
  status?: SubscriptionStatusFilter
): SubscriptionListItem[] {
  const filtered =
    !status || status === "ALL"
      ? subscriptions
      : subscriptions.filter((subscription) => subscription.effectiveStatus === status);

  return [...filtered].sort((left, right) => {
    const leftStatus = left.effectiveStatus;
    const rightStatus = right.effectiveStatus;
    const leftIsUpcoming =
      leftStatus === SubscriptionStatus.ACTIVE || leftStatus === SubscriptionStatus.TRIAL;
    const rightIsUpcoming =
      rightStatus === SubscriptionStatus.ACTIVE || rightStatus === SubscriptionStatus.TRIAL;

    if (leftIsUpcoming && rightIsUpcoming) {
      return left.nextBillingDate.getTime() - right.nextBillingDate.getTime();
    }

    if (leftIsUpcoming !== rightIsUpcoming) {
      return leftIsUpcoming ? -1 : 1;
    }

    return right.updatedAt.getTime() - left.updatedAt.getTime();
  });
}

async function convertSubscriptionAmount(
  amount: number,
  currency: string,
  displayCurrency: string
): Promise<{ amount: number; usedFallback: boolean }> {
  if (currency === displayCurrency) {
    return { amount, usedFallback: false };
  }

  const rate = await getExchangeRate(currency, displayCurrency);
  if (!rate) {
    return { amount, usedFallback: true };
  }

  return { amount: amount * rate, usedFallback: false };
}

function normalizeMutationInput(data: SubscriptionInput | SubscriptionUpdateInput) {
  return {
    name: data.name?.trim(),
    provider: normalizeOptionalText(data.provider),
    description: normalizeOptionalText(data.description),
    amount: data.amount,
    currency: data.currency ? normalizeSubscriptionCurrency(data.currency) : undefined,
    billingCycle: data.billingCycle,
    nextBillingDate: data.nextBillingDate,
    startDate: data.startDate === undefined ? undefined : data.startDate ?? null,
    trialEndDate: data.trialEndDate === undefined ? undefined : data.trialEndDate ?? null,
    cancellationDate:
      data.cancellationDate === undefined ? undefined : data.cancellationDate ?? null,
    status: data.status,
    categoryId: normalizeOptionalText(data.categoryId),
    accountId: normalizeOptionalText(data.accountId),
    cancellationUrl: normalizeOptionalText(data.cancellationUrl),
    notes: normalizeOptionalText(data.notes),
  };
}

async function buildEncryptedSubscriptionFields(
  userId: string,
  data: ReturnType<typeof normalizeMutationInput>
) {
  const [nameEncrypted, providerEncrypted, descriptionEncrypted, cancellationUrlEncrypted, notesEncrypted] =
    await Promise.all([
      data.name
        ? encryptRequiredCompanion(userId, "subscription.name", data.name)
        : Promise.resolve(null),
      encryptOptionalCompanion(userId, "subscription.provider", data.provider),
      encryptOptionalCompanion(userId, "subscription.description", data.description),
      encryptOptionalCompanion(userId, "subscription.cancellationUrl", data.cancellationUrl),
      encryptOptionalCompanion(userId, "subscription.notes", data.notes),
    ]);

  return {
    nameEncrypted,
    providerEncrypted,
    descriptionEncrypted,
    cancellationUrlEncrypted,
    notesEncrypted,
  };
}

async function syncRecurringRuleWithSubscription(
  tx: Prisma.TransactionClient,
  userId: string,
  recurringRuleId: string,
  subscription: {
    name: string;
    description: string | null;
    amount: number;
    currency: string;
    billingCycle: SubscriptionBillingCycle;
    nextBillingDate: Date;
    categoryId: string | null;
    accountId: string | null;
    status: SubscriptionStatus;
  }
) {
  const recurringNameEncrypted = await encryptRequiredCompanion(
    userId,
    "recurringRule.name",
    subscription.name
  );
  const recurringDescriptionEncrypted = await encryptOptionalCompanion(
    userId,
    "recurringRule.description",
    subscription.description
  );

  await tx.recurringRule.update({
    where: { id: recurringRuleId },
    data: {
      name: null,
      nameEncrypted: recurringNameEncrypted,
      amount: subscription.amount,
      currency: subscription.currency,
      interval: billingCycleToRecurringInterval(subscription.billingCycle),
      nextDueDate: subscription.nextBillingDate,
      description: subscription.description ? null : null,
      descriptionEncrypted: recurringDescriptionEncrypted,
      categoryId: subscription.categoryId,
      accountId: subscription.accountId,
      isActive: getManagedRecurringRuleState(resolveSubscriptionStatus(subscription)),
    },
  });
}

export async function getSubscriptions(filters?: {
  status?: SubscriptionStatusFilter;
}) {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error, data: [] as SubscriptionListItem[] };
    }

    const validatedFilters = listFilterSchema.safeParse(filters);
    if (!validatedFilters.success) {
      return { success: false, error: validatedFilters.error.issues[0].message, data: [] as SubscriptionListItem[] };
    }

    const subscriptions = await prisma.subscription.findMany({
      where: { userId: authResult.userId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            icon: true,
            color: true,
          },
        },
        account: {
          select: {
            id: true,
            nameEncrypted: true,
            currency: true,
            type: true,
          },
        },
        recurringRule: {
          select: {
            id: true,
            name: true,
            nameEncrypted: true,
            amount: true,
            currency: true,
            interval: true,
            nextDueDate: true,
            isActive: true,
            categoryId: true,
            accountId: true,
          },
        },
      },
    });

    const items = await Promise.all(
      subscriptions.map((subscription) => toSubscriptionListItem(authResult.userId, subscription))
    );

    return {
      success: true,
      data: filterAndSortSubscriptions(items, validatedFilters.data?.status),
    };
  } catch (error) {
    console.error("Get subscriptions error:", error);
    return { success: false, error: "Failed to fetch subscriptions", data: [] as SubscriptionListItem[] };
  }
}

export async function getSubscriptionById(id: string) {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error };
    }

    const subscription = await getSubscriptionRecord(authResult.userId, id);
    if (!subscription) {
      return { success: false, error: "Subscription not found" };
    }

    const item = await toSubscriptionListItem(authResult.userId, subscription);
    return { success: true, data: item };
  } catch (error) {
    console.error("Get subscription by ID error:", error);
    return { success: false, error: "Failed to fetch subscription" };
  }
}

export async function getSubscriptionSummary(): Promise<{
  success: boolean;
  data?: SubscriptionSummary;
  error?: string;
}> {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error };
    }

    const [user, subscriptionsResult] = await Promise.all([
      prisma.user.findUnique({
        where: { id: authResult.userId },
        select: { mainCurrency: true },
      }),
      getSubscriptions(),
    ]);

    if (!user) {
      return { success: false, error: "User not found" };
    }

    if (!subscriptionsResult.success) {
      return { success: false, error: subscriptionsResult.error };
    }

    const displayCurrency = user.mainCurrency;
    const now = new Date();
    const upcomingWindowEnd = new Date(now);
    upcomingWindowEnd.setDate(upcomingWindowEnd.getDate() + UPCOMING_RENEWALS_DAYS);
    const trialWindowEnd = new Date(now);
    trialWindowEnd.setDate(trialWindowEnd.getDate() + TRIAL_ENDING_SOON_DAYS);

    const statusCounts: Record<SubscriptionStatus, number> = {
      ACTIVE: 0,
      TRIAL: 0,
      PAUSED: 0,
      CANCELLED: 0,
      EXPIRED: 0,
    };

    let totalMonthlyCost = 0;
    let projectedYearlyCost = 0;
    let rateFallbackCount = 0;

    const upcomingRenewals: SubscriptionSummaryItem[] = [];
    const trialEndingSoon: SubscriptionSummaryItem[] = [];

    for (const subscription of subscriptionsResult.data) {
      statusCounts[subscription.effectiveStatus] += 1;

      if (isSpendActiveSubscriptionStatus(subscription.effectiveStatus)) {
        const [monthly, yearly] = await Promise.all([
          convertSubscriptionAmount(
            subscription.monthlyEquivalent,
            subscription.currency,
            displayCurrency
          ),
          convertSubscriptionAmount(
            subscription.yearlyEquivalent,
            subscription.currency,
            displayCurrency
          ),
        ]);

        totalMonthlyCost += monthly.amount;
        projectedYearlyCost += yearly.amount;
        if (monthly.usedFallback || yearly.usedFallback) {
          rateFallbackCount += 1;
        }
      }

      const summaryItem: SubscriptionSummaryItem = {
        id: subscription.id,
        name: subscription.name,
        provider: subscription.provider,
        amount: subscription.amount,
        currency: subscription.currency,
        nextBillingDate: subscription.nextBillingDate,
        trialEndDate: subscription.trialEndDate,
        effectiveStatus: subscription.effectiveStatus,
        monthlyEquivalent: subscription.monthlyEquivalent,
        yearlyEquivalent: subscription.yearlyEquivalent,
      };

      if (
        isRenewalEligibleSubscriptionStatus(subscription.effectiveStatus) &&
        isWithinInterval(subscription.nextBillingDate, {
          start: now,
          end: upcomingWindowEnd,
        })
      ) {
        upcomingRenewals.push(summaryItem);
      }

      if (
        isTrialSubscriptionStatus(subscription.effectiveStatus) &&
        subscription.trialEndDate &&
        isWithinInterval(subscription.trialEndDate, {
          start: now,
          end: trialWindowEnd,
        })
      ) {
        trialEndingSoon.push(summaryItem);
      }
    }

    upcomingRenewals.sort(
      (left, right) => left.nextBillingDate.getTime() - right.nextBillingDate.getTime()
    );
    trialEndingSoon.sort((left, right) => {
      if (!left.trialEndDate || !right.trialEndDate) {
        return 0;
      }

      return left.trialEndDate.getTime() - right.trialEndDate.getTime();
    });

    return {
      success: true,
      data: {
        displayCurrency,
        totalMonthlyCost,
        projectedYearlyCost,
        activeCount: statusCounts.ACTIVE,
        trialEndingSoonCount: trialEndingSoon.length,
        rateFallbackCount,
        statusCounts,
        upcomingRenewals,
        trialEndingSoon,
      },
    };
  } catch (error) {
    console.error("Get subscription summary error:", error);
    return { success: false, error: "Failed to fetch subscription summary" };
  }
}

export async function createSubscription(data: SubscriptionInput) {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error };
    }

    const parsed = subscriptionSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const normalized = normalizeMutationInput(parsed.data);
    const dateError = validateSubscriptionLifecycle(normalized);
    if (dateError) {
      return { success: false, error: dateError };
    }

    if (normalized.cancellationUrl) {
      try {
        new URL(normalized.cancellationUrl);
      } catch {
        return { success: false, error: "Cancellation URL must be a valid URL" };
      }
    }

    const finalCancellationDate =
      normalized.status === "CANCELLED"
        ? normalized.cancellationDate ?? new Date()
        : normalized.cancellationDate;

    const [categoryValidation, accountValidation] = await Promise.all([
      validateOwnedCategory(authResult.userId, normalized.categoryId),
      validateOwnedAccount(authResult.userId, normalized.accountId),
    ]);

    if (!categoryValidation.success) {
      return { success: false, error: categoryValidation.error };
    }

    if (!accountValidation.success) {
      return { success: false, error: accountValidation.error };
    }

    if (!normalized.name) {
      return { success: false, error: "Name is required" };
    }

    const encryptedFields = await buildEncryptedSubscriptionFields(authResult.userId, normalized);

    const subscription = await prisma.subscription.create({
      data: {
        name: null,
        nameEncrypted: encryptedFields.nameEncrypted,
        provider: normalized.provider ? null : null,
        providerEncrypted: encryptedFields.providerEncrypted,
        description: normalized.description ? null : null,
        descriptionEncrypted: encryptedFields.descriptionEncrypted,
        amount: normalized.amount!,
        currency: normalized.currency!,
        billingCycle: normalized.billingCycle!,
        nextBillingDate: normalized.nextBillingDate!,
        startDate: normalized.startDate,
        trialEndDate: normalized.trialEndDate,
        cancellationDate: finalCancellationDate ?? null,
        status: normalized.status!,
        categoryId: normalized.categoryId ?? null,
        accountId: normalized.accountId ?? null,
        cancellationUrl: normalized.cancellationUrl ? null : null,
        cancellationUrlEncrypted: encryptedFields.cancellationUrlEncrypted,
        notes: normalized.notes ? null : null,
        notesEncrypted: encryptedFields.notesEncrypted,
        userId: authResult.userId,
      },
    });

    revalidateSubscriptionPaths();
    return { success: true, data: subscription };
  } catch (error) {
    console.error("Create subscription error:", error);
    return { success: false, error: "Failed to create subscription" };
  }
}

export async function updateSubscription(id: string, data: SubscriptionUpdateInput) {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error };
    }

    const parsed = subscriptionUpdateSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const existing = await prisma.subscription.findFirst({
      where: { id, userId: authResult.userId },
      select: {
        id: true,
        name: true,
        nameEncrypted: true,
        amount: true,
        currency: true,
        billingCycle: true,
        nextBillingDate: true,
        description: true,
        descriptionEncrypted: true,
        startDate: true,
        trialEndDate: true,
        cancellationDate: true,
        status: true,
        categoryId: true,
        accountId: true,
        recurringRuleId: true,
      },
    });

    if (!existing) {
      return { success: false, error: "Subscription not found" };
    }

    const normalized = normalizeMutationInput(parsed.data);
    const mergedState = {
      nextBillingDate: normalized.nextBillingDate ?? existing.nextBillingDate,
      startDate: normalized.startDate !== undefined ? normalized.startDate : existing.startDate,
      trialEndDate:
        normalized.trialEndDate !== undefined ? normalized.trialEndDate : existing.trialEndDate,
      cancellationDate:
        normalized.cancellationDate !== undefined
          ? normalized.cancellationDate
          : existing.cancellationDate,
      status: normalized.status ?? existing.status,
    };

    const dateError = validateSubscriptionLifecycle(mergedState);
    if (dateError) {
      return { success: false, error: dateError };
    }

    if (normalized.cancellationUrl) {
      try {
        new URL(normalized.cancellationUrl);
      } catch {
        return { success: false, error: "Cancellation URL must be a valid URL" };
      }
    }

    const finalCancellationDate =
      mergedState.status === "CANCELLED"
        ? mergedState.cancellationDate ?? new Date()
        : normalized.cancellationDate !== undefined
          ? normalized.cancellationDate
          : existing.cancellationDate;

    const [categoryValidation, accountValidation] = await Promise.all([
      validateOwnedCategory(
        authResult.userId,
        normalized.categoryId !== undefined ? normalized.categoryId : existing.categoryId
      ),
      validateOwnedAccount(
        authResult.userId,
        normalized.accountId !== undefined ? normalized.accountId : existing.accountId
      ),
    ]);

    if (!categoryValidation.success) {
      return { success: false, error: categoryValidation.error };
    }

    if (!accountValidation.success) {
      return { success: false, error: accountValidation.error };
    }

    const encryptedFields = await buildEncryptedSubscriptionFields(authResult.userId, normalized);
    const nextName = normalized.name ?? await decryptRequiredCompanion(
      authResult.userId,
      "subscription.name",
      existing.nameEncrypted,
      existing.name
    );
    let nextDescription = normalized.description;
    if (nextDescription === undefined && existing.descriptionEncrypted) {
      try {
        nextDescription = await decryptOptionalCompanion(
          authResult.userId,
          "subscription.description",
          existing.descriptionEncrypted,
          existing.description
        );
      } catch {
        nextDescription = existing.description;
      }
    } else if (nextDescription === undefined) {
      nextDescription = existing.description;
    }

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.subscription.update({
        where: { id },
        data: {
          name: normalized.name !== undefined ? null : undefined,
          nameEncrypted: normalized.name ? encryptedFields.nameEncrypted : undefined,
          provider: normalized.provider !== undefined ? null : undefined,
          providerEncrypted:
            normalized.provider !== undefined ? encryptedFields.providerEncrypted : undefined,
          description: normalized.description !== undefined ? null : undefined,
          descriptionEncrypted:
            normalized.description !== undefined
              ? encryptedFields.descriptionEncrypted
              : undefined,
          amount: normalized.amount,
          currency: normalized.currency,
          billingCycle: normalized.billingCycle,
          nextBillingDate: normalized.nextBillingDate,
          startDate: normalized.startDate !== undefined ? normalized.startDate : undefined,
          trialEndDate:
            normalized.trialEndDate !== undefined ? normalized.trialEndDate : undefined,
          cancellationDate:
            normalized.status === "CANCELLED"
              ? finalCancellationDate
              : normalized.cancellationDate !== undefined
                ? normalized.cancellationDate
                : undefined,
          status: normalized.status,
          categoryId: normalized.categoryId !== undefined ? normalized.categoryId : undefined,
          accountId: normalized.accountId !== undefined ? normalized.accountId : undefined,
          cancellationUrl:
            normalized.cancellationUrl !== undefined ? null : undefined,
          cancellationUrlEncrypted:
            normalized.cancellationUrl !== undefined
              ? encryptedFields.cancellationUrlEncrypted
              : undefined,
          notes: normalized.notes !== undefined ? null : undefined,
          notesEncrypted:
            normalized.notes !== undefined ? encryptedFields.notesEncrypted : undefined,
        },
      });

      if (existing.recurringRuleId) {
        await syncRecurringRuleWithSubscription(tx, authResult.userId, existing.recurringRuleId, {
          name: nextName,
          description: nextDescription,
          amount: normalized.amount ?? existing.amount,
          currency: normalized.currency ?? existing.currency,
          billingCycle: normalized.billingCycle ?? existing.billingCycle,
          nextBillingDate: normalized.nextBillingDate ?? existing.nextBillingDate,
          categoryId:
            normalized.categoryId !== undefined ? normalized.categoryId : existing.categoryId,
          accountId:
            normalized.accountId !== undefined ? normalized.accountId : existing.accountId,
          status: mergedState.status,
        });
      }

      return updated;
    });

    revalidateSubscriptionPaths(!!existing.recurringRuleId);
    return { success: true, data: result };
  } catch (error) {
    console.error("Update subscription error:", error);
    return { success: false, error: "Failed to update subscription" };
  }
}

export async function deleteSubscription(id: string) {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error };
    }

    const subscription = await prisma.subscription.findFirst({
      where: { id, userId: authResult.userId },
      select: { id: true, recurringRuleId: true },
    });

    if (!subscription) {
      return { success: false, error: "Subscription not found" };
    }

    await prisma.subscription.delete({ where: { id } });
    revalidateSubscriptionPaths(!!subscription.recurringRuleId);
    return { success: true };
  } catch (error) {
    console.error("Delete subscription error:", error);
    return { success: false, error: "Failed to delete subscription" };
  }
}

export async function linkSubscriptionToRecurringRule(
  subscriptionId: string,
  recurringRuleId: string
) {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error };
    }

    const [subscription, recurringRule, existingLink] = await Promise.all([
      prisma.subscription.findFirst({
        where: { id: subscriptionId, userId: authResult.userId },
        select: {
          id: true,
          name: true,
          nameEncrypted: true,
          amount: true,
          currency: true,
          billingCycle: true,
          nextBillingDate: true,
          description: true,
          descriptionEncrypted: true,
          status: true,
          categoryId: true,
          accountId: true,
          recurringRuleId: true,
        },
      }),
      prisma.recurringRule.findFirst({
        where: { id: recurringRuleId, userId: authResult.userId },
        select: {
          id: true,
          type: true,
          subscription: {
            select: { id: true },
          },
        },
      }),
      prisma.subscription.findFirst({
        where: {
          recurringRuleId,
          NOT: { id: subscriptionId },
        },
        select: { id: true },
      }),
    ]);

    if (!subscription) {
      return { success: false, error: "Subscription not found" };
    }

    const effectiveStatus = resolveSubscriptionStatus(subscription);
    if (
      effectiveStatus === SubscriptionStatus.PAUSED ||
      effectiveStatus === SubscriptionStatus.CANCELLED ||
      effectiveStatus === SubscriptionStatus.EXPIRED
    ) {
      return {
        success: false,
        error: "Only active or trial subscriptions can be linked to recurring rules",
      };
    }

    if (subscription.recurringRuleId && subscription.recurringRuleId !== recurringRuleId) {
      return { success: false, error: "Subscription is already linked to a recurring rule" };
    }

    if (!recurringRule) {
      return { success: false, error: "Recurring rule not found" };
    }

    if (recurringRule.type !== TransactionType.EXPENSE) {
      return { success: false, error: "Only expense recurring rules can be linked" };
    }

    if (existingLink || recurringRule.subscription) {
      return { success: false, error: "Recurring rule is already linked to another subscription" };
    }

    const [name, description] = await Promise.all([
      decryptRequiredCompanion(
        authResult.userId,
        "subscription.name",
        subscription.nameEncrypted,
        subscription.name
      ),
      decryptOptionalCompanion(
        authResult.userId,
        "subscription.description",
        subscription.descriptionEncrypted,
        subscription.description
      ),
    ]);

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.subscription.update({
        where: { id: subscriptionId },
        data: { recurringRuleId },
      });

      await syncRecurringRuleWithSubscription(tx, authResult.userId, recurringRuleId, {
        name,
        description,
        amount: subscription.amount,
        currency: subscription.currency,
        billingCycle: subscription.billingCycle,
        nextBillingDate: subscription.nextBillingDate,
        categoryId: subscription.categoryId,
        accountId: subscription.accountId,
        status: effectiveStatus,
      });
    });

    revalidateSubscriptionPaths(true);
    return { success: true };
  } catch (error) {
    console.error("Link subscription to recurring rule error:", error);
    return { success: false, error: "Failed to link subscription to recurring rule" };
  }
}

export async function unlinkSubscriptionFromRecurringRule(subscriptionId: string) {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error };
    }

    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, userId: authResult.userId },
      select: { id: true, recurringRuleId: true },
    });

    if (!subscription) {
      return { success: false, error: "Subscription not found" };
    }

    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { recurringRuleId: null },
    });

    revalidateSubscriptionPaths(true);
    return { success: true };
  } catch (error) {
    console.error("Unlink subscription from recurring rule error:", error);
    return { success: false, error: "Failed to unlink recurring rule" };
  }
}

export async function createRecurringRuleFromSubscription(subscriptionId: string) {
  try {
    const authResult = await requireUserId();
    if ("error" in authResult) {
      return { success: false, error: authResult.error };
    }

    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, userId: authResult.userId },
      select: {
        id: true,
        name: true,
        nameEncrypted: true,
        amount: true,
        currency: true,
        billingCycle: true,
        nextBillingDate: true,
        description: true,
        descriptionEncrypted: true,
        status: true,
        categoryId: true,
        accountId: true,
        recurringRuleId: true,
      },
    });

    if (!subscription) {
      return { success: false, error: "Subscription not found" };
    }

    if (subscription.recurringRuleId) {
      return { success: false, error: "Subscription is already linked to a recurring rule" };
    }

    const effectiveStatus = resolveSubscriptionStatus(subscription);
    if (
      effectiveStatus === SubscriptionStatus.PAUSED ||
      effectiveStatus === SubscriptionStatus.CANCELLED ||
      effectiveStatus === SubscriptionStatus.EXPIRED
    ) {
      return {
        success: false,
        error: "Only active or trial subscriptions can create recurring rules",
      };
    }

    if (!subscription.accountId) {
      return {
        success: false,
        error: "A payment account is required before creating a recurring rule",
      };
    }

    const [name, description] = await Promise.all([
      decryptRequiredCompanion(
        authResult.userId,
        "subscription.name",
        subscription.nameEncrypted,
        subscription.name
      ),
      decryptOptionalCompanion(
        authResult.userId,
        "subscription.description",
        subscription.descriptionEncrypted,
        subscription.description
      ),
    ]);

    const [recurringNameEncrypted, recurringDescriptionEncrypted] = await Promise.all([
      encryptRequiredCompanion(authResult.userId, "recurringRule.name", name),
      encryptOptionalCompanion(authResult.userId, "recurringRule.description", description),
    ]);

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const recurringRule = await tx.recurringRule.create({
        data: {
          name: null,
          nameEncrypted: recurringNameEncrypted,
          amount: subscription.amount,
          currency: subscription.currency,
          type: TransactionType.EXPENSE,
          interval: billingCycleToRecurringInterval(subscription.billingCycle),
          nextDueDate: subscription.nextBillingDate,
          description: description ? null : null,
          descriptionEncrypted: recurringDescriptionEncrypted,
          categoryId: subscription.categoryId,
          accountId: subscription.accountId,
          isActive: true,
          userId: authResult.userId,
        },
      });

      await tx.subscription.update({
        where: { id: subscriptionId },
        data: { recurringRuleId: recurringRule.id },
      });

      return recurringRule;
    });

    revalidateSubscriptionPaths(true);
    return { success: true, data: result };
  } catch (error) {
    console.error("Create recurring rule from subscription error:", error);
    return { success: false, error: "Failed to create recurring rule from subscription" };
  }
}

export async function detectSubscriptionCandidates() {
  return { success: true, data: [] as Array<never> };
}
