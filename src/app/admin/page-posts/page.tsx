import { AdminPage } from '@/components/admin';
import { PropertyUrlSync } from '@/components/admin/PropertyUrlSync';
import { fetchPagePostsAction, fetchMixAction } from './actions';
import { PagePostConsole } from './_components/page-post-console';

export const dynamic = 'force-dynamic';

const DEFAULT_PROPERTY = 'prahova-mountain-chalet';

export default async function PagePostsPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const { propertyId } = await searchParams;
  const property = propertyId || DEFAULT_PROPERTY;
  const [posts, mix] = await Promise.all([fetchPagePostsAction(property), fetchMixAction(property)]);

  return (
    <AdminPage
      title="Page posts"
      description="Draft warm organic Facebook posts to keep the page alive — the engine writes an album grounded in your real photos, never reusing ones from recent posts. Publish now or schedule it; Meta holds the queue."
    >
      <PropertyUrlSync />
      <PagePostConsole propertyId={property} initialPosts={posts} mix={mix} />
    </AdminPage>
  );
}
