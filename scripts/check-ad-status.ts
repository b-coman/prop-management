import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
process.env.META_ADS_TOKENS = execSync('gcloud secrets versions access latest --secret=META_ADS_TOKENS --project=rentalspot-fzwom', { encoding: 'utf8' }).trim();
import { resolveAdContext } from '@/services/growth/metaAds/adContext';

const CAMPAIGN = '120251505692310114';
const ADSET = '120251505692830114';
const AD = '120251505695810114';

(async () => {
  const ctx = await resolveAdContext('prahova-mountain-chalet');
  if (!ctx) { console.log('no ad context'); process.exit(1); }
  const t = ctx.token;
  const g = async (id: string, fields: string) => {
    const r = await fetch(`https://graph.facebook.com/v25.0/${id}?fields=${fields}&access_token=${encodeURIComponent(t)}`);
    return r.json();
  };
  console.log('=== CAMPAIGN ===');
  console.log(JSON.stringify(await g(CAMPAIGN, 'name,status,effective_status,daily_budget,lifetime_budget,start_time,stop_time'), null, 1));
  console.log('=== ADSET ===');
  console.log(JSON.stringify(await g(ADSET, 'name,status,effective_status,daily_budget,lifetime_budget,start_time,end_time'), null, 1));
  console.log('=== AD ===');
  console.log(JSON.stringify(await g(AD, 'name,status,effective_status'), null, 1));
  console.log('=== SPEND (campaign insights, lifetime) ===');
  const ins = await g(CAMPAIGN + '/insights', 'spend,impressions,clicks,reach');
  console.log(JSON.stringify(ins, null, 1));
  console.log('=== ACCOUNT ===');
  console.log(JSON.stringify(await g(ctx.adAccountId, 'name,account_status,spend_cap,amount_spent,disable_reason'), null, 1));
})().catch(e => { console.error(e); process.exit(1); });
