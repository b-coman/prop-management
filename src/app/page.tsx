// src/app/page.tsx - Now dedicated to Prahova Chalet

import { notFound } from 'next/navigation';
import { HeroSection } from '@/components/homepage/hero-section';
import { ExperienceSection } from '@/components/homepage/experience-section';
import { HostIntroduction } from '@/components/homepage/host-introduction';
import { UniqueFeatures } from '@/components/homepage/unique-features';
import { LocationHighlights } from '@/components/homepage/location-highlights';
import { TestimonialsSection } from '@/components/homepage/testimonials-section';
import { CallToActionSection } from '@/components/homepage/call-to-action';
import { Footer } from '@/components/footer';
import { getPropertyBySlug } from '@/app/properties/[slug]/page'; // Reuse the fetching logic
import type { Property } from '@/types';

// Fetch data for the specific property (Prahova Chalet) server-side
async function getPrahovaChaletData(): Promise<Property | undefined> {
  // Hardcode the slug for the homepage property
  const slug = 'prahova-mountain-chalet';
  return await getPropertyBySlug(slug);
}

export default async function HomePage() {
  const property = await getPrahovaChaletData();

  if (!property) {
    // Handle case where the specific property isn't found
    // Maybe show a generic landing page or an error
    // For now, using notFound, but might want a fallback later
    console.error("Homepage Error: Could not load data for Prahova Mountain Chalet.");
    notFound();
  }

  // Placeholder data for sections where content isn't in the Property type yet
  const experienceHighlights = [
    { icon: 'Mountain', title: 'Mountain Retreat', description: 'Escape to serene mountain landscapes.' },
    { icon: 'Users', title: 'Family Friendly', description: 'Fun for all ages with ziplines and hammocks.' },
    { icon: 'Leaf', title: 'Nature Connection', description: 'Immerse yourself in the beauty of nature.' },
    { icon: 'Map', title: 'Local Exploration', description: 'Discover nearby castles, caves, and canyons.' },
  ];

  const hostInfo = {
    name: 'Bogdan',
    imageUrl: 'https://picsum.photos/seed/host/200/200', // Placeholder image
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

  // Placeholder reviews
   const testimonials = {
     overallRating: 4.9,
     reviews: [
       { id: '1', name: 'Elena P.', rating: 5, comment: 'Absolutely stunning views and a wonderfully cozy cabin. Perfect getaway!', imageUrl: 'https://picsum.photos/seed/guest1/100/100', 'data-ai-hint': "guest portrait happy" },
       { id: '2', name: 'Marius V.', rating: 5, comment: 'Our family loved the zipline and fire pit. So many great memories made!', imageUrl: 'https://picsum.photos/seed/guest2/100/100', 'data-ai-hint': "guest portrait family" },
       { id: '3', name: 'Ana D.', rating: 4, comment: 'Peaceful location, great host. A bit tricky to find initially, but worth it.', imageUrl: 'https://picsum.photos/seed/guest3/100/100', 'data-ai-hint': "guest portrait thoughtful" },
     ]
   };


  return (
    <div className="flex min-h-screen flex-col">
      {/* Section 1: Hero Section */}
      <HeroSection property={property} />

      <main className="flex-grow">
        {/* Section 2: Experience Section */}
        <ExperienceSection
          title="Experience Nature's Embrace"
          welcomeText="Step into a world where fresh mountain air invigorates your senses and breathtaking vistas greet you each morning. Our chalet is more than just a place to stay; it's an invitation to reconnect with nature, create lasting memories with loved ones, and explore the wonders of the Prahova Valley." // Placeholder guidebook text
          highlights={experienceHighlights}
        />

        {/* Section 3: Host Introduction */}
        <HostIntroduction host={hostInfo} />

        {/* Section 4: Unique Features Showcase */}
        <UniqueFeatures features={uniqueFeatures} />

        {/* Section 5: Location Highlights */}
        <LocationHighlights
            propertyLocation={property.location}
            attractions={nearbyAttractions}
        />

        {/* Section 6: Testimonials Section */}
        <TestimonialsSection testimonials={testimonials} />

        {/* Section 7: Call to Action Section */}
        <CallToActionSection propertySlug={property.slug}/>

      </main>

      {/* Section 8: Footer */}
      <Footer />
    </div>
  );
}
