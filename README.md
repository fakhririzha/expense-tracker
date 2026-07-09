# FinHealth

FinHealth is a personal finance dashboard built with Next.js 16 and React 19. It tracks accounts, transactions, split expenses, liabilities, loans receivable, deposito balances, investments, personal assets, subscriptions, multi-category budgets, savings goals, historical net worth, cash-flow forecasts, rule-based insights, and browser notifications.

## Highlights

- Unified account tracking for bank, cash, investment, liability, credit-card, and receivable balances
- Transaction flows for income, expenses, transfers, liability payments, and optional location metadata
- Manual split expense transactions with category-aware reporting
- Multi-category budgets with support for legacy all-spending budgets
- Portfolio valuation with Yahoo Finance pricing, trade history, realized PnL, precious-metal unit conversion, and Pegadaian Tabungan Emas reference prices for eligible gold holdings
- Dedicated Insights and Deposito Tracker dashboards for financial signals and locked-balance workflows
- Loans receivable, liability-payment audits, debt payoff planning (avalanche/snowball), and month-end frozen net-worth snapshots
- Subscriptions, recurring rules, calendar views, and upcoming bank-pressure alerts
- CSV import/export, multi-currency reporting, budgets, goals, forecasting, and financial insights
- Installable PWA support with offline fallback and optional browser push notifications

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js | 16.1.2 |
| UI Library | React / React DOM | 19.2.3 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| Database | MySQL / MariaDB | 8.0+ |
| ORM | Prisma | 7.4.1 |
| Authentication | Auth.js v5 / NextAuth | 5.0.0-beta.30 |
| Server State | TanStack Query | 5.90+ |
| Forms | React Hook Form + Zod | 7.71+ / 4.3+ |
| Charts | Recharts | 3.6+ |
| Market Data | yahoo-finance2 + Pegadaian reference prices | 3.13+ / external API |
| Push Notifications | web-push | 3.6+ |
| Package Manager | pnpm | 9.x |

## Requirements

- Node.js 20+
- pnpm 9+
- MySQL or MariaDB 8+

## Setup

```bash
git clone https://github.com/fakhririzha/expense-tracker.git
cd expense-tracker
pnpm install
```

Create a `.env` file in the project root:

```bash
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/expense_tracker"
AUTH_SECRET="replace-with-openssl-output"
AUTH_URL="http://localhost:3000"
CRON_SECRET="replace-for-production-cron"
ENCRYPTION_MASTER_KEY="replace-with-openssl-output"
NEXT_PUBLIC_VAPID_PUBLIC_KEY="replace-with-web-push-public-key"
VAPID_PRIVATE_KEY="replace-with-web-push-private-key"
VAPID_SUBJECT="mailto:you@example.com"
CHAT_API_ENDPOINT="https://provider.example.com/v1/chat/completions"
CHAT_API_KEY="replace-with-chat-api-key"
CHAT_API_MODEL="replace-with-vision-capable-model"
```

Optional:

```bash
SHADOW_DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/expense_tracker_shadow"
```

Generate a secret or encryption key with:

```bash
openssl rand -base64 32
```

Create the database, then run migrations and Prisma client generation:

```bash
pnpm db:migrate:dev
pnpm prisma generate
```

Start the app:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start the Next.js dev server |
| `pnpm dev:https` | Start the dev server with experimental HTTPS |
| `pnpm build` | Run `prisma generate` and build the app |
| `pnpm start` | Start the production server |
| `pnpm start:https` | Start the production server with experimental HTTPS |
| `pnpm lint` | Run ESLint |
| `pnpm db:migrate:dev` | Run Prisma development migrations |
| `pnpm db:migrate:prod` | Run Prisma production migrations |
| `pnpm db:backfill:account-encryption` | Backfill encrypted account fields |

Notes:

- There is no `postinstall` script. `pnpm install` does not run Prisma automatically.
- There is no dedicated `type-check` script. Use `pnpm build` for build-level type validation.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | MySQL/MariaDB connection string | Yes |
| `SHADOW_DATABASE_URL` | Shadow database for Prisma migrations | No |
| `AUTH_SECRET` | Auth.js secret | Yes |
| `AUTH_URL` | Base app URL and auth callback origin | Yes |
| `CRON_SECRET` | Bearer secret for production cron endpoints | Yes in production |
| `ENCRYPTION_MASTER_KEY` | Base64-encoded 32-byte master key for field encryption | Required for encrypted-field support |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Browser-facing VAPID key | Required for web push |
| `VAPID_PRIVATE_KEY` | Server-side VAPID key | Required for web push |
| `VAPID_SUBJECT` | VAPID contact subject | Required for web push |
| `CHAT_API_ENDPOINT` | OpenAI-compatible chat completions endpoint for bill photo scanning | Required for OCR bill scan |
| `CHAT_API_KEY` | Bearer token for the chat completions endpoint | Required for OCR bill scan |
| `CHAT_API_MODEL` | Vision-capable chat model used to parse bill photos | Required for OCR bill scan |

## Current App Surface

### Dashboard Pages

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

### API Routes

- `/api/accounts/by-type`
- `/api/auth/[...nextauth]`
- `/api/categories`
- `/api/cron/deposito`
- `/api/investments/[id]/trades`
- `/api/cron/monthly-net-worth-snapshots`
- `/api/cron/notifications`
- `/api/cron/pegadaian-gold-prices`
- `/api/cron/recurring`

## Project Structure

```text
expense-tracker/
├── certificates/             # Local HTTPS certificates
├── content/                  # In-app changelog content
├── plans/                    # Design and implementation notes
├── prisma/                   # Prisma schema and migrations
├── public/                   # Static assets, icons, offline fallback, service worker
├── src/
│   ├── actions/              # Server Actions by feature
│   ├── app/                  # App Router pages, layouts, API routes, manifest
│   ├── components/           # Feature UI, profile, pwa, dashboard, ui primitives
│   ├── contexts/             # React contexts
│   ├── generated/            # Prisma generated client
│   ├── hooks/                # TanStack Query hooks
│   ├── lib/                  # Domain services, encryption, forecasts, insights, notifications
│   ├── scripts/              # Operational scripts
│   └── types/                # Shared TypeScript types
├── AGENTS.md
├── CONTRIBUTING.md
├── README.md
└── vercel.json
```

## Architecture Notes

- Auth.js handles credentials-based authentication with JWT sessions.
- Server Actions under `src/actions` implement most authenticated reads and all mutations.
- Prisma uses a generated client under `src/generated/prisma/client`.
- TanStack Query wraps client-side access to Server Actions.
- Yahoo Finance powers live market quotes and FX data with fallback-aware handling.
- Budgets support multiple expense categories through a scoped many-to-many linkage, with legacy global budgets preserved for older records.
- Deposito tracking has a dedicated dashboard flow plus cron-backed daily interest processing.
- `src/lib/pegadaian-gold-service.ts` validates and stores Pegadaian Tabungan Emas reference prices for eligible `GC=F` holdings.
- Pegadaian prices are supplementary buy/sell references; portfolio value and P&L continue to use Yahoo Finance market prices.
- PWA support is implemented through `src/app/manifest.ts`, `public/sw.js`, and profile-level notification settings.

## Data Model Notes

- `FinancialAccount` stores account names and descriptions in encrypted-only columns.
- `Budget` uses scoped many-to-many category coverage so one budget can track multiple expense categories.
- `TransactionSplit` supports manual split expense allocation.
- `NetWorthSnapshot` stores frozen month-end values for historical reporting.
- `PushSubscription`, `NotificationPreference`, and `NotificationEvent` back browser push notifications.
- `ExchangeRate` is a global cache and is not user-owned.
- `GoldPriceSnapshot` stores global Pegadaian reference-price history and is not user-owned.

## Testing

The project currently relies on linting plus manual verification.

```bash
pnpm lint
pnpm build
```

When relevant, also run:

```bash
git diff --check
```

For functional changes, manually verify the touched flow and its balance/reporting side effects. This is especially important for transactions, transfers, liabilities, receivables, split expenses, investments, market-price fallbacks, Pegadaian reference prices, forecasts, notifications, and imports.

## Deployment

### Vercel

`vercel.json` currently schedules these cron jobs:

```json
{
  "crons": [
    {
      "path": "/api/cron/monthly-net-worth-snapshots",
      "schedule": "0 17 * * *"
    },
    {
      "path": "/api/cron/recurring",
      "schedule": "15 17 * * *"
    },
    {
      "path": "/api/cron/notifications",
      "schedule": "30 17 * * *"
    },
    {
      "path": "/api/cron/deposito",
      "schedule": "0 18 * * *"
    },
    {
      "path": "/api/cron/pegadaian-gold-prices",
      "schedule": "45 17 * * *"
    }
  ]
}
```

The Pegadaian cron refreshes the stored reference price once per day at `17:45 UTC`, and the deposito cron posts due interest once per day at `18:00 UTC`.

Before deploying:

```bash
pnpm db:migrate:prod
```

Make sure production has:

- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_URL`
- `CRON_SECRET`
- `ENCRYPTION_MASTER_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

### Self-Hosting

```bash
pnpm build
pnpm start
```

Use HTTPS if you need full PWA install and push-notification behavior outside localhost.

## License

[Apache-2.0](LICENSE)
