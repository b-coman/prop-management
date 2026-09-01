/**
 * Why one nightly price cannot hold a whole period inside the parity band.
 *
 * For every measured stay we ask: what single nightly rate would put THIS stay at the middle of the
 * owner's band (5% under the cheapest platform)? Call it P*. If every stay inside a period wants a
 * similar P*, one price per period works and the machine is easy. Where P* disagrees inside a period,
 * no per-period price can satisfy them all, and the disagreement itself is the thing to fix.
 *
 * Read-only. Touches no price.
 */
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { getParityConfig, getStandingDiscounts, getSettingsChanges } from '@/services/channelService';
import { latestByCell } from '@/services/growth/parityObservations';
import { partiesFor, partyForGuests } from '@/lib/parity/party';
import { buildParityWindow } from '@/lib/parity/parityView';
import { getPeriods } from '@/services/periodService';
import { isFlatRate, stayTotal, lengthOfStayDiscountPct,
         type NightFact, type StayEconomics } from '@/lib/pricing/priceProjection';
import { config } from 'dotenv'; config({ path: '.env.local' });

export interface Stay {
  period: string; checkIn: string; checkOut: string; n: number; g: number;
  weekendNights: number; bestChannel: string; bestPrice: number;
  directNow: number; floor: number | null; losPct: number; nights: NightFact[];
}

export async function loadStays(pid = 'prahova-mountain-chalet') {
  const db = await getAdminDb();
  const prop = (await db.collection('properties').doc(pid).get()).data() as Record<string, any>;
  const econ: StayEconomics = {
    baseOccupancy: prop.baseOccupancy, extraGuestFee: prop.extraGuestFee ?? 0,
    cleaningFee: prop.cleaningFee ?? 0,
    lengthOfStayDiscounts: prop.pricingConfig?.lengthOfStayDiscounts ?? [],
  };
  const cfg = await getParityConfig(pid);
  const mix = partiesFor(prop.channelPricing);

  const nights = new Map<string, NightFact>();
  for (let m = 0; m < 14; m++) {
    const ym = new Date(Date.UTC(2026, 7 + m, 1)).toISOString().slice(0, 7);
    const c = await db.collection('priceCalendars').doc(`${pid}_${ym}`).get();
    if (!c.exists) continue;
    for (const [dn, x] of Object.entries<any>((c.data() as any).days ?? {})) {
      const d = `${ym}-${dn.padStart(2, '0')}`;
      nights.set(d, { date: d, price: x.adjustedPrice, pricesByGuests: x.prices,
        isWeekend: !!x.isWeekend, available: true, flatRate: isFlatRate(x.prices) });
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const obs = [...(await latestByCell(pid)).values()].filter((o) => o.checkOut >= today);
  const byW = new Map<string, any>();
  for (const o of obs) {
    const k = `${o.checkIn}|${o.checkOut}|${o.guests}`;
    if (!byW.has(k)) byW.set(k, { checkIn: o.checkIn, checkOut: o.checkOut, nights: o.nights,
      guests: o.guests, expectedParty: partyForGuests(mix.parties, o.guests), observations: [] });
    byW.get(k).observations.push({ channel: o.channel, status: o.status, guestTotal: o.guestTotal ?? null,
      listTotal: o.listTotal ?? null, promoActive: o.promoActive, ratePlan: (o as any).ratePlan,
      reason: o.reason, capturedAt: o.capturedAt, sessionState: o.sessionState, party: (o as any).party });
  }
  const inScope = ['direct', ...cfg.channels.map((c) => c.channel)].filter((c) => c !== 'vrbo');
  const economics = Object.fromEntries(cfg.channels.map((c) => [c.channel, c]));
  const standingDiscounts = await getStandingDiscounts(pid);
  const settingsChanges = await getSettingsChanges(SLUG);
  const wins = [...byW.values()].map((w) => buildParityWindow(w, { freshnessDays: 42, settingsChanges,
    targetDiscountPct: cfg.targetDiscountPct, direct: cfg.direct, economics, channelsInScope: inScope,
    standingDiscounts }));

  const periods = (await getPeriods(pid)).filter((p) => p.status === 'active');
  const stayNights = (ci: string, co: string) => {
    const out: NightFact[] = [];
    const d = new Date(ci + 'T00:00:00Z'), e = new Date(co + 'T00:00:00Z');
    while (d < e) { const n = nights.get(d.toISOString().slice(0, 10)); if (n) out.push(n); d.setUTCDate(d.getUTCDate() + 1); }
    return out;
  };

  const stays: Stay[] = [];
  for (const w of wins) {
    if (!w.best || w.direct == null) continue;
    const ns = stayNights(w.checkIn, w.checkOut);
    if (ns.length !== w.nights) continue;
    const last = ns[ns.length - 1].date;
    const p = periods.find((pp) => w.checkIn >= pp.startDate && last <= pp.endDate);
    stays.push({
      period: p?.name ?? '(no period / straddles)',
      checkIn: w.checkIn, checkOut: w.checkOut, n: w.nights, g: w.guests,
      weekendNights: ns.filter((x) => x.isWeekend).length,
      bestChannel: w.best.channel, bestPrice: w.best.effective,
      directNow: w.direct, floor: w.floor ?? null,
      losPct: lengthOfStayDiscountPct(w.nights, econ.lengthOfStayDiscounts),
      nights: ns,
    });
  }
  return { stays, econ, prop, cfg, periods };
}

/** The flat nightly rate that puts one stay at exactly `gap` against its cheapest platform. */
export function priceForGap(s: Stay, gap: number, econ: StayEconomics, flatRate = false): number {
  const want = s.bestPrice * (1 + gap);
  const extra = flatRate ? 0 : Math.max(0, s.g - econ.baseOccupancy) * econ.extraGuestFee;
  const d = lengthOfStayDiscountPct(s.n, econ.lengthOfStayDiscounts);
  // (n*(P + extra) + cleaning) * (1-d) = want
  return ((want / (1 - d)) - econ.cleaningFee) / s.n - extra;
}

if (require.main === module) {
  (async () => {
    const { stays, econ } = await loadStays();
    console.log(`baseOccupancy ${econ.baseOccupancy} · extraGuestFee ${econ.extraGuestFee} · cleaningFee ${econ.cleaningFee}`);
    console.log('LoS ladder:', econ.lengthOfStayDiscounts.filter(d=>d.enabled!==false).map(d=>`${d.nightsThreshold}n:-${d.discountPercentage}%`).join(' '));
    console.log(`\n${stays.length} measured stays with a usable platform price\n`);

    const byPeriod = new Map<string, Stay[]>();
    for (const s of stays) { if (!byPeriod.has(s.period)) byPeriod.set(s.period, []); byPeriod.get(s.period)!.push(s); }

    console.log('P* = the flat nightly rate that would put that ONE stay 5% under its cheapest platform.');
    console.log('A period can be solved by a single price only if its P* values agree.\n');
    for (const [name, ss] of [...byPeriod.entries()].sort()) {
      const withP = ss.map((s) => ({ s, P: priceForGap(s, -0.05, econ) })).sort((a, b) => a.P - b.P);
      const lo = withP[0].P, hi = withP[withP.length - 1].P;
      const spread = hi - lo;
      console.log(`${name}  (${ss.length} stays)   P* from ${lo.toFixed(0)} to ${hi.toFixed(0)}   spread ${spread.toFixed(0)} lei/night  ${spread > 60 ? '<-- cannot be solved by one price' : ''}`);
      for (const { s, P } of withP) {
        console.log(`    ${s.checkIn}→${s.checkOut} ${s.n}n ${s.g}p  we${s.weekendNights}  LoS -${(s.losPct*100).toFixed(0)}%  ${s.bestChannel} ${Math.round(s.bestPrice)}  now ${Math.round(s.directNow)}  P* ${P.toFixed(0)}`);
      }
      console.log('');
    }
    process.exit(0);
  })();
}
