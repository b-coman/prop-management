import { NextResponse } from 'next/server';

export const revalidate = 3600;

function normalizeHost(): string {
  let host = process.env.NEXT_PUBLIC_MAIN_APP_HOST || 'localhost:3000';
  host = host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

export async function GET() {
  const mainHost = normalizeHost();

  const content = `# RentalSpot - Vacation Rental Platform

> RentalSpot is a vacation rental booking platform featuring curated properties in Romania. Each property offers transparent pricing in RON, real-time availability, and secure Stripe payments. Multi-language support (English/Romanian).

## Properties

- [Prahova Mountain Chalet](https://prahova-chalet.ro): Mountain retreat in the Carpathians, Comarnic, Prahova County
- [Coltei Apartment Bucharest](${mainHost}/properties/coltei-apartment-bucharest): Urban apartment in Bucharest city center

## Booking

- Check real-time availability on each property page
- Secure payment via Stripe (all major cards)
- Currency: RON (Romanian Leu)
- Languages: English, Romanian

## Pages Per Property

- Homepage: overview, pricing, booking widget
- Gallery: property photos organized by room/area
- Location: map, nearby attractions, transport options
- Details: amenities, room specifications, house rules
`;

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
