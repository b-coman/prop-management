
// src/components/property/property-page-layout.tsx
import type { Property, WebsiteTemplate, PropertyOverrides } from '@/types';
import { Header } from '@/components/generic-header';
import { Footer } from '@/components/footer';
import { HeroSection } from '@/components/homepage/hero-section';
import { ExperienceSection } from '@/components/homepage/experience-section';
import { HostIntroduction } from '@/components/homepage/host-introduction';
import { UniqueFeatures } from '@/components/homepage/unique-features';
import { LocationHighlights } from '@/components/homepage/location-highlights';
import { TestimonialsSection } from '@/components/homepage/testimonials-section';
import { CallToActionSection } from '@/components/homepage/call-to-action';
import { GallerySection } from './gallery-section';
import { PropertyDetailsSection } from './property-details-section';
import { AmenitiesSection } from './amenities-section';
import { RulesSection } from './rules-section';
import { MapSection } from './map-section';
import { ContactSection } from './contact-section';
import { Separator } from '@/components/ui/separator';

interface PropertyPageLayoutProps {
  property: Property;
  template: WebsiteTemplate;
  overrides: PropertyOverrides; // Ensure overrides are always passed, even if empty
}

export function PropertyPageLayout({ property, template, overrides }: PropertyPageLayoutProps) {
    const { slug, name, location, pricePerNight, ratings, amenities, checkInTime, checkOutTime, houseRules } = property;
    const { homepage = [], header: templateHeader, footer: templateFooter } = template;
    const {
        visibleBlocks = homepage.map(b => b.id), // Default to all blocks visible if not specified
        hero: heroOverrides = {},
        experience: experienceOverrides = {},
        host: hostOverrides = {},
        features: featuresOverrides = [],
        location: locationOverrides = {}, // Keep for potential map/other settings
        attractions: attractionsOverrides = [],
        testimonials: testimonialsOverrides = [],
        images: galleryImagesOverrides = [], // Use 'images' from overrides for the gallery
        cta: ctaOverrides = {},
        // Header/Footer overrides can be added here if needed
    } = overrides;

     // Helper function to get override data for a block or default/empty
     const getBlockData = (blockId: string, defaultData: any = {}) => {
        return overrides[blockId as keyof PropertyOverrides] || defaultData;
     };

    // Prepare data for each section, merging overrides with property data where necessary
    const heroData = {
        backgroundImageUrl: heroOverrides?.backgroundImage || property.images?.find(img => img.isFeatured)?.url || property.images?.[0]?.url || null,
        'data-ai-hint': heroOverrides?.backgroundImage ? 'hero background' : property.images?.find(img => img.isFeatured)?.['data-ai-hint'] || property.images?.[0]?.['data-ai-hint'],
        pricePerNight: property.pricePerNight,
        ratings: property.ratings,
        bookingFormProperty: property, // Pass the whole property object to the form
    };

     const experienceData = {
        title: experienceOverrides?.title || "Experience Our Property", // Default titles
        welcomeText: experienceOverrides?.welcomeText || "Discover the unique charm and comfort of your stay.",
        highlights: experienceOverrides?.highlights || [], // Default to empty highlights
     };

      // Ensure hostOverrides has the required structure even if partial
      const hostData = {
          name: hostOverrides?.name || "Your Host",
          imageUrl: hostOverrides?.imageUrl || null,
          welcomeMessage: hostOverrides?.welcomeMessage || "We're delighted to welcome you!",
          backstory: hostOverrides?.backstory || "We strive to make your stay exceptional.",
          'data-ai-hint': hostOverrides?.['data-ai-hint']
      };


      const testimonialsData = {
          overallRating: property.ratings?.average || 0,
          reviews: testimonialsOverrides || [],
      };

      const ctaData = {
        title: ctaOverrides?.title || "Ready for Your Getaway?",
        description: ctaOverrides?.description || "Book your stay today and create unforgettable memories.",
        buttonText: ctaOverrides?.buttonText || "Book Now",
        buttonUrl: ctaOverrides?.buttonUrl, // Let the component handle default linking
        propertySlug: slug,
      }


     // Filter gallery images - exclude hero image if it's explicitly tagged
     const galleryImages = galleryImagesOverrides.filter(img => !img.tags?.includes('hero'));


    // Render logic: Iterate through template blocks and render if visible
    const renderBlock = (block: { id: string; type: string }) => {
        if (!visibleBlocks.includes(block.id)) {
            // console.log(`Block ${block.id} is not visible.`);
            return null;
        }

        // console.log(`Rendering block: ${block.id} (Type: ${block.type})`);

        switch (block.type) {
            case 'hero':
                return <HeroSection key={block.id} {...heroData} />;
            case 'experience':
                return <ExperienceSection key={block.id} {...experienceData} />;
            case 'host':
                 // Only render host section if essential data exists
                 if (hostData.name && hostData.welcomeMessage && hostData.backstory) {
                     return <HostIntroduction key={block.id} host={hostData} />;
                 }
                 return null; // Don't render if host data is incomplete
            case 'features':
                return <UniqueFeatures key={block.id} features={featuresOverrides} />;
             case 'location':
                 // Pass property location and attraction overrides
                 return <LocationHighlights key={block.id} propertyLocation={location} attractions={attractionsOverrides} />;
             case 'testimonials':
                  return <TestimonialsSection key={block.id} testimonials={testimonialsData} />;
            case 'gallery':
                 return <GallerySection key={block.id} images={galleryImages} propertyName={name} />;
            case 'details': // Assuming 'details' is a type defined in your template
                return <PropertyDetailsSection key={block.id} property={property} />;
            case 'amenities':
                 return <AmenitiesSection key={block.id} amenities={amenities} />;
            case 'rules':
                 return <RulesSection key={block.id} houseRules={houseRules} checkInTime={checkInTime} checkOutTime={checkOutTime} />;
             case 'map':
                 return <MapSection key={block.id} location={location} />;
            case 'contact':
                 return <ContactSection key={block.id} />;
            case 'cta':
                 return <CallToActionSection key={block.id} {...ctaData} />;
            case 'separator': // Handle separator block type
                 return <Separator key={block.id} className="my-8 md:my-12" />; // Add spacing around separator
            default:
                 console.warn(`Unknown block type "${block.type}" for block ID "${block.id}".`);
                return <div key={block.id}>Unsupported block type: {block.type}</div>;
        }
    };

  return (
    <div className="flex min-h-screen flex-col">
       {/* Render header - potentially pass overrides if needed */}
       <Header propertyName={name} propertySlug={slug} />

      <main className="flex-grow">
         {/* Render homepage blocks based on template and visibility overrides */}
         {homepage.map(block => renderBlock(block))}
      </main>

       {/* Render footer - potentially pass overrides if needed */}
       <Footer />
    </div>
  );
}
