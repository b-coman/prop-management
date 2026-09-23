/**
 * warmupAudience — builds the CampaignBrief for a no-ask "share" warm-up campaign. Shared by the CLI
 * (scripts/warmup-pack.ts) and the in-app cron (src/services/growth/warmupCampaign.ts) so both select
 * the same way. Relationship-driven (no window, no offer); intent = 'share'.
 *
 *   keepintouch : recently-stayed, still-warm, not-recently-touched → the recurring light hello
 *   coldreintro : the long-lapsed (2y+) pile → a gentle "just saying hi" (self-ID + when-stayed + opt-out)
 *   leadfollowup: people who ASKED and never stayed → a no-ask note built on what they asked for, so
 *                 a lead doesn't go cold just because it has no stay to anchor a warm-up on
 *
 * Server-only (Admin SDK).
 */
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { isRomaniaBased } from '@/lib/growth/audience';
import { getNotesByGuest, isTouch } from '@/services/guestNoteService';
import type { CampaignBrief } from '@/lib/growth/contracts';

export type WarmupSegment = 'keepintouch' | 'coldreintro' | 'leadfollowup';

const toD = (v: any): Date | null => v?._seconds ? new Date(v._seconds * 1000) : v?.toDate ? v.toDate() : typeof v === 'string' ? new Date(v) : v instanceof Date ? v : null;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const days = (a: Date, b: Date) => Math.round((+b - +a) / 86400000);
const norm = (p: string) => (p || '').replace(/[^0-9]/g, '');
const seasonOf = (d: Date) => { const m = d.getUTCMonth() + 1; return m === 12 || m <= 2 ? 'iarna' : m <= 5 ? 'primavara' : m <= 8 ? 'vara' : 'toamna'; };
const complaintRe = /problem|scuze|imi pare rau|îmi pare rău|neplac|deranj|presiune|defect|stricat/i;

const WINDOWS: Record<WarmupSegment, { minSinceStay: number; maxSinceStay: number; recentOutboundFloor: number; defaultCap: number }> = {
  keepintouch: { minSinceStay: 45, maxSinceStay: 400, recentOutboundFloor: 60, defaultCap: 25 },
  coldreintro: { minSinceStay: 500, maxSinceStay: Infinity, recentOutboundFloor: 180, defaultCap: 15 },
  // For leads "since stay" is days since their FIRST contact: wait three weeks before following up,
  // and stop after 18 months, when the enquiry is too old to build a message on.
  leadfollowup: { minSinceStay: 21, maxSinceStay: 540, recentOutboundFloor: 45, defaultCap: 10 },
};

export interface WarmupResult { brief: CampaignBrief; eligibleCount: number; }

/**
 * One lead for the leadfollowup segment, or null. Skips 'unservable' (we structurally can't serve
 * what they need, so writing again is noise), anyone with a booking since (no longer a lead), and
 * anyone contacted recently on WhatsApp or by phone.
 */
function pickLead(g: any, th: any, notes: any[], bookingById: Map<string, any>, AS_OF: Date, win: { minSinceStay: number; maxSinceStay: number; recentOutboundFloor: number }) {
  if (g.nonConversionReason === 'unservable') return null;
  if (!g.firstContactAt) return null;
  const sinceFirst = days(new Date(`${g.firstContactAt}T00:00:00Z`), AS_OF);
  if (sinceFirst < win.minSinceStay || sinceFirst > win.maxSinceStay) return null;
  const booked = (g.bookingIds || []).map((id: string) => bookingById.get(id)).some((b: any) => b && b.status !== 'cancelled' && b.status !== 'payment_failed');
  if (booked) return null;
  const msgs = (th?.messages || []) as any[];
  const lastOut = msgs.filter(m => m.direction === 'out' && m.ts < ymd(AS_OF)).map(m => String(m.ts).slice(0, 10)).sort().pop();
  const lastCall = notes.filter(n => isTouch(n.kind) && n.occurredAt < ymd(AS_OF)).map(n => n.occurredAt).sort().pop();
  const lastContact = [lastOut, lastCall].filter(Boolean).sort().pop();
  if (lastContact && days(new Date(`${lastContact}T00:00:00Z`), AS_OF) < win.recentOutboundFloor) return null;
  const req = (g.requestedPeriods || []).slice(-1)[0];
  const asked = req ? `asked about ${req.start} to ${req.end}` : 'enquired';
  const why = g.nonConversionReason === 'unavailable' ? 'we could not host them then (nothing went wrong)'
    : g.nonConversionReason === 'declined' ? 'they chose not to book - keep it very light'
    : 'the conversation just stopped';
  const careFlags = msgs.some(m => m.direction === 'in' && complaintRe.test(m.text || '')) ? ['complaint-in-thread'] : [];
  return { guestId: g.id, sinceStay: sinceFirst, angle: `Lead: ${asked}; ${why}. A no-ask note so they do not go cold.`, careFlags };
}

/** Build a warm-up CampaignBrief for a segment. `asOf` defaults to now; `cap` defaults per segment. */
export async function buildWarmupBrief(segment: WarmupSegment, opts?: { propertyId?: string; asOf?: Date; cap?: number }): Promise<WarmupResult> {
  const propertyId = opts?.propertyId ?? 'prahova-mountain-chalet';
  const AS_OF = opts?.asOf ?? new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const win = WINDOWS[segment];
  const cap = opts?.cap ?? win.defaultCap;

  const db = await getAdminDb();
  const [gSnap, bSnap, tSnap, sSnap, notesByGuest] = await Promise.all([
    db.collection('guests').get(), db.collection('bookings').get(),
    db.collection('whatsappThreads').get(), db.collection('suppressionList').get(),
    getNotesByGuest(),
  ]);
  const bookingById = new Map(bSnap.docs.map(d => [d.id, { id: d.id, ...(d.data() as any) }]));
  const threads = new Map(tSnap.docs.map(d => [d.id, d.data() as any]));
  const suppressed = new Set(sSnap.docs.map(d => norm((d.data() as any).normalizedPhone || '').slice(-9)).filter(Boolean));

  const guests = gSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter(g => (g.propertyIds || []).includes(propertyId));
  const picked: any[] = [];
  for (const g of guests) {
    if (!g.normalizedPhone || g.unsubscribed) continue;
    // keepintouch/coldreintro are stay-anchored: every angle references when they stayed. A lead has
    // no stay, so leads get their own segment (leadfollowup) and only that one.
    if ((g.kind === 'lead') !== (segment === 'leadfollowup')) continue;
    if (suppressed.has(norm(g.normalizedPhone).slice(-9))) continue;
    if (segment === 'leadfollowup') {
      const lead = pickLead(g, threads.get(g.id), notesByGuest.get(g.id) || [], bookingById, AS_OF, win);
      if (lead) picked.push(lead);
      continue;
    }
    const stayB = (g.bookingIds || []).map((id: string) => bookingById.get(id)).filter(Boolean)
      .filter((b: any) => b.status !== 'cancelled' && toD(b.checkInDate) && toD(b.checkInDate)! < AS_OF)
      .sort((a: any, b: any) => +toD(a.checkInDate)! - +toD(b.checkInDate)!);
    if (!isRomaniaBased({ normalizedPhone: g.normalizedPhone, phone: g.phone, country: g.country, residency: g.residency, stays: stayB.length })) continue;
    const activeFuture = (g.bookingIds || []).map((id: string) => bookingById.get(id)).filter(Boolean)
      .some((b: any) => { const e = toD(b.checkOutDate) ?? toD(b.checkInDate); return e && b.status !== 'cancelled' && +e >= +AS_OF; });
    if (activeFuture) continue;

    const last = stayB.length ? toD(stayB[stayB.length - 1].checkInDate) : null;
    if (!last) continue;
    const sinceStay = days(last, AS_OF);
    if (sinceStay < win.minSinceStay || sinceStay > win.maxSinceStay) continue;

    const th = threads.get(g.id);
    const msgs = (th?.messages || []) as any[];
    const lastOut = msgs.filter(m => m.direction === 'out' && m.ts < ymd(AS_OF)).map(m => String(m.ts).slice(0, 10)).sort().pop();
    // A phone call is contact too. Pacing off WhatsApp alone would happily send a "we haven't
    // spoken in a while" hello the day after speaking on the phone.
    const lastCall = (notesByGuest.get(g.id) || []).filter(n => isTouch(n.kind) && n.occurredAt < ymd(AS_OF)).map(n => n.occurredAt).sort().pop();
    const lastContact = [lastOut, lastCall].filter(Boolean).sort().pop();
    const daysSinceOut = lastContact ? days(new Date(`${lastContact}T00:00:00Z`), AS_OF) : null;
    if (daysSinceOut !== null && daysSinceOut < win.recentOutboundFloor) continue;

    const careFlags = msgs.some(m => m.direction === 'in' && complaintRe.test(m.text || '')) ? ['complaint-in-thread'] : [];
    picked.push({
      guestId: g.id, sinceStay,
      angle: segment === 'coldreintro'
        ? `Stayed ${seasonOf(last)} ${last.getUTCFullYear()} (~${Math.round(sinceStay / 30)}mo ago), never really kept in touch — a gentle "just saying hi" + who I am + an easy opt-out.`
        : `Stayed ~${Math.round(sinceStay / 30)}mo ago, ${msgs.length ? 'quiet since' : 'never messaged on WhatsApp'} — a light keep-in-touch so the relationship stays warm.`,
      careFlags,
    });
  }
  picked.sort((a, b) => a.sinceStay - b.sinceStay);   // warmest (most recent stay) first
  const audience = picked.slice(0, cap);

  const point = segment === 'leadfollowup'
    ? 'A no-ask follow-up to people who asked about a stay and did not come - built only on what they asked for and what happened to it. No offer, no request, an easy opt-out.'
    : segment === 'coldreintro'
    ? 'A gentle re-introduction to guests who stayed a while ago and were never really kept in touch with — just a warm hello: who you are, when they stayed, no ask, and an easy way to opt out. Pure good mood.'
    : 'A no-ask keep-in-touch to recently-stayed guests you have not spoken to in a while — a light, warm hello that keeps the relationship alive for when they want to come back. No offer, no request.';

  const brief: CampaignBrief = {
    propertyId,
    opportunity: { id: `warmup-${segment}-${ymd(AS_OF)}`, propertyId, source: 'named_period', window: { start: ymd(AS_OF), end: ymd(AS_OF), nights: 0 }, daysOut: 0, instrument: 'whatsapp', rationale: `warm-up/${segment}` },
    act: audience.length > 0,
    intent: 'share',
    occasion: { name: null, point },
    offer: { type: 'none', description: '' },
    updates: [],
    audience: audience.map(a => ({ guestId: a.guestId, angle: a.angle, careFlags: a.careFlags })),
    generalAngle: segment === 'leadfollowup'
      ? 'A short, genuine note to someone who ASKED about a stay and never came. They never stayed: no "when you were here", no season, no review. Build only on their request and its outcome (see the lead block): if we could not host them, say the calendar has moved and you thought of them; if the conversation just stopped, a light re-open. NO offer, NO booking ask. Self-identify and include an easy opt-out.'
      : 'A genuine, low-pressure hello — NO offer, NO booking ask. Keep it short and warm. Self-identify, and for anyone not spoken to in a long time, gently remind them who you are and roughly when they stayed. Always include an easy opt-out. The goal is only to keep the door open, not to sell.',
    rationale: `Warm-up (${segment}): ${audience.length} of ${picked.length} eligible, cap ${cap}.`,
  };
  return { brief, eligibleCount: picked.length };
}
