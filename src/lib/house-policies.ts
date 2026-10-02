/**
 * What the House Rules page shows, worked out in one place.
 *
 * The page renders a `policiesList` block, whose content is the property's override on top of the
 * template default. Two things went wrong with that on its own:
 *
 * - The cancellation terms a guest actually agrees to live on the property doc
 *   (`properties/{slug}.cancellationPolicy`). The booking page, the confirmation emails and the FAQ
 *   JSON-LD all read that field. The House Rules page read its own copy in the override, or the
 *   template's demo text when there was no override, so the two could say different things.
 *   Here the property field always wins for the cancellation item.
 * - llms.txt needs the same list without rendering the page, so the merge lives here and both
 *   the client renderer and the server use it.
 *
 * Pure functions only: this file is imported by a client component.
 */
import type { Property } from '@/types';

type Text = string | Record<string, string | undefined>;

export interface PolicyItem {
  title: Text;
  description: Text;
}

const CANCELLATION_TITLE = { en: 'Cancellation Policy', ro: 'Politica de anulare' };

function englishOf(text: Text | undefined): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text.en || Object.values(text).find((v): v is string => typeof v === 'string') || '';
}

function anyLanguage(text: Text | undefined, pattern: RegExp): boolean {
  if (!text) return false;
  if (typeof text === 'string') return pattern.test(text);
  return Object.values(text).some((v) => typeof v === 'string' && pattern.test(v));
}

/** Same rule the House Rules icons use: the item whose title talks about cancelling. */
export function isCancellationItem(item: PolicyItem): boolean {
  return anyLanguage(item.title, /cancel|anulare/i);
}

export function isCheckInItem(item: PolicyItem): boolean {
  return anyLanguage(item.title, /check-?\s?in|check-?\s?out/i);
}

export function isPetsItem(item: PolicyItem): boolean {
  return /\bpets?\b|animals?/i.test(englishOf(item.title)) || /\bpets?\b/i.test(englishOf(item.description));
}

/** Policies derived from property fields, for a block with nothing configured. */
function policiesFromProperty(property: Property): PolicyItem[] {
  const items: PolicyItem[] = [];
  if (property.checkInTime || property.checkOutTime) {
    items.push({
      title: { en: 'Check-in / Check-out', ro: 'Check-in / Check-out' },
      description: {
        en: `Check-in: ${property.checkInTime || 'Flexible'}\nCheck-out: ${property.checkOutTime || 'Flexible'}`,
        ro: `Check-in: ${property.checkInTime || 'Flexibil'}\nCheck-out: ${property.checkOutTime || 'Flexibil'}`,
      },
    });
  }
  if (property.houseRules && property.houseRules.length > 0) {
    const rules = property.houseRules as Array<string | Record<string, string | undefined>>;
    items.push({
      title: { en: 'House Rules', ro: 'Regulile casei' },
      description: {
        en: rules.map((r) => (typeof r === 'string' ? r : r.en || '')).join('\n'),
        ro: rules.map((r) => (typeof r === 'string' ? r : r.ro || r.en || '')).join('\n'),
      },
    });
  }
  return items;
}

/**
 * The policies the House Rules page displays, given the merged block content.
 *
 * Configured policies are kept as they are, except the cancellation item, which always shows the
 * property's own `cancellationPolicy` when that is set (added at the top if the list has none).
 * With nothing configured, the list is built from the property fields.
 */
export function buildDisplayedPolicies(
  blockPolicies: PolicyItem[] | undefined,
  property: Property | undefined,
): PolicyItem[] {
  let policies: PolicyItem[] = blockPolicies && blockPolicies.length > 0
    ? blockPolicies
    : (property ? policiesFromProperty(property) : []);

  const cancellation = property?.cancellationPolicy as Text | undefined;
  if (cancellation) {
    const index = policies.findIndex(isCancellationItem);
    if (index >= 0) {
      policies = policies.map((item, i) => (i === index ? { ...item, description: cancellation } : item));
    } else {
      policies = [{ title: CANCELLATION_TITLE, description: cancellation }, ...policies];
    }
  }
  return policies;
}

/** Block types that render as the House Rules list (`rulesSection` is the legacy alias). */
const POLICY_BLOCK_TYPES = ['policiesList', 'rulesSection'];

interface TemplateLike {
  pages?: Record<string, { blocks?: Array<{ id: string; type: string }> }>;
  defaults?: Record<string, any>;
}

/**
 * The House Rules list as the site shows it, for server code that does not render the page
 * (llms.txt). Picks the first visible page with a policies block and merges it exactly like the
 * renderer: template default (by block id, then type) under the page override.
 */
export function resolveHouseRules(
  template: TemplateLike | null | undefined,
  overrides: Record<string, any> | null | undefined,
  property: Property,
  visiblePages: string[],
): PolicyItem[] {
  for (const pageName of visiblePages) {
    const blocks = template?.pages?.[pageName]?.blocks || [];
    const pageOverrides = (overrides?.[pageName] || {}) as Record<string, any>;
    const visibleBlocks: string[] = pageOverrides.visibleBlocks || blocks.map((b) => b.id);
    const block = blocks.find((b) => POLICY_BLOCK_TYPES.includes(b.type) && visibleBlocks.includes(b.id));
    if (!block) continue;

    const templateDefault = template?.defaults?.[block.id] ?? template?.defaults?.[block.type];
    const pageOverride = pageOverrides[block.id];
    const content = templateDefault && pageOverride
      ? { ...templateDefault, ...pageOverride }
      : (pageOverride ?? templateDefault);
    return buildDisplayedPolicies(content?.policies, property);
  }
  return buildDisplayedPolicies(undefined, property);
}
