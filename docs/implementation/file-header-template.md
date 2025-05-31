# RentalSpot Project - File Header Documentation Standard

## Purpose
Comprehensive file headers provide immediate context for developers and AI assistants, creating self-documenting code that explains its purpose, dependencies, and relationships.

## Standard Header Template

```typescript
/**
 * @fileoverview [Brief one-line description of what this file does]
 * @module [Module path, e.g., components/booking/BookingForm]
 * 
 * @description
 * [Detailed description of the file's purpose, responsibilities, and key features.
 * This should be 2-5 sentences explaining the "why" and "what" of this file.]
 * 
 * @architecture
 * Location: [Where this fits in the system architecture]
 * Layer: [Presentation/Business Logic/Data/Infrastructure]
 * Pattern: [Design pattern used, e.g., Component, Hook, Service, Provider]
 * 
 * @dependencies
 * - Internal: [List of internal dependencies]
 * - External: [List of external libraries]
 * - APIs: [List of API endpoints used]
 * 
 * @relationships
 * - Provides: [What this file provides to other parts]
 * - Consumes: [What this file uses from other parts]
 * - Children: [Components/modules that depend on this]
 * - Parent: [Components/modules this depends on]
 * 
 * @state-management
 * - State Shape: [Brief description of state structure]
 * - Persistence: [How state is persisted, if applicable]
 * - Updates: [How state updates are triggered]
 * 
 * @performance
 * - Optimizations: [Key performance optimizations]
 * - Concerns: [Known performance concerns]
 * 
 * @example
 * ```typescript
 * // Basic usage example
 * import { ComponentName } from './ComponentName';
 * 
 * function App() {
 *   return <ComponentName prop="value" />;
 * }
 * ```
 * 
 * @todos
 * - [ ] TODO items for future improvements
 * - [ ] Known issues to address
 * 
 * @see {@link ../docs/related-documentation.md}
 * @since v1.0.0
 * @author RentalSpot Team
 */
```

## Simplified Template (For smaller files)

```typescript
/**
 * @fileoverview [Brief description]
 * @module [Module name]
 * 
 * @description
 * [2-3 sentences about purpose and responsibilities]
 * 
 * @architecture
 * Part of: [Parent system/module]
 * Used by: [Main consumers]
 * 
 * @example
 * ```typescript
 * // Usage example
 * ```
 */
```

## Examples by File Type

### React Component
```typescript
/**
 * @fileoverview Property listing card component with image carousel
 * @module components/property/PropertyCard
 * 
 * @description
 * Displays a property summary card with images, price, and basic info.
 * Used in search results and property listings. Supports theming and
 * responsive design with lazy image loading.
 * 
 * @architecture
 * Part of: Property display system
 * Layer: Presentation
 * Pattern: React Component
 * 
 * @dependencies
 * - Internal: ImageCarousel, PriceDisplay, theme-utils
 * - External: React, framer-motion
 */
```

### Custom Hook
```typescript
/**
 * @fileoverview Custom hook for managing form state with validation
 * @module hooks/useFormValidation
 * 
 * @description
 * Provides form state management with real-time validation, error handling,
 * and submission state. Integrates with our validation schemas and supports
 * async validation rules.
 * 
 * @architecture
 * Pattern: Custom React Hook
 * Used by: All form components
 * 
 * @state-management
 * - State Shape: { values, errors, touched, isSubmitting }
 * - Updates: Via setValue, setError, touch handlers
 */
```

### Service/API
```typescript
/**
 * @fileoverview Property search and filtering service
 * @module services/propertyService
 * 
 * @description
 * Handles property search, filtering, and data fetching from Firestore.
 * Implements caching, pagination, and real-time updates. Central service
 * for all property-related data operations.
 * 
 * @architecture
 * Location: Data access layer
 * Layer: Business Logic
 * Pattern: Service/Repository
 * 
 * @dependencies
 * - Internal: firebaseAdmin, cache-utils, property-types
 * - APIs: Firestore collections: properties, availability
 * 
 * @performance
 * - Optimizations: Result caching, query optimization
 * - Concerns: Large result sets may need pagination
 */
```

### Context Provider
```typescript
/**
 * @fileoverview Global theme context and provider
 * @module contexts/ThemeContext
 * 
 * @description
 * Manages application-wide theme state including color schemes, typography,
 * and component variants. Provides theme switching functionality and
 * persists user preferences to localStorage.
 * 
 * @architecture
 * Pattern: React Context + Provider
 * Layer: Cross-cutting concern
 * 
 * @state-management
 * - State Shape: { theme: ThemeConfig, setTheme: Function }
 * - Persistence: localStorage key 'rental-spot-theme'
 * - Updates: User-triggered via theme switcher
 */
```

## When to Update Headers

| Change Type | Update Required? | Sections to Update |
|------------|-----------------|-------------------|
| Bug fix | ❌ No | None |
| Refactor (same API) | ❌ No | None |
| Add dependency | ✅ Yes | `@dependencies` |
| Change public API | ✅ Yes | `@description`, `@relationships` |
| Add state | ✅ Yes | `@state-management` |
| Performance change | ✅ Yes | `@performance` |
| Breaking change | ✅ Yes | Add `@breaking` tag |

## Benefits

1. **Self-Documenting Code**: Headers explain the "why" not just the "what"
2. **AI-Friendly**: Provides context for AI assistants
3. **Onboarding**: New developers understand the codebase faster
4. **Architecture Documentation**: Living docs that stay with code
5. **Dependency Tracking**: Clear view of interconnections
6. **Searchable**: Can grep for patterns like "@module components"

## Validation

Run the header validation script:
```bash
# Validate all files
npm run validate-headers

# Validate specific path
npm run validate-headers -- --path="src/components/**"

# Validate specific file
npm run validate-headers -- src/components/booking/BookingForm.tsx
```