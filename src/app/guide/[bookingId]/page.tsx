import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchGuide } from './_lib/fetch-guide';
import GuideView from './_components/guide-view';

// The personalised tier must never be indexed; the public tier is reachable at a
// stable URL of its own, so keeping the whole route out of search costs nothing.
export const metadata: Metadata = {
  title: 'Guest guide',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<{ t?: string }>;
}

export default async function GuidePage({ params, searchParams }: PageProps) {
  const { bookingId } = await params;
  const { t: token } = await searchParams;

  const data = await fetchGuide(bookingId, token);
  if (!data) notFound();

  return <GuideView data={data} />;
}
