#!/usr/bin/env npx tsx
/**
 * warmup-pack — audience selector for the no-ask "share" campaigns (plan: keep-in-touch + cold re-intro).
 *
 * Unlike planner-pack (window/gap-driven, carries an offer), this is RELATIONSHIP-driven and carries
 * NO offer: intent = 'share'. It keeps the past-guest relationship warm so it doesn't go cold. Two
 * segments:
 *   --segment keepintouch : recently-stayed, still-warm guests we HAVEN'T reached in a while (or ever)
 *                           — the recurring ~6-8wk touch that stops warm guests sliding into the cold pile.
 *   --segment coldreintro : the long-lapsed (2y+) pile — a gentle "just saying hi", self-ID + when they
 *                           stayed + an easy opt-out. Occasional, small batches (cold = ban-riskier).
 *
 * Emits a CampaignBrief (intent 'share', offer {type:'none'}) → feeds copywriter-pack → copywriter.
 * The copywriter calibrates warmth from each guest's relationship state (first-contact/lapsed/silent).
 *
 * Usage:
 *   npx tsx scripts/warmup-pack.ts --segment keepintouch --property prahova-mountain-chalet --out /tmp/warm.json
 *   npx tsx scripts/warmup-pack.ts --segment coldreintro --property prahova-mountain-chalet --out /tmp/cold.json
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getAdminDb } from '../src/lib/firebaseAdminSafe';
import { isRomaniaBased } from '../src/lib/growth/audience';
import type { CampaignBrief } from '../src/lib/growth/contracts';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const SEGMENT = (arg('segment', 'keepintouch') as 'keepintouch' | 'coldreintro');
const PROPERTY = arg('property', 'prahova-mountain-chalet')!;
const OUT = arg('out');
const AS_OF = new Date(`${arg('as-of', new Date().toISOString().slice(0, 10))}T00:00:00Z`);
const RUN_CAP = Number(arg('cap', SEGMENT === 'coldreintro' ? '15' : '25'));

const toD = (v: any): Date | null => v?._seconds ? new Date(v._seconds * 1000) : v?.toDate ? v.toDate() : typeof v === 'string' ? new Date(v) : v instanceof Date ? v : null;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const days = (a: Date, b: Date) => Math.round((+b - +a) / 86400000);
const norm = (p: string) => (p || '').replace(/[^0-9]/g, '');
const seasonOf = (d: Date) => { const m = d.getUTCMonth() + 1; return m === 12 || m <= 2 ? 'iarna' : m <= 5 ? 'primavara' : m <= 8 ? 'vara' : 'toamna'; };
const complaintRe = /problem|scuze|imi pare rau|îmi pare rău|neplac|deranj|presiune|defect|stricat/i;

// Segment windows (days since last stay) + the "recently contacted" floor that excludes anyone we
// touched too recently to warm up again.
const WINDOWS = {
  keepintouch: { minSinceStay: 45, maxSinceStay: 400, recentOutboundFloor: 60 },
  coldreintro: { minSinceStay: 500, maxSinceStay: Infinity, recentOutboundFloor: 180 },
};

async function main() {
  const db = await getAdminDb();
  const [gSnap, bSnap, tSnap, sSnap] = await Promise.all([
    db.collection('guests').get(), db.collection('bookings').get(),
    db.collection('whatsappThreads').get(), db.collection('suppressionList').get(),
  ]);
  const bookingById = new Map(bSnap.docs.map(d => [d.id, { id: d.id, ...(d.data() as any) }]));
  const threads = new Map(tSnap.docs.map(d => [d.id, d.data() as any]));
  const suppressed = new Set(sSnap.docs.map(d => norm((d.data() as any).normalizedPhone || '').slice(-9)).filter(Boolean));
  const win = WINDOWS[SEGMENT];

  const guests = gSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter(g => (g.propertyIds || []).includes(PROPERTY));
  const picked: any[] = [];
  for (const g of guests) {
    if (!g.normalizedPhone || g.unsubscribed) continue;                                  // reachable + not opted out
    if (suppressed.has(norm(g.normalizedPhone).slice(-9))) continue;                       // do-not-contact
    const stayB = (g.bookingIds || []).map((id: string) => bookingById.get(id)).filter(Boolean)
      .filter((b: any) => b.status !== 'cancelled' && toD(b.checkInDate) && toD(b.checkInDate)! < AS_OF)
      .sort((a: any, b: any) => +toD(a.checkInDate)! - +toD(b.checkInDate)!);
    if (!isRomaniaBased({ normalizedPhone: g.normalizedPhone, phone: g.phone, country: g.country, stays: stayB.length })) continue;
    const activeFuture = (g.bookingIds || []).map((id: string) => bookingById.get(id)).filter(Boolean)
      .some((b: any) => { const e = toD(b.checkOutDate) ?? toD(b.checkInDate); return e && b.status !== 'cancelled' && +e >= +AS_OF; });
    if (activeFuture) continue;                                                            // don't warm-up someone already booked

    const last = stayB.length ? toD(stayB[stayB.length - 1].checkInDate) : null;
    if (!last) continue;
    const sinceStay = days(last, AS_OF);
    if (sinceStay < win.minSinceStay || sinceStay > win.maxSinceStay) continue;            // segment recency window

    const th = threads.get(g.id);
    const msgs = (th?.messages || []) as any[];
    const lastOut = msgs.filter(m => m.direction === 'out' && m.ts < ymd(AS_OF)).map(m => String(m.ts).slice(0, 10)).sort().pop();
    const daysSinceOut = lastOut ? days(new Date(`${lastOut}T00:00:00Z`), AS_OF) : null;
    if (daysSinceOut !== null && daysSinceOut < win.recentOutboundFloor) continue;         // touched too recently — leave them

    const careFlags = msgs.some(m => m.direction === 'in' && complaintRe.test(m.text || '')) ? ['complaint-in-thread'] : [];
    picked.push({
      guestId: g.id,
      firstName: g.firstName || null,
      sinceStay,
      hasThread: msgs.length > 0,
      angle: SEGMENT === 'coldreintro'
        ? `Stayed ${seasonOf(last)} ${last.getUTCFullYear()} (~${Math.round(sinceStay / 30)}mo ago), never really kept in touch — a gentle "just saying hi" + who I am + an easy opt-out.`
        : `Stayed ~${Math.round(sinceStay / 30)}mo ago, ${msgs.length ? 'quiet since' : 'never messaged on WhatsApp'} — a light keep-in-touch so the relationship stays warm.`,
      careFlags,
    });
  }
  // Warm end first (most recent stay = warmest / highest odds); cap for hand-sending.
  picked.sort((a, b) => a.sinceStay - b.sinceStay);
  const audience = picked.slice(0, RUN_CAP);

  const point = SEGMENT === 'coldreintro'
    ? 'A gentle re-introduction to guests who stayed a while ago and were never really kept in touch with — just a warm hello: who you are, when they stayed, no ask, and an easy way to opt out. Pure good mood.'
    : 'A no-ask keep-in-touch to recently-stayed guests you have not spoken to in a while — a light, warm hello that keeps the relationship alive for when they want to come back. No offer, no request.';
  const brief: CampaignBrief = {
    propertyId: PROPERTY,
    opportunity: { id: `warmup-${SEGMENT}-${ymd(AS_OF)}`, propertyId: PROPERTY, source: 'named_period', window: { start: ymd(AS_OF), end: ymd(AS_OF), nights: 0 }, daysOut: 0, instrument: 'whatsapp', rationale: `warm-up/${SEGMENT}` },
    act: audience.length > 0,
    intent: 'share',
    occasion: { name: null, point },
    offer: { type: 'none', description: '' },
    updates: [],
    audience: audience.map(a => ({ guestId: a.guestId, angle: a.angle, careFlags: a.careFlags })),
    generalAngle: 'A genuine, low-pressure hello — NO offer, NO booking ask. Keep it short and warm. Self-identify, and for anyone not spoken to in a long time, gently remind them who you are and roughly when they stayed. Always include an easy opt-out. The goal is only to keep the door open, not to sell.',
    rationale: `Warm-up campaign (${SEGMENT}): ${audience.length} of ${picked.length} eligible, capped at ${RUN_CAP}. Relationship-driven, no offer. Keeps warm guests from going cold / re-opens the door with long-lapsed ones.`,
  };

  const json = JSON.stringify(brief, null, 2);
  if (OUT) { fs.writeFileSync(OUT, json); console.error(`wrote ${OUT} · segment=${SEGMENT} · ${audience.length}/${picked.length} eligible (cap ${RUN_CAP})`); }
  else console.log(json);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
