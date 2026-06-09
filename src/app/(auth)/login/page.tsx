"use client";

import { Suspense, useState, type FormEvent, type ReactNode } from "react";

import { login } from "@/actions/auth-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageShell><LoginForm /></LoginPageShell>}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRegistered = searchParams.get("registered") === "true";
  const isAccountDeleted = searchParams.get("accountDeleted") === "true";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const result = await login({ email, password });
      if (!result.success) {
        setError(result.error || "Login failed");
      }
      // If successful, the server action will redirect
    } catch {
      // Redirect happens via server action
      router.push("/dashboard");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <LoginPageShell>
      {isAccountDeleted && (
        <Alert className="rounded-none border-green-200 bg-green-50 text-green-900">
          <CheckCircle2 className="h-4 w-4 text-green-700" />
          <AlertDescription className="font-medium text-green-800">
            Your account has been permanently deleted.
          </AlertDescription>
        </Alert>
      )}
      {isRegistered && !isAccountDeleted && (
        <Alert className="rounded-none border-green-200 bg-green-50 text-green-900">
          <CheckCircle2 className="h-4 w-4 text-green-700" />
          <AlertDescription className="font-medium text-green-800">
            Registration successful. You can sign in now.
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-500">
          {error}
        </div>
      )}
      <LoginForm isLoading={isLoading} onSubmit={handleSubmit} />
    </LoginPageShell>
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
