/**
 * /lp/[campaign] — campaign landing pages (docs/landing-page-engine-design.md). Two-segment catch-all so
 * middleware passes it through untouched; parses its own language path segment like /booking/check. Reads
 * the landing config server-side (Admin SDK), builds the render model, and renders inside a per-request
 * LanguageProvider (so the reused Header/Footer translate correctly). Public page; tracking is inherited
 * from the root layout (per-property pixel resolves on the custom domain).
 */
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { LanguageProvider } from '@/lib/language-system';
import { getServerTranslations } from '@/lib/language-system/server-translations';
import { LanguageHtmlUpdater } from '@/components/language-html-updater';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/language-constants';
import { getLandingConfig, buildLandingModel } from '@/lib/landing/getLanding';
import { LandingRenderer } from '@/components/landing/landing-renderer';

export const dynamic = 'force-dynamic';

/**
 * The language explicitly asked for in the URL, or undefined when none is.
 *
 * Returning undefined matters: the campaign config carries its own
 * `defaultLanguage`, and a campaign is written for one audience. This used to
 * return DEFAULT_LANGUAGE ('en') instead, which is truthy, so the
 * `language || config.defaultLanguage` fallback downstream could never fire and
 * a Romanian campaign served its English copy to every ad click.
 */
function langFromPath(path?: string[]): string | undefined {
  const seg = path?.[0];
  return seg && SUPPORTED_LANGUAGES.includes(seg) ? seg : undefined;
}

/** URL segment wins, then the campaign's own default, then the app default. */
function resolveLanguage(config: { defaultLanguage?: string } | null, path?: string[]): string {
  const fromPath = langFromPath(path);
  if (fromPath) return fromPath;
  const fromConfig = config?.defaultLanguage;
  if (fromConfig && SUPPORTED_LANGUAGES.includes(fromConfig)) return fromConfig;
  return DEFAULT_LANGUAGE;
}

export async function generateMetadata({ params }: { params: Promise<{ campaign: string; path?: string[] }> }): Promise<Metadata> {
  const { campaign, path } = await params;
  const config = await getLandingConfig(campaign);
  if (!config) return { title: 'Not found', robots: { index: false } };
  const host = (await headers()).get('x-forwarded-host') || (await headers()).get('host') || '';
  const m = await buildLandingModel(config, resolveLanguage(config, path), host);
  return {
    title: m?.hero.headline || m?.propertyName || 'Book your stay',
    description: m?.hero.subcopy || m?.story?.body?.slice(0, 155),
    // Campaign landing pages are for paid traffic, not search — keep them out of the index.
    robots: { index: false, follow: true },
  };
}

export default async function LandingPage({ params }: { params: Promise<{ campaign: string; path?: string[] }> }) {
  const { campaign, path } = await params;
  const config = await getLandingConfig(campaign);
  if (!config) notFound();

  const language = resolveLanguage(config, path);
  const hdrs = await headers();
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host') || '';
  const model = await buildLandingModel(config, language, host);
  if (!model) notFound();

  return (
    <LanguageProvider initialLanguage={language} initialTranslations={getServerTranslations(language)}>
      {/* The root layout stamps <html lang> from the middleware's x-language
          header, which is derived from the URL and so reads 'en' for a campaign
          whose language comes from its own config. Re-assert it here, inside the
          provider that actually knows the campaign language, so a Romanian page
          is not announced as English or offered up for translation. */}
      <LanguageHtmlUpdater initialLanguage={language} />
      <LandingRenderer m={model} />
    </LanguageProvider>
  );
}
