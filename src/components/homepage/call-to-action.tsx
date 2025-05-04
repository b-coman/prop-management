
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface CallToActionSectionProps {
    propertySlug: string; // Needed to link to the booking flow or details
}

export function CallToActionSection({ propertySlug }: CallToActionSectionProps) {
  return (
    <section className="py-16 md:py-24 bg-gradient-to-r from-primary/80 to-primary">
      <div className="container mx-auto px-4 text-center text-primary-foreground">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">
          Ready for Your Mountain Escape?
        </h2>
        <p className="text-lg mb-8 max-w-2xl mx-auto">
          Don't wait to experience the tranquility and adventure of the Prahova Valley. Book your unforgettable stay today!
        </p>
        {/* Link directly to the property page or the initial booking step */}
         <Link href={`/properties/${propertySlug}`} passHref>
           <Button size="lg" variant="secondary" className="text-primary hover:bg-secondary/90">
             Book Your Stay Now
           </Button>
         </Link>
      </div>
    </section>
  );
}
