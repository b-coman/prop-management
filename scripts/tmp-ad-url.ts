import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
process.env.META_ADS_TOKENS = execSync('gcloud secrets versions access latest --secret=META_ADS_TOKENS --project=rentalspot-fzwom', { encoding: 'utf8' }).trim();
import { resolveAdContext } from '@/services/growth/metaAds/adContext';
(async () => {
  const ctx = await resolveAdContext('prahova-mountain-chalet');
  const t = ctx!.token;
  const g = async (id: string, q: string) => (await fetch(`https://graph.facebook.com/v25.0/${id}?${q}&access_token=${encodeURIComponent(t)}`)).json();
  const ads: any = await g('120251858081630114/ads', 'fields=name,effective_status,creative{id}');
  for (const a of ads.data || []) {
    const cr: any = await g(a.creative.id, 'fields=object_story_spec,asset_feed_spec,url_tags,template_url,effective_object_story_id,link_url');
    const links = JSON.stringify(cr).match(/https?:\/\/[^"'\\ ]+/g) || [];
    console.log('AD:', a.name, '|', a.effective_status);
    console.log('  url_tags:', cr.url_tags);
    console.log('  links:', [...new Set(links)].filter(l=>!l.includes('fbcdn')&&!l.includes('scontent')).slice(0,6).join('\n         '));
  }
})().catch(e => { console.error(e.message); });
