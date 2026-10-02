/**
 * Server-side access to the UI translation dictionaries.
 *
 * The client provider fetches `/locales/{lang}.json` after mount. Until that lands, every
 * `t(key, fallback)` renders its ENGLISH fallback — which meant a Romanian page was server-rendered,
 * and first-painted, in English ("7 guests / 3 bedrooms / From"). Passing the dictionary down from
 * the server as `initialTranslations` removes that window entirely.
 *
 * Static imports (not `fs`) on purpose: the JSON is bundled with the server build, so there is no
 * file-tracing or working-directory dependency on Cloud Run, and no read at request time.
 */
import en from '../../../public/locales/en.json';
import ro from '../../../public/locales/ro.json';
import { DEFAULT_LANGUAGE } from '@/lib/language-constants';

const DICTIONARIES: Record<string, Record<string, unknown>> = {
  en: en as Record<string, unknown>,
  ro: ro as Record<string, unknown>,
};

/** The UI dictionary for `language`, falling back to the default language for anything unknown. */
export function getServerTranslations(language: string | undefined): Record<string, unknown> {
  if (language && DICTIONARIES[language]) return DICTIONARIES[language];
  return DICTIONARIES[DEFAULT_LANGUAGE] ?? {};
}

/**
 * `t()` for server code: metadata, JSON-LD, sitemap and llms.txt are built before any provider
 * exists. Same lookup and `{{var}}` substitution as the client `t()`, so a key reads the same on
 * both sides. Falls back to the default language's string, then to `fallback`.
 */
export function serverT(
  language: string | undefined,
  key: string,
  fallback?: string,
  variables?: Record<string, string | number>,
): string {
  const lookup = (dict: Record<string, unknown>): string | undefined => {
    let value: unknown = dict;
    for (const k of key.split('.')) {
      if (!value || typeof value !== 'object') return undefined;
      value = (value as Record<string, unknown>)[k];
    }
    return typeof value === 'string' ? value : undefined;
  };

  let result =
    lookup(getServerTranslations(language)) ??
    lookup(getServerTranslations(DEFAULT_LANGUAGE)) ??
    fallback ??
    key;

  if (variables) {
    for (const [name, value] of Object.entries(variables)) {
      result = result.split(`{{${name}}}`).join(String(value));
    }
  }
  return result;
}
