"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Calendar,
  CreditCard,
  Database,
  Goal,
  LayoutDashboard,
  PieChart,
  Receipt,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/transactions", label: "Transactions", icon: Receipt },
  { href: "/dashboard/accounts", label: "Accounts", icon: Wallet },
  { href: "/dashboard/budgets", label: "Budgets", icon: PieChart },
  { href: "/dashboard/goals", label: "Goals", icon: Goal },
  { href: "/dashboard/liabilities", label: "Liabilities", icon: CreditCard },
  { href: "/dashboard/investments", label: "Investments", icon: TrendingUp },
  { href: "/dashboard/recurring", label: "Recurring", icon: RefreshCw },
  { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
  { href: "/dashboard/data", label: "Data", icon: Database },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 border-r-4 border-black bg-white h-screen sticky top-0 z-40">
      <div className="h-16 flex items-center px-6 border-b-4 border-black bg-primary text-primary-foreground">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <TrendingUp className="h-6 w-6" strokeWidth={3} />
          <span className="font-black text-xl tracking-tight uppercase font-heading">FinHealth</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-sm font-bold uppercase tracking-wider transition-all neo-border",
                isActive
                  ? "bg-secondary text-secondary-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] translate-x-[2px] translate-y-[2px]"
                  : "bg-transparent border-transparent hover:bg-accent hover:border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px]"
              )}
            >
              <item.icon className="h-5 w-5" strokeWidth={2.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t-4 border-black">
        <div className="bg-primary text-primary-foreground p-4 neo-border shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="font-black text-xs uppercase tracking-widest opacity-90">Net Worth Goal</p>
          <p className="font-black text-lg mt-1">Keep Grinding</p>
        </div>
      </div>
    </aside>
  );
}
