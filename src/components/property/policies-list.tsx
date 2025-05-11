// src/components/property/policies-list.tsx
"use client";

import { PoliciesListBlock } from '@/lib/overridesSchemas-multipage';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface PoliciesListProps {
  content: PoliciesListBlock;
}

export function PoliciesList({ content }: PoliciesListProps) {
  const { title, policies } = content;

  // Function to get an appropriate icon based on policy title
  const getPolicyIcon = (policyTitle: string) => {
    const title = policyTitle.toLowerCase();
    
    if (title.includes('cancel')) {
      return <AlertTriangle className="text-amber-500" />;
    } else if (title.includes('check')) {
      return <Clock className="text-blue-500" />;
    } else {
      return <CheckCircle className="text-green-500" />;
    }
  };

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        {title && <h2 className="text-3xl font-bold text-center mb-12">{title}</h2>}
        
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full">
            {policies.map((policy, index) => (
              <AccordionItem key={index} value={`policy-${index}`}>
                <AccordionTrigger className="flex items-center gap-3 text-left">
                  <div className="flex items-center gap-3">
                    {getPolicyIcon(policy.title)}
                    <span>{policy.title}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4 pb-2 px-2">
                  <p className="text-muted-foreground whitespace-pre-line">{policy.description}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}