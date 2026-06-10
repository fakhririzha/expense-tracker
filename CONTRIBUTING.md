# Contributing to Expense Tracker

Thank you for contributing to Expense Tracker, branded in the app as **FinHealth**. This guide describes the current development workflow, project conventions, and verification expectations.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Domain Rules](#domain-rules)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Project Structure Guidelines](#project-structure-guidelines)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Questions and Support](#questions-and-support)

## Code of Conduct

This project and everyone participating in it is governed by a commitment to:

- Be respectful and constructive.
- Welcome newcomers and help them get oriented.
- Focus feedback on the code, behavior, and user impact.
- Respect different viewpoints and experiences.

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- pnpm 9.x or higher
- MySQL or MariaDB 8.0+
- Git

### Local Setup

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/YOUR_USERNAME/expense-tracker.git
   cd expense-tracker
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Create `.env` in the project root:

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

4. Create the local database:

   ```sql
   CREATE DATABASE expense_tracker;
   ```

5. Run migrations and generate the Prisma client:

   ```bash
   pnpm db:migrate:dev
   pnpm prisma generate
   ```

6. Start the development server:

   ```bash
   pnpm dev
   ```

The app runs at `http://localhost:3000` by default.

## Development Workflow

### Branching

- Use focused feature or fix branches, for example `feature/loans-receivable-summary` or `fix/transaction-balance-update`.
- Keep PRs scoped to one user-visible feature, bug fix, or maintenance concern.
- Rebase or merge from the target branch before opening a PR if your branch is stale.

### Available Commands

```bash
pnpm dev              # Start Next.js dev server
pnpm build            # prisma generate && next build
pnpm start            # Start production server
pnpm lint             # Run ESLint
pnpm db:migrate:dev   # npx prisma@^7.4.1 migrate dev
pnpm db:migrate:prod  # npx prisma@^7.4.1 migrate deploy
pnpm prisma generate  # Generate Prisma client
pnpm prisma db push   # Push schema changes in development when appropriate
```

There is no dedicated `pnpm type-check` script in the current `package.json`. Use `pnpm build` when you need build-level TypeScript validation.

## Coding Standards

### TypeScript

- Use strict TypeScript.
- Avoid `any`; prefer `unknown` with type guards when necessary.
- Define explicit types where they improve clarity or protect public/action interfaces.
- Use interfaces for object shapes and types for unions/intersections.

```typescript
interface AccountSummary {
  id: string;
  name: string;
  currency: string;
  balance: number;
}

function normalizeBalance(summary: AccountSummary): number {
  return summary.balance;
}
```

### React Components

- Use functional components.
- Use Server Components by default.
- Add `'use client'` only for state, effects, event handlers, browser APIs, or TanStack Query hooks.
- Keep components focused and aligned with existing feature folders.
- Use shadcn/ui primitives and existing UI patterns before adding new primitives.

```tsx
"use client";

import { useState } from "react";

export function ExampleToggle() {
  const [enabled, setEnabled] = useState(false);
  return (
    <button type="button" onClick={() => setEnabled((value) => !value)}>
      {enabled ? "Enabled" : "Disabled"}
    </button>
  );
}
```

### Styling

- Use Tailwind CSS 4 utilities and semantic CSS variables from `src/app/globals.css`.
- Use `cn()` from `@/lib/utils` for conditional class merging.
- Follow `components.json`: shadcn/ui New York style, CSS variables, and Lucide icons.
- Keep responsive layouts readable across mobile and desktop.

```tsx
import { cn } from "@/lib/utils";

<button
  className={cn(
    "rounded-md px-4 py-2",
    "bg-primary text-primary-foreground",
    isLoading && "cursor-not-allowed opacity-50"
  )}
>
  Save
</button>;
```

### File Naming

- Components: PascalCase, e.g. `AddTransactionDialog.tsx`.
- Hooks/utilities: camelCase, e.g. `useReceivableQueries.ts`.
- Actions: kebab-case with `-actions` suffix, e.g. `receivable-actions.ts`.
- Types: kebab-case, e.g. `trade-history.ts`.

### Import Order

1. React/Next.js imports
2. Third-party imports
3. Absolute imports using `@/`
4. Relative imports
5. Type imports

## Domain Rules

### Server Actions

- Put mutations and authenticated server-side reads in `src/actions`.
- Start Server Action files with `"use server"`.
- Call `auth()` and require `session.user.id` for user-owned operations.
- Validate inputs with Zod before database work.
- Return `{ success: boolean, data?: T, error?: string }`.
- Revalidate affected dashboard routes after mutations.
- Handle useful Prisma errors such as `P2002` and `P2025` with specific messages.

### User Isolation

- Every query for user-owned models must include `userId`.
- Do not add `userId` filters to global tables such as `ExchangeRate`.
- For workflows involving multiple records, validate ownership of every involved account, transaction, asset, goal, category, or rule.

### Balance Integrity

- Balance-changing workflows must use Prisma transactions.
- This applies to regular transactions, transfers, liability payments, investment trades, and Loans Receivable disbursement/repayment.
- Use `src/lib/account-types.ts` for account classification and balance normalization.
- `LOAN_RECEIVABLE` is an asset account type; `LOAN` and `CREDIT_CARD` are liability account types.

### Encryption

- Use `src/lib/user-encryption.ts` helpers for sensitive text fields.
- Prefer encrypted companion fields such as `descriptionEncrypted`, `notesEncrypted`, and `nameEncrypted` where implemented.
- Keep `ENCRYPTION_MASTER_KEY` stable for environments that use encrypted data.
- Back up the database before running `src/scripts/migrate-encryption.ts`.

### Financial Data

- Yahoo Finance requests should retain caching, batching/rate-limit awareness, and graceful error handling.
- Never assume quote or exchange-rate data is available.
- Preserve fallback values and usable UI states when market data is missing.
- Use `src/lib/unit-conversion.ts` for precious-metal unit conversion.

### TanStack Query

- Define query key factories per feature.
- Throw `new Error(result.error)` from query/mutation wrappers when Server Actions return `success: false`.
- Invalidate all related feature keys after mutations, especially accounts and transactions after balance-moving changes.

## Commit Message Guidelines

Use Conventional Commits:

```text
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Common types:

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Formatting-only changes
- `refactor` - Refactoring without behavior change
- `perf` - Performance improvement
- `test` - Test additions or updates
- `chore` - Tooling, dependency, or maintenance work

Common scopes:

- `accounts`
- `auth`
- `budgets`
- `categories`
- `dashboard`
- `db`
- `goals`
- `investments`
- `liabilities`
- `receivables`
- `reports`
- `transactions`
- `ui`

Examples:

```text
feat(receivables): add repayment history summary
fix(transactions): preserve account ownership checks on transfer edit
docs(readme): refresh setup commands
chore(deps): update prisma to v7.4.1
```

## Pull Request Process

### Before Submitting

1. Review your diff and remove unrelated changes.
2. Run linting:

   ```bash
   pnpm lint
   ```

3. Run a build when your change touches TypeScript, Next.js routing, Prisma, auth, or shared domain logic:

   ```bash
   pnpm build
   ```

4. Manually test the affected feature and adjacent financial summaries.
5. Update documentation or `content/changelog.md` when the change is user-facing.

### PR Description Template

```markdown
## Description
Brief description of the change.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Maintenance/refactor

## Testing
Describe commands and manual flows tested.

## Checklist
- [ ] I validated user ownership and auth requirements
- [ ] I preserved balance integrity for financial workflows
- [ ] I handled loading, empty, and error states
- [ ] I updated docs/changelog where appropriate
```

### Review Expectations

- Keep PRs focused and reasonably sized.
- Prefer behavior-level explanations over implementation trivia.
- Call out schema, auth, encryption, or balance-affecting changes explicitly.
- Address review comments with either code changes or a concrete explanation.

## Project Structure Guidelines

When adding a feature, follow the existing route/action/hook/component split:

```text
src/
├── app/
│   └── (dashboard)/
│       └── dashboard/
│           └── your-feature/
│               └── page.tsx
├── components/
│   └── your-feature/
│       ├── FeatureManager.tsx
│       └── FeatureDialog.tsx
├── actions/
│   └── your-feature-actions.ts
├── hooks/
│   └── useYourFeatureQueries.ts
├── lib/
│   └── your-feature-service.ts
└── types/
    └── your-feature.ts
```

Only add each layer when the feature needs it. Small changes should stay close to the existing module they affect.

### Database Changes

1. Update `prisma/schema.prisma`.
2. Create a migration:

   ```bash
   pnpm db:migrate:dev
   ```

3. Generate the Prisma client:

   ```bash
   pnpm prisma generate
   ```

4. Update related actions, hooks, services, types, and manual test coverage.
5. For production, deploy migrations with:

   ```bash
   pnpm db:migrate:prod
   ```

### API Routes

For new API endpoints:

- Place routes under `src/app/api/<resource>/route.ts`.
- Use API routes for Auth.js handlers, cron/scheduled jobs, or client-friendly reads that need route semantics.
- Prefer Server Actions for app mutations.
- Validate inputs and filters before Prisma queries.
- Return clear status codes and JSON errors.

## Testing Guidelines

### Current Test Setup

The project currently uses linting plus manual testing. There is no committed automated test runner script at this time.

```bash
pnpm lint
```

Use `pnpm build` for broader validation when appropriate.

### Manual Testing Checklist

- Authentication and protected-route behavior.
- Account CRUD, account type grouping, and balance normalization.
- Transaction creation/editing, transfers, location metadata, and balance updates.
- Liability payments, overpayments, audit trails, and rollback behavior.
- Loans Receivable disbursement and repayment flows.
- Investment buy/sell trades, realized/unrealized PnL, unit conversions, Yahoo Finance fallbacks, and valuation calculations.
- Currency conversion and exchange-rate caching.
- Personal asset valuation and disposal history.
- Recurring transaction processing.
- Budgets, goals, profile targets, dashboard metrics, reports, calendar, and sidebar summaries.
- Import/export and category management.
- Responsive behavior and keyboard accessibility for UI changes.

## Documentation

### README Updates

Update `README.md` when changing:

- Setup steps or commands
- Environment variables
- Major features or workflows
- API routes or Server Action areas
- Deployment behavior

### Changelog Updates

Update `content/changelog.md` when a change is user-facing enough to matter in release notes.

- Use product language.
- Keep entries concise, usually two to four bullets.
- Place the newest version at the top.
- Describe outcomes such as clearer navigation, smoother forms, better mobile layout, or more accurate balances.
- Do not overstate internal cleanup; call it maintenance when appropriate.

### Code Comments

- Comment the reason for non-obvious decisions.
- Avoid comments that only repeat what the code says.
- Use JSDoc for public helpers or complex financial calculations when it improves maintainability.

## Questions and Support

### Getting Help

- Check [README.md](./README.md).
- Search existing issues.
- Review feature-specific files under `src/actions`, `src/hooks`, `src/lib`, and `src/components`.

### Reporting Bugs

Include:

1. Clear description of the bug.
2. Steps to reproduce.
3. Expected behavior.
4. Actual behavior.
5. Screenshots if useful.
6. Environment details such as OS, browser, Node version, and database.

### Requesting Features

Include:

1. The user workflow or financial scenario.
2. Why the change is valuable.
3. Which existing feature area it affects.
4. Any schema, balance, auth, or reporting implications you can identify.

---

Thank you for contributing to Expense Tracker.
