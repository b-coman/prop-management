// src/components/property/area-guide-section.tsx
"use client";

import { AreaGuideContentBlock } from '@/lib/overridesSchemas-multipage';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/hooks/useLanguage';
import * as LucideIcons from 'lucide-react';

interface AreaGuideSectionProps {
  content: AreaGuideContentBlock;
}

function getIcon(iconName?: string) {
  if (!iconName) return null;
  const Icon = (LucideIcons as unknown as Record<string, React.FC<{ size?: number; className?: string }>>)[iconName];
  return Icon || null;
}

export function AreaGuideSection({ content }: AreaGuideSectionProps) {
  const { title, description, sections } = content;
  const { tc } = useLanguage();

  if (!sections || sections.length === 0) return null;

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        {(title || description) && (
          <div className="text-center max-w-3xl mx-auto mb-12">
            {title && <h2 className="text-3xl font-bold mb-4">{tc(title)}</h2>}
            {description && <p className="text-muted-foreground text-lg">{tc(description)}</p>}
          </div>
        )}

        <div className="grid gap-8 md:grid-cols-2">
          {sections.map((section, index) => {
            const Icon = getIcon(section.icon);
            return (
              <Card key={index} className="overflow-hidden h-full flex flex-col">
                {section.image && (
                  <div className="relative h-52 w-full">
                    <Image
                      src={section.image}
                      alt={typeof section.heading === 'string' ? section.heading : tc(section.heading)}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  </div>
                )}
                <CardContent className="p-6 flex-grow flex flex-col">
                  <div className="flex items-center gap-3 mb-3">
                    {Icon && <Icon size={24} className="text-primary shrink-0" />}
                    <h3 className="text-xl font-semibold">{tc(section.heading)}</h3>
                  </div>
                  <p className="text-muted-foreground mb-4 flex-grow">{tc(section.description)}</p>

                  {section.highlights && section.highlights.length > 0 && (
                    <div className="border-t pt-4 mt-auto">
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        {section.highlights.map((hl, hlIdx) => (
                          <div key={hlIdx}>
                            <dt className="text-muted-foreground">{tc(hl.label)}</dt>
                            <dd className="font-medium">{tc(hl.value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
