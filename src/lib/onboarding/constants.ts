export const ONBOARDING_TOUR_VERSION = "guided-setup-v1" as const;

export const ONBOARDING_WELCOME_COPY = {
  title: "Welcome to FinHealth",
  description:
    "Let's set up the few things FinHealth needs to give you useful reports, budgets, forecasts, and insights.",
  skip:
    "Skip for now. You can restart Guided Setup from Profile later.",
} as const;

export const ONBOARDING_TOUR_TARGETS = {
  dashboardRoot: "dashboard-root",
  dashboardWelcome: "dashboard-welcome",
  dashboardOverview: "dashboard-overview",
  dashboardNetWorth: "dashboard-net-worth",
  dashboardInvestmentsSummary: "dashboard-investments-summary",
  dashboardCashSavings: "dashboard-cash-savings",
  dashboardPersonalAssets: "dashboard-personal-assets",
  dashboardReceivables: "dashboard-receivables",
  dashboardSubscriptions: "dashboard-subscriptions",
  dashboardDebt: "dashboard-debt",
  dashboardHealthRetirement: "dashboard-health-retirement",
  dashboardCashFlow: "dashboard-cash-flow",
  dashboardInvestmentPerformance: "dashboard-investment-performance",
  desktopSidebar: "desktop-sidebar",
  desktopBrandHome: "desktop-brand-home",
  desktopGoalSnapshot: "desktop-goal-snapshot",
  desktopNavDashboard: "desktop-nav-dashboard",
  desktopNavInsights: "desktop-nav-insights",
  desktopNavTransactions: "desktop-nav-transactions",
  desktopNavAccounts: "desktop-nav-accounts",
  desktopNavAssets: "desktop-nav-assets",
  desktopNavCategories: "desktop-nav-categories",
  desktopNavBudgets: "desktop-nav-budgets",
  desktopNavGoals: "desktop-nav-goals",
  desktopNavLiabilities: "desktop-nav-liabilities",
  desktopNavReceivables: "desktop-nav-receivables",
  desktopNavDeposito: "desktop-nav-deposito",
  desktopNavInvestments: "desktop-nav-investments",
  desktopNavSubscriptions: "desktop-nav-subscriptions",
  desktopNavRecurring: "desktop-nav-recurring",
  desktopNavCalendar: "desktop-nav-calendar",
  desktopNavReports: "desktop-nav-reports",
  desktopNavData: "desktop-nav-data",
  mobileMenuTrigger: "mobile-menu-trigger",
  mobileSheet: "mobile-nav-sheet",
  mobileNav: "mobile-nav",
  mobileBrandHome: "mobile-brand-home",
  mobileGoalSnapshot: "mobile-goal-snapshot",
  mobileNavDashboard: "mobile-nav-dashboard",
  mobileNavInsights: "mobile-nav-insights",
  mobileNavTransactions: "mobile-nav-transactions",
  mobileNavAccounts: "mobile-nav-accounts",
  mobileNavAssets: "mobile-nav-assets",
  mobileNavCategories: "mobile-nav-categories",
  mobileNavBudgets: "mobile-nav-budgets",
  mobileNavGoals: "mobile-nav-goals",
  mobileNavLiabilities: "mobile-nav-liabilities",
  mobileNavReceivables: "mobile-nav-receivables",
  mobileNavDeposito: "mobile-nav-deposito",
  mobileNavInvestments: "mobile-nav-investments",
  mobileNavSubscriptions: "mobile-nav-subscriptions",
  mobileNavRecurring: "mobile-nav-recurring",
  mobileNavCalendar: "mobile-nav-calendar",
  mobileNavReports: "mobile-nav-reports",
  mobileNavData: "mobile-nav-data",
  topNavigation: "top-navigation",
  profileMenuTrigger: "profile-menu-trigger",
  profileMenuLink: "profile-menu-link",
  dashboardMainContent: "dashboard-main-content",
} as const;

export type OnboardingTourTarget =
  (typeof ONBOARDING_TOUR_TARGETS)[keyof typeof ONBOARDING_TOUR_TARGETS];

export type OnboardingTourGroup =
  | "dashboard overview"
  | "accounts"
  | "transactions"
  | "budgets/goals"
  | "calendar/recurring/subscriptions"
  | "investments/deposito/assets"
  | "liabilities/receivables"
  | "reports/insights"
  | "data/profile";

export interface OnboardingTourStep {
  id: string;
  group: OnboardingTourGroup;
  title: string;
  body: string;
  targetId: OnboardingTourTarget;
  selector: `[data-tour-id="${OnboardingTourTarget}"]`;
}

function tourSelector(
  targetId: OnboardingTourTarget
): `[data-tour-id="${OnboardingTourTarget}"]` {
  return `[data-tour-id="${targetId}"]`;
}

// Desktop sidebar targets are hidden on mobile. Mobile nav targets exist only
// after the sheet is open, so the future tour UI should choose by viewport state.
export const ONBOARDING_TOUR_STEPS: OnboardingTourStep[] = [
  {
    id: "dashboard-overview",
    group: "dashboard overview",
    title: "Start with your overview",
    body: "Use the dashboard overview to scan net worth, cash, assets, debt, and subscriptions before drilling into details.",
    targetId: ONBOARDING_TOUR_TARGETS.dashboardOverview,
    selector: tourSelector(ONBOARDING_TOUR_TARGETS.dashboardOverview),
  },
  {
    id: "accounts",
    group: "accounts",
    title: "Add your accounts",
    body: "Accounts are the foundation for balances, transfers, reports, and goal progress.",
    targetId: ONBOARDING_TOUR_TARGETS.desktopNavAccounts,
    selector: tourSelector(ONBOARDING_TOUR_TARGETS.desktopNavAccounts),
  },
  {
    id: "transactions",
    group: "transactions",
    title: "Track money movement",
    body: "Transactions capture income, expenses, transfers, and payments so the rest of FinHealth stays current.",
    targetId: ONBOARDING_TOUR_TARGETS.desktopNavTransactions,
    selector: tourSelector(ONBOARDING_TOUR_TARGETS.desktopNavTransactions),
  },
  {
    id: "budgets-goals",
    group: "budgets/goals",
    title: "Plan spending and saving",
    body: "Budgets track category spending, while goals show progress from linked account balances.",
    targetId: ONBOARDING_TOUR_TARGETS.desktopNavBudgets,
    selector: tourSelector(ONBOARDING_TOUR_TARGETS.desktopNavBudgets),
  },
  {
    id: "schedule",
    group: "calendar/recurring/subscriptions",
    title: "Review upcoming commitments",
    body: "Calendar, recurring rules, and subscriptions help surface what is due next.",
    targetId: ONBOARDING_TOUR_TARGETS.desktopNavCalendar,
    selector: tourSelector(ONBOARDING_TOUR_TARGETS.desktopNavCalendar),
  },
  {
    id: "wealth-assets",
    group: "investments/deposito/assets",
    title: "Track wealth and assets",
    body: "Investments, deposito balances, and personal assets round out your net worth picture.",
    targetId: ONBOARDING_TOUR_TARGETS.desktopNavInvestments,
    selector: tourSelector(ONBOARDING_TOUR_TARGETS.desktopNavInvestments),
  },
  {
    id: "debt-receivables",
    group: "liabilities/receivables",
    title: "Manage what you owe and what is owed to you",
    body: "Liabilities and loans receivable keep debt payoff and expected repayments visible.",
    targetId: ONBOARDING_TOUR_TARGETS.desktopNavLiabilities,
    selector: tourSelector(ONBOARDING_TOUR_TARGETS.desktopNavLiabilities),
  },
  {
    id: "reports-insights",
    group: "reports/insights",
    title: "Use reports and insights",
    body: "Reports and insights turn your tracked data into trends, breakdowns, and next actions.",
    targetId: ONBOARDING_TOUR_TARGETS.desktopNavReports,
    selector: tourSelector(ONBOARDING_TOUR_TARGETS.desktopNavReports),
  },
  {
    id: "data-profile",
    group: "data/profile",
    title: "Finish setup in data and profile",
    body: "Use Data for import/export tools and Profile for targets, currency, notifications, and account settings.",
    targetId: ONBOARDING_TOUR_TARGETS.desktopNavData,
    selector: tourSelector(ONBOARDING_TOUR_TARGETS.desktopNavData),
  },
];

export const ONBOARDING_CHECKLIST_IDS = [
  "create_first_account",
  "review_categories",
  "add_first_transaction",
  "create_first_budget",
  "add_recurring_or_subscription",
  "review_reports_or_insights",
] as const;

export type OnboardingChecklistId = (typeof ONBOARDING_CHECKLIST_IDS)[number];

export type OnboardingChecklistItemMode = "auto" | "manual";

export const ONBOARDING_CHECKLIST_ITEMS: Array<{
  id: OnboardingChecklistId;
  title: string;
  description: string;
  href: string;
  alternateHref?: string;
  mode: OnboardingChecklistItemMode;
}> = [
  {
    id: "create_first_account",
    title: "Create your first account",
    description: "Add a bank, cash, investment, card, loan, or receivable account.",
    href: "/dashboard/accounts",
    mode: "auto",
  },
  {
    id: "review_categories",
    title: "Review categories",
    description: "Check the categories FinHealth will use for spending reports.",
    href: "/dashboard/categories",
    mode: "manual",
  },
  {
    id: "add_first_transaction",
    title: "Add your first transaction",
    description: "Record income, an expense, a transfer, or a payment.",
    href: "/dashboard/transactions",
    mode: "auto",
  },
  {
    id: "create_first_budget",
    title: "Create your first budget",
    description: "Set a category budget for the period you want to track.",
    href: "/dashboard/budgets",
    mode: "auto",
  },
  {
    id: "add_recurring_or_subscription",
    title: "Add recurring money movement",
    description: "Create a recurring rule or track a subscription renewal.",
    href: "/dashboard/recurring",
    alternateHref: "/dashboard/subscriptions",
    mode: "auto",
  },
  {
    id: "review_reports_or_insights",
    title: "Review reports or insights",
    description: "Open reporting and insights once you have enough data to review.",
    href: "/dashboard/reports",
    alternateHref: "/dashboard/insights",
    mode: "manual",
  },
];

export const ONBOARDING_SELECTED_GOALS = [
  "track_daily_spending",
  "understand_net_worth",
  "plan_ahead",
  "manage_debt_receivables",
  "track_investments_gold",
] as const;

export type OnboardingSelectedGoal = (typeof ONBOARDING_SELECTED_GOALS)[number];

export const ONBOARDING_GOAL_OPTIONS: Array<{
  id: OnboardingSelectedGoal;
  label: string;
  description: string;
}> = [
  {
    id: "track_daily_spending",
    label: "Track daily spending",
    description: "Log transactions and see where everyday money goes.",
  },
  {
    id: "understand_net_worth",
    label: "Understand net worth",
    description: "Connect balances, assets, and liabilities into one view.",
  },
  {
    id: "plan_ahead",
    label: "Plan ahead",
    description: "Use budgets, goals, forecasts, and upcoming schedules.",
  },
  {
    id: "manage_debt_receivables",
    label: "Manage debt and receivables",
    description: "Track payoffs, repayments, and money owed to or by you.",
  },
  {
    id: "track_investments_gold",
    label: "Track investments and gold",
    description: "Follow portfolio value, deposito, assets, and gold references.",
  },
];

export const ONBOARDING_NEXT_ACTIONS = [
  "start_checklist",
  "start_tour",
  "skip",
] as const;

export type OnboardingNextAction = (typeof ONBOARDING_NEXT_ACTIONS)[number];
