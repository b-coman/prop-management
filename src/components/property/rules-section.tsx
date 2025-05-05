// src/components/property/rules-section.tsx
import type { Property } from '@/types';
import { ListChecks, CheckCircle, Clock } from 'lucide-react';

interface RulesSectionProps {
  houseRules?: string[]; // Pass rules array
  checkInTime?: string;
  checkOutTime?: string;
}

export function RulesSection({ houseRules, checkInTime, checkOutTime }: RulesSectionProps) {
   const hasRules = houseRules && houseRules.length > 0;
   const hasTimes = checkInTime || checkOutTime;

   if (!hasRules && !hasTimes) {
       return null; // Don't render if no rules or times
   }

  return (
    <section className="py-8 md:py-12" id="rules">
      <div className="container mx-auto px-4">

         {hasRules && (
             <div className="mb-6">
                 <h3 className="text-xl font-semibold mb-4 text-foreground flex items-center">
                   <ListChecks className="h-5 w-5 mr-2 text-primary" /> House Rules
                 </h3>
                 <ul className="list-none pl-0 space-y-2 text-sm text-muted-foreground">
                   {houseRules.map((rule, index) => (
                     <li key={index} className="flex items-start"> {/* Use items-start for potential multi-line rules */}
                       <CheckCircle className="h-4 w-4 mr-2 text-primary shrink-0 mt-0.5" />
                       <span>{rule}</span>
                     </li>
                   ))}
                 </ul>
             </div>
         )}

         {hasTimes && (
              <div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">Check-in / Check-out</h3>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm text-muted-foreground">
                   {checkInTime && (
                       <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1 text-primary"/> Check-in: {checkInTime}
                       </div>
                   )}
                   {checkOutTime && (
                       <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1 text-primary"/> Check-out: {checkOutTime}
                       </div>
                    )}
                </div>
              </div>
         )}

      </div>
    </section>
  );
}
