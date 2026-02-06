/**
 * @fileoverview Modern property page renderer supporting both multipage and homepage layouts
 * @module components/property/property-page-renderer
 * @description Unified rendering system for property pages with template-driven content,
 *              theme support, and enhanced homepage integration with full property data
 * 
 * @author Claude AI Assistant
 * @since 2025-06-06
 * @lastModified 2025-06-06
 * 
 * @dependencies
 * - React: Component architecture and hooks
 * - Next.js: Client-side rendering
 * - Theme system: Dynamic theme switching and preview
 * - Component library: All homepage and multipage block components
 * 
 * @usage
 * ```typescript
 * // Multipage rendering
 * <PropertyPageRenderer
 *   template={template}
 *   overrides={overrides}
 *   propertyName="Property Name"
 *   propertySlug="property-slug"
 *   pageName="details"
 * />
 * 
 * // Homepage rendering with full property integration
 * <PropertyPageRenderer
 *   template={template}
 *   overrides={overrides}
 *   propertyName="Property Name" 
 *   propertySlug="property-slug"
 *   pageName="homepage"
 *   property={fullPropertyObject}
 * />
 * ```
 * 
 * @components
 * Supports both modern and legacy component types:
 * - Modern: hero, experience, host, features, location, testimonials, gallery, cta
 * - Multipage: pageHeader, amenitiesList, roomsList, specificationsList, pricingTable, fullMap, etc.
 * - Legacy aliases: propertyDetailsSection→SpecificationsList, amenitiesSection→AmenitiesList,
 *   rulesSection→PoliciesList, mapSection→FullMap, contactSection→FullBookingForm
 * 
 * @performance
 * - Client-side only rendering to avoid hydration issues
 * - Error boundaries around each block to prevent cascading failures
 * - Lazy theme loading and URL-based theme preview
 * 
 * @testing
 * - Visual regression tests for consistent rendering
 * - Homepage property data integration tests
 * - Theme switching and preview functionality tests
 */

// src/components/property/property-page-renderer.tsx
"use client";

import { useEffect, useState } from 'react';
import { WebsiteTemplate, PropertyOverrides, BlockReference } from '@/lib/overridesSchemas-multipage';
import type { Property, Review } from '@/types';
import { blockSchemas } from '@/lib/overridesSchemas-multipage';
import { Header } from '@/components/generic-header-multipage';
import { Footer } from '@/components/footer';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { DEFAULT_THEME_ID, predefinedThemes } from '@/lib/themes/theme-definitions';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { ErrorBoundary } from '@/components/error-boundary';

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
import { useLanguage } from '@/hooks/useLanguage';

// Map of block types to their rendering components
const blockComponents: Record<string, React.FC<{ content: any; language?: string }>> = {
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
  
  // Legacy component aliases for backward compatibility
  propertyDetailsSection: SpecificationsList,
  amenitiesSection: AmenitiesList,
  rulesSection: PoliciesList,
  mapSection: FullMap,
  contactSection: FullBookingForm, // Legacy unused component
};

interface PropertyPageRendererProps {
  template: WebsiteTemplate;
  overrides: PropertyOverrides;
  propertyName: string;
  propertySlug: string;
  pageName: string; // Which page to render (e.g., homepage, details, etc.)
  themeId?: string; // The theme ID to use for this property
  language?: string; // The current language
  // Homepage-specific props for property data integration
  property?: Property; // Full property object for homepage rendering
  publishedReviews?: Review[]; // Real reviews from Firestore
}

export function PropertyPageRenderer({
  template,
  overrides,
  propertyName,
  propertySlug,
  pageName,
  themeId = DEFAULT_THEME_ID,
  language = 'en',
  property, // Homepage-specific property data
  publishedReviews, // Real reviews from Firestore
}: PropertyPageRendererProps) {
  const [isClient, setIsClient] = useState(false);
  const [effectiveThemeId, setEffectiveThemeId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  
  // Initialize state on client-side only to avoid hydration issues
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Handle theme selection based on URL parameter or prop
  useEffect(() => {
    if (!isClient) return;
    
    try {
      const url = new URL(window.location.href);
      const previewTheme = url.searchParams.get('preview_theme');
      
      if (previewTheme) {
        console.log(`[Theme Preview] Setting preview theme: ${previewTheme}`);
        
        // Validate that the theme exists
        const themeExists = predefinedThemes.some(t => t.id === previewTheme);
        if (themeExists) {
          setEffectiveThemeId(previewTheme);
          setIsPreviewMode(true);
        } else {
          console.error(`[Theme Error] Theme with ID "${previewTheme}" not found in predefined themes`);
          setEffectiveThemeId(themeId);
          setIsPreviewMode(false);
        }
      } else {
        console.log(`[Theme Preview] Using default theme: ${themeId}`);
        setEffectiveThemeId(themeId);
        setIsPreviewMode(false);
      }
    } catch (error) {
      console.error('[Theme Error]', error);
      setEffectiveThemeId(themeId);
      setIsPreviewMode(false);
    }
  }, [themeId, isClient]);
  
  // Log the current theme being used
  useEffect(() => {
    if (isClient && effectiveThemeId) {
      console.log(`[Theme Debug] Current theme ID: ${effectiveThemeId}`);
      console.log('[Theme Debug] Available themes:', predefinedThemes.map(t => t.id));
      
      // Log the theme object being used
      const theme = predefinedThemes.find(t => t.id === effectiveThemeId);
      console.log('[Theme Debug] Theme object:', theme);
    }
  }, [effectiveThemeId, isClient]);
  
  // Debug layout and spacing issues
  useEffect(() => {
    if (isClient && isPreviewMode) {
      // Run after a short delay to ensure elements are rendered
      setTimeout(() => {
        console.log('[Layout Debug] Checking layout elements...');
        
        // Check preview banner
        const banner = document.getElementById('theme-preview-banner');
        if (banner) {
          const bannerStyles = window.getComputedStyle(banner);
          console.log('[Layout Debug] Banner computed styles:', {
            marginTop: bannerStyles.marginTop,
            marginBottom: bannerStyles.marginBottom,
            paddingTop: bannerStyles.paddingTop,
            paddingBottom: bannerStyles.paddingBottom,
            height: bannerStyles.height,
            position: bannerStyles.position,
            display: bannerStyles.display,
          });
        }
        
        // Check main content
        const main = document.getElementById('main-content');
        if (main) {
          const mainStyles = window.getComputedStyle(main);
          console.log('[Layout Debug] Main content computed styles:', {
            marginTop: mainStyles.marginTop,
            paddingTop: mainStyles.paddingTop,
            position: mainStyles.position,
            display: mainStyles.display,
          });
          
          // Get the first child of main to check its styles
          if (main.firstElementChild) {
            const firstChildStyles = window.getComputedStyle(main.firstElementChild);
            console.log('[Layout Debug] First content block styles:', {
              marginTop: firstChildStyles.marginTop,
              paddingTop: firstChildStyles.paddingTop,
              element: main.firstElementChild.tagName,
              className: main.firstElementChild.className,
            });
          }
        }
        
        // Check header
        console.log('[Layout Debug] Adjacent elements:', {
          headerHeight: document.querySelector('header')?.getBoundingClientRect().height,
          bannerTop: banner?.getBoundingClientRect().top,
          mainTop: main?.getBoundingClientRect().top,
          viewportHeight: window.innerHeight,
        });
        
      }, 1000);
    }
  }, [isClient, isPreviewMode]);

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
        // Enhanced hero data for homepage with property integration
        const isHomepage = pageName === 'homepage';
        
        // For hero component, add property data needed for booking form
        blockContent = {
          ...blockContent,
          propertySlug: propertySlug,
          // Homepage-specific property data integration
          ...(isHomepage && property && {
            // Use property images for background if not explicitly overridden
            backgroundImage: blockContent.backgroundImage || 
                           property.images?.find(img => img.isFeatured)?.url || 
                           property.images?.[0]?.url || 
                           blockContent.backgroundImage,
            'data-ai-hint': blockContent['data-ai-hint'] || 
                          property.images?.find(img => img.isFeatured)?.['data-ai-hint'] || 
                          property.images?.[0]?.['data-ai-hint'],
          }),
          // Add property data if not already included
          bookingFormProperty: blockContent.bookingFormProperty || (property || {
            id: propertySlug,
            slug: propertySlug,
            name: propertyName,
            // Default values for booking form
            baseCurrency: (property as any)?.baseCurrency || 'EUR',
            baseRate: (property as any)?.pricePerNight || 150,
            advertisedRate: (property as any)?.advertisedRate || (property as any)?.pricePerNight || 150,
            advertisedRateType: (property as any)?.advertisedRateType || "from",
            minNights: (property as any)?.defaultMinimumStay || 2,
            maxNights: 14,
            maxGuests: (property as any)?.maxGuests || 6,
            ratings: (property as any)?.ratings
          }),
          // Add price if not already set
          price: blockContent.price !== undefined ? blockContent.price : ((property as any)?.pricePerNight || 150),
          // Only use showBookingForm value exactly as provided in Firestore
          showBookingForm: blockContent.showBookingForm, 
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
      } else if ((type === 'gallery' || type === 'galleryGrid' || type === 'full-gallery') && property?.images?.length) {
        // Fallback to property.images when gallery has no override images
        const existingImages = blockContent?.images;
        if (!existingImages || existingImages.length === 0) {
          const propertyGalleryImages = property.images.map((img) => ({
            url: img.url,
            alt: img.alt || '',
            'data-ai-hint': img['data-ai-hint'],
          }));
          blockContent = {
            ...blockContent,
            images: propertyGalleryImages,
          };
        }
      } else if (type === 'cta') {
        // For CTA buttons
        blockContent = {
          ...blockContent,
          propertySlug: propertySlug,
        };
      } else if (pageName === 'homepage' && property) {
        // Homepage-specific enhancements for other component types
        if (type === 'experience') {
          blockContent = {
            title: blockContent?.title || "Experience Our Property",
            description: blockContent?.description || "Discover the unique charm and comfort of your stay.",
            highlights: blockContent?.highlights || [],
            ...blockContent
          };
        } else if (type === 'host') {
          blockContent = {
            name: blockContent?.name || "Your Host",
            imageUrl: blockContent?.imageUrl || blockContent?.image || null,
            description: blockContent?.description || "We're delighted to welcome you!",
            backstory: blockContent?.backstory || "We strive to make your stay exceptional.",
            'data-ai-hint': blockContent?.['data-ai-hint'] || 'host portrait friendly',
            ...blockContent
          };
        } else if (type === 'location') {
          blockContent = {
            title: blockContent?.title || "Explore the Surroundings",
            propertyLocation: property.location,
            attractions: blockContent?.attractions || [],
            ...blockContent
          };
        } else if (type === 'testimonials') {
          // Convert real reviews to testimonials format
          const realReviews = publishedReviews?.map(r => ({
            name: r.guestName,
            date: typeof r.date === 'string' ? new Date(r.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : undefined,
            rating: r.rating,
            text: r.comment,
            source: r.source,
            sourceUrl: r.sourceUrl,
          })) || [];

          // Real reviews take priority, override reviews as fallback
          const overrideReviews = blockContent?.reviews || [];
          const combinedReviews = realReviews.length > 0 ? realReviews : overrideReviews;

          blockContent = {
            ...blockContent,
            title: blockContent?.title || "What Our Guests Say",
            overallRating: property.ratings?.average || 0,
            reviewCount: property.ratings?.count || 0,
            showRating: blockContent?.showRating,
            reviews: combinedReviews,
          };
        }
      }

      // Wrap each block in an error boundary to prevent one block from breaking entire page
      return (
        <div key={id} className="block-wrapper">
          <ErrorBoundary 
            fallback={
              <div className="p-3 m-2 bg-amber-50 border border-amber-200 rounded-md">
                <h3 className="text-amber-800 font-medium">Error rendering {type} component</h3>
                <p className="text-amber-700 text-sm mt-1">
                  This section encountered an error and could not be displayed.
                </p>
              </div>
            }
          >
            <Component key={id} content={blockContent} language={language} />
          </ErrorBoundary>
        </div>
      );
    } catch (error) {
      console.error(`Error preparing block ${id} of type ${type}:`, error);
      return (
        <div key={id} className="p-3 m-2 bg-red-50 border border-red-200 rounded-md">
          <h3 className="text-red-800 font-medium">Component Error</h3>
          <p className="text-red-700 text-sm mt-1">
            {error instanceof Error ? error.message : "Failed to prepare component data"}
          </p>
        </div>
      );
    }
  };

  if (!isClient) {
    return null; // Avoid hydration issues by not rendering anything on the server
  }

  // Check for development environment to only show ThemeSwitcher in development
  const isDev = process.env.NODE_ENV === 'development';
  
  // Don't render anything until client-side and theme is determined
  if (!isClient || !effectiveThemeId) {
    return <div className="min-h-screen flex items-center justify-center">Loading theme...</div>;
  }

  return (
    <ThemeProvider initialThemeId={effectiveThemeId}>
      <div className="flex min-h-screen flex-col">
        {/* Header with transparent overlay effect */}
        <Header 
          propertyName={propertyName} 
          propertySlug={propertySlug} 
          menuItems={menuItems}
          logoSrc={logoSrc}
          logoAlt={logoAlt}
        />
        
        {isPreviewMode && (
          <div 
            className="w-full bg-primary text-primary-foreground text-center text-sm py-2 px-4"
            id="theme-preview-banner"
          >
            <span className="font-medium">Theme Preview:</span> You are viewing the <strong className="font-semibold">{predefinedThemes.find(t => t.id === effectiveThemeId)?.name || effectiveThemeId}</strong> theme
            <div className="flex gap-2 justify-center mt-1">
              <button 
                onClick={() => window.location.reload()}
                className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-xs font-medium"
              >
                Reload Preview
              </button>
              <button 
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.delete('preview_theme');
                  window.location.href = url.toString();
                }}
                className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-xs font-medium"
              >
                Exit Preview
              </button>
            </div>
          </div>
        )}
        
        {/* Main Content - adjusted to work with the fixed header */}
        <main className="flex-grow" id="main-content">
          {templatePage.blocks.map(renderBlock)}
          
          {/* Only show theme switcher in development environment */}
          {isDev && <ThemeSwitcher />}
        </main>
        <Footer />
      </div>
    </ThemeProvider>
  );
}