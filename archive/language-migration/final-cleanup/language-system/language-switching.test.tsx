/**
 * @fileoverview Language Switching Tests for Booking Pages
 * @module tests/language-system/language-switching
 * 
 * @description
 * Tests for language switching functionality in booking pages with path-based detection.
 * Covers the LanguageProvider switchLanguage method and navigation behavior.
 * 
 * @test-coverage
 * - Language switching navigation
 * - Path-based URL construction during switches
 * - Query parameter cleanup
 * - Integration with booking pages
 * - Error handling and edge cases
 * 
 * @since v2.0.0
 * @author RentalSpot Team
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/lib/language-system/LanguageProvider';
import { LanguageSelector } from '@/components/language-selector';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '@/lib/language-constants';

// Mock Next.js router
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockPathname = '/booking/check/test-property';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  usePathname: () => mockPathname,
}));

// Mock window location
const mockLocation = {
  origin: 'http://localhost:9002',
  pathname: '/booking/check/test-property',
  search: '?checkIn=2025-06-24&checkOut=2025-06-27',
  href: 'http://localhost:9002/booking/check/test-property?checkIn=2025-06-24&checkOut=2025-06-27'
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock translation cache
jest.mock('@/lib/language-system/translation-cache', () => ({
  globalTranslationCache: {
    getTranslations: jest.fn().mockResolvedValue({
      content: {
        'booking.checkDates': 'Check Dates',
        'booking.checkInCheckOut': 'Check-in / Check-out'
      },
      fromCache: true
    }),
    getStats: jest.fn().mockReturnValue({ hitRate: 100 })
  }
}));

// Mock language detection
jest.mock('@/lib/language-system/language-detection', () => ({
  detectLanguage: jest.fn().mockResolvedValue({
    language: 'en',
    source: 'default',
    confidence: 1.0
  }),
  createDetectionConfig: jest.fn(),
  createLocalizedPath: jest.fn((path, language, pageType) => {
    if (pageType === 'booking') {
      return language === 'en' ? path : `${path}/${language}`;
    }
    return `/${language}${path}`;
  }),
  isSupportedLanguage: jest.fn((lang) => SUPPORTED_LANGUAGES.includes(lang)),
  getAvailableLanguages: jest.fn(() => SUPPORTED_LANGUAGES)
}));

describe('Language Switching in Booking Pages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.pathname = '/booking/check/test-property';
    mockLocation.search = '?checkIn=2025-06-24&checkOut=2025-06-27';
  });

  const renderWithProvider = (children: React.ReactNode, props = {}) => {
    return render(
      <LanguageProvider 
        initialLanguage="en" 
        pageType="booking" 
        enablePerformanceTracking={false}
        {...props}
      >
        {children}
      </LanguageProvider>
    );
  };

  describe('Language Selector Integration', () => {
    test('should render language selector with current language', async () => {
      renderWithProvider(<LanguageSelector />);
      
      await waitFor(() => {
        expect(screen.getByText(/EN/)).toBeInTheDocument();
      });
    });

    test('should switch language when option is selected', async () => {
      renderWithProvider(<LanguageSelector />);
      
      // Find and click the dropdown trigger
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      // Wait for dropdown to appear and click Romanian option
      await waitFor(() => {
        const romanianOption = screen.getByText(/Română/);
        fireEvent.click(romanianOption);
      });
      
      // Should call router.replace with path-based URL
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith(
          expect.stringMatching(/\/booking\/check\/test-property\/ro/)
        );
      });
    });

    test('should preserve query parameters during language switch', async () => {
      renderWithProvider(<LanguageSelector />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      await waitFor(() => {
        const romanianOption = screen.getByText(/Română/);
        fireEvent.click(romanianOption);
      });
      
      // Should preserve checkIn and checkOut parameters
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith(
          expect.stringContaining('checkIn=2025-06-24&checkOut=2025-06-27')
        );
      });
    });
  });

  describe('Path-Based URL Construction', () => {
    test('should construct correct Romanian URL', async () => {
      renderWithProvider(<LanguageSelector />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      await waitFor(() => {
        const romanianOption = screen.getByText(/Română/);
        fireEvent.click(romanianOption);
      });
      
      expect(mockReplace).toHaveBeenCalledWith(
        '/booking/check/test-property/ro?checkIn=2025-06-24&checkOut=2025-06-27'
      );
    });

    test('should construct correct English URL without language segment', async () => {
      // Start with Romanian and switch to English
      renderWithProvider(<LanguageSelector />, { initialLanguage: 'ro' });
      mockLocation.pathname = '/booking/check/test-property/ro';
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      await waitFor(() => {
        const englishOption = screen.getByText(/English/);
        fireEvent.click(englishOption);
      });
      
      expect(mockReplace).toHaveBeenCalledWith(
        '/booking/check/test-property?checkIn=2025-06-24&checkOut=2025-06-27'
      );
    });

    test('should handle existing language segments correctly', async () => {
      mockLocation.pathname = '/booking/check/test-property/en';
      
      renderWithProvider(<LanguageSelector />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      await waitFor(() => {
        const romanianOption = screen.getByText(/Română/);
        fireEvent.click(romanianOption);
      });
      
      // Should replace existing language segment
      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringMatching(/\/booking\/check\/test-property\/ro/)
      );
    });
  });

  describe('Query Parameter Cleanup', () => {
    test('should remove legacy lang query parameters', async () => {
      mockLocation.search = '?lang=en&checkIn=2025-06-24&checkOut=2025-06-27';
      
      renderWithProvider(<LanguageSelector />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      await waitFor(() => {
        const romanianOption = screen.getByText(/Română/);
        fireEvent.click(romanianOption);
      });
      
      // Should not contain lang parameter
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith(
          expect.not.stringContaining('lang=')
        );
      });
    });

    test('should remove legacy language query parameters', async () => {
      mockLocation.search = '?language=en&checkIn=2025-06-24&checkOut=2025-06-27';
      
      renderWithProvider(<LanguageSelector />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      await waitFor(() => {
        const romanianOption = screen.getByText(/Română/);
        fireEvent.click(romanianOption);
      });
      
      // Should not contain language parameter
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith(
          expect.not.stringContaining('language=')
        );
      });
    });

    test('should preserve other query parameters', async () => {
      mockLocation.search = '?lang=en&checkIn=2025-06-24&checkOut=2025-06-27&currency=EUR&guests=4';
      
      renderWithProvider(<LanguageSelector />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      await waitFor(() => {
        const romanianOption = screen.getByText(/Română/);
        fireEvent.click(romanianOption);
      });
      
      // Should preserve non-language parameters
      await waitFor(() => {
        const call = mockReplace.mock.calls[0][0];
        expect(call).toContain('checkIn=2025-06-24');
        expect(call).toContain('checkOut=2025-06-27');
        expect(call).toContain('currency=EUR');
        expect(call).toContain('guests=4');
        expect(call).not.toContain('lang=');
      });
    });
  });

  describe('localStorage Integration', () => {
    test('should update localStorage on language change', async () => {
      renderWithProvider(<LanguageSelector />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      await waitFor(() => {
        const romanianOption = screen.getByText(/Română/);
        fireEvent.click(romanianOption);
      });
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('preferredLanguage', 'ro');
    });

    test('should handle localStorage errors gracefully', async () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });
      
      renderWithProvider(<LanguageSelector />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      await waitFor(() => {
        const romanianOption = screen.getByText(/Română/);
        fireEvent.click(romanianOption);
      });
      
      // Should still call router.replace despite localStorage error
      expect(mockReplace).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid language codes gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Mock a component that tries to switch to invalid language
      const TestComponent = () => {
        const { switchLanguage } = require('@/lib/language-system').useLanguage();
        return (
          <button onClick={() => switchLanguage('invalid')}>
            Switch to Invalid
          </button>
        );
      };
      
      renderWithProvider(<TestComponent />);
      
      const button = screen.getByText('Switch to Invalid');
      fireEvent.click(button);
      
      // Should not call router navigation for invalid language
      expect(mockReplace).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test('should handle same language switching gracefully', async () => {
      renderWithProvider(<LanguageSelector />);
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      // Click on the currently selected language (English)
      await waitFor(() => {
        const englishOption = screen.getByText(/English/);
        fireEvent.click(englishOption);
      });
      
      // Should not trigger navigation for same language
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    test('should not cause unnecessary re-renders during language switch', async () => {
      let renderCount = 0;
      
      const TestComponent = () => {
        renderCount++;
        return <LanguageSelector />;
      };
      
      renderWithProvider(<TestComponent />);
      
      const initialRenderCount = renderCount;
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      await waitFor(() => {
        const romanianOption = screen.getByText(/Română/);
        fireEvent.click(romanianOption);
      });
      
      // Should have minimal re-renders
      expect(renderCount - initialRenderCount).toBeLessThanOrEqual(3);
    });

    test('should complete language switch quickly', async () => {
      renderWithProvider(<LanguageSelector />);
      
      const startTime = performance.now();
      
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);
      
      await waitFor(() => {
        const romanianOption = screen.getByText(/Română/);
        fireEvent.click(romanianOption);
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete in under 100ms
      expect(duration).toBeLessThan(100);
    });
  });
});