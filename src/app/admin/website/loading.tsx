import { Card, CardContent } from '@/components/ui/card';
import { AdminPage } from '@/components/admin';
import { Skeleton } from '@/components/ui/skeleton';

export default function WebsiteContentLoading() {
  return (
    <AdminPage
      title="Pages & Content"
      description="Edit your property website content"
    >
      <div className="flex gap-6">
        {/* Sidebar skeleton */}
        <div className="w-[250px] shrink-0 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
        {/* Content skeleton */}
        <div className="flex-1 space-y-4">
          <Skeleton className="h-8 w-48" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6 space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AdminPage>
  );
}
