import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 p-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="h-9 w-48 animate-pulse bg-muted" />
        <div className="h-5 w-64 animate-pulse bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="h-5 w-28 animate-pulse bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-36 animate-pulse bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
