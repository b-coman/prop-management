
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image'; // Assuming you might use images later

interface Feature {
  name: string;
  description: string;
  imageUrl?: string; // Optional image URL
  'data-ai-hint'?: string; // Optional AI hint for image generation
}

interface UniqueFeaturesProps {
  features: Feature[];
}

export function UniqueFeatures({ features }: UniqueFeaturesProps) {
  return (
    <section className="py-16 md:py-24 bg-secondary/50">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4">
            Make Your Stay Unforgettable
          </h2>
          <p className="text-lg text-muted-foreground">
            Discover the special touches that set our chalet apart.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="flex flex-col items-center text-center p-6 bg-card rounded-lg shadow-md border border-border">
              {/* Placeholder for image or icon */}
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 text-primary">
                 {/* Replace with an appropriate icon or image based on feature.name */}
                 {/* Example: <Image src={feature.imageUrl} alt={feature.name} width={40} height={40} /> */}
                 {/* Placeholder Icon */}
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8"><path d="M12.5 10.5c-.1-.8-.4-1.5-.8-2-.4-.5-1-1-1.7-1-.7 0-1.3.5-1.7 1-.4.5-.7 1.2-.8 2-.1.8-.2 1.7-.2 2.5 0 .8.1 1.7.2 2.5.1.8.4 1.5.8 2 .4.5 1 1 1.7 1 .7 0 1.3-.5 1.7-1 .4-.5.7-1.2.8-2 .1-.8.2-1.7.2-2.5 0-.8-.1-1.7-.2-2.5Z"/><path d="M5.2 2.2l1.1 1.1"/><path d="M2.2 5.2l1.1 1.1"/><path d="M17.7 2.2l-1.1 1.1"/><path d="M21.8 5.2l-1.1 1.1"/><path d="M8 18v2"/><path d="M16 18v2"/><path d="M7.7 14.7l-1.1 1.1"/><path d="m17.5 15.8-.9.9"/><circle cx="12" cy="12" r="10"/></svg>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">{feature.name}</h3>
              <p className="text-muted-foreground text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
           {/* Link to a more detailed amenities/features page if it exists */}
          <Link href="#gallery" passHref> {/* Link to gallery or details section */}
             <Button size="lg">Explore More Features</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
