import { endOfDay, isBefore } from "date-fns";

import {
  RecurringInterval,
  SubscriptionBillingCycle,
  SubscriptionStatus,
} from "@/generated/prisma/client/client";
import {
  EDITABLE_SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_BILLING_CYCLE_LABELS,
  SUBSCRIPTION_STATUS_FILTERS,
  SUBSCRIPTION_STATUS_LABELS,
  TRIAL_ENDING_SOON_DAYS,
  type SubscriptionStatusFilter,
  UPCOMING_RENEWALS_DAYS,
} from "@/lib/subscription-constants";

export {
  EDITABLE_SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_BILLING_CYCLE_LABELS,
  SUBSCRIPTION_STATUS_FILTERS,
  SUBSCRIPTION_STATUS_LABELS,
  TRIAL_ENDING_SOON_DAYS,
  UPCOMING_RENEWALS_DAYS,
  type SubscriptionStatusFilter,
};

interface ResolvableSubscriptionStatus {
  status: SubscriptionStatus;
  trialEndDate?: Date | string | null;
  cancellationDate?: Date | string | null;
}

function toDateOrNull(value?: Date | string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function hasDateFullyPassed(value: Date | string | null | undefined, now: Date): boolean {
  const date = toDateOrNull(value);
  return !!date && isBefore(endOfDay(date), now);
}

export function resolveSubscriptionStatus(
  subscription: ResolvableSubscriptionStatus,
  now: Date = new Date()
): SubscriptionStatus {
  if (
    subscription.status === SubscriptionStatus.TRIAL &&
    hasDateFullyPassed(subscription.trialEndDate, now)
  ) {
    return SubscriptionStatus.EXPIRED;
  }

  if (
    subscription.status === SubscriptionStatus.CANCELLED &&
    hasDateFullyPassed(subscription.cancellationDate, now)
  ) {
    return SubscriptionStatus.EXPIRED;
  }

  return subscription.status;
}

export function toMonthlyEquivalent(
  amount: number,
  billingCycle: SubscriptionBillingCycle
): number {
  switch (billingCycle) {
    case SubscriptionBillingCycle.WEEKLY:
      return (amount * 52) / 12;
    case SubscriptionBillingCycle.MONTHLY:
      return amount;
    case SubscriptionBillingCycle.QUARTERLY:
      return amount / 3;
    case SubscriptionBillingCycle.YEARLY:
      return amount / 12;
    default:
      return amount;
  }
}

export function toYearlyEquivalent(
  amount: number,
  billingCycle: SubscriptionBillingCycle
): number {
  switch (billingCycle) {
    case SubscriptionBillingCycle.WEEKLY:
      return amount * 52;
    case SubscriptionBillingCycle.MONTHLY:
      return amount * 12;
    case SubscriptionBillingCycle.QUARTERLY:
      return amount * 4;
    case SubscriptionBillingCycle.YEARLY:
      return amount;
    default:
      return amount;
  }
}

export function billingCycleToRecurringInterval(
  billingCycle: SubscriptionBillingCycle
): RecurringInterval {
  switch (billingCycle) {
    case SubscriptionBillingCycle.WEEKLY:
      return RecurringInterval.WEEKLY;
    case SubscriptionBillingCycle.MONTHLY:
      return RecurringInterval.MONTHLY;
    case SubscriptionBillingCycle.QUARTERLY:
      return RecurringInterval.QUARTERLY;
    case SubscriptionBillingCycle.YEARLY:
      return RecurringInterval.YEARLY;
    default:
      return RecurringInterval.MONTHLY;
  }
}

export function normalizeSubscriptionCurrency(currency: string): string {
  return currency.trim().toUpperCase();
}

export function isSpendActiveSubscriptionStatus(status: SubscriptionStatus): boolean {
  return status === SubscriptionStatus.ACTIVE;
}

export function isTrialSubscriptionStatus(status: SubscriptionStatus): boolean {
  return status === SubscriptionStatus.TRIAL;
}

export function isRenewalEligibleSubscriptionStatus(status: SubscriptionStatus): boolean {
  return status === SubscriptionStatus.ACTIVE;
}
