// src/components/property/attractions-list.tsx
"use client";

import { AttractionsListBlock } from '@/lib/overridesSchemas-multipage';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin } from 'lucide-react';

interface AttractionsListProps {
  content: AttractionsListBlock;
}

export function AttractionsList({ content }: AttractionsListProps) {
  const { title, description, attractions } = content;

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl font-bold mb-4">{title}</h2>
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
        
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {attractions.map((attraction, index) => (
            <Card key={index} className="overflow-hidden h-full flex flex-col">
              <div className="relative h-48 w-full">
                <Image 
                  src={attraction.image} 
                  alt={attraction.name}
                  fill
                  className="object-cover" 
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
              <CardContent className="p-6 flex-grow flex flex-col">
                <h3 className="text-xl font-semibold mb-2">{attraction.name}</h3>
                <p className="text-muted-foreground mb-4 flex-grow">{attraction.description}</p>
                
                <div className="flex items-center mt-auto text-sm">
                  <MapPin size={16} className="text-primary mr-2" />
                  <span>{attraction.distance}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}