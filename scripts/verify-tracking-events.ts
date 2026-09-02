#!/usr/bin/env npx tsx
/**
 * verify-tracking-events — the check that closes this project's one repeating tracking failure.
 *
 * A dataLayer push is not a GA4 event. It reaches GA4 only if THREE separate things agree, and two
 * of them live outside this repo:
 *
 *   1. the code emits the event                    (src/, this repo)
 *   2. a GTM trigger regex NAMES that event        (GTM container, an allowlist)
 *   3. each parameter is mapped on the tag AND registered as a GA4 custom dimension/metric
 *
 * Link 2 is an allowlist, and forgetting to widen it produces no build error, no failing test and no
 * console warning — the event simply goes nowhere, forever, and looks exactly like "nobody did that".
 * It cost `click_to_call` 90 days of data once. It then swallowed `talk_click`, `ota_click`,
 * `suggestion_click` and `entry_stay_click` for the week after they shipped, which is the whole
 * reason this script exists: those four are the "what did the visitor do INSTEAD of booking" events,
 * so their silence was invisible by construction.
 *
 * Deliberately NOT wired into `npm run build`. The App Hosting build environment has no service
 * account key, so a network check there would fail every production deploy — a far worse outcome
 * than the problem it solves. Run it after adding any tracking event, and before trusting a funnel
 * reading that shows a zero.
 *
 * What it CANNOT tell you: whether the emitting code is in the deployed bundle, and whether the
 * visitor consented. A green run means the plumbing is correct, not that events are arriving.
 *
 * Usage: npx tsx scripts/verify-tracking-events.ts   (exit 1 if anything is unwired)
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { GoogleAuth } from 'google-auth-library';

const ACCOUNT = '6338175297';
const CONTAINER = '242959554';
const GA4_PROPERTY = '488335480';

/**
 * GA4 understands these natively — `value` and `currency` populate the built-in eventValue metric,
 * so registering them as custom dimensions would be wrong, not merely redundant.
 */
const NATIVE_GA4_PARAMS = new Set(['value', 'currency']);

/** Every way the app names an event. `trackEvent(event, ...)` with a variable is the internal
 *  re-entry from the two helpers above it, so only quoted literals are collected. */
const EMIT_PATTERN =
  /(?:trackUiEvent|trackEcommerceEvent|trackEvent|emit)\(\s*'([a-z][a-z0-9_]*)'/g;

function eventsEmittedInCode(): string[] {
  const files = execSync(
    `grep -rl "trackUiEvent(\\|trackEcommerceEvent(\\|trackEvent(\\|emit(" src/ --include=*.ts --include=*.tsx || true`,
    { encoding: 'utf8', shell: '/bin/bash' }
  ).trim().split('\n').filter(Boolean);

  const found = new Set<string>();
  for (const f of files) {
    const src = execSync(`cat ${JSON.stringify(f)}`, { encoding: 'utf8' });
    for (const m of src.matchAll(EMIT_PATTERN)) found.add(m[1]);
  }
  return [...found].sort();
}

/** The params every UI event may carry, read from the single list that owns them. */
function uiParamsFromSource(): string[] {
  const src = execSync('cat src/lib/tracking.ts', { encoding: 'utf8' });
  const block = src.match(/const UI_PARAMS = \[([\s\S]*?)\] as const;/);
  if (!block) throw new Error('UI_PARAMS not found in src/lib/tracking.ts — did it move?');
  return [...block[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

(async () => {
  const auth = new GoogleAuth({
    keyFilename: path.resolve(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH!),
    scopes: [
      'https://www.googleapis.com/auth/tagmanager.edit.containers',
      'https://www.googleapis.com/auth/analytics.edit',
    ],
  });
  const client = await auth.getClient();
  const get = async (url: string) => (await client.request({ url })).data as any;

  const live = await get(
    `https://tagmanager.googleapis.com/tagmanager/v2/accounts/${ACCOUNT}/containers/${CONTAINER}/versions:live`
  );

  // Every event name any trigger regex will match, and which trigger fires for it.
  const triggers = (live.trigger || []).map((t: any) => ({
    id: t.triggerId,
    name: t.name,
    pattern: (t.customEventFilter || [])
      .flatMap((f: any) => f.parameter || [])
      .find((p: any) => p.key === 'arg1')?.value ?? '',
  })).filter((t: any) => t.pattern);

  const triggerFor = (event: string) =>
    triggers.find((t: any) => new RegExp(t.pattern).test(event));

  // Params mapped on each tag, keyed by the trigger that fires the tag.
  const mappedParams = new Set<string>();
  for (const tag of live.tag || []) {
    const table = (tag.parameter || []).find((p: any) => p.key === 'eventSettingsTable');
    for (const row of table?.list || []) {
      const k = row.map.find((m: any) => m.key === 'parameter')?.value;
      if (k) mappedParams.add(k);
    }
  }

  const ga4 = `https://analyticsadmin.googleapis.com/v1beta/properties/${GA4_PROPERTY}`;
  const dims = await get(`${ga4}/customDimensions?pageSize=100`);
  const mets = await get(`${ga4}/customMetrics?pageSize=100`);
  const registered = new Set<string>([
    ...(dims.customDimensions || []).map((d: any) => d.parameterName),
    ...(mets.customMetrics || []).map((m: any) => m.parameterName),
  ]);

  console.log(`GTM container live version ${live.containerVersionId} · GA4 property ${GA4_PROPERTY}\n`);

  let failures = 0;

  console.log('=== EVENTS: emitted in code -> matched by a GTM trigger ===');
  for (const e of eventsEmittedInCode()) {
    const t = triggerFor(e);
    if (t) {
      console.log(`  ok       ${e.padEnd(24)} trigger ${t.id} (${t.name})`);
    } else {
      console.log(`  MISSING  ${e.padEnd(24)} no trigger regex names it — this event reaches nothing`);
      failures++;
    }
  }

  console.log('\n=== PARAMS: UI_PARAMS -> mapped on a tag -> registered in GA4 ===');
  for (const p of uiParamsFromSource()) {
    const onTag = mappedParams.has(p);
    const inGa4 = registered.has(p) || NATIVE_GA4_PARAMS.has(p);
    if (onTag && inGa4) {
      console.log(`  ok       ${p.padEnd(24)}${NATIVE_GA4_PARAMS.has(p) ? 'GA4-native, no custom dimension by design' : ''}`);
    } else {
      const why = [!onTag && 'not mapped on any GTM tag', !inGa4 && 'no GA4 custom dimension/metric']
        .filter(Boolean).join(' + ');
      console.log(`  MISSING  ${p.padEnd(24)}${why}`);
      failures++;
    }
  }

  if (failures) {
    console.log(`\n${failures} unwired item(s). Publish a new GTM container version and/or register the`);
    console.log('GA4 custom dimension. Sync the workspace first — the default one has been behind live');
    console.log('before, and publishing from a stale workspace silently deletes params.');
    process.exit(1);
  }
  console.log('\nAll tracking events and parameters are wired end to end.');
})().catch((e) => {
  console.error('ERROR:', e?.response?.data ? JSON.stringify(e.response.data, null, 1) : e.message);
  process.exit(1);
});
