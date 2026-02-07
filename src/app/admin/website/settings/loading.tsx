import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AdminPage } from '@/components/admin';
import { Skeleton } from '@/components/ui/skeleton';

export default function WebsiteSettingsLoading() {
  return (
    <AdminPage
      title="Website Settings"
      description="Configure theme, domain, and analytics for your property website"
    >
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-10 w-full max-w-sm" />
              <Skeleton className="h-10 w-full max-w-sm" />
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminPage>
  );
}
