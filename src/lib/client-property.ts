// src/lib/client-property.ts
// The copy of a property doc that guest pages may hand to client components.
//
// Anything passed to a client component crosses into the RSC payload and is published in the page
// HTML, for every visitor and crawler. Guest pages read none of the fields below, so they stay on
// the server. The calendar/iCal tokens no longer live on the doc (see src/lib/property-secrets.ts)
// but stay listed so a stray copy can never ship again.

const SERVER_ONLY_PROPERTY_FIELDS = [
  'icalExportToken',
  'shareCalendarToken',
  'guestCalendarToken',
  'ownerEmail',
  'ownerId',
  'analytics',
  'brandVoice',
  'channelPricing',
  '_translationStatus',
  'updatedBy',
] as const;

export function toClientProperty<T extends { images?: Array<Record<string, any>> }>(property: T): T {
  const clientProperty: Record<string, unknown> = {
    ...property,
    // `aiDescription` is the vision layer's output for the ad/post selectors. Server modules read
    // it, no client component does, and it costs ~31 KB per page and grows with each photo.
    images: property.images?.map(({ aiDescription, ...img }) => img),
  };
  for (const field of SERVER_ONLY_PROPERTY_FIELDS) {
    delete clientProperty[field];
  }
  return clientProperty as T;
}
