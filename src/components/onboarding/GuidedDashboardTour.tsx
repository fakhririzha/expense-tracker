"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ACTIONS,
  EVENTS,
  STATUS,
  type EventData,
  type Props as JoyrideProps,
  type Step,
} from "react-joyride";

import {
  useCompleteMainTour,
  useOnboardingState,
  useUpsertOnboardingState,
} from "@/hooks/useOnboardingQueries";
import { ONBOARDING_TOUR_STEPS } from "@/lib/onboarding/constants";

const Joyride = dynamic<JoyrideProps>(
  () => import("react-joyride").then((mod) => mod.Joyride),
  { ssr: false }
);

const DESKTOP_MEDIA_QUERY = "(min-width: 768px)";
const DASHBOARD_PATH = "/dashboard";

interface StartTourOptions {
  replay?: boolean;
}

interface GuidedDashboardTourContextValue {
  startTour: (options?: StartTourOptions) => void;
  isTourSupported: boolean;
  isTourRunning: boolean;
}

const GuidedDashboardTourContext =
  createContext<GuidedDashboardTourContextValue | null>(null);

function useIsDesktopViewport() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const syncViewport = () => setIsDesktop(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);

    return () => {
      mediaQuery.removeEventListener("change", syncViewport);
    };
  }, []);

  return isDesktop;
}

function getAvailableTourSteps(): Step[] {
  if (typeof document === "undefined") {
    return [];
  }

  return ONBOARDING_TOUR_STEPS.filter((step) =>
    Boolean(document.querySelector(step.selector))
  ).map((step) => ({
    id: step.id,
    target: step.selector,
    title: step.title,
    content: step.body,
    placement: "auto",
  }));
}

export function useGuidedDashboardTour() {
  const context = useContext(GuidedDashboardTourContext);

  if (!context) {
    return {
      startTour: () => undefined,
      isTourSupported: false,
      isTourRunning: false,
    } satisfies GuidedDashboardTourContextValue;
  }

  return context;
}

export function GuidedDashboardTourProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isDesktop = useIsDesktopViewport();
  const { data: onboardingState } = useOnboardingState();
  const completeMainTourMutation = useCompleteMainTour();
  const upsertOnboardingStateMutation = useUpsertOnboardingState();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [steps, setSteps] = useState<Step[]>([]);
  const handledPendingStartRef = useRef(false);
  const handledTerminalRef = useRef(false);

  const isTourSupported = pathname === DASHBOARD_PATH && isDesktop;

  const stopTourWithoutCompletion = useCallback(async () => {
    if (handledTerminalRef.current) {
      return;
    }

    handledTerminalRef.current = true;
    setRun(false);
    setStepIndex(0);

    try {
      await upsertOnboardingStateMutation.mutateAsync({ lastTourStep: null });
    } catch (error) {
      console.error("Failed to clear pending onboarding tour:", error);
    }
  }, [upsertOnboardingStateMutation]);

  const finishTour = useCallback(async () => {
    if (handledTerminalRef.current) {
      return;
    }

    handledTerminalRef.current = true;
    setRun(false);
    setStepIndex(0);

    try {
      await completeMainTourMutation.mutateAsync();
    } catch (error) {
      console.error("Failed to complete onboarding tour:", error);
    }
  }, [completeMainTourMutation]);

  const startTour = useCallback(
    (options: StartTourOptions = {}) => {
      if (!isTourSupported) {
        return;
      }

      if (run && !options.replay) {
        return;
      }

      const availableSteps = getAvailableTourSteps();
      if (availableSteps.length === 0) {
        if (!options.replay) {
          void stopTourWithoutCompletion();
        }

        return;
      }

      handledTerminalRef.current = false;
      setSteps(availableSteps);
      setStepIndex(0);
      setRun(true);
    },
    [isTourSupported, run, stopTourWithoutCompletion]
  );

  const handleJoyrideEvent = useCallback(
    (data: EventData) => {
      const isFinished = data.status === STATUS.FINISHED;
      const isSkipped = data.status === STATUS.SKIPPED;

      if (data.type === EVENTS.TOUR_END || isFinished || isSkipped) {
        if (isFinished) {
          void finishTour();
        } else {
          void stopTourWithoutCompletion();
        }

        return;
      }

      if (data.type === EVENTS.TARGET_NOT_FOUND) {
        const nextIndex =
          data.action === ACTIONS.PREV ? data.index - 1 : data.index + 1;

        if (nextIndex >= 0 && nextIndex < steps.length) {
          setStepIndex(nextIndex);
        } else {
          void stopTourWithoutCompletion();
        }

        return;
      }

      if (data.type === EVENTS.STEP_AFTER) {
        const nextIndex =
          data.action === ACTIONS.PREV ? data.index - 1 : data.index + 1;

        if (data.action === ACTIONS.NEXT && nextIndex >= steps.length) {
          void finishTour();
          return;
        }

        setStepIndex(Math.max(0, Math.min(nextIndex, steps.length - 1)));
      }
    },
    [finishTour, steps.length, stopTourWithoutCompletion]
  );

  useEffect(() => {
    if (onboardingState?.lastTourStep !== 0) {
      handledPendingStartRef.current = false;
    }
  }, [onboardingState?.lastTourStep]);

  useEffect(() => {
    if (
      !isTourSupported ||
      !onboardingState ||
      onboardingState.hasSkippedOnboarding ||
      onboardingState.hasCompletedMainTour ||
      onboardingState.lastTourStep !== 0 ||
      handledPendingStartRef.current ||
      run
    ) {
      return;
    }

    handledPendingStartRef.current = true;
    const timeoutId = window.setTimeout(() => startTour(), 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isTourSupported, onboardingState, run, startTour]);

  useEffect(() => {
    if (run && !isTourSupported) {
      const timeoutId = window.setTimeout(() => {
        void stopTourWithoutCompletion();
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }
  }, [isTourSupported, run, stopTourWithoutCompletion]);

  const contextValue = useMemo(
    () => ({
      startTour,
      isTourSupported,
      isTourRunning: run,
    }),
    [isTourSupported, run, startTour]
  );

  return (
    <GuidedDashboardTourContext.Provider value={contextValue}>
      {children}
      <Joyride
        run={run}
        stepIndex={stepIndex}
        steps={steps}
        continuous
        scrollToFirstStep
        onEvent={handleJoyrideEvent}
        locale={{
          back: "Back",
          close: "Close",
          last: "Finish",
          next: "Next",
          nextWithProgress: "Next ({current} of {total})",
        }}
        options={{
          blockTargetInteraction: true,
          buttons: ["back", "close", "primary"],
          closeButtonAction: "skip",
          dismissKeyAction: false,
          overlayColor: "rgba(15, 23, 42, 0.45)",
          primaryColor: "#0f172a",
          scrollOffset: 96,
          showProgress: true,
          skipBeacon: true,
          spotlightRadius: 0,
          zIndex: 10000,
        }}
      />
    </GuidedDashboardTourContext.Provider>
  );
}
