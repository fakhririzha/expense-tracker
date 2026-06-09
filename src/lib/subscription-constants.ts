export const SUBSCRIPTION_STATUS_FILTERS = [
  "ALL",
  "ACTIVE",
  "TRIAL",
  "PAUSED",
  "CANCELLED",
  "EXPIRED",
] as const;

export type SubscriptionStatusFilter = (typeof SUBSCRIPTION_STATUS_FILTERS)[number];

export const EDITABLE_SUBSCRIPTION_STATUSES = [
  "ACTIVE",
  "TRIAL",
  "PAUSED",
  "CANCELLED",
] as const;

export type EditableSubscriptionStatus = (typeof EDITABLE_SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_STATUSES = [
  "ACTIVE",
  "TRIAL",
  "PAUSED",
  "CANCELLED",
  "EXPIRED",
] as const;

export type SubscriptionStatusValue = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_BILLING_CYCLES = [
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
] as const;

export type SubscriptionBillingCycleValue =
  (typeof SUBSCRIPTION_BILLING_CYCLES)[number];

export const SUBSCRIPTION_STATUS_LABELS: Record<
  SubscriptionStatusValue,
  string
> = {
  ACTIVE: "Active",
  TRIAL: "Trial",
  PAUSED: "Paused",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

export const SUBSCRIPTION_BILLING_CYCLE_LABELS: Record<
  SubscriptionBillingCycleValue,
  string
> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};

export const TRIAL_ENDING_SOON_DAYS = 7;
export const UPCOMING_RENEWALS_DAYS = 30;
