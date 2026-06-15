# FinHealth Changelog

## v4.5.3

- Tightened transfer validation so source and destination accounts must now use the same currency before money can be moved.
- Made transfer setup easier to review by highlighting the selected source account balance and the destination currency rule directly in the Add Transaction form.

## v4.5.2

- Expanded transfer transactions so Investment accounts can now be selected alongside Bank and Cash accounts when moving money between eligible accounts.
- Kept transfer rules intact by continuing to block liability and loans receivable accounts from the standard transfer flow.

## v4.5.1

- Improved transfer entry so choosing a source account now shows its current balance directly in the Add Transaction form.
- Made it easier to confirm available funds before moving money between cash and bank accounts.

## v4.5.0

- Added manual split transactions for expenses so one purchase can now be divided across multiple categories without affecting the account balance more than once.
- Updated budgets, category reports, and financial insights so split expenses count toward their line items instead of double-counting the parent transaction.
- Improved transaction exports and transaction list labels so split purchases are easier to review and understand later.

## v4.4.4

- Added login confirmation dialogs so successful and failed sign-ins are now acknowledged more clearly before the app continues.
- Kept the existing registration and account-deletion messages on the login page while making the sign-in feedback more visible.

## v4.4.3

- Improved money entry fields with Indonesian thousand separators across accounts, transactions, budgets, goals, subscriptions, investments, assets, and profile targets.
- Kept non-money numeric fields like coordinates, reminders, percentages, and investment quantities unchanged for precise input.

## v4.4.2

- Improved account privacy by moving account names and descriptions fully into encrypted storage instead of keeping a plaintext copy in the database.
- Kept account labels working across the dashboard, imports, exports, forecasting, and transaction flows while tightening how account data is handled behind the scenes.

## v4.4.1

- Fixed the dashboard install prompt so the header renders more reliably on first load without hydration errors in supported browsers.
- Kept the install experience intact after page load, including browser-specific install guidance and dismiss timing behavior.

## v4.4.0

- Added browser push notifications with opt-in controls in Profile so you can enable or disable reminders per device and choose which finance events can reach you.
- Added privacy-safe notification delivery for subscription renewals, recurring due reminders, budget warnings, goal reminders, monthly snapshot updates, and upcoming cash-pressure alerts.
- Added a test notification flow plus background notification scheduling so reminder delivery can be verified without exposing sensitive financial details in the push message.

## v4.3.0

- Added installable PWA support so FinHealth can be added to the home screen on supported desktop and mobile browsers.
- Added safer offline handling with a dedicated fallback screen while keeping private financial data and balance-changing actions out of the offline cache.
- Added in-app install guidance so supported browsers can surface setup more clearly without interrupting day-to-day dashboard use.

## v4.2.3

- Refined the upcoming bank pressure warning on Subscriptions and Recurring so it now matches the app’s card-based visual style instead of appearing as a flatter system alert.
- Kept the warning emphasis with clearer amber highlighting while making the affected account details feel more consistent with the surrounding dashboard cards.

## v4.2.2

- Added schedule pressure alerts on the Subscriptions and Recurring pages when the next 30 days of bank-linked renewals and recurring outflows are higher than the current balance in a Bank Account.
- Made subscription-managed recurring rules show up in the warning details without double-counting the same upcoming charge twice.

## v4.2.1

- Improved the login page rendering flow so sign-in stays more reliable during production builds and static generation.
- Kept registration-success and account-deletion confirmation messages working on the login screen without forcing the whole page into a heavier client-rendered path.

## v4.2.0

- Added a permanent account deletion flow in Profile with email and current-password confirmation for safer self-service removal.
- Added a profile Danger Zone with a reminder to export data first before permanently deleting the account.
- Updated the login experience to confirm when an account has been deleted successfully.

## v4.1.0

- Added a new cash flow forecasting view in Reports with 30, 60, and 90 day liquid-cash projections.
- Combined future-dated transactions, recurring rules, subscription renewals, and optional spending estimates into one forward-looking balance chart and event timeline.
- Added forecast assumptions and risk signals so low buffers, missing exchange rates, and estimate-driven projections are easier to spot before cash gets tight.

## v4.0.0

- Added a new Financial Insights panel to the dashboard and reports overview with deterministic signals for budget pressure, spending changes, debt load, emergency-fund coverage, goal pacing, and other key health checks.
- Introduced cross-feature insight logic that compares month-to-date activity, recurring commitments, net worth snapshots, investment concentration, and multi-currency exposure in the user’s main reporting currency.
- Kept the new guidance rule-based and generated on demand, so it stays explainable without storing extra coaching text or relying on external AI services.

## v3.7.0

- Added stable month-end net worth snapshots so historical wealth trends no longer shift when live balances, market prices, or exchange rates change later.
- Updated the Reports net worth view to use frozen month-end data with clearer empty states and latest-snapshot summaries.
- Scheduled a dedicated monthly snapshot job separately from recurring transaction processing to keep period-end reporting more reliable.

## v3.6.0

- Added a dedicated Subscription Tracker for manually managing memberships, SaaS plans, recurring bills, and free trials in one place.
- Introduced subscription summaries for monthly and yearly planned costs, upcoming renewals, and trials ending soon, with existing currency conversion support.
- Connected subscriptions to recurring rules so billing automation can stay in sync without creating duplicate transaction logic.

## v3.5.3

- Added category selection to recurring income and expense rules so scheduled transactions can now stay mapped to the right personal category.
- Updated recurring rule editing and list views to show the saved category more clearly, making recurring setups easier to review at a glance.
- Kept recurring transfer rules uncategorized by design so category choices stay aligned with the current income-and-expense category model.

## v3.5.2

- Improved the overall feel of forms, filters, menus, and data views with cleaner spacing and more consistent UI styling across the app.
- Made dropdowns and command menus easier to use by giving them more balanced sizing and layout behavior.
- Polished small interface details like checkbox styling, table selection alignment, and tooltip presentation for a smoother experience.

## v3.5.1

- Improved responsive layouts across dashboard, accounts, budgets, calendar, categories, liabilities, goals, data export, and reports pages so summary cards adapt better on medium and large screens.
- Made the reports tabs horizontally scrollable on smaller screens so every analytics section stays accessible without squeezing the tab labels.
- Refined loading states and select widths in the calendar and goals screens, plus summary widgets for goals, loans receivable, and monthly reports, for cleaner spacing and alignment.

## v3.5.0

- Added Loans Receivable for tracking principal owed to you from loans you funded.
- Added lending and repayment flows that move funds between cash accounts and receivable balances without counting principal as income or expense.
- Updated account, dashboard, and net-worth calculations so Loans Receivable is treated as an asset.

## v3.4.3

- Monthly budget tracking now includes liability payments alongside regular expenses in the dashboard and sidebar budget snapshot.
- All-category budget progress and budget-vs-actual views now count liability payments, while category-specific budgets continue to track regular expenses only.
- General reports and calendar summaries were left unchanged, so their expense totals keep the existing behavior.

## v3.4.2

- Added an in-dashboard changelog dialog so updates are visible directly from the main dashboard.
- Switched changelog content loading to Markdown, making future release notes easier to maintain in-repo.
- Improved changelog visibility behavior so the dialog reappears only when the content changes.

## v3.4.1

- Expanded transfer support so cash accounts can be used as either the source or destination in transaction flows.

## v3.4.0

- Improved responsive behavior across multiple screens and components for a better mobile experience.
- Tightened accessibility details across the UI to improve keyboard and assistive-technology usability.

## v3.3.2

- Fixed calendar event loading so relevant transactions are no longer incorrectly hidden from future views.
- Corrected edit-transaction dialog button behavior for more reliable form interactions.

## v3.3.1

- Added category management with create, edit, and delete flows in the dashboard.
- Introduced supporting UI for maintaining personal transaction categories without leaving the app.

## v3.3.0

- Added location metadata to transactions for richer financial records and reporting context.

## v3.2.10

- Improved dashboard exports with dynamic loading to keep the layout lighter and more responsive.
- Enhanced sheet close-button accessibility for clearer navigation and better assistive support.

## v3.2.9

- Integrated the mobile sidebar into the dashboard layout for more consistent small-screen navigation.

## v3.2.8 / v3.2.7

- Improved liability payment accuracy by switching related queries to the dedicated audit trail data.
- Strengthened liability reporting so balances and payment history stay more reliable after adjustments.

## v3.2.6

- Maintenance release focused on internal cleanup of outdated guidance with no major user-facing behavior change.

## v3.2.5

- Maintenance release focused on removing obsolete project guidance and unused internal references.

## v3.2.4

- Added financial target management so users can define and monitor personal monthly goals more directly.
- Introduced monthly budget status components to surface progress and shortfalls more clearly on the dashboard.

## v3.2.3

- Improved reference number validation in liability payment flows for more dependable duplicate checks.

## v3.2.2

- Refined goal and investment dialogs with better layout, spacing, and overall form usability.

## v3.2.1

- Enhanced investment valuation calculations for more accurate portfolio insights.
- Improved dashboard metrics so portfolio-related summaries reflect updated valuation logic.

## v3.2.0

- Expanded the database schema with new fields and indexes to improve data integrity and query performance.
- Added the groundwork for personal asset management, including supporting hooks and shared types.

## v3.1.2

- Refreshed app branding with an updated favicon.
- Hardened category and trade APIs by rejecting invalid enum-based filters before they reach deeper processing.

## v3.1.1

- Added asset price fetching with built-in currency conversion for stocks and precious metals.
- Improved investment pricing coverage so multi-asset portfolios can be valued more consistently.

## v3.1.0

- Enhanced precious-metal portfolio calculations with USD-to-IDR conversion support.
- Improved trade handling and realized profit-and-loss calculations for sold assets.
- Refined the portfolio UI to better represent active and closed investment positions.

## v3.0.5

- Improved sell-trade processing so trade history is recorded before holdings are updated or removed.
- Reduced the risk of inconsistent portfolio state after full asset sell-offs.

## v3.0.4

- Added extra dashboard logging around metrics, transactions, and portfolio summaries to help diagnose production issues faster.
- Included small auth-page layout refinements for a cleaner login experience.

## v3.0.3

- Streamlined project scripts and dependency setup to support a cleaner testing and linting workflow.

## v3.0.2 / v3.0.1

- Simplified production startup behavior and reduced install-time setup complexity.
- Included minor UI and editor compatibility refinements for a smoother day-to-day development experience.

## v3.0.0

- Extracted dashboard navigation into a dedicated sidebar component for a cleaner and more maintainable layout.
- Improved dashboard structure and navigation consistency across protected pages.

## v2.1.0

- Added credentials-based authentication with NextAuth so users can securely sign in with email and password.
- Introduced a redesigned landing page and a broader neo-brutalist visual refresh across the interface.
- Improved build setup to better align authentication and Prisma generation with the app lifecycle.

## v2.0.1

- Adopted TanStack Query patterns and dedicated data hooks to improve client-side data fetching consistency.
- Strengthened reporting logic, including better net-worth history calculations and report parameter validation.
- Folded in the broader February finance overhaul, including budgeting improvements, recurring edits, reports, calendar billing, export/import, liability payments, transfer enhancements, and precious-metals unit conversion.

## v1.0.0

- Established the initial FinHealth foundation with authentication-aware home and dashboard flows.
- Added core account, transaction, transfer, and transaction-management capabilities, including edit and delete support.
- Introduced the first investment portfolio features, exchange-rate handling, and trade history infrastructure.
- Added early liability payment support, stronger financial-action safety, and Prisma/database setup improvements.
- Set up the project structure, documentation, and baseline UI needed for the later dashboard expansion.
