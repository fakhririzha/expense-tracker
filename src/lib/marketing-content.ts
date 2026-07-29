export interface MarketingPageSection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface MarketingPageDefinition {
  eyebrow: string;
  title: string;
  summary: string;
  sections: MarketingPageSection[];
  isLegal?: boolean;
}

export const MARKETING_PAGE_SLUGS = [
  "roadmap",
  "blog",
  "guides",
  "help",
  "about",
  "contact",
  "privacy",
  "terms",
  "security",
  "data-policy",
  "disclosures",
] as const;

export type MarketingPageSlug = (typeof MARKETING_PAGE_SLUGS)[number];

export const MARKETING_PAGES: Record<
  MarketingPageSlug,
  MarketingPageDefinition
> = {
  roadmap: {
    eyebrow: "ROADMAP",
    title: "BUILDING THE PRIVATE MONEY SYSTEM.",
    summary:
      "FinHealth is shaped by practical feedback and careful financial-data handling. These are priorities, not dated promises.",
    sections: [
      {
        title: "KEEP THE FOUNDATION STRONG",
        paragraphs: [
          "Reliability, privacy, and clear financial records stay ahead of feature count. We will keep improving the workflows people trust every day.",
        ],
      },
      {
        title: "MAKE SETUP EASIER",
        paragraphs: [
          "We are focused on clearer onboarding, more useful guidance, and smoother ways to bring financial history into FinHealth.",
        ],
      },
      {
        title: "MAKE THE NEXT DECISION CLEARER",
        paragraphs: [
          "Planning, forecasts, goals, and insights will keep evolving so the app helps turn financial data into a useful next step.",
        ],
      },
    ],
  },
  blog: {
    eyebrow: "FINHEALTH NOTES",
    title: "ONE HONEST PICTURE OF YOUR MONEY.",
    summary:
      "Most financial stress is not a lack of effort. It is a lack of one clear, current picture.",
    sections: [
      {
        title: "THE PROBLEM WITH FRAGMENTED MONEY",
        paragraphs: [
          "Balances live in one place, subscriptions in another, and goals somewhere in the back of your mind. It is hard to make a confident decision when the story is split across tools.",
        ],
      },
      {
        title: "WHAT FINHEALTH DOES DIFFERENTLY",
        paragraphs: [
          "FinHealth brings accounts, transactions, budgets, debts, investments, subscriptions, and goals into one private workspace. The aim is not to judge your choices. It is to make the trade-offs visible.",
        ],
      },
      {
        title: "CLARITY COMPOUNDS",
        paragraphs: [
          "A useful financial system makes the next small decision easier: notice a renewal, protect a budget, move money toward a goal, or face a debt before it grows.",
        ],
      },
    ],
  },
  guides: {
    eyebrow: "GETTING STARTED",
    title: "SET UP YOUR FINANCIAL PICTURE IN SIX STEPS.",
    summary:
      "Start with the few details that make FinHealth useful, then add depth when you are ready.",
    sections: [
      {
        title: "START SIMPLE",
        paragraphs: [
          "Create your account, choose your main currency, and add the bank, cash, investment, debt, or receivable balances you want to understand.",
        ],
      },
      {
        title: "MAKE THE STORY CURRENT",
        paragraphs: [
          "Add income and spending, use categories that make sense to you, and connect recurring charges or subscriptions before they fade into the background.",
        ],
      },
      {
        title: "TURN DATA INTO A PLAN",
        paragraphs: [
          "Create category budgets and savings goals, review forecasts and insights, then return to the dashboard whenever you need the full picture.",
        ],
        bullets: [
          "Add accounts and opening balances.",
          "Record or import transactions.",
          "Create budgets, goals, and recurring rules.",
          "Use reports and insights to make the next decision.",
        ],
      },
    ],
  },
  help: {
    eyebrow: "HELP CENTER",
    title: "THE IMPORTANT ANSWERS, WITHOUT THE RUNAROUND.",
    summary:
      "A short guide to FinHealth’s core workflows and where to get help when something needs attention.",
    sections: [
      {
        title: "CAN I TRACK MORE THAN ONE CURRENCY?",
        paragraphs: [
          "Yes. FinHealth supports account and transaction currencies, then uses available exchange rates for reporting in your chosen main currency.",
        ],
      },
      {
        title: "CAN I IMPORT OR EXPORT MY DATA?",
        paragraphs: [
          "Transaction imports and exports are available from Data Management. You can also download a financial-data archive for your own records.",
        ],
      },
      {
        title: "WHERE DO I REPORT A PROBLEM?",
        paragraphs: [
          "For bugs, support questions, and feature requests, use the FinHealth GitHub Issues tracker. Include the steps you took and a screenshot when it helps explain the problem.",
        ],
      },
    ],
  },
  about: {
    eyebrow: "ABOUT FINHEALTH",
    title: "MONEY TOOLS SHOULD MAKE YOU MORE CERTAIN, NOT MORE ANXIOUS.",
    summary:
      "FinHealth is a private personal-finance dashboard for seeing the whole picture and acting on it with confidence.",
    sections: [
      {
        title: "A PRACTICAL POINT OF VIEW",
        paragraphs: [
          "FinHealth is built for the ordinary decisions that shape financial health: tracking spending, paying down debt, protecting a budget, building savings, and understanding investments.",
        ],
      },
      {
        title: "ONE PRODUCT, MANY REAL LIVES",
        paragraphs: [
          "Whether you are managing your own money, planning household expenses, or building toward a long-term goal, the product keeps the information connected without turning it into a lecture.",
        ],
      },
      {
        title: "BUILT IN THE OPEN",
        paragraphs: [
          "FinHealth is an Apache-2.0 licensed project. The codebase, release notes, and issue tracker make it easier to understand how the product evolves.",
        ],
      },
    ],
  },
  contact: {
    eyebrow: "CONTACT",
    title: "LET’S MAKE THE PRODUCT MORE USEFUL.",
    summary:
      "The GitHub Issues tracker is the public place for support questions, bug reports, and feature ideas.",
    sections: [
      {
        title: "REPORT A BUG",
        paragraphs: [
          "Tell us what happened, what you expected, and the steps that reproduce the issue. Screenshots and browser details are especially helpful.",
        ],
      },
      {
        title: "ASK FOR A FEATURE",
        paragraphs: [
          "Describe the financial situation or workflow you are trying to solve. Real-world context makes a request easier to evaluate.",
        ],
      },
      {
        title: "START A CONVERSATION",
        paragraphs: [
          "Open an issue in the FinHealth repository. Please do not include passwords, access tokens, account numbers, or other sensitive financial information.",
        ],
      },
    ],
  },
  privacy: {
    eyebrow: "PRIVACY DRAFT",
    title: "YOUR FINANCIAL LIFE DESERVES CARE.",
    summary:
      "This plain-language draft explains the data FinHealth handles and should be reviewed by qualified counsel before production reliance.",
    isLegal: true,
    sections: [
      {
        title: "WHAT FINHEALTH STORES",
        paragraphs: [
          "FinHealth stores the information needed to provide the dashboard, including account balances, transactions, categories, goals, budgets, subscriptions, investments, and profile preferences.",
          "Sensitive fields such as account labels and selected private details use the project’s encryption helpers. Passwords are not stored in readable form.",
        ],
      },
      {
        title: "OPTIONAL SERVICES",
        paragraphs: [
          "Market quotes, exchange rates, Pegadaian reference prices, bill-photo OCR, weekly AI insights, and browser push notifications use optional configured providers. Each feature only receives the limited data needed for that feature.",
        ],
      },
      {
        title: "YOUR CHOICES",
        paragraphs: [
          "You can export supported data and delete your FinHealth account from Profile. Keep your own backups before deleting an account or changing hosting providers.",
        ],
      },
    ],
  },
  terms: {
    eyebrow: "TERMS DRAFT",
    title: "USE FINHEALTH WITH CLEAR EXPECTATIONS.",
    summary:
      "This is a plain-language draft for review, not a substitute for legal advice or final terms of service.",
    isLegal: true,
    sections: [
      {
        title: "FINHEALTH IS A TOOL, NOT AN ADVISER",
        paragraphs: [
          "FinHealth helps organize personal financial information. It does not provide financial, investment, tax, legal, or credit advice, and it does not guarantee outcomes.",
        ],
      },
      {
        title: "YOUR RESPONSIBILITY",
        paragraphs: [
          "You are responsible for the information you enter, the decisions you make, and keeping your account and deployment credentials secure.",
        ],
      },
      {
        title: "OPEN-SOURCE SOFTWARE",
        paragraphs: [
          "The FinHealth codebase is licensed under Apache-2.0. Hosted deployments may have additional operational terms set by their operator.",
        ],
      },
    ],
  },
  security: {
    eyebrow: "SECURITY",
    title: "PRIVATE BY DESIGN. PRACTICAL BY DEFAULT.",
    summary:
      "FinHealth uses layered safeguards to protect account access and keep user-owned financial records separate.",
    isLegal: true,
    sections: [
      {
        title: "ACCOUNT ACCESS",
        paragraphs: [
          "Authentication protects dashboard routes, and optional authenticator-app checks can protect sensitive account changes.",
        ],
      },
      {
        title: "DATA PROTECTION",
        paragraphs: [
          "User-owned data is queried with ownership checks, sensitive fields use encryption helpers, and balance-moving actions use validated server-side transactions.",
        ],
      },
      {
        title: "REPORTING A SECURITY ISSUE",
        paragraphs: [
          "Do not publish sensitive details in a public issue. Use the repository contact path to request a private reporting channel when a vulnerability may put people at risk.",
        ],
      },
    ],
  },
  "data-policy": {
    eyebrow: "DATA POLICY DRAFT",
    title: "YOUR DATA SHOULD REMAIN UNDERSTANDABLE AND PORTABLE.",
    summary:
      "This draft describes how FinHealth separates personal financial records from shared reference data.",
    isLegal: true,
    sections: [
      {
        title: "PERSONAL FINANCIAL RECORDS",
        paragraphs: [
          "Accounts, transactions, budgets, goals, investments, subscriptions, and preferences belong to the signed-in user and are always accessed through ownership-aware queries.",
        ],
      },
      {
        title: "REFERENCE DATA",
        paragraphs: [
          "Exchange rates and Pegadaian gold-price snapshots are global reference data. They support calculations and displays but do not contain user ownership information.",
        ],
      },
      {
        title: "EXPORTS AND DELETION",
        paragraphs: [
          "FinHealth provides supported transaction exports and a financial-data archive. Account deletion is available in Profile; preserve any records you need before using it.",
        ],
      },
    ],
  },
  disclosures: {
    eyebrow: "DISCLOSURES DRAFT",
    title: "USE FINANCIAL SIGNALS WITH CONTEXT.",
    summary:
      "FinHealth calculations and external data are useful aids, not guarantees or personalized recommendations.",
    isLegal: true,
    sections: [
      {
        title: "MARKET AND EXCHANGE DATA",
        paragraphs: [
          "Quotes, exchange rates, and reference prices may be delayed, unavailable, or inaccurate. FinHealth surfaces missing-data warnings instead of treating an unavailable value as certainty.",
        ],
      },
      {
        title: "PEGADAIAN REFERENCE PRICES",
        paragraphs: [
          "Pegadaian customer buy and sell prices are supplementary references for eligible gold holdings. They do not replace the portfolio valuation, cost basis, day change, or profit-and-loss calculation.",
        ],
      },
      {
        title: "FORECASTS, OCR, AND AI INSIGHTS",
        paragraphs: [
          "Forecasts are estimates based on available records. Receipt scanning and AI insights can be incomplete or wrong and should always be reviewed before you act on them.",
        ],
      },
    ],
  },
};
