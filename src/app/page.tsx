// src/app/page.tsx - Now dedicated to Prahova Chalet with static data

import { HeroSection } from '@/components/homepage/hero-section';
import { ExperienceSection } from '@/components/homepage/experience-section';
import { HostIntroduction } from '@/components/homepage/host-introduction';
import { UniqueFeatures } from '@/components/homepage/unique-features';
import { LocationHighlights } from '@/components/homepage/location-highlights';
import { TestimonialsSection } from '@/components/homepage/testimonials-section';
import { CallToActionSection } from '@/components/homepage/call-to-action';
import { Footer } from '@/components/footer';
import type { Property } from '@/types'; // Keep Property type for HeroSection structure

// --- Static Data for Prahova Chalet Homepage ---

const staticPropertyData: Omit<Property, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'Prahova Mountain Chalet',
  slug: 'prahova-mountain-chalet',
  description: 'Escape to our charming chalet in the Prahova Valley. Enjoy stunning mountain views, fresh air, and a peaceful atmosphere. Perfect for families or groups seeking a relaxing getaway near hiking trails and nature. Fully equipped kitchen, cozy fireplace, and a spacious garden await.',
  shortDescription: 'Charming chalet with stunning mountain views in Comarnic.',
  location: {
    address: 'Strada Principala 10',
    city: 'Comarnic',
    state: 'Prahova',
    country: 'Romania',
    zipCode: '105700',
    coordinates: { latitude: 45.2530, longitude: 25.6346 },
  },
  images: [
    { url: 'https://picsum.photos/seed/chalet1/1600/900', alt: 'Chalet exterior view', isFeatured: true, 'data-ai-hint': "mountain chalet exterior Romania sunset" },
    { url: 'https://picsum.photos/seed/chalet2/800/600', alt: 'Cozy living room with fireplace', isFeatured: false, 'data-ai-hint': "chalet living room fireplace" },
    { url: 'https://picsum.photos/seed/chalet3/800/600', alt: 'Mountain view from balcony', isFeatured: false, 'data-ai-hint': "mountain view balcony Romania" },
    { url: 'https://picsum.photos/seed/chalet4/800/600', alt: 'Kitchen area', isFeatured: false, 'data-ai-hint': "chalet kitchen" },
  ],
  amenities: ['WiFi', 'Kitchen', 'Parking', 'Fireplace', 'TV', 'Garden', 'Mountain View'],
  pricePerNight: 180,
  cleaningFee: 40,
  maxGuests: 7,
  baseOccupancy: 4,
  extraGuestFee: 25,
  bedrooms: 3,
  beds: 4,
  bathrooms: 2,
  squareFeet: 1500,
  checkInTime: '3:00 PM',
  checkOutTime: '11:00 AM',
  houseRules: ['No smoking indoors', 'No loud parties after 10 PM', 'Pets considered upon request'],
  cancellationPolicy: 'Flexible: Full refund 1 day prior to arrival.',
  ratings: { average: 4.9, count: 24 },
  ownerId: 'mock-owner-123', // Example owner ID
  isActive: true,
  airbnbListingId: undefined,
  bookingComListingId: undefined,
};

const experienceHighlights = [
  { icon: 'Mountain', title: 'Mountain Retreat', description: 'Escape to serene mountain landscapes.' },
  { icon: 'Users', title: 'Family Friendly', description: 'Fun for all ages with ziplines and hammocks.' },
  { icon: 'Leaf', title: 'Nature Connection', description: 'Immerse yourself in the beauty of nature.' },
  { icon: 'Map', title: 'Local Exploration', description: 'Discover nearby castles, caves, and canyons.' },
];

const hostInfo = {
  name: 'Bogdan',
  imageUrl: 'https://picsum.photos/seed/host/200/200',
  welcomeMessage: "Welcome! I'm thrilled to share my love for the Prahova Valley with you. This chalet is a dream realized, built with passion and designed for unforgettable moments.",
  backstory: "Having explored these mountains for years, I wanted to create a space where others could experience the same peace and adventure. I hope you feel right at home.",
  'data-ai-hint': "host portrait friendly",
};

const uniqueFeatures = [
  { name: 'Outdoor BBQ', description: 'Grill under the stars.', 'data-ai-hint': "outdoor bbq grill mountain" },
  { name: 'Cozy Fire Pit', description: 'Gather around for stories.', 'data-ai-hint': "fire pit night mountain" },
  { name: 'Adventure Zipline', description: 'A thrill for the kids (and adults!).', 'data-ai-hint': "zipline backyard fun" },
  { name: 'Relaxing Hammocks', description: 'Sway in the breeze.', 'data-ai-hint': "hammock forest relax" },
];

const nearbyAttractions = [
  { name: 'Dracula\'s Castle (Bran)', description: 'Explore the legendary castle.', 'data-ai-hint': "bran castle romania" },
  { name: 'Ialomita Cave', description: 'Discover stunning cave formations.', 'data-ai-hint': "ialomita cave romania" },
  { name: '7 Ladders Canyon', description: 'Hike through breathtaking scenery.', 'data-ai-hint': "7 ladders canyon romania" },
  { name: 'The Sphinx (Bucegi)', description: 'Witness natural rock formations.', 'data-ai-hint': "bucegi sphinx romania" },
];

const testimonials = {
  overallRating: 4.9,
  reviews: [
    { id: '1', name: 'Elena P.', rating: 5, comment: 'Absolutely stunning views and a wonderfully cozy cabin. Perfect getaway!', imageUrl: 'https://picsum.photos/seed/guest1/100/100', 'data-ai-hint': "guest portrait happy" },
    { id: '2', name: 'Marius V.', rating: 5, comment: 'Our family loved the zipline and fire pit. So many great memories made!', imageUrl: 'https://picsum.photos/seed/guest2/100/100', 'data-ai-hint': "guest portrait family" },
    { id: '3', name: 'Ana D.', rating: 4, comment: 'Peaceful location, great host. A bit tricky to find initially, but worth it.', imageUrl: 'https://picsum.photos/seed/guest3/100/100', 'data-ai-hint': "guest portrait thoughtful" },
  ]
};

// --- End of Static Data ---


export default function HomePage() {
  // Use the static data directly instead of fetching from Firestore
  const propertyForHero: Property = {
      id: 'static-prop1', // Use a mock ID
      ...staticPropertyData,
      // Add mock timestamps if needed by components, otherwise omit
      // createdAt: new Date(),
      // updatedAt: new Date(),
  };


  return (
    <div className="flex min-h-screen flex-col">
      {/* Section 1: Hero Section - Uses parts of Property type */}
      <HeroSection property={propertyForHero} />

      <main className="flex-grow">
        {/* Section 2: Experience Section */}
        <ExperienceSection
          title="Experience Nature's Embrace"
          welcomeText="Step into a world where fresh mountain air invigorates your senses and breathtaking vistas greet you each morning. Our chalet is more than just a place to stay; it's an invitation to reconnect with nature, create lasting memories with loved ones, and explore the wonders of the Prahova Valley."
          highlights={experienceHighlights}
        />

        {/* Section 3: Host Introduction */}
        <HostIntroduction host={hostInfo} />

        {/* Section 4: Unique Features Showcase */}
        <UniqueFeatures features={uniqueFeatures} />

        {/* Section 5: Location Highlights */}
        <LocationHighlights
            propertyLocation={staticPropertyData.location}
            attractions={nearbyAttractions}
        />

        {/* Section 6: Testimonials Section */}
        <TestimonialsSection testimonials={testimonials} />

        {/* Section 7: Call to Action Section */}
        <CallToActionSection propertySlug={staticPropertyData.slug}/>

      </main>

      {/* Section 8: Footer */}
      <Footer />
    </div>
  );
}
