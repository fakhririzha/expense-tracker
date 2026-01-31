# Expense Tracker

A comprehensive personal finance management application built with Next.js, featuring expense tracking, investment portfolio management, multi-currency support, and real-time financial insights.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [License](#license)
- [Acknowledgments](#acknowledgments)

## Overview

Expense Tracker is a modern web application designed to help users manage their personal finances effectively. It provides a unified platform for tracking expenses, managing multiple financial accounts, monitoring investment portfolios, and automating recurring transactions. The application offers real-time financial metrics including net worth calculations, wealth health scoring, and retirement progress tracking.

### Value Proposition

- **All-in-One Financial Hub**: Manage accounts, transactions, and investments in one place
- **Multi-Currency Support**: Track finances across different currencies with automatic exchange rate conversion
- **Investment Tracking**: Monitor stock portfolios with real-time price data from Yahoo Finance
- **Automated Recurring Transactions**: Set up and automatically process recurring income and expenses
- **Financial Health Insights**: Get personalized wealth health scores and retirement progress indicators
- **Secure Authentication**: Enterprise-grade authentication powered by Auth.js with JWT sessions

## Features

### Core Features

| Feature | Description |
|---------|-------------|
| **Account Management** | Create and manage multiple financial accounts (Bank, Cash, Investment, Loan, Credit Card) |
| **Transaction Tracking** | Record income, expenses, and transfers with category classification |
| **Investment Portfolio** | Track stocks and investments with real-time price updates via Yahoo Finance |
| **Recurring Transactions** | Automate regular transactions with flexible scheduling (daily, weekly, monthly, etc.) |
| **Multi-Currency** | Support for multiple currencies with automatic exchange rate conversion |
| **Financial Dashboard** | Executive overview with net worth, cash flow, and health metrics |

### Financial Metrics

- **Net Worth Calculation**: Real-time computation of total assets minus liabilities
- **Wealth Health Score**: Tier-based health rating (S, A, B, C, F) based on debt-to-wealth ratio
- **Retirement Progress**: Visual tracking towards retirement savings goals
- **Portfolio Performance**: Realized and unrealized gains/losses on investments
- **Expense Analysis**: Monthly spending patterns and category breakdowns

## Tech Stack

### Frontend
- **[Next.js 16](https://nextjs.org/)**: React framework with App Router and Server Components
- **[React 19](https://react.dev/)**: Latest React with Concurrent Features and React Compiler
- **[TypeScript](https://www.typescriptlang.org/)**: Type-safe development
- **[Tailwind CSS 4](https://tailwindcss.com/)**: Utility-first CSS framework
- **[shadcn/ui](https://ui.shadcn.com/)**: Modern accessible UI components
- **[Radix UI](https://www.radix-ui.com/)**: Headless UI primitives
- **[Lucide React](https://lucide.dev/)**: Icon library

### Backend & Data
- **[NextAuth.js v5](https://authjs.dev/)**: Authentication with JWT strategy
- **[Prisma ORM](https://www.prisma.io/)**: Type-safe database access
- **[MySQL](https://www.mysql.com/)**: Relational database
- **[Zod](https://zod.dev/)**: Schema validation

### State Management & Data Fetching
- **[TanStack Query](https://tanstack.com/query)**: Server state management and caching
- **[React Hook Form](https://react-hook-form.com/)**: Form handling with validation

### Financial Data
- **[Yahoo Finance 2](https://www.npmjs.com/package/yahoo-finance2)**: Real-time stock and market data
- **[Recharts](https://recharts.org/)**: Data visualization charts

### Development Tools
- **[ESLint](https://eslint.org/)**: Code linting
- **[pnpm](https://pnpm.io/)**: Fast, disk space efficient package manager

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 20.x (LTS) or higher
- **pnpm**: Version 9.x or higher
- **MySQL**: Version 8.0 or higher
- **Git**: For version control

### System Requirements

- **OS**: macOS, Linux, or Windows (WSL2 recommended for Windows)
- **RAM**: Minimum 4GB (8GB recommended)
- **Disk Space**: At least 2GB free space

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

### 3. Set Up Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration values (see [Configuration](#configuration) section).

### 4. Set Up the Database

Ensure MySQL is running and create the database:

```bash
# Connect to MySQL
mysql -u root -p

# Create database
CREATE DATABASE expense_tracker;
EXIT;
```

Run Prisma migrations to set up the schema:

```bash
# Generate Prisma client
pnpm prisma generate

# Run migrations
pnpm prisma migrate dev
```

### 5. Start the Development Server

```bash
pnpm dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | MySQL connection string | Yes | - |
| `AUTH_SECRET` | Secret key for JWT signing | Yes | - |
| `AUTH_URL` | Base URL for authentication callbacks | Yes | `http://localhost:3000` |
| `CRON_SECRET` | Secret for securing cron job endpoints | Yes (production) | - |

#### Database URL Format

```
mysql://USER:PASSWORD@HOST:PORT/DATABASE
```

Example:
```
mysql://root:password@localhost:3306/expense_tracker
```

#### Generating AUTH_SECRET

Generate a secure random string:

```bash
openssl rand -base64 32
```

Copy the output and use it as your `AUTH_SECRET`.

### Database Configuration

The application uses Prisma ORM. Key configuration files:

- **`prisma/schema.prisma`**: Database schema definition
- **`src/lib/db.ts`**: Prisma client initialization

### Authentication Configuration

Authentication is configured in:

- **`src/auth.ts`**: Main Auth.js configuration
- **`src/auth.config.ts`**: Authentication providers and callbacks
- **`src/middleware.ts`**: Route protection middleware

## Architecture

### System Design

```mermaid
graph TB
    subgraph Client["Client Layer"]
        Browser["Browser"]
        UI["React Components"]
        Hooks["Custom Hooks"]
        Context["Currency Context"]
    end

    subgraph NextJS["Next.js Application"]
        AppRouter["App Router"]
        ServerActions["Server Actions"]
        APIRoutes["API Routes"]
        Auth["NextAuth.js"]
    end

    subgraph DataLayer["Data Layer"]
        Prisma["Prisma ORM"]
        MySQL[("MySQL Database")]
        Cache["Next.js Cache"]
    end

    subgraph External["External Services"]
        YahooFinance["Yahoo Finance API"]
        ExchangeRate["Exchange Rate API"]
    end

    Browser --> UI
    UI --> Hooks
    Hooks --> Context
    UI --> ServerActions
    UI --> APIRoutes
    AppRouter --> ServerActions
    ServerActions --> Prisma
    ServerActions --> Cache
    ServerActions --> YahooFinance
    ServerActions --> ExchangeRate
    APIRoutes --> Prisma
    Auth --> Prisma
    Prisma --> MySQL
```

### Data Flow

1. **User Authentication**: JWT-based auth with Prisma adapter
2. **Server Actions**: Type-safe server functions for data mutations
3. **TanStack Query**: Client-side caching and state synchronization
4. **Real-time Data**: Yahoo Finance integration for live stock prices

### Security Considerations

- **CSRF Protection**: Built into NextAuth.js
- **Input Validation**: Zod schemas for all user inputs
- **SQL Injection Prevention**: Prisma ORM parameterized queries
- **XSS Protection**: React's built-in escaping
- **Route Protection**: Middleware for authentication checks

## Usage

### First-Time Setup

1. **Register an Account**: Navigate to `/register` and create your account
2. **Set Main Currency**: Configure your preferred reporting currency in settings
3. **Add Financial Accounts**: Create accounts for banks, cash, investments, etc.
4. **Set Financial Goals**: Configure retirement target and monthly budget

### Managing Accounts

```typescript
// Example: Creating a new account via Server Action
import { createAccount } from "@/actions/account-actions";

const result = await createAccount({
  name: "Main Savings",
  type: "BANK",
  currency: "IDR",
  balance: 10000000,
  description: "Primary savings account"
});
```

### Recording Transactions

```typescript
// Example: Adding a transaction
import { createTransaction } from "@/actions/transaction-actions";

const result = await createTransaction({
  amount: 500000,
  currency: "IDR",
  type: "EXPENSE",
  description: "Groceries",
  accountId: "account-id-here",
  categoryId: "category-id-here",
  date: new Date()
});
```

### Adding Investments

```typescript
// Example: Adding an investment asset
import { createInvestmentAsset } from "@/actions/investment-actions";

const result = await createInvestmentAsset({
  symbol: "AAPL",
  quantity: 10,
  avgBuyPrice: 150.00,
  currency: "USD"
});
```

### Recording Trades

```typescript
// Example: Recording a buy trade
import { addTrade } from "@/actions/investment-actions";

const result = await addTrade({
  assetId: "asset-id-here",
  type: "BUY",
  quantity: 5,
  pricePerUnit: 155.00,
  fees: 5.00,
  date: new Date()
});
```

### Setting Up Recurring Transactions

```typescript
// Example: Creating a recurring rule
import { createRecurringRule } from "@/actions/recurring-actions";

const result = await createRecurringRule({
  name: "Monthly Rent",
  amount: 5000000,
  currency: "IDR",
  type: "EXPENSE",
  interval: "MONTHLY",
  nextDueDate: new Date("2024-02-01"),
  description: "Apartment rent",
  accountId: "account-id-here",
  categoryId: "category-id-here"
});
```

## API Endpoints

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET/POST` | `/api/auth/[...nextauth]` | NextAuth.js authentication handlers |

### REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/categories` | List all categories |
| `POST` | `/api/categories` | Create new category |
| `GET` | `/api/investments/[id]/trades` | Get trades for an investment |
| `POST` | `/api/investments/[id]/trades` | Add trade to investment |
| `GET` | `/api/cron/recurring` | Process recurring transactions (cron job) |
| `GET` | `/api/exchange-rate` | Get current exchange rates |

### Server Actions

All data mutations are handled through Server Actions located in `src/actions/`:

- **`account-actions.ts`**: Account CRUD operations
- **`transaction-actions.ts`**: Transaction management
- **`investment-actions.ts`**: Investment and trade operations
- **`recurring-actions.ts`**: Recurring transaction rules
- **`exchange-rate-actions.ts`**: Exchange rate operations
- **`auth-actions.ts`**: Authentication helpers

## Project Structure

```
expense-tracker/
├── prisma/                     # Database schema and migrations
│   ├── schema.prisma          # Prisma schema definition
│   └── migrations/            # Database migrations
├── public/                     # Static assets
├── src/
│   ├── actions/               # Server Actions for data mutations
│   │   ├── account-actions.ts
│   │   ├── auth-actions.ts
│   │   ├── exchange-rate-actions.ts
│   │   ├── investment-actions.ts
│   │   ├── recurring-actions.ts
│   │   └── transaction-actions.ts
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/            # Auth route group
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/       # Dashboard route group
│   │   │   └── dashboard/
│   │   │       ├── accounts/
│   │   │       ├── investments/
│   │   │       ├── recurring/
│   │   │       └── transactions/
│   │   ├── api/               # API routes
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/            # React components
│   │   ├── accounts/
│   │   ├── dashboard/
│   │   ├── investments/
│   │   ├── providers/
│   │   ├── recurring/
│   │   ├── transactions/
│   │   └── ui/               # shadcn/ui components
│   ├── contexts/             # React contexts
│   │   └── CurrencyContext.tsx
│   ├── hooks/                # Custom React hooks
│   │   ├── useExchangeRateQuery.ts
│   │   └── useTradeHistory.ts
│   ├── lib/                  # Utility libraries
│   │   ├── db.ts            # Prisma client
│   │   ├── executive-service.ts
│   │   ├── executive-types.ts
│   │   ├── finance-service.ts
│   │   └── utils.ts
│   ├── types/                # TypeScript type definitions
│   │   ├── next-auth.d.ts
│   │   └── trade-history.ts
│   ├── auth.config.ts
│   ├── auth.ts
│   └── middleware.ts
├── .env                       # Environment variables
├── components.json            # shadcn/ui configuration
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── vercel.json               # Vercel deployment configuration
```

## Contributing

We welcome contributions! Please follow these guidelines:

### Development Workflow

1. **Fork the Repository**: Create your own fork of the project
2. **Create a Branch**: `git checkout -b feature/your-feature-name`
3. **Make Changes**: Implement your feature or bug fix
4. **Test**: Ensure your changes work as expected
5. **Commit**: Use conventional commits (`feat:`, `fix:`, `docs:`, etc.)
6. **Push**: `git push origin feature/your-feature-name`
7. **Pull Request**: Submit a PR with a clear description

### Code Standards

- **TypeScript**: All code must be type-safe
- **ESLint**: Follow the configured linting rules
- **Formatting**: Use consistent formatting (2 spaces indentation)
- **Component Structure**: Follow existing component patterns
- **Naming**: Use descriptive names for variables, functions, and components

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example:
```
feat(accounts): add support for investment account type

- Add INVESTMENT to AccountType enum
- Update account creation form
- Add portfolio tracking for investment accounts
```

## Testing

### Running Tests

Currently, the project uses manual testing. To add automated tests:

```bash
# Install testing dependencies
pnpm add -D vitest @testing-library/react @testing-library/jest-dom

# Run tests (when implemented)
pnpm test
```

### Manual Testing Checklist

Before submitting changes, verify:

- [ ] Authentication flows work correctly
- [ ] Account creation and updates function properly
- [ ] Transactions are recorded accurately
- [ ] Investment calculations are correct
- [ ] Currency conversions work as expected
- [ ] Recurring transactions process correctly
- [ ] Dashboard metrics display accurately

## Deployment

### Deploying to Vercel

1. **Connect Repository**: Link your GitHub repository to Vercel
2. **Configure Environment Variables**: Add all required env vars in Vercel dashboard
3. **Database Setup**: Ensure your MySQL database is accessible from Vercel
4. **Deploy**: Vercel will automatically deploy on pushes to main branch

### Vercel Configuration

The `vercel.json` file configures:

- **Cron Jobs**: Daily recurring transaction processing
- **Build Settings**: Node.js runtime configuration

Example `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/recurring",
      "schedule": "0 0 * * *"
    }
  ]
}
```

### Database Migration on Production

Before deploying:

```bash
# Run migrations on production database
pnpm prisma migrate deploy
```

### Self-Hosting

For self-hosted deployments:

1. **Build the Application**:
   ```bash
   pnpm build
   ```

2. **Start Production Server**:
   ```bash
   pnpm start
   ```

3. **Configure Reverse Proxy**: Use Nginx or similar for SSL and routing

## Troubleshooting

### Common Issues

#### Database Connection Errors

**Problem**: `Can't reach database server`

**Solution**:
- Verify MySQL is running: `sudo systemctl status mysql`
- Check connection string format in `.env`
- Ensure database exists: `CREATE DATABASE expense_tracker;`

#### Authentication Issues

**Problem**: `JWT must be provided` or session errors

**Solution**:
- Verify `AUTH_SECRET` is set and properly formatted
- Clear browser cookies and local storage
- Check `AUTH_URL` matches your actual URL

#### Build Errors

**Problem**: `Module not found` or TypeScript errors

**Solution**:
- Delete `.next` folder and rebuild: `rm -rf .next && pnpm build`
- Regenerate Prisma client: `pnpm prisma generate`
- Reinstall dependencies: `rm -rf node_modules && pnpm install`

#### Exchange Rate Fetching Issues

**Problem**: Exchange rates not updating

**Solution**:
- Check internet connectivity
- Verify no firewall blocking API calls
- Clear cache: The app caches exchange rates for performance

### Getting Help

If you encounter issues not covered here:

1. Check the [GitHub Issues](https://github.com/yourusername/expense-tracker/issues)
2. Review the [Next.js Documentation](https://nextjs.org/docs)
3. Consult the [Prisma Documentation](https://www.prisma.io/docs)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

### Technologies & Libraries

- **[Next.js](https://nextjs.org/)**: The React Framework for the Web
- **[Auth.js](https://authjs.dev/)**: Authentication for the Web
- **[Prisma](https://www.prisma.io/)**: Next-generation ORM
- **[shadcn/ui](https://ui.shadcn.com/)**: Beautifully designed components
- **[Radix UI](https://www.radix-ui.com/)**: Unstyled, accessible components
- **[TanStack Query](https://tanstack.com/query)**: Powerful asynchronous state management
- **[Yahoo Finance](https://finance.yahoo.com/)**: Financial data provider

### Contributors

Thank you to all contributors who have helped make this project better!

### Inspiration

This project was inspired by the need for a simple yet powerful personal finance tool that combines expense tracking with investment management in a single, intuitive interface.

---

Built with ❤️ using Next.js and modern web technologies.
