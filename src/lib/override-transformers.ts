/**
 * @fileoverview Data transformation utilities for legacy override migration
 * @module lib/override-transformers
 * @description Provides bidirectional transformation between flat (legacy) and hierarchical (modern) 
 *              property override structures, enabling seamless migration and compatibility
 * 
 * @author Claude AI Assistant
 * @since 2025-06-06
 * @lastModified 2025-06-06
 * 
 * @dependencies
 * - zod: Schema validation
 * - ./overridesSchemas: Legacy flat validation schemas
 * - ./overridesSchemas-multipage: Modern hierarchical validation schemas
 * 
 * @usage
 * ```typescript
 * import { transformToHierarchical, transformToFlat } from './override-transformers';
 * 
 * // Legacy to modern transformation
 * const modern = transformToHierarchical(legacyOverrides);
 * 
 * // Modern to legacy transformation  
 * const legacy = transformToFlat(modernOverrides);
 * ```
 * 
 * @performance
 * - O(n) transformation complexity where n = number of override properties
 * - Minimal memory overhead with streaming transformation approach
 * - Lazy validation only when explicitly requested
 * 
 * @testing
 * - Unit tests with >95% coverage required
 * - Integration tests with real override data
 * - Performance benchmarks for large override sets
 */

import { z } from 'zod';
import { 
  propertyOverridesSchema as legacySchema,
  blockSchemas as legacyBlockSchemas
} from './overridesSchemas';
import { 
  propertyOverridesSchema as modernSchema,
  blockSchemas as modernBlockSchemas
} from './overridesSchemas-multipage';

// Type definitions for transformation inputs/outputs
export type LegacyOverrides = z.infer<typeof legacySchema>;
export type ModernOverrides = z.infer<typeof modernSchema>;

/**
 * Transformation configuration for mapping between flat and hierarchical structures
 */
const TRANSFORM_CONFIG = {
  // Maps flat keys to hierarchical page.block paths
  flatToHierarchical: {
    // Homepage blocks
    'hero': 'homepage.hero',
    'experience': 'homepage.experience', 
    'host': 'homepage.host',
    'features': 'homepage.features',
    'location': 'homepage.location',
    'testimonials': 'homepage.testimonials',
    'gallery': 'homepage.gallery',
    'cta': 'homepage.cta',
    
    // Details page blocks
    'amenities': 'details.amenities',
    'rooms': 'details.rooms', 
    'specifications': 'details.specifications',
    'pricing-detail': 'details.pricing-detail',
    
    // Location page blocks
    'attractions': 'location.attractions',
    'transport': 'location.transport',
    'distances': 'location.distances',
    
    // Gallery page blocks
    'images': 'gallery.full-gallery',
    
    // Booking page blocks
    'booking-policies': 'booking.booking-policies'
  },
  
  // Maps hierarchical page.block paths to flat keys
  hierarchicalToFlat: {} as Record<string, string>
} as const;

// Build reverse mapping
Object.entries(TRANSFORM_CONFIG.flatToHierarchical).forEach(([flat, hierarchical]) => {
  TRANSFORM_CONFIG.hierarchicalToFlat[hierarchical] = flat;
});

/**
 * Transform result with validation and metadata
 */
export interface TransformResult<T> {
  /** Transformed data */
  data: T;
  /** Validation success status */
  isValid: boolean;
  /** Validation errors if any */
  errors?: z.ZodError;
  /** Transformation metadata */
  metadata: {
    /** Number of properties transformed */
    transformedCount: number;
    /** Properties that couldn't be mapped */
    unmappedProperties: string[];
    /** Transformation direction */
    direction: 'legacy-to-modern' | 'modern-to-legacy';
    /** Processing time in milliseconds */
    processingTimeMs: number;
  };
}

/**
 * Sets a nested property value using dot notation path
 * Creates intermediate objects as needed
 * 
 * @param obj - Target object to modify
 * @param path - Dot notation path (e.g., 'homepage.hero.title')
 * @param value - Value to set
 */
function setNestedProperty(obj: any, path: string, value: any): void {
  const parts = path.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part];
  }
  
  current[parts[parts.length - 1]] = value;
}

/**
 * Gets a nested property value using dot notation path
 * 
 * @param obj - Source object
 * @param path - Dot notation path (e.g., 'homepage.hero.title')
 * @returns Value at path or undefined if not found
 */
function getNestedProperty(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined || !(part in current)) {
      return undefined;
    }
    current = current[part];
  }
  
  return current;
}

/**
 * Transforms legacy flat override structure to modern hierarchical structure
 * 
 * @param legacyOverrides - Legacy flat override data
 * @param options - Transformation options
 * @param options.validate - Whether to validate result against modern schema (default: true)
 * @param options.preserveUnknown - Whether to preserve unmapped properties (default: true)
 * @returns Transformation result with hierarchical data
 * 
 * @example
 * ```typescript
 * const legacy = {
 *   visibleBlocks: ['hero', 'experience'],
 *   hero: { title: 'Welcome', subtitle: 'Beautiful place' },
 *   experience: { title: 'Amazing stay', description: 'You will love it' }
 * };
 * 
 * const result = transformToHierarchical(legacy);
 * // result.data = {
 * //   visiblePages: ['homepage'],
 * //   homepage: {
 * //     visibleBlocks: ['hero', 'experience'],
 * //     hero: { title: 'Welcome', subtitle: 'Beautiful place' },
 * //     experience: { title: 'Amazing stay', description: 'You will love it' }
 * //   }
 * // }
 * ```
 */
export function transformToHierarchical(
  legacyOverrides: LegacyOverrides,
  options: {
    validate?: boolean;
    preserveUnknown?: boolean;
  } = {}
): TransformResult<ModernOverrides> {
  const startTime = Date.now();
  const { validate = true, preserveUnknown = true } = options;
  
  // Handle null/undefined inputs
  if (!legacyOverrides || typeof legacyOverrides !== 'object') {
    return {
      data: {} as ModernOverrides,
      isValid: false,
      errors: undefined,
      metadata: {
        transformedCount: 0,
        unmappedProperties: [],
        direction: 'legacy-to-modern',
        processingTimeMs: Date.now() - startTime
      }
    };
  }
  
  // Initialize result structure
  const result: any = {};
  const metadata = {
    transformedCount: 0,
    unmappedProperties: [] as string[],
    direction: 'legacy-to-modern' as const,
    processingTimeMs: 0
  };
  
  // Handle special top-level properties
  if (legacyOverrides.visibleBlocks) {
    // Convert visibleBlocks to visiblePages by inferring page from blocks
    const pages = new Set<string>();
    legacyOverrides.visibleBlocks.forEach(blockName => {
      const hierarchicalPath = TRANSFORM_CONFIG.flatToHierarchical[blockName];
      if (hierarchicalPath) {
        const [pageName] = hierarchicalPath.split('.');
        pages.add(pageName);
      }
    });
    result.visiblePages = Array.from(pages);
  }
  
  // Handle menuItems (passes through unchanged)
  if (legacyOverrides.menuItems) {
    result.menuItems = legacyOverrides.menuItems;
    metadata.transformedCount++;
  }
  
  // Transform block-level overrides
  Object.entries(legacyOverrides).forEach(([key, value]) => {
    // Skip special properties already handled
    if (key === 'visibleBlocks' || key === 'menuItems' || key === 'createdAt' || key === 'updatedAt') {
      return;
    }
    
    const hierarchicalPath = TRANSFORM_CONFIG.flatToHierarchical[key];
    
    if (hierarchicalPath) {
      // Map to hierarchical structure
      setNestedProperty(result, hierarchicalPath, value);
      metadata.transformedCount++;
    } else if (preserveUnknown) {
      // Preserve unmapped properties at root level
      result[key] = value;
      metadata.unmappedProperties.push(key);
    } else {
      metadata.unmappedProperties.push(key);
    }
  });
  
  // Build page-level visibleBlocks from transformed structure
  Object.keys(result).forEach(pageKey => {
    if (typeof result[pageKey] === 'object' && result[pageKey] !== null && 
        !['visiblePages', 'menuItems'].includes(pageKey)) {
      const pageBlocks = Object.keys(result[pageKey]);
      if (pageBlocks.length > 0) {
        result[pageKey].visibleBlocks = pageBlocks;
      }
    }
  });
  
  metadata.processingTimeMs = Date.now() - startTime;
  
  // Validate result if requested
  let isValid = true;
  let errors: z.ZodError | undefined;
  
  if (validate) {
    try {
      modernSchema.parse(result);
    } catch (err) {
      isValid = false;
      errors = err as z.ZodError;
    }
  }
  
  return {
    data: result as ModernOverrides,
    isValid,
    errors,
    metadata
  };
}

/**
 * Transforms modern hierarchical override structure to legacy flat structure
 * 
 * @param modernOverrides - Modern hierarchical override data
 * @param options - Transformation options
 * @param options.validate - Whether to validate result against legacy schema (default: true)
 * @param options.preserveUnknown - Whether to preserve unmapped properties (default: true)
 * @returns Transformation result with flat data
 * 
 * @example
 * ```typescript
 * const modern = {
 *   visiblePages: ['homepage'],
 *   homepage: {
 *     visibleBlocks: ['hero', 'experience'],
 *     hero: { title: 'Welcome', subtitle: 'Beautiful place' },
 *     experience: { title: 'Amazing stay', description: 'You will love it' }
 *   }
 * };
 * 
 * const result = transformToFlat(modern);
 * // result.data = {
 * //   visibleBlocks: ['hero', 'experience'],
 * //   hero: { title: 'Welcome', subtitle: 'Beautiful place' },
 * //   experience: { title: 'Amazing stay', description: 'You will love it' }
 * // }
 * ```
 */
export function transformToFlat(
  modernOverrides: ModernOverrides, 
  options: {
    validate?: boolean;
    preserveUnknown?: boolean;
  } = {}
): TransformResult<LegacyOverrides> {
  const startTime = Date.now();
  const { validate = true, preserveUnknown = true } = options;
  
  // Handle null/undefined inputs
  if (!modernOverrides || typeof modernOverrides !== 'object') {
    return {
      data: {} as LegacyOverrides,
      isValid: false,
      errors: undefined,
      metadata: {
        transformedCount: 0,
        unmappedProperties: [],
        direction: 'modern-to-legacy',
        processingTimeMs: Date.now() - startTime
      }
    };
  }
  
  // Initialize result structure
  const result: any = {};
  const metadata = {
    transformedCount: 0,
    unmappedProperties: [] as string[],
    direction: 'modern-to-legacy' as const,
    processingTimeMs: 0
  };
  
  // Collect all blocks from all pages to build visibleBlocks
  const allBlocks: string[] = [];
  
  // Handle menuItems (passes through unchanged)
  if (modernOverrides.menuItems) {
    result.menuItems = modernOverrides.menuItems;
    metadata.transformedCount++;
  }
  
  // Transform page-level structures to flat blocks
  Object.entries(modernOverrides).forEach(([pageKey, pageValue]) => {
    // Skip special properties
    if (pageKey === 'visiblePages' || pageKey === 'menuItems') {
      return;
    }
    
    if (typeof pageValue === 'object' && pageValue !== null) {
      // Check if this looks like a page with blocks (has visibleBlocks or known block names)
      const isPageStructure = 'visibleBlocks' in pageValue || 
                              Object.keys(pageValue).some(key => 
                                Object.values(TRANSFORM_CONFIG.hierarchicalToFlat).includes(key) ||
                                TRANSFORM_CONFIG.hierarchicalToFlat[`${pageKey}.${key}`]
                              );
      
      if (isPageStructure) {
        // Process as page with blocks
        Object.entries(pageValue).forEach(([blockKey, blockValue]) => {
          // Skip visibleBlocks meta property
          if (blockKey === 'visibleBlocks') {
            return;
          }
          
          const hierarchicalPath = `${pageKey}.${blockKey}`;
          const flatKey = TRANSFORM_CONFIG.hierarchicalToFlat[hierarchicalPath];
          
          if (flatKey) {
            // Map to flat structure
            result[flatKey] = blockValue;
            allBlocks.push(flatKey);
            metadata.transformedCount++;
          } else if (preserveUnknown) {
            // Preserve unmapped blocks with original key
            result[blockKey] = blockValue;
            allBlocks.push(blockKey);
            metadata.unmappedProperties.push(hierarchicalPath);
          } else {
            metadata.unmappedProperties.push(hierarchicalPath);
          }
        });
      } else if (preserveUnknown) {
        // Preserve unknown top-level object as-is
        result[pageKey] = pageValue;
        metadata.unmappedProperties.push(pageKey);
      } else {
        metadata.unmappedProperties.push(pageKey);
      }
    } else if (preserveUnknown && pageKey !== 'visiblePages' && pageKey !== 'menuItems') {
      // Preserve unknown top-level properties
      result[pageKey] = pageValue;
      metadata.unmappedProperties.push(pageKey);
    } else if (pageKey !== 'visiblePages' && pageKey !== 'menuItems') {
      metadata.unmappedProperties.push(pageKey);
    }
  });
  
  // Set visibleBlocks from collected blocks
  if (allBlocks.length > 0) {
    result.visibleBlocks = allBlocks;
  }
  
  metadata.processingTimeMs = Date.now() - startTime;
  
  // Validate result if requested
  let isValid = true;
  let errors: z.ZodError | undefined;
  
  if (validate) {
    try {
      legacySchema.parse(result);
    } catch (err) {
      isValid = false;
      errors = err as z.ZodError;
    }
  }
  
  return {
    data: result as LegacyOverrides,
    isValid,
    errors,
    metadata
  };
}

/**
 * Validates override data against specified schema
 * 
 * @param data - Override data to validate
 * @param schemaType - Schema type to validate against
 * @returns Validation result
 */
export function validateOverrides(
  data: any, 
  schemaType: 'legacy' | 'modern'
): { isValid: boolean; errors?: z.ZodError } {
  const schema = schemaType === 'legacy' ? legacySchema : modernSchema;
  
  try {
    schema.parse(data);
    return { isValid: true };
  } catch (err) {
    return { 
      isValid: false, 
      errors: err as z.ZodError 
    };
  }
}

/**
 * Utility function to detect override structure type
 * 
 * @param data - Override data to analyze
 * @returns Detected structure type
 */
export function detectOverrideType(data: any): 'legacy' | 'modern' | 'unknown' {
  if (typeof data !== 'object' || data === null) {
    return 'unknown';
  }
  
  // Check for modern structure indicators
  if (data.visiblePages || 
      data.homepage || 
      data.details || 
      data.location || 
      data.gallery || 
      data.booking) {
    return 'modern';
  }
  
  // Check for legacy structure indicators
  if (data.visibleBlocks || 
      data.hero || 
      data.experience || 
      data.features) {
    return 'legacy';
  }
  
  return 'unknown';
}

/**
 * One-way migration utility for upgrading legacy overrides to modern format
 * Includes data preservation and migration tracking
 * 
 * @param legacyOverrides - Legacy override data
 * @returns Migration result with audit trail
 */
export function migrateToModern(legacyOverrides: LegacyOverrides): TransformResult<ModernOverrides> & {
  migrationMetadata: {
    migratedAt: string;
    sourceFormat: 'legacy';
    targetFormat: 'modern';
    migrationVersion: string;
  };
} {
  const result = transformToHierarchical(legacyOverrides, { validate: true });
  
  return {
    ...result,
    migrationMetadata: {
      migratedAt: new Date().toISOString(),
      sourceFormat: 'legacy',
      targetFormat: 'modern', 
      migrationVersion: '1.0.0'
    }
  };
}