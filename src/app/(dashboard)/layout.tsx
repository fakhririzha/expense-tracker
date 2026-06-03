import { logout } from "@/actions/auth-actions";
import { auth } from "@/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import prisma from "@/lib/db";
import { getInitials } from "@/lib/utils";
import { MobileSidebar, Sidebar } from "@/components/dashboard/Sidebar";
import { LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

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
      <div className="min-h-screen bg-background flex font-sans">
        
        {/* Sidebar Component */}
        <Sidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Navigation */}
          <header className="sticky top-0 z-50 w-full border-b-4 border-black bg-white">
            <div className="flex h-16 items-center justify-between px-4 md:px-8">
              
              <MobileSidebar />

              {/* Flex spacer for desktop so profile is on right */}
              <div className="hidden md:block flex-1"></div>
              
              {/* Profile Dropdown */}
              <div className="flex items-center space-x-4">
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
                        <AvatarFallback className="rounded-none bg-transparent font-black shadow-none border-none">
                          {getInitials(session.user.name || "U")}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 neo-border neo-shadow rounded-none" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal border-b-2 border-black pb-2 mb-2">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-black uppercase tracking-wider leading-none">
                          {session.user.name}
                        </p>
                        <p className="text-xs font-bold leading-none opacity-80">
                          {session.user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuItem asChild className="focus:bg-accent focus:font-bold focus:shadow-[2px_2px_0_0_#000] focus:translate-x-px focus:translate-y-px transition-all rounded-none my-1">
                      <Link
                        href="/dashboard/profile"
                        className="flex w-full items-center font-bold uppercase tracking-widest text-sm"
                      >
                        <UserRound className="mr-2 h-4 w-4" strokeWidth={3} />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="focus:bg-accent focus:font-bold focus:shadow-[2px_2px_0_0_#000] focus:translate-x-px focus:translate-y-px transition-all rounded-none my-1">
                      <form action={logout}>
                        <button className="flex w-full items-center font-bold uppercase tracking-widest text-sm">
                          <LogOut className="mr-2 h-4 w-4" strokeWidth={3} />
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
          <main className="container mx-auto py-6 px-4 flex-1 overflow-x-hidden">{children}</main>
        </div>
      </div>
    </CurrencyProvider>
  );
}
