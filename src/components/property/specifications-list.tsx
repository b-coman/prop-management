// src/components/property/specifications-list.tsx
"use client";

import { SpecificationsListBlock } from '@/lib/overridesSchemas-multipage';
import { useLanguage } from '@/hooks/useLanguage';

interface SpecificationsListProps {
  content: SpecificationsListBlock;
}

export function SpecificationsList({ content }: SpecificationsListProps) {
  const { title, specifications } = content;
  const { tc } = useLanguage();

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">{tc(title)}</h2>
        
        <div className="max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-y-6 gap-x-8 bg-card border rounded-lg p-8 shadow-sm">
          {specifications.map((spec, index) => (
            <div key={index} className="flex flex-col">
              <dt className="text-sm text-muted-foreground mb-1">{tc(spec.name)}</dt>
              <dd className="text-base font-medium">{tc(spec.value)}</dd>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}