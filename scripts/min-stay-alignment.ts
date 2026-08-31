#!/usr/bin/env npx tsx
/**
 * min-stay-alignment — is the minimum stay the same on every channel?
 *
 * The owner's rule is 2 nights, raised by hand on a few special windows (autumn school break,
 * sometimes Christmas, always NYE) — separately on Airbnb, on Booking, and on the direct site. Three
 * manual edits per window is where drift lives, and a longer minimum on one channel is invisible in
 * every price comparison: it does not make anything look expensive, it just refuses the booking.
 *
 * This reads what each channel DID: a refusal naming a number is a stated requirement, and a stay it
 * actually sold is an upper bound. Nothing is inferred beyond that.
 *
 *   npx tsx scripts/min-stay-alignment.ts [slug]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { latestByCell } from '@/services/growth/parityObservations';
import { readMinStay, compareMinStay, type ChannelObservationLite } from '@/lib/parity/minStay';

const SLUG = process.argv[2] ?? 'prahova-mountain-chalet';

interface Period { name: string; start: string; end: string; directMin: number | null }

(async () => {
  const db = await getAdminDb();
  const today = new Date().toISOString().slice(0, 10);

  // Direct's own minimum, from the two places that set it. A dateOverride wins over its season.
  const periods: Period[] = [];
  for (const d of (await db.collection('seasonalPricing').get()).docs) {
    const s = d.data() as { propertyId?: string; name: string; startDate: string; endDate: string; minimumStay?: number };
    if (s.propertyId && s.propertyId !== SLUG) continue;
    if (s.endDate < today) continue;
    periods.push({ name: s.name, start: s.startDate, end: s.endDate, directMin: s.minimumStay ?? null });
  }
  const overrides = new Map<string, { min: number | null; reason: string }>();
  for (const d of (await db.collection('dateOverrides').get()).docs) {
    const o = d.data() as { propertyId?: string; date: string; minimumStay?: number; reason?: string };
    if (o.propertyId && o.propertyId !== SLUG) continue;
    if (o.date < today) continue;
    overrides.set(o.date, { min: o.minimumStay ?? null, reason: o.reason ?? 'override' });
  }
  // Overrides sharing a reason and touching each other are one window, the way the owner thinks of them.
  const ovDates = [...overrides.keys()].sort();
  for (let i = 0; i < ovDates.length; ) {
    const reason = overrides.get(ovDates[i])!.reason;
    let j = i;
    while (j + 1 < ovDates.length && overrides.get(ovDates[j + 1])!.reason === reason) j++;
    periods.push({ name: reason, start: ovDates[i], end: ovDates[j], directMin: overrides.get(ovDates[i])!.min });
    i = j + 1;
  }
  periods.sort((a, b) => a.start.localeCompare(b.start));

  const obs = [...(await latestByCell(SLUG)).values()].filter((o) => o.checkOut >= today);
  const channels = ['airbnb', 'booking.com'];

  console.log(`\nMINIMUM STAY BY CHANNEL — ${SLUG}`);
  console.log('what each platform DID, not what it claims. "refused <N" = it stated that requirement.\n');
  console.log('period                 dates                    direct   airbnb          booking.com');
  console.log('-'.repeat(92));

  const problems: string[] = [];
  for (const p of periods) {
    const inPeriod = obs.filter((o) => o.checkIn >= p.start && o.checkIn <= p.end);
    if (!inPeriod.length) continue;
    const cols: string[] = [];
    const readings: Record<string, ReturnType<typeof readMinStay>> = {};
    for (const ch of channels) {
      const lite: ChannelObservationLite[] = inPeriod.filter((o) => o.channel === ch)
        .map((o) => ({ channel: o.channel, status: o.status, nights: o.nights, reason: o.reason }));
      const reading = readMinStay(lite);
      readings[ch] = reading;
      const verdict = compareMinStay(p.directMin, reading);
      const shown = reading.required !== null ? `refused <${reading.required}`
        : reading.soldAt !== null ? `sold ${reading.soldAt}n+` : 'not probed';
      cols.push(`${shown}${verdict === 'channel-stricter' ? '  !!' : verdict === 'channel-looser' ? '  ~' : ''}`);
      if (verdict === 'channel-stricter') {
        const lo = p.directMin!, hi = reading.required! - 1;
        problems.push(`${p.name} (${p.start}→${p.end}): ${ch} requires ${reading.required} nights, ` +
                      `direct sells ${lo}. A guest wanting ${lo === hi ? `${lo} nights` : `${lo}-${hi} nights`} ` +
                      `is turned away on ${ch} but served by us.`);
      }
      if (verdict === 'channel-looser') {
        problems.push(`${p.name} (${p.start}→${p.end}): ${ch} sold ${reading.soldAt} nights, ` +
                      `direct requires ${p.directMin}. The platform undercuts our own rule.`);
      }
    }
    const ab = readings['airbnb'], bk = readings['booking.com'];
    const abMin = ab?.required ?? null, bkMin = bk?.required ?? null;
    const abSold = ab?.soldAt ?? null, bkSold = bk?.soldAt ?? null;
    // Either two stated requirements that differ, or one channel selling a stay the other refuses.
    let channelClash: string | null = null;
    if (abMin !== null && bkMin !== null && abMin !== bkMin) {
      channelClash = `airbnb requires ${abMin} nights but booking.com requires ${bkMin}`;
    } else if (abMin !== null && bkSold !== null && bkSold < abMin) {
      channelClash = `airbnb refuses under ${abMin} nights while booking.com sold ${bkSold}`;
    } else if (bkMin !== null && abSold !== null && abSold < bkMin) {
      channelClash = `booking.com refuses under ${bkMin} nights while airbnb sold ${abSold}`;
    }
    if (channelClash) problems.push(`${p.name} (${p.start}→${p.end}): ${channelClash} — the two platforms disagree with each other.`);

    console.log(`${p.name.slice(0, 21).padEnd(22)} ${p.start}→${p.end}   ${String(p.directMin ?? '-').padStart(4)}     ` +
                `${cols[0].padEnd(16)}${cols[1].padEnd(16)}${channelClash ? '  <-- channels disagree' : ''}`);
  }

  console.log('\n' + '-'.repeat(92));
  if (!problems.length) {
    console.log('Every probed period agrees, or was never probed short enough to reveal a difference.');
  } else {
    console.log(`${problems.length} MISALIGNMENT(S) — each is a booking you either cannot take or should not have offered:\n`);
    for (const x of problems) console.log(`  · ${x}`);
    console.log('\nFix on the channel, not on the direct site: the minimum is a rule you set, not a price.');
  }
})().catch((e) => { console.error(e); process.exit(1); });
