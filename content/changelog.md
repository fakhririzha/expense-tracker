# FinHealth Changelog

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
