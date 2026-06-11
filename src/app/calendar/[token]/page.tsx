import { notFound } from 'next/navigation';
import { resolvePropertyByToken, fetchPublicCalendarData } from './_lib/fetch-public-calendar';
import { PublicCalendar } from './_components/public-calendar';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicCalendarPage({ params }: PageProps) {
  const { token } = await params;
  const property = await resolvePropertyByToken(token);
  if (!property) notFound();

  const data = await fetchPublicCalendarData(property.propertyId, property.propertyName, 2, property.mode);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3">
          <h1 className="text-base font-semibold text-slate-900">{data.propertyName}</h1>
          <p className="text-xs text-muted-foreground">
            {property.mode === 'anonymized' ? 'Disponibilitate' : 'Calendar rezervări'}
          </p>
        </div>
      </header>
      <div className="max-w-md mx-auto px-3 py-4">
        <PublicCalendar months={data.months} mode={property.mode} />
        <p className="text-[10px] text-center text-muted-foreground mt-6 pb-4">
          Datele se actualizează automat. Reîncărcați pagina pentru cea mai recentă versiune.
        </p>
      </div>
    </main>
  );
}
