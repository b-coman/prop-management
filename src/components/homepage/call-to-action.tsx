import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface CallToActionSectionProps {
    propertySlug: string; // Needed to link to the booking flow or details
    title: string;
    description: string;
    buttonText: string;
    buttonUrl?: string; // Optional: specific URL or anchor link
}

export function CallToActionSection({
    propertySlug,
    title,
    description,
    buttonText,
    buttonUrl
}: CallToActionSectionProps) {

  // Determine the target link: use buttonUrl if provided, otherwise link to booking form on property page
  const targetHref = buttonUrl || `/properties/${propertySlug}#booking`; // Default to booking section anchor

  // Don't render if required props are missing
  if (!propertySlug || !title || !description || !buttonText) {
      return null;
  }

  return (
    <section className="py-16 md:py-24 bg-gradient-to-r from-primary/80 to-primary" id="cta"> {/* Added ID */}
      <div className="container mx-auto px-4 text-center text-primary-foreground">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">
          {title}
        </h2>
        <p className="text-lg mb-8 max-w-2xl mx-auto">
          {description}
        </p>
        {/* Link to the determined target */}
         <Link href={targetHref} passHref>
           <Button size="lg" variant="secondary" className="text-primary hover:bg-secondary/90">
             {buttonText}
           </Button>
         </Link>
      </div>
    </section>
  );
}
