"use client";

import { useEffect, useState } from "react";

import { AccountMutationConfirmationField } from "@/components/accounts/AccountMutationConfirmationField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteAccount } from "@/hooks/useAccountQueries";
import { useAccountMutationProtection } from "@/hooks/useAccountMutationProtection";

interface DeleteAccountDialogProps {
  account: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({
  account,
  open,
  onOpenChange,
}: DeleteAccountDialogProps) {
  const [confirmationCode, setConfirmationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const deleteMutation = useDeleteAccount();
  const { data: protection } = useAccountMutationProtection();

  useEffect(() => {
    setConfirmationCode("");
    setError(null);
  }, [account?.id]);

  const handleDelete = async () => {
    if (!account) return;
    setError(null);
    try {
      await deleteMutation.mutateAsync({
        id: account.id,
        ...(protection?.enabled ? { confirmation: { code: confirmationCode } } : {}),
      });
      setConfirmationCode("");
      onOpenChange(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to delete account");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setConfirmationCode("");
          setError(null);
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete account?</DialogTitle>
          <DialogDescription>
            This will permanently delete {account ? `“${account.name}”` : "this account"}.
            Accounts with transactions cannot be deleted.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {protection?.enabled && (
            <AccountMutationConfirmationField
              value={confirmationCode}
              onChange={setConfirmationCode}
            />
          )}
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
