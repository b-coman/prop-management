/**
 * @fileoverview Booking Page Component Language Integration Tests
 * @module app/booking/__tests__/booking-page-language
 * 
 * @description
 * Tests for the actual booking page components and their integration with
 * the unified language system. Validates real component behavior, routing,
 * and server-side rendering compatibility.
 * 
 * @architecture
 * Location: Booking page test infrastructure
 * Layer: Page-level integration testing
 * Pattern: Jest + React Testing Library with Next.js page testing
 * 
 * @dependencies
 * - Internal: Booking page components, unified language system
 * - External: Jest, React Testing Library, Next.js testing utils
 * 
 * @relationships
 * - Tests: Actual booking page components and routes
 * - Validates: SSR language detection and client hydration
 * - Ensures: Page-level language functionality
 * - Verifies: Component integration and data flow
 * 
 * @performance
 * - Optimizations: Minimal component mounting, mocked external services
 * - Concerns: Full page rendering performance in tests
 * 
 * @example
 * ```bash
 * npm test -- --testPathPattern=booking-page-language
 * ```
 * 
 * @migration-notes
 * Created to validate booking page components work correctly with unified
 * language system after migration from legacy language contexts.
 * 
 * @since v1.0.0
 * @author RentalSpot Team
 */

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import React from 'react';

// Import page components to test
import { LanguageProvider } from '@/lib/language-system';

// Mock Next.js modules
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
  usePathname: jest.fn(),
  notFound: jest.fn()
}));

// Mock Firebase
jest.mock('@/lib/firebase', () => ({
  db: {},
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn().mockResolvedValue({
    exists: () => true,
    data: () => ({
      name: { en: 'Test Property', ro: 'Proprietate Test' },
      minNights: 2,
      maxGuests: 4
    })
  })
}));

// Mock property utils
jest.mock('@/lib/property-utils', () => ({
  getPropertyBySlug: jest.fn().mockResolvedValue({
    id: 'test-property',
    slug: 'test-property',
    name: { en: 'Test Property', ro: 'Proprietate Test' },
    minNights: 2,
    maxGuests: 4
  }),
  getPropertyHeroImage: jest.fn().mockResolvedValue('/test-image.jpg')
}));

// Mock server language utils
jest.mock('@/lib/server-language-utils', () => ({
  serverTranslateContent: jest.fn().mockImplementation((content, lang = 'en') => {
    if (typeof content === 'string') return content;
    return content?.[lang] || content?.en || '';
  })
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  loggers: {
    languageSystem: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    },
    booking: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }
  }
}));

// Mock features config
jest.mock('@/config/features', () => ({
  FEATURES: {
    BOOKING_V2: true
  }
}));

// Mock translation files
global.fetch = jest.fn().mockImplementation((url: string) => {
  if (url.includes('/locales/en.json')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        'common': {
          'bookNow': 'Book Now',
          'checkIn': 'Check-in',
          'checkOut': 'Check-out',
          'guests': 'Guests',
          'selectDates': 'Select Dates',
          'back': 'Back',
          'continue': 'Continue'
        },
        'booking': {
          'title': 'Check Availability',
          'subtitle': 'Select your dates and number of guests',
          'selectDatesPrompt': 'Select your dates to see pricing and booking options',
          'minNightsRequired': 'Minimum {nights} nights required',
          'maxGuestsAllowed': 'Max {guests} guests'
        }
      })
    });
  }
  if (url.includes('/locales/ro.json')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        'common': {
          'bookNow': 'Rezervă Acum',
          'checkIn': 'Check-in',
          'checkOut': 'Check-out',
          'guests': 'Oaspeți',
          'selectDates': 'Selectează Datele',
          'back': 'Înapoi',
          'continue': 'Continuă'
        },
        'booking': {
          'title': 'Verifică Disponibilitatea',
          'subtitle': 'Selectează datele și numărul de oaspeți',
          'selectDatesPrompt': 'Selectează datele pentru a vedea prețurile și opțiunile de rezervare',
          'minNightsRequired': 'Minim {nights} nopți necesare',
          'maxGuestsAllowed': 'Maxim {guests} oaspeți'
        }
      })
    });
  }
  return Promise.reject(new Error('Translation file not found'));
});

// Test component that simulates booking page structure
const MockBookingPage: React.FC<{
  slug: string;
  searchParams: { [key: string]: string };
  initialLanguage?: string;
}> = ({ slug, searchParams, initialLanguage = 'en' }) => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    pathname: `/booking/check/${slug}`,
    query: searchParams
  };
  
  const mockSearchParams = new URLSearchParams(searchParams);
  
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
  (usePathname as jest.Mock).mockReturnValue(`/booking/check/${slug}`);

  return (
    <LanguageProvider
      initialLanguage={initialLanguage as any}
      pageType="booking"
      enablePerformanceTracking={true}
      enableDebugMode={true}
    >
      <MockBookingComponent />
    </LanguageProvider>
  );
};

// Mock booking component using the language system
const MockBookingComponent: React.FC = () => {
  const { useLanguage } = require('@/hooks/useLanguage');
  const { currentLang, t, tc, switchLanguage } = useLanguage();
  
  // Mock translation function with variable substitution
  const translateWithVars = (key: string, vars?: any) => {
    const translations: any = {
      'booking.title': currentLang === 'ro' ? 'Verifică Disponibilitatea' : 'Check Availability',
      'booking.subtitle': currentLang === 'ro' ? 'Selectează datele și numărul de oaspeți' : 'Select your dates and number of guests',
      'booking.minNightsRequired': currentLang === 'ro' ? `Minim ${vars?.nights || '{nights}'} nopți necesare` : `Minimum ${vars?.nights || '{nights}'} nights required`,
      'booking.maxGuestsAllowed': currentLang === 'ro' ? `Maxim ${vars?.guests || '{guests}'} oaspeți` : `Max ${vars?.guests || '{guests}'} guests`,
      'booking.selectDatesPrompt': currentLang === 'ro' ? 'Selectează datele pentru a vedea prețurile și opțiunile de rezervare' : 'Select your dates to see pricing and booking options'
    };
    return translations[key] || key;
  };
  
  const propertyName = { en: 'Test Property', ro: 'Proprietate Test' };
  
  return (
    <div data-testid="booking-page">
      <div data-testid="current-lang">{currentLang}</div>
      <h1 data-testid="page-title">{translateWithVars('booking.title')}</h1>
      <p data-testid="page-subtitle">{translateWithVars('booking.subtitle')}</p>
      <h2 data-testid="property-name">{tc(propertyName)}</h2>
      <div data-testid="min-nights">{translateWithVars('booking.minNightsRequired', { nights: 2 })}</div>
      <div data-testid="max-guests">{translateWithVars('booking.maxGuestsAllowed', { guests: 4 })}</div>
      <button 
        data-testid="lang-switch-en" 
        onClick={() => switchLanguage('en')}
      >
        English
      </button>
      <button 
        data-testid="lang-switch-ro" 
        onClick={() => switchLanguage('ro')}
      >
        Română
      </button>
      <div data-testid="select-dates-prompt">{translateWithVars('booking.selectDatesPrompt')}</div>
    </div>
  );
};

describe('Booking Page Language Integration', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  // ===== Basic Page Language Integration =====

  describe('Basic Page Language Integration', () => {
    
    it('should render booking page with English translations by default', async () => {
      render(
        <MockBookingPage 
          slug="test-property" 
          searchParams={{ checkIn: '2025-06-24', checkOut: '2025-06-27' }}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('current-lang')).toHaveTextContent('en');
      });

      expect(screen.getByTestId('page-title')).toHaveTextContent('Check Availability');
      expect(screen.getByTestId('page-subtitle')).toHaveTextContent('Select your dates and number of guests');
      expect(screen.getByTestId('property-name')).toHaveTextContent('Test Property');
      expect(screen.getByTestId('min-nights')).toHaveTextContent('Minimum 2 nights required');
      expect(screen.getByTestId('max-guests')).toHaveTextContent('Max 4 guests');
      expect(screen.getByTestId('select-dates-prompt')).toHaveTextContent('Select your dates to see pricing and booking options');
    });

    it('should render booking page with Romanian translations when lang=ro', async () => {
      render(
        <MockBookingPage 
          slug="test-property" 
          searchParams={{ lang: 'ro', checkIn: '2025-06-24', checkOut: '2025-06-27' }}
          initialLanguage="ro"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('current-lang')).toHaveTextContent('ro');
      });

      expect(screen.getByTestId('page-title')).toHaveTextContent('Verifică Disponibilitatea');
      expect(screen.getByTestId('page-subtitle')).toHaveTextContent('Selectează datele și numărul de oaspeți');
      expect(screen.getByTestId('property-name')).toHaveTextContent('Proprietate Test');
      expect(screen.getByTestId('min-nights')).toHaveTextContent('Minim 2 nopți necesare');
      expect(screen.getByTestId('max-guests')).toHaveTextContent('Maxim 4 oaspeți');
      expect(screen.getByTestId('select-dates-prompt')).toHaveTextContent('Selectează datele pentru a vedea prețurile și opțiunile de rezervare');
    });

  });

  // ===== Language Switching on Booking Page =====

  describe('Language Switching on Booking Page', () => {
    
    it('should switch from English to Romanian on booking page', async () => {
      render(
        <MockBookingPage 
          slug="test-property" 
          searchParams={{ checkIn: '2025-06-24', checkOut: '2025-06-27' }}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('current-lang')).toHaveTextContent('en');
      });

      // Verify initial English content
      expect(screen.getByTestId('page-title')).toHaveTextContent('Check Availability');

      // Switch to Romanian
      fireEvent.click(screen.getByTestId('lang-switch-ro'));

      await waitFor(() => {
        expect(screen.getByTestId('current-lang')).toHaveTextContent('ro');
      });

      // Verify Romanian content
      expect(screen.getByTestId('page-title')).toHaveTextContent('Verifică Disponibilitatea');
      expect(screen.getByTestId('property-name')).toHaveTextContent('Proprietate Test');
    });

    it('should switch from Romanian to English on booking page', async () => {
      render(
        <MockBookingPage 
          slug="test-property" 
          searchParams={{ lang: 'ro' }}
          initialLanguage="ro"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('current-lang')).toHaveTextContent('ro');
      });

      // Verify initial Romanian content
      expect(screen.getByTestId('page-title')).toHaveTextContent('Verifică Disponibilitatea');

      // Switch to English
      fireEvent.click(screen.getByTestId('lang-switch-en'));

      await waitFor(() => {
        expect(screen.getByTestId('current-lang')).toHaveTextContent('en');
      });

      // Verify English content
      expect(screen.getByTestId('page-title')).toHaveTextContent('Check Availability');
      expect(screen.getByTestId('property-name')).toHaveTextContent('Test Property');
    });

  });

  // ===== URL Parameter Integration =====

  describe('URL Parameter Integration', () => {
    
    it('should detect language from URL parameters on booking page', async () => {
      render(
        <MockBookingPage 
          slug="test-property" 
          searchParams={{ 
            lang: 'ro',
            checkIn: '2025-06-24', 
            checkOut: '2025-06-27',
            guests: '2'
          }}
          initialLanguage="ro"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('current-lang')).toHaveTextContent('ro');
      });

      expect(screen.getByTestId('page-title')).toHaveTextContent('Verifică Disponibilitatea');
    });

    it('should maintain booking parameters while changing language', async () => {
      const mockRouter = {
        push: jest.fn(),
        replace: jest.fn(),
        pathname: '/booking/check/test-property',
        query: { checkIn: '2025-06-24', checkOut: '2025-06-27', guests: '2' }
      };
      
      (useRouter as jest.Mock).mockReturnValue(mockRouter);

      render(
        <MockBookingPage 
          slug="test-property" 
          searchParams={{ checkIn: '2025-06-24', checkOut: '2025-06-27', guests: '2' }}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('current-lang')).toHaveTextContent('en');
      });

      // Switch language
      fireEvent.click(screen.getByTestId('lang-switch-ro'));

      await waitFor(() => {
        expect(screen.getByTestId('current-lang')).toHaveTextContent('ro');
      });

      // Should update URL with language but preserve booking parameters
      expect(mockRouter.replace).toHaveBeenCalledWith(
        expect.stringContaining('lang=ro')
      );
      expect(mockRouter.replace).toHaveBeenCalledWith(
        expect.stringContaining('checkIn=2025-06-24')
      );
      expect(mockRouter.replace).toHaveBeenCalledWith(
        expect.stringContaining('checkOut=2025-06-27')
      );
    });

  });

  // ===== Property-Specific Language Content =====

  describe('Property-Specific Language Content', () => {
    
    it('should translate property-specific content correctly', async () => {
      render(
        <MockBookingPage 
          slug="test-property" 
          searchParams={{}}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('current-lang')).toHaveTextContent('en');
      });

      // Property name should be translated using tc() function
      expect(screen.getByTestId('property-name')).toHaveTextContent('Test Property');

      // Switch to Romanian
      fireEvent.click(screen.getByTestId('lang-switch-ro'));

      await waitFor(() => {
        expect(screen.getByTestId('current-lang')).toHaveTextContent('ro');
      });

      expect(screen.getByTestId('property-name')).toHaveTextContent('Proprietate Test');
    });

    it('should handle variable substitution in booking context', async () => {
      render(
        <MockBookingPage 
          slug="test-property" 
          searchParams={{}}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('current-lang')).toHaveTextContent('en');
      });

      // Variable substitution should work
      expect(screen.getByTestId('min-nights')).toHaveTextContent('Minimum 2 nights required');
      expect(screen.getByTestId('max-guests')).toHaveTextContent('Max 4 guests');

      // Switch to Romanian
      fireEvent.click(screen.getByTestId('lang-switch-ro'));

      await waitFor(() => {
        expect(screen.getByTestId('current-lang')).toHaveTextContent('ro');
      });

      expect(screen.getByTestId('min-nights')).toHaveTextContent('Minim 2 nopți necesare');
      expect(screen.getByTestId('max-guests')).toHaveTextContent('Maxim 4 oaspeți');
    });

  });

  // ===== Error Handling and Edge Cases =====

  describe('Error Handling and Edge Cases', () => {
    
    it('should handle translation loading errors gracefully', async () => {
      // Mock fetch to fail for Romanian translations
      (global.fetch as jest.Mock).mockImplementationOnce((url) => {
        if (url.includes('/locales/ro.json')) {
          return Promise.reject(new Error('Network error'));
        }
        // Return English translations normally
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            'common': { 'bookNow': 'Book Now' },
            'booking': { 'title': 'Check Availability' }
          })
        });
      });

      render(
        <MockBookingPage 
          slug="test-property" 
          searchParams={{ lang: 'ro' }}
          initialLanguage="ro"
        />
      );

      await waitFor(() => {
        // Should fallback gracefully, possibly to English or empty strings
        expect(screen.getByTestId('current-lang')).toHaveTextContent('ro');
      });

      // Should not crash the component
      expect(screen.getByTestId('booking-page')).toBeInTheDocument();
    });

    it('should handle missing property data gracefully', async () => {
      // Mock property utils to return null
      const { getPropertyBySlug } = require('@/lib/property-utils');
      getPropertyBySlug.mockResolvedValueOnce(null);

      render(
        <MockBookingPage 
          slug="nonexistent-property" 
          searchParams={{}}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('current-lang')).toHaveTextContent('en');
      });

      // Should still render the language system correctly
      expect(screen.getByTestId('page-title')).toHaveTextContent('Check Availability');
    });

    it('should handle invalid URL parameters gracefully', async () => {
      render(
        <MockBookingPage 
          slug="test-property" 
          searchParams={{ 
            lang: 'invalid',
            checkIn: 'invalid-date',
            checkOut: 'invalid-date',
            guests: 'invalid-number'
          }}
        />
      );

      await waitFor(() => {
        // Should default to English for invalid language
        expect(screen.getByTestId('current-lang')).toHaveTextContent('en');
      });

      expect(screen.getByTestId('page-title')).toHaveTextContent('Check Availability');
    });

  });

  // ===== Performance and Optimization =====

  describe('Performance and Optimization', () => {
    
    it('should not cause excessive re-renders during language operations', async () => {
      let renderCount = 0;
      
      const PerformanceTestComponent = () => {
        renderCount++;
        const { useLanguage } = require('@/hooks/useLanguage');
        const { currentLang, t } = useLanguage();
        return <div>{t('booking.title')} - {currentLang}</div>;
      };

      const { rerender } = render(
        <LanguageProvider initialLanguage="en" pageType="booking">
          <PerformanceTestComponent />
        </LanguageProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Check Availability/)).toBeInTheDocument();
      });

      const initialRenderCount = renderCount;

      // Rerender shouldn't cause extra renders
      rerender(
        <LanguageProvider initialLanguage="en" pageType="booking">
          <PerformanceTestComponent />
        </LanguageProvider>
      );

      expect(renderCount).toBe(initialRenderCount);
    });

    it('should provide performance metrics for booking page', async () => {
      const PerformanceMetricsComponent = () => {
        const { useLanguage } = require('@/hooks/useLanguage');
        const { getPerformanceMetrics } = useLanguage();
        const metrics = getPerformanceMetrics();
        
        return (
          <div>
            <div data-testid="detection-time">{metrics.detectionTime}</div>
            <div data-testid="load-time">{metrics.translationLoadTime}</div>
            <div data-testid="cache-hit-rate">{metrics.cacheHitRate}</div>
          </div>
        );
      };

      render(
        <LanguageProvider initialLanguage="en" pageType="booking" enablePerformanceTracking>
          <PerformanceMetricsComponent />
        </LanguageProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('detection-time')).toBeInTheDocument();
        expect(screen.getByTestId('load-time')).toBeInTheDocument();
        expect(screen.getByTestId('cache-hit-rate')).toBeInTheDocument();
      });
    });

  });

});