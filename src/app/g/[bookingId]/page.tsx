import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchGuide } from '../../guide/[bookingId]/_lib/fetch-guide';
import GuideView from '../../guide/[bookingId]/_components/guide-view';

// Short form of /guide/[bookingId]. New links use this; /guide still works so
// that anything already sent to a guest keeps resolving.
export const metadata: Metadata = {
  title: 'Guest guide',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<{ t?: string }>;
}

export default async function ShortGuidePage({ params, searchParams }: PageProps) {
  const { bookingId } = await params;
  const { t: token } = await searchParams;

  const data = await fetchGuide(bookingId, token);
  if (!data) notFound();

  return <GuideView data={data} />;
}
