# AGENTS.md - Expense Tracker

This file describes the current repository state for AI coding agents working on Expense Tracker, branded in the app as **FinHealth**.

## Project Overview

FinHealth is a personal finance dashboard built with Next.js 16 and React 19. It covers day-to-day money tracking, portfolio valuation, liabilities, loans receivable, deposito balances, personal assets, subscriptions, multi-category budgets, goals, cash-flow forecasting, rule-based insights, month-end net-worth snapshots, PWA install support, browser push notifications, and supplementary Pegadaian gold reference prices.

### Current Feature Set

- **Accounts**: Bank, Cash, Investment, Loan, Credit Card, and Loans Receivable account types.
- **Transactions**: Income, expense, transfer, and liability-payment flows with optional location metadata.
- **Split Expenses**: Manual split rows for expense transactions, with exact amount matching and category-level reporting support.
- **Categories**: System and user-defined categories with icon and color metadata.
- **Investments**: Holdings, buy/sell trade history, realized PnL, Yahoo Finance valuation, account linkage, precious-metal unit conversion, and Pegadaian Tabungan Emas buy/sell reference prices for eligible active gold holdings.
- **Liabilities**: Loan and credit-card payment flows with audit history, overpayment support, and rollback metadata.
- **Debt Payoff Planner**: Avalanche, snowball, or custom payoff plans with APR and minimum-payment inputs, extra monthly budget, debt-free date and interest projections, strategy comparison, and Insights integration.
- **Loans Receivable**: Principal disbursement and repayment flows that move balances without misclassifying principal as income or expense.
- **Recurring Transactions**: Daily, weekly, biweekly, monthly, quarterly, and yearly rules.
- **Subscriptions**: Renewal tracking, trial tracking, recurring-rule linkage, summaries, and detail drawers.
- **Deposito Tracker**: Locked deposito account opening, scheduled interest posting, maturity monitoring, and controlled closing flows back into liquid accounts.
- **Budgets and Goals**: Monthly, quarterly, and yearly budgets with multi-category support, legacy global budget compatibility, plus multi-account savings goals (progress from linked account balances) and profile-level targets.
- **Reports and Analytics**: Category breakdowns, spending trends, income-vs-expense views, frozen month-end net-worth history, forecasting, and a dedicated financial insights surface.
- **Calendar and Pressure Alerts**: Upcoming recurring items, subscription renewals, and bank-balance pressure alerts for the next 30 days.
- **Data Tools**: CSV import with mapping and export support.
- **PWA and Notifications**: Install prompt, offline fallback page, service worker, push subscriptions, notification preferences, and daily notification dispatch cron.
- **Profile Security**: Self-service account deletion, base currency settings, financial targets, and notification settings.

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
| Authentication | Auth.js v5 / NextAuth | 5.0.0-beta.30 |
| State Management | TanStack Query | 5.90+ |
| Tables | TanStack Table | 8.21+ |
| Forms | React Hook Form + Zod | 7.71+ / 4.3+ |
| Charts | Recharts | 3.6+ |
| Icons | Lucide React | 0.562+ |
| Market Data | yahoo-finance2 + Pegadaian reference prices | 3.13+ / external API |
| Push Notifications | web-push | 3.6+ |
| Package Manager | pnpm | 9.x |

## Repository Structure

```text
expense-tracker/
├── certificates/             # Local HTTPS certificates
├── content/
│   └── changelog.md          # In-app changelog content
├── plans/                    # Architecture and implementation notes
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/           # Prisma migrations
├── public/
│   ├── icons/                # PWA icons and favicons
│   ├── offline.html          # Offline fallback page
│   └── sw.js                 # Service worker
├── src/
│   ├── actions/              # Server Actions by feature
│   ├── app/                  # Next.js App Router pages, layouts, API routes, manifest
│   ├── components/           # Feature UI, alerts, dashboard, profile, pwa, ui primitives
│   ├── contexts/             # React contexts
│   ├── generated/            # Prisma generated client output
│   ├── hooks/                # TanStack Query hooks
│   ├── lib/                  # Domain services, encryption, forecasting, insights, notifications
│   ├── scripts/              # Operational scripts
│   ├── types/                # Shared TypeScript types
│   ├── auth.config.ts
│   ├── auth.ts
│   └── middleware.ts
├── AGENTS.md
├── CONTRIBUTING.md
├── README.md
├── components.json
├── eslint.config.mjs
├── next.config.ts
├── nixpacks.toml
├── package.json
├── postcss.config.mjs
├── prisma.config.ts
├── pnpm-workspace.yaml
├── tsconfig.json
└── vercel.json
```

### Current Dashboard Pages

- `/dashboard`
- `/dashboard/accounts`
- `/dashboard/assets`
- `/dashboard/budgets`
- `/dashboard/calendar`
- `/dashboard/categories`
- `/dashboard/data`
- `/dashboard/deposito`
- `/dashboard/goals`
- `/dashboard/insights`
- `/dashboard/investments`
- `/dashboard/liabilities`
- `/dashboard/profile`
- `/dashboard/receivables`
- `/dashboard/recurring`
- `/dashboard/reports`
- `/dashboard/subscriptions`
- `/dashboard/transactions`

### Current API Routes

- `/api/accounts/by-type`
- `/api/auth/[...nextauth]`
- `/api/categories`
- `/api/cron/deposito`
- `/api/cron/monthly-net-worth-snapshots`
- `/api/cron/notifications`
- `/api/cron/pegadaian-gold-prices`
- `/api/cron/recurring`
- `/api/investments/[id]/trades`

## Build and Development Commands

```bash
pnpm install
pnpm dev
pnpm dev:https
pnpm build
pnpm start
pnpm start:https
pnpm lint
pnpm db:migrate:dev
pnpm db:migrate:prod
pnpm prisma generate
pnpm prisma db push
pnpm db:backfill:account-encryption
```

### Command Notes

- `pnpm build` runs `prisma generate && next build`.
- `pnpm dev:https` and `pnpm start:https` use Next.js experimental HTTPS mode.
- `pnpm db:backfill:account-encryption` runs `src/scripts/backfill-account-encryption.ts`.
- There is **no** `postinstall` script. Dependency installation does not automatically run Prisma commands.
- There is **no** dedicated `type-check` script. Use `pnpm build` when build-level type validation matters.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | MySQL/MariaDB connection string | Yes |
| `SHADOW_DATABASE_URL` | Optional shadow database URL for Prisma migrations | No |
| `AUTH_SECRET` | Secret used by Auth.js JWT/session handling | Yes |
| `AUTH_URL` | Base app URL used by auth callbacks and metadata | Yes |
| `CRON_SECRET` | Bearer secret for production cron endpoints | Yes in production |
| `ENCRYPTION_MASTER_KEY` | Base64-encoded 32-byte master key for field encryption | Required for encrypted-field support |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public VAPID key for browser push subscription | Required for web push |
| `VAPID_PRIVATE_KEY` | Private VAPID key for server-side push delivery | Required for web push |
| `VAPID_SUBJECT` | Contact subject for VAPID, usually `mailto:...` or the app URL | Required for web push |

Generate a new encryption key with:

```bash
openssl rand -base64 32
```

## Database Schema

### Key Models

**User**: Auth.js user plus `mainCurrency`, financial targets, encryption metadata, notification preference, push subscriptions, and notification events.

**FinancialAccount**: User-owned account with encrypted-only account text fields (`nameEncrypted`, `descriptionEncrypted`), type, currency, balance, active state, and cross-feature relations.

**Transaction**: Income, expense, transfer, and liability-payment records with currency conversion, optional category, recurring linkage, payment status, optional location metadata, and audit fields.

**TransactionSplit**: Child rows for split expense allocations. Each split has its own amount, optional description, category, and sort order.

**Category**: System and user-defined categories shared across transactions, split rows, budget category scopes, and subscriptions.

**InvestmentAsset**: Holdings with symbol, quantity, average buy price, currency, unit type, optional investment-account linkage, and trade history.

**TradeHistory**: Buy/sell trades with fees, realized PnL, notes encryption, account linkage, and balance snapshots.

**RecurringRule**: Scheduled transaction template with interval, next due date, optional end date, optional account/category linkage, and optional subscription linkage.

**Subscription**: Renewal tracking with billing cycle, status, linked account/category, notes, optional recurring rule, and encrypted companion fields.

**ExchangeRate**: Global FX cache. Do not apply `userId` filters to this table.

**GoldPriceSnapshot**: Global Pegadaian reference-price history containing provider/source identifiers, customer buy/sell prices, unit size, effective date, source timestamp, and fetch timestamp. Do not apply `userId` filters to this table.

**NetWorthSnapshot**: Frozen month-end totals and breakdowns used for historical reporting.

**LiabilityPaymentAudit**: Payment audit log with source/target balance snapshots, execution metadata, and rollback state.

**DebtPlan / DebtPlanItem**: User-owned debt payoff plan with strategy (avalanche, snowball, custom), extra monthly amount, plan currency, and per-liability APR, minimum payment, and optional custom priority.

**Budget**: User-owned budget rules with period, date range, `BudgetScope`, and many-to-many category coverage through `BudgetCategory`. Category-scoped budgets can cover one or more expense categories, while legacy global budgets remain compatible for older all-spending records.

**BudgetCategory**: Join model connecting budgets to one or more expense categories for scoped budget tracking and category usage counts.

**SavingsGoal**: User-owned goal with target amount, optional target date, encrypted descriptive fields, and one or more linked funding accounts through `SavingsGoalAccount`. Progress is derived live from the sum of linked account balances (converted to the user's main currency); there is no manual current-amount ledger.

**SavingsGoalAccount**: Join model connecting a savings goal to one or more `FinancialAccount` sources (Bank, Cash, or Investment).

**PersonalAsset**: Durable owned item with category, manual valuation, purchase metadata, notes, and disposal date.

**PersonalAssetValuation**: Dated valuation history for a personal asset.

**PushSubscription**: Encrypted browser push subscription storage with delivery health metadata.

**NotificationPreference**: User-level push toggle, category toggles, reminder lead times, and budget threshold settings.

**NotificationEvent**: Delivery log and dedupe record for outbound notifications.

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

enum PaymentStatus {
  PENDING,
  PROCESSING,
  COMPLETED,
  FAILED,
  ROLLED_BACK
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

enum RecurringInterval {
  DAILY,
  WEEKLY,
  BIWEEKLY,
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

enum BudgetScope {
  CATEGORIES,
  LEGACY_GLOBAL
}

enum DebtPayoffStrategy {
  AVALANCHE,
  SNOWBALL,
  CUSTOM
}

enum NotificationType {
  TEST,
  SUBSCRIPTION_RENEWAL,
  RECURRING_TRANSACTION_DUE,
  BUDGET_THRESHOLD,
  LOW_CASH_FORECAST,
  MONTHLY_NET_WORTH_SNAPSHOT,
  GOAL_PROGRESS,
  IMPORT_EXPORT_COMPLETION
}
```

### Account Type Semantics

Use `src/lib/account-types.ts` when classifying accounts or normalizing balances.

- `BANK`, `CASH`, `INVESTMENT`, and `LOAN_RECEIVABLE` are asset account types.
- `LOAN` and `CREDIT_CARD` are liability account types.
- `BANK` and `CASH` are liquid funding account types.
- Transfer flows currently allow `BANK`, `CASH`, and `INVESTMENT`.
- Standard transfers require source and destination accounts to use the same currency.
- `LOAN_RECEIVABLE` balances are normalized as positive assets.
- Liability balances are normalized as negative values for net-worth calculations.

## Code Style Guidelines

### TypeScript

- Use strict TypeScript.
- Avoid `any`; prefer `unknown` and narrow it.
- Add explicit parameter and return types where they improve clarity or protect public APIs.
- Use interfaces for object shapes and types for unions or utility composition.

### React Components

- Use functional components.
- Default to Server Components.
- Add `"use client"` only for state, effects, event handlers, browser APIs, or TanStack Query hooks.
- Keep components aligned to existing feature folders.

### Styling

- Use Tailwind CSS utilities and semantic CSS variables from `src/app/globals.css`.
- Use `cn()` from `@/lib/utils` for class merging.
- Follow the existing shadcn/ui New York style and current visual language.
- Prefer Lucide icons.

### File Naming

- Components: PascalCase, for example `NotificationSettingsPanel.tsx`
- Hooks and utilities: camelCase, for example `useNotificationQueries.ts`
- Actions: kebab-case with `-actions`, for example `schedule-pressure-actions.ts`
- Types: kebab-case, for example `trade-history.ts`

### Import Order

1. React and Next.js imports
2. Third-party imports
3. Absolute `@/` imports
4. Relative imports
5. Type imports

## Server Actions Pattern

All mutations and authenticated server-side reads should follow the current action style:

- Start action files with `"use server"`.
- Require `session.user.id` from `auth()` for user-owned operations.
- Validate inputs with Zod before database work.
- Include `userId` in every query for user-owned models.
- Do not add `userId` filters to global reference-data tables such as `ExchangeRate` and `GoldPriceSnapshot`.
- Use Prisma transactions for balance-moving flows such as transactions, transfers, liability payments, trades, and receivable flows.
- Revalidate affected dashboard paths after successful mutations.
- Return `{ success: boolean, data?: T, error?: string }`.
- Handle useful Prisma errors such as `P2002` and `P2025` when it improves the returned message.

## Encryption Pattern

Encryption now has two practical patterns in the repo:

- **Account fields** use `src/lib/account-crypto.ts`.
  - Account names and descriptions are stored only in encrypted form.
  - Use helpers such as `encryptAccountName`, `encryptAccountDescription`, `decryptAccountName`, and `decryptAccountRecords`.
- **Other sensitive fields** use `src/lib/user-encryption.ts`.
  - Many models still use plaintext plus encrypted companion columns.
  - Prefer `encryptUserField`, `decryptUserField`, `encryptCurrentUserField`, and `decryptCurrentUserField`.

Use the field names defined in `FIELD_CLASSIFICATIONS` where applicable, such as:

- `account.name`
- `account.description`
- `transaction.description`
- `transaction.referenceNumber`
- `transactionSplit.description`
- `recurringRule.name`
- `subscription.name`
- `tradeHistory.notes`
- `personalAsset.notes`
- `pushSubscription.endpoint`

If encryption is not configured in development, the user-encryption helpers fall back to plaintext-compatible behavior. Back up the database before running encryption migration or backfill scripts.

## TanStack Query Pattern

Client-side server-state access lives in `src/hooks`.

- Define feature key factories such as `accountKeys`, `transactionKeys`, `notificationKeys`, and `upcomingBankPressureKeys`.
- Server Actions return `{ success, data, error }`; query and mutation functions should throw when `success` is false.
- Invalidate related feature keys after mutations, especially for balance-moving workflows.
- `QueryProvider` configures shared React Query defaults and DevTools.

Notable current hooks include:

- `useNotificationQueries.ts` for push subscription and preference flows
- `useUpcomingBankPressure.ts` for schedule-pressure alerts
- `useCashFlowForecast.ts` for projected liquid balance reporting
- `useNetWorthSnapshotQueries.ts` for frozen month-end reporting

## Feature-Specific Rules

### Transactions and Splits

- Split transactions are supported only for `EXPENSE` transactions.
- Split rows must sum exactly to the parent amount in minor units for the transaction currency.
- Split rows require at least two rows and at most twenty.
- Add and Edit Transaction account selectors should only offer active accounts for new selections.
- Existing transactions tied to an inactive account may still be edited without forcing an account replacement, as long as the inactive account is not newly selected.
- Use `src/lib/transaction-split-validation.ts` for normalization and validation.
- Use `src/lib/transaction-allocation-service.ts` when reports or insights need split-aware allocation rows.

### Transfers and Balance Integrity

- Standard transfers require distinct source and destination accounts.
- Standard transfers are limited to transfer-capable accounts from `src/lib/account-types.ts`.
- Source and destination accounts must share the same currency.
- Liability and receivable flows have separate dedicated actions and validation rules.

### Budgets

- New budgets must select at least one owned `EXPENSE` category.
- Budget category coverage is many-to-many through `BudgetCategory`; the same category can intentionally contribute to multiple budgets.
- Legacy global budgets remain supported for older category-less records and continue to represent all spending until converted.
- Category-scoped budget progress, comparisons, forecasting, and transaction matching must aggregate spend across the full selected category set.

### Notifications and PWA

- Service worker registration is handled by `src/components/pwa/ServiceWorkerRegistrar.tsx`.
- The service worker lives at `public/sw.js`.
- Offline fallback content lives at `public/offline.html`.
- Notification settings UI lives on `/dashboard/profile`.
- Daily push dispatch is handled by `/api/cron/notifications`.
- Notification payloads must only deep-link to safe `/dashboard` paths.

### Market and FX Data

- Yahoo Finance access lives in `src/lib/finance-service.ts`.
- Quote and FX fetches must degrade gracefully.
- Precious-metal holdings can require `TROY_OUNCE` to `GRAM` conversion through `src/lib/unit-conversion.ts`.
- Forecasting and insight code should surface missing FX warnings instead of failing whole views.

### Pegadaian Gold Reference Prices

- Pegadaian access and response normalization live in `src/lib/pegadaian-gold-service.ts`.
- Validate external responses with the existing Zod schema before storing any values.
- Store normalized provider results in `GoldPriceSnapshot`; UI and valuation code should consume the latest stored snapshot rather than call Pegadaian directly.
- `GoldPriceSnapshot` is global reference data and must not receive `userId` ownership filters.
- The current integration attaches Pegadaian prices only to active holdings whose normalized symbol is `GC=F`.
- Pegadaian customer buy and sell prices are supplementary reference values only. Portfolio value, day change, cost basis, and P&L must continue to use Yahoo Finance market prices.
- Missing, stale, invalid, or unavailable Pegadaian data must degrade to no reference-price display without breaking portfolio valuation.
- The refresh endpoint is `/api/cron/pegadaian-gold-prices` and uses the shared `CRON_SECRET` bearer authorization pattern.

## Authentication

- Auth.js v5 with JWT sessions and Prisma adapter.
- Credentials provider uses email and password.
- Middleware protects `/dashboard/*` and redirects authenticated users away from `/login` and `/register`.
- The app expects `session.user.id` to be available in Server Actions.

## Current UI Primitive Inventory

The project currently includes these `src/components/ui` primitives:

- `alert`
- `avatar`
- `badge`
- `button`
- `calendar`
- `card`
- `checkbox`
- `command`
- `dialog`
- `dropdown-menu`
- `form`
- `input`
- `label`
- `money-input`
- `popover`
- `progress`
- `select`
- `separator`
- `sheet`
- `skeleton`
- `switch`
- `table`
- `tabs`
- `tooltip`

## Changelog Updates

- Update `content/changelog.md` for user-facing changes.
- Write entries in product language, not implementation language.
- Put the newest release at the top.
- For maintenance-only work, say so plainly.

## Security Considerations

- Require auth for dashboard routes and user-owned data access.
- Validate user input with Zod or feature-specific validators.
- Use Prisma ORM instead of building raw SQL.
- Include `userId` filters on all user-owned models.
- Do not add `userId` filters to global reference-data tables such as `ExchangeRate` and `GoldPriceSnapshot`.
- Keep notification deep links on trusted in-app dashboard paths.
- Protect cron routes with the shared bearer-secret pattern in production.
- Use Prisma transactions for any balance-changing workflow.
- Respect encrypted field helpers instead of reading or writing encrypted columns ad hoc.

## Testing and Verification

The repo currently relies on linting plus manual verification.

Run the most relevant checks:

```bash
pnpm lint
pnpm build
git diff --check
```

Manual verification should cover the touched feature area plus affected cross-feature data:

- Authentication and protected-route behavior
- Account CRUD and encrypted account-name display
- Transaction creation, editing, transfers, split expenses, and location metadata
- Transaction add/edit account selectors excluding inactive accounts while preserving historical edits on already-linked inactive accounts
- Liability payments, audit trails, rollback behavior, and overpayment handling
- Debt payoff planner create/edit, avalanche vs snowball comparison, live balance projection, and related Insights cards
- Loans Receivable disbursement and repayment flows
- Investment buys, sells, realized PnL, valuation fallback behavior, and unit conversion
- Pegadaian cron authorization, response validation, snapshot persistence, no-snapshot fallback, and display only on active `GC=F` positions
- Confirmation that Pegadaian reference prices do not change portfolio value, cost basis, day change, or P&L
- Subscription CRUD, recurring-rule linkage, renewal summaries, and trial behavior
- Recurring processing and schedule-pressure alerts
- Budget progress, goal progress, profile targets, and dashboard cards
- Net-worth snapshot generation and historical reporting
- Cash-flow forecasting and financial insights under missing-FX conditions
- Push notification opt-in, test notification flow, and notification preferences
- PWA install prompt and offline fallback behavior
- Import/export and category management

## Deployment

### Vercel Cron Jobs

`vercel.json` currently schedules:

- `/api/cron/monthly-net-worth-snapshots` at `0 17 * * *`
- `/api/cron/recurring` at `15 17 * * *`
- `/api/cron/notifications` at `30 17 * * *`
- `/api/cron/deposito` at `0 18 * * *`
- `/api/cron/pegadaian-gold-prices` at `45 17 * * *`

The Pegadaian reference-price refresh runs once per day at `17:45 UTC`, and deposito interest processing runs once per day at `18:00 UTC`.

### Required Production Configuration

- Set `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `CRON_SECRET`, `ENCRYPTION_MASTER_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`.
- Run `pnpm db:migrate:prod` before or during deployment.

### Self-Hosting

```bash
pnpm build
pnpm start
```

Use HTTPS if you need PWA install and web-push behavior outside localhost.
