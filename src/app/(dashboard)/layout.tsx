import { logout } from "@/actions/auth-actions";
import { auth } from "@/auth";
// import { CurrencySwitcher } from "@/components/CurrencySwitcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import prisma from "@/lib/db";
import { getInitials } from "@/lib/utils";
import {
    BarChart3,
    Calendar,
    CreditCard,
    Database,
    Goal,
    LayoutDashboard,
    LogOut,
    PieChart,
    Receipt,
    RefreshCw,
    TrendingUp,
    Wallet,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

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

/**
 * Render the authenticated dashboard layout with header, primary navigation, and user menu.
 *
 * If the user is not authenticated, redirects to "/login". Wraps `children` in a CurrencyProvider
 * using the current user's `mainCurrency` (defaults to "IDR" when not set) and renders the top
 * navigation bar (branding, primary nav, and account menu).
 *
 * @param children - Content to render inside the layout's main area
 * @returns The dashboard layout React node containing the header and main content
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Get user's main currency
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mainCurrency: true },
  });

  const mainCurrency = user?.mainCurrency || "IDR";

  return (
    <CurrencyProvider mainCurrency={mainCurrency}>
      <div className="min-h-screen bg-background">
        {/* Top Navigation */}
        <header className="sticky top-0 z-50 w-full border-b-4 border-black bg-white">
          <div className="container flex h-16 items-center mx-auto px-4">
            <div className="mr-8 flex items-center">
              <Link href="/dashboard" className="mr-8 flex items-center space-x-2 bg-primary text-primary-foreground px-3 py-1.5 neo-border shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-px hover:translate-x-px hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all">
                <TrendingUp className="h-5 w-5" />
                <span className="font-black text-lg tracking-tight uppercase font-heading">FinHealth</span>
              </Link>
              <nav className="flex items-center space-x-6 text-sm font-bold uppercase tracking-wider overflow-x-auto pb-1">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2 transition-transform hover:text-primary hover:-translate-y-0.5 text-foreground whitespace-nowrap"
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex flex-1 items-center justify-end space-x-4">
              {/* <CurrencySwitcher /> */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="relative h-10 w-10 p-0 neo-border neo-shadow-sm rounded-none bg-secondary hover:bg-secondary/80"
                  >
                    <Avatar className="h-10 w-10 rounded-none">
                      <AvatarImage
                        src={session.user.image || undefined}
                        alt={session.user.name || "User"}
                        className="rounded-none object-cover"
                      />
                      <AvatarFallback className="rounded-none bg-transparent font-bold">
                        {getInitials(session.user.name || "U")}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {session.user.name}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {session.user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  {/* <DropdownMenuSeparator /> */}
                  {/* <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem> */}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <form action={logout}>
                      <button className="flex w-full items-center">
                        <LogOut className="mr-2 h-4 w-4" />
                        Log out
                      </button>
                    </form>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto py-6">{children}</main>
      </div>
    </CurrencyProvider>
  );
}