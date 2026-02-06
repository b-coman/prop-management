import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function PricingLoading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 mt-2" />
      </div>

      {/* Tabs skeleton - 4 tabs */}
      <div className="inline-flex h-10 items-center gap-1 rounded-md bg-muted p-1">
        <Skeleton className="h-8 w-32 rounded-sm" />
        <Skeleton className="h-8 w-28 rounded-sm" />
        <Skeleton className="h-8 w-28 rounded-sm" />
        <Skeleton className="h-8 w-20 rounded-sm" />
      </div>

      {/* Card with table content */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-80 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Table header */}
            <div className="flex gap-4 pb-2 border-b">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-24" />
              ))}
            </div>
            {/* Table rows */}
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-4 py-2">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="h-4 w-20" />
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
