"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ForecastEmptyStateProps {
  title?: string;
  description: string;
}

export function ForecastEmptyState({
  title = "No forecast data",
  description,
}: ForecastEmptyStateProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="py-8">
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
