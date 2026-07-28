import Link from 'next/link';
import { AdminPage } from '@/components/admin';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { PropertyUrlSync } from '@/components/admin/PropertyUrlSync';
import { GenerateForm } from '../_components/generate-form';

export const dynamic = 'force-dynamic';

const DEFAULT_PROPERTY = 'prahova-mountain-chalet';

export default async function GenerateAdPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const { propertyId } = await searchParams;
  const property = propertyId || DEFAULT_PROPERTY;

  return (
    <AdminPage
      title="Generate ad"
      description="Draft a PAUSED, zero-spend ad from an opportunity window — the engine plans, writes, and picks photos; you review and approve."
    >
      <PropertyUrlSync />
      <div className="mb-4">
        <Link href={`/admin/ads?propertyId=${property}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to ads
          </Button>
        </Link>
      </div>
      <GenerateForm propertyId={property} />
    </AdminPage>
  );
}
