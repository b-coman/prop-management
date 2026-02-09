"use client";

import Link from 'next/link';
import { Header } from '@/components/generic-header-multipage';
import { Footer } from '@/components/footer';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { DEFAULT_THEME_ID } from '@/lib/themes/theme-definitions';
import { useLanguage } from '@/hooks/useLanguage';
import type { MenuItem } from '@/lib/overridesSchemas-multipage';

interface PropertyNotFoundPageProps {
  propertyName: string;
  propertySlug: string;
  themeId?: string;
  menuItems: MenuItem[];
  logoSrc?: string;
  logoAlt?: string;
  isCustomDomain: boolean;
  quickLinks?: Array<{ label: string | Record<string, string>; url: string }>;
  contactInfo?: { email?: string; phone?: string };
  socialLinks?: Array<{ platform: string; url: string }>;
}

export function PropertyNotFoundPage({
  propertyName,
  propertySlug,
  themeId = DEFAULT_THEME_ID,
  menuItems,
  logoSrc,
  logoAlt,
  isCustomDomain,
  quickLinks,
  contactInfo,
  socialLinks,
}: PropertyNotFoundPageProps) {
  const { tc } = useLanguage();

  const homeUrl = isCustomDomain ? '/' : `/properties/${propertySlug}`;

  return (
    <ThemeProvider initialThemeId={themeId}>
      <div className="flex min-h-screen flex-col">
        <Header
          propertyName={propertyName}
          propertySlug={propertySlug}
          menuItems={menuItems}
          logoSrc={logoSrc}
          logoAlt={logoAlt}
          isCustomDomain={isCustomDomain}
        />

        <main className="flex-grow flex items-center justify-center px-4 py-24">
          <div className="text-center max-w-lg">
            <p className="text-[8rem] font-bold leading-none text-muted-foreground/20 select-none">
              404
            </p>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">
              {tc({ en: 'Page not found', ro: 'Pagina nu a fost gasita' })}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              {tc({
                en: 'Sorry, we couldn\'t find the page you\'re looking for. It may have been moved or no longer exists.',
                ro: 'Ne pare rau, nu am gasit pagina pe care o cautati. Este posibil sa fi fost mutata sau sa nu mai existe.',
              })}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={homeUrl}
                className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
              >
                {tc({ en: 'Go to Homepage', ro: 'Mergi la pagina principala' })}
              </Link>
            </div>

            {menuItems.length > 0 && (
              <nav className="mt-10 border-t pt-6">
                <p className="text-sm text-muted-foreground mb-3">
                  {tc({ en: 'Or try one of these pages:', ro: 'Sau incearca una din aceste pagini:' })}
                </p>
                <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2">
                  {menuItems.map((item) => {
                    const label = tc(item.label);
                    const resolvedUrl = isCustomDomain
                      ? item.url
                      : `/properties/${propertySlug}${item.url}`;
                    return (
                      <li key={item.url}>
                        <Link
                          href={resolvedUrl}
                          className="text-sm text-primary hover:underline"
                        >
                          {label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            )}
          </div>
        </main>

        <Footer
          quickLinks={quickLinks}
          contactInfo={contactInfo}
          socialLinks={socialLinks}
          propertyName={propertyName}
          propertySlug={propertySlug}
          isCustomDomain={isCustomDomain}
        />
      </div>
    </ThemeProvider>
  );
}
