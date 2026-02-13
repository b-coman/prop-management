import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export default function ContentStrategyLoading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 mt-2" />
      </div>

      {/* Tabs skeleton - 4 tabs */}
      <div className="inline-flex h-10 items-center gap-1 rounded-md bg-muted p-1">
        <Skeleton className="h-8 w-20 rounded-sm" />
        <Skeleton className="h-8 w-16 rounded-sm" />
        <Skeleton className="h-8 w-28 rounded-sm" />
        <Skeleton className="h-8 w-32 rounded-sm" />
      </div>

      {/* Content area */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-32 w-full mt-4" />
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
