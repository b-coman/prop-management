import { Card, CardContent } from '@/components/ui/card';
import { AdminPage } from '@/components/admin';
import { PropertyUrlSync } from '@/components/admin/PropertyUrlSync';
import { fetchGuide } from './actions';
import { GuideEditor } from './_components/guide-editor';

export const dynamic = 'force-dynamic';

export default async function GuestGuidePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const params = await Promise.resolve(searchParams);
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : undefined;

  const guide = propertyId ? await fetchGuide(propertyId) : null;

  return (
    <AdminPage
      title="Guest guide"
      description="Arrival, Wi-Fi, contacts and the guide sections. The emails read the same fields."
    >
      <PropertyUrlSync />

      {propertyId ? (
        guide ? (
          <GuideEditor propertyId={propertyId} initial={guide} />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">
                  No guide found for this property yet.
                </p>
              </div>
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Please select a property to edit its guest guide.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </AdminPage>
  );
}
