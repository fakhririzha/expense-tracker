"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Download, Share, X } from "lucide-react";

const INSTALL_DISMISS_KEY = "finhealth-install-dismissed-at";
const DISMISS_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 21;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

function isStandaloneDisplayMode() {
  if (typeof window === "undefined") {
    return false;
  }

  const standaloneMatch = window.matchMedia("(display-mode: standalone)").matches;
  const navigatorWithStandalone = navigator as Navigator & {
    standalone?: boolean;
  };

  return standaloneMatch || navigatorWithStandalone.standalone === true;
}

function isIosDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isChromiumInstallBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /(?:chrome|chromium|crios|edg)/i.test(navigator.userAgent);
}

function isDismissedRecently() {
  if (typeof window === "undefined") {
    return false;
  }

  const rawValue = window.localStorage.getItem(INSTALL_DISMISS_KEY);
  if (!rawValue) {
    return false;
  }

  const dismissedAt = Number(rawValue);
  if (!Number.isFinite(dismissedAt)) {
    window.localStorage.removeItem(INSTALL_DISMISS_KEY);
    return false;
  }

  return Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [browserState, setBrowserState] = useState<{
    hasHydrated: boolean;
    isStandalone: boolean;
    isIos: boolean;
    supportsManualGuide: boolean;
    isVisible: boolean;
  }>({
    hasHydrated: false,
    isStandalone: false,
    isIos: false,
    supportsManualGuide: false,
    isVisible: false,
  });

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const standalone = isStandaloneDisplayMode();
      const iosDevice = isIosDevice();
      const supportsGuide = iosDevice || isChromiumInstallBrowser();

      setBrowserState({
        hasHydrated: true,
        isStandalone: standalone,
        isIos: iosDevice,
        supportsManualGuide: supportsGuide,
        isVisible: !standalone && !isDismissedRecently(),
      });
    });

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setBrowserState((current) => ({
        ...current,
        isVisible: !isDismissedRecently(),
      }));
    };

    const handleInstalled = () => {
      window.localStorage.removeItem(INSTALL_DISMISS_KEY);
      setDeferredPrompt(null);
      setBrowserState((current) => ({
        ...current,
        isVisible: false,
        isStandalone: true,
      }));
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const { hasHydrated, isStandalone, isIos, supportsManualGuide, isVisible } =
    browserState;
  const canPrompt = !!deferredPrompt;
  const canShowGuide = supportsManualGuide && !isStandalone;

  if (
    !hasHydrated ||
    !isVisible ||
    (!canPrompt && !canShowGuide) ||
    isStandalone
  ) {
    return null;
  }

  const dismissPrompt = () => {
    window.localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
    setBrowserState((current) => ({
      ...current,
      isVisible: false,
    }));
    setIsDialogOpen(false);
  };

  const handleInstall = async () => {
    if (!canPrompt && canShowGuide) {
      setIsDialogOpen(true);
      return;
    }

    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);

    if (outcome === "dismissed") {
      dismissPrompt();
      return;
    }

    setBrowserState((current) => ({
      ...current,
      isVisible: false,
    }));
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => void handleInstall()}
          className={cn(
            "h-10 rounded-none px-3",
            "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          {!canPrompt && isIos ? (
            <Share className="h-4 w-4" strokeWidth={2.5} />
          ) : (
            <Download className="h-4 w-4" strokeWidth={2.5} />
          )}
          <span className="hidden lg:inline">
            {canPrompt ? "Install App" : "Install Guide"}
          </span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-none"
          onClick={dismissPrompt}
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md rounded-none">
          <DialogHeader>
            <DialogTitle>Install FinHealth</DialogTitle>
            <DialogDescription>
              Add FinHealth to your home screen for a cleaner, app-like launch
              experience.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            {isIos ? (
              <>
                <p>1. Open Safari&apos;s share menu for this page.</p>
                <p>
                  2. Choose{" "}
                  <span className="font-bold text-foreground">
                    Add to Home Screen
                  </span>.
                </p>
                <p>
                  3. Confirm the name, then tap{" "}
                  <span className="font-bold text-foreground">Add</span>.
                </p>
              </>
            ) : (
              <>
                <p>
                  1. Open your browser&apos;s install control for this page.
                </p>
                <p>
                  2. In Chrome and Edge, look for the install button in the
                  address bar or browser menu.
                </p>
                <p>
                  3. Confirm the prompt to add FinHealth as an app.
                </p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={dismissPrompt}>
              Dismiss
            </Button>
            <Button type="button" onClick={() => setIsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
