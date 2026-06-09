"use client";

import {
  deleteCurrentUser,
  type DeleteCurrentUserInput,
} from "@/actions/profile-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface AccountDeletionDialogProps {
  email: string;
}

const initialForm: DeleteCurrentUserInput = {
  email: "",
  password: "",
};

export function AccountDeletionDialog({
  email,
}: AccountDeletionDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<DeleteCurrentUserInput>(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await deleteCurrentUser(form);

    if (!result.success) {
      setError(result.error || "Failed to delete account");
      setIsSubmitting(false);
      return;
    }

    setOpen(false);
    setForm(initialForm);
    router.push(result.data?.redirectTo || "/login?accountDeleted=true");
    router.refresh();
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      setError(null);
      setForm(initialForm);
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete Account</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase font-heading">
            Delete Account
          </DialogTitle>
          <DialogDescription>
            This permanently deletes your FinHealth account and all associated
            financial data. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive" className="neo-border rounded-none">
          <TriangleAlert className="h-4 w-4" />
          <AlertDescription>
            Type <span className="font-bold">{email}</span> and confirm your
            current password before continuing.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delete-email">Email confirmation</Label>
            <Input
              id="delete-email"
              type="email"
              placeholder={email}
              value={form.email}
              disabled={isSubmitting}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete-password">Current password</Label>
            <Input
              id="delete-password"
              type="password"
              placeholder="Enter your current password"
              value={form.password}
              disabled={isSubmitting}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
            />
          </div>

          {error && (
            <Alert variant="destructive" className="neo-border rounded-none">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Permanently Delete
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
