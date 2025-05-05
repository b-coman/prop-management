
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
    const { homepage = [], defaults = {} } = template; // Destructure defaults, provide empty object as fallback

    // Use overrides.visibleBlocks if present, otherwise default to all blocks from template
    const visibleBlocks = overrides?.visibleBlocks || homepage.map(b => b.id);

    // Helper function to get merged block data (override > default > empty)
    const getMergedBlockData = (blockId: string, blockType: string): any => {
        const overrideData = overrides?.[blockId as keyof PropertyOverrides];
        const defaultData = defaults?.[blockId];

        // Special handling for arrays like features, attractions, testimonials.reviews, images
        if (blockId === 'features' || blockId === 'attractions' || blockId === 'images') {
            // If overrides exist (even if empty array), use them. Otherwise, use defaults.
             return overrideData !== undefined ? overrideData : (defaultData || []);
        }
        if (blockId === 'testimonials') {
             // Testimonials override is an object { reviews: [...] }, default might be too
             const overrideReviews = (overrideData as PropertyOverrides['testimonials'])?.reviews;
             const defaultReviews = (defaultData as any)?.reviews; // Assuming default has same structure
             return {
                 title: (overrideData as any)?.title || defaultData?.title,
                 reviews: overrideReviews !== undefined ? overrideReviews : (defaultReviews || [])
             };
        }

        // For other block types (objects), merge overrides onto defaults
        return { ...defaultData, ...overrideData }; // Overrides take precedence
    };


    // Prepare data for each section, merging overrides with defaults and property data
    const mergedHeroData = getMergedBlockData('hero', 'hero');
    const heroData = {
        // Use override image if available, else default, else property featured, else first image
        backgroundImageUrl: mergedHeroData?.backgroundImage || property.images?.find(img => img.isFeatured)?.url || property.images?.[0]?.url || null,
        'data-ai-hint': mergedHeroData?.backgroundImage ? 'hero background' : property.images?.find(img => img.isFeatured)?.['data-ai-hint'] || property.images?.[0]?.['data-ai-hint'],
        pricePerNight: property.pricePerNight, // From property
        ratings: property.ratings, // From property
        bookingFormProperty: property, // Pass the whole property object to the form
         // title: mergedHeroData?.title, // Optionally use title/subtitle from merged data
         // subtitle: mergedHeroData?.subtitle,
    };

    const mergedExperienceData = getMergedBlockData('experience', 'experience');
    const experienceData = {
        title: mergedExperienceData?.title || "Experience Our Property",
        welcomeText: mergedExperienceData?.welcomeText || "Discover the unique charm and comfort of your stay.", // Use welcomeText key
        highlights: mergedExperienceData?.highlights || [],
    };

    const mergedHostData = getMergedBlockData('host', 'host');
    const hostData = {
        name: mergedHostData?.name || "Your Host",
        imageUrl: mergedHostData?.imageUrl || null,
        welcomeMessage: mergedHostData?.welcomeMessage || "We're delighted to welcome you!",
        backstory: mergedHostData?.backstory || "We strive to make your stay exceptional.",
        'data-ai-hint': mergedHostData?.['data-ai-hint'],
    };

    const featuresData = getMergedBlockData('features', 'features'); // Now gets array directly

    const mergedLocationData = getMergedBlockData('location', 'location');
    const attractionsData = getMergedBlockData('attractions', 'attractions'); // Now gets array directly
    const locationHighlightsData = {
         title: mergedLocationData?.title || "Explore the Surroundings", // Location block title
         propertyLocation: location, // From property
         attractions: attractionsData, // Use merged attractions
    }


    const mergedTestimonialsData = getMergedBlockData('testimonials', 'testimonials');
    const testimonialsData = {
        title: mergedTestimonialsData?.title || "What Our Guests Say",
        overallRating: property.ratings?.average || 0, // From property
        reviews: mergedTestimonialsData?.reviews || [], // Use merged reviews array
    };

    const mergedCtaData = getMergedBlockData('cta', 'cta');
     const ctaData = {
        title: mergedCtaData?.title || "Ready for Your Getaway?",
        description: mergedCtaData?.description || "Book your stay today and create unforgettable memories.",
        buttonText: mergedCtaData?.buttonText || "Book Now",
        buttonUrl: mergedCtaData?.buttonUrl, // Let the component handle default linking
        propertySlug: slug,
     };

    // Filter gallery images - exclude hero image if it's explicitly tagged
    const galleryImagesData = getMergedBlockData('images', 'gallery'); // Get gallery images array
    const galleryImages = galleryImagesData.filter((img: any) => !img.tags?.includes('hero'));
    const mergedGalleryData = getMergedBlockData('gallery', 'gallery');
    const galleryData = {
         title: mergedGalleryData?.title || "Gallery", // Get title from merged gallery data
         images: galleryImages,
         propertyName: name,
    }


    // Render logic: Iterate through template blocks and render if visible
    const renderBlock = (block: { id: string; type: string }) => {
        if (!visibleBlocks.includes(block.id)) {
            return null;
        }

        switch (block.type) {
            case 'hero':
                return <HeroSection key={block.id} {...heroData} />;
            case 'experience':
                 // Ensure required fields exist before rendering
                 if (experienceData.title && experienceData.welcomeText && experienceData.highlights.length > 0) {
                    return <ExperienceSection key={block.id} {...experienceData} />;
                 }
                 return null;
            case 'host':
                 // Only render host section if essential data exists
                 if (hostData.name && hostData.welcomeMessage && hostData.backstory) {
                     return <HostIntroduction key={block.id} host={hostData} />;
                 }
                 return null; // Don't render if host data is incomplete
            case 'features':
                return featuresData.length > 0 ? <UniqueFeatures key={block.id} features={featuresData} /> : null;
             case 'location':
                 // Render if propertyLocation and attractions exist
                 return locationHighlightsData.propertyLocation && locationHighlightsData.attractions.length > 0
                    ? <LocationHighlights key={block.id} {...locationHighlightsData} />
                    : null;
             case 'testimonials':
                  return testimonialsData.reviews.length > 0 ? <TestimonialsSection key={block.id} testimonials={testimonialsData} /> : null;
            case 'gallery':
                 return galleryData.images.length > 0 ? <GallerySection key={block.id} {...galleryData} /> : null;
            case 'details': // Assuming 'details' is a type defined in your template
                return <PropertyDetailsSection key={block.id} property={property} />;
            case 'amenities':
                 return amenities && amenities.length > 0 ? <AmenitiesSection key={block.id} amenities={amenities} /> : null;
            case 'rules':
                 return houseRules || checkInTime || checkOutTime ? <RulesSection key={block.id} houseRules={houseRules} checkInTime={checkInTime} checkOutTime={checkOutTime} /> : null;
             case 'map':
                 return location ? <MapSection key={block.id} location={location} /> : null;
            case 'contact':
                 return <ContactSection key={block.id} />; // Assuming contact doesn't need much dynamic data here
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
