"use client";

import dynamic from "next/dynamic";
import { type ReactNode, useState } from "react";

const ExportDialog = dynamic(
  () => import("@/components/export/ExportDialog").then((module) => module.ExportDialog),
  { ssr: false }
);
const ImportDialog = dynamic(
  () => import("@/components/export/ImportDialog").then((module) => module.ImportDialog),
  { ssr: false }
);

type ExportType =
  | "transactions"
  | "accounts"
  | "budgets"
  | "categories"
  | "investments"
  | "assets"
  | "recurring"
  | "all";

interface DeferredDialogProps {
  renderTrigger: (onActivate: () => void) => ReactNode;
}

interface DeferredExportDialogProps extends DeferredDialogProps {
  defaultType: ExportType;
}

/**
 * Keeps export code out of the initial Data Management route chunk. The dialog
 * loads and opens in response to its own trigger, so unrelated export forms do
 * not mount until a user chooses one.
 */
export function DeferredExportDialog({
  defaultType,
  renderTrigger,
}: DeferredExportDialogProps) {
  const [shouldRender, setShouldRender] = useState(false);

  if (!shouldRender) {
    return renderTrigger(() => setShouldRender(true));
  }

  return (
    <ExportDialog
      defaultType={defaultType}
      initialOpen
      trigger={renderTrigger(() => undefined)}
      onOpenChange={(open) => {
        if (!open) setShouldRender(false);
      }}
    />
  );
}

/**
 * Defers the CSV parser and preview UI until the import flow is explicitly
 * requested, while retaining an immediately interactive trigger.
 */
export function DeferredImportDialog({ renderTrigger }: DeferredDialogProps) {
  const [shouldRender, setShouldRender] = useState(false);

  if (!shouldRender) {
    return renderTrigger(() => setShouldRender(true));
  }

  return (
    <ImportDialog
      initialOpen
      trigger={renderTrigger(() => undefined)}
      onOpenChange={(open) => {
        if (!open) setShouldRender(false);
      }}
    />
  );
}
