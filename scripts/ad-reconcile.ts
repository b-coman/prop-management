#!/usr/bin/env npx tsx
/** ad-reconcile — run the reconciliation backstop once and print the result. Read-mostly (refreshes
 *  our docs' insights/status + flags drift/escapes); never spends. Token from Secret Manager. */
import * as dotenv from 'dotenv'; import * as path from 'path'; import { execSync } from 'child_process';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
process.env.META_ADS_TOKENS = execSync('gcloud secrets versions access latest --secret=META_ADS_TOKENS --project=rentalspot-fzwom', { encoding: 'utf8' }).trim();
import { reconcileAdCampaigns } from '@/services/growth/adReconciliation';
(async () => { console.log(JSON.stringify(await reconcileAdCampaigns(), null, 2)); process.exit(0); })().catch((e) => { console.error(e); process.exit(1); });
