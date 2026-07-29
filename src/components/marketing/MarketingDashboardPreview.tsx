"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  Building2,
  CircleDollarSign,
  CreditCard,
  Landmark,
  ReceiptText,
  RefreshCw,
  ShoppingBasket,
  TrendingUp,
  WalletCards,
} from "lucide-react";

const spendingData = [
  { label: "Jun 1", amount: 420 },
  { label: "Jun 5", amount: 610 },
  { label: "Jun 9", amount: 520 },
  { label: "Jun 13", amount: 910 },
  { label: "Jun 17", amount: 700 },
  { label: "Jun 21", amount: 390 },
  { label: "Jun 25", amount: 840 },
  { label: "Jun 29", amount: 560 },
];

const spendingCategories = [
  { label: "Housing", value: 1420, color: "#078443" },
  { label: "Food & Dining", value: 680, color: "#f6ce30" },
  { label: "Transport", value: 560, color: "#ff6b5d" },
  { label: "Shopping", value: 440, color: "#a4dc79" },
  { label: "Utilities", value: 320, color: "#9ca3af" },
  { label: "Other", value: 422, color: "#222222" },
];

const allocationData = [
  { label: "US Stocks", value: 48, color: "#078443" },
  { label: "Intl Stocks", value: 22, color: "#f6ce30" },
  { label: "Bonds", value: 15, color: "#a4dc79" },
  { label: "Real Estate", value: 8, color: "#737373" },
  { label: "Cash", value: 5, color: "#171717" },
  { label: "Other", value: 2, color: "#d4d4d4" },
];

const accounts = [
  { label: "Cash & Checking", amount: "$12,540", icon: WalletCards, tone: "text-black" },
  { label: "Savings", amount: "$8,230", icon: Landmark, tone: "text-black" },
  { label: "Credit Cards", amount: "-$3,210", icon: CreditCard, tone: "text-[#ef6353]" },
  { label: "Investments", amount: "$26,880", icon: TrendingUp, tone: "text-black" },
  { label: "Loans", amount: "-$5,520", icon: CircleDollarSign, tone: "text-[#ef6353]" },
];

const activity = [
  { label: "Weekend Grocer", category: "Groceries", amount: "-$78.43", date: "Jun 7", icon: ShoppingBasket, tone: "text-[#ef6353]" },
  { label: "Salary Deposit", category: "Income", amount: "+$2,950.00", date: "Jun 6", icon: BadgeDollarSign, tone: "text-[#078443]" },
  { label: "Transit Card", category: "Transport", amount: "-$52.18", date: "Jun 6", icon: ReceiptText, tone: "text-[#ef6353]" },
  { label: "Transfer to Savings", category: "Transfer", amount: "-$500.00", date: "Jun 5", icon: RefreshCw, tone: "text-[#ef6353]" },
  { label: "Stream Monthly", category: "Entertainment", amount: "-$15.49", date: "Jun 4", icon: Building2, tone: "text-[#ef6353]" },
];

function PreviewHeading({ children }: { children: ReactNode }) {
  return <p className="text-[9px] font-black uppercase tracking-wide text-black/75">{children}</p>;
}

function PreviewLink({ children }: { children: ReactNode }) {
  return <span className="mt-4 inline-flex text-[9px] font-black uppercase tracking-wide underline underline-offset-4">{children} →</span>;
}

function ProgressRow({ label, value, amount }: { label: string; value: number; amount: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-[9px] font-bold">
        <span>{label}</span>
        <span>{amount}</span>
      </div>
      <div className="h-1.5 bg-black/10">
        <div className="h-full bg-[#078443]" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function AllocationLegend({ items }: { items: typeof spendingCategories }) {
  return (
    <ul className="space-y-1.5 text-[8px] font-bold">
      {items.map((item) => (
        <li key={item.label} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span className="size-2" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
          <span>{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function MarketingDashboardPreview() {
  return (
    <section
      id="dashboard-preview"
      aria-label="Fictional FinHealth dashboard preview"
      className="border-2 border-black bg-white shadow-[5px_5px_0_#000]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black px-4 py-3">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[9px] font-black uppercase tracking-wide text-black/65">
          {["Overview", "Accounts", "Spending", "Budgets", "Investments", "Debt", "Goals", "Reports"].map((item, index) => (
            <span key={item} className={index === 0 ? "text-black underline decoration-2 underline-offset-5" : undefined}>
              {item}
            </span>
          ))}
        </div>
        <span className="text-[9px] font-black uppercase tracking-wide">June 2024</span>
      </div>

      <div className="grid lg:grid-cols-3">
        <div className="border-b-2 border-black p-4 lg:border-b-0 lg:border-r-2">
          <PreviewHeading>Net worth</PreviewHeading>
          <p className="mt-2 text-3xl font-black tracking-tight">$48,920</p>
          <p className="mt-1 flex items-center gap-1 text-[9px] font-bold text-[#078443]">
            <ArrowUpRight className="size-3" /> $2,410 (5.18%) vs May 2024
          </p>

          <div className="mt-7">
            <div className="flex items-center justify-between">
              <PreviewHeading>Accounts</PreviewHeading>
              <span className="text-[8px] font-bold text-black/55">12 connected</span>
            </div>
            <ul className="mt-3 space-y-2.5">
              {accounts.map(({ label, amount, icon: Icon, tone }) => (
                <li key={label} className="flex items-center justify-between gap-3 text-[9px] font-bold">
                  <span className="flex items-center gap-2"><Icon className="size-3.5" strokeWidth={2.2} />{label}</span>
                  <span className={tone}>{amount}</span>
                </li>
              ))}
            </ul>
            <PreviewLink>View all accounts</PreviewLink>
          </div>
        </div>

        <div className="border-b-2 border-black p-4 lg:border-b-0 lg:border-r-2">
          <PreviewHeading>Spending this month</PreviewHeading>
          <div className="mt-1 flex items-end justify-between gap-4">
            <div>
              <p className="text-2xl font-black tracking-tight">$3,842</p>
              <p className="mt-1 flex items-center gap-1 text-[9px] font-bold text-[#078443]"><ArrowDownRight className="size-3" /> $588 (13.20%) vs May 2024</p>
            </div>
            <span className="text-[9px] font-bold text-black/50">$1.5k</span>
          </div>
          <div className="mt-3 h-25" role="img" aria-label="Example monthly spending bar chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={spendingData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Bar dataKey="amount" fill="#078443" radius={0} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 border-t border-black/20 pt-4">
            <PreviewHeading>Spending by category</PreviewHeading>
            <div className="mt-3 grid grid-cols-[1fr_1.15fr] items-center gap-3">
              <div className="h-28" role="img" aria-label="Example spending category allocation chart">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie data={spendingCategories} dataKey="value" nameKey="label" innerRadius="52%" outerRadius="82%" paddingAngle={1} stroke="none">
                      {spendingCategories.map((entry) => <Cell key={entry.label} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <AllocationLegend items={spendingCategories} />
            </div>
            <PreviewLink>View spending</PreviewLink>
          </div>
        </div>

        <div className="p-4">
          <PreviewHeading>Goal progress</PreviewHeading>
          <p className="mt-2 text-[10px] font-black text-[#078443]">2 of 4 on track</p>
          <div className="mt-4 space-y-4">
            <ProgressRow label="Emergency Fund" value={62} amount="$6,200 / $10,000" />
            <ProgressRow label="Home Down Payment" value={37} amount="$19,400 / $52,000" />
            <ProgressRow label="Vacation" value={43} amount="$2,150 / $5,000" />
            <ProgressRow label="New Car" value={0} amount="$0 / $25,000" />
          </div>
          <PreviewLink>View all goals</PreviewLink>
        </div>
      </div>

      <div className="grid border-t-2 border-black lg:grid-cols-2">
        <div className="border-b-2 border-black p-4 lg:border-b-0 lg:border-r-2">
          <PreviewHeading>Investment allocation</PreviewHeading>
          <div className="mt-3 grid grid-cols-[1fr_1.05fr] items-center gap-4">
            <div className="h-34" role="img" aria-label="Example investment allocation chart">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie data={allocationData} dataKey="value" nameKey="label" innerRadius="52%" outerRadius="84%" paddingAngle={1} stroke="none">
                    {allocationData.map((entry) => <Cell key={entry.label} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <AllocationLegend items={allocationData} />
          </div>
          <PreviewLink>View investments</PreviewLink>
        </div>

        <div className="p-4">
          <PreviewHeading>Recent activity</PreviewHeading>
          <ul className="mt-3 divide-y divide-black/15">
            {activity.map(({ label, category, amount, date, icon: Icon, tone }) => (
              <li key={label} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2 text-[9px]">
                <Icon className="size-4" strokeWidth={2.1} />
                <span><strong className="block font-black">{label}</strong><span className="font-semibold text-black/55">{category}</span></span>
                <span className="text-right"><strong className={`block font-black ${tone}`}>{amount}</strong><span className="font-semibold text-black/55">{date}</span></span>
              </li>
            ))}
          </ul>
          <PreviewLink>View all activity</PreviewLink>
        </div>
      </div>
    </section>
  );
}
