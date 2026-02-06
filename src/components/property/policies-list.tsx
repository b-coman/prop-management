// src/components/property/policies-list.tsx
"use client";

import { PoliciesListBlock } from '@/lib/overridesSchemas-multipage';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

interface PoliciesListProps {
  content: PoliciesListBlock;
}

export function PoliciesList({ content }: PoliciesListProps) {
  const { title, policies } = content;
  const { tc } = useLanguage();

  // Function to get an appropriate icon based on policy title
  const getPolicyIcon = (policyTitle: string | Record<string, string>) => {
    const resolved = typeof policyTitle === 'string' ? policyTitle : (policyTitle?.en || '');
    const lower = resolved.toLowerCase();

    if (lower.includes('cancel')) {
      return <AlertTriangle className="text-amber-500" />;
    } else if (lower.includes('check')) {
      return <Clock className="text-blue-500" />;
    } else {
      return <CheckCircle className="text-green-500" />;
    }
  };

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        {title && <h2 className="text-3xl font-bold text-center mb-12">{tc(title)}</h2>}

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full">
            {policies.map((policy, index) => (
              <AccordionItem key={index} value={`policy-${index}`}>
                <AccordionTrigger className="flex items-center gap-3 text-left">
                  <div className="flex items-center gap-3">
                    {getPolicyIcon(policy.title)}
                    <span>{tc(policy.title)}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4 pb-2 px-2">
                  <p className="text-muted-foreground whitespace-pre-line">{tc(policy.description)}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}