import { AdminPage, EmptyState } from '@/components/admin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PropertyUrlSync } from '@/components/admin/PropertyUrlSync';
import { Megaphone } from 'lucide-react';
import { fetchCampaigns } from './actions';
import { CampaignTable } from './_components/campaign-table';
import { CampaignComposer } from './_components/campaign-composer';

export const dynamic = 'force-dynamic';

const DEFAULT_PROPERTY = 'prahova-mountain-chalet';

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const { propertyId } = await searchParams;
  const property = propertyId || DEFAULT_PROPERTY;
  const campaigns = await fetchCampaigns(property);

  return (
    <AdminPage
      title="Campaigns"
      description="Reactivate past guests over WhatsApp. Dark-launched — every run is a dry-run (records intent, sends nothing) until the engine is switched on."
    >
      <PropertyUrlSync />
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <Card>
          <CardHeader>
            <CardTitle>Your campaigns</CardTitle>
            <CardDescription>Create, preview the audience, approve, then run (dry-run).</CardDescription>
          </CardHeader>
          <CardContent>
            {campaigns.length > 0 ? (
              <CampaignTable campaigns={campaigns} />
            ) : (
              <EmptyState
                icon={Megaphone}
                title="No campaigns yet"
                description="Compose your first reactivation campaign on the right."
              />
            )}
          </CardContent>
        </Card>
        <CampaignComposer propertyId={property} />
      </div>
    </AdminPage>
  );
}
