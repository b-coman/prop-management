import { AdminPage } from '@/components/admin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PropertyUrlSync } from '@/components/admin/PropertyUrlSync';
import { fetchAudienceAction } from '../actions';
import { AudiencePicker } from '../_components/audience-picker';

export const dynamic = 'force-dynamic';

const DEFAULT_PROPERTY = 'prahova-mountain-chalet';

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const { propertyId } = await searchParams;
  const property = propertyId || DEFAULT_PROPERTY;
  const res = await fetchAudienceAction(property);

  return (
    <AdminPage
      title="New campaign — audience"
      description="Pick who to reach. Only the hard rules exclude a guest (opted out, no WhatsApp, suppressed, upcoming stay, messaged recently); everything else is advisory and up to you."
    >
      <PropertyUrlSync />
      <Card>
        <CardHeader>
          <CardTitle>Audience</CardTitle>
          <CardDescription>
            Every past guest for this property, annotated. Nothing is capped — the count is your choice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {res.success && res.candidates ? (
            <AudiencePicker
              candidates={res.candidates}
              eligibleCount={res.eligibleCount ?? 0}
              perRunCap={res.perRunCap ?? 20}
              propertyId={property}
            />
          ) : (
            <p className="text-sm text-destructive">{res.error || 'Failed to load audience.'}</p>
          )}
        </CardContent>
      </Card>
    </AdminPage>
  );
}
