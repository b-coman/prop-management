/**
 * The "Scrie-i pe WhatsApp" button under a cleaning question to the owner. Redirects to wa.me with
 * the cleaner's number and the message already written, so he only has to tap send.
 *
 * The id is random (cleaningWatchService writes `cleaningWa/{id}`), which keeps the cleaner's
 * number out of the WhatsApp template and out of guessable URLs.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdminSafe';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{16,64}$/.test(id)) return new NextResponse('Not found', { status: 404 });

  const db = await getAdminDb();
  const doc = await db.collection('cleaningWa').doc(id).get();
  if (!doc.exists) return new NextResponse('Not found', { status: 404 });

  const { phone, text } = doc.data() as { phone?: string | null; text?: string };
  // Without a number, wa.me opens WhatsApp's contact picker with the text ready.
  const digits = (phone || '').replace(/\D/g, '');
  return NextResponse.redirect(`https://wa.me/${digits}?text=${encodeURIComponent(text || '')}`, 302);
}
