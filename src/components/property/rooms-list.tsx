// src/components/property/rooms-list.tsx
"use client";

import { RoomsListBlock } from '@/lib/overridesSchemas-multipage';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/hooks/useLanguage';

interface RoomsListProps {
  content: RoomsListBlock;
}

export function RoomsList({ content }: RoomsListProps) {
  const { title, rooms } = content;
  const { tc } = useLanguage();

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">{tc(title)}</h2>
        
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room, index) => (
            <Card key={index} className="overflow-hidden">
              <div className="relative h-56 w-full">
                <Image 
                  src={room.image} 
                  alt={typeof room.name === 'string' ? room.name : tc(room.name)}
                  fill
                  className="object-cover" 
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-2">{tc(room.name)}</h3>
                <p className="text-muted-foreground mb-4">{tc(room.description)}</p>
                
                <div className="flex flex-wrap gap-2">
                  {room.features.map((feature, featureIndex) => (
                    <Badge key={featureIndex} variant="outline" className="bg-primary/5">
                      {tc(feature)}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}