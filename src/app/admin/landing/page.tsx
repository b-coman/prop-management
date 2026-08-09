import { AdminPage } from '@/components/admin';
import { PropertyUrlSync } from '@/components/admin/PropertyUrlSync';
import { fetchLandingsAction, fetchCampaignOptionsAction } from './actions';
import { LandingList } from './_components/landing-list';

export const dynamic = 'force-dynamic';

const DEFAULT_PROPERTY = 'prahova-mountain-chalet';

export default async function LandingIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const { propertyId } = await searchParams;
  const property = propertyId || DEFAULT_PROPERTY;
  const [landings, campaigns] = await Promise.all([
    fetchLandingsAction(property),
    fetchCampaignOptionsAction(property),
  ]);

  return (
    <AdminPage
      title="Landing pages"
      description="Campaign landing pages (/lp). Generate one from an ad campaign — it echoes the ad and proposes real, calendar-valid stays — then edit the copy, images and stays before publishing. Nothing here spends."
    >
      <PropertyUrlSync />
      <LandingList propertyId={property} landings={landings} campaigns={campaigns} />
    </AdminPage>
  );
}
