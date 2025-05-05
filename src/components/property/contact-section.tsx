// src/components/property/contact-section.tsx
import { Button } from '@/components/ui/button';

interface ContactSectionProps {
  // Define props if needed, e.g., host contact details if they vary
  // hostEmail?: string;
  // hostPhone?: string;
}

export function ContactSection({ /* pass props if needed */ }: ContactSectionProps) {
  return (
    <section className="py-8 md:py-12" id="contact">
      <div className="container mx-auto px-4">
        <h2 className="text-xl font-semibold mb-4 text-foreground">Contact Host</h2>
        <p className="text-muted-foreground mb-4">
          Have questions about the property or your stay? Reach out to the host.
        </p>
        {/* TODO: Implement actual contact functionality (e.g., form, mailto link) */}
        <Button variant="outline">Contact Owner</Button>
        {/* Example mailto link:
         <a href={`mailto:${hostEmail || 'default@example.com'}`}>
           <Button variant="outline">Contact Owner via Email</Button>
         </a>
        */}
      </div>
    </section>
  );
}
