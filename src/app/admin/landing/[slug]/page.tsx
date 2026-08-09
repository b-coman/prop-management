import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AdminPage } from '@/components/admin';
import { ArrowLeft } from 'lucide-react';
import { fetchLandingAction } from '../actions';
import { LandingEditor } from '../_components/landing-editor';

export const dynamic = 'force-dynamic';

export default async function LandingEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await fetchLandingAction(slug);
  if (!data) notFound();

  return (
    <AdminPage
      title={`Edit landing · ${slug}`}
      description="Edit copy, images and the proposed stays, then publish. Changes are saved to the /lp page; publishing makes it live."
      actions={<Button asChild variant="outline" size="sm"><Link href="/admin/landing"><ArrowLeft className="mr-2 h-4 w-4" />All landings</Link></Button>}
    >
      <LandingEditor initialConfig={data.config} propertyImages={data.propertyImages} />
    </AdminPage>
  );
}
