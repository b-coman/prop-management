import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
process.env.META_ADS_TOKENS = execSync('gcloud secrets versions access latest --secret=META_ADS_TOKENS --project=rentalspot-fzwom', { encoding: 'utf8' }).trim();
import { resolveAdContext } from '@/services/growth/metaAds/adContext';
const CAMPAIGN = '120251858081630114';
(async () => {
  const ctx = await resolveAdContext('prahova-mountain-chalet');
  const t = ctx!.token;
  const g = async (id: string, q: string) => (await fetch(`https://graph.facebook.com/v25.0/${id}?${q}&access_token=${encodeURIComponent(t)}`)).json();

  const c = await g(CAMPAIGN, 'fields=name,effective_status,daily_budget,start_time,stop_time');
  console.log('CAMPAIGN:', c.name, '|', c.effective_status, '| daily', c.daily_budget, '| start', c.start_time, '| stop', c.stop_time);

  const as: any = await g(CAMPAIGN + '/adsets', 'fields=name,effective_status,daily_budget,end_time,targeting,optimization_goal');
  for (const s of (as.data||[])) {
    const tg = s.targeting || {};
    console.log(`\nADSET: ${s.name} | ${s.effective_status} | goal=${s.optimization_goal} | end=${s.end_time}`);
    console.log('  geo:', JSON.stringify(tg.geo_locations));
    console.log('  age:', tg.age_min, '-', tg.age_max, '| genders:', JSON.stringify(tg.genders));
    console.log('  interests/flex:', JSON.stringify(tg.flexible_spec)?.slice(0,600));
    console.log('  custom_audiences:', JSON.stringify(tg.custom_audiences));
  }
  const ads: any = await g(CAMPAIGN + '/ads', 'fields=name,effective_status,creative{title,body,object_story_spec,effective_object_story_id}');
  for (const a of (ads.data||[])) {
    const oss = a.creative?.object_story_spec || {};
    const link = oss.link_data?.link || oss.video_data?.call_to_action?.value?.link;
    console.log(`\nAD: ${a.name} | ${a.effective_status} | link=${link}`);
    console.log('  msg:', (oss.link_data?.message||a.creative?.body||'').replace(/\n/g,' ').slice(0,300));
  }
  const ins: any = await g(CAMPAIGN + '/insights',
    'time_increment=1&time_range={"since":"2026-08-18","until":"2026-09-02"}&fields=date_start,spend,impressions,reach,clicks,inline_link_clicks,ctr,actions');
  console.log('\nDATE        SPEND  IMPR  REACH  LINKCLK  LPV  VIEWCONTENT  IC');
  for (const d of (ins.data||[])) {
    const act = (n: string) => d.actions?.find((x: any) => x.action_type === n)?.value || '0';
    console.log(`${d.date_start}  ${String(d.spend).padStart(5)}  ${String(d.impressions).padStart(5)}  ${String(d.reach).padStart(5)}  ${String(d.inline_link_clicks||0).padStart(7)}  ${String(act('landing_page_view')).padStart(3)}  ${String(act('offsite_conversion.fb_pixel_view_content')).padStart(11)}  ${act('offsite_conversion.fb_pixel_initiate_checkout')}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
