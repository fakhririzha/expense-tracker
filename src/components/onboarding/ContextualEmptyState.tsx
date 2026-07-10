import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ContextualEmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  embedded?: boolean;
}

export function ContextualEmptyState({
  title,
  description,
  icon,
  action,
  className,
  embedded = false,
}: ContextualEmptyStateProps) {
  if (embedded) {
    return (
      <div
        className={cn(
          "flex min-h-64 flex-col items-center justify-center gap-4 rounded-md border border-dashed bg-muted/20 p-6 text-center",
          className
        )}
      >
        {icon ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-background text-muted-foreground">
            {icon}
          </div>
        ) : null}
        <div className="space-y-2">
          <h3 className="text-xl font-bold">{title}</h3>
          <p className="max-w-2xl text-sm font-medium text-muted-foreground">
            {description}
          </p>
        </div>
        {action ? (
          <div className="flex flex-wrap justify-center gap-2">{action}</div>
        ) : null}
      </div>
    );
  }

  return (
    <Card className={cn("border-dashed", className)}>
      <CardHeader className="items-center text-center">
        {icon ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-muted text-muted-foreground">
            {icon}
          </div>
        ) : null}
        <CardTitle className="text-xl font-bold">{title}</CardTitle>
        <CardDescription className="max-w-2xl font-medium">
          {description}
        </CardDescription>
      </CardHeader>
      {action ? (
        <CardContent className="flex flex-wrap justify-center gap-2">
          {action}
        </CardContent>
      ) : null}
    </Card>
  );
}
