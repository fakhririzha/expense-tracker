# Contributing to Expense Tracker

Thank you for your interest in contributing to Expense Tracker! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Project Structure Guidelines](#project-structure-guidelines)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Questions and Support](#questions-and-support)

## Code of Conduct

This project and everyone participating in it is governed by our commitment to:

- Be respectful and inclusive in all interactions
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Respect different viewpoints and experiences

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 20.x (LTS) or higher
- **pnpm**: Version 9.x or higher
- **MySQL**: Version 8.0 or higher
- **Git**: For version control

### Setting Up Your Development Environment

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/expense-tracker.git
   cd expense-tracker
   ```

3. **Install dependencies**:
   ```bash
   pnpm install
   ```

4. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your local configuration (database credentials, auth secrets, etc.)

5. **Set up the database**:
   ```bash
   pnpm prisma migrate dev
   pnpm prisma generate
   ```

6. **Start the development server**:
   ```bash
   pnpm dev
   ```

The application should now be running at `http://localhost:3000`.

## Development Workflow

### Branching Strategy

We follow a simplified Git Flow approach:

- **`main`**: Production-ready code
- **`develop`**: Integration branch for features
- **Feature branches**: `feature/description-of-feature`
- **Bug fix branches**: `fix/description-of-bug`
- **Hotfix branches**: `hotfix/description` (for urgent production fixes)

### Creating a New Feature

1. Create a new branch from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following our [coding standards](#coding-standards)

3. Commit your changes following our [commit message guidelines](#commit-message-guidelines)

4. Push your branch to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

5. Open a Pull Request against the `develop` branch

## Coding Standards

### TypeScript

- Use **strict TypeScript** configuration
- Define explicit types for function parameters and return values
- Avoid using `any` - use `unknown` with type guards when necessary
- Use interfaces for object shapes, types for unions/intersections

```typescript
// Good
interface User {
  id: string;
  name: string;
  email: string;
}

function getUserById(id: string): Promise<User | null> {
  // implementation
}

// Bad
function getUserById(id: any): any {
  // implementation
}
```

### React Components

- Use **functional components** with hooks
- Follow the **Next.js App Router** patterns
- Use Server Components by default, Client Components only when necessary
- Keep components focused and single-responsibility

```typescript
// Server Component (default)
export default async function DashboardPage() {
  const data = await fetchDashboardData();
  return <Dashboard data={data} />;
}

// Client Component (when needed)
'use client';

import { useState } from 'react';

export function InteractiveButton() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

### Styling with Tailwind CSS

- Use **Tailwind CSS** utility classes
- Follow the existing design system (colors, spacing, typography)
- Use the `cn()` utility for conditional class merging
- Avoid arbitrary values when possible

```tsx
// Good
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

### File Naming Conventions

- **Components**: PascalCase (e.g., `AddTransactionDialog.tsx`)
- **Utilities/Hooks**: camelCase (e.g., `useExchangeRate.ts`)
- **Actions**: kebab-case with `-actions` suffix (e.g., `transaction-actions.ts`)
- **Types**: kebab-case (e.g., `trade-history.ts`)

### Import Organization

Organize imports in this order:

1. React/Next.js imports
2. Third-party library imports
3. Absolute imports (`@/` aliases)
4. Relative imports
5. Type imports

```typescript
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { format } from 'date-fns';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/useToast';

import { LocalComponent } from './LocalComponent';

import type { Transaction } from '@/types/transaction';
```

## Commit Message Guidelines

We follow **Conventional Commits** specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- **`feat`**: New feature
- **`fix`**: Bug fix
- **`docs`**: Documentation changes
- **`style`**: Code style changes (formatting, semicolons, etc.)
- **`refactor`**: Code refactoring
- **`perf`**: Performance improvements
- **`test`**: Adding or updating tests
- **`chore`**: Build process or auxiliary tool changes

### Scopes

Common scopes for this project:

- **`auth`**: Authentication related
- **`api`**: API routes
- **`ui`**: UI components
- **`db`**: Database/Prisma changes
- **`investments`**: Investment features
- **`transactions`**: Transaction features
- **`accounts`**: Account features

### Examples

```
feat(investments): add trade history table

fix(auth): resolve session expiration issue
docs(readme): update installation instructions
refactor(ui): simplify dialog component structure
chore(deps): update prisma to v6
```

## Pull Request Process

### Before Submitting

1. **Sync with upstream**:
   ```bash
   git fetch upstream
   git rebase upstream/develop
   ```

2. **Run linting**:
   ```bash
   pnpm lint
   ```

3. **Run type checking**:
   ```bash
   pnpm type-check
   ```

4. **Test your changes** manually

### PR Description Template

```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## How Has This Been Tested?
Describe the tests you ran

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code where necessary
- [ ] My changes generate no new warnings
- [ ] I have updated the documentation accordingly
```

### Review Process

1. All PRs require at least **one review** before merging
2. Address review comments promptly
3. Keep PRs focused and reasonably sized
4. Be open to feedback and suggestions

## Project Structure Guidelines

When adding new features, follow the existing structure:

### Adding a New Feature

```
src/
├── app/
│   └── (dashboard)/
│       └── dashboard/
│           └── your-feature/
│               └── page.tsx          # Route page
├── components/
│   └── your-feature/
│       ├── FeatureComponent.tsx      # Main component
│       └── FeatureDialog.tsx         # Dialog/Modal
├── actions/
│   └── your-feature-actions.ts       # Server actions
├── hooks/
│   └── useYourFeature.ts             # Custom hook
├── lib/
│   └── your-feature-service.ts       # Business logic
└── types/
    └── your-feature.ts               # TypeScript types
```

### Database Changes

When modifying the database schema:

1. Update `prisma/schema.prisma`
2. Create a migration:
   ```bash
   pnpm prisma migrate dev --name description_of_changes
   ```
3. Update the Prisma client:
   ```bash
   pnpm prisma generate
   ```
4. Update related types and services

### API Routes

For new API endpoints:

- Place in `src/app/api/<resource>/route.ts`
- Follow RESTful conventions
- Include proper error handling
- Validate inputs with Zod

## Testing Guidelines

### Manual Testing

Before submitting, test:

- [ ] Feature works as expected
- [ ] Error states are handled gracefully
- [ ] Loading states are implemented
- [ ] Responsive design on different screen sizes
- [ ] Authentication flows (if applicable)

### Test Checklist for UI Changes

- [ ] Light and dark mode (if supported)
- [ ] Different browser viewports
- [ ] Keyboard navigation
- [ ] Screen reader compatibility (where applicable)

## Documentation

### Code Comments

- Use JSDoc for public functions and complex logic
- Explain the "why" not just the "what"
- Keep comments up-to-date with code changes

```typescript
/**
 * Calculates the wealth health score based on debt-to-wealth ratio
 * @param totalAssets - Sum of all asset values
 * @param totalLiabilities - Sum of all liability values
 * @returns Health score tier (S, A, B, C, F)
 */
function calculateWealthHealth(
  totalAssets: number,
  totalLiabilities: number
): HealthTier {
  // Implementation
}
```

### README Updates

Update README.md when:

- Adding new major features
- Changing installation steps
- Modifying environment variables
- Updating API endpoints

## Questions and Support

### Getting Help

- Check existing [documentation](./README.md)
- Search [existing issues](https://github.com/fakhririzha/expense-tracker/issues)
- Ask in discussions for general questions

### Reporting Bugs

When reporting bugs, please include:

1. **Description**: Clear description of the bug
2. **Steps to Reproduce**: Numbered steps
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Screenshots**: If applicable
6. **Environment**: OS, browser, Node version

### Requesting Features

For feature requests:

1. Check if it already exists in issues
2. Describe the use case
3. Explain why it would be valuable
4. Suggest implementation approach if you have one

---

## Recognition

Contributors will be recognized in our README.md file and release notes.

Thank you for contributing to Expense Tracker!
