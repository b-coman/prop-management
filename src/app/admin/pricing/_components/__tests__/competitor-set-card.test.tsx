/**
 * @jest-environment jsdom
 *
 * What the comparable-set screen must show, pinned.
 *
 * The owner named four things he needs on every row (2026-09-01) — **name, city, a picture, and the
 * link** — because a curated set is only worth what his ability to look at it and say "that one is
 * not really a competitor any more", and nobody does that from a listingId. Those four are asserted
 * here rather than eyeballed once in a dev server, since an eyeball check does not survive the next
 * refactor.
 *
 * The rest of the file pins the two things the design insists the screen must not hide: that the
 * channels are separate contests, and that an unverified or drafted entry says so on its own row.
 */
import React from 'react';
import { render, screen, within } from '@testing-library/react';

// lucide-react ships ESM and jest does not transform node_modules. Mocked here rather than widening
// transformIgnorePatterns project-wide for the sake of three decorative icons.
jest.mock('lucide-react', () => ({
  ExternalLink: () => null,
  ImageOff: () => null,
  Link2: () => null,
}));

import { CompetitorSetCard, type CompetitorRow } from '../competitor-set-card';

const row = (over: Partial<CompetitorRow> = {}): CompetitorRow => ({
  listingId: 'vila-luna',
  displayName: 'Vila Luna',
  channel: 'booking.com',
  url: 'https://www.booking.com/hotel/ro/vila-luna-comarnic.en-gb.html',
  city: 'Comarnic',
  heroPhotoUrl: 'https://cf.bstatic.com/x/luna.jpg',
  propertyType: 'whole-house',
  largestUnit: 11,
  unitCount: 1,
  rating: 10,
  reviewCount: 57,
  amenities: ['bbq', 'terrace'],
  substitutionBasis: 'Whole house of our size in our town, flat-rate whatever the party size.',
  basisIsDraft: false,
  active: true,
  verificationAgeDays: 3,
  unverified: false,
  stale: false,
  fits: [
    { label: '2a+1c', verdict: 'single', detail: 'one unit takes all 3' },
    { label: '4a', verdict: 'single', detail: 'one unit takes all 4' },
    { label: '4a+2c', verdict: 'single', detail: 'one unit takes all 6' },
  ],
  ...over,
});

describe('the four things the owner asked for', () => {
  it('shows the name, the city, a picture and a working link', () => {
    render(<CompetitorSetCard rows={[row()]} />);

    const link = screen.getByRole('link', { name: /Vila Luna/ });
    expect(link).toHaveAttribute('href', 'https://www.booking.com/hotel/ro/vila-luna-comarnic.en-gb.html');
    expect(link).toHaveAttribute('target', '_blank');
    // An OTA link opening a new tab must not hand the opener over.
    expect(link.getAttribute('rel')).toMatch(/noopener/);

    expect(screen.getByText('Comarnic')).toBeInTheDocument();

    const img = screen.getByRole('img', { name: /Vila Luna/ });
    expect(img).toHaveAttribute('src', 'https://cf.bstatic.com/x/luna.jpg');
  });

  it('says the picture is missing rather than rendering a broken image', () => {
    render(<CompetitorSetCard rows={[row({ heroPhotoUrl: null })]} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(/not read/i)).toBeInTheDocument();
  });
});

describe('the channels are separate contests (C8)', () => {
  it('renders one panel per channel and never merges them', () => {
    render(<CompetitorSetCard rows={[
      row({ listingId: 'ava-ab', displayName: 'AVA Chalet', channel: 'airbnb' }),
      row({ listingId: 'ava-bk', displayName: 'AVA Chalet BK', channel: 'booking.com' }),
    ]} />);
    expect(screen.getByText('Airbnb')).toBeInTheDocument();
    expect(screen.getByText('Booking.com')).toBeInTheDocument();
  });

  it('shows the same house on both channels as two entries, cross-linked', () => {
    render(<CompetitorSetCard rows={[row({ sameAsName: 'AVA Chalet (Airbnb)' })]} />);
    expect(screen.getByText(/also listed as AVA Chalet \(Airbnb\)/)).toBeInTheDocument();
  });
});

describe('the field changes size with the party (C4)', () => {
  it('shows a per-party verdict, so a listing that cannot host one is visibly out', () => {
    render(<CompetitorSetCard rows={[row({
      displayName: 'Casutele de la Poienita', largestUnit: 2, unitCount: 3,
      fits: [
        { label: '2a+1c', verdict: 'out-of-set', detail: 'no single unit takes 3' },
        { label: '4a', verdict: 'combination', detail: '2 units together' },
        { label: '4a+2c', verdict: 'out-of-set', detail: 'children do not split' },
      ],
    })]} />);
    expect(screen.getByText('2a+1c: too small')).toBeInTheDocument();
    expect(screen.getByText('4a: combines')).toBeInTheDocument();
    expect(screen.getByText('4a+2c: too small')).toBeInTheDocument();
  });

  it('reports the largest unit, not the total, for a multi-unit property', () => {
    render(<CompetitorSetCard rows={[row({ largestUnit: 10, unitCount: 3 })]} />);
    expect(screen.getByText(/in the largest of 3 units/)).toBeInTheDocument();
  });
});

describe('the set ages, and says so (C1)', () => {
  it('marks a never-verified entry', () => {
    render(<CompetitorSetCard rows={[row({ unverified: true, stale: true, verificationAgeDays: null })]} />);
    expect(screen.getByText(/never verified/i)).toBeInTheDocument();
  });

  it('marks a stale one with its age', () => {
    render(<CompetitorSetCard rows={[row({ stale: true, verificationAgeDays: 200 })]} />);
    expect(screen.getByText('200d old')).toBeInTheDocument();
  });

  it('badges a drafted reason so it is never mistaken for the owner\'s own', () => {
    render(<CompetitorSetCard rows={[row({ basisIsDraft: true })]} />);
    expect(screen.getByText('draft')).toBeInTheDocument();
    expect(screen.getByText(/1 of 1 still carry a drafted reason/)).toBeInTheDocument();
  });

  it('says nothing about drafts when every reason is the owner\'s', () => {
    render(<CompetitorSetCard rows={[row({ basisIsDraft: false })]} />);
    expect(screen.queryByText('draft')).not.toBeInTheDocument();
    expect(screen.queryByText(/drafted reason/)).not.toBeInTheDocument();
  });
});

describe('a retired entry stays visible with its reason', () => {
  it('keeps the exclusion on screen rather than deleting the row', () => {
    render(<CompetitorSetCard rows={[row({
      displayName: 'Pensiunea PIRI LAND', active: false,
      retiredReason: 'lets rooms, not houses — cannot host any of our parties',
    })]} />);
    expect(screen.getByText('retired')).toBeInTheDocument();
    expect(screen.getByText(/lets rooms, not houses/)).toBeInTheDocument();
  });

  it('counts retired entries apart from competing ones', () => {
    render(<CompetitorSetCard rows={[row({ listingId: 'a' }), row({ listingId: 'b', active: false })]} />);
    const heading = screen.getByText(/1 competing/);
    expect(within(heading).getByText(/1 retired/)).toBeInTheDocument();
  });
});

describe('the empty state explains itself', () => {
  it('says why the set is curated by hand rather than showing a blank card', () => {
    render(<CompetitorSetCard rows={[]} />);
    expect(screen.getByText(/auto-discovery/i)).toBeInTheDocument();
    expect(screen.getByText(/seed-competitor-set/)).toBeInTheDocument();
  });
});
