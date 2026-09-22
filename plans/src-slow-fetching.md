# Slow fetching in `src`

This is a static read of the web app under `src`. No profiler, `EXPLAIN`, or browser timing was captured, so the ranking is by what each request loads and how many times a single page repeats it. Cost grows with holdings (Yahoo Finance) and with transactions (row scans and decryption). Account, budget, and goal tables are small by comparison.

`Transaction` already has `@@index([userId, date])`, `@@index([userId, type, date])`, and `@@index([userId, accountId, date])`. The hot filters can use those indexes. The pages are slow because they load too many rows, too many times, and because live quotes sit on the blocking path.

## What a home-page load does

`/dashboard` does not stream. There is no `loading.tsx` under `src/app`. The dashboard layout is `force-dynamic` (`src/app/(dashboard)/layout.tsx` line 26), so the first document waits on `auth()` and a `user.findUnique` for `mainCurrency` before the page starts.

The page then waits on one `Promise.all` (`src/app/(dashboard)/dashboard/page.tsx` lines 48–58):

1. `getExecutiveMetrics()` — six months of transactions, then a live portfolio valuation.
2. `getDashboardMoneyPlan()` — month spending, a 90-day cash-flow forecast, and `getFinancialInsights({ limit: 3 })`.
3. The full `content/changelog.md`, read from disk and passed into the page.
4. Twelve stored net-worth snapshots. This part is a narrow `take`.

Inside that wait, portfolio valuation runs twice in parallel: once from executive metrics (`src/lib/executive-service.ts` lines 196–199) and once from insights (`src/actions/insight-actions.ts` lines 676–679). Nothing wraps those services in `React.cache` or an in-flight lock. A cold cache can hit Yahoo from both calls.

After hydration, the sidebar asks for the same executive metrics again. `Sidebar` is `hidden md:flex`, so the component still mounts on every viewport (`src/components/dashboard/Sidebar.tsx` lines 209–210 and 343–349). `useSidebarMetrics` calls `getExecutiveMetrics()` and `getBudgetSpendingSummary()` (`src/hooks/useSidebarMetrics.ts` lines 33–41). The server render does not seed the React Query cache, so this is a new server-action POST. The mobile sheet has a second `SidebarGoalSnapshot`; both share the query key `["sidebarMetrics", "currentMonth", …]`, so React Query keeps that to one request while the data is fresh.

Query defaults are already conservative: 5-minute `staleTime`, no refetch on focus or reconnect, one retry (`src/components/providers/QueryProvider.tsx` lines 19–30). The repeat happens because the sidebar and the page do not share a result, and because the sidebar result expires after five minutes on the next mount.

One cold visit to `/dashboard` therefore does:

| Work | Times | Grows with |
| --- | --- | --- |
| Yahoo quote fan-out for every active holding | 2 on the server, then 1 from the sidebar | Holdings |
| Six-month transaction scan | 2 (page, then sidebar) | Transactions |
| Year-to-date transaction scan with categories and splits | 1 (insights, even though the card shows 3 items) | Transactions since 1 January |
| 90-day forecast history, with account-name decryption per row | 1 | Transactions |
| Month-to-date spend scan, amount and rate only | 2 (money plan, then sidebar) | Transactions this month |

The mobile dashboard uses the same function. `GET /api/mobile/v1/dashboard` calls `getExecutiveMetricsForUser` and sends `Cache-Control: private, no-store` (`src/app/api/mobile/v1/dashboard/route.ts` lines 14–27). A faster shared valuation helps the phone as well as the web home page.

Profile pays the same executive-metrics cost to display one net-worth figure (`src/app/(dashboard)/dashboard/profile/page.tsx` lines 26–39 and 123), and the sidebar computes it again.

## Ranked findings

### 1. Live portfolio valuation is on the blocking path, and it is repeated

`getCurrentPortfolioValuation` (`src/lib/investment-valuation-service.ts` lines 270–307) loads every holding, then `getMultipleAssetPrices` for every active symbol, one `tradeHistory.groupBy` for realized P&L, and at most one stored Pegadaian snapshot. Pegadaian is a `findFirst` of the latest snapshot. The cron is what calls Pegadaian. The request path calls Yahoo.

`getMultipleAssetPrices` (`src/lib/finance-service.ts` lines 102–124) calls `yahooFinance.quote` once per symbol, five symbols at a time, and sleeps 100ms between batches. The sleep runs even when `getAssetPrice` is already cached. Twenty holdings cost three sleeps (300ms) on every valuation; fifty holdings cost nine (900ms). Duplicate symbols are not removed before batching, so two lots of the same symbol each take a batch slot.

`getAssetPrice` is `unstable_cache` for 300 seconds (lines 57–99). Failed quotes are returned as objects with `regularMarketPrice: 0`, so a failure can sit in that cache for five minutes. Quote fetches have no timeout. Exchange-rate quotes do: 8 seconds, plus an in-flight map (`src/lib/finance-service.ts` lines 202–262). Quotes have no equivalent in-flight map, so the two parallel valuations on the home page can both miss.

Callers of the full valuation:

- `getExecutiveMetricsForUser` — home, profile, sidebar, mobile dashboard
- `getFinancialInsights` — home money plan, and `/dashboard/insights`
- `getAccountsSummary` — `/dashboard/liabilities` (server, blocking) and `/dashboard/accounts` (client)
- `getPortfolio` — `/dashboard/investments`

The home page and the sidebar only need `summary` totals. The valuation still waits for every symbol before it returns.

### 2. The home page builds insights and a forecast before it can paint

`getDashboardMoneyPlan` (`src/actions/dashboard-money-plan-actions.ts` lines 38–56) always calls:

- `getBudgetSpendingSummary` for the current month
- `getCashFlowForecast` with future transactions, recurring rules, and subscriptions, and `variableSpendingMode: "none"`
- `getFinancialInsights({ scope: "dashboard", limit: 3 })`

`limit: 3` trims the returned cards. It does not trim the reads. `getFinancialInsights` (`src/actions/insight-actions.ts` lines 508–680) loads, in one `Promise.all`:

- active accounts, personal assets, budgets (with categories), goals (with linked accounts), upcoming recurring rules, upcoming subscriptions
- every transaction from `getBudgetQueryFloor(now)` through now, with category and every split (lines 619–665)
- two net-worth snapshots
- another full portfolio valuation

The floor (`src/actions/insight-actions.ts` lines 107–115) is the earliest of 1 January, 180 days ago, and the six-month lookback. From July onward that is year-to-date. By December it is about twelve months of every transaction type. Splits are capped at 20 per expense, so a split-heavy year multiplies the payload. Income, expense, and liability rows are then separated in memory.

After that block, goal progress walks goals one by one and each goal walks linked accounts one by one for FX (`src/actions/insight-actions.ts` lines 362–375, `src/lib/goal-progress.ts` lines 54–59). A separate `debtPlan.findFirst` then runs the payoff simulation (`src/actions/insight-actions.ts` lines 949–978). FX pairs are cached after the first miss. The serial walk still sits on the home-page critical path.

The forecast (`src/actions/forecast-actions.ts` lines 241–506) loads the user, then every active account, decrypts every account, and only then loads future transactions, rules, subscriptions, and 90 days of history (`getHistoricalLookbackStart` in `src/lib/forecasting/historical-spending-estimator.ts` lines 81–83). History is loaded even when variable spending is `"none"`. Each history and future row decrypts source and destination account names with no account-id cache (lines 508–587). The user encryption key is cached after the first lookup (`src/lib/user-encryption.ts` lines 64–71), so this is repeated AES and a larger payload, not a SQL round trip per row. The same account names were already decrypted once from the account query. The history loop then `await`s `buildTransactionEvent` one transaction at a time (lines 664–679).

Budget-mode forecasting is worse and is not the home-page default. When `variableSpendingMode === "budget"`, each budget runs its own expense `findMany` for the budget period, including splits (lines 719–749, and a second query per legacy budget near line 784). The reports Forecast tab can select that mode. The home page does not.

### 3. Sums are computed by loading every row

These reads exist to add numbers. Each one returns the rows and adds them in JavaScript. `amount * exchangeRate` is already stored per transaction, so a grouped SQL sum can do the same job for the all-currency totals.

- Executive metrics, six months, narrow select of `type`, `amount`, `exchangeRate`, `date` (`src/lib/executive-service.ts` lines 29–34 and 121–137). Transfers are loaded and then ignored. The UI needs monthly income and expense averages.
- `getBudgetSpendingSummary` (`src/actions/budget-actions.ts` lines 402–417). Month-to-date amount and rate only. Called by the money plan and again by the sidebar.
- `getMonthSummary` (`src/actions/calendar-actions.ts` lines 571–594). No `select`. The whole month of income and expense rows, including encrypted text, is loaded to multiply `amount * exchangeRate`.

The `(userId, type, date)` index can serve a grouped query. The win is fewer rows on the wire and less JavaScript, not a new index.

### 4. Several pages fire two copies of the same read

React Query dedupes identical keys. These pairs use different actions, so both run.

| Page | Both run on first visit | What is repeated |
| --- | --- | --- |
| Every dashboard route | Sidebar `useSidebarMetrics` | Full executive metrics, including Yahoo, plus the month spend scan |
| `/dashboard` | Page RSC plus sidebar | Executive metrics a second time after the HTML wait; month spend a second time |
| `/dashboard/accounts` | `useAccounts` and `useAccountsSummary` (`page.tsx` lines 327–328) | Full account decrypt. Summary then does live valuation |
| `/dashboard/budgets` | `useBudgetsSummary` and `useBudgetVsActual` (lines 49–50) | Spending transactions from the earliest budget period through the latest, with categories and splits (`src/actions/budget-actions.ts` lines 759–766 and 843–850). A yearly budget makes that a year |
| `/dashboard/goals` | `useGoalsSummary` and `useGoalsStats` | All goals with linked accounts (`src/actions/goal-actions.ts` lines 569–618). Stats then walks goals serially for FX |
| `/dashboard/subscriptions` | `useSubscriptions` and `useSubscriptionSummary` | `getSubscriptionSummary` calls `getSubscriptions()` (`src/actions/subscription-actions.ts` lines 683–689), and the list hook calls it again. Every row is decrypted, including category, account, and linked rule |
| `/dashboard/investments` | `usePortfolio` plus the sidebar | Two valuations. The page needs the holding rows; the sidebar only needs totals. Closed dialogs still call `useInvestmentAccounts` and `useSellableInvestments` (`AddInvestmentDialog.tsx` line 101, `RecordSellTradeDialog.tsx` line 84). Symbol search stays off until the query is at least 2 characters |
| `/dashboard/liabilities` | Server `getAccountsSummary`, then the sidebar | Summary values the whole portfolio before the debt list can render (`src/app/(dashboard)/dashboard/liabilities/page.tsx` line 24, `src/actions/account-actions.ts` lines 428–494) |

`getAccountsSummary` also loads active accounts with no `select`, decrypts them, and awaits `getExchangeRate` inside a `for` per account and again per personal asset (lines 461–483). Distinct currencies wait one after another. The liabilities page then filters that payload down to loans and credit cards. `getAccountsForUser` (`src/server/accounts/account-query-service.ts` lines 10–21) is a separate full-table read with `include: { bankInterestSetting: true }` and a decrypt of every name and description. The accounts page runs both.

`getPersonalAssetSummary` has the same per-row FX loop (`src/actions/personal-asset-actions.ts` lines 176–181) while the assets page also loads the asset list.

### 5. Calendar loads the month three times

`/dashboard/calendar` is a client page. On mount it calls `useCalendarEvents`, `useUpcomingBills(7)`, and `useMonthSummary` together (`src/app/(dashboard)/dashboard/calendar/page.tsx` lines 43–46).

- `getCalendarEvents` loads the month with `include`, so every scalar column comes back, including encrypted description, reference, and created-by fields (`src/actions/calendar-actions.ts` lines 166–192). Account names are decrypted with `await` inside the event loop (lines 195–218). Recurring rules are `findMany` with no `select` (lines 104–115), and rule names are decrypted one rule at a time (lines 145–163) before the transaction query starts.
- `getUpcomingBills` repeats that shape for seven days (lines 262–322).
- `getMonthSummary` loads the month again with no `select` (lines 571–584).

The sidebar valuation runs as well. The calendar’s own slowness is the triple month scan and the serial decrypts. Growth is per busy month.

### 6. Reports scan the current month four times on the first visit

`/dashboard/reports` is a client page, so fetches start after hydration. Hidden tabs stay disabled (`src/app/(dashboard)/dashboard/reports/page.tsx` lines 113–166). `DateRangePicker` then applies "This Month" in an effect when the value is still empty (`src/components/reports/DateRangePicker.tsx` lines 100–106, `onChange` is `setDateRange`). One commit later `hasDateRange` becomes true and the overview queries start. The tab list stays behind a spinner until spending trends and the expense breakdown finish (`reports/page.tsx` lines 167–168 and 224–232).

That first visit fires together:

- `getSpendingTrends` — every expense in the range (`src/actions/report-actions.ts` lines 534–552)
- `getCategoryBreakdown` for expenses and again for income — `fetchCategorizedTransactions` includes category, description, and every split (lines 266–318) and then reduces to category totals
- `getMonthlySummary` — current month with splits, plus the previous month (lines 748–760)

Each action authenticates and builds its own FX converter, which tries Yahoo before the `ExchangeRate` table. Income-versus-expense is its own tab and scans up to 12 months. Net-worth charts read stored snapshots only.

The forecast section on this page defaults to historical variable spending and `staleTime` of 60 seconds (`src/hooks/useCashFlowForecast.ts` lines 14–28, `src/components/forecast/CashFlowForecastSection.tsx` lines 30–33). Opening that tab, or returning after a minute, repeats the 90-day decrypting forecast.

### 7. A few reads have no page size, on purpose or by drift

Interactive, and worth a limit when the screen is next touched:

- Trade history for one holding. `GET /api/investments/[id]/trades` has no `take`. `getTradeHistory` (`src/actions/investment-actions.ts` lines 656–660) is the same unbounded `findMany` with `include: { asset: true }` and a notes decrypt per row. The dialog opens this for one asset, so it grows with that holding’s trades, not the whole book. `TradeHistory` is indexed on `userId` and `assetId` separately, not as a pair.
- Liability payment history is capped at 50 (`src/actions/liability-payment-actions.ts` lines 560–578) but `include`s the full source and destination account rows, encrypted description included.
- Category counts use `_count` per category (`src/server/categories/category-query-service.ts`). One count per category, on an indexed `categoryId`. Fine until category count or transaction count is large.

User-triggered, so they should stay off the first-paint ranking:

- CSV export and full export load every transaction, split, and trade (`src/actions/export-actions.ts`).
- Notification, bank-interest, deposito, and net-worth crons scan in loops. Bank interest and snapshot math await FX inside account or holding loops (`src/lib/bank-interest-service.ts`, `src/lib/net-worth-calculation.ts` lines 313–355). Distinct pairs are serial. The in-memory pair map stops repeat currencies.
- Weekly AI insight generation reads one week of rows and calls the chat model from the cron. The insights page only decrypts the stored reports (`src/lib/weekly-ai-insight-service.ts` lines 358–390). It does not call the model on view.

Transaction history itself is in good shape: default page size 10, `count` then `take`/`skip`, account-name decryption cached by account id (`src/types/transaction-list.ts` line 4, `src/server/transactions/transaction-service.ts` lines 1250–1280). The transactions layout also prefetches accounts and categories into the query cache. Deep pages still pay `skip`. The category filter is `categoryId` OR a split relation, which is heavier than the plain date index. `useTransactionSummary` would scan every transaction for the user and no component calls it.

## What is already in good shape

- TanStack defaults: 5-minute fresh data, 10-minute cache, no focus refetch, no mutation retry. The exception is `useAccountMutationProtection` (`staleTime: 0`, refetch on mount and on focus, `src/hooks/useAccountMutationProtection.ts` lines 9–14). Add, edit, and delete account dialogs each call it, and React Query collapses that to one small status read. It is not a ledger scan.
- Sidebar links set `prefetch={false}` (`src/components/dashboard/Sidebar.tsx` line 181). Hovering a route does not start its server work early. The click is when that page's fetch begins.
- Yahoo prices and FX rates are cached for 5 minutes. FX has an in-flight map and an 8-second timeout.
- Portfolio realized P&L is one `groupBy`, not a query per holding.
- Executive metrics uses a narrow `select` on the six-month scan.
- `getBudgetsSummary` scans once for every budget inside that action. The duplicate is the second action on the page, `getBudgetVsActual`.
- Reports do not fetch hidden tabs, and the heavy charts wait for a date range.
- Dashboard and report net-worth charts read stored snapshots.
- Pegadaian on a page read is the latest stored snapshot, and only when an active `GC=F` holding exists.
- Onboarding in the layout is a few `count` queries, not a ledger scan.
- Weekly AI insight view reads stored ciphertext, not the chat API.
- Transaction list pagination, prefetch, and per-account decrypt cache.

`auth()` inside one server render is memoized by Auth.js. The extra cost is the Prisma, Yahoo, and decrypt work that follows, plus a brand-new server-action request from the sidebar.

## Where to change first

These are ordered by how much of the wait they remove. They are findings, not a patch.

1. Value the portfolio once per user per few minutes, and reuse that result for executive metrics, insights, account summary, and the investments page. Seed the sidebar query from the server on the home page so the browser does not POST `getExecutiveMetrics` again. Give quote fetches the same timeout and in-flight dedupe FX already has. Drop the 100ms sleep when the batch is served from cache, and quote each distinct symbol once. A single Yahoo `quote` of many symbols would replace the batches.
2. Let the home page render position cards without waiting for insights and the 90-day forecast. Those two calls dominate `getDashboardMoneyPlan`. The snapshot summary and the changelog read can stay; the changelog should not block metrics either.
3. Replace the JavaScript sums in executive metrics, `getBudgetSpendingSummary`, and `getMonthSummary` with grouped aggregates on `amount * exchangeRate`. Keep the row scans for screens that actually list rows.
4. On insights, stop loading every year-to-date transaction with splits when the card shows three items. The debt-plan read can stay for the insight that needs it; it should not sit behind a year of splits.
5. On the forecast, decrypt each account once and attach the name by id. Skip the 90-day history query when variable spending is `"none"`. In budget mode, scan the period once and share it across budgets.
6. Collapse the duplicate page pairs: accounts list versus summary, budgets summary versus vs-actual, goals summary versus stats, subscriptions list versus summary. Liabilities should load liability accounts directly and skip the portfolio valuation.
7. Calendar: one month query, a narrow `select`, decrypt account names in parallel (or once per account). Build the summary from that same result.
8. Reports: one transaction read for the selected range, shared by trends, both category breakdowns, and the monthly summary. "This Month" is applied automatically, so that shared read is the first-visit path, not only a custom range.
9. Add a `loading.tsx` for the dashboard segment so a cold Yahoo wait shows the shell. That does not make the work faster. It stops the blank page.

## How to confirm

After a change, time these with a warm database and a cold Yahoo cache, then again with a warm quote cache:

- `GET /dashboard` server time, and the sidebar POST that follows hydration.
- `getExecutiveMetrics`, `getFinancialInsights`, and `getCashFlowForecast` separately, so the overlap is visible.
- `/dashboard/accounts`, `/dashboard/liabilities`, `/dashboard/budgets`, and `/dashboard/calendar` on first visit.
- The same routes again inside five minutes. The sidebar should not repeat the valuation.
- A portfolio of about 20 symbols. The 100ms batch sleeps should show up as a floor near 300ms even on cache hits, twice on a cold home page.

Compare row counts, not just wall time: six-month transaction rows, year-to-date insight rows, 90-day forecast rows, and Yahoo quote calls per page.
