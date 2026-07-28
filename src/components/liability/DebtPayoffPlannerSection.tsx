"use client";

import dynamic from "next/dynamic";

const DebtPayoffPlanner = dynamic(
  () =>
    import("@/components/liability/DebtPayoffPlanner").then(
      (module) => module.DebtPayoffPlanner
    ),
  {
    loading: () => <div className="h-64 animate-pulse rounded-lg bg-muted/40" />,
  }
);

/**
 * Client boundary for the interactive payoff planner. Keeping this dynamic
 * import outside the server page preserves server rendering for the rest of
 * the liabilities surface.
 */
export function DebtPayoffPlannerSection() {
  return <DebtPayoffPlanner />;
}
