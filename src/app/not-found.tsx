import { headers } from 'next/headers';
import Link from 'next/link';
import { DOMAIN_TO_PROPERTY_MAP } from '@/lib/domain-map';
import { getPropertyBySlug } from '@/lib/property-utils';
import { getWebsiteTemplate, getPropertyOverrides } from '@/app/properties/[slug]/[[...path]]/page';
import { serverTranslateContent } from '@/lib/server-language-utils';
import { PropertyNotFoundPage } from '@/components/property/property-not-found-page';
import { LanguageProvider } from '@/lib/language-system';

export default async function NotFound() {
  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || '';

  // Check if the request came from a custom domain
  const propertySlug = DOMAIN_TO_PROPERTY_MAP[host] || DOMAIN_TO_PROPERTY_MAP[host.replace(/^www\./, '')];

  if (propertySlug) {
    // Fetch property data for branded 404
    const [property, overrides] = await Promise.all([
      getPropertyBySlug(propertySlug),
      getPropertyOverrides(propertySlug),
    ]);

    if (property && overrides) {
      const template = await getWebsiteTemplate(property.templateId);
      if (template) {
        const propertyNameSource = overrides.propertyMeta?.name || property.name;
        const resolvedName = serverTranslateContent(propertyNameSource, 'en');
        const menuItems = overrides.menuItems || template.header.menuItems;
        const logoAlt = template.header.logo?.alt
          ? serverTranslateContent(template.header.logo.alt, 'en')
          : undefined;

        return (
          <LanguageProvider>
            <PropertyNotFoundPage
              propertyName={resolvedName}
              propertySlug={propertySlug}
              themeId={property.themeId}
              menuItems={menuItems}
              logoSrc={template.header.logo?.src}
              logoAlt={logoAlt}
              isCustomDomain={true}
              quickLinks={overrides.footer?.quickLinks || template.footer?.quickLinks}
              contactInfo={overrides.footer?.contactInfo || template.footer?.contactInfo}
              socialLinks={overrides.footer?.socialLinks}
            />
          </LanguageProvider>
        );
      }
    }
  }

  // Generic fallback 404 for non-property domains
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
      <div className="max-w-md">
        <p className="text-[8rem] font-bold leading-none text-gray-200 select-none">404</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">
          Page not found
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Sorry, we couldn&apos;t find the page you&apos;re looking for.
        </p>
        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-gray-900 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-gray-800 transition-colors"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
