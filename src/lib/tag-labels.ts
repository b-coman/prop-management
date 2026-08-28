/**
 * Bilingual names for photo tags — shared, because two very different consumers need the same words.
 *
 * The gallery uses this map as its filter-pill ALLOWLIST: having a label here is what makes a tag
 * eligible to become a pill, which is why broad structural tags like `interior` are deliberately
 * absent — they sit on most indoor photos, so they would out-count every real category while
 * filtering almost nothing.
 *
 * The page-post planner uses the same map for a different reason. Its briefs are written in
 * Romanian, and a brief reading `SUBIECTUL E "terrace"` is half in the language of the database
 * rather than the language of the post. Sharing one map also means a property that renames a tag for
 * its gallery renames it everywhere, instead of the two quietly drifting apart.
 *
 * Properties override or extend it via `content.tagLabels` in Firestore.
 *
 * `exterior` is the building seen from outside; `outdoor` is the outdoor spaces. They are distinct
 * pills, so they must not share a Romanian label.
 */
export interface TagLabel { en: string; ro: string }

export const DEFAULT_TAG_LABELS: Record<string, TagLabel> = {
  bedroom: { en: 'Bedrooms', ro: 'Dormitoare' },
  'living-room': { en: 'Living Areas', ro: 'Zone de zi' },
  kitchen: { en: 'Kitchen', ro: 'Bucătărie' },
  bathroom: { en: 'Bathrooms', ro: 'Băi' },
  dining: { en: 'Dining', ro: 'Sufragerie' },
  kids: { en: 'Kids Areas', ro: 'Zone pentru copii' },
  playroom: { en: 'Play Room', ro: 'Cameră de joacă' },
  fireplace: { en: 'Fireplace', ro: 'Șemineu' },
  terrace: { en: 'Terrace', ro: 'Terasă' },
  garden: { en: 'Garden', ro: 'Grădină' },
  outdoor: { en: 'Outdoors', ro: 'Exterior' },
  exterior: { en: 'Exterior', ro: 'Fațadă' },
  bbq: { en: 'BBQ', ro: 'Grătar' },
  hammock: { en: 'Hammocks', ro: 'Hamace' },
  playground: { en: 'Playground', ro: 'Loc de joacă' },
  view: { en: 'Views', ro: 'Priveliști' },
  landscape: { en: 'Landscape', ro: 'Peisaj' },
  autumn: { en: 'Autumn', ro: 'Toamna' },
  lifestyle: { en: 'Lifestyle', ro: 'Atmosferă' },
  pool: { en: 'Pool', ro: 'Piscină' },
  spa: { en: 'Spa', ro: 'Spa' },
  balcony: { en: 'Balcony', ro: 'Balcon' },
  parking: { en: 'Parking', ro: 'Parcare' },
  'beach-access': { en: 'Beach', ro: 'Plajă' },
  deck: { en: 'Deck', ro: 'Terasă' },
};


/** A tag as a Romanian reader would say it, falling back to the raw tag when it has no label. */
export function tagLabelRo(tag: string, overrides?: Record<string, TagLabel>): string {
  return (overrides?.[tag] ?? DEFAULT_TAG_LABELS[tag])?.ro ?? tag;
}
