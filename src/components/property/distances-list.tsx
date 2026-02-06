// src/components/property/distances-list.tsx
"use client";

import { DistancesListBlock } from '@/lib/overridesSchemas-multipage';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Clock, MapPin } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

interface DistancesListProps {
  content: DistancesListBlock;
}

export function DistancesList({ content }: DistancesListProps) {
  const { title, distances } = content;
  const { tc } = useLanguage();

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">{tc(title)}</h2>
        
        <Card className="overflow-hidden max-w-3xl mx-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Place</TableHead>
                <TableHead>Distance</TableHead>
                <TableHead className="text-right">Travel Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {distances.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{tc(item.place)}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <MapPin size={16} className="mr-2 text-primary" />
                      {tc(item.distance)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end">
                      <Clock size={16} className="mr-2 text-primary" />
                      {tc(item.time)}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </section>
  );
}