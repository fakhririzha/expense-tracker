# AGENTS.md - Expense Tracker

This file contains essential information for AI coding agents working on the Expense Tracker project.

## Project Overview

**Expense Tracker** (branded as "FinHealth") is a personal finance management application built with Next.js 16 and React 19. It provides account and transaction tracking, investment portfolio valuation, liabilities, loans receivable, personal assets, subscriptions, forecasting, multi-currency reporting, and financial dashboard insights.

### Key Features

- **Account Management**: Create and manage Bank, Cash, Investment, Loan, Credit Card, and Loans Receivable accounts.
- **Transaction Tracking**: Record income, expenses, transfers, liability payments, and optional location metadata.
- **Category Management**: Maintain system and user-defined transaction categories.
- **Investment Portfolio**: Track holdings, trade history, realized/unrealized PnL, account linkage, and unit conversions for stocks and precious metals.
- **Yahoo Finance Pricing**: Fetch market and FX data with caching, fallback values, batching/rate-limit awareness, and user-friendly error handling.
- **Personal Assets**: Track durable owned items with dated manual valuations and disposal history.
- **Liabilities**: Record loan and credit-card payments with audit trails, overpayment handling, and rollback support.
- **Loans Receivable**: Track principal owed to the user and move funds through disbursement and repayment flows without treating principal as income or expense.
- **Recurring Transactions**: Automate regular transactions with daily, weekly, biweekly, monthly, quarterly, and yearly schedules.
- **Subscriptions**: Track recurring subscriptions, billing cycles, trial end dates, renewals, and optional recurring-rule linkage.
- **Multi-Currency Support**: Track finances across currencies with exchange-rate conversion.
- **Budgeting**: Create and monitor monthly, quarterly, and yearly budgets.
- **Savings Goals and Profile Targets**: Track savings goals plus user-level retirement and monthly budget targets.
- **Forecasting and Insights**: Analyze projected liquid-cash balances plus cross-feature financial insights in dashboard and reports.
- **Reports, Calendar, and Data Tools**: View financial reports, upcoming calendar events, month-end net-worth snapshots, and import/export data.
- **Financial Dashboard**: Executive overview with net worth, wealth health score, monthly budget status, retirement progress, sidebar metrics, and changelog visibility.
- **Profile Security**: Support self-service account deletion from the profile page.

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js | 16.1.2 |
| UI Library | React / React DOM | 19.2.3 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| UI Components | shadcn/ui (New York style) + Radix UI | - |
| Database | MySQL / MariaDB | 8.0+ |
| ORM | Prisma | 7.4.1 |
| Authentication | Auth.js v5 (NextAuth) | 5.0.0-beta.30 |
| State Management | TanStack Query (React Query) | 5.90+ |
| Tables | TanStack Table | 8.21+ |
| Forms | React Hook Form + Zod | 7.71+ / 4.3+ |
| Charts | Recharts | 3.6+ |
| Icons | Lucide React | 0.562+ |
| Market Data | yahoo-finance2 | 3.13+ |
| Package Manager | pnpm | 9.x |

## Project Structure

```text
expense-tracker/
├── prisma/
│   ├── schema.prisma          # Database schema definition
│   └── migrations/            # Database migrations
├── public/                    # Static assets
├── content/
│   └── changelog.md           # In-dashboard changelog content
├── plans/                     # Implementation and architecture notes
├── src/
│   ├── actions/               # Server Actions and server-side reads
│   │   ├── account-actions.ts
│   │   ├── auth-actions.ts
│   │   ├── budget-actions.ts
│   │   ├── calendar-actions.ts
│   │   ├── category-actions.ts
│   │   ├── exchange-rate-actions.ts
│   │   ├── export-actions.ts
│   │   ├── forecast-actions.ts
│   │   ├── goal-actions.ts
│   │   ├── import-actions.ts
│   │   ├── insight-actions.ts
│   │   ├── investment-actions.ts
│   │   ├── liability-payment-actions.ts
│   │   ├── net-worth-snapshot-actions.ts
│   │   ├── personal-asset-actions.ts
│   │   ├── profile-actions.ts
│   │   ├── receivable-actions.ts
│   │   ├── recurring-actions.ts
│   │   ├── report-actions.ts
│   │   ├── subscription-actions.ts
│   │   └── transaction-actions.ts
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/            # Login/register route group
│   │   ├── (dashboard)/       # Protected dashboard route group
│   │   │   └── dashboard/
│   │   │       ├── accounts/
│   │   │       ├── assets/
│   │   │       ├── budgets/
│   │   │       ├── calendar/
│   │   │       ├── categories/
│   │   │       ├── data/
│   │   │       ├── goals/
│   │   │       ├── investments/
│   │   │       ├── liabilities/
│   │   │       ├── profile/
│   │   │       ├── receivables/
│   │   │       ├── recurring/
│   │   │       ├── reports/
│   │   │       ├── subscriptions/
│   │   │       ├── transactions/
│   │   │       └── page.tsx   # Main dashboard
│   │   ├── api/               # API routes
│   │   │   ├── accounts/by-type/route.ts
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── categories/route.ts
│   │   │   ├── cron/monthly-net-worth-snapshots/route.ts
│   │   │   ├── cron/recurring/route.ts
│   │   │   └── investments/[id]/trades/route.ts
│   │   ├── globals.css        # Tailwind 4 globals and semantic CSS variables
│   │   ├── layout.tsx         # Root layout with providers
│   │   └── page.tsx           # Landing page
│   ├── components/            # React components by feature area
│   │   ├── accounts/
│   │   ├── assets/
│   │   ├── budgets/
│   │   ├── calendar/
│   │   ├── categories/
│   │   ├── dashboard/
│   │   ├── export/
│   │   ├── forecast/
│   │   ├── goals/
│   │   ├── insights/
│   │   ├── investments/
│   │   ├── liability/
│   │   ├── profile/
│   │   ├── providers/
│   │   ├── receivables/
│   │   ├── recurring/
│   │   ├── reports/
│   │   ├── subscriptions/
│   │   ├── transactions/
│   │   └── ui/                # shadcn/ui components
│   ├── generated/             # Prisma generated client output
│   ├── contexts/
│   │   └── CurrencyContext.tsx
│   ├── hooks/                 # TanStack Query custom hooks
│   │   ├── useAccountQueries.ts
│   │   ├── useBudgetQueries.ts
│   │   ├── useCalendarQueries.ts
│   │   ├── useCashFlowForecast.ts
│   │   ├── useCategoryQueries.ts
│   │   ├── useExchangeRateQuery.ts
│   │   ├── useFinancialInsightQueries.ts
│   │   ├── useGoalQueries.ts
│   │   ├── useInvestmentQueries.ts
│   │   ├── useLiabilityQueries.ts
│   │   ├── useNetWorthSnapshotQueries.ts
│   │   ├── usePersonalAssetQueries.ts
│   │   ├── useReceivableQueries.ts
│   │   ├── useRecurringQueries.ts
│   │   ├── useReportQueries.ts
│   │   ├── useSidebarMetrics.ts
│   │   ├── useSubscriptionQueries.ts
│   │   ├── useTradeHistory.ts
│   │   └── useTransactionQueries.ts
│   ├── lib/                   # Utility libraries and domain services
│   │   ├── account-types.ts
│   │   ├── db.ts
│   │   ├── encryption.ts
│   │   ├── executive-service.ts
│   │   ├── executive-types.ts
│   │   ├── finance-service.ts
│   │   ├── financial-insights/
│   │   ├── forecasting/
│   │   ├── investment-valuation-service.ts
│   │   ├── investment-validation.ts
│   │   ├── liability-payment-validation.ts
│   │   ├── net-worth-calculation.ts
│   │   ├── unit-conversion.ts
│   │   ├── user-encryption.ts
│   │   └── utils.ts
│   ├── scripts/
│   │   ├── backfill-net-worth-snapshots.ts
│   │   └── migrate-encryption.ts
│   ├── types/
│   │   ├── next-auth.d.ts
│   │   ├── personal-assets.ts
│   │   └── trade-history.ts
│   ├── auth.config.ts
│   ├── auth.ts
│   └── middleware.ts
├── components.json            # shadcn/ui configuration
├── next.config.ts             # Next.js configuration with React Compiler
├── package.json
├── postcss.config.mjs         # Tailwind CSS PostCSS config
├── prisma.config.ts           # Prisma 7 configuration
├── pnpm-workspace.yaml
├── tsconfig.json
└── vercel.json                # Vercel cron configuration
```

## Build and Development Commands

```bash
# Install dependencies
pnpm install

# Development server
pnpm dev

# Build for production
pnpm build            # Runs prisma generate && next build

# Start production server
pnpm start            # Runs next start

# Lint code
pnpm lint             # Runs eslint

# Database operations
pnpm db:migrate:dev   # Runs npx prisma@^7.4.1 migrate dev
pnpm db:migrate:prod  # Runs npx prisma@^7.4.1 migrate deploy
pnpm prisma generate
pnpm prisma db push
```

There is no `postinstall` script in the current `package.json`. Do not assume dependency installation automatically pushes the database schema or generates Prisma clients.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | MySQL/MariaDB connection string, e.g. `mysql://user:pass@localhost:3306/expense_tracker` | Yes |
| `SHADOW_DATABASE_URL` | Optional shadow database URL for Prisma migrations | No |
| `AUTH_SECRET` | Secret key for JWT signing, generated with `openssl rand -base64 32` | Yes |
| `AUTH_URL` | Base URL for auth callbacks, usually `http://localhost:3000` locally | Yes |
| `CRON_SECRET` | Bearer token for securing cron endpoints in production | Yes in production |
| `ENCRYPTION_MASTER_KEY` | Base64-encoded 32-byte key for field-level encryption and encryption migration | Required for encrypted field support |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public VAPID key used by the browser when creating push subscriptions | Required for web push |
| `VAPID_PRIVATE_KEY` | Private VAPID key used only on the server for Web Push authentication | Required for web push |
| `VAPID_SUBJECT` | Contact subject for VAPID, usually `mailto:...` or the deployed app URL | Required for web push |

Generate an encryption key with:

```bash
openssl rand -base64 32
```

## Database Schema

### Key Models

**User**: Core user entity with Auth.js integration, `mainCurrency`, financial targets (`retirementTarget`, `monthlyBudget`), and encryption metadata (`encryptionSalt`, `encryptionVersion`).

**FinancialAccount**: User financial accounts with type, currency, balance, active state, encrypted companion fields for sensitive text, and relations to transactions, investments, trades, and savings goals.

**Transaction**: Financial transactions for income, expenses, transfers, and liability payments. Includes currency conversion, optional category, recurring-rule linkage, payment audit fields, encrypted companion fields, and location metadata (`location`, `latitude`, `longitude`, `googleMapsLink`).

**Category**: System and user-defined transaction categories with icon/color metadata, transaction type, transactions, and budgets.

**InvestmentAsset**: Stock, ETF, crypto, or precious-metal holdings with `symbol`, `quantity`, `avgBuyPrice`, `currency`, `unitType`, and optional investment-account linkage.

**TradeHistory**: Buy/sell trades with fees, realized PnL, notes encryption, account linkage, unit type, and account balance snapshots.

**RecurringRule**: Automated recurring transaction templates with interval, next due date, optional end date, category/account linkage, and encrypted companion fields.

**Subscription**: User-owned subscription records with billing cycle, status, renewal dates, optional account/category linkage, optional recurring-rule linkage, and encrypted companion fields.

**ExchangeRate**: Global cached exchange rates between currencies. This is not user-owned and should not receive `userId` filters.

**NetWorthSnapshot**: Month-end net-worth snapshots with account-class breakdowns, FX metadata, and calculation versions for historical reporting and trends.

**LiabilityPaymentAudit**: Audit trail for liability payments, including source/target account snapshots, execution metadata, encrypted request metadata, and rollback fields.

**Budget**: Budgeting rules by category and period with active state and user ownership.

**SavingsGoal**: Savings targets with progress, target date, optional linked account, and encrypted companion fields.

**PersonalAsset**: Durable owned items with category, current manual valuation, purchase metadata, disposal date, notes encryption, and valuation history.

**PersonalAssetValuation**: Dated valuation records for personal assets.

### Important Enums

```typescript
enum AccountType {
  BANK,
  CASH,
  INVESTMENT,
  LOAN,
  CREDIT_CARD,
  LOAN_RECEIVABLE
}

enum TransactionType {
  INCOME,
  EXPENSE,
  TRANSFER,
  LIABILITY_PAYMENT
}

enum TradeType {
  BUY,
  SELL
}

enum UnitType {
  UNIT,
  TROY_OUNCE,
  GRAM
}

enum PersonalAssetCategory {
  ELECTRONICS,
  VEHICLE,
  PROPERTY,
  FURNITURE,
  JEWELRY,
  COLLECTIBLE,
  EQUIPMENT,
  OTHER
}

enum RecurringInterval {
  DAILY,
  WEEKLY,
  BIWEEKLY,
  MONTHLY,
  QUARTERLY,
  YEARLY
}

enum SubscriptionBillingCycle {
  WEEKLY,
  MONTHLY,
  QUARTERLY,
  YEARLY
}

enum SubscriptionStatus {
  ACTIVE,
  TRIAL,
  PAUSED,
  CANCELLED,
  EXPIRED
}

enum BudgetPeriod {
  MONTHLY,
  QUARTERLY,
  YEARLY
}

enum PaymentStatus {
  PENDING,
  PROCESSING,
  COMPLETED,
  FAILED,
  ROLLED_BACK
}
```

### Account Type Semantics

Use `src/lib/account-types.ts` when working with account classification:

- `BANK`, `CASH`, `INVESTMENT`, and `LOAN_RECEIVABLE` are asset account types.
- `LOAN` and `CREDIT_CARD` are liability account types.
- `BANK` and `CASH` are liquid funding account types.
- `LOAN_RECEIVABLE` balances are normalized as positive assets.
- Liability balances are normalized as negative values for net-worth calculations.

## Code Style Guidelines

### TypeScript

- Use strict TypeScript configuration.
- Define explicit types for function parameters and return values when the type is not obvious from context.
- Avoid `any`; use `unknown` with type guards when necessary.
- Use interfaces for object shapes and types for unions/intersections.

### React Components

- Use functional components with hooks.
- Use Server Components by default.
- Add `'use client'` only for client-side features such as state, effects, browser APIs, event handlers, or TanStack Query hooks.
- Keep components focused and single-responsibility.

### Styling

- Use Tailwind CSS utility classes and semantic CSS variables from `src/app/globals.css`.
- Use the `cn()` utility from `@/lib/utils` for conditional class merging.
- Follow the existing shadcn/ui New York style and `components.json` aliases.
- Prefer Lucide icons for button/iconography needs.

```tsx
import { cn } from "@/lib/utils";

<button
  className={cn(
    "rounded-md px-4 py-2",
    "bg-primary text-primary-foreground",
    "hover:bg-primary/90",
    isLoading && "cursor-not-allowed opacity-50"
  )}
>
  Save
</button>;
```

### File Naming Conventions

- **Components**: PascalCase, e.g. `AddTransactionDialog.tsx`.
- **Utilities and hooks**: camelCase, e.g. `useExchangeRateQuery.ts`.
- **Actions**: kebab-case with `-actions` suffix, e.g. `transaction-actions.ts`.
- **Types**: kebab-case, e.g. `trade-history.ts`.

### Import Organization

1. React/Next.js imports
2. Third-party library imports
3. Absolute imports (`@/` aliases)
4. Relative imports
5. Type imports

## Server Actions Pattern

All mutations and authenticated server-side reads should follow the established Server Action style:

- Start action files with `"use server"`.
- Check `auth()` and require `session.user.id` for user-owned operations.
- Validate inputs with Zod before database work.
- Include `userId` in every query for user-owned models.
- Do not add `userId` filters to global tables such as `ExchangeRate`.
- Use Prisma transactions for balance-moving workflows, especially transactions, transfers, liabilities, investments, and loans receivable.
- Revalidate affected dashboard paths after mutations.
- Return standardized results: `{ success: boolean, data?: T, error?: string }`.
- In catch blocks, identify specific Prisma errors such as `P2002` and `P2025` where useful and return targeted, user-friendly messages.

```typescript
"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
});

export type InputType = z.infer<typeof schema>;

export async function createSomething(data: InputType) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const validated = schema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0].message };
    }

    const result = await prisma.model.create({
      data: { ...validated.data, userId: session.user.id },
    });

    revalidatePath("/dashboard");

    return { success: true, data: result };
  } catch (error) {
    console.error("Create something error:", error);
    return { success: false, error: "Failed to create item" };
  }
}
```

## Encryption Pattern

Field-level encryption lives in `src/lib/encryption.ts` and `src/lib/user-encryption.ts`.

- Sensitive text fields generally have plaintext and encrypted companion columns, such as `description` and `descriptionEncrypted`.
- Prefer `encryptUserField`, `decryptUserField`, `encryptCurrentUserField`, and `decryptCurrentUserField` over direct crypto calls.
- Use the field names defined in `FIELD_CLASSIFICATIONS` where applicable, e.g. `transaction.description`, `account.description`, `tradeHistory.notes`, and `personalAsset.notes`.
- If encryption is not configured in development, `encryptUserField` and `decryptUserField` return values as-is for compatibility.
- Before running `src/scripts/migrate-encryption.ts`, back up the database and set `ENCRYPTION_MASTER_KEY`.

## TanStack Query Pattern

Client-side data fetching uses TanStack Query hooks from `src/hooks`.

- Define query key factories per feature, e.g. `accountKeys`, `transactionKeys`, and `receivableKeys`.
- Server Actions return `{ success, data, error }`; query/mutation functions should throw `new Error(result.error)` when `success` is false.
- Mutations should invalidate their feature keys and any related cross-feature keys, such as accounts and transactions after balance-moving operations.
- `QueryProvider` sets financial-data defaults: 5-minute `staleTime`, 10-minute `gcTime`, retries, reconnect/focus refetching, and React Query DevTools.

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createItem, getItems, type ItemInput } from "@/actions/feature-actions";

export const featureKeys = {
  all: ["features"] as const,
  lists: () => [...featureKeys.all, "list"] as const,
  list: (filter?: string) => [...featureKeys.lists(), { filter }] as const,
};

export function useItems(filter?: string) {
  return useQuery({
    queryKey: featureKeys.list(filter),
    queryFn: async () => {
      const result = await getItems(filter);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ItemInput) => {
      const result = await createItem(data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: featureKeys.all });
    },
  });
}
```

## Authentication

- **Strategy**: Auth.js v5 with JWT sessions and Prisma adapter.
- **Provider**: Credentials provider using email/password and bcrypt.
- **Middleware**: Protects `/dashboard/*` routes and redirects authenticated users away from `/login` and `/register`.
- **Session user ID**: Stored in JWT and exposed as `session.user.id`.

Access the current user in Server Actions:

```typescript
import { auth } from "@/auth";

const session = await auth();
const userId = session?.user?.id;
```

## Key Utilities

### `cn()`

Located in `src/lib/utils.ts`. Combines `clsx` and `tailwind-merge` for conditional Tailwind classes.

### Formatters

Located in `src/lib/utils.ts`:

- `formatCurrency(amount, currency, locale)` - Format numbers as currency.
- `formatNumber(value, locale)` - Format numbers with two decimal places.
- `formatDate(date, options)` - Format dates with Indonesian locale defaults.
- `formatPercentage(value, decimals)` - Format percentages with sign.
- `getInitials(name)` - Get up to two uppercase initials.

### Domain Services

- `src/lib/account-types.ts` - Account classification and balance normalization.
- `src/lib/finance-service.ts` - Yahoo Finance quotes, historical data, search, exchange rates, and investment metrics.
- `src/lib/financial-insights/*` - Insight generation, thresholds, date utilities, and currency normalization.
- `src/lib/forecasting/*` - Cash-flow forecasting, projected events, risk scoring, and forecast summaries.
- `src/lib/investment-valuation-service.ts` - Portfolio valuation in display currency.
- `src/lib/net-worth-calculation.ts`, `src/lib/net-worth-snapshot-service.ts`, and related `src/lib/net-worth-*` files - Month-end net-worth snapshot calculations, persistence, and reporting helpers.
- `src/lib/unit-conversion.ts` - Unit conversion for precious metals.
- `src/lib/executive-service.ts` and `src/lib/executive-types.ts` - Dashboard metrics and financial health calculations.
- `src/lib/liability-payment-validation.ts` and `src/lib/investment-validation.ts` - Domain validation helpers.
- `src/lib/subscription-utils.ts` and `src/lib/subscription-constants.ts` - Subscription status, billing-cycle, and filter helpers.

### Prisma Client

Located in `src/lib/db.ts`. Uses the Prisma 7 generated client and MariaDB adapter:

```typescript
import { PrismaClient } from "@/generated/prisma/client/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
```

## Common Patterns

### Route Groups

- `(auth)` - Login/register pages without dashboard sidebar.
- `(dashboard)` - Protected dashboard pages with shared layout/sidebar.

### Data Fetching

- **Server Components**: Fetch directly with Prisma or call Server Actions when appropriate.
- **Client Components**: Use TanStack Query hooks from `@/hooks/use*Queries`.

### Form Handling

- Use React Hook Form with Zod resolvers.
- Keep validation schemas in action files or nearby domain validation modules.
- Re-export input types from action files for form components.

### Financial Data

- Yahoo Finance calls should include caching and graceful error handling.
- Use batched fetches and small delays where needed to reduce rate-limit pressure.
- Never assume live quote or FX data is available; handle null/error results and show usable fallback UI.
- Precious-metal prices may need troy-ounce to gram conversion via `unit-conversion.ts`.
- Forecasting and insight logic should degrade gracefully when FX conversions are unavailable and should surface warnings rather than failing the whole feature.

## Changelog Updates

- Update `content/changelog.md` whenever a change is user-facing enough to matter in release notes.
- Write changelog entries in product language, focusing on features, user-visible improvements, and outcomes rather than implementation details, component names, CSS utilities, or refactors.
- Keep each version entry concise, usually two to four bullets, and place the newest version at the top.
- If a release is mostly internal cleanup with little user impact, say that plainly as a maintenance release instead of overstating it.
- When summarizing UI work, describe the experience improvement such as better mobile layout, clearer navigation, smoother forms, or more consistent styling.

## Security Considerations

- **Authentication and CSRF**: Auth.js handles session security and CSRF protections.
- **Input Validation**: Validate all user input with Zod or domain-specific validation helpers.
- **SQL Injection Prevention**: Use Prisma ORM queries; do not build raw SQL from user input.
- **XSS Protection**: React escapes rendered values by default; avoid unsafe HTML unless explicitly sanitized.
- **Route Protection**: Middleware checks authentication for dashboard routes.
- **Cron Endpoints**: `/api/cron/recurring`, `/api/cron/monthly-net-worth-snapshots`, and `/api/cron/notifications` require `CRON_SECRET` bearer auth in production.
- **User Isolation**: All queries for user-owned models must include `userId`. Do not apply this to global tables like `ExchangeRate`.
- **Encryption**: Use encrypted companion fields and user encryption helpers for sensitive text and request metadata.
- **Balance Integrity**: Balance-changing flows must use Prisma transactions and validate ownership of every involved account.

## Testing

The project currently relies on linting plus manual verification. Before submitting functional changes, run targeted checks and manually verify the affected flows:

- Authentication and protected-route behavior.
- Account CRUD and account type normalization.
- Transaction creation/editing, transfers, location metadata, and balance updates.
- Liability payments, overpayments, audit trails, and rollback behavior.
- Loans Receivable disbursement and repayment flows.
- Investment buy/sell trades, realized/unrealized PnL, unit conversions, and valuation fallback behavior.
- Currency conversion and exchange-rate caching.
- Personal asset valuation and disposal history.
- Subscription tracking, recurring-rule linkage, renewal/trial summaries, and subscription forecast integration.
- Recurring transaction processing.
- Net-worth snapshot creation, trend reporting, and cron behavior.
- Cash-flow forecasting assumptions, warnings, and projected event timelines.
- Financial insights, especially cross-feature comparisons and multi-currency edge cases.
- Budgets, goals, profile targets, dashboard metrics, reports, and sidebar summaries.
- Import/export and category management.

For doc-only changes, `git diff --check` is usually sufficient unless the change touches generated docs or Markdown rendering behavior.

## Deployment

### Vercel Deployment

- `vercel.json` configures `/api/cron/monthly-net-worth-snapshots` at `0 0 * * *`, `/api/cron/recurring` at `15 0 * * *`, and `/api/cron/notifications` at `30 0 * * *`.
- Ensure `CRON_SECRET`, `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `ENCRYPTION_MASTER_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` are set in the deployment environment.

### Database Migration on Production

```bash
pnpm db:migrate:prod
```

### Self-Hosting

```bash
pnpm build
pnpm start
```

## Available shadcn/ui Components

The project currently includes these shadcn/ui components:

- alert, avatar, badge, button, calendar, card, checkbox
- command, dialog, dropdown-menu, form, input, label
- popover, progress, select, separator, sheet, skeleton
- switch, table, tabs, tooltip

Add new components with:

```bash
npx shadcn@latest add <component-name>
```
