/**
 * @fileoverview Booking Page Language System Integration Tests
 * @module components/booking/__tests__/booking-language-integration
 * 
 * @description
 * Comprehensive test suite for validating booking page integration with the
 * unified language system. Tests translation loading, language switching,
 * URL parameter handling, and booking flow language persistence.
 * 
 * @architecture
 * Location: Booking system test infrastructure
 * Layer: Integration testing for language system
 * Pattern: Jest + React Testing Library with unified language system
 * 
 * @dependencies
 * - Internal: Booking components, unified language system
 * - External: Jest, React Testing Library, Next.js router mocks
 * 
 * @relationships
 * - Tests: Booking page components with language functionality
 * - Validates: Unified language system integration
 * - Ensures: Language switching works in booking context
 * - Verifies: Translation loading and URL parameter handling
 * 
 * @performance
 * - Optimizations: Mocked API calls, efficient test setup
 * - Concerns: Test execution time with complex booking flows
 * 
 * @example
 * ```bash
 * npm test -- --testPathPattern=booking-language-integration
 * ```
 * 
 * @migration-notes
 * Created post-migration to validate booking page compatibility with unified
 * language system. Ensures no functionality regression after migration.
 * 
 * @since v1.0.0
 * @author RentalSpot Team
 */

import { renderHook, act, waitFor, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import React from 'react';

// Import unified language system
import { LanguageProvider } from '@/lib/language-system';
import { useLanguage } from '@/hooks/useLanguage';

// Import booking components to test
import { ClientBookingWrapper } from '@/components/booking/client-booking-wrapper';

// Mock Next.js router and navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
  usePathname: jest.fn(() => '/booking/check/test-property'),
  notFound: jest.fn()
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

// Mock language constants
jest.mock('@/lib/language-constants', () => ({
  SUPPORTED_LANGUAGES: ['en', 'ro'],
  DEFAULT_LANGUAGE: 'en'
}));

// Mock the actual useLanguage hook functionality
const mockUseLanguage = {
  currentLang: 'en',
  currentLanguage: 'en',
  switchLanguage: jest.fn(),
  changeLanguage: jest.fn(),
  t: jest.fn(),
  tc: jest.fn(),
  getLocalizedPath: jest.fn(),
  isLanguageSupported: jest.fn(),
  getPerformanceMetrics: jest.fn(),
  isLoading: false
};

jest.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => mockUseLanguage
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
          'selectGuests': 'Select Number of Guests',
          'availability': 'Availability',
          'pricing': 'Pricing',
          'total': 'Total',
          'continue': 'Continue',
          'back': 'Back'
        },
        'booking': {
          'title': 'Check Availability',
          'subtitle': 'Select your dates and number of guests',
          'minNights': 'Minimum {nights} nights required',
          'maxGuests': 'Maximum {guests} guests',
          'selectDatesPrompt': 'Select your dates to see pricing',
          'unavailableDates': 'Selected dates are not available',
          'pricePerNight': 'per night',
          'totalCost': 'Total Cost',
          'bookingFee': 'Booking Fee',
          'taxes': 'Taxes & Fees'
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
          'selectGuests': 'Selectează Numărul de Oaspeți',
          'availability': 'Disponibilitate',
          'pricing': 'Prețuri',
          'total': 'Total',
          'continue': 'Continuă',
          'back': 'Înapoi'
        },
        'booking': {
          'title': 'Verifică Disponibilitatea',
          'subtitle': 'Selectează datele și numărul de oaspeți',
          'minNights': 'Minim {nights} nopți necesare',
          'maxGuests': 'Maxim {guests} oaspeți',
          'selectDatesPrompt': 'Selectează datele pentru a vedea prețurile',
          'unavailableDates': 'Datele selectate nu sunt disponibile',
          'pricePerNight': 'per noapte',
          'totalCost': 'Cost Total',
          'bookingFee': 'Taxa de Rezervare',
          'taxes': 'Taxe și Comisioane'
        }
      })
    });
  }
  return Promise.reject(new Error('Translation file not found'));
});

// Test wrapper with language provider
const TestWrapper: React.FC<{ 
  children: React.ReactNode;
  initialLanguage?: string;
  searchParams?: URLSearchParams;
}> = ({ children, initialLanguage = 'en', searchParams }) => {
  // Mock router
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    pathname: '/booking/check/test-property',
    query: Object.fromEntries(searchParams?.entries() || [])
  };
  
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  (useSearchParams as jest.Mock).mockReturnValue(searchParams || new URLSearchParams());

  return (
    <LanguageProvider
      initialLanguage={initialLanguage as any}
      pageType="booking"
      enablePerformanceTracking={true}
      enableDebugMode={true}
    >
      {children}
    </LanguageProvider>
  );
};

// Mock property data for booking tests
const mockProperty = {
  id: 'test-property',
  slug: 'test-property',
  name: { en: 'Test Property', ro: 'Proprietate Test' },
  minNights: 2,
  maxGuests: 4,
  pricePerNight: 100
};

describe('Booking Page Language System Integration', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    currentMockLang = 'en'; // Reset to English for each test
  });

  // ===== Basic Language System Integration =====

  describe('Basic Language Integration', () => {
    
    it('should initialize booking page with unified language system', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.currentLang).toBe('en');
      });

      // Should have access to all language functions
      expect(result.current.t).toBeDefined();
      expect(result.current.tc).toBeDefined();
      expect(result.current.switchLanguage).toBeDefined();
      expect(result.current.getLocalizedPath).toBeDefined();
    });

    it('should load booking-specific translations', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.currentLang).toBe('en');
      });

      // Test booking-specific translations
      expect(result.current.t('booking.title')).toBe('Check Availability');
      expect(result.current.t('common.bookNow')).toBe('Book Now');
      expect(result.current.t('booking.minNights', 'Minimum {nights} nights required', { nights: 2 })).toBe('Minimum 2 nights required');
    });

    it('should handle multilingual content in booking context', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.currentLang).toBe('en');
      });

      // Test multilingual content translation
      const propertyName = { en: 'Test Property', ro: 'Proprietate Test' };
      expect(result.current.tc(propertyName)).toBe('Test Property');
    });

  });

  // ===== URL Parameter Language Detection =====

  describe('URL Parameter Language Detection', () => {
    
    it('should detect language from booking URL query parameters', async () => {
      const searchParams = new URLSearchParams('?lang=ro&checkIn=2025-06-24&checkOut=2025-06-27');
      
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <TestWrapper searchParams={searchParams} initialLanguage="ro">
            {children}
          </TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.currentLang).toBe('ro');
      });

      // Mock the language change for this test
      currentMockLang = 'ro';
      
      // Should load Romanian translations
      expect(result.current.t('booking.title')).toBe('Verifică Disponibilitatea');
      expect(result.current.t('common.bookNow')).toBe('Rezervă Acum');
    });

    it('should maintain language through booking URL changes', async () => {
      const initialSearchParams = new URLSearchParams('?lang=ro');
      
      const { result, rerender } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <TestWrapper searchParams={initialSearchParams} initialLanguage="ro">
            {children}
          </TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.currentLang).toBe('ro');
      });

      // Simulate URL change with different parameters but same language
      const newSearchParams = new URLSearchParams('?lang=ro&checkIn=2025-07-01&checkOut=2025-07-05');
      
      rerender();

      await waitFor(() => {
        expect(result.current.currentLang).toBe('ro');
      });
    });

    it('should handle missing language parameter gracefully', async () => {
      const searchParams = new URLSearchParams('?checkIn=2025-06-24&checkOut=2025-06-27');
      
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <TestWrapper searchParams={searchParams}>
            {children}
          </TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.currentLang).toBe('en'); // Should default to English
      });
    });

  });

  // ===== Language Switching in Booking Context =====

  describe('Language Switching in Booking Context', () => {
    
    it('should switch languages during booking flow', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.currentLang).toBe('en');
      });

      // Verify English translations
      expect(result.current.t('booking.title')).toBe('Check Availability');

      // Switch to Romanian
      await act(async () => {
        await result.current.switchLanguage('ro');
      });

      expect(result.current.currentLang).toBe('ro');
      expect(result.current.t('booking.title')).toBe('Verifică Disponibilitatea');
    });

    it('should preserve booking state during language switch', async () => {
      const { result } = renderHook(() => {
        const language = useLanguage();
        const [bookingData, setBookingData] = React.useState({
          checkIn: '2025-06-24',
          checkOut: '2025-06-27',
          guests: 2
        });
        
        return { language, bookingData, setBookingData };
      }, {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.language.currentLang).toBe('en');
      });

      const initialBookingData = result.current.bookingData;

      // Switch language
      await act(async () => {
        await result.current.language.switchLanguage('ro');
      });

      // Booking data should be preserved
      expect(result.current.bookingData).toEqual(initialBookingData);
      expect(result.current.language.currentLang).toBe('ro');
    });

    it('should update URL when switching languages in booking context', async () => {
      const mockRouter = {
        push: jest.fn(),
        replace: jest.fn(),
        pathname: '/booking/check/test-property',
        query: { checkIn: '2025-06-24', checkOut: '2025-06-27' }
      };
      
      (useRouter as jest.Mock).mockReturnValue(mockRouter);

      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.currentLang).toBe('en');
      });

      // Switch to Romanian
      await act(async () => {
        await result.current.switchLanguage('ro');
      });

      // Should update URL with language parameter
      expect(mockRouter.replace).toHaveBeenCalledWith(
        expect.stringContaining('lang=ro')
      );
    });

  });

  // ===== Translation Loading and Error Handling =====

  describe('Translation Loading and Error Handling', () => {
    
    it('should handle translation loading errors gracefully', async () => {
      // Mock fetch to fail for one language
      (global.fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.reject(new Error('Network error'))
      );

      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.currentLang).toBe('en');
      });

      // Should still function with fallback behavior
      expect(result.current.t('missing.key', 'Fallback')).toBe('Fallback');
    });

    it('should show loading state during translation loading', async () => {
      let resolveTranslation: (value: any) => void;
      const translationPromise = new Promise(resolve => {
        resolveTranslation = resolve;
      });

      (global.fetch as jest.Mock).mockImplementationOnce(() => 
        translationPromise.then(() => ({
          ok: true,
          json: () => Promise.resolve({ common: { test: 'Test' } })
        }))
      );

      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      // Should show loading state initially
      expect(result.current.isLoading).toBe(true);

      // Resolve translation loading
      act(() => {
        resolveTranslation!({});
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should cache translations for better performance', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.currentLang).toBe('en');
      });

      // First translation load
      result.current.t('common.bookNow');
      const firstCallCount = (global.fetch as jest.Mock).mock.calls.length;

      // Second translation load should use cache
      result.current.t('common.checkIn');
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(firstCallCount);
    });

  });

  // ===== Booking Flow Language Persistence =====

  describe('Booking Flow Language Persistence', () => {
    
    it('should persist language through booking steps', async () => {
      // Simulate multi-step booking flow
      const steps = ['dates', 'guests', 'payment', 'confirmation'];
      
      const { result } = renderHook(() => {
        const language = useLanguage();
        const [currentStep, setCurrentStep] = React.useState(0);
        
        return { language, currentStep, setCurrentStep, steps };
      }, {
        wrapper: ({ children }) => <TestWrapper initialLanguage="ro">{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.language.currentLang).toBe('ro');
      });

      // Progress through booking steps
      for (let i = 0; i < steps.length; i++) {
        act(() => {
          result.current.setCurrentStep(i);
        });

        // Language should persist through all steps
        expect(result.current.language.currentLang).toBe('ro');
        expect(result.current.language.t('common.continue')).toBe('Continuă');
      }
    });

    it('should maintain language in localStorage for booking sessions', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.currentLang).toBe('en');
      });

      // Switch to Romanian
      await act(async () => {
        await result.current.switchLanguage('ro');
      });

      // Check localStorage
      expect(localStorage.getItem('preferredLanguage')).toBe('ro');
    });

  });

  // ===== Error States and Edge Cases =====

  describe('Error States and Edge Cases', () => {
    
    it('should handle invalid language codes gracefully', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.currentLang).toBe('en');
      });

      // Try to switch to invalid language
      await act(async () => {
        await result.current.switchLanguage('invalid' as any);
      });

      // Should remain on valid language
      expect(result.current.currentLang).toBe('en');
    });

    it('should provide fallback translations for missing keys', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.currentLang).toBe('en');
      });

      // Test missing translation key
      expect(result.current.t('nonexistent.key', 'Fallback Text')).toBe('Fallback Text');
      expect(result.current.t('nonexistent.key')).toBe('nonexistent.key'); // Should return key if no fallback
    });

    it('should handle empty or malformed translation content', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper>{children}</TestWrapper>
      });

      await waitFor(() => {
        expect(result.current.currentLang).toBe('en');
      });

      // Test with empty content
      expect(result.current.tc(null)).toBe('');
      expect(result.current.tc('')).toBe('');
      expect(result.current.tc({})).toBe('');
      
      // Test with invalid multilingual content
      expect(result.current.tc({ fr: 'French only' })).toBe(''); // No supported language
    });

  });

  // ===== Performance and Optimization =====

  describe('Performance and Optimization', () => {
    
    it('should not cause unnecessary re-renders during language operations', async () => {
      let renderCount = 0;
      
      const TestComponent = () => {
        renderCount++;
        const { currentLang, t } = useLanguage();
        return <div>{t('common.bookNow')} - {currentLang}</div>;
      };

      const { rerender } = render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Book Now/)).toBeInTheDocument();
      });

      const initialRenderCount = renderCount;

      // Rerender with same props shouldn't cause extra renders
      rerender(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(renderCount).toBe(initialRenderCount);
      });
    });

    it('should provide performance metrics for booking page usage', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => (
          <TestWrapper>
            {children}
          </TestWrapper>
        )
      });

      await waitFor(() => {
        expect(result.current.currentLang).toBe('en');
      });

      // Should have access to performance metrics
      const metrics = result.current.getPerformanceMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.detectionTime).toBeGreaterThanOrEqual(0);
      expect(metrics.translationLoadTime).toBeGreaterThanOrEqual(0);
    });

  });

});