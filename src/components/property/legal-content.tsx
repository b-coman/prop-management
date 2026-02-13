// src/components/property/legal-content.tsx
"use client";

import { LegalContentBlock } from '@/lib/overridesSchemas-multipage';
import { useLanguage } from '@/hooks/useLanguage';

interface LegalContentProps {
  content: LegalContentBlock;
}

export function LegalContent({ content }: LegalContentProps) {
  const { title, lastUpdated, sections } = content;
  const { t, tc } = useLanguage();

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          {title && (
            <h1 className="text-3xl font-bold mb-4">{tc(title)}</h1>
          )}
          {lastUpdated && (
            <p className="text-sm text-muted-foreground mb-8">
              {t('legal.lastUpdated', 'Last updated')}: {lastUpdated}
            </p>
          )}

          <div className="space-y-8">
            {sections.map((section, index) => (
              <div key={index}>
                <h2 className="text-xl font-semibold mb-3">{tc(section.title)}</h2>
                <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                  {tc(section.body)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
