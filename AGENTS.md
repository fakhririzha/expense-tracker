# AGENTS.md - Expense Tracker

This file contains essential information for AI coding agents working on the Expense Tracker project.

## Project Overview

**Expense Tracker** (branded as "FinHealth ✨") is a comprehensive personal finance management application built with Next.js 16 and React 19. It provides expense tracking, investment portfolio management, multi-currency support, and real-time financial insights.

### Key Features
- Account management (Bank, Cash, Investment, Loan, Credit Card)
- Transaction tracking with category classification
- Investment portfolio with real-time stock prices via Yahoo Finance
- Recurring transactions with automated processing
- Multi-currency support with exchange rate conversion
- Budgeting and savings goals
- Financial dashboard with net worth, wealth health score, and retirement progress

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16.1.2 (App Router) |
| UI Library | React 19.2.3 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| UI Components | shadcn/ui (New York style) |
| Database | MySQL 8.0+ |
| ORM | Prisma 6.19.2 |
| Authentication | Auth.js v5 (NextAuth) with JWT |
| State Management | TanStack Query (React Query) |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Package Manager | pnpm |

## Project Structure

```
expense-tracker/
├── prisma/
│   └── schema.prisma          # Database schema definition
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
│   │   ├── liability-payment-actions.ts
│   │   ├── recurring-actions.ts
│   │   ├── report-actions.ts
│   │   └── transaction-actions.ts
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/            # Auth route group
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (dashboard)/       # Dashboard route group
│   │   │   └── dashboard/
│   │   │       ├── accounts/page.tsx
│   │   │       ├── budgets/page.tsx
│   │   │       ├── calendar/page.tsx
│   │   │       ├── data/page.tsx
│   │   │       ├── goals/page.tsx
│   │   │       ├── investments/page.tsx
│   │   │       ├── liabilities/page.tsx
│   │   │       ├── page.tsx
│   │   │       ├── recurring/page.tsx
│   │   │       ├── reports/page.tsx
│   │   │       └── transactions/page.tsx
│   │   ├── api/               # API routes
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Landing page
│   │   └── globals.css        # Global styles
│   ├── components/            # React components
│   │   ├── accounts/
│   │   ├── budgets/
│   │   ├── calendar/
│   │   ├── dashboard/
│   │   ├── export/
│   │   ├── goals/
│   │   ├── investments/
│   │   ├── liability/
│   │   ├── providers/
│   │   ├── recurring/
│   │   ├── reports/
│   │   ├── transactions/
│   │   └── ui/               # shadcn/ui components
│   ├── contexts/
│   │   └── CurrencyContext.tsx
│   ├── hooks/
│   │   ├── useExchangeRateQuery.ts
│   │   └── useTradeHistory.ts
│   ├── lib/                   # Utility libraries
│   │   ├── db.ts             # Prisma client singleton
│   │   ├── executive-service.ts
│   │   ├── executive-types.ts
│   │   ├── finance-service.ts
│   │   ├── investment-validation.ts
│   │   ├── liability-payment-validation.ts
│   │   ├── unit-conversion.ts
│   │   └── utils.ts          # cn(), formatters
│   ├── types/
│   │   ├── next-auth.d.ts
│   │   └── trade-history.ts
│   ├── auth.config.ts         # Auth.js configuration
│   ├── auth.ts               # Auth.js initialization
│   └── middleware.ts         # Route protection
├── .env                      # Environment variables
├── components.json           # shadcn/ui configuration
├── next.config.ts            # Next.js configuration
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── vercel.json               # Vercel deployment config
```

## Build and Development Commands

```bash
# Install dependencies
pnpm install

# Development server
pnpm dev              # Starts at http://localhost:3000

# Build for production
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint

# Database operations (via postinstall)
pnpm prisma generate  # Generate Prisma client
pnpm prisma migrate dev  # Run migrations in development
```

### Postinstall Hook
The `postinstall` script automatically runs Prisma db push and generate when installing dependencies:
```bash
pnpm dlx prisma@^6.19.2 db push && pnpm dlx prisma@^6.19.2 generate
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | MySQL connection string (e.g., `mysql://user:pass@localhost:3306/expense_tracker`) | Yes |
| `AUTH_SECRET` | Secret key for JWT signing (generate with `openssl rand -base64 32`) | Yes |
| `AUTH_URL` | Base URL for auth callbacks (default: `http://localhost:3000`) | Yes |
| `CRON_SECRET` | Secret for securing cron job endpoints | Yes (production) |

## Code Style Guidelines

### TypeScript
- Use strict TypeScript configuration
- Define explicit types for function parameters and return values
- Avoid `any` - use `unknown` with type guards when necessary
- Use interfaces for object shapes, types for unions/intersections

### React Components
- Use **functional components** with hooks
- Use **Server Components** by default
- Add `'use client'` directive only when using client-side features (useState, useEffect, etc.)
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

export async function createSomething(data: unknown) {
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

## Database Schema

### Key Models

**User**: Core user entity with Auth.js integration, includes `mainCurrency`, `retirementTarget`, `monthlyBudget`

**FinancialAccount**: User's financial accounts (types: BANK, CASH, INVESTMENT, LOAN, CREDIT_CARD)

**Transaction**: Financial transactions (types: INCOME, EXPENSE, TRANSFER, LIABILITY_PAYMENT)

**InvestmentAsset**: Stock/investment holdings with `symbol`, `quantity`, `avgBuyPrice`

**TradeHistory**: Buy/sell trades for investment assets with realized PnL tracking

**RecurringRule**: Automated recurring transaction rules with various intervals

**Category**: Transaction categories (user-defined or system)

**Budget**: Budgeting rules with period (MONTHLY, QUARTERLY, YEARLY)

**SavingsGoal**: Savings targets with progress tracking

### Important Enums
```typescript
enum AccountType { BANK, CASH, INVESTMENT, LOAN, CREDIT_CARD }
enum TransactionType { INCOME, EXPENSE, TRANSFER, LIABILITY_PAYMENT }
enum TradeType { BUY, SELL }
enum RecurringInterval { DAILY, WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, YEARLY }
enum BudgetPeriod { MONTHLY, QUARTERLY, YEARLY }
enum UnitType { UNIT, TROY_OUNCE, GRAM }
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

## Testing

Currently uses manual testing. Before submitting changes, verify:
- [ ] Authentication flows work correctly
- [ ] Account CRUD operations function properly
- [ ] Transactions are recorded accurately
- [ ] Investment calculations are correct
- [ ] Currency conversions work as expected
- [ ] Recurring transactions process correctly
- [ ] Dashboard metrics display accurately

## Deployment

### Vercel Deployment
- Cron job configured in `vercel.json` for daily recurring transaction processing at midnight
- Ensure `CRON_SECRET` environment variable is set

### Database Migration on Production
```bash
pnpm prisma migrate deploy
```

## Key Utilities

### `cn()` - Class Name Merger
Located in `src/lib/utils.ts`. Combines `clsx` and `tailwind-merge` for conditional Tailwind classes.

### Formatters
- `formatCurrency(amount, currency, locale)` - Format numbers as currency
- `formatNumber(value, locale)` - Format numbers with 2 decimal places
- `formatDate(date, options)` - Format dates with Indonesian locale
- `formatPercentage(value, decimals)` - Format as percentage with +/- sign
- `getInitials(name)` - Get up to 2 uppercase initials from a name

### Prisma Client
Located in `src/lib/db.ts`. Uses singleton pattern for development hot-reload compatibility.

## Common Patterns

### Route Groups
- `(auth)` - Login/register pages (no sidebar)
- `(dashboard)` - All dashboard pages (with shared layout)

### Data Fetching
- Server Components: Fetch directly with Prisma
- Client Components: Use TanStack Query hooks

### Form Handling
- Use React Hook Form with Zod resolvers
- Validation schemas defined in action files

### Error Handling
- Server Actions return `{ success: boolean, data?: T, error?: string }`
- Always check `session?.user?.id` before database operations

## Security Considerations

- CSRF protection built into NextAuth.js
- Input validation with Zod schemas on all inputs
- SQL injection prevention via Prisma parameterized queries
- XSS protection via React's built-in escaping
- Route protection via middleware
- Cron endpoints protected by `CRON_SECRET` header check
