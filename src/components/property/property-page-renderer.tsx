// src/components/property/property-page-renderer.tsx
"use client";

import { useEffect, useState } from 'react';
import { WebsiteTemplate, PropertyOverrides, BlockReference } from '@/lib/overridesSchemas-multipage';
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
};

interface PropertyPageRendererProps {
  template: WebsiteTemplate;
  overrides: PropertyOverrides;
  propertyName: string;
  propertySlug: string;
  pageName: string; // Which page to render (e.g., homepage, details, etc.)
  themeId?: string; // The theme ID to use for this property
  language?: string; // The current language
}

export function PropertyPageRenderer({
  template,
  overrides,
  propertyName,
  propertySlug,
  pageName,
  themeId = DEFAULT_THEME_ID,
  language = 'en',
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
      } else if (type === 'cta') {
        // For CTA buttons
        blockContent = {
          ...blockContent,
          propertySlug: propertySlug,
        };
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