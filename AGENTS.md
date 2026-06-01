# AGENTS.md - Expense Tracker

This file contains essential information for AI coding agents working on the Expense Tracker project.

## Project Overview

**Expense Tracker** (branded as "FinHealth ✨") is a comprehensive personal finance management application built with Next.js 16 and React 19. It provides expense tracking, investment portfolio management, multi-currency support, and real-time financial insights.

### Key Features
- **Account Management**: Create and manage multiple financial accounts (Bank, Cash, Investment, Loan, Credit Card)
- **Transaction Tracking**: Record income, expenses, transfers, and liability payments with category classification
- **Investment Portfolio**: Track stocks and investments with real-time price updates via Yahoo Finance
- **Personal Assets**: Track durable owned items with dated manual valuations and disposal history
- **Recurring Transactions**: Automate regular transactions with flexible scheduling (daily, weekly, monthly, etc.)
- **Multi-Currency Support**: Track finances across different currencies with automatic exchange rate conversion
- **Budgeting**: Create and monitor budgets with different periods (monthly, quarterly, yearly)
- **Savings Goals**: Set and track progress towards financial goals
- **Financial Dashboard**: Executive overview with net worth, wealth health score, and retirement progress

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js | 16.1.2 |
| UI Library | React | 19.2.3 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| UI Components | shadcn/ui (New York style) | - |
| Database | MySQL / MariaDB | 8.0+ |
| ORM | Prisma | 7.4.1 |
| Authentication | Auth.js v5 (NextAuth) | 5.0.0-beta.30 |
| State Management | TanStack Query (React Query) | 5.90+ |
| Forms | React Hook Form + Zod | 7.71+ / 4.3+ |
| Charts | Recharts | 3.6+ |
| Icons | Lucide React | 0.562+ |
| Package Manager | pnpm | 9.x |

## Project Structure

```
expense-tracker/
├── prisma/
│   ├── schema.prisma          # Database schema definition
│   ├── config.ts              # Prisma configuration
│   └── migrations/            # Database migrations
├── public/                     # Static assets
├── src/
│   ├── actions/               # Server Actions (data mutations)
│   │   ├── account-actions.ts
│   │   ├── auth-actions.ts
│   │   ├── budget-actions.ts
│   │   ├── calendar-actions.ts
│   │   ├── exchange-rate-actions.ts
│   │   ├── export-actions.ts
│   │   ├── goal-actions.ts
│   │   ├── import-actions.ts
│   │   ├── investment-actions.ts
│   │   ├── personal-asset-actions.ts
│   │   ├── liability-payment-actions.ts
│   │   ├── recurring-actions.ts
│   │   ├── report-actions.ts
│   │   └── transaction-actions.ts
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/            # Auth route group (no sidebar)
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (dashboard)/       # Dashboard route group (with sidebar)
│   │   │   └── dashboard/
│   │   │       ├── accounts/page.tsx
│   │   │       ├── budgets/page.tsx
│   │   │       ├── calendar/page.tsx
│   │   │       ├── data/page.tsx
│   │   │       ├── goals/page.tsx
│   │   │       ├── investments/page.tsx
│   │   │       ├── assets/page.tsx
│   │   │       ├── liabilities/page.tsx
│   │   │       ├── page.tsx           # Main dashboard
│   │   │       ├── recurring/page.tsx
│   │   │       ├── reports/page.tsx
│   │   │       └── transactions/page.tsx
│   │   ├── api/               # API routes
│   │   │   ├── accounts/
│   │   │   ├── auth/
│   │   │   ├── categories/
│   │   │   ├── cron/recurring/route.ts    # Daily recurring transaction processor
│   │   │   └── investments/
│   │   ├── globals.css        # Global styles with CSS variables
│   │   ├── layout.tsx         # Root layout with fonts and providers
│   │   └── page.tsx           # Landing page
│   ├── components/            # React components
│   │   ├── accounts/          # Account-related components
│   │   ├── assets/            # Personal asset inventory components
│   │   ├── budgets/           # Budget-related components
│   │   ├── calendar/          # Calendar view components
│   │   ├── dashboard/         # Dashboard widgets
│   │   ├── export/            # Data export components
│   │   ├── goals/             # Savings goals components
│   │   ├── investments/       # Investment portfolio components
│   │   ├── liability/         # Liability payment components
│   │   ├── providers/         # React context providers
│   │   │   └── QueryProvider.tsx
│   │   ├── recurring/         # Recurring transaction components
│   │   ├── reports/           # Report components
│   │   ├── transactions/      # Transaction components
│   │   └── ui/                # shadcn/ui components (25+ components)
│   ├── contexts/
│   │   └── CurrencyContext.tsx
│   ├── hooks/                 # TanStack Query custom hooks
│   │   ├── useAccountQueries.ts
│   │   ├── useBudgetQueries.ts
│   │   ├── useCalendarQueries.ts
│   │   ├── useExchangeRateQuery.ts
│   │   ├── useGoalQueries.ts
│   │   ├── useInvestmentQueries.ts
│   │   ├── usePersonalAssetQueries.ts
│   │   ├── useLiabilityQueries.ts
│   │   ├── useRecurringQueries.ts
│   │   ├── useReportQueries.ts
│   │   ├── useTradeHistory.ts
│   │   └── useTransactionQueries.ts
│   ├── lib/                   # Utility libraries
│   │   ├── db.ts              # Prisma client with MariaDB adapter
│   │   ├── executive-service.ts   # Dashboard metrics calculation
│   │   ├── executive-types.ts     # Type definitions for metrics
│   │   ├── finance-service.ts     # Financial calculations
│   │   ├── investment-validation.ts
│   │   ├── liability-payment-validation.ts
│   │   ├── unit-conversion.ts     # Unit conversion utilities
│   │   └── utils.ts           # cn(), formatters (currency, date, number)
│   ├── types/
│   │   ├── next-auth.d.ts     # Auth.js type extensions
│   │   └── trade-history.ts   # Trade history types
│   ├── auth.config.ts         # Auth.js configuration (callbacks, pages)
│   ├── auth.ts                # Auth.js initialization with credentials provider
│   └── middleware.ts          # Route protection middleware
├── .env                       # Environment variables
├── components.json            # shadcn/ui configuration
├── next.config.ts             # Next.js configuration (React Compiler enabled)
├── package.json
├── postcss.config.mjs         # Tailwind CSS PostCSS config
├── prisma.config.ts           # Prisma configuration
├── pnpm-workspace.yaml        # pnpm workspace configuration
├── tsconfig.json
└── vercel.json                # Vercel deployment config (cron jobs)
```

## Build and Development Commands

```bash
# Install dependencies
pnpm install

# Development server
pnpm dev              # Starts at http://localhost:3000

# Build for production
pnpm build            # Runs prisma generate && next build

# Start production server
pnpm start            # Starts at http://localhost:3001

# Lint code
pnpm lint

# Database operations
pnpm prisma generate  # Generate Prisma client
pnpm prisma migrate dev  # Run migrations in development
pnpm prisma db push   # Push schema changes (development)
```

### Postinstall Hook
The `postinstall` script automatically runs Prisma db push and generate when installing dependencies:
```bash
pnpm dlx prisma@^7 db push && pnpm dlx prisma@^7 generate
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | MySQL/MariaDB connection string (e.g., `mysql://user:pass@localhost:3306/expense_tracker`) | Yes |
| `AUTH_SECRET` | Secret key for JWT signing (generate with `openssl rand -base64 32`) | Yes |
| `AUTH_URL` | Base URL for auth callbacks (default: `http://localhost:3000`) | Yes |
| `CRON_SECRET` | Secret for securing cron job endpoints | Yes (production) |

## Database Schema

### Key Models

**User**: Core user entity with Auth.js integration, includes `mainCurrency`, `retirementTarget`, `monthlyBudget`

**FinancialAccount**: User's financial accounts with types:
- `BANK` - Bank accounts
- `CASH` - Cash holdings
- `INVESTMENT` - Investment accounts
- `LOAN` - Loan/liability accounts
- `CREDIT_CARD` - Credit card accounts

**Transaction**: Financial transactions with types:
- `INCOME` - Income entries
- `EXPENSE` - Expense entries
- `TRANSFER` - Transfers between accounts
- `LIABILITY_PAYMENT` - Loan/credit card payments

**InvestmentAsset**: Stock/investment holdings with `symbol`, `quantity`, `avgBuyPrice`, `unitType`

**TradeHistory**: Buy/sell trades for investment assets with realized PnL tracking

**PersonalAsset**: Durable owned items with category, current manual valuation, optional purchase details, and disposal date

**PersonalAssetValuation**: Dated valuation history for personal assets

**RecurringRule**: Automated recurring transaction rules with intervals (DAILY, WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, YEARLY)

**Category**: Transaction categories (user-defined or system)

**Budget**: Budgeting rules with periods (MONTHLY, QUARTERLY, YEARLY)

**SavingsGoal**: Savings targets with progress tracking

**ExchangeRate**: Cached exchange rates between currencies

**LiabilityPaymentAudit**: Audit trail for liability payments with rollback capability

### Important Enums
```typescript
enum AccountType { BANK, CASH, INVESTMENT, LOAN, CREDIT_CARD }
enum TransactionType { INCOME, EXPENSE, TRANSFER, LIABILITY_PAYMENT }
enum TradeType { BUY, SELL }
enum UnitType { UNIT, TROY_OUNCE, GRAM }
enum PersonalAssetCategory { ELECTRONICS, VEHICLE, PROPERTY, FURNITURE, JEWELRY, COLLECTIBLE, EQUIPMENT, OTHER }
enum RecurringInterval { DAILY, WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, YEARLY }
enum BudgetPeriod { MONTHLY, QUARTERLY, YEARLY }
enum PaymentStatus { PENDING, PROCESSING, COMPLETED, FAILED, ROLLED_BACK }
```

## Code Style Guidelines

### TypeScript
- Use strict TypeScript configuration
- Define explicit types for function parameters and return values
- Avoid `any` - use `unknown` with type guards when necessary
- Use interfaces for object shapes, types for unions/intersections

### React Components
- Use **functional components** with hooks
- Use **Server Components** by default (no `'use client'` directive)
- Add `'use client'` directive only when using client-side features (useState, useEffect, event handlers, etc.)
- Keep components focused and single-responsibility

### Styling (Tailwind CSS)
- Use Tailwind CSS utility classes
- Use the `cn()` utility from `@/lib/utils` for conditional class merging
- Follow the existing design system with CSS variables defined in `globals.css`

```tsx
import { cn } from '@/lib/utils';

<button className={cn(
  'px-4 py-2 rounded-md',
  'bg-primary text-primary-foreground',
  'hover:bg-primary/90',
  isLoading && 'opacity-50 cursor-not-allowed'
)}>
```

### File Naming Conventions
- **Components**: PascalCase (e.g., `AddTransactionDialog.tsx`)
- **Utilities/Hooks**: camelCase (e.g., `useExchangeRate.ts`)
- **Actions**: kebab-case with `-actions` suffix (e.g., `transaction-actions.ts`)
- **Types**: kebab-case (e.g., `trade-history.ts`)

### Import Organization
1. React/Next.js imports
2. Third-party library imports
3. Absolute imports (`@/` aliases)
4. Relative imports
5. Type imports

## Server Actions Pattern

All data mutations use Next.js Server Actions. Here's the standard pattern:

```typescript
"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({
  // define schema
});

export type InputType = z.infer<typeof schema>;

export async function createSomething(data: InputType) {
  try {
    // 1. Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // 2. Validate input with Zod
    const validated = schema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0].message };
    }

    // 3. Perform database operation
    const result = await prisma.model.create({
      data: { ...validated.data, userId: session.user.id },
    });

    // 4. Revalidate affected paths
    revalidatePath("/dashboard");

    // 5. Return standardized response
    return { success: true, data: result };
  } catch (error) {
    console.error("Error:", error);
    return { success: false, error: "Failed to create" };
  }
}
```

## TanStack Query Pattern

Client-side data fetching uses TanStack Query hooks with standardized patterns:

```typescript
// hooks/useFeatureQueries.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getItems, createItem, type ItemInput } from "@/actions/feature-actions";

// Query Key Factory
export const featureKeys = {
  all: ["features"] as const,
  lists: () => [...featureKeys.all, "list"] as const,
  list: (filter?: string) => [...featureKeys.lists(), { filter }] as const,
  details: () => [...featureKeys.all, "detail"] as const,
  detail: (id: string) => [...featureKeys.details(), id] as const,
};

// Query Hook
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

// Mutation Hook
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

- **Strategy**: JWT-based with Prisma adapter
- **Provider**: Credentials (email/password) using bcrypt
- **Middleware**: Protects `/dashboard/*` routes, redirects authenticated users from `/login` and `/register`
- **Session**: Stored in JWT, user ID available via `session.user.id`

Access current user in Server Actions:
```typescript
import { auth } from "@/auth";

const session = await auth();
const userId = session?.user?.id;
```

## Key Utilities

### `cn()` - Class Name Merger
Located in `src/lib/utils.ts`. Combines `clsx` and `tailwind-merge` for conditional Tailwind classes.

### Formatters (in `src/lib/utils.ts`)
- `formatCurrency(amount, currency, locale)` - Format numbers as currency (default: IDR, id-ID locale)
- `formatNumber(value, locale)` - Format numbers with 2 decimal places
- `formatDate(date, options)` - Format dates with Indonesian locale
- `formatPercentage(value, decimals)` - Format as percentage with +/- sign
- `getInitials(name)` - Get up to 2 uppercase initials from a name

### Prisma Client
Located in `src/lib/db.ts`. Uses singleton pattern with MariaDB adapter:
```typescript
import { PrismaClient } from "@/generated/prisma/client/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
```

## Common Patterns

### Route Groups
- `(auth)` - Login/register pages (no sidebar layout)
- `(dashboard)` - All dashboard pages (with shared layout)

### Data Fetching
- **Server Components**: Fetch directly with Prisma or call Server Actions
- **Client Components**: Use TanStack Query hooks from `@/hooks/use*Queries`

### Form Handling
- Use React Hook Form with Zod resolvers
- Validation schemas defined in action files
- Re-export types from action files for use in forms

### Error Handling
- Server Actions return `{ success: boolean, data?: T, error?: string }`
- Always check `session?.user?.id` before database operations
- Use try/catch blocks and return user-friendly error messages

## Security Considerations

- **CSRF Protection**: Built into NextAuth.js
- **Input Validation**: Zod schemas on all inputs
- **SQL Injection Prevention**: Prisma ORM parameterized queries
- **XSS Protection**: React's built-in escaping
- **Route Protection**: Middleware checks authentication status
- **Cron Endpoints**: Protected by `CRON_SECRET` header check
- **User Isolation**: All queries must include `userId` filter

## Testing

Currently uses manual testing. Before submitting changes, verify:
- [ ] Authentication flows work correctly
- [ ] Account CRUD operations function properly
- [ ] Transactions are recorded accurately with balance updates
- [ ] Investment calculations (realized/unrealized PnL) are correct
- [ ] Currency conversions work as expected
- [ ] Recurring transactions process correctly
- [ ] Dashboard metrics display accurately
- [ ] Liability payments handle overpayments and audit trails

## Deployment

### Vercel Deployment
- Cron job configured in `vercel.json` for daily recurring transaction processing at midnight (0 0 * * *)
- Ensure `CRON_SECRET` environment variable is set in production

### Database Migration on Production
```bash
pnpm prisma migrate deploy
```

### Self-Hosting
```bash
pnpm build
pnpm start  # Starts on port 3001
```

## Available shadcn/ui Components

The project uses 25+ shadcn/ui components (New York style):
- alert, avatar, badge, button, calendar, card, checkbox
- command, dialog, dropdown-menu, form, input, label
- popover, progress, select, separator, sheet, skeleton
- switch, table, tabs, tooltip

Add new components with:
```bash
npx shadcn@latest add <component-name>
```
