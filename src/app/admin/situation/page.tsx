import { AdminPage } from '@/components/admin';
import { PropertyUrlSync } from '@/components/admin/PropertyUrlSync';
import { fetchLatestSituationAction } from './actions';
import { SituationConsole } from './_components/situation-console';

export const dynamic = 'force-dynamic';

const DEFAULT_PROPERTY = 'prahova-mountain-chalet';

export default async function SituationPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const { propertyId } = await searchParams;
  const property = propertyId || DEFAULT_PROPERTY;
  const latest = await fetchLatestSituationAction(property);

  return (
    <AdminPage
      title="Situation"
      description="The analyst's read of this property — what's going on, what's at risk, and what it would do, across all channels. Read-only for now: review its judgement and calibrate. Nothing here sends or spends."
    >
      <PropertyUrlSync />
      <SituationConsole propertyId={property} initial={latest} />
    </AdminPage>
  );
}
