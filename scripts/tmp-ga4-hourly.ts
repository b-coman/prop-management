import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { BetaAnalyticsDataClient } from '@google-analytics/data';
const PROPERTY = 'properties/488335480';
(async () => {
  const c = new BetaAnalyticsDataClient();
  const [meta] = await c.getMetadata({ name: `${PROPERTY}/metadata` });
  const [r] = await c.runReport({
    property: PROPERTY,
    dateRanges: [{ startDate: '2026-08-30', endDate: '2026-09-02' }],
    dimensions: [{ name: 'dateHour' }, { name: 'sessionSource' }, { name: 'sessionMedium' }, { name: 'sessionCampaignName' }],
    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'eventCount' }],
    orderBys: [{ dimension: { dimensionName: 'dateHour' } }],
    limit: 300,
  });
  console.log('TZ note: GA4 property timezone matters. Rows below are property-local dateHour.');
  console.log('DATEHOUR     SOURCE / MEDIUM / CAMPAIGN                       SESS  USERS  EVENTS');
  for (const row of r.rows || []) {
    const d = row.dimensionValues!.map(v => v.value);
    const m = row.metricValues!.map(v => v.value);
    console.log(`${d[0]}  ${(d[1]+' / '+d[2]+' / '+d[3]).padEnd(48)}  ${String(m[0]).padStart(4)}  ${String(m[1]).padStart(5)}  ${m[2]}`);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
