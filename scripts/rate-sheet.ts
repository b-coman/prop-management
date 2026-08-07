/**
 * The rate sheet — what to type into each channel's dashboard.
 *
 *   npx tsx scripts/rate-sheet.ts [slug] [--write] [--from 2026-09-01] [--to 2027-01-31]
 *   npx tsx scripts/rate-sheet.ts [slug] --decompose      # what the current listings actually encode
 *   npx tsx scripts/rate-sheet.ts [slug] --applied <pushId|all-pending> --by "owner"
 *   npx tsx scripts/rate-sheet.ts [slug] --verify [--write]
 *
 * Dry-run unless --write. Writing stores an immutable versioned sheet and refreshes the push list;
 * it changes NOTHING on any OTA — a human still types.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { generateRateSheet, getPushes, markApplied, verifyPushesFromObservations } from '@/services/rateSheetService';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { getChannels } from '@/services/channelService';
import { grossUpFactor, impliedExtraAdjustmentPct } from '@/lib/growth/parityMath';
import { CHANNEL_LABELS, type ChannelId } from '@/lib/channels';

const SLUG = process.argv[2]?.startsWith('--') || !process.argv[2] ? 'prahova-mountain-chalet' : process.argv[2];
const WRITE = process.argv.includes('--write');
const DECOMPOSE = process.argv.includes('--decompose');
const VERIFY = process.argv.includes('--verify');
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined; };

const pct = (n: number, dp = 1) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(dp)}%`;

(async () => {
  /**
   * Mark cells as typed. This is the ONLY route to `applied`: the system has no write access to any
   * OTA, so it cannot observe the edit — it can only be told, and then check.
   */
  const appliedArg = arg('applied');
  if (appliedArg) {
    const by = arg('by') ?? 'owner';
    const pushes = await getPushes(SLUG);
    const targets = appliedArg === 'all-pending'
      ? pushes.filter((p) => p.status === 'pending')
      : pushes.filter((p) => p.id === appliedArg);
    if (!targets.length) { console.log('No matching pushes.'); return; }
    for (const t of targets) {
      await markApplied(t.id, by);
      console.log(`  applied: ${t.channelId} ${t.periodId} → ${t.target.nightly} ${t.target.currency}`);
    }
    console.log(`\n${targets.length} marked applied by "${by}". Run --verify after the next parity capture.`);
    return;
  }

  if (VERIFY) {
    const { outcomes, skipped } = await verifyPushesFromObservations(SLUG, { write: WRITE });
    console.log(`\n=== verify against parity captures — ${SLUG} ${WRITE ? '(WRITTEN)' : '(dry run)'} ===`);
    if (!outcomes.length) console.log('No status changes.');
    outcomes.forEach((o) => console.log(`  ${o.from} → ${o.to.toUpperCase()}  ${o.channelId} ${o.periodId}\n      ${o.note}`));
    if (skipped.length) {
      console.log(`\ncould not be checked (${skipped.length}):`);
      skipped.slice(0, 12).forEach((s) => console.log(`  ${s}`));
      if (skipped.length > 12) console.log(`  ... ${skipped.length - 12} more`);
    }
    if (!WRITE && outcomes.length) console.log('\nDry run. Re-run with --write to persist.');
    return;
  }

  if (DECOMPOSE) {
    /**
     * What the owner's five years of hand-maintained numbers actually encode.
     *
     * The sheet's constants (bk_factor 1.33, airbnb_correction 10%, VRBO = airbnb/4.5) each fold
     * commission, a discount being priced for, and margin into one number. This splits them.
     */
    const set = await getChannels(SLUG);
    const direct = set.byId.get('direct')?.directEconomics;
    if (!direct) throw new Error('No direct economics configured.');

    // THE ANCHOR MATTERS, and an earlier version of this got it wrong: it used the sheet's
    // `airbnb_w_price = 475` as if that were the direct price. It is not — it is the base the sheet
    // derives the AIRBNB column from. The direct base is `property.pricePerNight`. Measuring a
    // channel against the wrong anchor understates the gap and describes a relationship that does
    // not exist.
    const db = await getAdminDb();
    const prop = (await db.collection('properties').doc(SLUG).get()).data() as Record<string, any> | undefined;
    const directBase = prop?.pricePerNight;
    if (!directBase) throw new Error(`No pricePerNight on ${SLUG}.`);

    const SHEET_AIRBNB_BASE = 475;   // airbnb_w_price
    const SHEET_LISTED: Partial<Record<ChannelId, number>> = {
      airbnb: SHEET_AIRBNB_BASE * 1.10,          // × airbnb_correction
      'booking.com': SHEET_AIRBNB_BASE * 1.33,   // × bk_factor
    };

    console.log(`\n=== how each channel sits against DIRECT — ${SLUG} ===`);
    console.log(`Direct base (property.pricePerNight): ${directBase} RON/night, weekday base tier.`);
    console.log(`Channel prices from the sheet's constants (airbnb base ${SHEET_AIRBNB_BASE}).\n`);
    console.log('channel        commission   listed   vs direct   needed for equal net   difference');
    console.log('-'.repeat(84));
    for (const c of set.byId.values()) {
      if (c.channelId === 'direct' || !c.economics) continue;
      const structural = grossUpFactor(c.economics, direct);
      const listed = SHEET_LISTED[c.channelId];
      const needed = directBase * structural;
      const implied = listed ? impliedExtraAdjustmentPct(directBase, listed, c.economics, direct) : null;
      console.log(
        `${CHANNEL_LABELS[c.channelId].padEnd(14)} ${(c.economics.commissionPct * 100).toFixed(2).padStart(9)}%  ` +
        `${(listed ? listed.toFixed(0) : '—').padStart(7)}  ` +
        `${(listed ? `${(listed / directBase).toFixed(3)}×` : '—').padStart(10)}  ` +
        `${`${needed.toFixed(0)} (${structural.toFixed(3)}×)`.padStart(21)}  ` +
        `${(implied == null ? '— (not in sheet)' : pct(implied)).padStart(11)}`,
      );
    }
    console.log(
      '\n"Needed for equal net" is the price at which a booking on that channel pays you the SAME as a\n' +
      'direct booking, after its commission and your card costs. It is a REFERENCE LINE, not a target.\n' +
      '\n' +
      'A negative difference means the channel currently pays you less per night than direct does.\n' +
      'That can be perfectly deliberate — an OTA that brings guests you would not otherwise reach is\n' +
      'worth accepting less from. What this cannot tell you is whether the gap should close by moving\n' +
      'the channel price, moving the direct price, or not at all. That is a demand judgement, and it\n' +
      'is yours; this tool only measures where the lines currently are.',
    );
    return;
  }

  const { sheet, pushes, skippedChannels } = await generateRateSheet(SLUG, {
    computedAt: new Date().toISOString(),
    // Default to today: a sheet is a list of things to go and type, and nobody can type a price for
    // January that has already happened.
    from: arg('from') ?? new Date().toISOString().slice(0, 10),
    to: arg('to'), write: WRITE, updatedBy: 'scripts/rate-sheet.ts',
  });

  console.log(`\n=== rate sheet v${sheet.version} — ${SLUG} ${WRITE ? '(WRITTEN)' : '(dry run)'} ===`);
  console.log(`base ${sheet.basePrice} RON/night · ${sheet.rows.length} rows`);
  if (skippedChannels.length) console.log(`skipped (no commission stated): ${skippedChannels.join(', ')}`);
  sheet.warnings.forEach((w) => console.log(`  warning: ${w}`));

  const channels = [...new Set(sheet.rows.map((r) => r.channelId))];
  const periods = [...new Map(sheet.rows.map((r) => [r.periodId, r])).values()];

  console.log('\n' + 'period'.padEnd(24) + 'dates'.padEnd(26) + 'n  ' + channels.map((c) => c.slice(0, 11).padStart(11)).join(''));
  console.log('-'.repeat(24 + 26 + 3 + channels.length * 11));
  for (const p of periods) {
    const cells = channels.map((c) => {
      const row = sheet.rows.find((r) => r.periodId === p.periodId && r.channelId === c);
      if (!row) return '—'.padStart(11);
      if (row.problem) return 'no FX'.padStart(11);
      return `${row.nightly}${row.currency === 'RON' ? '' : ' ' + row.currency}`.padStart(11);
    });
    console.log(
      p.periodName.slice(0, 23).padEnd(24) +
      `${p.startDate}→${p.endDate}`.padEnd(26) +
      String(p.nights).padStart(2) + ' ' + cells.join(''),
    );
  }

  const problems = sheet.rows.filter((r) => r.problem);
  if (problems.length) {
    console.log('\n--- could not be computed (no price invented) ---');
    [...new Set(problems.map((p) => `${p.channelId}: ${p.problem}`))].forEach((m) => console.log(`  ${m}`));
  }

  const byStatus = pushes.reduce<Record<string, number>>((a, p) => ({ ...a, [p.status]: (a[p.status] ?? 0) + 1 }), {});
  console.log(`\n--- to type into the dashboards ---`);
  console.log(Object.entries(byStatus).map(([s, n]) => `${s}: ${n}`).join(' · ') || 'nothing');
  const pending = pushes.filter((p) => p.status === 'pending');
  if (pending.length) {
    console.log('\npending cells:');
    pending.slice(0, 25).forEach((p) => {
      const row = sheet.rows.find((r) => r.periodId === p.periodId && r.channelId === p.channelId)!;
      console.log(`  ${p.channelId.padEnd(12)} ${row.periodName.padEnd(22)} ${row.startDate}→${row.endDate}  →  ${p.target.nightly} ${p.target.currency}${p.target.minStay ? `, min ${p.target.minStay}n` : ''}`);
    });
    if (pending.length > 25) console.log(`  ... ${pending.length - 25} more`);
  }

  console.log(
    WRITE
      ? '\nStored. Nothing was sent to any OTA — the system has no write access; you type, then mark applied.'
      : '\nDry run. Re-run with --write to store this version and refresh the push list.',
  );
})().catch((e) => { console.error(e); process.exit(1); });
