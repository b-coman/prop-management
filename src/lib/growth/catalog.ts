/**
 * Client-safe catalogs for the campaigns admin UI: audience segments and
 * message templates. Pure data (no server imports) so it can be imported by
 * client components. The server side (actions.ts) maps a segment key to a
 * SegmentDefinition via PREDEFINED_SEGMENTS.
 */
export interface SegmentOption {
  key: string;
  label: string;
  description: string;
}

export const SEGMENT_CATALOG: SegmentOption[] = [
  { key: 'whatsapp_reachable', label: 'All WhatsApp-reachable', description: 'Every past guest with a phone number' },
  { key: 'repeat', label: 'Repeat guests (2+ stays)', description: 'Your most loyal guests' },
  { key: 'lapsed_12m', label: 'Lapsed 12+ months', description: 'No booking in over a year — win-back' },
  { key: 'winter_stayers', label: 'Winter stayers', description: 'Last stayed in winter' },
  { key: 'romanian', label: 'Romanian guests', description: 'Country = RO' },
  { key: 'foreign', label: 'Foreign guests', description: 'Known non-RO country' },
];

export interface TemplateOption {
  key: string;
  label: string;
  description: string;
}

export const TEMPLATE_CATALOG: TemplateOption[] = [
  { key: 'winter_invite', label: 'Winter invite', description: 'Invite past guests back for winter' },
  { key: 'we_miss_you', label: 'We miss you (+ offer)', description: 'Re-engagement with a return incentive' },
  { key: 'seasonal_availability', label: 'Seasonal availability', description: 'Highlight open dates this season' },
];
