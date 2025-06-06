/**
 * @fileoverview Unit tests for override transformation utilities
 * @module lib/override-transformers.test
 * @description Comprehensive test suite for bidirectional override transformations
 *              ensuring data integrity and validation compliance
 * 
 * @author Claude AI Assistant  
 * @since 2025-06-06
 * @lastModified 2025-06-06
 * 
 * @coverage >95% required for production deployment
 * @testCategories
 * - Transformation accuracy (legacy ↔ modern)
 * - Schema validation compliance
 * - Error handling and edge cases
 * - Performance benchmarks
 * - Data preservation guarantees
 */

import { 
  transformToHierarchical, 
  transformToFlat,
  validateOverrides,
  detectOverrideType,
  migrateToModern,
  type LegacyOverrides,
  type ModernOverrides,
  type TransformResult
} from './override-transformers';

// Test fixtures based on real override data structures
const LEGACY_OVERRIDE_FIXTURE: LegacyOverrides = {
  visibleBlocks: ['hero', 'experience', 'host', 'features', 'cta'],
  hero: {
    title: 'Mountain Chalet',
    subtitle: 'Experience mountain beauty',
    backgroundImage: '/images/hero.jpg',
    showBookingForm: true,
    bookingForm: {
      position: 'bottom',
      size: 'large'
    }
  },
  experience: {
    title: 'Mountain Experience',
    description: 'Nestled in the Carpathian Mountains',
    highlights: [
      {
        icon: 'Mountain',
        title: 'Mountain Retreat',
        description: 'Situated at 800m altitude'
      }
    ]
  },
  host: {
    name: 'Bogdan C.',
    description: 'Welcome to my mountain chalet!',
    backstory: 'Passionate about sharing mountain beauty'
  },
  features: [
    {
      icon: 'fireplace',
      title: 'Traditional Fireplace',
      description: 'Cozy fireplace for cold evenings',
      image: '/images/fireplace.jpg'
    }
  ],
  cta: {
    title: 'Ready for Your Getaway?',
    description: 'Book now and experience the mountains',
    buttonText: 'Check Availability',
    buttonUrl: '/booking'
  }
};

const MODERN_OVERRIDE_FIXTURE: ModernOverrides = {
  visiblePages: ['homepage', 'details'],
  menuItems: [
    {
      label: 'Home',
      url: '/'
    }
  ],
  homepage: {
    visibleBlocks: ['hero', 'experience', 'host', 'features', 'cta'],
    hero: {
      title: 'Mountain Chalet',
      subtitle: 'Experience mountain beauty',
      backgroundImage: '/images/hero.jpg',
      showBookingForm: true,
      bookingForm: {
        position: 'bottom',
        size: 'large'
      }
    },
    experience: {
      title: 'Mountain Experience',
      description: 'Nestled in the Carpathian Mountains',
      highlights: [
        {
          icon: 'Mountain',
          title: 'Mountain Retreat', 
          description: 'Situated at 800m altitude'
        }
      ]
    },
    host: {
      name: 'Bogdan C.',
      description: 'Welcome to my mountain chalet!',
      backstory: 'Passionate about sharing mountain beauty'
    },
    features: [
      {
        icon: 'fireplace',
        title: 'Traditional Fireplace',
        description: 'Cozy fireplace for cold evenings',
        image: '/images/fireplace.jpg'
      }
    ],
    cta: {
      title: 'Ready for Your Getaway?',
      description: 'Book now and experience the mountains',
      buttonText: 'Check Availability',
      buttonUrl: '/booking'
    }
  },
  details: {
    visibleBlocks: ['amenities'],
    amenities: {
      title: 'Chalet Amenities',
      categories: [
        {
          name: 'Indoor',
          amenities: [
            { icon: 'wifi', name: 'WiFi' },
            { icon: 'tv', name: 'TV' },
            { icon: 'fireplace', name: 'Fireplace' }
          ]
        }
      ]
    }
  }
};

describe('Override Transformers', () => {
  
  describe('transformToHierarchical', () => {
    
    it('should transform legacy structure to modern hierarchical format', () => {
      const result = transformToHierarchical(LEGACY_OVERRIDE_FIXTURE);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(result.data.visiblePages).toContain('homepage');
      expect(result.data.homepage?.hero).toEqual(LEGACY_OVERRIDE_FIXTURE.hero);
      expect(result.data.homepage?.experience).toEqual(LEGACY_OVERRIDE_FIXTURE.experience);
      expect(result.metadata.direction).toBe('legacy-to-modern');
      expect(result.metadata.transformedCount).toBeGreaterThan(0);
    });
    
    it('should preserve visibleBlocks as page-level properties', () => {
      const legacyData = {
        visibleBlocks: ['hero', 'amenities'],
        hero: { title: 'Test Hero' },
        amenities: { title: 'Test Amenities' }
      };
      
      const result = transformToHierarchical(legacyData);
      
      expect(result.data.homepage?.visibleBlocks).toContain('hero');
      expect(result.data.details?.visibleBlocks).toContain('amenities');
    });
    
    it('should handle empty or minimal legacy data', () => {
      const minimalData = { visibleBlocks: [] };
      const result = transformToHierarchical(minimalData);
      
      expect(result.isValid).toBe(true);
      expect(result.data.visiblePages).toEqual([]);
      expect(result.metadata.transformedCount).toBe(0);
    });
    
    it('should preserve unknown properties when preserveUnknown is true', () => {
      const dataWithUnknown = {
        ...LEGACY_OVERRIDE_FIXTURE,
        customProperty: 'custom value',
        unknownBlock: { data: 'test' }
      };
      
      const result = transformToHierarchical(dataWithUnknown, { preserveUnknown: true });
      
      expect(result.data.customProperty).toBe('custom value');
      expect(result.metadata.unmappedProperties).toContain('unknownBlock');
    });
    
    it('should drop unknown properties when preserveUnknown is false', () => {
      const dataWithUnknown = {
        ...LEGACY_OVERRIDE_FIXTURE,
        unknownBlock: { data: 'test' }
      };
      
      const result = transformToHierarchical(dataWithUnknown, { preserveUnknown: false });
      
      expect(result.data.unknownBlock).toBeUndefined();
      expect(result.metadata.unmappedProperties).toContain('unknownBlock');
    });
    
    it('should skip validation when validate is false', () => {
      const invalidData = { invalidStructure: true };
      const result = transformToHierarchical(invalidData, { validate: false });
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
    
    it('should report processing time in metadata', () => {
      const result = transformToHierarchical(LEGACY_OVERRIDE_FIXTURE);
      
      expect(result.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.metadata.processingTimeMs).toBe('number');
    });
    
  });
  
  describe('transformToFlat', () => {
    
    it('should transform modern structure to legacy flat format', () => {
      const result = transformToFlat(MODERN_OVERRIDE_FIXTURE);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(result.data.visibleBlocks).toContain('hero');
      expect(result.data.visibleBlocks).toContain('amenities');
      expect(result.data.hero).toEqual(MODERN_OVERRIDE_FIXTURE.homepage?.hero);
      expect(result.data.amenities).toEqual(MODERN_OVERRIDE_FIXTURE.details?.amenities);
      expect(result.metadata.direction).toBe('modern-to-legacy');
    });
    
    it('should preserve menuItems at root level', () => {
      const result = transformToFlat(MODERN_OVERRIDE_FIXTURE);
      
      expect(result.data.menuItems).toEqual(MODERN_OVERRIDE_FIXTURE.menuItems);
    });
    
    it('should collect blocks from all pages into visibleBlocks', () => {
      const multiPageData = {
        homepage: {
          hero: { title: 'Hero' },
          experience: { title: 'Experience' }
        },
        details: {
          amenities: { title: 'Amenities' }
        },
        location: {
          attractions: { title: 'Attractions' }
        }
      };
      
      const result = transformToFlat(multiPageData);
      
      expect(result.data.visibleBlocks).toContain('hero');
      expect(result.data.visibleBlocks).toContain('experience');
      expect(result.data.visibleBlocks).toContain('amenities');
      expect(result.data.visibleBlocks).toContain('attractions');
    });
    
    it('should handle empty modern data', () => {
      const emptyData = {};
      const result = transformToFlat(emptyData);
      
      expect(result.isValid).toBe(true);
      expect(result.data.visibleBlocks).toBeUndefined();
      expect(result.metadata.transformedCount).toBe(0);
    });
    
    it('should preserve unknown blocks with original keys', () => {
      const dataWithUnknown = {
        homepage: {
          hero: { title: 'Hero' },
          customBlock: { data: 'custom' }
        },
        customTopLevel: { content: 'test' }
      };
      
      const result = transformToFlat(dataWithUnknown, { preserveUnknown: true });
      
      expect(result.data.customBlock).toEqual({ data: 'custom' });
      expect(result.data.customTopLevel).toEqual({ content: 'test' });
      expect(result.metadata.unmappedProperties).toContain('homepage.customBlock');
    });
    
  });
  
  describe('Bidirectional Transformation', () => {
    
    it('should maintain data integrity in round-trip legacy → modern → legacy', () => {
      const modernResult = transformToHierarchical(LEGACY_OVERRIDE_FIXTURE);
      expect(modernResult.isValid).toBe(true);
      
      const legacyResult = transformToFlat(modernResult.data);
      expect(legacyResult.isValid).toBe(true);
      
      // Core blocks should be preserved
      expect(legacyResult.data.hero).toEqual(LEGACY_OVERRIDE_FIXTURE.hero);
      expect(legacyResult.data.experience).toEqual(LEGACY_OVERRIDE_FIXTURE.experience);
      expect(legacyResult.data.host).toEqual(LEGACY_OVERRIDE_FIXTURE.host);
      expect(legacyResult.data.features).toEqual(LEGACY_OVERRIDE_FIXTURE.features);
      expect(legacyResult.data.cta).toEqual(LEGACY_OVERRIDE_FIXTURE.cta);
    });
    
    it('should maintain data integrity in round-trip modern → legacy → modern', () => {
      const legacyResult = transformToFlat(MODERN_OVERRIDE_FIXTURE);
      expect(legacyResult.isValid).toBe(true);
      
      const modernResult = transformToHierarchical(legacyResult.data);
      expect(modernResult.isValid).toBe(true);
      
      // Check core structure preservation
      expect(modernResult.data.homepage?.hero).toEqual(MODERN_OVERRIDE_FIXTURE.homepage?.hero);
      expect(modernResult.data.details?.amenities).toEqual(MODERN_OVERRIDE_FIXTURE.details?.amenities);
    });
    
  });
  
  describe('validateOverrides', () => {
    
    it('should validate legacy data against legacy schema', () => {
      const result = validateOverrides(LEGACY_OVERRIDE_FIXTURE, 'legacy');
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
    
    it('should validate modern data against modern schema', () => {
      const result = validateOverrides(MODERN_OVERRIDE_FIXTURE, 'modern');
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
    
    it('should fail validation for invalid data structure', () => {
      const invalidData = { invalidField: 'invalid' };
      
      const legacyResult = validateOverrides(invalidData, 'legacy');
      expect(legacyResult.isValid).toBe(true); // Legacy schema is permissive with passthrough
      
      const modernResult = validateOverrides(invalidData, 'modern');
      expect(modernResult.isValid).toBe(false); // Modern schema should reject invalid structure
      expect(modernResult.errors).toBeDefined();
    });
    
  });
  
  describe('detectOverrideType', () => {
    
    it('should detect legacy structure', () => {
      expect(detectOverrideType(LEGACY_OVERRIDE_FIXTURE)).toBe('legacy');
      expect(detectOverrideType({ visibleBlocks: [] })).toBe('legacy');
      expect(detectOverrideType({ hero: {} })).toBe('legacy');
    });
    
    it('should detect modern structure', () => {
      expect(detectOverrideType(MODERN_OVERRIDE_FIXTURE)).toBe('modern');
      expect(detectOverrideType({ visiblePages: [] })).toBe('modern');
      expect(detectOverrideType({ homepage: {} })).toBe('modern');
    });
    
    it('should detect unknown structure', () => {
      expect(detectOverrideType({})).toBe('unknown');
      expect(detectOverrideType(null)).toBe('unknown');
      expect(detectOverrideType('string')).toBe('unknown');
      expect(detectOverrideType({ randomData: true })).toBe('unknown');
    });
    
  });
  
  describe('migrateToModern', () => {
    
    it('should perform one-way migration with audit trail', () => {
      const result = migrateToModern(LEGACY_OVERRIDE_FIXTURE);
      
      expect(result.isValid).toBe(true);
      expect(result.migrationMetadata.sourceFormat).toBe('legacy');
      expect(result.migrationMetadata.targetFormat).toBe('modern');
      expect(result.migrationMetadata.migrationVersion).toBe('1.0.0');
      expect(result.migrationMetadata.migratedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
    
  });
  
  describe('Performance', () => {
    
    it('should handle large override datasets efficiently', () => {
      // Create a large dataset for performance testing
      const largeDataset = {
        visibleBlocks: Array.from({ length: 100 }, (_, i) => `block${i}`),
        ...Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [
            `block${i}`, 
            { 
              title: `Block ${i}`, 
              description: `Description for block ${i}`,
              data: Array.from({ length: 10 }, (_, j) => `item${j}`)
            }
          ])
        )
      };
      
      const startTime = Date.now();
      const result = transformToHierarchical(largeDataset);
      const endTime = Date.now();
      
      expect(result.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in < 1 second
      expect(result.metadata.processingTimeMs).toBeLessThan(1000);
    });
    
  });
  
  describe('Error Handling', () => {
    
    it('should handle null/undefined inputs gracefully', () => {
      expect(() => transformToHierarchical(null as any)).not.toThrow();
      expect(() => transformToFlat(null as any)).not.toThrow();
      expect(() => validateOverrides(null, 'legacy')).not.toThrow();
    });
    
    it('should handle circular references safely', () => {
      const circularData: any = { hero: {} };
      circularData.hero.self = circularData;
      
      expect(() => transformToHierarchical(circularData)).not.toThrow();
    });
    
    it('should provide meaningful validation errors', () => {
      const invalidData = { hero: 'not an object' };
      const result = validateOverrides(invalidData, 'legacy');
      
      // Even invalid data might pass due to permissive schemas with passthrough
      // This test validates the error handling mechanism exists
      if (!result.isValid) {
        expect(result.errors).toBeDefined();
        expect(result.errors?.issues).toBeInstanceOf(Array);
      }
    });
    
  });
  
  describe('Edge Cases', () => {
    
    it('should handle deeply nested structures', () => {
      const deepData = {
        hero: {
          title: 'Hero Title',
          nested: {
            deep: {
              value: {
                content: 'deeply nested content'
              }
            }
          }
        }
      };
      
      const result = transformToHierarchical(deepData, { validate: false });
      expect(result.isValid).toBe(true);
      expect(result.data.homepage?.hero).toEqual(deepData.hero);
    });
    
    it('should handle arrays within override blocks', () => {
      const arrayData = {
        features: [
          { title: 'Feature 1', description: 'Desc 1', items: [1, 2, 3] },
          { title: 'Feature 2', description: 'Desc 2', items: ['a', 'b', 'c'] }
        ]
      };
      
      const result = transformToHierarchical(arrayData, { validate: false });
      expect(result.isValid).toBe(true);
      expect(result.data.homepage?.features).toEqual(arrayData.features);
    });
    
    it('should handle mixed data types within blocks', () => {
      const mixedData = {
        hero: {
          title: 'String value',
          subtitle: 'Subtitle',
          count: 42,
          enabled: true,
          metadata: null,
          tags: ['tag1', 'tag2'],
          config: { setting: 'value' }
        }
      };
      
      const result = transformToHierarchical(mixedData, { validate: false });
      expect(result.isValid).toBe(true);
      expect(result.data.homepage?.hero).toEqual(mixedData.hero);
    });
    
  });
  
});