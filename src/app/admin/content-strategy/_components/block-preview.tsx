'use client';

import { ErrorBoundary } from '@/components/error-boundary';

// Block components (same as property-page-renderer.tsx)
import { HeroSection } from '@/components/homepage/hero-section';
import { ExperienceSection } from '@/components/homepage/experience-section';
import { HostIntroduction } from '@/components/homepage/host-introduction';
import { UniqueFeatures } from '@/components/homepage/unique-features';
import { LocationHighlights } from '@/components/homepage/location-highlights';
import { TestimonialsSection } from '@/components/homepage/testimonials-section';
import { GallerySection } from '@/components/property/gallery-section';
import { CallToActionSection } from '@/components/homepage/call-to-action';
import { VideoSection } from '@/components/homepage/video-section';
import { PageHeader } from '@/components/property/page-header';
import { AmenitiesList } from '@/components/property/amenities-list';
import { RoomsList } from '@/components/property/rooms-list';
import { SpecificationsList } from '@/components/property/specifications-list';
import { PricingTable } from '@/components/property/pricing-table';
import { AttractionsList } from '@/components/property/attractions-list';
import { TransportOptions } from '@/components/property/transport-options';
import { DistancesList } from '@/components/property/distances-list';
import { AreaGuideSection } from '@/components/property/area-guide-section';
import { PoliciesList } from '@/components/property/policies-list';
import { LegalContent } from '@/components/property/legal-content';

/* eslint-disable @typescript-eslint/no-explicit-any */
const blockComponents: Record<string, React.FC<{ content: any; language?: string }>> = {
  hero: HeroSection,
  experience: ExperienceSection,
  host: HostIntroduction,
  features: UniqueFeatures,
  location: LocationHighlights,
  testimonials: TestimonialsSection,
  gallery: GallerySection,
  video: VideoSection,
  cta: CallToActionSection,
  pageHeader: PageHeader,
  amenitiesList: AmenitiesList,
  roomsList: RoomsList,
  specificationsList: SpecificationsList,
  pricingTable: PricingTable,
  attractionsList: AttractionsList,
  transportOptions: TransportOptions,
  distancesList: DistancesList,
  areaGuideContent: AreaGuideSection,
  policiesList: PoliciesList,
  legalContent: LegalContent,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

interface BlockPreviewProps {
  blockType: string;
  content: Record<string, unknown>;
}

export function BlockPreview({ blockType, content }: BlockPreviewProps) {
  const Component = blockComponents[blockType];

  if (!Component) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8 border rounded-lg bg-muted/50">
        No preview available for block type &ldquo;{blockType}&rdquo;.
        Switch to JSON view to see the raw content.
      </div>
    );
  }

  return (
    <ErrorBoundary
      fallback={
        <div className="text-sm text-destructive text-center py-8 border border-destructive/20 rounded-lg bg-destructive/5">
          Preview failed to render. The content may not match the expected block schema.
          Switch to JSON view to inspect the data.
        </div>
      }
    >
      <div className="border rounded-lg overflow-hidden bg-background">
        <Component content={content as any} />
      </div>
    </ErrorBoundary>
  );
}
