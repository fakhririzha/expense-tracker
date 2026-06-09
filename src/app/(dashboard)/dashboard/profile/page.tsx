import { auth } from "@/auth";
import { AccountDeletionDialog } from "@/components/profile/AccountDeletionDialog";
import { FinancialTargetsForm } from "@/components/profile/FinancialTargetsForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import prisma from "@/lib/db";
import { CircleDollarSign, Mail, ShieldAlert, Target, UserRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      mainCurrency: true,
      retirementTarget: true,
      monthlyBudget: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-black uppercase tracking-[0.25em] text-muted-foreground">
          Account Settings
        </p>
        <h1 className="text-3xl font-black uppercase tracking-tight font-heading">
          Profile
        </h1>
        <p className="text-muted-foreground">
          Set the financial targets that guide your dashboard.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Card className="h-fit bg-secondary">
          <CardHeader>
            <div className="flex h-12 w-12 items-center justify-center neo-border bg-primary text-primary-foreground">
              <UserRound className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-black uppercase font-heading">
              Account
            </CardTitle>
            <CardDescription className="font-medium text-foreground/70">
              Your signed-in account and reporting currency.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="neo-border bg-white p-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Name
              </p>
              <p className="font-bold">{user.name || "Not provided"}</p>
            </div>
            <div className="neo-border bg-white p-3">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                Email
              </p>
              <p className="break-all font-bold">{user.email}</p>
            </div>
            <div className="neo-border bg-white p-3">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                <CircleDollarSign className="h-3.5 w-3.5" />
                Base Currency
              </p>
              <p className="font-black">{user.mainCurrency}</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center neo-border bg-secondary">
                <Target className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl font-black uppercase font-heading">
                Financial Targets
              </CardTitle>
              <CardDescription>
                Use positive amounts in your base currency. These values can be
                changed or cleared at any time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FinancialTargetsForm
                defaultValues={{
                  retirementTarget: user.retirementTarget,
                  monthlyBudget: user.monthlyBudget,
                }}
                mainCurrency={user.mainCurrency}
              />
            </CardContent>
          </Card>

          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center neo-border bg-destructive text-destructive-foreground">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl font-black uppercase font-heading">
                Danger Zone
              </CardTitle>
              <CardDescription>
                Deleting your account permanently removes your login and all
                owned financial records.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Export your data first if you want a backup before deleting your
                account.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  href="/dashboard/data"
                  className="text-sm font-bold text-primary underline-offset-4 hover:underline"
                >
                  Go to Data Export
                </Link>
                <AccountDeletionDialog email={user.email} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
