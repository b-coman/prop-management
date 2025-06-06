/**
 * @fileoverview Test property data fixtures for visual regression testing
 * @module tests/visual/fixtures/test-property-data
 * @description Standardized property data for consistent renderer testing
 * 
 * @author Claude AI Assistant
 * @since 2025-06-06
 * @lastModified 2025-06-06
 */

import type { Property, WebsiteTemplate, PropertyOverrides } from '@/types';

/**
 * Standard test property data for visual regression testing
 */
export const testProperty: Property = {
  id: 'visual-test-property',
  slug: 'visual-test-property',
  name: {
    en: 'Beautiful Mountain Retreat',
    ro: 'Retragere Frumoasă în Munte'
  },
  location: {
    address: '123 Mountain View Road',
    city: 'Alpine Valley',
    country: 'Test Country',
    coordinates: {
      latitude: 45.5,
      longitude: 25.5
    },
    zipCode: '12345'
  },
  pricePerNight: {
    amount: 150,
    currency: 'USD'
  },
  advertisedRate: {
    amount: 150,
    currency: 'USD',
    period: 'night'
  },
  images: [
    {
      url: '/images/templates/holiday-house/default-gallery-1.jpg',
      alt: 'Beautiful mountain view',
      isFeatured: true,
      'data-ai-hint': 'mountain landscape scenic view'
    },
    {
      url: '/images/templates/holiday-house/default-bbq.jpg',
      alt: 'Outdoor BBQ area',
      isFeatured: false,
      'data-ai-hint': 'outdoor cooking barbecue'
    }
  ],
  amenities: ['wifi', 'kitchen', 'parking', 'fireplace'],
  checkInTime: '15:00',
  checkOutTime: '11:00',
  houseRules: [
    'No smoking',
    'No pets',
    'Quiet hours after 10 PM'
  ],
  ratings: {
    average: 4.8,
    count: 125
  },
  templateId: 'holiday-house',
  theme: {
    id: 'forest',
    name: 'Forest Theme'
  },
  bookingOptions: {
    minNights: 2,
    maxNights: 14,
    advanceBookingDays: 365,
    instantBook: true
  }
};

/**
 * Standard test website template for visual regression testing
 */
export const testTemplate: WebsiteTemplate = {
  id: 'holiday-house',
  name: 'Holiday House',
  homepage: [
    { id: 'hero', type: 'hero' },
    { id: 'experience', type: 'experience' },
    { id: 'host', type: 'host' },
    { id: 'features', type: 'features' },
    { id: 'location', type: 'location' },
    { id: 'gallery', type: 'gallery' },
    { id: 'testimonials', type: 'testimonials' },
    { id: 'cta', type: 'cta' }
  ],
  defaults: {
    hero: {
      title: 'Welcome to Your Perfect Getaway',
      subtitle: 'Experience comfort and tranquility',
      backgroundImage: '/images/templates/holiday-house/default-gallery-1.jpg',
      showBookingForm: true,
      showRating: true,
      'data-ai-hint': 'scenic mountain landscape vacation rental'
    },
    experience: {
      title: 'Unforgettable Experience Awaits',
      description: 'Discover the perfect blend of comfort and adventure in our carefully curated space.',
      highlights: [
        'Stunning mountain views',
        'Modern amenities',
        'Peaceful environment',
        'Perfect for relaxation'
      ]
    },
    host: {
      name: 'Test Host',
      description: 'We are passionate about providing exceptional experiences for our guests.',
      backstory: 'With years of hospitality experience, we ensure every detail is perfect.',
      image: '/images/templates/holiday-house/default-host.jpg',
      'data-ai-hint': 'friendly host portrait welcoming'
    },
    features: [
      {
        title: 'Mountain Views',
        description: 'Breathtaking panoramic views',
        icon: '🏔️'
      },
      {
        title: 'Modern Comfort',
        description: 'All the amenities you need',
        icon: '🛋️'
      },
      {
        title: 'Outdoor Space',
        description: 'Private garden and BBQ area',
        icon: '🌿'
      }
    ],
    location: {
      title: 'Perfect Location',
      description: 'Ideally situated for exploration and relaxation'
    },
    testimonials: {
      title: 'What Our Guests Say',
      reviews: [
        {
          text: 'Absolutely perfect! The views were incredible and the space was exactly as described.',
          author: 'Test Reviewer 1',
          rating: 5
        },
        {
          text: 'Great location, very clean, and the host was super responsive. Highly recommend!',
          author: 'Test Reviewer 2',
          rating: 5
        }
      ]
    },
    cta: {
      title: 'Ready for Your Perfect Getaway?',
      description: 'Book your stay today and create unforgettable memories.',
      buttonText: 'Book Now',
      backgroundImage: '/images/templates/holiday-house/default-gallery-1.jpg',
      'data-ai-hint': 'call to action booking vacation rental'
    }
  }
};

/**
 * Standard test property overrides for visual regression testing
 */
export const testOverrides: PropertyOverrides = {
  id: 'visual-test-overrides',
  visibleBlocks: ['hero', 'experience', 'features', 'gallery', 'cta'],
  theme: 'forest',
  hero: {
    title: 'Visual Test Property',
    subtitle: 'Perfect for automated testing',
    showBookingForm: true,
    showRating: true
  },
  menuItems: [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about' }
  ]
};

/**
 * Alternative test data sets for different scenarios
 */
export const alternativeTestData = {
  // Minimal property data
  minimal: {
    property: {
      ...testProperty,
      name: 'Minimal Test Property',
      images: [testProperty.images[0]], // Only one image
      amenities: ['wifi'], // Only one amenity
      houseRules: [] // No rules
    },
    overrides: {
      ...testOverrides,
      visibleBlocks: ['hero', 'cta'] // Minimal blocks
    }
  },
  
  // Maximum content property data
  maximal: {
    property: {
      ...testProperty,
      name: 'Maximum Content Test Property',
      amenities: ['wifi', 'kitchen', 'parking', 'fireplace', 'pool', 'gym', 'spa', 'garden'],
      houseRules: [
        'No smoking anywhere on the property',
        'No pets allowed',
        'Quiet hours from 10 PM to 8 AM',
        'Maximum 6 guests',
        'No parties or events',
        'Please remove shoes when entering'
      ]
    },
    overrides: {
      ...testOverrides,
      visibleBlocks: ['hero', 'experience', 'host', 'features', 'location', 'gallery', 'testimonials', 'cta']
    }
  }
};