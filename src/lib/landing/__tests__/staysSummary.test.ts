/** @jest-environment node */

import { sharedStayFacts } from '../staysSummary';

const stay = (over: Partial<Parameters<typeof sharedStayFacts>[0][number]> = {}) => ({
  nights: 2, priceHint: 1253, label: 'Vineri → duminică', note: 'pentru 3 persoane', guests: 3, ...over,
});

describe('sharedStayFacts', () => {
  it('hoists everything when the stays genuinely agree', () => {
    expect(sharedStayFacts([stay(), stay(), stay()])).toEqual({
      nights: 2, price: 1253, label: 'Vineri → duminică', note: 'pentru 3 persoane', guests: 3,
    });
  });

  it('KEEPS A DIVERGENT PRICE OFF the summary — the lie this exists to prevent', () => {
    // Reprice one weekend and a single "1.253 RON" line above the dates would misquote four others.
    const facts = sharedStayFacts([stay(), stay({ priceHint: 1400 }), stay()]);
    expect(facts.price).toBeNull();
    expect(facts.nights).toBe(2);       // still shared, still safe to hoist
  });

  it('drops only the field that differs, not the whole summary', () => {
    const facts = sharedStayFacts([stay(), stay({ nights: 3 })]);
    expect(facts.nights).toBeNull();
    expect(facts.price).toBe(1253);
    expect(facts.label).toBe('Vineri → duminică');
  });

  it('treats a missing value as "not shared" rather than as a match', () => {
    // Two stays with no price must not hoist "null" as though it were an agreed price.
    expect(sharedStayFacts([stay({ priceHint: null }), stay({ priceHint: null })]).price).toBeNull();
    expect(sharedStayFacts([stay({ note: undefined }), stay()]).note).toBeNull();
  });

  it('is all-null for an empty list', () => {
    expect(sharedStayFacts([])).toEqual({ nights: null, price: null, label: null, note: null, guests: null });
  });

  it('shares everything for a single stay — there is nothing it can contradict', () => {
    expect(sharedStayFacts([stay()]).price).toBe(1253);
  });
});
