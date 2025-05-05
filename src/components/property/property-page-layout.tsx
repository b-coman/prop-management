// src/components/property/property-page-layout.tsx
import type { Property, WebsiteTemplate, PropertyOverrides, WebsiteBlock } from '@/types';
import { Header } from '@/components/generic-header';
import { Footer } from '@/components/footer';
import { InitialBookingForm } from '@/components/booking/initial-booking-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Star } from 'lucide-react';
import Image from 'next/image';

// Import all potential block components
import { HeroSection } from '@/components/homepage/hero-section';
import { ExperienceSection } from '@/components/homepage/experience-section';
import { HostIntroduction } from '@/components/homepage/host-introduction';
import { UniqueFeatures } from '@/components/homepage/unique-features';
import { LocationHighlights } from '@/components/homepage/location-highlights';
import { TestimonialsSection } from '@/components/homepage/testimonials-section';
import { CallToActionSection } from '@/components/homepage/call-to-action';
import { PropertyDetailsSection } from './property-details-section'; // Assuming this exists or will be created
import { AmenitiesSection } from './amenities-section'; // Assuming this exists or will be created
import { RulesSection } from './rules-section'; // Assuming this exists or will be created
import { GallerySection } from './gallery-section'; // Assuming this exists or will be created
import { MapSection } from './map-section'; // Assuming this exists or will be created
import { ContactSection } from './contact-section'; // Assuming this exists or will be created


interface PropertyPageLayoutProps {
  property: Property;
  template: WebsiteTemplate;
  overrides: PropertyOverrides; // Can be partial or empty object
}

// Map block types to React components
const blockComponentMap: { [key: string]: React.ComponentType<any> } = {
  hero: HeroSection,
  experience: ExperienceSection,
  host: HostIntroduction,
  features: UniqueFeatures,
  location: LocationHighlights,
  testimonials: TestimonialsSection,
  cta: CallToActionSection,
  details: PropertyDetailsSection, // Add mappings for other block types
  amenities: AmenitiesSection,
  rules: RulesSection,
  gallery: GallerySection,
  map: MapSection,
  contact: ContactSection,
};

export function PropertyPageLayout({ property, template, overrides }: PropertyPageLayoutProps) {
  // Determine which blocks to render based on overrides or template defaults
  const visibleBlockIds = overrides.visibleBlocks || template.homepage?.map(b => b.id) || [];

  // Prepare combined data for rendering, merging overrides with base property/template data
  // This merge logic might become more complex depending on how defaults work

   // Find the featured image from overrides or property data
    const findFeaturedImage = () => {
        const overrideFeatured = overrides.images?.find(img => img.isFeatured && img.tags?.includes('hero'));
        if (overrideFeatured) return overrideFeatured;
        const propertyFeatured = property.images?.find(img => img.isFeatured);
        if (propertyFeatured) return propertyFeatured;
        // Fallback logic if needed (e.g., first image)
         const firstOverrideImage = overrides.images?.[0];
         if(firstOverrideImage) return firstOverrideImage;
         const firstPropertyImage = property.images?.[0];
         if(firstPropertyImage) return firstPropertyImage;
         return null; // No image found
    };

    const featuredImage = findFeaturedImage();

    // --- Prepare props for each block type ---
    // This involves extracting the relevant data from `property` and `overrides`
    // based on what each block component expects.

    const getBlockProps = (block: WebsiteBlock) => {
        const commonProps = { property, overrides }; // Pass base data

        switch (block.type) {
            case 'hero':
                return {
                    ...commonProps,
                     // Hero specifically needs property details for rating/price, and image from overrides
                    backgroundImageUrl: overrides.hero?.backgroundImage || featuredImage?.url,
                    'data-ai-hint': overrides.hero?.['data-ai-hint'] || featuredImage?.['data-ai-hint'],
                    // Pass necessary property fields if HeroSection needs them
                    pricePerNight: property.pricePerNight,
                    ratings: property.ratings,
                     // Pass the property object itself if the form needs it
                     bookingFormProperty: property,
                };
            case 'experience':
                return {
                    ...commonProps,
                    // Default content can come from template if defined there, or hardcoded
                    title: overrides.experience?.title || "Experience Nature's Embrace",
                    welcomeText: overrides.experience?.welcomeText || "Default welcome text...",
                    highlights: overrides.experience?.highlights || [],
                };
            case 'host':
                 // Ensure host data exists before passing
                 if (!overrides.host) return null; // Don't render if no host override data
                 return { ...commonProps, host: overrides.host };
            case 'features':
                 // Ensure features data exists before passing
                 if (!overrides.features) return null;
                 return { ...commonProps, features: overrides.features };
            case 'location':
                 // Location needs property's location and override attractions
                 return {
                     ...commonProps,
                     propertyLocation: property.location,
                     attractions: overrides.attractions || [],
                 };
            case 'testimonials':
                 // Ensure testimonials data exists before passing
                 if (!overrides.testimonials) return null;
                 return {
                    ...commonProps,
                    testimonials: { // Structure expected by TestimonialsSection
                        overallRating: property.ratings?.average || 0, // Use property rating
                        reviews: overrides.testimonials || [] // Use override reviews
                    }
                };
             case 'gallery':
                 return {
                     ...commonProps,
                     images: overrides.images?.filter(img => !img.tags?.includes('hero')) || [], // Filter out hero image
                 };
             case 'cta':
                 return {
                     ...commonProps,
                     propertySlug: property.slug, // CTA needs slug for linking
                      title: overrides.cta?.title || "Ready for Your Getaway?",
                      description: overrides.cta?.description || "Book your unforgettable stay today!",
                      buttonText: overrides.cta?.buttonText || "Book Your Stay Now",
                      buttonUrl: overrides.cta?.buttonUrl || `#booking`, // Link to booking section on the same page
                 };
            case 'details': // Example for a new block type
                 return { ...commonProps, /* pass details specific props */ };
            case 'amenities': // Example
                 return { ...commonProps, amenities: property.amenities };
             case 'rules': // Example
                 return { ...commonProps, houseRules: property.houseRules };
             case 'map': // Example
                 return { ...commonProps, location: property.location };
             case 'contact': // Example
                 return { ...commonProps, /* contact details */ };

            default:
                console.warn(`No specific props defined for block type: ${block.type}`);
                return commonProps; // Pass base data as fallback
        }
    };


  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Use Generic Header */}
      <Header propertyName={property.name} propertySlug={property.slug} />

        <main className="flex-grow">
            {/* Iterate through template blocks and render if visible */}
            {template.homepage?.map((block) => {
                if (!visibleBlockIds.includes(block.id)) {
                    // console.log(`Block ${block.id} is not visible, skipping.`);
                    return null; // Skip rendering if not in visibleBlocks
                }

                const BlockComponent = blockComponentMap[block.type];
                if (!BlockComponent) {
                    console.warn(`No component found for block type: ${block.type}`);
                    return <div key={block.id}>Missing component for {block.type}</div>;
                }

                 const blockProps = getBlockProps(block);
                 // Don't render if props couldn't be determined (e.g., missing required override data)
                 if (blockProps === null && ['host', 'features', 'testimonials'].includes(block.type)) {
                     console.log(`Skipping block ${block.id} due to missing override data.`);
                    return null;
                 }

                console.log(`Rendering block: ${block.id} (${block.type})`);
                return <BlockComponent key={block.id} {...blockProps} />;
            })}
        </main>


      {/* Use Generic Footer - TODO: Make footer content dynamic based on template/overrides */}
      <Footer />
    </div>
  );
}
