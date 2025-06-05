/**
 * Jest setup file - runs before all tests
 */

// Import jest-dom matchers
require('@testing-library/jest-dom');

// Mock Next.js environment
process.env.NODE_ENV = 'test';

// Mock environment variables for testing
process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.AVAILABILITY_SINGLE_SOURCE = 'false';
process.env.AVAILABILITY_DUAL_CHECK = 'false';
process.env.AVAILABILITY_LEGACY_FALLBACK = 'true';

// Global test utilities
global.console = {
  ...console,
  // Uncomment to suppress console logs during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Mock fetch for API tests
global.fetch = jest.fn();

// Setup custom matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
  
  toBeValidAvailabilityResult(received) {
    const pass = (
      typeof received === 'object' &&
      typeof received.isAvailable === 'boolean' &&
      Array.isArray(received.unavailableDates) &&
      typeof received.source === 'string' &&
      ['availability', 'priceCalendars', 'fallback'].includes(received.source)
    );
    
    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid availability result`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid availability result`,
        pass: false,
      };
    }
  }
});

// Global test data
global.testData = {
  properties: {
    'prahova-mountain-chalet': {
      id: 'prahova-mountain-chalet',
      name: 'Prahova Mountain Chalet',
      pricePerNight: 200,
      baseCurrency: 'RON',
      baseOccupancy: 4,
      extraGuestFee: 25,
      maxGuests: 8,
      cleaningFee: 75
    },
    'coltei-apartment-bucharest': {
      id: 'coltei-apartment-bucharest',
      name: 'Coltei Apartment Bucharest',
      pricePerNight: 150,
      baseCurrency: 'RON',
      baseOccupancy: 2,
      extraGuestFee: 20,
      maxGuests: 4,
      cleaningFee: 50
    }
  },
  
  guestInfo: {
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    phone: '+40123456789'
  }
};

// Mock Firebase modules
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() })),
    fromDate: jest.fn((date) => ({ toDate: () => date }))
  },
  serverTimestamp: jest.fn(() => ({ toDate: () => new Date() })),
  writeBatch: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  addDoc: jest.fn(),
  documentId: jest.fn()
}));

// Mock Firebase app
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn(() => []),
  getApp: jest.fn()
}));

// Performance testing utilities
if (typeof global.gc === 'undefined') {
  global.gc = () => {
    // Mock garbage collection for environments where it's not available
    if (typeof require !== 'undefined') {
      try {
        require('vm').runInNewContext('gc()', { gc: global.gc });
      } catch (e) {
        // Ignore if gc is not available
      }
    }
  };
}

// Test result tracking
global.testResults = {
  performance: [],
  coverage: {},
  failures: []
};

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
  
  // Reset feature flags to default
  process.env.AVAILABILITY_SINGLE_SOURCE = 'false';
  process.env.AVAILABILITY_DUAL_CHECK = 'false';
  process.env.AVAILABILITY_LEGACY_FALLBACK = 'true';
});

// Global error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('🧪 Test environment initialized');
console.log('📊 Feature flags set to default (legacy mode)');
console.log('🔧 Mocks configured for Firebase and Next.js');