/**
 * metaAdsService — thin Meta Marketing API wrapper for reading ad insights (the
 * spend half of the ROAS loop, §12). PHASE 2, DARK: inert until
 * META_SYSTEM_USER_TOKEN + META_AD_ACCOUNT_ID are provisioned. Campaign/ad
 * creation is intentionally NOT built yet — it needs a live Meta account to be
 * validated at all, so it belongs to the finalization step, not dark code.
 */
import { loggers } from '@/lib/logger';

const logger = loggers.tracking;
const GRAPH_API_VERSION = 'v21.0';
const META_SYSTEM_USER_TOKEN = process.env.META_SYSTEM_USER_TOKEN;
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;

export function isMetaAdsConfigured(): boolean {
  return !!META_SYSTEM_USER_TOKEN && !!META_AD_ACCOUNT_ID;
}

export interface AdInsights {
  spend: number;
  impressions: number;
  clicks: number;
}

/** Read insights for a Meta campaign. Inert (returns not-configured) without creds. */
export async function getCampaignInsights(
  metaCampaignId: string
): Promise<{ success: boolean; insights?: AdInsights; error?: string }> {
  if (!isMetaAdsConfigured()) {
    return { success: false, error: 'Meta Ads not configured' };
  }
  try {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${metaCampaignId}/insights?fields=spend,impressions,clicks&access_token=${META_SYSTEM_USER_TOKEN}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      logger.error('getCampaignInsights failed', new Error(text), { metaCampaignId });
      return { success: false, error: text };
    }
    const json = await res.json();
    const row = json?.data?.[0] || {};
    return {
      success: true,
      insights: {
        spend: Number(row.spend || 0),
        impressions: Number(row.impressions || 0),
        clicks: Number(row.clicks || 0),
      },
    };
  } catch (error) {
    logger.error('getCampaignInsights error', error as Error, { metaCampaignId });
    return { success: false, error: (error as Error).message };
  }
}
