# Expense Tracker

Expense Tracker, branded in the app as **FinHealth**, is a personal finance dashboard built with Next.js 16 and React 19. It tracks accounts, transactions, investments, liabilities, loans receivable, personal assets, subscriptions, budgets, goals, recurring transactions, multi-currency reporting, and financial health metrics.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Usage](#usage)
- [API and Server Actions](#api-and-server-actions)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [License](#license)
- [Acknowledgments](#acknowledgments)

## Overview

FinHealth is an all-in-one financial workspace for personal money management. It combines day-to-day expense tracking with portfolio valuation, debt tracking, loans receivable, personal asset valuations, and dashboard-level metrics such as net worth, monthly budget status, wealth health, and retirement progress.

### Value Proposition

- **Unified Financial View**: Manage cash, bank, investment, liability, credit-card, and receivable accounts in one place.
- **Transaction Context**: Record income, expenses, transfers, liability payments, categories, recurring rules, and optional location metadata.
- **Portfolio Tracking**: Track holdings, buy/sell trades, realized and unrealized PnL, account linkage, and precious-metal unit conversions.
- **Multi-Currency Reporting**: Convert account, investment, and asset values into the user's main currency.
- **Manual Asset Valuations**: Maintain dated valuation history for owned items such as electronics, vehicles, property, collectibles, and equipment.
- **Financial Planning**: Monitor budgets, savings goals, retirement targets, monthly budget targets, subscription renewals, and forward-looking cash pressure.
- **Secure Data Handling**: Use Auth.js sessions, Prisma user isolation, and optional field-level encryption for sensitive text fields.

## Features

| Feature | Description |
|---------|-------------|
| **Account Management** | Bank, Cash, Investment, Loan, Credit Card, and Loans Receivable accounts |
| **Transactions** | Income, expenses, transfers, liability payments, categories, dates, and optional location metadata |
| **Categories** | User-owned category management with transaction-type filters |
| **Investments** | Holdings, trades, account linkage, realized/unrealized PnL, Yahoo Finance pricing, and unit conversion |
| **Personal Assets** | Durable item tracking with manual valuation history and disposal dates |
| **Liabilities** | Liability payments with overpayment handling, audit trails, and rollback support |
| **Loans Receivable** | Disbursement and repayment flows for principal owed to the user |
| **Recurring Transactions** | Daily, weekly, biweekly, monthly, quarterly, and yearly transaction automation |
| **Subscriptions** | Subscription tracking, renewal calendars, trial monitoring, recurring-rule linkage, and cost summaries |
| **Budgets and Goals** | Budget monitoring, savings goals, and profile-level financial targets |
| **Reports and Insights** | Category breakdowns, trends, month-end net-worth snapshots, financial insights, and cash-flow forecasting |
| **Calendar** | Upcoming recurring items, renewals, and financial events |
| **Data Tools** | Import/export workflows for financial data |
| **Dashboard** | Net worth, wealth health score, monthly budget status, retirement progress, sidebar metrics, and changelog dialog |
| **Profile and Security** | Main currency and target settings plus self-service account deletion |

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js | 16.1.2 |
| UI Library | React / React DOM | 19.2.3 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| Components | shadcn/ui New York style + Radix UI | - |
| Database | MySQL / MariaDB | 8.0+ |
| ORM | Prisma | 7.4.1 |
| Authentication | Auth.js v5 / NextAuth | 5.0.0-beta.30 |
| Server State | TanStack Query | 5.90+ |
| Tables | TanStack Table | 8.21+ |
| Forms | React Hook Form + Zod | 7.71+ / 4.3+ |
| Charts | Recharts | 3.6+ |
| Icons | Lucide React | 0.562+ |
| Market Data | yahoo-finance2 | 3.13+ |
| Package Manager | pnpm | 9.x |

## Prerequisites

- Node.js 20.x or higher
- pnpm 9.x or higher
- MySQL or MariaDB 8.0+
- Git

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/fakhririzha/expense-tracker.git
cd expense-tracker
```

### 2. Install Dependencies

```bash
pnpm install
```

There is no `postinstall` script in the current project, so installation does not automatically run Prisma commands.

### 3. Create `.env`

Create `.env` in the project root and add the required variables:

```bash
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/expense_tracker"
AUTH_SECRET="replace-with-openssl-output"
AUTH_URL="http://localhost:3000"
CRON_SECRET="replace-for-production-cron"
ENCRYPTION_MASTER_KEY="replace-with-openssl-output"
NEXT_PUBLIC_VAPID_PUBLIC_KEY="replace-with-web-push-public-key"
VAPID_PRIVATE_KEY="replace-with-web-push-private-key"
VAPID_SUBJECT="mailto:you@example.com"
```

Generate secrets with:

```bash
openssl rand -base64 32
```

### 4. Set Up the Database

Create the database:

```sql
CREATE DATABASE expense_tracker;
```

Run migrations and generate the Prisma client:

```bash
pnpm db:migrate:dev
pnpm prisma generate
```

### 5. Start the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | MySQL/MariaDB connection string | Yes |
| `SHADOW_DATABASE_URL` | Optional shadow database URL for Prisma migrations | No |
| `AUTH_SECRET` | JWT/session secret, generated with `openssl rand -base64 32` | Yes |
| `AUTH_URL` | Base auth callback URL, usually `http://localhost:3000` locally | Yes |
| `CRON_SECRET` | Bearer token for the recurring transaction cron route in production | Yes in production |
| `ENCRYPTION_MASTER_KEY` | Base64-encoded 32-byte key for field-level encryption | Required for encrypted field support |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public VAPID key used by the browser when creating push subscriptions | Required for web push |
| `VAPID_PRIVATE_KEY` | Private VAPID key used only on the server for Web Push authentication | Required for web push |
| `VAPID_SUBJECT` | Contact subject for VAPID, usually `mailto:...` or the app URL | Required for web push |

Database URL format:

```text
mysql://USER:PASSWORD@HOST:PORT/DATABASE
```

### Important Config Files

- `prisma/schema.prisma` - Database schema and generated-client output path.
- `prisma.config.ts` - Prisma 7 datasource configuration.
- `src/lib/db.ts` - Prisma client using the MariaDB adapter.
- `src/auth.ts` and `src/auth.config.ts` - Auth.js credentials provider, Prisma adapter, JWT callbacks, and auth pages.
- `src/middleware.ts` - Protected dashboard routing.
- `next.config.ts` - Next.js config with React Compiler enabled.
- `components.json` - shadcn/ui New York style, aliases, Tailwind CSS variables, and Lucide icons.
- `vercel.json` - Daily recurring processing plus monthly net-worth snapshot cron schedules.

## Architecture

```mermaid
graph TB
    subgraph Client["Client"]
        Pages["App Router Pages"]
        Components["React Components"]
        Hooks["TanStack Query Hooks"]
        Currency["Currency Context"]
    end

    subgraph Server["Next.js Server"]
        Actions["Server Actions"]
        Routes["API Routes"]
        Auth["Auth.js"]
        Cache["Next.js Cache"]
    end

    subgraph Data["Data Layer"]
        Prisma["Prisma ORM"]
        MySQL[("MySQL / MariaDB")]
    end

    subgraph External["External Data"]
        Yahoo["Yahoo Finance"]
    end

    Pages --> Components
    Components --> Hooks
    Components --> Currency
    Hooks --> Actions
    Components --> Routes
    Actions --> Auth
    Actions --> Prisma
    Routes --> Auth
    Routes --> Prisma
    Actions --> Cache
    Actions --> Yahoo
    Prisma --> MySQL
```

### Data Flow

1. Auth.js stores user identity in JWT sessions and exposes `session.user.id`.
2. Server Actions validate inputs with Zod and read/write user-owned data through Prisma.
3. Client components use TanStack Query hooks to call Server Actions and invalidate related cache keys after mutations.
4. Yahoo Finance quote and historical data calls are cached and handled defensively for rate limits or unavailable data.
5. Sensitive text fields can be encrypted with per-user keys derived from `ENCRYPTION_MASTER_KEY`.

### Security Model

- Dashboard routes require authentication.
- User-owned queries must include `userId` filters.
- Global tables such as `ExchangeRate` are not user-owned.
- Prisma prevents SQL injection for normal ORM queries.
- Zod schemas validate user input before database work.
- Balance-changing workflows should use Prisma transactions.
- Sensitive text fields use encrypted companion columns where implemented.
- The production cron endpoint checks `CRON_SECRET` bearer auth.

## Usage

### First-Time Flow

1. Register an account at `/register`.
2. Sign in at `/login`.
3. Set your main currency and financial targets in the profile area.
4. Create financial accounts for bank, cash, investments, liabilities, credit cards, or loans receivable.
5. Add categories, transactions, recurring rules, subscriptions, budgets, goals, investments, liabilities, receivable transfers, and personal assets as needed.
6. Review the dashboard, calendar, reports, forecasting, and data import/export pages.

### Account Types

| Type | Meaning |
|------|---------|
| `BANK` | Bank account asset |
| `CASH` | Cash asset |
| `INVESTMENT` | Investment account asset |
| `LOAN` | Liability account |
| `CREDIT_CARD` | Liability account |
| `LOAN_RECEIVABLE` | Asset account for principal owed to the user |

Account classification and balance normalization live in `src/lib/account-types.ts`.

### Financial Data Notes

- Live market and FX data comes from Yahoo Finance through `src/lib/finance-service.ts`.
- Quote fetches are cached and should keep fallback/error behavior so the UI remains usable when Yahoo Finance is unavailable.
- Precious-metal holdings may use `TROY_OUNCE` or `GRAM` units through `src/lib/unit-conversion.ts`.

## API and Server Actions

Most data changes are implemented as Server Actions in `src/actions`. API routes are used for Auth.js, selected client-friendly reads, and scheduled work.

### API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET/POST` | `/api/auth/[...nextauth]` | Auth.js handlers |
| `GET` | `/api/accounts/by-type` | Authenticated active accounts grouped by account role |
| `GET` | `/api/categories?type=...` | Authenticated categories filtered by transaction type |
| `GET` | `/api/investments/[id]/trades` | Authenticated trade history for an owned investment asset |
| `GET` | `/api/cron/monthly-net-worth-snapshots` | Creates missing month-end net-worth snapshots when the first-day cron runs |
| `GET` | `/api/cron/notifications` | Sends daily push-notification reminders for enabled users; protected by `CRON_SECRET` in production |
| `GET` | `/api/cron/recurring` | Processes due recurring transactions; protected by `CRON_SECRET` in production |

### Server Action Areas

- `account-actions.ts` - Accounts and account summaries.
- `auth-actions.ts` - Registration and auth helpers.
- `budget-actions.ts` - Budget CRUD and budget calculations.
- `calendar-actions.ts` - Calendar and upcoming event data.
- `category-actions.ts` - Category CRUD.
- `exchange-rate-actions.ts` - Exchange-rate reads and cache persistence.
- `export-actions.ts` and `import-actions.ts` - Data export/import.
- `forecast-actions.ts` - Cash-flow forecasting across future transactions, recurring rules, subscriptions, and optional spend estimates.
- `goal-actions.ts` - Savings goals and progress.
- `insight-actions.ts` - Cross-feature financial insights for dashboard and reports.
- `investment-actions.ts` - Investment assets, trades, valuation, and searches.
- `liability-payment-actions.ts` - Liability payment flows and audit history.
- `net-worth-snapshot-actions.ts` - Month-end net-worth snapshot creation, summary, and trend reads.
- `personal-asset-actions.ts` - Personal asset inventory and valuations.
- `profile-actions.ts` - User currency, financial target settings, and self-service account deletion.
- `receivable-actions.ts` - Loans Receivable disbursement, repayment, summary, and history.
- `recurring-actions.ts` - Recurring rules and scheduled transaction processing.
- `report-actions.ts` - Report metrics and chart data.
- `subscription-actions.ts` - Subscription CRUD, summaries, and recurring-rule linking.
- `transaction-actions.ts` - Transaction CRUD, transfers, filters, and balance updates.

## Project Structure

```text
expense-tracker/
├── content/                   # Changelog content rendered in the dashboard
├── plans/                     # Architecture and implementation notes
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── public/
├── src/
│   ├── actions/               # Server Actions by feature area, including forecasts, insights, snapshots, and subscriptions
│   ├── app/                   # Next.js App Router pages, layouts, and API routes
│   ├── components/            # Feature components plus shadcn/ui primitives
│   ├── contexts/              # React contexts
│   ├── generated/             # Prisma generated client output
│   ├── hooks/                 # TanStack Query hooks
│   ├── lib/                   # Domain services, Prisma client, encryption, forecasting, insights, utils
│   ├── scripts/               # One-off operational scripts such as encryption migration
│   ├── types/                 # Shared TypeScript declarations
│   ├── auth.config.ts
│   ├── auth.ts
│   └── middleware.ts
├── components.json
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── prisma.config.ts
├── pnpm-workspace.yaml
├── tsconfig.json
└── vercel.json
```

Dashboard pages currently include accounts, assets, budgets, calendar, categories, data, goals, investments, liabilities, profile, receivables, recurring, reports, subscriptions, and transactions.

## Testing

The project currently relies on linting plus manual verification.

```bash
pnpm lint
```

For broader validation, run:

```bash
pnpm build
```

Manual verification should cover the affected feature area. For financial changes, also check related balances, dashboard metrics, reports, and cross-feature invalidation.

### Manual Checklist

- Authentication and protected dashboard routes.
- Account CRUD, account type grouping, and balance normalization.
- Transaction creation/editing, transfers, liability payments, and location metadata.
- Loans Receivable disbursement and repayment.
- Investment trades, valuation, realized/unrealized PnL, Yahoo Finance fallback handling, and unit conversion.
- Personal asset valuation and disposal history.
- Budgets, savings goals, profile targets, dashboard metrics, reports, insights, and calendar.
- Subscription CRUD, recurring-rule linkage, trial/renewal summaries, and calendar visibility.
- Net-worth snapshots, monthly snapshot summary/trend reads, and cash-flow forecasting.
- Import/export and category management.
- Recurring transaction processing plus the month-start net-worth snapshot cron flow.

## Deployment

### Vercel

1. Connect the repository to Vercel.
2. Configure `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `CRON_SECRET`, `ENCRYPTION_MASTER_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`.
3. Ensure the MySQL/MariaDB database is reachable from the deployment environment.
4. Run production migrations before or during deployment:

```bash
pnpm db:migrate:prod
```

`vercel.json` currently schedules three cron jobs:

```json
{
  "crons": [
    {
      "path": "/api/cron/monthly-net-worth-snapshots",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/notifications",
      "schedule": "30 0 * * *"
    },
    {
      "path": "/api/cron/recurring",
      "schedule": "15 0 * * *"
    }
  ]
}
```

### Self-Hosting

```bash
pnpm build
pnpm start
```

Use a reverse proxy such as Nginx or Caddy for HTTPS and routing when self-hosting.

## Troubleshooting

### Database Connection Errors

- Verify MySQL/MariaDB is running.
- Confirm `DATABASE_URL` points to an existing database.
- Increase connection and pool timeouts if the local database is slow to accept connections.
- Run `pnpm prisma generate` after dependency or schema changes.

### Authentication Issues

- Confirm `AUTH_SECRET` is set and stable between restarts.
- Confirm `AUTH_URL` matches the app URL.
- Clear browser cookies if session state is stale.

### Encryption Issues

- Set `ENCRYPTION_MASTER_KEY` to a base64-encoded 32-byte value.
- Generate it with `openssl rand -base64 32`.
- Back up the database before running `src/scripts/migrate-encryption.ts`.

### Build Errors

- Regenerate Prisma client with `pnpm prisma generate`.
- Remove `.next` and rebuild with `pnpm build` if cached build artifacts are stale.
- Reinstall dependencies with `pnpm install` if modules are missing.

### Yahoo Finance or Exchange-Rate Issues

- Check internet connectivity.
- Expect temporary rate limits or unavailable quotes.
- Keep fallback/error states in valuation UI so financial pages remain usable.

## License

This repository includes an Apache-2.0 license in [LICENSE](LICENSE).

## Acknowledgments

- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [Auth.js](https://authjs.dev/)
- [Prisma](https://www.prisma.io/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Radix UI](https://www.radix-ui.com/)
- [TanStack Query](https://tanstack.com/query)
- [Yahoo Finance](https://finance.yahoo.com/)

Built with Next.js and modern TypeScript tooling.
