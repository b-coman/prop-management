// src/components/property/property-page-layout.tsx
import Script from 'next/script'; // Import next/script
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
import { heroSchema, propertyOverridesSchema } from '@/lib/overridesSchemas'; 
import { z } from 'zod';


interface PropertyPageLayoutProps {
  property: Property;
  template: WebsiteTemplate;
  overrides: PropertyOverrides; 
}

export function PropertyPageLayout({ property, template, overrides }: PropertyPageLayoutProps) {
    const { slug, name, location, pricePerNight, ratings, amenities, checkInTime, checkOutTime, houseRules, analytics } = property;
    const { homepage = [], defaults = {} } = template;

    const validatedOverrides = propertyOverridesSchema.safeParse(overrides);
    const currentOverrides = validatedOverrides.success ? validatedOverrides.data : {};


    const visibleBlocks = currentOverrides?.visibleBlocks || homepage.map(b => b.id);

    const getMergedBlockData = (blockId: string, blockType: string): any => {
        const overrideData = currentOverrides?.[blockId as keyof PropertyOverrides];
        const defaultData = defaults?.[blockId];

        if (blockId === 'features' || blockId === 'attractions' || blockId === 'images') {
             return overrideData !== undefined ? overrideData : (defaultData || []);
        }
        if (blockId === 'testimonials') {
             const overrideReviews = (overrideData as PropertyOverrides['testimonials'])?.reviews;
             const defaultReviews = (defaultData as any)?.reviews; // defaultData can be complex
             return {
                 ...defaultData, // spread default first
                 ...overrideData, // then override
                 reviews: overrideReviews !== undefined ? overrideReviews : (defaultReviews || [])
             };
        }
         if (blockId === 'hero') {
            const mergedHero = { ...defaultData, ...overrideData } as z.infer<typeof heroSchema>;
             if ((overrideData as any)?.bookingForm || (defaultData as any)?.bookingForm) { // Cast to any to check bookingForm
                 mergedHero.bookingForm = {
                     ...(defaultData as any)?.bookingForm, // Cast to any
                     ...(overrideData as any)?.bookingForm, // Cast to any
                 };
             }
             return mergedHero;
        }
        // General case: override properties shadow default properties
        return { ...defaultData, ...overrideData };
    };
    
    const mergedHeroBlockContent = getMergedBlockData('hero', 'hero');
    const heroData = {
        // Content from hero block (override or default)
        backgroundImage: mergedHeroBlockContent?.backgroundImage || property.images?.find(img => img.isFeatured)?.url || property.images?.[0]?.url || null,
        'data-ai-hint': mergedHeroBlockContent?.['data-ai-hint'] || property.images?.find(img => img.isFeatured)?.['data-ai-hint'] || property.images?.[0]?.['data-ai-hint'],
        price: mergedHeroBlockContent?.price, // This is the hero block's specific price override/default
        showRating: mergedHeroBlockContent?.showRating,
        showBookingForm: mergedHeroBlockContent?.showBookingForm,
        title: mergedHeroBlockContent?.title,
        subtitle: mergedHeroBlockContent?.subtitle,
        bookingForm: mergedHeroBlockContent?.bookingForm,
        // Pass the entire property object for advertisedRate and other details
        bookingFormProperty: property, 
        // ratings from property will be used directly by HeroSection via bookingFormProperty
    };


    const mergedExperienceData = getMergedBlockData('experience', 'experience');
    const experienceData = {
        title: mergedExperienceData?.title || "Experience Our Property",
        description: mergedExperienceData?.description || "Discover the unique charm and comfort of your stay.",
        highlights: mergedExperienceData?.highlights || [],
    };

    const mergedHostData = getMergedBlockData('host', 'host');
    const hostData = {
        name: mergedHostData?.name || "Your Host",
        imageUrl: mergedHostData?.image || null,
        description: mergedHostData?.description || "We're delighted to welcome you!",
        backstory: mergedHostData?.backstory || "We strive to make your stay exceptional.",
        'data-ai-hint': mergedHostData?.['data-ai-hint'] || 'host portrait friendly',
    };

    const featuresData = getMergedBlockData('features', 'features');

    const mergedLocationData = getMergedBlockData('location', 'location');
    const attractionsData = getMergedBlockData('attractions', 'attractions');
    const locationHighlightsData = {
         title: mergedLocationData?.title || "Explore the Surroundings",
         propertyLocation: location,
         attractions: attractionsData,
    }

    const mergedTestimonialsData = getMergedBlockData('testimonials', 'testimonials');
    const testimonialsData = {
        title: mergedTestimonialsData?.title || "What Our Guests Say",
        overallRating: property.ratings?.average || 0,
        reviews: mergedTestimonialsData?.reviews || [],
    };

    const mergedCtaData = getMergedBlockData('cta', 'cta');
     const ctaData = {
        title: mergedCtaData?.title || "Ready for Your Getaway?",
        description: mergedCtaData?.description || "Book your stay today and create unforgettable memories.",
        buttonText: mergedCtaData?.buttonText || "Book Now",
        buttonUrl: mergedCtaData?.buttonUrl,
        propertySlug: slug,
        backgroundImage: mergedCtaData?.backgroundImage,
        'data-ai-hint': mergedCtaData?.['data-ai-hint'],
     };

    const galleryImagesData = getMergedBlockData('images', 'gallery'); // This gets ALL images from overrides or defaults.images
    // Filter out images tagged 'hero' if the hero section handles its own background
    const galleryImages = Array.isArray(galleryImagesData) ? galleryImagesData.filter((img: any) => !img.tags?.includes('hero')) : [];

    const mergedGalleryBlockContent = getMergedBlockData('gallery', 'gallery');
    const galleryData = {
         title: mergedGalleryBlockContent?.title || "Gallery",
         images: galleryImages, // Use the filtered list
         propertyName: name,
    }

    const renderBlock = (block: { id: string; type: string }) => {
        if (!visibleBlocks.includes(block.id)) {
            return null;
        }

        switch (block.type) {
            case 'hero':
                return <HeroSection key={block.id} heroData={heroData} />;
            case 'experience':
                 if (experienceData.title && experienceData.description && experienceData.highlights.length > 0) {
                    return <ExperienceSection key={block.id} title={experienceData.title} welcomeText={experienceData.description} highlights={experienceData.highlights} />;
                 }
                 return null;
            case 'host':
                 if (hostData.name && hostData.description) { 
                     return <HostIntroduction key={block.id} host={{name: hostData.name, welcomeMessage: hostData.description, backstory: hostData.backstory || "", imageUrl: hostData.imageUrl, 'data-ai-hint': hostData['data-ai-hint']}} />;
                 }
                 return null;
            case 'features':
                return featuresData.length > 0 ? <UniqueFeatures key={block.id} features={featuresData} /> : null;
             case 'location':
                 return locationHighlightsData.propertyLocation && locationHighlightsData.attractions.length > 0
                    ? <LocationHighlights key={block.id} {...locationHighlightsData} />
                    : null;
             case 'testimonials':
                  return testimonialsData.reviews.length > 0 ? <TestimonialsSection key={block.id} testimonials={testimonialsData} /> : null;
            case 'gallery':
                 return galleryData.images.length > 0 ? <GallerySection key={block.id} {...galleryData} /> : null;
            case 'details':
                return <PropertyDetailsSection key={block.id} property={property} />;
            case 'amenities':
                 return amenities && amenities.length > 0 ? <AmenitiesSection key={block.id} amenities={amenities} /> : null;
            case 'rules':
                 return houseRules || checkInTime || checkOutTime ? <RulesSection key={block.id} houseRules={houseRules} checkInTime={checkInTime} checkOutTime={checkOutTime} /> : null;
             case 'map':
                 return location ? <MapSection key={block.id} location={location} /> : null;
            case 'contact':
                 return <ContactSection key={block.id} />;
            case 'cta':
                 return <CallToActionSection key={block.id} {...ctaData} />;
            case 'separator':
                 return <Separator key={block.id} className="my-8 md:my-12" />;
            default:
                 console.warn(`Unknown block type "${block.type}" for block ID "${block.id}".`);
                return <div key={block.id}>Unsupported block type: {block.type}</div>;
        }
    };

  return (
    <div className="flex min-h-screen flex-col">
       {analytics?.enabled && analytics.googleAnalyticsId && (
        <>
          <Script
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${analytics.googleAnalyticsId}`}
          />
          <Script
            id={`ga-config-${property.slug}`} // Unique ID per property
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${analytics.googleAnalyticsId}', {
                  page_path: window.location.pathname,
                });
              `,
            }}
          />
        </>
      )}
       <Header propertyName={name} propertySlug={slug} />
      <main className="flex-grow">
         {homepage.map(block => renderBlock(block))}
      </main>
       <Footer />
    </div>
  );
}
