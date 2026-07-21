import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { resolvePropertyByToken, fetchPublicCalendarData } from './_lib/fetch-public-calendar';
import { PublicCalendar } from './_components/public-calendar';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

/**
 * Property-specific link preview (og:*) for the share URL — this is what shows in
 * a WhatsApp/Signal/etc. card when the owner sends the calendar link to a guest.
 * Without it the page inherits the generic site metadata ("RentalSpot — Your
 * Vacation Getaway"), which reads impersonal for a one-to-one message. `noindex`
 * keeps the token URL out of search engines (it's a private share link; it does
 * NOT affect link-preview crawlers, which ignore robots directives).
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const property = await resolvePropertyByToken(token);
  if (!property) return { robots: { index: false, follow: false } };

  const title = property.propertyName;
  const description =
    property.mode === 'anonymized'
      ? 'Vezi ce date sunt libere și rezervă-ți sejurul.'
      : 'Calendar rezervări';
  const images = property.imageUrl ? [property.imageUrl] : undefined;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'website', images, siteName: title },
    twitter: { card: 'summary_large_image', title, description, images },
  };
}

export default async function PublicCalendarPage({ params }: PageProps) {
  const { token } = await params;
  const property = await resolvePropertyByToken(token);
  if (!property) notFound();

  const data = await fetchPublicCalendarData(property.propertyId, property.propertyName, 2, property.mode);

  // The anonymized guest view lays months out horizontally, so it needs room to
  // breathe; the full (housekeeping) view stays a single mobile-width column.
  const container = property.mode === 'anonymized' ? 'max-w-5xl' : 'max-w-md';

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className={`${container} mx-auto px-4 py-3`}>
          <h1 className="text-base font-semibold text-slate-900">{data.propertyName}</h1>
          <p className="text-xs text-muted-foreground">
            {property.mode === 'anonymized' ? 'Disponibilitate' : 'Calendar rezervări'}
          </p>
        </div>
      </header>
      <div className={`${container} mx-auto px-3 py-4`}>
        <PublicCalendar months={data.months} mode={property.mode} />
        <p className="text-[10px] text-center text-muted-foreground mt-6 pb-4">
          Datele se actualizează automat. Reîncărcați pagina pentru cea mai recentă versiune.
        </p>
      </div>
    </main>
  );
}
