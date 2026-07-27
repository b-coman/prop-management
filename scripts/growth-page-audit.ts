#!/usr/bin/env npx tsx
/**
 * growth-page-audit — print the read-only Facebook PAGE + ad-account ACQUISITION
 * health for a property (promotion-system-architecture.md §3.1 sensors). GET-only,
 * zero spend, no writes. The money-scoped ads token is pulled from Secret Manager
 * at runtime (never on argv), same pattern as scripts/growth-validate-ad-chain.ts.
 *
 * Usage: npx tsx scripts/growth-page-audit.ts [propertySlug]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

process.env.META_ADS_TOKENS = execSync(
  'gcloud secrets versions access latest --secret=META_ADS_TOKENS --project=rentalspot-fzwom',
  { encoding: 'utf8' }
).trim();

import { getPageHealth, getAdAccountHealth } from '@/services/growth/metaAds/brandHealth';

const P = process.argv[2] || 'prahova-mountain-chalet';
const ron = (minor: number) => `${(minor / 100).toFixed(2)} RON`;

(async () => {
  console.log(`=== Brand & acquisition audit — ${P} (read-only) ===\n`);

  const page = await getPageHealth(P);
  if (!page.ok) {
    console.log(`PAGE: ✖ ${page.error}`);
  } else {
    const d = page.data;
    console.log(`PAGE: ${d.name} (@${d.username}) — ${d.followers} followers · ${d.category}`);
    console.log(`  published: ${d.isPublished} · talking_about: ${d.talkingAboutCount} · dormant: ${d.dormant}`);
    console.log(`  website: ${d.websiteUrl ?? '—'}${d.websiteIsOtaLink ? '  ⚠️ OTA link — leaks direct margin' : ''}`);
    console.log(`  insights(28d, ${d.canReadInsights ? 'readable' : 'UNREADABLE'}): ${JSON.stringify(d.insights28d)}`);
    if (d.warnings.length) console.log(`  ⚠ ${d.warnings.join('\n  ⚠ ')}`);
  }

  const acct = await getAdAccountHealth(P);
  if (!acct.ok) {
    console.log(`\nAD ACCOUNT: ✖ ${acct.error}`);
  } else {
    const d = acct.data;
    console.log(`\nAD ACCOUNT: ${d.name} (${d.adAccountId}) — ${d.currency} · active: ${d.accountStatusActive}`);
    console.log(`  spend limit: ${d.hasSpendLimit ? ron(d.spendCapMinor) : 'NONE SET  🔴 (set one before live spend)'}`);
    console.log(`  lifetime spent: ${ron(d.amountSpentMinor)} · funding: ${d.funding ?? '—'}`);
    console.log(
      `  lifetime perf: spend ${d.lifetime.spend} · ${d.lifetime.impressions} impr · ${d.lifetime.clicks} clicks · CTR ${d.lifetime.ctr}% · CPC ${d.lifetime.cpc}`
    );
    console.log(`  campaigns: ${d.campaignCount} (${d.activeCampaignCount} active) · conversion history: ${d.hasConversionHistory}`);
    if (d.warnings.length) console.log(`  ⚠ ${d.warnings.join('\n  ⚠ ')}`);
  }

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
