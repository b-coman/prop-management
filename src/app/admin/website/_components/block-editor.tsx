'use client';

import { HeroForm } from './block-forms/hero-form';
import { ExperienceForm } from './block-forms/experience-form';
import { HostForm } from './block-forms/host-form';
import { FeaturesForm } from './block-forms/features-form';
import { LocationHighlightsForm } from './block-forms/location-highlights-form';
import { TestimonialsForm } from './block-forms/testimonials-form';
import { GalleryForm } from './block-forms/gallery-form';
import { CtaForm } from './block-forms/cta-form';
import { PageHeaderForm } from './block-forms/page-header-form';
import { AmenitiesForm } from './block-forms/amenities-form';
import { RoomsForm } from './block-forms/rooms-form';
import { SpecificationsForm } from './block-forms/specifications-form';
import { MapForm } from './block-forms/map-form';
import { AttractionsForm } from './block-forms/attractions-form';
import { TransportForm } from './block-forms/transport-form';
import { DistancesForm } from './block-forms/distances-form';
import { GalleryGridForm } from './block-forms/gallery-grid-form';
import { BookingFormConfig } from './block-forms/booking-form-config';
import { PoliciesForm } from './block-forms/policies-form';
import { VideoForm } from './block-forms/video-form';
import { AreaGuideForm } from './block-forms/area-guide-form';

interface BlockEditorProps {
  blockId: string;
  blockType: string;
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  propertySlug: string;
  propertyImages: Array<{ url: string; alt?: string; thumbnailUrl?: string }>;
}

const FORM_COMPONENTS: Record<string, React.ComponentType<{
  content: Record<string, unknown>;
  onChange: (content: Record<string, unknown>) => void;
  propertySlug: string;
  propertyImages: Array<{ url: string; alt?: string; thumbnailUrl?: string }>;
}>> = {
  hero: HeroForm,
  experience: ExperienceForm,
  host: HostForm,
  features: FeaturesForm,
  location: LocationHighlightsForm,
  testimonials: TestimonialsForm,
  gallery: GalleryForm,
  cta: CtaForm,
  pageHeader: PageHeaderForm,
  amenitiesList: AmenitiesForm,
  roomsList: RoomsForm,
  specificationsList: SpecificationsForm,
  fullMap: MapForm,
  attractionsList: AttractionsForm,
  transportOptions: TransportForm,
  distancesList: DistancesForm,
  galleryGrid: GalleryGridForm,
  fullBookingForm: BookingFormConfig,
  policiesList: PoliciesForm,
  video: VideoForm,
  areaGuideContent: AreaGuideForm,
};

// Check if block content is essentially empty (only has _hidden or no real values)
function isContentEmpty(content: Record<string, unknown>): boolean {
  const keys = Object.keys(content).filter((k) => k !== '_hidden');
  return keys.length === 0;
}

export function BlockEditor({
  blockType,
  content,
  onChange,
  propertySlug,
  propertyImages,
}: BlockEditorProps) {
  const FormComponent = FORM_COMPONENTS[blockType];

  if (!FormComponent) {
    return (
      <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
        No editor available for block type: <code className="font-mono">{blockType}</code>
      </div>
    );
  }

  const empty = isContentEmpty(content);

  return (
    <div>
      {empty && (
        <p className="text-xs text-muted-foreground mb-4 bg-muted/50 rounded-md px-3 py-2">
          This block has no custom content yet. Fill in the fields below or use &ldquo;Initialize from Template&rdquo; to start with defaults.
        </p>
      )}
      <FormComponent
        content={content}
        onChange={onChange}
        propertySlug={propertySlug}
        propertyImages={propertyImages}
      />
    </div>
  );
}
