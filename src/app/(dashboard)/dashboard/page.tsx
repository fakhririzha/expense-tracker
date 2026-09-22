import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  DashboardChangelogButton,
  DashboardMoneyPlanSection,
  DashboardPositionSection,
} from "@/components/dashboard/DashboardHomeSections";
import {
  DashboardMoneyPlanSkeleton,
  DashboardPositionSkeleton,
} from "@/components/dashboard/DashboardLoadingSkeleton";
import { GettingStartedCard } from "@/components/onboarding/GettingStartedCard";
import { TourLauncherButton } from "@/components/onboarding/TourLauncherButton";
import { ONBOARDING_TOUR_TARGETS } from "@/lib/onboarding/constants";

/**
 * Render the authenticated user's action-led dashboard and financial position.
 *
 * Position cards stream without waiting for the monthly money plan or changelog.
 */
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div
      data-tour-id={ONBOARDING_TOUR_TARGETS.dashboardRoot}
      className="p-6 space-y-6"
    >
      <div
        data-tour-id={ONBOARDING_TOUR_TARGETS.dashboardWelcome}
        className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {session.user.name || "User"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Suspense fallback={null}>
            <DashboardChangelogButton />
          </Suspense>
          <TourLauncherButton />
        </div>
      </div>

      <GettingStartedCard />

      <Suspense fallback={<DashboardMoneyPlanSkeleton />}>
        <DashboardMoneyPlanSection />
      </Suspense>

      <Suspense fallback={<DashboardPositionSkeleton />}>
        <DashboardPositionSection userId={session.user.id} />
      </Suspense>
    </div>
  );
}
