import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function CalendarLoading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-[28rem] mt-2" />
      </div>

      {/* Tabs skeleton - 2 tabs */}
      <div className="inline-flex h-10 items-center gap-1 rounded-md bg-muted p-1">
        <Skeleton className="h-8 w-24 rounded-sm" />
        <Skeleton className="h-8 w-28 rounded-sm" />
      </div>

      {/* Export URL card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-72 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
          <div className="flex gap-2 mt-3">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </CardContent>
      </Card>

      {/* Feeds table card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-80 mt-1" />
            </div>
            <Skeleton className="h-9 w-28" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex gap-4 pb-2 border-b">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-24" />
              ))}
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-4 py-2">
                {Array.from({ length: 4 }).map((_, j) => (
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
