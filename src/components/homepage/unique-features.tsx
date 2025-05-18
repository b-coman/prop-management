import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image'; // Assuming you might use images later
import { Star } from 'lucide-react'; // Fallback icon
import { useLanguage } from '@/hooks/useLanguage';

interface Feature {
  icon?: string; // Optional icon name (from overrides)
  title: string | { [key: string]: string };
  description: string | { [key: string]: string };
  image?: string | null; // Optional image URL
  'data-ai-hint'?: string; // Optional AI hint for image generation
}

interface UniqueFeaturesContent {
  title?: string | { [key: string]: string };
  description?: string | { [key: string]: string };
  features: Feature[];
  'data-ai-hint'?: string;
}

interface UniqueFeaturesProps {
  content: UniqueFeaturesContent; // Use content prop for consistency
  language?: string;
}

export function UniqueFeatures({ content, language = 'en' }: UniqueFeaturesProps) {
  const { tc, t } = useLanguage();
  
  // Don't render if content is missing
  if (!content) {
    console.warn("UniqueFeatures received invalid content");
    return null;
  }

  // Extract properties with defaults to prevent destructuring errors
  const {
    title = t('features.defaultTitle'),
    description = t('features.defaultDescription'),
    features = []
  } = content;

  // Don't render if no features are provided
  if (!features || features.length === 0) {
    return null;
  }

  return (
    <section className="py-16 md:py-24 bg-secondary/50" id="features"> {/* Added ID */}
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4">
            {tc(title, language)}
          </h2>
          <p className="text-lg text-muted-foreground">
            {tc(description, language)}
          </p>
        </div>

         {/* Use a fluid grid layout */}
        <div className="grid gap-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          {features.map((feature, index) => (
            // Apply text-center to the card container
            <div key={index} className="flex flex-col items-center text-center p-6 bg-card rounded-lg shadow-md border border-border">
              {/* Feature Image or Icon - Use mx-auto to center block elements */}
              <div className="mb-4 h-40 w-full relative rounded-lg overflow-hidden bg-muted mx-auto">
                 {feature.image ? (
                     <Image
                         src={feature.image}
                         alt={tc(feature.title, language)}
                         fill
                         style={{objectFit: 'cover'}}
                         className="rounded-lg"
                         data-ai-hint={feature['data-ai-hint'] || 'feature detail amenity'}
                     />
                 ) : (
                      <div className="flex items-center justify-center h-full w-full">
                         {/* Placeholder Icon - ideally map feature.icon to a Lucide icon */}
                         <Star className="h-12 w-12 text-muted-foreground/50" />
                     </div>
                 )}
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">{tc(feature.title, language)}</h3>
              <p className="text-muted-foreground text-sm">
                {tc(feature.description, language)}
              </p>
            </div>
          ))}
        </div>

        {/* Optional: Link to a full amenities list or details page */}
        {/* <div className="text-center mt-12">
           <Link href="#gallery" passHref>
             <Button size="lg">Explore All Amenities</Button>
           </Link>
        </div> */}
      </div>
    </section>
  );
}