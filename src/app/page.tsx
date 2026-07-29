import Link from "next/link";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Banknote,
  BarChart3,
  CalendarClock,
  ChartNoAxesCombined,
  CircleDollarSign,
  Goal,
  Heart,
  Landmark,
  LockKeyhole,
  ShieldCheck,
  Target,
  WalletCards,
} from "lucide-react";

import { MarketingDashboardPreview } from "@/components/marketing/MarketingDashboardPreview";
import { MarketingShell } from "@/components/marketing/MarketingShell";

const featureCards = [
  {
    number: "01",
    title: "All accounts",
    description: "See cash, bank, investment, debt, receivable, and deposito balances in one place.",
    icon: Landmark,
  },
  {
    number: "02",
    title: "Transaction clarity",
    description: "Track income, spending, transfers, splits, and recurring money without losing the story.",
    icon: WalletCards,
  },
  {
    number: "03",
    title: "Budgets that hold up",
    description: "Build real category budgets and see progress without daily micromanagement.",
    icon: Banknote,
  },
  {
    number: "04",
    title: "Investment visibility",
    description: "Follow allocation, valuation, trades, and performance across your holdings.",
    icon: ChartNoAxesCombined,
  },
  {
    number: "05",
    title: "Subscription control",
    description: "See renewals and trials before they quietly become another charge.",
    icon: CalendarClock,
  },
  {
    number: "06",
    title: "Goals with momentum",
    description: "Link real accounts to goals and watch progress update with your balances.",
    icon: Goal,
  },
];

const timeline = [
  { label: "Weekend Grocer", category: "Groceries", amount: "-$78.43", tone: "text-[#ef6353]" },
  { label: "Salary Deposit", category: "Income", amount: "+$2,950.00", tone: "text-[#078443]" },
  { label: "Transit Card", category: "Transport", amount: "-$52.18", tone: "text-[#ef6353]" },
  { label: "Transfer to Savings", category: "Transfer", amount: "-$500.00", tone: "text-[#ef6353]" },
  { label: "Stream Monthly", category: "Entertainment", amount: "-$15.49", tone: "text-[#ef6353]" },
  { label: "Interest Payment", category: "Credit card", amount: "-$24.36", tone: "text-[#ef6353]" },
];

const questions = [
  { quote: "What can I safely spend before the next payday?", label: "Cash clarity", icon: CircleDollarSign },
  { quote: "Which categories keep pulling me off plan?", label: "Spending patterns", icon: BarChart3 },
  { quote: "Are my debts, goals, and investments moving together?", label: "Whole-picture progress", icon: Target },
];

const audiences = [
  { title: "Single professional", description: "Manage money, build savings, and invest in your future.", icon: WalletCards },
  { title: "Household planner", description: "Plan shared expenses, budgets, and goals in one view.", icon: Heart },
  { title: "Goal planner", description: "Turn big goals into a plan you can actually follow.", icon: Target },
];

function ArrowLink({ href, children, primary = false }: { href: string; children: ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={primary
        ? "inline-flex items-center gap-2 border-2 border-black bg-black px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-white shadow-[4px_4px_0_#000] transition-transform hover:translate-x-px hover:translate-y-px hover:shadow-[3px_3px_0_#000]"
        : "inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.08em] underline decoration-2 underline-offset-5"
      }
    >
      {children} <ArrowRight className="size-4" strokeWidth={2.8} />
    </Link>
  );
}

export default async function Home() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <MarketingShell>
      <main>
        <section id="overview" className="border-b-2 border-black px-5 py-15 md:px-8 md:py-20">
          <div className="mx-auto max-w-7xl text-center">
            <span className="inline-flex border-2 border-black bg-[#f6ce30] px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] shadow-[2px_2px_0_#000]">
              The private money system
            </span>
            <h1 className="mx-auto mt-5 max-w-4xl font-heading text-5xl font-black uppercase leading-[0.88] tracking-[-0.06em] sm:text-7xl lg:text-[6.5rem]">
              Know what your money is doing.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base font-bold leading-6 text-black/70 sm:text-lg">
              FinHealth brings accounts, spending, debt, investments, and goals into one honest daily picture.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-6 sm:flex-row">
              <ArrowLink href="/register" primary>Get started free</ArrowLink>
              <ArrowLink href="#dashboard-preview">See the dashboard</ArrowLink>
            </div>
            <div className="mx-auto mt-12 max-w-6xl text-left">
              <MarketingDashboardPreview />
              <p className="mt-3 text-center text-xs font-semibold text-black/55">Illustrative preview with fictional data.</p>
            </div>
          </div>
        </section>

        <section id="features" className="border-b-2 border-black">
          <div className="mx-auto grid max-w-7xl border-l-2 border-black md:grid-cols-2 lg:grid-cols-3">
            {featureCards.map(({ number, title, description, icon: Icon }, index) => (
              <article key={number} className={`min-h-60 border-b-2 border-r-2 border-black p-6 last:border-b-0 md:last:border-b-2 ${index > 2 ? "lg:border-b-0" : ""}`}>
                <div className="flex items-start gap-4">
                  <div className="flex size-13 shrink-0 items-center justify-center bg-black text-white">
                    <Icon className="size-7" strokeWidth={1.9} />
                  </div>
                  <div>
                    <span className="text-sm font-black text-[#078443]">{number}</span>
                    <h2 className="mt-1 font-heading text-2xl font-black leading-6">{title}</h2>
                    <p className="mt-3 text-sm font-bold leading-5 text-black/70">{description}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="border-b-2 border-black px-5 py-12 md:px-8 md:py-16">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.85fr_1.15fr_0.7fr] lg:items-center">
            <div>
              <h2 className="max-w-sm font-heading text-5xl font-black uppercase leading-[0.9] tracking-[-0.06em]">Your money has a pattern. See it.</h2>
              <p className="mt-6 max-w-xs text-sm font-bold leading-5 text-black/65">
                The timeline turns transactions, recurring charges, and renewals into a financial story you can act on.
              </p>
            </div>
            <div className="border-2 border-black bg-white shadow-[4px_4px_0_#000]">
              <div className="flex items-center justify-between border-b-2 border-black px-4 py-3">
                <span className="text-xs font-black uppercase tracking-[0.08em]">Timeline</span>
                <span className="border border-black px-2 py-1 text-[9px] font-bold">30 Days</span>
              </div>
              <ol className="relative mx-5 my-4 border-l-2 border-black/30 pl-5">
                {timeline.map((item, index) => (
                  <li key={item.label} className="relative grid grid-cols-[1fr_auto] gap-3 py-2 text-xs">
                    <span className={`absolute -left-[1.65rem] top-3 size-2.5 rounded-full border-2 border-white ${index < 2 ? "bg-[#078443]" : "bg-black"}`} />
                    <span><strong className="block font-black">{item.label}</strong><span className="font-semibold text-black/55">{item.category}</span></span>
                    <strong className={`font-black ${item.tone}`}>{item.amount}</strong>
                  </li>
                ))}
              </ol>
            </div>
            <aside className="border-2 border-black bg-[#d8f45b] p-6 shadow-[4px_4px_0_#000]">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.08em]"><span>Insight</span><BarChart3 className="size-4" /></div>
              <h3 className="mt-9 font-heading text-3xl font-black leading-7">You spend more on dining out on weekends.</h3>
              <p className="mt-5 text-sm font-bold leading-5 text-black/70">Average Saturday spend is 42% higher than weekdays.</p>
              <Link href="/register" className="mt-8 inline-flex border-2 border-black px-3 py-2 text-xs font-black uppercase tracking-[0.08em]">View insights <ArrowRight className="ml-2 size-4" /></Link>
            </aside>
          </div>
        </section>

        <section id="security" className="border-b-2 border-black bg-black px-5 py-8 text-white md:px-8">
          <div className="mx-auto grid max-w-7xl gap-7 md:grid-cols-3">
            {[
              { title: "Your data stays yours.", copy: "Sensitive fields use encryption, and you control your own records.", icon: LockKeyhole },
              { title: "No ad-funded incentives.", copy: "The product is built for financial clarity, not attention harvesting.", icon: ShieldCheck },
              { title: "No shame.", copy: "Clear signals help you make decisions without turning money into judgment.", icon: Heart },
            ].map(({ title, copy, icon: Icon }) => (
              <article key={title} className="flex gap-4 md:border-r md:border-white/60 md:pr-7 last:border-r-0">
                <div className="flex size-14 shrink-0 items-center justify-center border-2 border-white"><Icon className="size-7" strokeWidth={1.8} /></div>
                <div><h2 className="font-heading text-xl font-black">{title}</h2><p className="mt-2 text-sm font-semibold leading-5 text-white/70">{copy}</p></div>
              </article>
            ))}
          </div>
        </section>

        <section className="border-b-2 border-black px-5 py-12 md:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.65fr_1fr]">
            <h2 className="max-w-60 font-heading text-4xl font-black uppercase leading-[0.9] tracking-[-0.05em]">Questions worth answering.</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {questions.map(({ quote, label, icon: Icon }) => (
                <article key={label} className="border-2 border-black p-5 shadow-[3px_3px_0_#000]">
                  <span className="font-heading text-5xl font-black leading-none">“</span>
                  <p className="mt-2 font-heading text-xl font-black leading-5">{quote}</p>
                  <div className="mt-7 flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em]"><Icon className="size-4 text-[#078443]" />{label}</div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b-2 border-black px-5 py-12 md:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.65fr_1fr]">
            <h2 className="max-w-62 font-heading text-4xl font-black uppercase leading-[0.9] tracking-[-0.05em]">Built for real life. Whatever yours looks like.</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {audiences.map(({ title, description, icon: Icon }) => (
                <article key={title} className="flex gap-4 border-2 border-black p-5"><Icon className="size-10 shrink-0" strokeWidth={1.8} /><div><h3 className="font-heading text-xl font-black">{title}</h3><p className="mt-2 text-sm font-bold leading-5 text-black/65">{description}</p></div></article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-7 md:px-8">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 border-2 border-black bg-[#f6ce30] p-6 shadow-[5px_5px_0_#000] md:flex-row md:px-10">
            <div className="flex items-center gap-5"><Target className="size-14 shrink-0" strokeWidth={2} /><h2 className="max-w-lg font-heading text-4xl font-black uppercase leading-[0.9] tracking-[-0.05em]">Clarity is a competitive advantage.</h2></div>
            <ArrowLink href="/register" primary>Start tracking</ArrowLink>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
