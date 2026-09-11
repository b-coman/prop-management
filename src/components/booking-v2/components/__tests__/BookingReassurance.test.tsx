/**
 * @jest-environment jsdom
 *
 * What this card must and must not render, pinned.
 *
 * The doctrine in BookingReassurance.tsx is that it degrades to nothing PIECE BY PIECE: no policy,
 * no policy line; no phone, no deposit line; nothing at all, no card. That is easy to state and easy
 * to break, because every one of those branches is an `&&` that a later refactor can quietly invert.
 * The multi-property rule makes it worse than cosmetic — the second property has no reviews and no
 * ratings, so the "renders nothing" path is not a hypothetical, it is that property's normal state.
 *
 * The heroImage case gets its own test for a specific reason: the photo is NOT part of the guard. A
 * property with a picture and nothing to say must still render nothing, rather than a bare
 * photograph in a bordered box pretending to be reassurance.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { BookingReassurance } from '../BookingReassurance';

// lucide-react ships ESM and jest does not transform node_modules — same reason as
// competitor-set-card.test.tsx, which is the pattern this follows.
jest.mock('lucide-react', () => ({
  Star: () => null,
  ShieldCheck: () => null,
  Wallet: () => null,
}));

// SafeImage wraps next/image, which needs a Next runtime that jsdom does not provide. A plain <img>
// keeps the assertion honest: the test still checks that a real image element carrying that src
// reaches the DOM.
jest.mock('@/components/ui/safe-image', () => ({
  SafeImage: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

// The component translates through useLanguage. Returning the fallback is what the page itself does
// for any key it has not got, so asserting on English fallbacks tests the component, not the
// dictionary — the dictionary is verified separately by the locale files themselves.
jest.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

const REVIEW = { author: 'Andreea', rating: 5, text: 'Casa e superba, exact ca in poze.', source: 'booking' };

describe('BookingReassurance', () => {
  it('renders nothing when the property has none of the three things', () => {
    const { container } = render(<BookingReassurance />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a property that has only a photo', () => {
    // The photo is deliberately outside the guard. A bordered box containing one picture and no
    // terms, no review and no deposit line is not reassurance, it is furniture.
    const { container } = render(<BookingReassurance heroImage="https://example.test/hero.jpg" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the cancellation terms it is given, already in the page language', () => {
    render(<BookingReassurance cancellationPolicy="Anulare gratuita cu 30 de zile inainte." />);
    expect(screen.getByText('Anulare gratuita cu 30 de zile inainte.')).toBeInTheDocument();
  });

  it('omits the deposit line when there is no way to reach anybody', () => {
    // canArrangeDeposit is false when the property has no phone. Promising a deposit that is
    // arranged by talking, with nobody to talk to, is the fabrication the file exists to avoid.
    render(<BookingReassurance cancellationPolicy="Anulare gratuita." canArrangeDeposit={false} />);
    expect(screen.queryByText(/50% deposit/i)).not.toBeInTheDocument();
  });

  it('offers the deposit when a conversation is reachable', () => {
    render(<BookingReassurance canArrangeDeposit />);
    expect(screen.getByText(/50% deposit/i)).toBeInTheDocument();
  });

  it('hides the rating when the count is zero rather than printing "0.0"', () => {
    render(<BookingReassurance cancellationPolicy="Anulare gratuita." ratings={{ average: 0, count: 0 }} />);
    expect(screen.queryByText(/0\.0/)).not.toBeInTheDocument();
  });

  it('quotes the review and attributes it', () => {
    render(<BookingReassurance review={REVIEW} ratings={{ average: 4.8, count: 96 }} />);
    expect(screen.getByText(/Casa e superba/)).toBeInTheDocument();
    expect(screen.getByText(/Andreea/)).toBeInTheDocument();
    expect(screen.getByText(/4\.8/)).toBeInTheDocument();
  });

  it('renders the photo when there is also something to say', () => {
    render(<BookingReassurance cancellationPolicy="Anulare gratuita." heroImage="https://example.test/hero.jpg" />);
    const img = screen.getByRole('presentation', { hidden: true }) as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://example.test/hero.jpg');
    // alt="" on purpose: the copy beside it already says what this is.
    expect(img.getAttribute('alt')).toBe('');
  });

  it('renders no image element at all when the property has no photo', () => {
    const { container } = render(<BookingReassurance cancellationPolicy="Anulare gratuita." />);
    expect(container.querySelector('img')).toBeNull();
  });
});
