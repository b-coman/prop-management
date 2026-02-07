import { Card, CardContent } from '@/components/ui/card';
import { AdminPage } from '@/components/admin';
import { PropertyUrlSync } from '@/components/admin/PropertyUrlSync';
import { fetchPropertyForEditor, fetchPropertyOverrides, fetchWebsiteTemplate } from './actions';
import { WebsiteContentEditor } from './_components/website-content-editor';

export const dynamic = 'force-dynamic';

export default async function WebsiteContentPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const params = await Promise.resolve(searchParams);
  const propertyId = typeof params.propertyId === 'string' ? params.propertyId : undefined;

  let property = null;
  let template = null;
  let overrides = null;

  if (propertyId) {
    [property, overrides] = await Promise.all([
      fetchPropertyForEditor(propertyId),
      fetchPropertyOverrides(propertyId),
    ]);

    if (property) {
      const templateId = (property.templateId as string) || 'holiday-house';
      template = await fetchWebsiteTemplate(templateId);
    }
  }

  return (
    <AdminPage
      title="Pages & Content"
      description="Edit your property website content"
    >
      <PropertyUrlSync />

      {propertyId ? (
        property && template ? (
          <WebsiteContentEditor
            propertyId={propertyId}
            property={property}
            template={template}
            initialOverrides={overrides || {}}
          />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">Property or template not found.</p>
              </div>
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">
                Please select a property to edit its website content.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </AdminPage>
  );
}
