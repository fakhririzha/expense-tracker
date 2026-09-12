# FinHealth

FinHealth is a personal finance platform with a Next.js 16 web application and a focused Expo mobile client. The web application remains the backend and full product surface; the native app covers a concise financial dashboard, everyday transaction entry, receipt scanning, transaction history, mapped transaction locations, and account balances.

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
- Native iOS and Android client for secure sign-in, ordinary transaction CRUD, receipt-assisted entry, and account balances

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js | 16.2.12 |
| Mobile | Expo / Expo Router | 57 |
| UI Library | React / React DOM | 19.2.3 |
| Native UI | React Native | 0.86.3 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| Database | MySQL / MariaDB | 8.0+ |
| ORM | Prisma | 7.9.0 |
| Authentication | Auth.js v5 / NextAuth | 5.0.0-beta.32 |
| Server State | TanStack Query | 5.90+ |
| Forms | React Hook Form + Zod | 7.71+ / 4.3+ |
| Charts | Recharts | 3.6+ |
| Market Data | yahoo-finance2 + Pegadaian reference prices | 3.13+ / external API |
| Push Notifications | web-push | 3.6+ |
| Package Manager | pnpm | 9.x |

## Requirements

- Node.js 22.13+ or 24+
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
# Set only when a trusted self-hosted reverse proxy overwrites X-Forwarded-For
AUTH_TRUST_PROXY="false"
NEXT_PUBLIC_VAPID_PUBLIC_KEY="replace-with-web-push-public-key"
VAPID_PRIVATE_KEY="replace-with-web-push-private-key"
VAPID_SUBJECT="mailto:you@example.com"
CHAT_API_ENDPOINT="https://provider.example.com/v1/chat/completions"
CHAT_API_KEY="replace-with-chat-api-key"
CHAT_API_MODEL="replace-with-vision-capable-model"
WEEKLY_INSIGHTS_CHAT_API_ENDPOINT="https://provider.example.com/v1/chat/completions"
WEEKLY_INSIGHTS_CHAT_API_KEY="replace-with-weekly-insights-chat-api-key"
WEEKLY_INSIGHTS_CHAT_API_MODEL="replace-with-text-capable-model"
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

### Expo mobile app

The native client lives in `apps/mobile` and starts in Expo Go. Create `apps/mobile/.env.local` with the URL that the phone or simulator can use to reach the FinHealth web server:

```bash
EXPO_PUBLIC_API_URL="https://finhealth.chat"
```

Authenticated physical-device testing must use HTTPS because the app sends credentials and bearer sessions to this URL. Use an HTTPS hostname reachable from the phone, configure a certificate that is valid for that hostname, and trust its issuing certificate on both iOS and Android test devices. Then start the HTTPS web backend and Expo in separate terminals:

```bash
pnpm dev:https
pnpm mobile:start
```

Set `EXPO_PUBLIC_API_URL` to that trusted `https://` LAN hostname. Plain HTTP is accepted only for local simulator/emulator loopback targets during development; the app rejects HTTP LAN and production API URLs before sending credentials.

This is the only environment value exposed to Expo. Database, encryption, Auth.js, and OCR provider secrets stay on the Next.js server.

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start the Next.js dev server |
| `pnpm dev:https` | Start the dev server with experimental HTTPS |
| `pnpm build` | Run `prisma generate` and build the app |
| `pnpm start` | Start the production server |
| `pnpm start:https` | Start the production server with experimental HTTPS |
| `pnpm lint` | Run ESLint |
| `pnpm contracts:typecheck` | Type-check the shared mobile API contracts |
| `pnpm test:mobile-server` | Run focused mobile authentication, contract, transaction-policy, balance, and OCR tests |
| `pnpm mobile:start` | Start the Expo development server |
| `pnpm mobile:android` | Start Expo and open Android |
| `pnpm mobile:ios` | Start Expo and open iOS |
| `pnpm mobile:lint` | Lint the Expo source |
| `pnpm mobile:typecheck` | Type-check the Expo source |
| `pnpm --dir apps/mobile eas:build:ios:preview` | Build an installable iPhone preview through EAS |
| `pnpm --dir apps/mobile eas:build:ios:production` | Build the iOS App Store/TestFlight package through EAS |
| `pnpm --dir apps/mobile eas:submit:ios` | Submit the latest production iOS build to App Store Connect |
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
| `CRON_SECRET` | Bearer secret required by every cron endpoint | Yes |
| `ENCRYPTION_MASTER_KEY` | Canonical Base64-encoded 32-byte master key; production startup fails closed without it | Yes outside development |
| `AUTH_TRUST_PROXY` | Trust the first `X-Forwarded-For` address when a self-hosted reverse proxy overwrites incoming values | No |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Browser-facing VAPID key | Required for web push |
| `VAPID_PRIVATE_KEY` | Server-side VAPID key | Required for web push |
| `VAPID_SUBJECT` | VAPID contact subject | Required for web push |
| `CHAT_API_ENDPOINT` | OpenAI-compatible chat completions endpoint for bill photo scanning | Required for OCR bill scan |
| `CHAT_API_KEY` | Bearer token for the chat completions endpoint | Required for OCR bill scan |
| `CHAT_API_MODEL` | Vision-capable chat model used to parse bill photos | Required for OCR bill scan |
| `WEEKLY_INSIGHTS_CHAT_API_ENDPOINT` | OpenAI-compatible chat completions endpoint for weekly AI insights | Required for weekly AI insights |
| `WEEKLY_INSIGHTS_CHAT_API_KEY` | Bearer token for weekly AI insight generation | Required for weekly AI insights |
| `WEEKLY_INSIGHTS_CHAT_API_MODEL` | Text-capable chat model used to create weekly AI insights | Required for weekly AI insights |
| `EXPO_PUBLIC_API_URL` | Public base URL of the FinHealth Next.js backend; set in `apps/mobile/.env.local` | Mobile development/builds |
| `GOOGLE_MAPS_API_KEY` | Google Maps SDK for Android key injected at native build time; not needed in Expo Go | Standalone Android builds |

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
- `/api/cron/bank-interest`
- `/api/cron/deposito`
- `/api/investments/[id]/trades`
- `/api/cron/monthly-net-worth-snapshots`
- `/api/cron/notifications`
- `/api/cron/weekly-ai-insights`
- `/api/cron/pegadaian-gold-prices`
- `/api/cron/recurring`

### Mobile API

The versioned `/api/mobile/v1` API provides native login/logout, the signed-in user, a server-calculated dashboard, decrypted account summaries, categories, paginated transaction history and detail, ordinary transaction mutations, and receipt OCR. Except for login, requests use `Authorization: Bearer <token>`.

- `POST /api/mobile/v1/auth/login`
- `DELETE /api/mobile/v1/auth/session`
- `GET /api/mobile/v1/me`
- `GET /api/mobile/v1/dashboard`
- `GET /api/mobile/v1/accounts`
- `GET /api/mobile/v1/categories`
- `GET|POST /api/mobile/v1/transactions`
- `GET|PATCH|DELETE /api/mobile/v1/transactions/[id]`
- `POST /api/mobile/v1/transactions/ocr`

## Project Structure

```text
expense-tracker/
├── apps/
│   └── mobile/                   # Expo Router native client
├── certificates/             # Local HTTPS certificates
├── content/                  # In-app changelog content
├── plans/                    # Design and implementation notes
├── prisma/                   # Prisma schema and migrations
├── public/                   # Static assets, icons, offline fallback, service worker
├── packages/
│   └── contracts/                # Pure Zod network DTOs shared by web and mobile
├── src/
│   ├── actions/              # Server Actions by feature
│   ├── app/                  # App Router pages, layouts, API routes, manifest
│   ├── components/           # Feature UI, profile, pwa, dashboard, ui primitives
│   ├── contexts/             # React contexts
│   ├── generated/            # Prisma generated client
│   ├── hooks/                # TanStack Query hooks
│   ├── lib/                  # Domain services, encryption, forecasts, insights, notifications
│   ├── scripts/              # Operational scripts
│   ├── server/               # Reusable auth and transaction domain services
│   └── types/                # Shared TypeScript types
├── AGENTS.md
├── CONTRIBUTING.md
├── README.md
└── vercel.json
```

## Architecture Notes

- Auth.js handles credentials-based authentication with JWT sessions.
- Native sessions use random 30-day bearer tokens. Only SHA-256 token hashes are stored in `MobileSession`; logout revokes the current device session.
- Server Actions and mobile HTTP routes are thin adapters over the same transaction and OCR services in `src/server`, so financial rules are not duplicated in the client.
- Network DTOs are defined and validated in `packages/contracts`; Prisma models are never sent directly to mobile.
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
- `Budget` stores names in encrypted form and uses scoped many-to-many category coverage so one budget can track multiple expense categories.
- Recurring rules, savings goals, subscriptions, and personal assets store their sensitive labels and notes in encrypted companion fields.
- `TransactionSplit` supports manual split expense allocation.
- `MobileSession` stores hashed native bearer sessions and is deleted with its owning user.
- `NetWorthSnapshot` stores frozen month-end values for historical reporting.
- `PushSubscription`, `NotificationPreference`, and `NotificationEvent` back browser push notifications.
- `ExchangeRate` is a global cache and is not user-owned.
- `GoldPriceSnapshot` stores global Pegadaian reference-price history and is not user-owned.

## Testing

The project uses focused server/mobile tests, static checks, production builds, and manual verification.

```bash
pnpm test:mobile-server
pnpm contracts:typecheck
pnpm lint
pnpm build
pnpm mobile:lint
pnpm mobile:typecheck
git diff --check
```

For functional changes, manually verify the touched flow and its balance/reporting side effects. This is especially important for transactions, transfers, liabilities, receivables, split expenses, investments, market-price fallbacks, Pegadaian reference prices, forecasts, notifications, and imports.

The native MVP supports create, edit, and delete for ordinary `INCOME`, `EXPENSE`, and `TRANSFER` transactions. Managed deposito, liability-payment, loans-receivable, automatic bank-interest, and split transactions can remain visible but are read-only according to server-returned capabilities. Account/category management and the wider planning, reporting, investment, liability, recurring, notification, and data-management surfaces remain web-only.

Receipt scanning is a transient form helper. The app resizes and compresses the selected image below 1 MB, sends it to the authenticated server OCR route, applies approved fields to the form, and does not save the image, base64 data, or raw provider response. OCR line items remain in the contract for forward compatibility but do not create mobile split transactions.

Transaction forms can attach an optional native map pin. The app requests foreground location permission only when the user chooses the current-position action, and sends the selected label, coordinates, and HTTPS Maps link to the same server-authoritative transaction service used by the web app.

Native reads may use the normal in-memory TanStack Query cache while offline. Financial mutations require connectivity and are never queued. A stable `clientMutationId` is reused after uncertain create failures so the database uniqueness constraint prevents duplicate balance effects.

Transaction CSV imports are limited to 512 KiB, 1,000 data rows, 32 columns,
128 characters per header, and 2,048 characters per cell. Browser validation is
only an early convenience check; the authenticated server action enforces the
same limits before importing any rows.

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
      "schedule": "45 17 * * *"
    },
    {
      "path": "/api/cron/pegadaian-gold-prices",
      "schedule": "0 18 * * *"
    },
    {
      "path": "/api/cron/weekly-ai-insights",
      "schedule": "15 18 * * 1"
    },
    {
      "path": "/api/cron/bank-interest",
      "schedule": "30 18 * * *"
    }
  ]
}
```

The deposito cron posts due interest once per day at `17:45 UTC`, Pegadaian refreshes stored reference prices at `18:00 UTC`, weekly AI insights run Mondays at `18:15 UTC`, and automatic bank interest runs daily at `18:30 UTC` (`01:30 Asia/Jakarta`).

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
