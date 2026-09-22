import "server-only";

import { Prisma } from "@/generated/prisma/client/client";
import prisma from "@/lib/db";

export type NormalizedTransactionType = "INCOME" | "EXPENSE" | "LIABILITY_PAYMENT";

type TotalRow = {
  type: NormalizedTransactionType;
  total: number | string | null;
};

type MonthTotalRow = TotalRow & {
  monthKey: string;
};

function asNumber(value: number | string | null | undefined): number {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

/**
 * Month buckets follow the Node process timezone, matching Date#getFullYear/getMonth.
 * MySQL stores these datetimes in UTC, so the offset shifts the wall clock before grouping.
 */
function processTimezoneOffsetMinutes(sample: Date): number {
  return -sample.getTimezoneOffset();
}

export async function sumNormalizedAmountByType(input: {
  userId: string;
  types: NormalizedTransactionType[];
  from: Date;
  to?: Date;
  accountId?: string;
}): Promise<Map<NormalizedTransactionType, number>> {
  const totals = new Map<NormalizedTransactionType, number>();
  if (input.types.length === 0) {
    return totals;
  }

  const offsetFilter = input.to
    ? Prisma.sql`AND \`date\` <= ${input.to}`
    : Prisma.empty;
  const accountFilter = input.accountId
    ? Prisma.sql`AND accountId = ${input.accountId}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<TotalRow[]>`
    SELECT type, SUM(amount * exchangeRate) AS total
    FROM \`Transaction\`
    WHERE userId = ${input.userId}
      AND type IN (${Prisma.join(input.types)})
      AND \`date\` >= ${input.from}
      ${offsetFilter}
      ${accountFilter}
    GROUP BY type
  `;

  for (const row of rows) {
    totals.set(row.type, asNumber(row.total));
  }

  return totals;
}

export async function sumNormalizedAmount(input: {
  userId: string;
  types: NormalizedTransactionType[];
  from: Date;
  to?: Date;
  accountId?: string;
}): Promise<number> {
  const totals = await sumNormalizedAmountByType(input);
  let total = 0;
  for (const amount of totals.values()) {
    total += amount;
  }
  return total;
}

export async function averageMonthlyNormalizedAmount(input: {
  userId: string;
  from: Date;
}): Promise<{ income: number; expense: number }> {
  const offsetMinutes = processTimezoneOffsetMinutes(input.from);
  const rows = await prisma.$queryRaw<MonthTotalRow[]>`
    SELECT
      type,
      DATE_FORMAT(
        DATE_ADD(\`date\`, INTERVAL ${offsetMinutes} MINUTE),
        '%Y-%c'
      ) AS monthKey,
      SUM(amount * exchangeRate) AS total
    FROM \`Transaction\`
    WHERE userId = ${input.userId}
      AND type IN (${Prisma.join(["INCOME", "EXPENSE"] as const)})
      AND \`date\` >= ${input.from}
    GROUP BY type, monthKey
  `;

  const grouped = new Map<"INCOME" | "EXPENSE", { total: number; months: number }>();
  for (const row of rows) {
    if (row.type !== "INCOME" && row.type !== "EXPENSE") {
      continue;
    }
    const current = grouped.get(row.type) ?? { total: 0, months: 0 };
    current.total += asNumber(row.total);
    current.months += 1;
    grouped.set(row.type, current);
  }

  const income = grouped.get("INCOME");
  const expense = grouped.get("EXPENSE");

  return {
    income: income && income.months > 0 ? income.total / income.months : 0,
    expense: expense && expense.months > 0 ? expense.total / expense.months : 0,
  };
}
