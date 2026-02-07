import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AdminPage } from '@/components/admin';
import { Skeleton } from '@/components/ui/skeleton';

export default function NavigationLoading() {
  return (
    <AdminPage
      title="Navigation"
      description="Manage header menu items, footer links, and social links"
    >
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminPage>
  );
}
