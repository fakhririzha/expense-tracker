"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AccountMutationConfirmationFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function AccountMutationConfirmationField({
  value,
  onChange,
}: AccountMutationConfirmationFieldProps) {
  return (
    <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <Label htmlFor="account-mutation-confirmation">Confirmation code</Label>
      <Input
        id="account-mutation-confirmation"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Authenticator or recovery code"
        autoComplete="one-time-code"
      />
      <p className="text-xs text-muted-foreground">
        Enter a current six-digit authenticator code or an unused recovery code.
      </p>
    </div>
  );
}
