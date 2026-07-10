"use client";

import { Route } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useGuidedDashboardTour } from "@/components/onboarding/GuidedDashboardTour";

export function TourLauncherButton() {
  const { startTour, isTourRunning, isTourSupported } = useGuidedDashboardTour();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => startTour({ replay: true })}
      disabled={!isTourSupported || isTourRunning}
      title={
        isTourSupported
          ? "Start dashboard tour"
          : "Dashboard tour is available on desktop. Use the checklist on smaller screens."
      }
    >
      <Route className="h-4 w-4" />
      Tour
    </Button>
  );
}
