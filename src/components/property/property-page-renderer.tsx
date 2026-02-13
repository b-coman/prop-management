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
import type { Property, Review, RichReview } from '@/types';
import { blockSchemas } from '@/lib/overridesSchemas-multipage';
import { Header } from '@/components/generic-header-multipage';
import { Footer } from '@/components/footer';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { DEFAULT_THEME_ID, predefinedThemes, getThemeById } from '@/lib/themes/theme-definitions';
import { themeToInlineStyles } from '@/lib/themes/theme-utils';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { ErrorBoundary } from '@/components/error-boundary';
import { useCurrency } from '@/contexts/CurrencyContext';

// Import all the block components
import { HeroSection } from '@/components/homepage/hero-section';
import { ExperienceSection } from '@/components/homepage/experience-section';
import { HostIntroduction } from '@/components/homepage/host-introduction';
import { UniqueFeatures } from '@/components/homepage/unique-features';
import { LocationHighlights } from '@/components/homepage/location-highlights';
import { TestimonialsSection } from '@/components/homepage/testimonials-section';
import { GallerySection } from '@/components/property/gallery-section';
import { CallToActionSection } from '@/components/homepage/call-to-action';
import { VideoSection } from '@/components/homepage/video-section';

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
import { AreaGuideSection } from '@/components/property/area-guide-section';
import { ReviewsListSection } from '@/components/property/reviews-list-section';
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
  video: VideoSection,
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
  areaGuideContent: AreaGuideSection,
  reviewsList: ReviewsListSection,

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
  allReviews?: RichReview[]; // All published reviews with rich metadata (for reviews page)
  localBlurMap?: Record<string, string>; // Blur placeholders for local images
  isCustomDomain?: boolean; // Whether the request came through a custom domain
}

// Look up blur data URL for a local image path
function lookupBlur(blurMap: Record<string, string> | undefined, imagePath: string | null | undefined): string | undefined {
  if (!imagePath || !blurMap) return undefined;
  return blurMap[imagePath];
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
  allReviews, // All published reviews with rich metadata (for reviews page)
  localBlurMap,
  isCustomDomain = false,
}: PropertyPageRendererProps) {
  const { tc } = useLanguage();
  const { setDefaultCurrency } = useCurrency();
  const [effectiveThemeId, setEffectiveThemeId] = useState<string>(themeId);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Set default currency from property's baseCurrency (only if user hasn't explicitly chosen)
  useEffect(() => {
    if (property?.baseCurrency) {
      setDefaultCurrency(property.baseCurrency);
    }
  }, [property?.baseCurrency, setDefaultCurrency]);

  // Handle theme preview from URL parameter (client-only)
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const previewTheme = url.searchParams.get('preview_theme');
      if (previewTheme) {
        const themeExists = predefinedThemes.some(t => t.id === previewTheme);
        if (themeExists) {
          setEffectiveThemeId(previewTheme);
          setIsPreviewMode(true);
        }
      }
    } catch (error) {
      // Preview theme is non-critical, ignore errors
    }
  }, [themeId]);
  
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
  const logoAlt = template.header.logo?.alt ? tc(template.header.logo.alt) : undefined;

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
      // Get content for the block - merge template defaults with page overrides
      // Template defaults are keyed by block id or block type
      const templateDefault = template.defaults
        ? (template.defaults[id] ?? template.defaults[type] ?? undefined)
        : undefined;
      const pageOverride = pageOverrides && pageOverrides[id];

      // Merge: template defaults as base, page overrides on top
      let blockContent = templateDefault && pageOverride
        ? { ...templateDefault, ...pageOverride }
        : pageOverride ?? templateDefault;

      // Blocks that get their content from enrichment (server-side data injection)
      // should not be skipped even when no template defaults or overrides exist
      const enrichedBlockTypes = ['reviewsList'];
      if (blockContent === undefined && enrichedBlockTypes.includes(type)) {
        blockContent = {};
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
          // Blur placeholder for hero background image (local images)
          backgroundImageBlur: lookupBlur(localBlurMap, blockContent.backgroundImage),
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
      } else if (type === 'specificationsList' && property) {
        // Auto-populate specifications from property data when override has none
        const existingSpecs = blockContent?.specifications;
        if (!existingSpecs || existingSpecs.length === 0) {
          const autoSpecs: Array<{ name: string | Record<string, string>; value: string | Record<string, string> }> = [];
          if (property.bedrooms) autoSpecs.push({ name: { en: 'Bedrooms', ro: 'Dormitoare' }, value: String(property.bedrooms) });
          if (property.beds) autoSpecs.push({ name: { en: 'Beds', ro: 'Paturi' }, value: String(property.beds) });
          if (property.bathrooms) autoSpecs.push({ name: { en: 'Bathrooms', ro: 'Băi' }, value: String(property.bathrooms) });
          if (property.squareFeet) {
            const isMetric = property.baseCurrency === 'EUR' || property.baseCurrency === 'RON';
            const areaValue = isMetric ? `${Math.round(property.squareFeet / 10.764)} m²` : `${property.squareFeet} sqft`;
            autoSpecs.push({ name: { en: 'Area', ro: 'Suprafață' }, value: areaValue });
          }
          if (property.maxGuests) autoSpecs.push({ name: { en: 'Max Guests', ro: 'Oaspeți max.' }, value: String(property.maxGuests) });
          if (property.checkInTime) autoSpecs.push({ name: { en: 'Check-in', ro: 'Check-in' }, value: property.checkInTime });
          if (property.checkOutTime) autoSpecs.push({ name: { en: 'Check-out', ro: 'Check-out' }, value: property.checkOutTime });
          blockContent = {
            ...blockContent,
            specifications: autoSpecs,
          };
        }
      } else if (type === 'policiesList' && property) {
        // Auto-populate policies from property data when override has none
        const existingPolicies = blockContent?.policies;
        if (!existingPolicies || existingPolicies.length === 0) {
          const autoPolicies: Array<{ title: string | Record<string, string>; description: string | Record<string, string> }> = [];
          if (property.checkInTime || property.checkOutTime) {
            autoPolicies.push({
              title: { en: 'Check-in / Check-out', ro: 'Check-in / Check-out' },
              description: {
                en: `Check-in: ${property.checkInTime || 'Flexible'}\nCheck-out: ${property.checkOutTime || 'Flexible'}`,
                ro: `Check-in: ${property.checkInTime || 'Flexibil'}\nCheck-out: ${property.checkOutTime || 'Flexibil'}`,
              },
            });
          }
          if (property.cancellationPolicy) {
            const cp = property.cancellationPolicy;
            autoPolicies.push({
              title: { en: 'Cancellation Policy', ro: 'Politica de anulare' },
              description: { en: cp.en, ro: cp.ro || cp.en },
            });
          }
          if (property.houseRules && property.houseRules.length > 0) {
            autoPolicies.push({
              title: { en: 'House Rules', ro: 'Regulile casei' },
              description: {
                en: property.houseRules.map(r => typeof r === 'string' ? r : (r.en || '')).join('\n'),
                ro: property.houseRules.map(r => typeof r === 'string' ? r : (r.ro || r.en || '')).join('\n'),
              },
            });
          }
          if (autoPolicies.length > 0) {
            blockContent = {
              ...blockContent,
              policies: autoPolicies,
            };
          }
        }
      } else if (type === 'fullMap') {
        // Map data priority: explicit page override > property.location > template default
        // pageOverride has explicit admin edits; templateDefault has generic placeholders
        const loc = property?.location;
        const hasExplicitCoords = pageOverride?.coordinates?.lat && pageOverride?.coordinates?.lng;
        const hasExplicitAddress = pageOverride?.address;
        const hasPropertyCoords = loc?.coordinates?.latitude && loc?.coordinates?.longitude;

        // Build address from property location fields
        const propertyAddress = loc
          ? (loc.address
            ? { en: `${loc.address}, ${loc.city || ''}`.replace(/,\s*$/, ''), ro: `${loc.address}, ${loc.city || ''}`.replace(/,\s*$/, '') }
            : { en: `${loc.city || ''}, ${loc.country || ''}`.replace(/^,\s*|,\s*$/g, ''), ro: `${loc.city || ''}, ${loc.country || ''}`.replace(/^,\s*|,\s*$/g, '') })
          : undefined;

        // Coordinates: admin override wins, then property doc, then template default
        const coordinates = hasExplicitCoords
          ? pageOverride.coordinates
          : (hasPropertyCoords && loc?.coordinates)
            ? { lat: loc.coordinates.latitude, lng: loc.coordinates.longitude }
            : blockContent?.coordinates;

        // Address: admin override wins, then property doc, then template default
        const address = hasExplicitAddress
          ? pageOverride.address
          : propertyAddress || blockContent?.address;

        blockContent = {
          ...blockContent,
          coordinates,
          address,
        };
      } else if ((type === 'gallery' || type === 'galleryGrid' || type === 'full-gallery') && property?.images?.length) {
        // Fallback to property.images when gallery has no override images
        const existingImages = blockContent?.images;
        const hasRealImages = existingImages?.length > 0 &&
          existingImages.some((img: any) => !img.url?.startsWith('/images/templates/'));
        if (!hasRealImages) {
          // Filter out images hidden from gallery, then sort: featured first, by sortOrder
          const galleryVisible = property.images.filter(img => img.showInGallery !== false);
          const sorted = [...galleryVisible].sort((a, b) => {
            if (a.isFeatured && !b.isFeatured) return -1;
            if (!a.isFeatured && b.isFeatured) return 1;
            return (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
          });
          const propertyGalleryImages = sorted.map((img) => ({
            url: img.url,
            alt: img.alt || '',
            'data-ai-hint': img['data-ai-hint'],
            blurDataURL: img.blurDataURL,
            tags: img.tags,
          }));
          blockContent = {
            ...blockContent,
            images: propertyGalleryImages,
          };
        }
        // Process viewAllUrl for proper routing (same pattern as CTA buttonUrl)
        if (blockContent?.viewAllUrl) {
          const rawUrl = blockContent.viewAllUrl;
          blockContent = {
            ...blockContent,
            viewAllUrl: (!rawUrl.startsWith('http') && !isCustomDomain)
              ? `/properties/${propertySlug}${rawUrl}`
              : rawUrl,
          };
        }
      } else if (type === 'cta') {
        // For CTA buttons — process buttonUrl for proper routing
        const rawUrl = blockContent?.buttonUrl || '/booking';
        const processedUrl = (!rawUrl.startsWith('http') && !isCustomDomain)
          ? `/properties/${propertySlug}${rawUrl}`
          : rawUrl;
        blockContent = {
          ...blockContent,
          propertySlug: propertySlug,
          buttonUrl: processedUrl,
        };
      }

      // Enrich local image paths with blur data (applies to all pages)
      if (localBlurMap) {
        if (type === 'attractionsList' && blockContent?.attractions) {
          blockContent = {
            ...blockContent,
            attractions: blockContent.attractions.map((a: any) => ({
              ...a,
              blurDataURL: a.blurDataURL || lookupBlur(localBlurMap, a.image),
            })),
          };
        } else if (type === 'features') {
          const features = blockContent?.features || (Array.isArray(blockContent) ? blockContent : []);
          if (features.length > 0) {
            const enriched = features.map((f: any) => ({
              ...f,
              blurDataURL: f.blurDataURL || lookupBlur(localBlurMap, f.image),
            }));
            blockContent = Array.isArray(blockContent) ? enriched : { ...blockContent, features: enriched };
          }
        } else if (type === 'photoCategories' && blockContent?.categories) {
          blockContent = {
            ...blockContent,
            categories: blockContent.categories.map((cat: any) => ({
              ...cat,
              thumbnailBlur: lookupBlur(localBlurMap, cat.thumbnail),
              images: (cat.images || []).map((img: any) => ({
                ...img,
                blurDataURL: img.blurDataURL || lookupBlur(localBlurMap, img.url),
              })),
            })),
          };
        }
      }

      if (pageName === 'homepage' && property) {
        // Homepage-specific enhancements for other component types
        if (type === 'experience') {
          blockContent = {
            title: blockContent?.title || { en: "Experience Our Property", ro: "Experimentați proprietatea noastră" },
            description: blockContent?.description || { en: "Discover the unique charm and comfort of your stay.", ro: "Descoperiți farmecul unic și confortul sejurului dumneavoastră." },
            highlights: blockContent?.highlights || [],
            ...blockContent
          };
        } else if (type === 'host') {
          blockContent = {
            name: blockContent?.name || { en: "Your Host", ro: "Gazda dumneavoastră" },
            imageUrl: blockContent?.imageUrl || blockContent?.image || null,
            description: blockContent?.description || { en: "We're delighted to welcome you!", ro: "Suntem încântați să vă primim!" },
            backstory: blockContent?.backstory || { en: "We strive to make your stay exceptional.", ro: "Ne străduim să facem sejurul dumneavoastră excepțional." },
            'data-ai-hint': blockContent?.['data-ai-hint'] || 'host portrait friendly',
            ...blockContent
          };
        } else if (type === 'location') {
          // Auto-populate homepage attractions from location page overrides if none exist
          let homepageAttractions = blockContent?.attractions || [];
          let isCompactPreview = false;
          if (homepageAttractions.length === 0) {
            const locationPageOverrides = overrides.location as Record<string, any> | undefined;
            // Look for attractions in any block of the location page overrides
            if (locationPageOverrides) {
              for (const [, blockVal] of Object.entries(locationPageOverrides)) {
                if (blockVal?.attractions && Array.isArray(blockVal.attractions) && blockVal.attractions.length > 0) {
                  homepageAttractions = blockVal.attractions.slice(0, 3);
                  isCompactPreview = true;
                  break;
                }
              }
            }
          }
          // Enrich attractions with blur data for local images
          if (localBlurMap) {
            homepageAttractions = homepageAttractions.map((a: any) => ({
              ...a,
              blurDataURL: lookupBlur(localBlurMap, a.image),
            }));
          }
          blockContent = {
            ...blockContent,
            title: blockContent?.title || { en: "Explore the Surroundings", ro: "Explorează împrejurimile" },
            propertyLocation: property.location,
            attractions: homepageAttractions,
            compactPreview: isCompactPreview,
            locationPageUrl: isCompactPreview
              ? (isCustomDomain ? '/location' : `/properties/${propertySlug}/location`)
              : undefined,
          };
        } else if (type === 'testimonials') {
          // Convert date from various Firestore formats (string, Timestamp, Date)
          const convertReviewDate = (d: any): string | undefined => {
            if (!d) return undefined;
            if (typeof d === 'string') return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
            if (d._seconds) return new Date(d._seconds * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
            if (d instanceof Date) return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
            return undefined;
          };

          // Convert real reviews to testimonials format
          const realReviews = publishedReviews?.map(r => ({
            name: r.guestName,
            date: convertReviewDate(r.date),
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
            title: blockContent?.title || { en: "What Our Guests Say", ro: "Ce spun oaspeții noștri" },
            overallRating: property.ratings?.average || 0,
            reviewCount: property.ratings?.count || 0,
            showRating: blockContent?.showRating,
            reviews: combinedReviews,
            propertySlug: propertySlug,
            isCustomDomain,
          };
        }
      }

      // Reviews page enrichment — inject all reviews and compute aggregate stats
      if (type === 'reviewsList' && allReviews) {
        const ratingDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        const sourceCounts: Record<string, number> = {};
        let totalRating = 0;
        for (const r of allReviews) {
          const star = Math.min(5, Math.max(1, Math.floor(r.rating)));
          ratingDist[star] = (ratingDist[star] || 0) + 1;
          sourceCounts[r.source] = (sourceCounts[r.source] || 0) + 1;
          totalRating += r.rating;
        }
        blockContent = {
          ...blockContent,
          reviews: allReviews,
          aggregateStats: {
            totalCount: allReviews.length,
            averageRating: allReviews.length > 0 ? Math.round((totalRating / allReviews.length) * 10) / 10 : 0,
            ratingDistribution: ratingDist,
            sourceBreakdown: sourceCounts,
          },
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

  // Check for development environment to only show ThemeSwitcher in development
  const isDev = process.env.NODE_ENV === 'development';

  // Resolve theme and generate inline CSS variables for SSR
  const theme = getThemeById(effectiveThemeId);
  const themeStyles = themeToInlineStyles(theme);

  // Preload theme font stylesheet in SSR to prevent CLS from font swap.
  // React 19 / Next.js 15 hoists <link> with `precedence` to <head> and deduplicates.
  const fontUrl = theme.typography.fontFamilyUrl;

  return (
    <ThemeProvider initialThemeId={effectiveThemeId}>
      {fontUrl && <link rel="stylesheet" href={fontUrl} precedence="default" />}
      <div style={themeStyles} className="flex min-h-screen flex-col">
        {/* Header with transparent overlay effect */}
        <Header
          propertyName={propertyName}
          propertySlug={propertySlug}
          menuItems={menuItems}
          logoSrc={logoSrc}
          logoAlt={logoAlt}
          isCustomDomain={isCustomDomain}
          advertisedRate={(property as any)?.advertisedRate || (property as any)?.pricePerNight}
          advertisedRateType={(property as any)?.advertisedRateType}
          baseCurrency={(property as any)?.baseCurrency}
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
        <Footer
          quickLinks={overrides.footer?.quickLinks || template.footer?.quickLinks}
          contactInfo={
            overrides.footer?.contactInfo ||
            template.footer?.contactInfo ||
            (property?.contactPhone || property?.contactEmail
              ? { phone: property.contactPhone, email: property.contactEmail }
              : undefined)
          }
          socialLinks={overrides.footer?.socialLinks}
          propertyName={propertyName}
          propertySlug={propertySlug}
          isCustomDomain={isCustomDomain}
        />
      </div>
    </ThemeProvider>
  );
}