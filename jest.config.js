/**
 * Jest configuration for availability deduplication tests
 */

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Test environment
  testEnvironment: 'jsdom',
  
  // Test file patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.{js,ts,tsx}',
    '<rootDir>/src/**/*.test.{js,ts,tsx}'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/lib/availability-service.ts',
    'src/app/api/check-pricing*/route.ts',
    'src/app/api/auth/session/route.ts',
    'src/lib/firebaseAdminNode.ts',
    'src/lib/auth-helpers.ts',
    'src/services/bookingService.ts',
    'src/config/features.ts',
    // Language system coverage
    'src/lib/language-system/**/*.{ts,tsx}',
    'src/components/booking/initial-booking-form.tsx',
    'src/components/language-selector.tsx',
    'src/app/booking/check/[slug]/[[...path]]/page.tsx',
    'src/app/actions/createHoldCheckoutSession.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.{js,ts,tsx}'
  ],
  
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Specific thresholds for availability service
    'src/lib/availability-service.ts': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    // Specific thresholds for language system
    'src/lib/language-system/': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    'src/components/booking/initial-booking-form.tsx': {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Module name mapping for path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // Transform configuration
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }]
  },
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/out/',
    '<rootDir>/build/'
  ],
  
  // Global test timeout
  testTimeout: 30000,
  
  // Verbose output for debugging
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Collect coverage
  collectCoverage: false, // Enable manually with --coverage flag
  
  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Coverage directory
  coverageDirectory: 'coverage',
  
  // Max worker processes for parallel testing
  maxWorkers: '50%',
  
  // Test result processors
  reporters: ['default']
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);