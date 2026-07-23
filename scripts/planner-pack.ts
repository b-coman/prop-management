#!/usr/bin/env npx tsx
/**
 * planner-pack — the deterministic FACT PACK the WhatsApp planner reasons over.
 *
 * Given ONE opportunity (a dated gap the analyst routed to WhatsApp), it computes the eligible
 * Romanian audience with a per-guest dossier, the offer constraint, and the calendar occasion —
 * facts + method + constraints, NO conclusions (plan §2 principle 5). The planner SKILL then
 * selects a subset + angle + offer; a validator checks guestId ∈ eligible before anything queues;
 * the executionGateway re-runs every gate at send time (the real backstop).
 *
 * Deliberately NOT pre-computed: any composite "fit"/"selection" score. Ranking the audience is
 * the reasoning we want the planner to do, not a function we hand it. The pack gives raw inputs
 * (recency, season match, kids, LOS shape, review themes); the planner weighs them.
 *
 * Usage:
 *   npx tsx scripts/planner-pack.ts --start 2026-10-24 --end 2026-11-01 --out /tmp/plan.json
 *   npx tsx scripts/planner-pack.ts --start 2026-08-21 --end 2026-08-31 --property prahova-mountain-chalet
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getAdminDb } from '../src/lib/firebaseAdminSafe';
import { isRomaniaBased } from '../src/lib/growth/audience';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const PROPERTY = arg('property', 'prahova-mountain-chalet')!;
const START = arg('start'); const END = arg('end');
const AS_OF = new Date(`${arg('as-of', new Date().toISOString().slice(0, 10))}T00:00:00Z`);
const OUT = arg('out');
const RUN_CAP = Number(arg('cap', '20'));
const FREQ_CAP_DAYS = 14;                                  // matches GROWTH_ENGINE_LIMITS.frequencyCapDays
const PACING_FLOOR: Record<string, number> = { repeat: 14, engaged: 14, responsive: 30, unknown: 45, silent: 90 };

if (!START || !END) { console.error('required: --start <YYYY-MM-DD> --end <YYYY-MM-DD>'); process.exit(1); }

const toD = (v: any): Date | null => v?._seconds ? new Date(v._seconds * 1000) : v?.toDate ? v.toDate() : typeof v === 'string' ? new Date(v) : v instanceof Date ? v : null;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const days = (a: Date, b: Date) => Math.round((+b - +a) / 86400000);
const round = (n: number, d = 0) => Number(n.toFixed(d));
const seasonOf = (d: Date) => { const m = d.getUTCMonth() + 1; return m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn'; };
const norm = (p: string) => (p || '').replace(/[^0-9]/g, '');

// Romanian "when they last stayed" phrase — coarse, for the copywriter to refine.
function lastStayPhrase(last: Date | null): string | null {
  if (!last) return null;
  const m = last.getUTCMonth() + 1, y = last.getUTCFullYear(), nowY = AS_OF.getUTCFullYear();
  const season = ({ winter: 'iarna', spring: 'primăvara', summer: 'vara', autumn: 'toamna' } as any)[seasonOf(last)];
  if (m === 12 && (last.getUTCDate() >= 27)) return 'de Revelion';
  const rel = y === nowY ? `${season} aceasta` : y === nowY - 1 ? `${season} trecută` : `în ${season} lui ${y}`;
  return rel;
}

async function main() {
  const db = await getAdminDb();
  const [bSnap, gSnap, rSnap, tSnap, sSnap, hSnap] = await Promise.all([
    db.collection('bookings').get(),
    db.collection('guests').get(),
    db.collection('reviews').get(),
    db.collection('whatsappThreads').get(),
    db.collection('suppressionList').get(),
    db.collection('holidays').get(),
  ]);

  const price = (b: any) => b.pricing?.total ?? b.pricing?.totalPrice ?? 0;
  const bookingById = new Map(bSnap.docs.map(d => [d.id, { id: d.id, ...(d.data() as any) }]));
  const threads = new Map(tSnap.docs.map(d => [d.id, d.data() as any]));
  const reviewsBy = new Map<string, any[]>();
  rSnap.docs.forEach(d => { const r: any = { id: d.id, ...d.data() }; if (!r.guestId) return; (reviewsBy.get(r.guestId) || reviewsBy.set(r.guestId, []).get(r.guestId)!).push(r); });
  const suppressed = new Set(sSnap.docs.map(d => norm((d.data() as any).normalizedPhone || '').slice(-9)).filter(Boolean));

  // ---------- opportunity ----------
  const start = new Date(`${START}T00:00:00Z`), end = new Date(`${END}T00:00:00Z`);
  const nights = days(start, end);
  const targetSeason = seasonOf(start);
  // occasion: a holiday/school-break overlapping the window
  const occ = hSnap.docs.map(d => d.data() as any)
    .filter(h => h.startDate <= END && h.endDate >= START)
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))[0];

  // ---------- offer constraint (net-to-owner ADR; the inequality from plan §0.5) ----------
  // net ADR by channel from the last ~18 months of stays (amounts are net-to-owner, plan §7.11).
  const recentNights: { src: string; rate: number }[] = [];
  bookingById.forEach((b: any) => {
    const ci = toD(b.checkInDate), co = toD(b.checkOutDate);
    if (b.propertyId !== PROPERTY || b.status === 'cancelled' || !ci || !co) return;
    if (days(ci, AS_OF) > 550 || ci > AS_OF) return;
    const los = Math.max(1, days(ci, co)); const per = price(b) / los;
    for (let d = new Date(ci); d < co; d = new Date(+d + 86400000)) recentNights.push({ src: b.source || '?', rate: per });
  });
  const netAdr = (src: string) => { const a = recentNights.filter(n => n.src === src); return a.length ? round(a.reduce((s, n) => s + n.rate, 0) / a.length) : null; };
  const directNet = netAdr('direct'), airbnbNet = netAdr('airbnb'), bookingNet = netAdr('booking.com');
  const otaNetToBeat = Math.max(airbnbNet ?? 0, bookingNet ?? 0) || null;
  const maxDiscountPct = directNet && otaNetToBeat ? Math.max(0, Math.floor((1 - otaNetToBeat / directNet) * 100)) : null;

  // ---------- per-guest dossiers + eligibility (Romanian reachable) ----------
  const guests = gSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter(g => (g.propertyIds || []).includes(PROPERTY));
  const dossiers: any[] = [];
  for (const g of guests) {
    const reachable = !!g.normalizedPhone && !g.unsubscribed;
    if (!reachable) continue;

    const stayB = (g.bookingIds || []).map((id: string) => bookingById.get(id)).filter(Boolean)
      .filter((b: any) => b.status !== 'cancelled' && toD(b.checkInDate) && toD(b.checkInDate)! < AS_OF)
      .sort((a: any, b: any) => +toD(a.checkInDate)! - +toD(b.checkInDate)!);
    // operating constraint: reactivation = guests BASED IN ROMANIA (RO phone / country), or a
    // proven repeat returner — NOT "ethnically Romanian". Foreign expats living here qualify;
    // one-off foreign tourists (foreign phone, single stay) do not. See src/lib/growth/audience.ts.
    if (!isRomaniaBased({ normalizedPhone: g.normalizedPhone, phone: g.phone, country: g.country, stays: stayB.length })) continue;
    const stays = stayB.map((b: any) => toD(b.checkInDate)!);
    const last = stays.length ? stays[stays.length - 1] : null;
    const lastBk: any = stayB.length ? stayB[stayB.length - 1] : null;

    const th = threads.get(g.id);
    const msgs = (th?.messages || []) as any[];
    const inbound = msgs.filter(m => m.direction === 'in' && m.ts < ymd(AS_OF)).length;
    const outbound = msgs.filter(m => m.direction === 'out' && m.ts < ymd(AS_OF)).length;
    const lastOut = msgs.filter(m => m.direction === 'out' && m.ts < ymd(AS_OF)).map(m => String(m.ts).slice(0, 10)).sort().pop();
    const daysSinceOut = lastOut ? days(new Date(`${lastOut}T00:00:00Z`), AS_OF) : null;

    const totalBookings = g.totalBookings ?? stays.length;
    const tier = totalBookings >= 2 ? 'repeat' : inbound >= 3 ? 'engaged' : inbound >= 1 ? 'responsive' : outbound >= 1 ? 'silent' : 'unknown';

    // coarse complaint signal (the copywriter does the real sentiment read over the full thread)
    const complaintRe = /problem|nu merge|stricat|defect|rece|frig|murdar|nu funct|nu mai merge|scurgere|presiune/i;
    const complaintSignals = msgs.filter(m => m.direction === 'in' && complaintRe.test(m.text || '')).length;

    // review themes (raw — the planner matches to the occasion; not pre-scored).
    // review.tags is {category: [attribute strings]} — flatten the attributes to a clean list.
    const rv = reviewsBy.get(g.id) || [];
    const reviewText = rv.map(r => r.comment || '').filter(Boolean).join(' ').slice(0, 400);
    const reviewTags = [...new Set(rv.flatMap(r => {
      const t = r.tags;
      if (Array.isArray(t)) return t;
      if (t && typeof t === 'object') return Object.values(t).flat();
      return [];
    }))].filter(x => typeof x === 'string');

    // eligibility gates (mirror executionGateway; the gateway re-checks at send)
    const reasons: string[] = [];
    if (suppressed.has(norm(g.normalizedPhone || '').slice(-9))) reasons.push('suppressed');
    if (g.unsubscribed) reasons.push('unsubscribed');
    const activeFuture = stayB.some((b: any) => { const e = toD(b.checkOutDate) ?? toD(b.checkInDate); return e && +e >= Date.UTC(AS_OF.getUTCFullYear(), AS_OF.getUTCMonth(), AS_OF.getUTCDate()); });
    if (activeFuture) reasons.push('active-future-booking');
    const lastCampaignAt = toD(g.lastCampaignAt);
    if (lastCampaignAt && days(lastCampaignAt, AS_OF) < FREQ_CAP_DAYS) reasons.push('frequency-cap');
    if (daysSinceOut !== null && daysSinceOut < PACING_FLOOR[tier]) reasons.push(`pacing-floor-${tier}(${PACING_FLOOR[tier]}d)`);

    dossiers.push({
      guestId: g.id,
      firstName: g.firstName || null,
      eligible: reasons.length === 0,
      ineligibleReasons: reasons,
      tier,
      totalBookings,
      lastStay: last ? ymd(last) : null,
      daysSinceLastStay: last ? days(last, AS_OF) : null,
      lastStaySeason: last ? seasonOf(last) : null,       // raw — match against returnSeasonTransitions, NOT "same season"
      lastStayPhrase: lastStayPhrase(last),
      lastPartySize: lastBk?.numberOfGuests ?? null,
      lastHadChildren: lastBk ? (lastBk.numberOfChildren ?? 0) > 0 : null,
      typicalNights: stays.length ? round(stayB.reduce((s: number, b: any) => s + Math.max(1, days(toD(b.checkInDate)!, toD(b.checkOutDate)!)), 0) / stays.length, 1) : null,
      hasReviewText: reviewText.length > 40,
      reviewThemes: reviewTags,
      reviewText: reviewText || null,
      complaintSignals,
      inboundMessages: inbound,
      daysSinceLastOutbound: daysSinceOut,
    });
  }

  const eligible = dossiers.filter(d => d.eligible);

  // live return-season-transition matrix over Romania-based repeat guests (the fit signal: a guest
  // whose last-stay season → target season is a common transition is a good fit, NOT "same season").
  const transitions = new Map<string, number>();
  guests.forEach(g => {
    const st = (g.bookingIds || []).map((id: string) => bookingById.get(id)).filter(Boolean)
      .filter((b: any) => b.status !== 'cancelled' && toD(b.checkInDate) && toD(b.checkInDate)! < AS_OF)
      .map((b: any) => toD(b.checkInDate)!).sort((a: Date, b: Date) => +a - +b);
    if (!isRomaniaBased({ normalizedPhone: g.normalizedPhone, phone: g.phone, country: g.country, stays: st.length })) return;
    for (let i = 1; i < st.length; i++) transitions.set(`${seasonOf(st[i - 1])}->${seasonOf(st[i])}`, (transitions.get(`${seasonOf(st[i - 1])}->${seasonOf(st[i])}`) || 0) + 1);
  });
  const transitionsToTarget = Object.fromEntries([...transitions.entries()].filter(([k]) => k.endsWith(`->${targetSeason}`)).sort((a, b) => b[1] - a[1]));

  const pack = {
    meta: { generatedFor: PROPERTY, asOf: ymd(AS_OF), generator: 'scripts/planner-pack.ts' },
    opportunity: {
      window: { start: START, end: END, nights },
      daysOut: days(AS_OF, start),
      targetSeason,
      occasion: occ ? { name: occ.name, type: occ.type, startDate: occ.startDate, endDate: occ.endDate, source: occ.source ?? null } : null,
      occasionNote: occ ? 'a real holiday/school-break overlaps this window — a true reason to borrow' : 'NO calendar occasion overlaps this window — the message must supply its own reason, the weakest case',
    },
    offer: {
      note: 'Amounts are net-to-owner (plan §7.11). The inequality: directNet × (1 − discount) must stay above otaNetToBeat, or a discount gives away the direct-channel advantage. The planner picks a discount ≤ maxDiscountPct, or none (a first-refusal/no-discount angle is often stronger — plan §7.0).',
      directNetAdr: directNet, airbnbNetAdr: airbnbNet, bookingNetAdr: bookingNet,
      otaNetToBeat, maxDiscountPct,
    },
    constraints: {
      runCap: RUN_CAP,
      note: `Select AT MOST ${RUN_CAP} guests. Reactivation is Romanian-only (already applied). Quiet hours 21:00→09:00 Bucharest are enforced at send. Every selected guestId must be in the eligible set below (a validator rejects the whole plan otherwise).`,
      pacingFloorsDays: PACING_FLOOR,
      frequencyCapDays: FREQ_CAP_DAYS,
    },
    method: {
      note: 'Choose WHO (a subset of eligible), the occasion/angle, and the offer. This pack gives raw dossier inputs, NOT a ranking — the selection is your reasoning. Weigh: is the guest DUE (days-since-stay against the return clock)? Does the window FIT them (see below), and does the OCCASION suit them (a school break is a kids window; a quiet weekend suits adults-only)? Prefer people the window actually suits over the merely warm. Do not exceed the run cap. Give a per-guest reason and say what you rejected.',
      returnClock: { medianDays: 147, p25: 76, p75: 278, note: 'days-since-last-stay near/after this range = due' },
      fitInputs: 'Per dossier: lastStaySeason (match via returnSeasonTransitionsToThisTarget below, NOT "same season"), lastHadChildren (vs whether this is a family window), typicalNights (vs the gap\'s nights), reviewThemes (vs the occasion — e.g. "Peaceful"/"Private" suit a quiet escape).',
      returnSeasonTransitionsToThisTarget: transitionsToTarget,
      returnSeasonTransitionsNote: `how often a guest whose last stay was in season X returned in ${targetSeason} (X->${targetSeason}). A guest whose lastStaySeason is a strong source here fits this window even though it is a different season.`,
    },
    audience: {
      romaniaBasedReachable: dossiers.length,
      eligibleCount: eligible.length,
      ineligibleCount: dossiers.length - eligible.length,
      eligible,
      ineligible: dossiers.filter(d => !d.eligible).map(d => ({ guestId: d.guestId, tier: d.tier, reasons: d.ineligibleReasons })),
    },
  };

  const json = JSON.stringify(pack, null, 2);
  if (OUT) { fs.writeFileSync(OUT, json); console.error(`wrote ${OUT} (${Math.round(json.length / 1024)} KB) · ${eligible.length} eligible of ${dossiers.length} RO`); }
  else console.log(json);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
