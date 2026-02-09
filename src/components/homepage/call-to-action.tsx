"use client";

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useLanguage } from '@/hooks/useLanguage';

interface CtaContent {
  title: string | any;
  description: string | any;
  buttonText: string | any;
  buttonUrl: string;
  backgroundImage?: string;
  'data-ai-hint'?: string;
}

interface CallToActionSectionProps {
  content: CtaContent;
}

// Main export with the name used in property-page-renderer.tsx
export function CallToActionSection({ content }: CallToActionSectionProps) {
  // Extract properties from content
  const { title, description, buttonText, buttonUrl } = content;
  const { tc } = useLanguage();

  // Determine the target link
  const targetHref = buttonUrl || '/booking'; // Default to booking page

  // Don't render if required props are missing
  if (!title || !description || !buttonText) {
    return null;
  }

  // Style based on backgroundImage if provided
  const sectionStyle = content.backgroundImage
    ? {
        backgroundImage: `linear-gradient(to right, hsl(var(--primary) / 0.9), hsl(var(--primary) / 0.75)), url('${content.backgroundImage}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {};

  return (
    <section
      className="py-10 md:py-16 bg-gradient-to-r from-primary/80 to-primary"
      id="cta"
      style={sectionStyle}
    >
      <div className="container mx-auto px-4 text-center text-primary-foreground">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">
          {tc(title)}
        </h2>
        <p className="text-lg mb-8 max-w-2xl mx-auto">
          {tc(description)}
        </p>
        {/* Link to the determined target */}
         <Button size="lg" variant="secondary" className="text-primary hover:bg-secondary/90" asChild>
           <Link href={targetHref}>
             {tc(buttonText)}
           </Link>
         </Button>
      </div>
    </section>
  );
}
