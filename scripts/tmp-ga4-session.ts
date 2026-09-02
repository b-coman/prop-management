import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { BetaAnalyticsDataClient } from '@google-analytics/data';
const PROPERTY = 'properties/488335480';
(async () => {
  const c = new BetaAnalyticsDataClient();
  // FINGERPRINT: server log shows 4 identical booking-check hits at 2026-09-02T04:14:05-07 UTC
  const [f] = await c.runReport({
    property: PROPERTY,
    dateRanges: [{ startDate: '2026-09-02', endDate: '2026-09-02' }],
    dimensions: [{ name: 'dateHourMinute' }, { name: 'sessionSource' }],
    metrics: [{ name: 'sessions' }, { name: 'eventCount' }],
    orderBys: [{ dimension: { dimensionName: 'dateHourMinute' } }],
    limit: 40,
  });
  console.log('FINGERPRINT — first sessions of 2026-09-02 (server log burst was 04:14 UTC):');
  for (const row of (f.rows||[]).slice(0,12)) console.log('  ', row.dimensionValues!.map(v=>v.value).join(' | '), '=>', row.metricValues!.map(v=>v.value).join('/'));

  const [r] = await c.runReport({
    property: PROPERTY,
    dateRanges: [{ startDate: '2026-08-31', endDate: '2026-09-01' }],
    dimensions: [{ name: 'dateHourMinute' }, { name: 'city' }, { name: 'deviceCategory' }, { name: 'sessionSource' }, { name: 'landingPagePlusQueryString' }],
    metrics: [{ name: 'sessions' }, { name: 'eventCount' }],
    orderBys: [{ dimension: { dimensionName: 'dateHourMinute' } }],
    limit: 500,
  });
  console.log('\nSessions Aug31 20:00 -> Sep1 02:00 (property-local):');
  for (const row of r.rows || []) {
    const d = row.dimensionValues!.map(v => v.value!);
    const hm = d[0];
    const day = hm.slice(0,8), hh = hm.slice(8,10);
    if ((day==='20260831' && hh>='20') || (day==='20260901' && hh<='02')) {
      const m = row.metricValues!.map(v => v.value!);
      console.log(`  ${hm}  ${d[1].padEnd(14)} ${d[2].padEnd(7)} ${d[3].padEnd(11)} s=${m[0]} ev=${m[1]}  ${d[4].slice(0,80)}`);
    }
  }
})().catch(e => { console.error(e.message); process.exit(1); });
