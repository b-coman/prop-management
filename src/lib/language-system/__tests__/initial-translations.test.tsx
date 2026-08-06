/**
 * @jest-environment jsdom
 *
 * Regression cover for server-seeded translations.
 *
 * Before this, the provider started with an EMPTY dictionary and fetched /locales/{lang}.json after
 * mount, so the FIRST render of a Romanian page returned every `t(key, fallback)`'s ENGLISH fallback.
 * That is what the server rendered ("From / 7 guests / 3 bedrooms") and what the visitor saw until the
 * fetch landed. These tests pin the first-render behaviour, which is the part a browser check cannot
 * catch reliably (it is over in a few hundred milliseconds).
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '../LanguageProvider';
import { useLanguage } from '@/hooks/useLanguage';
import { getServerTranslations } from '../server-translations';

jest.mock('next/navigation', () => ({
  usePathname: () => '/ro',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

/** Renders the exact call shape the hero uses: a key with an English fallback. */
function HeroSpecs() {
  const { t, currentLang } = useLanguage();
  return (
    <div>
      <span data-testid="lang">{currentLang}</span>
      <span data-testid="from">{t('common.from', 'From')}</span>
      <span data-testid="guests">{t('specs.guests', 'guests')}</span>
      <span data-testid="bedrooms">{t('specs.bedrooms', 'bedrooms')}</span>
    </div>
  );
}

describe('LanguageProvider — server-seeded translations', () => {
  it('renders Romanian on the FIRST render when the dictionary is seeded', () => {
    render(
      <LanguageProvider initialLanguage="ro" initialTranslations={getServerTranslations('ro')}>
        <HeroSpecs />
      </LanguageProvider>
    );

    expect(screen.getByTestId('lang')).toHaveTextContent('ro');
    // The regression: these were "From" / "guests" / "bedrooms" on the Romanian page.
    expect(screen.getByTestId('guests')).toHaveTextContent('oaspeți');
    expect(screen.getByTestId('bedrooms')).toHaveTextContent('dormitoare');
    expect(screen.getByTestId('from')).toHaveTextContent('De la');
  });

  it('falls back to the English fallbacks when NOT seeded (documents the old behaviour)', () => {
    render(
      <LanguageProvider initialLanguage="ro">
        <HeroSpecs />
      </LanguageProvider>
    );

    // Same language, but no dictionary yet — so `t()` yields its English fallback on first render.
    expect(screen.getByTestId('guests')).toHaveTextContent('guests');
  });

  it('seeds English without leaking Romanian', () => {
    render(
      <LanguageProvider initialLanguage="en" initialTranslations={getServerTranslations('en')}>
        <HeroSpecs />
      </LanguageProvider>
    );

    expect(screen.getByTestId('guests')).not.toHaveTextContent('oaspeți');
  });
});

describe('getServerTranslations', () => {
  it('returns a non-empty dictionary for each supported language', () => {
    expect(Object.keys(getServerTranslations('ro')).length).toBeGreaterThan(0);
    expect(Object.keys(getServerTranslations('en')).length).toBeGreaterThan(0);
  });

  it('falls back to the default language for unknown/missing input', () => {
    expect(getServerTranslations('de')).toEqual(getServerTranslations('en'));
    expect(getServerTranslations(undefined)).toEqual(getServerTranslations('en'));
  });

  it('the Romanian dictionary actually differs from English (guards a bad copy/symlink)', () => {
    expect(getServerTranslations('ro')).not.toEqual(getServerTranslations('en'));
  });
});
