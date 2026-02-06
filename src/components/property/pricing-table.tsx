// src/components/property/pricing-table.tsx
"use client";

import { PricingTableBlock } from '@/lib/overridesSchemas-multipage';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/hooks/useLanguage';

interface PricingTableProps {
  content: PricingTableBlock;
}

export function PricingTable({ content }: PricingTableProps) {
  const { title, description, seasons } = content;
  const { tc } = useLanguage();

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-4">{tc(title)}</h2>
        {description && (
          <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-10">
            {tc(description)}
          </p>
        )}
        
        <Card className="overflow-hidden max-w-4xl mx-auto">
          <Table>
            <TableCaption>Seasonal rates and minimum stay requirements.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Season</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Nightly Rate</TableHead>
                <TableHead className="text-right">Minimum Stay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {seasons.map((season, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{tc(season.name)}</TableCell>
                  <TableCell>{tc(season.period)}</TableCell>
                  <TableCell>{tc(season.rate)}</TableCell>
                  <TableCell className="text-right">{tc(season.minimumStay)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </section>
  );
}