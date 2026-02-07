import { Card, CardContent } from '@/components/ui/card';
import { AdminPage } from '@/components/admin';
import { PropertyUrlSync } from '@/components/admin/PropertyUrlSync';
import { fetchPropertyOverrides } from '../actions';
import { NavigationEditor } from '../_components/navigation-editor';

export const dynamic = 'force-dynamic';

export default async function NavigationPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const params = await Promise.resolve(searchParams);
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : undefined;

  let overrides = null;
  if (propertyId) {
    overrides = await fetchPropertyOverrides(propertyId);
  }

  return (
    <AdminPage
      title="Navigation"
      description="Manage header menu items, footer links, and social links"
    >
      <PropertyUrlSync />

      {propertyId ? (
        <NavigationEditor
          propertyId={propertyId}
          initialOverrides={overrides || {}}
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">
                Please select a property to manage its navigation.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </AdminPage>
  );
}
