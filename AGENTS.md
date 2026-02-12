# AGENTS.md - AI Coding Agent Guide

This file provides essential information for AI coding agents working on the **FinHealth** (Expense Tracker) project.

## Project Overview

FinHealth is a personal finance management application built with Next.js. It helps users track expenses, income, investments, and plan for retirement. The application features multi-currency support, real-time stock price tracking via Yahoo Finance, and automated recurring transactions.

**Key Capabilities:**
- Multi-account management (Bank, Cash, Investment, Loan, Credit Card)
- Transaction tracking with categorization
- Investment portfolio management with real-time price data
- Automated recurring transactions
- Financial health scoring and retirement progress tracking
- Multi-currency support with exchange rate conversion

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js | 16.1.2 |
| React | React | 19.2.3 (with React Compiler) |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| UI Components | shadcn/ui | New York style |
| Icons | Lucide React | latest |
| Database ORM | Prisma | 6.19.2 |
| Database | MySQL | 8.0+ |
| Authentication | NextAuth.js | v5 (beta) |
| State Management | TanStack Query | 5.x |
| Forms | React Hook Form + Zod | latest |
| Charts | Recharts | 3.x |
| Package Manager | pnpm | 9.x+ |

## Project Structure

```
expense-tracker/
├── prisma/
│   └── schema.prisma          # Database schema definition
├── src/
│   ├── actions/               # Server Actions for data mutations
│   │   ├── account-actions.ts
│   │   ├── auth-actions.ts
│   │   ├── exchange-rate-actions.ts
│   │   ├── investment-actions.ts
│   │   ├── liability-payment-actions.ts
│   │   ├── recurring-actions.ts
│   │   └── transaction-actions.ts
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/            # Auth route group (login, register)
│   │   ├── (dashboard)/       # Dashboard route group
│   │   │   └── dashboard/
│   │   │       ├── accounts/
│   │   │       ├── investments/
│   │   │       ├── liabilities/
│   │   │       ├── recurring/
│   │   │       ├── transactions/
│   │   │       └── page.tsx   # Dashboard home
│   │   ├── api/               # API routes
│   │   │   ├── auth/[...nextauth]/
│   │   │   ├── categories/
│   │   │   ├── cron/recurring/
│   │   │   └── investments/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx           # Landing page
│   ├── components/
│   │   ├── accounts/          # Account-related components
│   │   ├── dashboard/         # Dashboard widgets
│   │   ├── investments/       # Investment components
│   │   ├── liability/         # Liability management components
│   │   ├── providers/         # Context providers
│   │   ├── recurring/         # Recurring transaction components
│   │   ├── transactions/      # Transaction components
│   │   └── ui/                # shadcn/ui components
│   ├── contexts/
│   │   └── CurrencyContext.tsx
│   ├── hooks/                 # Custom React hooks
│   │   ├── useExchangeRateQuery.ts
│   │   └── useTradeHistory.ts
│   ├── lib/                   # Utility libraries
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── executive-service.ts
│   │   ├── executive-types.ts
│   │   ├── finance-service.ts
│   │   ├── investment-validation.ts
│   │   ├── liability-payment-validation.ts
│   │   └── utils.ts           # Utility functions (cn, formatters)
│   ├── types/                 # TypeScript type definitions
│   │   ├── next-auth.d.ts
│   │   └── trade-history.ts
│   ├── auth.config.ts         # Auth.js configuration
│   ├── auth.ts                # NextAuth initialization
│   └── middleware.ts          # Route protection middleware
├── .env                       # Environment variables
├── components.json            # shadcn/ui configuration
├── next.config.ts             # Next.js configuration
├── package.json
├── postcss.config.mjs
├── tsconfig.json
├── vercel.json                # Vercel deployment & cron jobs
└── pnpm-workspace.yaml
```

## Build and Development Commands

```bash
# Install dependencies
pnpm install

# Development server (http://localhost:3000)
pnpm dev

# Production build
pnpm build

# Start production server
pnpm start

# Linting
pnpm lint

# Database operations (via Prisma)
pnpm prisma generate        # Generate Prisma client
pnpm prisma migrate dev     # Create and apply migrations
pnpm prisma migrate deploy  # Deploy migrations to production
pnpm prisma db push         # Push schema changes (development)
pnpm prisma studio          # Open Prisma Studio
```

## Environment Variables

Create a `.env` file with these required variables:

```bash
# Database (MySQL)
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE"

# Auth.js (generate with: openssl rand -base64 32)
AUTH_SECRET="your-secret-key"
AUTH_URL="http://localhost:3000"

# Cron Job Secret (for production/Vercel)
CRON_SECRET="your-cron-secret"
```

## Code Style Guidelines

### TypeScript
- Use strict TypeScript configuration
- Define explicit types for function parameters and return values
- Avoid `any`; use `unknown` with type guards when necessary
- Use interfaces for object shapes, types for unions/intersections

### File Naming Conventions
- **Components**: PascalCase (e.g., `AddTransactionDialog.tsx`)
- **Utilities/Hooks**: camelCase (e.g., `useExchangeRate.ts`)
- **Actions**: kebab-case with `-actions` suffix (e.g., `transaction-actions.ts`)
- **Types**: kebab-case (e.g., `trade-history.ts`)

### Import Organization
Order imports as follows:
1. React/Next.js imports
2. Third-party library imports
3. Absolute imports (`@/` aliases)
4. Relative imports
5. Type imports

```typescript
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/useToast';

import { LocalComponent } from './LocalComponent';

import type { Transaction } from '@/types/transaction';
```

### Styling with Tailwind CSS
- Use Tailwind CSS utility classes
- Use the `cn()` utility for conditional class merging
- Follow the shadcn/ui design system (colors via CSS variables)
- Avoid arbitrary values when possible

```tsx
import { cn } from '@/lib/utils';

<button className={cn(
  'px-4 py-2 rounded-md',
  'bg-primary text-primary-foreground',
  'hover:bg-primary/90',
  isLoading && 'opacity-50 cursor-not-allowed'
)}>
  Click me
</button>
```

### Server Actions Pattern
All data mutations use Server Actions with this pattern:

```typescript
"use server";

import { auth } from "@/auth";
import prisma from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({
  // validation schema
});

export async function createSomething(data: InputType) {
  try {
    // 1. Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // 2. Validate input with Zod
    const validatedFields = schema.safeParse(data);
    if (!validatedFields.success) {
      return { success: false, error: validatedFields.error.issues[0].message };
    }

    // 3. Perform database operation
    const result = await prisma.model.create({
      data: { ...validatedFields.data, userId: session.user.id },
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

## Testing Instructions

**Current Testing Approach:** Manual testing (automated tests not yet implemented)

Before submitting changes, verify:
- [ ] Authentication flows work correctly
- [ ] Account creation and updates function properly
- [ ] Transactions are recorded accurately
- [ ] Investment calculations are correct
- [ ] Currency conversions work as expected
- [ ] Recurring transactions process correctly
- [ ] Dashboard metrics display accurately

Run linting before committing:
```bash
pnpm lint
```

## Database Schema Key Points

### Account Types
- `BANK`, `CASH`, `INVESTMENT` → Assets (positive balance)
- `LOAN`, `CREDIT_CARD` → Liabilities (negative balance)

### Transaction Types
- `INCOME`, `EXPENSE`, `TRANSFER`, `LIABILITY_PAYMENT`

### Important Relations
- User → FinancialAccounts, Transactions, Categories, InvestmentAssets, RecurringRules
- FinancialAccount → Transactions (from/to), InvestmentAssets
- InvestmentAsset → TradeHistories
- Transaction → Category, RecurringRule

## Authentication & Authorization

- JWT-based authentication with NextAuth.js v5
- Credentials provider (email/password) with bcrypt
- Prisma adapter for session/user storage
- Route protection via middleware (`middleware.ts`)
- Protected routes: `/dashboard/*`
- Auth routes (redirect if logged in): `/login`, `/register`

## Security Considerations

1. **Input Validation**: All user inputs validated with Zod schemas
2. **SQL Injection Prevention**: Prisma ORM uses parameterized queries
3. **XSS Protection**: React's built-in escaping
4. **CSRF Protection**: Built into NextAuth.js
5. **Route Protection**: Middleware checks authentication status
6. **Cron Job Security**: Cron endpoints require `CRON_SECRET` header

## Deployment

### Vercel Deployment
1. Connect GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Ensure MySQL database is accessible from Vercel
4. Automatic deployment on pushes to main branch

### Cron Jobs
Vercel cron job configured in `vercel.json`:
- Path: `/api/cron/recurring`
- Schedule: Daily at midnight (`0 0 * * *`)
- Processes pending recurring transactions

### Database Migration on Production
```bash
pnpm prisma migrate deploy
```

## Common Issues & Solutions

### Database Connection Errors
- Verify MySQL is running
- Check `DATABASE_URL` format
- Ensure database exists

### Authentication Issues
- Verify `AUTH_SECRET` is set
- Clear browser cookies
- Check `AUTH_URL` matches actual URL

### Build Errors
```bash
rm -rf .next && pnpm build
pnpm prisma generate
rm -rf node_modules && pnpm install
```

## External APIs

- **Yahoo Finance**: Real-time stock prices via `yahoo-finance2` package
- **Exchange Rates**: Cached in database; update via server actions

## Adding New Features

When adding a new feature, follow this structure:

```
src/
├── app/(dashboard)/dashboard/your-feature/
│   └── page.tsx
├── components/your-feature/
│   ├── FeatureComponent.tsx
│   └── FeatureDialog.tsx
├── actions/your-feature-actions.ts
├── hooks/useYourFeature.ts
├── lib/your-feature-service.ts
└── types/your-feature.ts
```

For database changes:
1. Update `prisma/schema.prisma`
2. Run `pnpm prisma migrate dev --name description`
3. Run `pnpm prisma generate`
4. Update related types and services

## Commit Message Format

Follow Conventional Commits:
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

Scopes: `auth`, `api`, `ui`, `db`, `investments`, `transactions`, `accounts`

Example:
```
feat(investments): add trade history table

- Implement trade history component
- Add server action for fetching trades
- Integrate with portfolio view
```
