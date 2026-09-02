import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
process.env.META_ADS_TOKENS = execSync('gcloud secrets versions access latest --secret=META_ADS_TOKENS --project=rentalspot-fzwom', { encoding: 'utf8' }).trim();
import { resolveAdContext } from '@/services/growth/metaAds/adContext';

const CAMPAIGN = '120251858081630114';
(async () => {
  const ctx = await resolveAdContext('prahova-mountain-chalet');
  if (!ctx) { console.log('no ad context'); process.exit(1); }
  const t = ctx.token;
  const g = async (id: string, q: string) => {
    const r = await fetch(`https://graph.facebook.com/v25.0/${id}?${q}&access_token=${encodeURIComponent(t)}`);
    return r.json();
  };
  console.log('=== CAMPAIGN ===');
  console.log(JSON.stringify(await g(CAMPAIGN, 'fields=name,status,effective_status,daily_budget,start_time,stop_time'), null, 1));
  console.log('=== ADSETS (targeting) ===');
  const as = await g(CAMPAIGN + '/adsets', 'fields=name,status,effective_status,daily_budget,start_time,end_time,targeting,optimization_goal');
  console.log(JSON.stringify(as, null, 1).slice(0, 3000));
  console.log('=== ADS + creative link ===');
  const ads = await g(CAMPAIGN + '/ads', 'fields=name,status,effective_status,creative{title,body,object_story_spec,effective_object_story_id,link_url}');
  console.log(JSON.stringify(ads, null, 1).slice(0, 3000));
  console.log('=== DAILY INSIGHTS 2026-08-20..2026-09-02 ===');
  const ins = await g(CAMPAIGN + '/insights',
    'time_increment=1&time_range={"since":"2026-08-20","until":"2026-09-02"}&fields=date_start,spend,impressions,reach,frequency,clicks,inline_link_clicks,cpc,ctr,actions');
  console.log(JSON.stringify(ins, null, 1).slice(0, 6000));
})().catch(e => { console.error(e); process.exit(1); });
