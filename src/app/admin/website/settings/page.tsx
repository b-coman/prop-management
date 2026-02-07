import { Card, CardContent } from '@/components/ui/card';
import { AdminPage } from '@/components/admin';
import { PropertyUrlSync } from '@/components/admin/PropertyUrlSync';
import { fetchPropertyWebsiteSettings } from '../actions';
import { WebsiteSettingsForm } from '../_components/website-settings-form';

export const dynamic = 'force-dynamic';

export default async function WebsiteSettingsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const params = await Promise.resolve(searchParams);
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : undefined;

  let settings = null;
  if (propertyId) {
    settings = await fetchPropertyWebsiteSettings(propertyId);
  }

  return (
    <AdminPage
      title="Website Settings"
      description="Configure theme, domain, and analytics for your property website"
    >
      <PropertyUrlSync />

      {propertyId ? (
        settings ? (
          <WebsiteSettingsForm propertyId={propertyId} initialSettings={settings} />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">Property not found.</p>
              </div>
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">
                Please select a property to manage its website settings.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </AdminPage>
  );
}
