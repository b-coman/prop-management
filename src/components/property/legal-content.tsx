// src/components/property/legal-content.tsx
"use client";

import { LegalContentBlock } from '@/lib/overridesSchemas-multipage';
import { useLanguage } from '@/hooks/useLanguage';

interface OperatorInfo {
  operatorName: string;
  operatorEmail: string;
  operatorAddress: string;
  jurisdiction: string | Record<string, string>;
  propertyName: string;
}

interface LegalContentProps {
  content: LegalContentBlock & { operatorInfo?: OperatorInfo };
}

export function LegalContent({ content }: LegalContentProps) {
  const { title, lastUpdated, sections, operatorInfo } = content;
  const { t, tc } = useLanguage();

  function replacePlaceholders(text: string): string {
    if (!operatorInfo) return text;
    return text
      .replace(/\{\{operatorName\}\}/g, operatorInfo.operatorName)
      .replace(/\{\{operatorEmail\}\}/g, operatorInfo.operatorEmail)
      .replace(/\{\{operatorAddress\}\}/g, operatorInfo.operatorAddress)
      .replace(/\{\{jurisdiction\}\}/g, tc(operatorInfo.jurisdiction))
      .replace(/\{\{propertyName\}\}/g, operatorInfo.propertyName);
  }

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          {title && (
            <h1 className="text-3xl font-bold mb-4">{replacePlaceholders(tc(title))}</h1>
          )}
          {lastUpdated && (
            <p className="text-sm text-muted-foreground mb-8">
              {t('legal.lastUpdated', 'Last updated')}: {lastUpdated}
            </p>
          )}

          <div className="space-y-8">
            {sections.map((section, index) => (
              <div key={index}>
                <h2 className="text-xl font-semibold mb-3">{replacePlaceholders(tc(section.title))}</h2>
                <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                  {replacePlaceholders(tc(section.body))}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
