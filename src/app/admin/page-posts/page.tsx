import { AdminPage } from '@/components/admin';
import { PropertyUrlSync } from '@/components/admin/PropertyUrlSync';
import { fetchPagePostsAction } from './actions';
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
  const posts = await fetchPagePostsAction(property);

  return (
    <AdminPage
      title="Page posts"
      description="Draft warm organic Facebook posts to keep the page alive — the engine writes one grounded in a real photo; you post it from your own account, one tap. (Auto-publish needs a page-scope grant.)"
    >
      <PropertyUrlSync />
      <PagePostConsole propertyId={property} initialPosts={posts} />
    </AdminPage>
  );
}
