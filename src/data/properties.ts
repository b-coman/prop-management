import type { Property } from '@/types';

export const placeholderProperties: Property[] = [
  {
    id: 'prop1',
    name: 'Prahova Mountain Chalet',
    slug: 'prahova-mountain-chalet',
    description:
      'Escape to our charming chalet in the Prahova Valley. Enjoy stunning mountain views, fresh air, and a peaceful atmosphere. Perfect for families or groups seeking a relaxing getaway near hiking trails and nature. Fully equipped kitchen, cozy fireplace, and a spacious garden await.',
    shortDescription: 'Charming chalet with stunning mountain views in Comarnic.',
    location: {
      address: 'Strada Principala 10', // Placeholder address
      city: 'Comarnic',
      state: 'Prahova', // Use County/Region if applicable
      country: 'Romania',
      zipCode: '105700', // Placeholder zip code
      coordinates: { latitude: 45.2530, longitude: 25.6346 }, // Approximate coordinates for Comarnic
    },
    images: [
      { url: 'https://picsum.photos/seed/chalet1/800/600', alt: 'Chalet exterior view', isFeatured: true, data-ai-hint: "mountain chalet exterior Romania" },
      { url: 'https://picsum.photos/seed/chalet2/800/600', alt: 'Cozy living room with fireplace', isFeatured: false, data-ai-hint: "chalet living room fireplace" },
      { url: 'https://picsum.photos/seed/chalet3/800/600', alt: 'Mountain view from balcony', isFeatured: false, data-ai-hint: "mountain view balcony Romania" },
      { url: 'https://picsum.photos/seed/chalet4/800/600', alt: 'Kitchen area', isFeatured: false, data-ai-hint: "chalet kitchen" },
    ],
    amenities: ['WiFi', 'Kitchen', 'Parking', 'Fireplace', 'TV', 'Garden', 'Mountain View'],
    pricePerNight: 180, // Example price
    cleaningFee: 40,
    maxGuests: 6,
    bedrooms: 3,
    beds: 4,
    bathrooms: 2,
    squareFeet: 1500, // Example size
    checkInTime: '3:00 PM',
    checkOutTime: '11:00 AM',
    houseRules: ['No smoking indoors', 'No loud parties after 10 PM', 'Pets considered upon request'],
    cancellationPolicy: 'Flexible: Full refund 1 day prior to arrival.',
    // Placeholder IDs for sync if needed
    airbnbListingId: undefined,
    bookingComListingId: undefined,
  },
  {
    id: 'prop2',
    name: 'Coltei Apartment Bucharest',
    slug: 'coltei-apartment-bucharest',
    description:
      'Discover Bucharest from our modern and centrally located apartment near Coltei Hospital. Ideal for city explorers and business travelers, offering easy access to the Old Town, University Square, and public transport. Bright, comfortable, and fully equipped for your stay.',
    shortDescription: 'Modern, central apartment near Old Town Bucharest.',
    location: {
      address: 'Bulevardul Ion C. Brătianu 5', // Placeholder address near Coltea area
      city: 'Bucharest',
      state: 'Sector 3', // Use Sector if applicable
      country: 'Romania',
      zipCode: '030171', // Placeholder zip code
      coordinates: { latitude: 44.4355, longitude: 26.1025 }, // Approximate coordinates for central Bucharest
    },
    images: [
      { url: 'https://picsum.photos/seed/apt1/800/600', alt: 'Modern living area', isFeatured: true, data-ai-hint:"modern apartment living room Bucharest" },
      { url: 'https://picsum.photos/seed/apt2/800/600', alt: 'Bedroom with city view', isFeatured: false, data-ai-hint:"apartment bedroom city view Bucharest" },
      { url: 'https://picsum.photos/seed/apt3/800/600', alt: 'Compact kitchen', isFeatured: false, data-ai-hint:"apartment kitchen" },
      { url: 'https://picsum.photos/seed/apt4/800/600', alt: 'Bathroom', isFeatured: false, data-ai-hint:"apartment bathroom" },
    ],
    amenities: ['WiFi', 'Kitchen', 'TV', 'Air Conditioning', 'Washer/Dryer', 'Elevator'],
    pricePerNight: 95, // Example price
    cleaningFee: 25,
    maxGuests: 3,
    bedrooms: 1,
    beds: 2,
    bathrooms: 1,
    squareFeet: 550, // Example size
    checkInTime: '2:00 PM',
    checkOutTime: '12:00 PM',
    houseRules: ['No smoking', 'No parties', 'Respect quiet hours'],
    cancellationPolicy: 'Moderate: Full refund 5 days prior to arrival.',
     // Placeholder IDs for sync if needed
    airbnbListingId: undefined,
    bookingComListingId: undefined,
  },
  // Remove or comment out the third placeholder property if not needed
  // {
  //   id: 'prop3',
  //   name: 'Downtown Urban Loft',
  //   slug: 'downtown-urban-loft',
  //   description:
  //     'Stylish loft in the heart of the city. Features high ceilings, large windows, modern furnishings, and proximity to restaurants, nightlife, and attractions. Ideal for urban explorers and business travelers.',
  //   shortDescription: 'Stylish loft in the heart of the city.',
  //   location: {
  //     address: '789 City Center Blvd',
  //     city: 'Metropolis',
  //     state: 'NY',
  //     country: 'USA',
  //     zipCode: '10001',
  //     coordinates: { latitude: 40.7128, longitude: -74.0060 },
  //   },
  //   images: [
  //     { url: 'https://picsum.photos/seed/prop3_1/800/600', alt: 'Living area of the loft', isFeatured: true },
  //     { url: 'https://picsum.photos/seed/prop3_2/800/600', alt: 'Bedroom area', isFeatured: false },
  //     { url: 'https://picsum.photos/seed/prop3_3/800/600', alt: 'Kitchenette', isFeatured: false },
  //     { url: 'https://picsum.photos/seed/prop3_4/800/600', alt: 'View from window', isFeatured: false },
  //   ],
  //   amenities: ['WiFi', 'Kitchen', 'TV', 'Washer/Dryer'], // No parking usually downtown
  //   pricePerNight: 300,
  //   cleaningFee: 60,
  //   maxGuests: 2,
  //   bedrooms: 1, // Studio/Loft often count as 1 bedroom
  //   beds: 1,
  //   bathrooms: 1,
  //   squareFeet: 700,
  //   checkInTime: '3:00 PM',
  //   checkOutTime: '12:00 PM',
  //   houseRules: ['No smoking', 'No pets', 'Keep noise levels down'],
  //   cancellationPolicy: 'Flexible: Full refund 1 day prior to arrival.',
  //   // Placeholder IDs for sync
  //   airbnbListingId: 'airbnb789',
  //   bookingComListingId: 'booking101',
  // },
];
