import { createHash } from "crypto";
import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from "date-fns";
import webpush, { type PushSubscription as WebPushSubscription } from "web-push";

import { getUpcomingBankPressureForUser } from "@/actions/schedule-pressure-actions";
import {
  NotificationDeliveryStatus,
  NotificationType,
  SubscriptionStatus,
  TransactionType,
  type NotificationPreference,
  type Prisma,
} from "@/generated/prisma/client/client";
import prisma from "@/lib/db";
import { flattenTransactionAllocationRows } from "@/lib/transaction-allocation-service";
import { decryptUserField, encryptUserField } from "@/lib/user-encryption";

const DEFAULT_SUBSCRIPTION_REMINDER_DAYS = 3;
const DEFAULT_RECURRING_REMINDER_DAYS = 1;
const DEFAULT_BUDGET_THRESHOLD_PERCENT = 80;
const DISABLE_AFTER_FAILURES = 3;
const LOW_CASH_LOOKAHEAD_DAYS = 30;
const GOAL_REMINDER_LOOKAHEAD_DAYS = 7;

let vapidConfigured = false;

export interface PushSubscriptionInput {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string | null;
}

export interface NotificationPreferencesInput {
  pushEnabled?: boolean;
  subscriptionRenewalEnabled?: boolean;
  recurringTransactionEnabled?: boolean;
  budgetThresholdEnabled?: boolean;
  lowCashForecastEnabled?: boolean;
  monthlySnapshotEnabled?: boolean;
  goalProgressEnabled?: boolean;
  importExportCompletionEnabled?: boolean;
  subscriptionReminderLeadDays?: number;
  recurringReminderLeadDays?: number;
  budgetThresholdPercent?: number;
}

export interface NotificationSettingsView {
  vapidConfigured: boolean;
  vapidPublicKey: string | null;
  activeDeviceCount: number;
  preferences: NotificationPreferenceSnapshot;
}

export interface NotificationPreferenceSnapshot {
  pushEnabled: boolean;
  subscriptionRenewalEnabled: boolean;
  recurringTransactionEnabled: boolean;
  budgetThresholdEnabled: boolean;
  lowCashForecastEnabled: boolean;
  monthlySnapshotEnabled: boolean;
  goalProgressEnabled: boolean;
  importExportCompletionEnabled: boolean;
  subscriptionReminderLeadDays: number;
  recurringReminderLeadDays: number;
  budgetThresholdPercent: number;
}

export interface NotificationDispatchResult {
  success: boolean;
  status: NotificationDeliveryStatus;
  successCount: number;
  failureCount: number;
  skippedReason?: string;
}

interface NotificationDispatchInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  targetPath?: string;
  dedupeKey: string;
  metadata?: Prisma.InputJsonValue;
  respectPreferences?: boolean;
}

interface NotificationPreferenceRow extends NotificationPreferenceSnapshot {
  userId: string;
}

interface ActivePushSubscriptionRow {
  id: string;
  endpointEncrypted: string;
  p256dhEncrypted: string;
  authEncrypted: string;
  expirationTime: Date | null;
  failureCount: number;
}

interface NotificationDispatchContext {
  preference: NotificationPreferenceSnapshot;
  subscriptions: ActivePushSubscriptionRow[];
}

interface BudgetPeriodAggregate {
  totalSpent: number;
  spentByCategoryId: Map<string, number>;
}

const notificationPreferenceSelect = {
  pushEnabled: true,
  subscriptionRenewalEnabled: true,
  recurringTransactionEnabled: true,
  budgetThresholdEnabled: true,
  lowCashForecastEnabled: true,
  monthlySnapshotEnabled: true,
  goalProgressEnabled: true,
  importExportCompletionEnabled: true,
  subscriptionReminderLeadDays: true,
  recurringReminderLeadDays: true,
  budgetThresholdPercent: true,
} satisfies Prisma.NotificationPreferenceSelect;

const activePushSubscriptionSelect = {
  id: true,
  endpointEncrypted: true,
  p256dhEncrypted: true,
  authEncrypted: true,
  expirationTime: true,
  failureCount: true,
} satisfies Prisma.PushSubscriptionSelect;

const notificationEventDispatchSelect = {
  id: true,
  status: true,
  successCount: true,
  failureCount: true,
  skippedReason: true,
} satisfies Prisma.NotificationEventSelect;

const budgetThresholdTransactionSelect = {
  id: true,
  amount: true,
  currency: true,
  exchangeRate: true,
  type: true,
  date: true,
  categoryId: true,
  accountId: true,
  toAccountId: true,
  description: true,
  splits: {
    select: {
      id: true,
      amount: true,
      description: true,
      sortOrder: true,
      categoryId: true,
    },
  },
} satisfies Prisma.TransactionSelect;

const notificationTargetPaths: Record<NotificationType, string> = {
  [NotificationType.TEST]: "/dashboard/profile",
  [NotificationType.SUBSCRIPTION_RENEWAL]: "/dashboard/subscriptions",
  [NotificationType.RECURRING_TRANSACTION_DUE]: "/dashboard/recurring",
  [NotificationType.BUDGET_THRESHOLD]: "/dashboard/budgets",
  [NotificationType.LOW_CASH_FORECAST]: "/dashboard/calendar",
  [NotificationType.MONTHLY_NET_WORTH_SNAPSHOT]: "/dashboard/reports",
  [NotificationType.GOAL_PROGRESS]: "/dashboard/goals",
  [NotificationType.IMPORT_EXPORT_COMPLETION]: "/dashboard/data",
};

function getDefaultPreferenceSnapshot(): NotificationPreferenceSnapshot {
  return {
    pushEnabled: false,
    subscriptionRenewalEnabled: true,
    recurringTransactionEnabled: true,
    budgetThresholdEnabled: true,
    lowCashForecastEnabled: true,
    monthlySnapshotEnabled: true,
    goalProgressEnabled: true,
    importExportCompletionEnabled: false,
    subscriptionReminderLeadDays: DEFAULT_SUBSCRIPTION_REMINDER_DAYS,
    recurringReminderLeadDays: DEFAULT_RECURRING_REMINDER_DAYS,
    budgetThresholdPercent: DEFAULT_BUDGET_THRESHOLD_PERCENT,
  };
}

function getPreferenceCreateData(userId: string): Prisma.NotificationPreferenceUncheckedCreateInput {
  return {
    userId,
    ...getDefaultPreferenceSnapshot(),
  };
}

function isWebPushConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT
  );
}

function ensureWebPushConfigured() {
  if (!isWebPushConfigured()) {
    throw new Error("Web Push is not configured");
  }

  if (!vapidConfigured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    vapidConfigured = true;
  }
}

function hashEndpoint(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}

function normalizeDashboardPath(targetPath: string | undefined, type: NotificationType): string {
  const fallback = notificationTargetPaths[type];
  if (!targetPath) {
    return fallback;
  }

  if (!targetPath.startsWith("/dashboard")) {
    return fallback;
  }

  if (targetPath.includes("://")) {
    return fallback;
  }

  return targetPath;
}

function mapPreferenceRow(
  row: NotificationPreferenceSnapshot | NotificationPreference | null | undefined
): NotificationPreferenceSnapshot {
  if (!row) {
    return getDefaultPreferenceSnapshot();
  }

  return {
    pushEnabled: row.pushEnabled,
    subscriptionRenewalEnabled: row.subscriptionRenewalEnabled,
    recurringTransactionEnabled: row.recurringTransactionEnabled,
    budgetThresholdEnabled: row.budgetThresholdEnabled,
    lowCashForecastEnabled: row.lowCashForecastEnabled,
    monthlySnapshotEnabled: row.monthlySnapshotEnabled,
    goalProgressEnabled: row.goalProgressEnabled,
    importExportCompletionEnabled: row.importExportCompletionEnabled,
    subscriptionReminderLeadDays: row.subscriptionReminderLeadDays,
    recurringReminderLeadDays: row.recurringReminderLeadDays,
    budgetThresholdPercent: row.budgetThresholdPercent,
  };
}

async function getNotificationPreferenceForUser(userId: string): Promise<NotificationPreferenceRow> {
  const row = await prisma.notificationPreference.findUnique({
    where: { userId },
    select: notificationPreferenceSelect,
  });

  return {
    userId,
    ...mapPreferenceRow(row),
  };
}

async function ensureNotificationPreferenceForUser(
  userId: string
): Promise<NotificationPreferenceRow> {
  const row = await prisma.notificationPreference.upsert({
    where: { userId },
    create: getPreferenceCreateData(userId),
    update: {},
  });

  return {
    userId,
    ...mapPreferenceRow(row),
  };
}

async function getActiveSubscriptionCount(userId: string): Promise<number> {
  const now = new Date();

  return prisma.pushSubscription.count({
    where: {
      userId,
      disabledAt: null,
      OR: [{ expirationTime: null }, { expirationTime: { gt: now } }],
    },
  });
}

async function getActiveSubscriptionsForUser(
  userId: string,
  now: Date = new Date()
): Promise<ActivePushSubscriptionRow[]> {
  return prisma.pushSubscription.findMany({
    where: {
      userId,
      disabledAt: null,
      OR: [{ expirationTime: null }, { expirationTime: { gt: now } }],
    },
    select: activePushSubscriptionSelect,
  });
}

async function loadNotificationDispatchContext(
  userId: string,
  options?: { preference?: NotificationPreferenceSnapshot; now?: Date }
): Promise<NotificationDispatchContext> {
  const subscriptionsPromise = getActiveSubscriptionsForUser(userId, options?.now);
  const preferencePromise = options?.preference
    ? Promise.resolve(options.preference)
    : getNotificationPreferenceForUser(userId).then((preference) => ({
        pushEnabled: preference.pushEnabled,
        subscriptionRenewalEnabled: preference.subscriptionRenewalEnabled,
        recurringTransactionEnabled: preference.recurringTransactionEnabled,
        budgetThresholdEnabled: preference.budgetThresholdEnabled,
        lowCashForecastEnabled: preference.lowCashForecastEnabled,
        monthlySnapshotEnabled: preference.monthlySnapshotEnabled,
        goalProgressEnabled: preference.goalProgressEnabled,
        importExportCompletionEnabled: preference.importExportCompletionEnabled,
        subscriptionReminderLeadDays: preference.subscriptionReminderLeadDays,
        recurringReminderLeadDays: preference.recurringReminderLeadDays,
        budgetThresholdPercent: preference.budgetThresholdPercent,
      }));

  const [preference, subscriptions] = await Promise.all([
    preferencePromise,
    subscriptionsPromise,
  ]);

  return {
    preference,
    subscriptions,
  };
}

async function decryptWebPushSubscription(
  userId: string,
  subscription: {
    endpointEncrypted: string;
    p256dhEncrypted: string;
    authEncrypted: string;
    expirationTime: Date | null;
  }
): Promise<WebPushSubscription> {
  return {
    endpoint: await decryptUserField(
      userId,
      "pushSubscription.endpoint",
      subscription.endpointEncrypted
    ),
    expirationTime: subscription.expirationTime?.getTime() ?? null,
    keys: {
      p256dh: await decryptUserField(
        userId,
        "pushSubscription.p256dh",
        subscription.p256dhEncrypted
      ),
      auth: await decryptUserField(
        userId,
        "pushSubscription.auth",
        subscription.authEncrypted
      ),
    },
  };
}

async function markSubscriptionFailure(
  subscriptionId: string,
  currentFailureCount: number,
  shouldDisable: boolean
) {
  await prisma.pushSubscription.update({
    where: { id: subscriptionId },
    data: {
      failureCount: { increment: 1 },
      lastFailureAt: new Date(),
      disabledAt: shouldDisable ? new Date() : undefined,
    },
  });
}

async function markSubscriptionSuccess(subscriptionId: string) {
  await prisma.pushSubscription.update({
    where: { id: subscriptionId },
    data: {
      failureCount: 0,
      disabledAt: null,
      lastSuccessAt: new Date(),
      lastFailureAt: null,
    },
  });
}

function getPreferenceFlagForType(
  type: NotificationType,
  preference: NotificationPreferenceSnapshot
): boolean {
  switch (type) {
    case NotificationType.TEST:
      return preference.pushEnabled;
    case NotificationType.SUBSCRIPTION_RENEWAL:
      return preference.subscriptionRenewalEnabled;
    case NotificationType.RECURRING_TRANSACTION_DUE:
      return preference.recurringTransactionEnabled;
    case NotificationType.BUDGET_THRESHOLD:
      return preference.budgetThresholdEnabled;
    case NotificationType.LOW_CASH_FORECAST:
      return preference.lowCashForecastEnabled;
    case NotificationType.MONTHLY_NET_WORTH_SNAPSHOT:
      return preference.monthlySnapshotEnabled;
    case NotificationType.GOAL_PROGRESS:
      return preference.goalProgressEnabled;
    case NotificationType.IMPORT_EXPORT_COMPLETION:
      return preference.importExportCompletionEnabled;
    default:
      return false;
  }
}

async function upsertNotificationEvent(input: NotificationDispatchInput) {
  return prisma.notificationEvent.upsert({
    where: {
      userId_type_dedupeKey: {
        userId: input.userId,
        type: input.type,
        dedupeKey: input.dedupeKey,
      },
    },
    create: {
      userId: input.userId,
      type: input.type,
      dedupeKey: input.dedupeKey,
      title: input.title,
      body: input.body,
      targetPath: normalizeDashboardPath(input.targetPath, input.type),
      metadataJson: input.metadata,
    },
    update: {},
    select: notificationEventDispatchSelect,
  });
}

function buildPushPayload(input: NotificationDispatchInput) {
  const targetPath = normalizeDashboardPath(input.targetPath, input.type);

  return JSON.stringify({
    title: input.title,
    body: input.body,
    url: targetPath,
    tag: `${input.type}:${input.dedupeKey}`,
    type: input.type,
  });
}

async function sendToSubscriptions(
  userId: string,
  subscriptions: Array<{
    id: string;
    endpointEncrypted: string;
    p256dhEncrypted: string;
    authEncrypted: string;
    expirationTime: Date | null;
    failureCount: number;
  }>,
  payload: string
) {
  let successCount = 0;
  let failureCount = 0;

  for (const subscription of subscriptions) {
    try {
      const webPushSubscription = await decryptWebPushSubscription(
        userId,
        subscription
      );

      await webpush.sendNotification(webPushSubscription, payload, {
        TTL: 60,
        urgency: "normal",
      });

      successCount += 1;
      await markSubscriptionSuccess(subscription.id);
    } catch (error) {
      failureCount += 1;

      const statusCode =
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error &&
        typeof error.statusCode === "number"
          ? error.statusCode
          : null;

      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: {
            disabledAt: new Date(),
            lastFailureAt: new Date(),
            failureCount: { increment: 1 },
          },
        });
      } else {
        await markSubscriptionFailure(
          subscription.id,
          subscription.failureCount,
          subscription.failureCount + 1 >= DISABLE_AFTER_FAILURES
        );
      }
    }
  }

  return { successCount, failureCount };
}

async function updateNotificationEventStatus(
  eventId: string,
  input: {
    status: NotificationDeliveryStatus;
    successCount: number;
    failureCount: number;
    skippedReason?: string;
  }
) {
  await prisma.notificationEvent.update({
    where: { id: eventId },
    data: {
      status: input.status,
      successCount: input.successCount,
      failureCount: input.failureCount,
      skippedReason: input.skippedReason ?? null,
      sentAt:
        input.status === NotificationDeliveryStatus.SENT ||
        input.status === NotificationDeliveryStatus.PARTIAL_FAILURE
          ? new Date()
          : null,
    },
  });
}

export async function getNotificationSettingsForUser(
  userId: string
): Promise<NotificationSettingsView> {
  const [preference, activeDeviceCount] = await Promise.all([
    getNotificationPreferenceForUser(userId),
    getActiveSubscriptionCount(userId),
  ]);

  return {
    vapidConfigured: isWebPushConfigured(),
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
    activeDeviceCount,
    preferences: preference,
  };
}

export async function syncPushSubscriptionForUser(
  userId: string,
  input: PushSubscriptionInput
) {
  const endpointHash = hashEndpoint(input.endpoint);
  const existing = await prisma.pushSubscription.findUnique({
    where: { endpointHash },
    select: { id: true, userId: true },
  });

  const [
    endpointEncrypted,
    p256dhEncrypted,
    authEncrypted,
    userAgentEncrypted,
  ] = await Promise.all([
    encryptUserField(userId, "pushSubscription.endpoint", input.endpoint),
    encryptUserField(userId, "pushSubscription.p256dh", input.keys.p256dh),
    encryptUserField(userId, "pushSubscription.auth", input.keys.auth),
    input.userAgent
      ? encryptUserField(userId, "pushSubscription.userAgent", input.userAgent)
      : Promise.resolve(null),
  ]);

  await prisma.pushSubscription.upsert({
    where: { endpointHash },
    create: {
      userId,
      endpointHash,
      endpointEncrypted,
      p256dhEncrypted,
      authEncrypted,
      userAgentEncrypted: userAgentEncrypted ?? null,
      expirationTime: input.expirationTime ? new Date(input.expirationTime) : null,
    },
    update: {
      userId,
      endpointEncrypted,
      p256dhEncrypted,
      authEncrypted,
      userAgentEncrypted: userAgentEncrypted ?? null,
      expirationTime: input.expirationTime ? new Date(input.expirationTime) : null,
      disabledAt: null,
      failureCount: 0,
      lastSeenAt: new Date(),
    },
  });

  await prisma.notificationPreference.upsert({
    where: { userId },
    create: {
      ...getPreferenceCreateData(userId),
      pushEnabled: true,
    },
    update: {
      pushEnabled: true,
    },
  });

  if (existing?.userId && existing.userId !== userId) {
    const remainingCount = await getActiveSubscriptionCount(existing.userId);
    if (remainingCount === 0) {
      await prisma.notificationPreference.updateMany({
        where: { userId: existing.userId },
        data: { pushEnabled: false },
      });
    }
  }

  return getNotificationSettingsForUser(userId);
}

export async function removePushSubscriptionForUser(
  userId: string,
  endpoint: string
) {
  const endpointHash = hashEndpoint(endpoint);

  await prisma.pushSubscription.deleteMany({
    where: {
      userId,
      endpointHash,
    },
  });

  const activeDeviceCount = await getActiveSubscriptionCount(userId);

  if (activeDeviceCount === 0) {
    await prisma.notificationPreference.updateMany({
      where: { userId },
      data: { pushEnabled: false },
    });
  }

  return getNotificationSettingsForUser(userId);
}

export async function updateNotificationPreferencesForUser(
  userId: string,
  input: NotificationPreferencesInput
) {
  await ensureNotificationPreferenceForUser(userId);

  await prisma.notificationPreference.update({
    where: { userId },
    data: input,
  });

  return getNotificationSettingsForUser(userId);
}

export async function sendUserNotification(
  input: NotificationDispatchInput,
  context?: NotificationDispatchContext
): Promise<NotificationDispatchResult> {
  ensureWebPushConfigured();

  const dispatchContext =
    context ?? (await loadNotificationDispatchContext(input.userId));

  const preference = dispatchContext.preference;
  if (input.respectPreferences !== false) {
    if (!preference.pushEnabled) {
      return {
        success: false,
        status: NotificationDeliveryStatus.SKIPPED,
        successCount: 0,
        failureCount: 0,
        skippedReason: "push_disabled",
      };
    }

    if (!getPreferenceFlagForType(input.type, preference)) {
      return {
        success: false,
        status: NotificationDeliveryStatus.SKIPPED,
        successCount: 0,
        failureCount: 0,
        skippedReason: "type_disabled",
      };
    }
  }

  const event = await upsertNotificationEvent(input);
  if (
    event.status === NotificationDeliveryStatus.SENT ||
    event.status === NotificationDeliveryStatus.PARTIAL_FAILURE ||
    event.status === NotificationDeliveryStatus.SKIPPED
  ) {
    return {
      success: event.status === NotificationDeliveryStatus.SENT,
      status: event.status,
      successCount: event.successCount,
      failureCount: event.failureCount,
      skippedReason: event.skippedReason ?? undefined,
    };
  }

  const subscriptions = dispatchContext.subscriptions;

  if (subscriptions.length === 0) {
    await updateNotificationEventStatus(event.id, {
      status: NotificationDeliveryStatus.SKIPPED,
      successCount: 0,
      failureCount: 0,
      skippedReason: "no_active_subscriptions",
    });

    return {
      success: false,
      status: NotificationDeliveryStatus.SKIPPED,
      successCount: 0,
      failureCount: 0,
      skippedReason: "no_active_subscriptions",
    };
  }

  const payload = buildPushPayload(input);
  const result = await sendToSubscriptions(input.userId, subscriptions, payload);

  const status =
    result.successCount > 0 && result.failureCount === 0
      ? NotificationDeliveryStatus.SENT
      : result.successCount > 0
        ? NotificationDeliveryStatus.PARTIAL_FAILURE
        : NotificationDeliveryStatus.FAILED;

  await updateNotificationEventStatus(event.id, {
    status,
    successCount: result.successCount,
    failureCount: result.failureCount,
  });

  return {
    success: result.successCount > 0,
    status,
    successCount: result.successCount,
    failureCount: result.failureCount,
  };
}

export async function sendTestNotificationToUser(userId: string) {
  return sendUserNotification({
    userId,
    type: NotificationType.TEST,
    title: "FinHealth test notification",
    body: "Push notifications are working for this browser.",
    targetPath: "/dashboard/profile",
    dedupeKey: `test:${Date.now()}`,
    respectPreferences: false,
  });
}

function getBudgetWindow(period: "MONTHLY" | "QUARTERLY" | "YEARLY", now: Date) {
  switch (period) {
    case "MONTHLY":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "QUARTERLY":
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case "YEARLY":
      return { start: startOfYear(now), end: endOfYear(now) };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

function getBudgetPeriodKey(period: "MONTHLY" | "QUARTERLY" | "YEARLY", now: Date) {
  if (period === "MONTHLY") {
    return format(now, "yyyy-MM");
  }

  if (period === "YEARLY") {
    return format(now, "yyyy");
  }

  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return `${format(now, "yyyy")}-Q${quarter}`;
}

async function getBudgetPeriodAggregate(
  userId: string,
  period: "MONTHLY" | "QUARTERLY" | "YEARLY",
  now: Date
): Promise<BudgetPeriodAggregate> {
  const window = getBudgetWindow(period, now);
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      date: {
        gte: window.start,
        lte: window.end,
      },
      type: {
        in: [TransactionType.EXPENSE, TransactionType.LIABILITY_PAYMENT],
      },
    },
    select: budgetThresholdTransactionSelect,
  });

  let totalSpent = 0;
  for (const transaction of transactions) {
    totalSpent += transaction.amount * transaction.exchangeRate;
  }

  const expenseTransactions = transactions
    .filter((transaction) => transaction.type === TransactionType.EXPENSE)
    .map((transaction) => ({
      ...transaction,
      category: null,
      splits: transaction.splits.map((split) => ({
        ...split,
        category: null,
      })),
    }));

  const spentByCategoryId = new Map<string, number>();
  const allocationRows = flattenTransactionAllocationRows(expenseTransactions);
  for (const row of allocationRows) {
    if (!row.categoryId) {
      continue;
    }

    spentByCategoryId.set(
      row.categoryId,
      (spentByCategoryId.get(row.categoryId) ?? 0) + row.normalizedAmount
    );
  }

  return {
    totalSpent,
    spentByCategoryId,
  };
}

async function sendSubscriptionRenewalNotifications(
  userId: string,
  preference: NotificationPreferenceSnapshot,
  now: Date,
  context?: NotificationDispatchContext
) {
  if (!preference.subscriptionRenewalEnabled) {
    return 0;
  }

  const dueBy = endOfDay(addDays(now, preference.subscriptionReminderLeadDays));
  const subscriptions = await prisma.subscription.findMany({
    where: {
      userId,
      status: {
        in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL],
      },
      nextBillingDate: {
        gte: startOfDay(now),
        lte: dueBy,
      },
    },
    select: {
      id: true,
      nextBillingDate: true,
    },
  });

  let sent = 0;
  for (const subscription of subscriptions) {
    const result = await sendUserNotification({
      userId,
      type: NotificationType.SUBSCRIPTION_RENEWAL,
      title: "Upcoming bill",
      body: "A payment is due soon.",
      targetPath: "/dashboard/subscriptions",
      dedupeKey: `subscription:${subscription.id}:${format(subscription.nextBillingDate, "yyyy-MM-dd")}`,
    }, context);

    if (result.success) {
      sent += 1;
    }
  }

  return sent;
}

async function sendRecurringDueNotifications(
  userId: string,
  preference: NotificationPreferenceSnapshot,
  now: Date,
  context?: NotificationDispatchContext
) {
  if (!preference.recurringTransactionEnabled) {
    return 0;
  }

  const dueBy = endOfDay(addDays(now, preference.recurringReminderLeadDays));
  const rules = await prisma.recurringRule.findMany({
    where: {
      userId,
      isActive: true,
      type: {
        in: [TransactionType.EXPENSE, TransactionType.TRANSFER],
      },
      nextDueDate: {
        gte: startOfDay(now),
        lte: dueBy,
      },
      subscription: null,
    },
    select: {
      id: true,
      nextDueDate: true,
    },
  });

  let sent = 0;
  for (const rule of rules) {
    const result = await sendUserNotification({
      userId,
      type: NotificationType.RECURRING_TRANSACTION_DUE,
      title: "Recurring reminder",
      body: "A scheduled transaction is due soon.",
      targetPath: "/dashboard/recurring",
      dedupeKey: `recurring:${rule.id}:${format(rule.nextDueDate, "yyyy-MM-dd")}`,
    }, context);

    if (result.success) {
      sent += 1;
    }
  }

  return sent;
}

async function sendBudgetThresholdNotifications(
  userId: string,
  preference: NotificationPreferenceSnapshot,
  now: Date,
  context?: NotificationDispatchContext
) {
  if (!preference.budgetThresholdEnabled) {
    return 0;
  }

  const budgets = await prisma.budget.findMany({
    where: {
      userId,
      isActive: true,
    },
    select: {
      id: true,
      amount: true,
      period: true,
      categoryId: true,
    },
  });

  if (budgets.length === 0) {
    return 0;
  }

  const budgetsByPeriod = new Map<
    "MONTHLY" | "QUARTERLY" | "YEARLY",
    typeof budgets
  >();
  for (const budget of budgets) {
    const existing = budgetsByPeriod.get(budget.period) ?? [];
    existing.push(budget);
    budgetsByPeriod.set(budget.period, existing);
  }

  const aggregates = new Map<"MONTHLY" | "QUARTERLY" | "YEARLY", BudgetPeriodAggregate>();
  for (const period of budgetsByPeriod.keys()) {
    aggregates.set(period, await getBudgetPeriodAggregate(userId, period, now));
  }

  let sent = 0;
  for (const budget of budgets) {
    const aggregate = aggregates.get(budget.period);
    if (!aggregate) {
      continue;
    }

    const spent = budget.categoryId
      ? aggregate.spentByCategoryId.get(budget.categoryId) ?? 0
      : aggregate.totalSpent;
    const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

    const threshold =
      percentage >= 100
        ? 100
        : percentage >= preference.budgetThresholdPercent
          ? preference.budgetThresholdPercent
          : null;

    if (!threshold) {
      continue;
    }

    const result = await sendUserNotification({
      userId,
      type: NotificationType.BUDGET_THRESHOLD,
      title: "Budget alert",
      body: "One of your budgets needs attention.",
      targetPath: "/dashboard/budgets",
      dedupeKey: `budget:${budget.id}:${getBudgetPeriodKey(budget.period, now)}:${threshold}`,
      metadata: {
        budgetId: budget.id,
        threshold,
      },
    }, context);

    if (result.success) {
      sent += 1;
    }
  }

  return sent;
}

async function sendLowCashForecastNotifications(
  userId: string,
  preference: NotificationPreferenceSnapshot,
  now: Date,
  context?: NotificationDispatchContext
) {
  if (!preference.lowCashForecastEnabled) {
    return 0;
  }

  const pressure = await getUpcomingBankPressureForUser(
    userId,
    LOW_CASH_LOOKAHEAD_DAYS
  );

  if (!pressure.success || !pressure.data?.length) {
    return 0;
  }

  const result = await sendUserNotification({
    userId,
    type: NotificationType.LOW_CASH_FORECAST,
    title: "Cash forecast alert",
    body: "Upcoming scheduled outflows may need attention.",
    targetPath: "/dashboard/calendar",
    dedupeKey: `cash-pressure:${format(now, "yyyy-MM-dd")}`,
    metadata: {
      alertCount: pressure.data.length,
    },
  }, context);

  return result.success ? 1 : 0;
}

async function sendGoalProgressNotifications(
  userId: string,
  preference: NotificationPreferenceSnapshot,
  now: Date,
  context?: NotificationDispatchContext
) {
  if (!preference.goalProgressEnabled) {
    return 0;
  }

  const dueBy = endOfDay(addDays(now, GOAL_REMINDER_LOOKAHEAD_DAYS));
  const goals = await prisma.savingsGoal.findMany({
    where: {
      userId,
      isCompleted: false,
      targetDate: {
        not: null,
        lte: dueBy,
      },
    },
    select: {
      id: true,
      targetDate: true,
    },
  });

  let sent = 0;
  for (const goal of goals) {
    if (!goal.targetDate) {
      continue;
    }

    const result = await sendUserNotification({
      userId,
      type: NotificationType.GOAL_PROGRESS,
      title: "Goal reminder",
      body: "One of your savings goals needs attention.",
      targetPath: "/dashboard/goals",
      dedupeKey: `goal:${goal.id}:${format(now, "yyyy-MM")}`,
      metadata: {
        goalId: goal.id,
      },
    }, context);

    if (result.success) {
      sent += 1;
    }
  }

  return sent;
}

export async function sendMonthlySnapshotReadyNotification(
  userId: string,
  periodKey: string
) {
  return sendUserNotification({
    userId,
    type: NotificationType.MONTHLY_NET_WORTH_SNAPSHOT,
    title: "FinHealth update",
    body: "Your monthly snapshot is ready.",
    targetPath: "/dashboard/reports",
    dedupeKey: `snapshot:${periodKey}`,
  });
}

export async function sendDailyNotificationBatch(now: Date = new Date()) {
  ensureWebPushConfigured();

  const preferences = await prisma.notificationPreference.findMany({
    where: {
      pushEnabled: true,
      user: {
        pushSubscriptions: {
          some: {
            disabledAt: null,
          },
        },
      },
    },
    select: {
      userId: true,
      ...notificationPreferenceSelect,
    },
  });

  const summary = {
    usersScanned: preferences.length,
    subscriptionRenewalSent: 0,
    recurringSent: 0,
    budgetSent: 0,
    lowCashSent: 0,
    goalSent: 0,
  };

  for (const preference of preferences) {
    const context = await loadNotificationDispatchContext(preference.userId, {
      preference,
      now,
    });

    if (context.subscriptions.length === 0) {
      continue;
    }

    summary.subscriptionRenewalSent += await sendSubscriptionRenewalNotifications(
      preference.userId,
      preference,
      now,
      context
    );
    summary.recurringSent += await sendRecurringDueNotifications(
      preference.userId,
      preference,
      now,
      context
    );
    summary.budgetSent += await sendBudgetThresholdNotifications(
      preference.userId,
      preference,
      now,
      context
    );
    summary.lowCashSent += await sendLowCashForecastNotifications(
      preference.userId,
      preference,
      now,
      context
    );
    summary.goalSent += await sendGoalProgressNotifications(
      preference.userId,
      preference,
      now,
      context
    );
  }

  return summary;
}
