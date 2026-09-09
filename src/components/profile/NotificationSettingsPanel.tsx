"use client";

import { startTransition, useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Send, ShieldCheck, Smartphone } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  useNotificationSettings,
  useSendTestNotification,
  useSubscribeToPush,
  useUnsubscribeFromPush,
  useUpdateNotificationPreferences,
} from "@/hooks/useNotificationQueries";

import { applicationServerKeyMatches, pushRegistrationError, urlBase64ToUint8Array } from "@/lib/push-browser";

interface PreferenceDraft {
  pushEnabled: boolean;
  subscriptionRenewalEnabled: boolean;
  recurringTransactionEnabled: boolean;
  budgetThresholdEnabled: boolean;
  lowCashForecastEnabled: boolean;
  monthlySnapshotEnabled: boolean;
  goalProgressEnabled: boolean;
  importExportCompletionEnabled: boolean;
  weeklyAiInsightEnabled: boolean;
  subscriptionReminderLeadDays: number;
  recurringReminderLeadDays: number;
  budgetThresholdPercent: number;
}

function isPushSupported() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function needsIosInstallation() {
  if (typeof window === "undefined") return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && !window.matchMedia("(display-mode: standalone)").matches &&
    !(navigator as Navigator & { standalone?: boolean }).standalone;
}

export function NotificationSettingsPanel() {
  const settingsQuery = useNotificationSettings();
  const subscribeMutation = useSubscribeToPush();
  const unsubscribeMutation = useUnsubscribeFromPush();
  const updatePreferencesMutation = useUpdateNotificationPreferences();
  const sendTestMutation = useSendTestNotification();

  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [currentBrowserEnabled, setCurrentBrowserEnabled] = useState(false);
  const [stale, setStale] = useState(false);
  const [browserBusy, setBrowserBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<PreferenceDraft | null>(null);

  const settings = settingsQuery.data;
  const needsInstallation = needsIosInstallation();
  const supported = isPushSupported() && !needsInstallation;

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!settings?.preferences) {
      return;
    }

    startTransition(() => {
      setDraft(settings.preferences);
    });
  }, [settings]);

  useEffect(() => {
    if (!supported) {
      return;
    }

    let cancelled = false;

    const loadBrowserSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (cancelled) {
          return;
        }

        const matches = !!subscription && applicationServerKeyMatches(subscription.options.applicationServerKey, settings?.vapidPublicKey);
        setStale(!!subscription && !!settings?.vapidPublicKey && !matches);
        setCurrentBrowserEnabled(matches && Notification.permission === "granted");
        setCurrentEndpoint(subscription?.endpoint ?? null);
      } catch (loadError) {
        if (!cancelled) {
          console.error("Load browser subscription error:", loadError);
        }
      }
    };

    void loadBrowserSubscription();

    return () => {
      cancelled = true;
    };
  }, [supported, settings?.vapidPublicKey, settingsQuery.dataUpdatedAt]);

  const isBusy =
    browserBusy ||
    subscribeMutation.isPending ||
    unsubscribeMutation.isPending ||
    updatePreferencesMutation.isPending ||
    sendTestMutation.isPending;

  const handleEnableForBrowser = async () => {
    setError(null);
    setMessage(null);

    if (!supported) {
      setError("This browser does not support web push notifications.");
      return;
    }

    if (!settings?.vapidConfigured || !settings.vapidPublicKey) {
      setError("Web Push is not configured on the server.");
      return;
    }

    setBrowserBusy(true);
    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== "granted") {
        setError("Browser notification permission was not granted.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription && !applicationServerKeyMatches(existingSubscription.options.applicationServerKey, settings.vapidPublicKey)) {
        const oldEndpoint = existingSubscription.endpoint;
        await unsubscribeMutation.mutateAsync(oldEndpoint);
        if (!await existingSubscription.unsubscribe()) throw new Error("Could not remove the old subscription. Retry repair.");
        existingSubscription = null;
        setCurrentBrowserEnabled(false);
        setCurrentEndpoint(null);
      }
      const browserSubscription =
        existingSubscription ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(settings.vapidPublicKey),
        }));

      const serialized = browserSubscription.toJSON();
      if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys?.auth) {
        throw new Error("Browser returned an incomplete push subscription.");
      }

      await subscribeMutation.mutateAsync({
        endpoint: serialized.endpoint,
        expirationTime: serialized.expirationTime ?? null,
        keys: {
          p256dh: serialized.keys.p256dh,
          auth: serialized.keys.auth,
        },
        userAgent: navigator.userAgent,
      });

      setStale(false);
      setCurrentBrowserEnabled(true);
      setCurrentEndpoint(serialized.endpoint);
      setMessage("Push notifications are enabled for this browser.");
    } catch (enableError) {
      setError(pushRegistrationError(enableError));
    } finally {
      setBrowserBusy(false);
    }
  };

  const handleDisableForBrowser = async () => {
    setError(null);
    setMessage(null);

    setBrowserBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const browserSubscription = await registration.pushManager.getSubscription();
      const endpoint = browserSubscription?.endpoint ?? currentEndpoint;

      if (browserSubscription) {
        await browserSubscription.unsubscribe();
      }

      if (endpoint) {
        await unsubscribeMutation.mutateAsync(endpoint);
      }

      setCurrentBrowserEnabled(false);
      setCurrentEndpoint(null);
      setStale(false);
      setMessage("Push notifications are disabled for this browser.");
    } catch (disableError) {
      setError(
        disableError instanceof Error
          ? disableError.message
          : "Failed to disable push notifications."
      );
    } finally {
      setBrowserBusy(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!draft) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      await updatePreferencesMutation.mutateAsync(draft);
      setMessage("Notification preferences updated.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to update notification preferences."
      );
    }
  };

  const handleSendTest = async () => {
    setError(null);
    setMessage(null);

    try {
      if (!currentEndpoint) throw new Error("Enable this browser first.");
      const result = await sendTestMutation.mutateAsync(currentEndpoint);
      if (!result.providerAccepted) throw new Error(result.failureReason ?? "Push service did not accept the notification.");
      setMessage(`Accepted by ${result.provider} push service (HTTP ${result.statusCode}). This does not confirm display on your device. Try the local display check if nothing appears.`);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Failed to send test notification."
      );
    }
  };

  const handleLocalDisplay = async () => {
    setError(null);
    setMessage(null);
    setBrowserBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("FinHealth display check", {
        body: "This notification was created on this device.",
        tag: "finhealth-local-display-check",
        data: { url: "/dashboard/profile" },
      });
      setMessage("Local display requested. If nothing appears, check iOS Settings → Notifications → FinHealth, Focus, and Scheduled Summary, or your device's notification settings.");
    } catch {
      setError("Could not display a local notification. Check this app's notification permission in device settings.");
    } finally {
      setBrowserBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex h-12 w-12 items-center justify-center neo-border bg-primary text-primary-foreground">
          <Bell className="h-6 w-6" />
        </div>
        <CardTitle className="text-xl font-black uppercase font-heading">
          Push Notifications
        </CardTitle>
        <CardDescription>
          Enable browser notifications for private finance reminders without exposing
          sensitive details in the push message itself.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!supported && (
          <Alert variant="destructive" className="neo-border rounded-none">
            <AlertDescription>
              {needsInstallation
                ? "On iPhone or iPad, add FinHealth to your Home Screen, open the installed app, and enable notifications there."
                : "This browser or connection does not support web push notifications. Use a secure browser session over HTTPS or localhost."}
            </AlertDescription>
          </Alert>
        )}

        {supported && permission === "denied" && (
          <Alert variant="destructive" className="neo-border rounded-none">
            <AlertDescription>
              Browser notification permission is blocked. Re-enable notifications from
              your browser site settings to use this feature.
            </AlertDescription>
          </Alert>
        )}

        {message && (
          <Alert className="neo-border rounded-none bg-green-50">
            <ShieldCheck className="h-4 w-4 text-green-700" />
            <AlertDescription className="font-bold text-green-800">
              {message}
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="neo-border rounded-none">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-4">
            <div className="neo-border bg-secondary p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Current Browser
                  </p>
                  <p className="font-black">
                    {stale ? "Repair required — notification key changed" : currentBrowserEnabled ? "Enabled" : "Disabled"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Permission: <span className="font-bold">{permission}</span>
                  </p>
                </div>
                <Smartphone className="h-5 w-5 shrink-0" />
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => void handleEnableForBrowser()}
                  disabled={!supported || isBusy || permission === "denied"}
                >
                  {subscribeMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  <Bell className="h-4 w-4" />
                  {stale ? "Repair This Browser" : "Enable This Browser"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleDisableForBrowser()}
                  disabled={!supported || !currentEndpoint || isBusy}
                >
                  {unsubscribeMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  <BellOff className="h-4 w-4" />
                  Disable This Browser
                </Button>
              </div>
            </div>

            <div className="neo-border bg-white p-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Active Devices
              </p>
              <p className="mt-1 text-2xl font-black">
                {settingsQuery.isLoading ? "..." : settings?.activeDeviceCount ?? 0}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                FinHealth sends reminders only to browsers that stay subscribed and
                enabled.
              </p>
            </div>
          </div>

          <div className="neo-border bg-white p-4">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Test Flow
            </p>
            <p className="mt-1 font-bold">
              Send a generic test notification only to this browser.
            </p>
            <Button
              type="button"
              className="mt-4"
              onClick={() => void handleSendTest()}
              disabled={isBusy || !currentBrowserEnabled}
            >
              {sendTestMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              <Send className="h-4 w-4" />
              Send Test Notification
            </Button>
            <Button type="button" variant="outline" className="mt-3" onClick={() => void handleLocalDisplay()}
              disabled={isBusy || !supported || permission !== "granted"}>
              Check Local Display
            </Button>
          </div>
        </div>

        {draft && (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center justify-between gap-4 neo-border bg-white p-4">
                <div>
                  <p className="font-bold">Push notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Master on or off switch for notification delivery.
                  </p>
                </div>
                <Switch
                  checked={draft.pushEnabled}
                  onCheckedChange={(checked) =>
                    setDraft((current) =>
                      current ? { ...current, pushEnabled: checked } : current
                    )
                  }
                />
              </label>

              <label className="flex items-center justify-between gap-4 neo-border bg-white p-4">
                <div>
                  <p className="font-bold">Subscription renewals</p>
                  <p className="text-sm text-muted-foreground">
                    Reminder before a tracked bill is due.
                  </p>
                </div>
                <Switch
                  checked={draft.subscriptionRenewalEnabled}
                  onCheckedChange={(checked) =>
                    setDraft((current) =>
                      current
                        ? { ...current, subscriptionRenewalEnabled: checked }
                        : current
                    )
                  }
                />
              </label>

              <label className="flex items-center justify-between gap-4 neo-border bg-white p-4">
                <div>
                  <p className="font-bold">Recurring transactions</p>
                  <p className="text-sm text-muted-foreground">
                    Reminder for scheduled non-subscription outflows.
                  </p>
                </div>
                <Switch
                  checked={draft.recurringTransactionEnabled}
                  onCheckedChange={(checked) =>
                    setDraft((current) =>
                      current
                        ? { ...current, recurringTransactionEnabled: checked }
                        : current
                    )
                  }
                />
              </label>

              <label className="flex items-center justify-between gap-4 neo-border bg-white p-4">
                <div>
                  <p className="font-bold">Budget alerts</p>
                  <p className="text-sm text-muted-foreground">
                    Generic warning when a budget crosses its warning threshold.
                  </p>
                </div>
                <Switch
                  checked={draft.budgetThresholdEnabled}
                  onCheckedChange={(checked) =>
                    setDraft((current) =>
                      current ? { ...current, budgetThresholdEnabled: checked } : current
                    )
                  }
                />
              </label>

              <label className="flex items-center justify-between gap-4 neo-border bg-white p-4">
                <div>
                  <p className="font-bold">Cash forecast alerts</p>
                  <p className="text-sm text-muted-foreground">
                    Warning when upcoming scheduled outflows may create bank pressure.
                  </p>
                </div>
                <Switch
                  checked={draft.lowCashForecastEnabled}
                  onCheckedChange={(checked) =>
                    setDraft((current) =>
                      current ? { ...current, lowCashForecastEnabled: checked } : current
                    )
                  }
                />
              </label>

              <label className="flex items-center justify-between gap-4 neo-border bg-white p-4">
                <div>
                  <p className="font-bold">Monthly snapshots</p>
                  <p className="text-sm text-muted-foreground">
                    Notify when the latest monthly net worth snapshot is ready.
                  </p>
                </div>
                <Switch
                  checked={draft.monthlySnapshotEnabled}
                  onCheckedChange={(checked) =>
                    setDraft((current) =>
                      current ? { ...current, monthlySnapshotEnabled: checked } : current
                    )
                  }
                />
              </label>

              <label className="flex items-center justify-between gap-4 neo-border bg-white p-4">
                <div>
                  <p className="font-bold">Goal reminders</p>
                  <p className="text-sm text-muted-foreground">
                    Reminder when a goal target date is near or overdue.
                  </p>
                </div>
                <Switch
                  checked={draft.goalProgressEnabled}
                  onCheckedChange={(checked) =>
                    setDraft((current) =>
                      current ? { ...current, goalProgressEnabled: checked } : current
                    )
                  }
                />
              </label>

              <label className="flex items-center justify-between gap-4 neo-border bg-white p-4">
                <div>
                  <p className="font-bold">Weekly AI insights</p>
                  <p className="text-sm text-muted-foreground">
                    Notify when your private weekly financial brief is ready.
                  </p>
                </div>
                <Switch
                  checked={draft.weeklyAiInsightEnabled}
                  onCheckedChange={(checked) =>
                    setDraft((current) =>
                      current
                        ? { ...current, weeklyAiInsightEnabled: checked }
                        : current
                    )
                  }
                />
              </label>

              <label className="flex items-center justify-between gap-4 neo-border bg-white p-4">
                <div>
                  <p className="font-bold">Import and export updates</p>
                  <p className="text-sm text-muted-foreground">
                    Reserved for background data jobs as that flow grows.
                  </p>
                </div>
                <Switch
                  checked={draft.importExportCompletionEnabled}
                  onCheckedChange={(checked) =>
                    setDraft((current) =>
                      current
                        ? { ...current, importExportCompletionEnabled: checked }
                        : current
                    )
                  }
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="subscriptionReminderLeadDays">
                  Subscription lead days
                </Label>
                <Input
                  id="subscriptionReminderLeadDays"
                  type="number"
                  min="0"
                  max="30"
                  value={draft.subscriptionReminderLeadDays}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            subscriptionReminderLeadDays: Number(
                              event.target.value || DEFAULT_VALUES.subscriptionReminderLeadDays
                            ),
                          }
                        : current
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recurringReminderLeadDays">
                  Recurring lead days
                </Label>
                <Input
                  id="recurringReminderLeadDays"
                  type="number"
                  min="0"
                  max="30"
                  value={draft.recurringReminderLeadDays}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            recurringReminderLeadDays: Number(
                              event.target.value || DEFAULT_VALUES.recurringReminderLeadDays
                            ),
                          }
                        : current
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="budgetThresholdPercent">
                  Budget warning percent
                </Label>
                <Input
                  id="budgetThresholdPercent"
                  type="number"
                  min="1"
                  max="100"
                  value={draft.budgetThresholdPercent}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? {
                            ...current,
                            budgetThresholdPercent: Number(
                              event.target.value || DEFAULT_VALUES.budgetThresholdPercent
                            ),
                          }
                        : current
                    )
                  }
                />
              </div>
            </div>

            <Button type="button" onClick={() => void handleSavePreferences()} disabled={isBusy}>
              {updatePreferencesMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Save Notification Preferences
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const DEFAULT_VALUES = {
  subscriptionReminderLeadDays: 3,
  recurringReminderLeadDays: 1,
  budgetThresholdPercent: 80,
};
