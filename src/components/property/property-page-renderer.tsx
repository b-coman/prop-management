// src/components/property/property-page-renderer.tsx
"use client";

import { useEffect, useState } from 'react';
import { WebsiteTemplate, PropertyOverrides, BlockReference } from '@/lib/overridesSchemas-multipage';
import { blockSchemas } from '@/lib/overridesSchemas-multipage';
import { Header } from '@/components/generic-header-multipage';
import { Footer } from '@/components/footer';

// Import all the block components
import { HeroSection } from '@/components/homepage/hero-section';
import { ExperienceSection } from '@/components/homepage/experience-section';
import { HostIntroduction } from '@/components/homepage/host-introduction';
import { UniqueFeatures } from '@/components/homepage/unique-features';
import { LocationHighlights } from '@/components/homepage/location-highlights';
import { TestimonialsSection } from '@/components/homepage/testimonials-section';
import { GallerySection } from '@/components/property/gallery-section';
import { CallToActionSection } from '@/components/homepage/call-to-action';

// Import the actual components
import { PageHeader } from '@/components/property/page-header';
import { AmenitiesList } from '@/components/property/amenities-list';
import { RoomsList } from '@/components/property/rooms-list';
import { SpecificationsList } from '@/components/property/specifications-list';
import { PricingTable } from '@/components/property/pricing-table';
import { FullMap } from '@/components/property/full-map';
import { AttractionsList } from '@/components/property/attractions-list';
import { TransportOptions } from '@/components/property/transport-options';
import { DistancesList } from '@/components/property/distances-list';
import { GalleryGrid } from '@/components/property/gallery-grid';
import { PhotoCategories } from '@/components/property/photo-categories';
import { FullBookingForm } from '@/components/property/full-booking-form';
import { PoliciesList } from '@/components/property/policies-list';

// Map of block types to their rendering components
const blockComponents: Record<string, React.FC<{ content: any }>> = {
  // Existing homepage components
  hero: HeroSection,
  experience: ExperienceSection,
  host: HostIntroduction,
  features: UniqueFeatures,
  location: LocationHighlights,
  testimonials: TestimonialsSection,
  gallery: GallerySection,
  cta: CallToActionSection,

  // New multi-page components
  pageHeader: PageHeader,
  amenitiesList: AmenitiesList,
  roomsList: RoomsList,
  specificationsList: SpecificationsList,
  pricingTable: PricingTable,
  fullMap: FullMap,
  attractionsList: AttractionsList,
  transportOptions: TransportOptions,
  distancesList: DistancesList,
  galleryGrid: GalleryGrid,
  "full-gallery": GalleryGrid, // Alias for the full-gallery block ID
  photoCategories: PhotoCategories,
  fullBookingForm: FullBookingForm,
  policiesList: PoliciesList,
};

interface PropertyPageRendererProps {
  template: WebsiteTemplate;
  overrides: PropertyOverrides;
  propertyName: string;
  propertySlug: string;
  pageName: string; // Which page to render (e.g., homepage, details, etc.)
}

export function PropertyPageRenderer({
  template,
  overrides,
  propertyName,
  propertySlug,
  pageName,
}: PropertyPageRendererProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Check if template has pages
  if (!template.pages) {
    console.error("Template is missing pages structure", template);
    return <div>Template is missing pages structure</div>;
  }

  // If pageName doesn't exist in the template, fallback to homepage
  const templatePage = template.pages[pageName] || template.pages.homepage;
  if (!templatePage) {
    console.error(`Page ${pageName} not found in template and homepage not defined`);
    return <div>Page not found</div>;
  }

  // Check if the page is visible in overrides
  // Default to show the page if visiblePages is not defined
  if (overrides.visiblePages && !overrides.visiblePages.includes(pageName)) {
    console.warn(`Page ${pageName} is not in the visible pages list: ${overrides.visiblePages.join(', ')}`);
    return <div>Page not available</div>;
  }

  // Get visible blocks for this page
  const pageOverrides = overrides[pageName] as Record<string, any> || {};
  const visibleBlocks = pageOverrides.visibleBlocks || templatePage.blocks.map(block => block.id);

  // Menu items - use overrides if available, otherwise use template defaults
  const menuItems = overrides.menuItems || template.header.menuItems;

  // Logo - use template defaults
  const logoSrc = template.header.logo?.src;
  const logoAlt = template.header.logo?.alt;

  // Render function for a specific block
  const renderBlock = (block: BlockReference) => {
    if (!block) {
      console.warn(`Received undefined block in renderBlock`);
      return null;
    }

    const { id, type } = block;

    if (!id || !type) {
      console.warn(`Block is missing id or type: ${JSON.stringify(block)}`);
      return null;
    }

    const Component = blockComponents[type];

    if (!Component) {
      console.warn(`No component found for block type: ${type}`);
      return null;
    }

    if (!visibleBlocks.includes(id)) {
      return null; // Skip if not in visible blocks
    }

    try {
      // Get content for the block - first check in page overrides
      let blockContent = pageOverrides && pageOverrides[id];

      // If not found in overrides, use default from template
      if (blockContent === undefined && template.defaults) {
        blockContent = template.defaults[id];
      }

      // If still undefined, skip rendering
      if (blockContent === undefined) {
        console.warn(`No content found for block: ${id}`);
        return null;
      }

      // For components that need property data, add it to the content
      if (type === 'hero') {
        // For hero component, add property data needed for booking form
        blockContent = {
          ...blockContent,
          propertySlug: propertySlug,
          // Add property data if not already included
          bookingFormProperty: blockContent.bookingFormProperty || {
            id: propertySlug,
            slug: propertySlug,
            name: propertyName,
            // Default values for booking form
            baseCurrency: 'EUR',
            baseRate: 150, // Default price per night
            advertisedRate: 150, // Default advertised rate
            advertisedRateType: "from",
            minNights: 2,
            maxNights: 14,
            maxGuests: 6
          },
          // Add price if not already set
          price: blockContent.price !== undefined ? blockContent.price : 150,
          showBookingForm: blockContent.showBookingForm !== false, // Default to true
        };
      } else if (type === 'fullBookingForm') {
        // For the full booking form, add property data
        blockContent = {
          ...blockContent,
          propertySlug: propertySlug,
          property: {
            id: propertySlug,
            slug: propertySlug,
            name: propertyName,
            baseCurrency: 'EUR',
            baseRate: 150, // Default price per night
            advertisedRate: 150, // Default advertised rate
            advertisedRateType: "from",
            minNights: 2,
            maxNights: 14,
            maxGuests: 6
          }
        };
      } else if (type === 'cta') {
        // For CTA buttons
        blockContent = {
          ...blockContent,
          propertySlug: propertySlug,
        };
      }

      return <Component key={id} content={blockContent} />;
    } catch (error) {
      console.error(`Error rendering block ${id} of type ${type}:`, error);
      return null;
    }
  };

  if (!isClient) {
    return null; // Avoid hydration issues by not rendering anything on the server
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header 
        propertyName={propertyName} 
        propertySlug={propertySlug} 
        menuItems={menuItems}
        logoSrc={logoSrc}
        logoAlt={logoAlt}
      />
      <main className="flex-grow pt-16">
        {templatePage.blocks.map(renderBlock)}
      </main>
      <Footer />
    </div>
  );
}