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
    Calendar,
    CreditCard,
    LayoutDashboard,
    LogOut,
    Receipt,
    RefreshCw,
    Settings,
    TrendingUp,
    Wallet,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/transactions", label: "Transactions", icon: Receipt },
  { href: "/dashboard/accounts", label: "Accounts", icon: Wallet },
  { href: "/dashboard/liabilities", label: "Liabilities", icon: CreditCard },
  { href: "/dashboard/investments", label: "Investments", icon: TrendingUp },
  { href: "/dashboard/recurring", label: "Recurring", icon: RefreshCw },
  { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
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
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
          <div className="container flex h-14 items-center mx-auto">
            <div className="mr-4 flex">
              <Link href="/dashboard" className="mr-6 flex items-center space-x-2">
                <TrendingUp className="h-6 w-6" />
                <span className="font-bold">FinHealth</span>
              </Link>
              <nav className="flex items-center space-x-6 text-sm font-medium">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2 transition-colors hover:text-foreground/80 text-foreground/60"
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
                    variant="ghost"
                    className="relative h-8 w-8 rounded-full"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={session.user.image || undefined}
                        alt={session.user.name || "User"}
                      />
                      <AvatarFallback>
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
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
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