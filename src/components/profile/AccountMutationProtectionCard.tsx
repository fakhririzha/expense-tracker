"use client";

import { useState } from "react";
import Image from "next/image";
import { Copy, Download, KeyRound, ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import {
  activateAccountMutationProtection,
  cancelAccountMutationProtectionSetup,
  disableAccountMutationProtection,
  regenerateAccountMutationProtectionRecoveryCodes,
  startAccountMutationProtection,
} from "@/actions/profile-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  accountMutationProtectionKeys,
  useAccountMutationProtection,
} from "@/hooks/useAccountMutationProtection";

interface EnrollmentData {
  secret: string;
  qrCodeDataUrl: string;
}

function getActionError(result: unknown, fallback: string): string {
  if (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof result.error === "string"
  ) {
    return result.error;
  }
  return fallback;
}

function getActionData<T>(result: unknown): T | null {
  if (typeof result === "object" && result !== null && "data" in result) {
    return result.data as T;
  }
  return null;
}

function RecoveryCodes({ codes }: { codes: string[] }) {
  const contents = `FinHealth account change recovery codes\n\n${codes.join("\n")}\n`;

  const copy = async () => {
    await navigator.clipboard.writeText(contents);
  };

  const download = () => {
    const href = URL.createObjectURL(new Blob([contents], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = href;
    link.download = "finhealth-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <p className="font-bold">Save these recovery codes now</p>
      <p className="text-sm text-muted-foreground">
        Each code can be used once if your authenticator is unavailable. They will not be shown again.
      </p>
      <pre className="grid grid-cols-2 gap-2 whitespace-pre-wrap rounded-md bg-background p-3 text-sm font-semibold">
        {codes.join("\n")}
      </pre>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>
          <Copy className="mr-2 h-4 w-4" /> Copy codes
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={download}>
          <Download className="mr-2 h-4 w-4" /> Download codes
        </Button>
      </div>
    </div>
  );
}

export function AccountMutationProtectionCard() {
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useAccountMutationProtection();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<"idle" | "regenerate" | "disable">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: accountMutationProtectionKeys.all });
  };

  const startSetup = async () => {
    setError(null);
    setIsPending(true);
    try {
      const result = await startAccountMutationProtection({ password });
      const data = getActionData<EnrollmentData>(result);
      if (!result.success || !data) throw new Error(getActionError(result, "Failed to start setup"));
      setEnrollment(data);
      setPassword("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to start setup");
    } finally {
      setIsPending(false);
    }
  };

  const activate = async () => {
    setError(null);
    setIsPending(true);
    try {
      const result = await activateAccountMutationProtection({ code });
      const data = getActionData<{ recoveryCodes: string[] }>(result);
      if (!result.success || !data) throw new Error(getActionError(result, "Failed to enable protection"));
      setRecoveryCodes(data.recoveryCodes);
      setEnrollment(null);
      setCode("");
      await refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to enable protection");
    } finally {
      setIsPending(false);
    }
  };

  const cancelSetup = async () => {
    setIsPending(true);
    try {
      await cancelAccountMutationProtectionSetup();
      setEnrollment(null);
      setCode("");
      setError(null);
    } finally {
      setIsPending(false);
    }
  };

  const manageRecoveryCodes = async () => {
    setError(null);
    setIsPending(true);
    try {
      const result = await regenerateAccountMutationProtectionRecoveryCodes({ password, code });
      const data = getActionData<{ recoveryCodes: string[] }>(result);
      if (!result.success || !data) throw new Error(getActionError(result, "Failed to regenerate recovery codes"));
      setRecoveryCodes(data.recoveryCodes);
      setPassword("");
      setCode("");
      setMode("idle");
      await refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to regenerate recovery codes");
    } finally {
      setIsPending(false);
    }
  };

  const disable = async () => {
    setError(null);
    setIsPending(true);
    try {
      const result = await disableAccountMutationProtection({ password, code });
      if (!result.success) throw new Error(getActionError(result, "Failed to disable protection"));
      setPassword("");
      setCode("");
      setMode("idle");
      setRecoveryCodes(null);
      await refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to disable protection");
    } finally {
      setIsPending(false);
    }
  };

  const showSettingsConfirmation = mode !== "idle";

  return (
    <Card>
      <CardHeader>
        <div className="flex h-12 w-12 items-center justify-center neo-border bg-secondary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <CardTitle className="text-xl font-black uppercase font-heading">
          Account Change Protection
        </CardTitle>
        <CardDescription>
          Require an authenticator code before creating, editing, deleting, or importing new financial accounts. This does not change sign-in security.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading protection status…</p>
        ) : recoveryCodes ? (
          <RecoveryCodes codes={recoveryCodes} />
        ) : enrollment ? (
          <div className="space-y-4">
            <p className="text-sm font-medium">Scan this code with your authenticator app, then enter its six-digit code.</p>
            <Image
              src={enrollment.qrCodeDataUrl}
              alt="Authenticator setup QR code"
              width={240}
              height={240}
              unoptimized
              className="mx-auto h-60 w-60 rounded-md border bg-white p-2"
            />
            <div className="space-y-2">
              <Label>Manual setup key</Label>
              <Input value={enrollment.secret} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activate-account-totp">Authenticator code</Label>
              <Input id="activate-account-totp" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" inputMode="numeric" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void activate()} disabled={isPending}>Enable protection</Button>
              <Button type="button" variant="outline" onClick={() => void cancelSetup()} disabled={isPending}>Cancel setup</Button>
            </div>
          </div>
        ) : status?.enabled ? (
          <>
            <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">
              Protection is enabled. {status.recoveryCodesRemaining} recovery code{status.recoveryCodesRemaining === 1 ? "" : "s"} remaining.
            </div>
            {showSettingsConfirmation ? (
              <div className="space-y-3 rounded-lg border p-4">
                <p className="font-medium">
                  {mode === "regenerate" ? "Regenerate recovery codes" : "Disable account change protection"}
                </p>
                <div className="space-y-2">
                  <Label htmlFor="account-protection-password">Current password</Label>
                  <Input id="account-protection-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-protection-code">{mode === "regenerate" ? "Authenticator code" : "Authenticator or recovery code"}</Label>
                  <Input id="account-protection-code" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant={mode === "disable" ? "destructive" : "default"} onClick={() => void (mode === "regenerate" ? manageRecoveryCodes() : disable())} disabled={isPending}>
                    {mode === "regenerate" ? "Regenerate codes" : "Disable protection"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setMode("idle")} disabled={isPending}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setMode("regenerate")}><KeyRound className="mr-2 h-4 w-4" /> Regenerate recovery codes</Button>
                <Button type="button" variant="destructive" onClick={() => setMode("disable")}>Disable protection</Button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Protection is currently disabled.</p>
            <div className="space-y-2">
              <Label htmlFor="start-account-totp-password">Current password</Label>
              <Input id="start-account-totp-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
            </div>
            <Button type="button" onClick={() => void startSetup()} disabled={isPending}>Set up authenticator</Button>
          </div>
        )}
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
