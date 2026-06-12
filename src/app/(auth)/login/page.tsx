"use client";

import {
  Suspense,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { login } from "@/actions/auth-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Loader2, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type LoginDialogState =
  | {
      kind: "success";
      message: string;
      redirectTo: string;
    }
  | {
      kind: "error";
      message: string;
    };

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <LoginPageShell>
          <LoginForm />
        </LoginPageShell>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [dialog, setDialog] = useState<LoginDialogState | null>(null);
  const isRegistered = searchParams.get("registered") === "true";
  const isAccountDeleted = searchParams.get("accountDeleted") === "true";

  useEffect(() => {
    if (!dialog || dialog.kind !== "success") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDialog(null);
      router.replace(dialog.redirectTo);
    }, 1400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [dialog, router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setDialog(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const result = await login({ email, password });
      if (result.success) {
        setDialog({
          kind: "success",
          message:
            "You are signed in. Redirecting to your dashboard in a moment.",
          redirectTo: result.redirectTo,
        });
      } else {
        setDialog({
          kind: "error",
          message: result.error || "Login failed",
        });
      }
    } catch {
      setDialog({
        kind: "error",
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function navigateFromSuccessDialog(redirectTo: string) {
    setDialog(null);
    router.replace(redirectTo);
  }

  return (
    <>
      <LoginPageShell>
        {isAccountDeleted && (
          <div className="rounded-none border border-green-200 bg-green-50 p-3 text-sm text-green-900">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-700" />
              <p className="font-medium text-green-800">
                Your account has been permanently deleted.
              </p>
            </div>
          </div>
        )}
        {isRegistered && !isAccountDeleted && (
          <div className="rounded-none border border-green-200 bg-green-50 p-3 text-sm text-green-900">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-700" />
              <p className="font-medium text-green-800">
                Registration successful. You can sign in now.
              </p>
            </div>
          </div>
        )}
        <LoginForm isLoading={isLoading} onSubmit={handleSubmit} />
      </LoginPageShell>

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (open) {
            return;
          }

          if (dialog?.kind === "error") {
            setDialog(null);
          }
        }}
      >
        {dialog ? (
          <DialogContent
            showCloseButton={dialog.kind !== "success"}
            className={cn(
              "sm:max-w-md",
              dialog.kind === "success"
                ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
            )}
          >
            <DialogHeader className="items-center text-center">
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center neo-border neo-shadow",
                  dialog.kind === "success" ? "bg-green-600" : "bg-red-600"
                )}
              >
                {dialog.kind === "success" ? (
                  <CheckCircle2 className="h-7 w-7 text-white" />
                ) : (
                  <AlertCircle className="h-7 w-7 text-white" />
                )}
              </div>
              <DialogTitle className="font-heading text-2xl font-black uppercase tracking-tight">
                {dialog.kind === "success" ? "Signed in" : "Sign-in failed"}
              </DialogTitle>
              <DialogDescription
                className={cn(
                  "max-w-sm text-balance text-base font-medium",
                  dialog.kind === "success"
                    ? "text-green-900/80"
                    : "text-red-900/80"
                )}
              >
                {dialog.message}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-2 sm:justify-center">
              {dialog.kind === "success" ? (
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    navigateFromSuccessDialog(dialog.redirectTo);
                  }}
                >
                  Continue
                </Button>
              ) : (
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setDialog(null);
                  }}
                >
                  Try again
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}

type LoginPageShellProps = {
  children?: ReactNode;
};

function LoginPageShell({ children }: LoginPageShellProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center mb-2">
            <div className="h-16 w-16 neo-border bg-primary flex items-center justify-center neo-shadow">
              <TrendingUp className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-3xl font-black uppercase tracking-tight">FinHealth</CardTitle>
          <CardDescription className="text-base font-medium">
            Sign in to your Financial Health Dashboard
          </CardDescription>
        </CardHeader>
        {children}
      </Card>
    </div>
  );
}

type LoginFormProps = {
  isLoading?: boolean;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

function LoginForm({ isLoading = false, onSubmit }: LoginFormProps) {
  return (
    <form onSubmit={onSubmit}>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            disabled={isLoading}
          />
        </div>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4 pt-6">
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign In
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </form>
  );
}
