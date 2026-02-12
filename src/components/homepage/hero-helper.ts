'use client';

/**
 * Hero Content Positioning System
 * 
 * This module provides dynamic positioning for hero section elements to ensure
 * they display correctly with the fixed transparent header. The system uses a modular
 * architecture with handler functions for each position+size combination.
 * 
 * The positioning system handles:
 * 1. Title positioning - Dynamically calculates vertical centering in visible area
 * 2. Form positioning - Ensures proper spacing between title and form using position handlers
 * 3. Responsive adjustments - Recalculates on resize and font loading
 * 4. Position-specific styling - Each position+size combination has its own handler function
 * 5. Special layouts - Specific layouts like horizontal form for bottom-large combination
 * 
 * ARCHITECTURE:
 * - Position Handlers: Dictionary of functions that style form based on position+size
 * - Handler Selection: System to choose appropriate handler with fallbacks
 * - Vertical Margin Calculation: Position-specific margin calculations 
 * - Horizontal Layout: Special handling for bottom-large position with all elements in one line
 * 
 * IMPORTANT: This JavaScript positioning takes precedence over CSS classes in the component.
 * Any changes to positioning should be coordinated between this file and hero-section.tsx.
 * 
 * ADDING NEW POSITIONS:
 * To add a new position or size:
 * 1. Add a new handler function to positionStyleHandlers dictionary
 * 2. Follow naming convention: '{position}-{size}' (e.g., 'middle-extra-large')
 * 3. Implement styling within the handler function
 * 4. Add vertical margin calculation if needed
 * 
 * For complete documentation of the booking form positioning system, see:
 * - docs/implementation/booking-form-positioning.md (Overall architecture)
 * - docs/implementation/form-position-size-specifications.md (Specific styling details)
 */

/**
 * Position Style Handlers
 * 
 * Each handler function applies specific styling for a position+size combination.
 * Handler functions follow the naming convention: '{position}-{size}'
 * 
 * Handler parameters:
 * @param formWrapperElement - The HTML element to style
 * @param params - Object containing context information:
 *   - isMobile, isTablet, isDesktop, isLargeDesktop - Breakpoint flags
 *   - viewportHeight, viewportWidth - Screen dimensions
 *   - headerHeight, heroHeight, titleHeight, formHeight - Element measurements
 *   - availableSpace - Calculated space available for positioning
 * 
 * @returns The styled form wrapper element
 */
const positionStyleHandlers = {
  // BOTTOM POSITION STYLES
  'bottom-compressed': (formWrapperElement: HTMLElement, params: any) => {
    const { isMobile, isTablet, isDesktop } = params;
    
    // Set max width based on size and breakpoint
    if (isMobile) {
      formWrapperElement.style.maxWidth = '440px';
    } else if (isTablet) {
      formWrapperElement.style.maxWidth = '470px';
    } else if (isDesktop) {
      formWrapperElement.style.maxWidth = '500px';
    } else {
      formWrapperElement.style.maxWidth = '520px';
    }
    
    // Standard padding for compressed
    formWrapperElement.style.padding = isMobile ? '1rem' : '1.5rem';
    
    return formWrapperElement;
  },
  
  'bottom-large': (formWrapperElement: HTMLElement, params: any) => {
    const { isMobile, isTablet, isDesktop } = params;
    
    // Set max width based on size and breakpoint - more responsive width
    if (isMobile) {
      formWrapperElement.style.maxWidth = '480px';
    } else if (isTablet) {
      // Narrower for better spacing on tablets
      formWrapperElement.style.maxWidth = '720px';
    } else if (isDesktop) {
      // Comfortable for desktop
      formWrapperElement.style.maxWidth = '800px';
    } else {
      // Slightly reduced for large screens
      formWrapperElement.style.maxWidth = '840px';
    }
    
    // Adjusted padding - ensure enough space for small screens
    formWrapperElement.style.padding = isMobile 
      ? '1.25rem 1rem' // Ensure enough room on small screens
      : isTablet 
        ? '1.25rem 1.5rem' // Reduced horizontal padding on tablet
        : '1.5rem 2rem'; // Reduced padding on desktop for a more compact feel
    
    return formWrapperElement;
  },
  
  // CENTER POSITION STYLES
  'center-compressed': (formWrapperElement: HTMLElement, params: any) => {
    const { isMobile, isTablet, isDesktop } = params;
    
    if (isMobile) {
      formWrapperElement.style.maxWidth = '400px';
    } else if (isTablet) {
      formWrapperElement.style.maxWidth = '430px';
    } else {
      formWrapperElement.style.maxWidth = '460px';
    }
    
    // Standard padding for compressed
    formWrapperElement.style.padding = isMobile ? '1rem' : '1.5rem';
    
    // Enhanced shadow for center position
    formWrapperElement.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.18)';
    
    return formWrapperElement;
  },
  
  'center-large': (formWrapperElement: HTMLElement, params: any) => {
    const { isMobile, isTablet, isDesktop } = params;
    
    if (isMobile) {
      formWrapperElement.style.maxWidth = '460px';
    } else if (isTablet || isDesktop) {
      formWrapperElement.style.maxWidth = '500px';
    } else {
      formWrapperElement.style.maxWidth = '520px';
    }
    
    // More generous padding for large
    formWrapperElement.style.padding = isMobile ? '1.25rem' : '1.75rem';
    
    // Enhanced shadow for center position
    formWrapperElement.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.18)';
    
    return formWrapperElement;
  },
  
  // TOP POSITION STYLES
  'top-compressed': (formWrapperElement: HTMLElement, params: any) => {
    const { isMobile, isTablet, isDesktop } = params;
    
    if (isMobile) {
      formWrapperElement.style.maxWidth = '420px';
    } else if (isTablet) {
      formWrapperElement.style.maxWidth = '450px';
    } else {
      formWrapperElement.style.maxWidth = '480px';
    }
    
    // Standard padding for compressed
    formWrapperElement.style.padding = isMobile ? '1rem' : '1.5rem';
    
    // Enhanced shadow for top position
    formWrapperElement.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    
    return formWrapperElement;
  },
  
  'top-large': (formWrapperElement: HTMLElement, params: any) => {
    const { isMobile, isTablet, isDesktop } = params;
    
    if (isMobile) {
      formWrapperElement.style.maxWidth = '480px';
    } else if (isTablet || isDesktop) {
      formWrapperElement.style.maxWidth = '520px';
    } else {
      formWrapperElement.style.maxWidth = '540px';
    }
    
    // More generous padding for large
    formWrapperElement.style.padding = isMobile ? '1.25rem' : '1.75rem';
    
    // Enhanced shadow for top position
    formWrapperElement.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    
    return formWrapperElement;
  },
  
  // EXTENDED POSITIONS FOR CORNERS
  'top-left-compressed': (formWrapperElement: HTMLElement, params: any) => {
    const { isMobile } = params;
    // Corner + Compressed (narrowest)
    formWrapperElement.style.maxWidth = isMobile ? '320px' : '360px';
    // Compact padding for corner positions
    formWrapperElement.style.padding = isMobile ? '0.875rem' : '1.25rem';
    
    // Corner-specific positioning and styling
    formWrapperElement.style.marginLeft = isMobile ? '1rem' : '1.5rem';
    formWrapperElement.style.marginRight = 'auto';
    // Rounded corners - sharper on top-left, rounder on bottom-right
    formWrapperElement.style.borderRadius = '0.5rem 1rem 1rem 1rem';
    // Strong shadow for corner positions (more depth)
    formWrapperElement.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.2)';
    
    return formWrapperElement;
  },
  
  'top-right-compressed': (formWrapperElement: HTMLElement, params: any) => {
    const { isMobile } = params;
    // Corner + Compressed (narrowest)
    formWrapperElement.style.maxWidth = isMobile ? '320px' : '360px';
    // Compact padding for corner positions
    formWrapperElement.style.padding = isMobile ? '0.875rem' : '1.25rem';
    
    // Corner-specific positioning and styling
    formWrapperElement.style.marginLeft = 'auto';
    formWrapperElement.style.marginRight = isMobile ? '1rem' : '1.5rem';
    // Rounded corners - sharper on top-right, rounder on bottom-left
    formWrapperElement.style.borderRadius = '1rem 0.5rem 1rem 1rem';
    // Strong shadow for corner positions
    formWrapperElement.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.2)';
    
    return formWrapperElement;
  },
  
  'top-left-large': (formWrapperElement: HTMLElement, params: any) => {
    const { isMobile } = params;
    // Corner + Large (still narrower than center/top/bottom)
    formWrapperElement.style.maxWidth = isMobile ? '360px' : '400px';
    // Still compact but slightly more generous padding
    formWrapperElement.style.padding = isMobile ? '1rem' : '1.5rem';
    
    // Corner-specific positioning and styling
    formWrapperElement.style.marginLeft = isMobile ? '1rem' : '1.5rem';
    formWrapperElement.style.marginRight = 'auto';
    // Rounded corners - sharper on top-left, rounder on bottom-right
    formWrapperElement.style.borderRadius = '0.5rem 1rem 1rem 1rem';
    // Strong shadow for corner positions
    formWrapperElement.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.2)';
    
    return formWrapperElement;
  },
  
  'top-right-large': (formWrapperElement: HTMLElement, params: any) => {
    const { isMobile } = params;
    // Corner + Large (still narrower than center/top/bottom)
    formWrapperElement.style.maxWidth = isMobile ? '360px' : '400px';
    // Still compact but slightly more generous padding
    formWrapperElement.style.padding = isMobile ? '1rem' : '1.5rem';
    
    // Corner-specific positioning and styling
    formWrapperElement.style.marginLeft = 'auto';
    formWrapperElement.style.marginRight = isMobile ? '1rem' : '1.5rem';
    // Rounded corners - sharper on top-right, rounder on bottom-left
    formWrapperElement.style.borderRadius = '1rem 0.5rem 1rem 1rem';
    // Strong shadow for corner positions
    formWrapperElement.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.2)';
    
    return formWrapperElement;
  },
  
  'bottom-left-compressed': (formWrapperElement: HTMLElement, params: any) => {
    const { isMobile } = params;
    // Corner + Compressed (narrowest)
    formWrapperElement.style.maxWidth = isMobile ? '320px' : '360px';
    // Compact padding
    formWrapperElement.style.padding = isMobile ? '0.875rem' : '1.25rem';
    
    // Corner-specific positioning and styling
    formWrapperElement.style.marginLeft = isMobile ? '1rem' : '1.5rem';
    formWrapperElement.style.marginRight = 'auto';
    // Rounded corners - sharper on bottom-left, rounder on top-right
    formWrapperElement.style.borderRadius = '1rem 1rem 0.5rem 1rem';
    // Strong shadow for corner positions
    formWrapperElement.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.2)';
    
    return formWrapperElement;
  },
  
  'bottom-right-compressed': (formWrapperElement: HTMLElement, params: any) => {
    const { isMobile } = params;
    // Corner + Compressed (narrowest)
    formWrapperElement.style.maxWidth = isMobile ? '320px' : '360px';
    // Compact padding
    formWrapperElement.style.padding = isMobile ? '0.875rem' : '1.25rem';
    
    // Corner-specific positioning and styling
    formWrapperElement.style.marginLeft = 'auto';
    formWrapperElement.style.marginRight = isMobile ? '1rem' : '1.5rem';
    // Rounded corners - sharper on bottom-right, rounder on top-left
    formWrapperElement.style.borderRadius = '1rem 1rem 1rem 0.5rem';
    // Strong shadow for corner positions
    formWrapperElement.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.2)';
    
    return formWrapperElement;
  },
  
  'bottom-left-large': (formWrapperElement: HTMLElement, params: any) => {
    const { isMobile } = params;
    // Corner + Large (still narrower than center/top/bottom)
    formWrapperElement.style.maxWidth = isMobile ? '360px' : '400px';
    // More padding but still compact
    formWrapperElement.style.padding = isMobile ? '1rem' : '1.5rem';
    
    // Corner-specific positioning and styling
    formWrapperElement.style.marginLeft = isMobile ? '1rem' : '1.5rem';
    formWrapperElement.style.marginRight = 'auto';
    // Rounded corners - sharper on bottom-left, rounder on top-right
    formWrapperElement.style.borderRadius = '1rem 1rem 0.5rem 1rem';
    // Strong shadow for corner positions
    formWrapperElement.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.2)';
    
    return formWrapperElement;
  },
  
  'bottom-right-large': (formWrapperElement: HTMLElement, params: any) => {
    const { isMobile } = params;
    // Corner + Large (still narrower than center/top/bottom)
    formWrapperElement.style.maxWidth = isMobile ? '360px' : '400px';
    // More padding but still compact
    formWrapperElement.style.padding = isMobile ? '1rem' : '1.5rem';
    
    // Corner-specific positioning and styling
    formWrapperElement.style.marginLeft = 'auto';
    formWrapperElement.style.marginRight = isMobile ? '1rem' : '1.5rem';
    // Rounded corners - sharper on bottom-right, rounder on top-left
    formWrapperElement.style.borderRadius = '1rem 1rem 1rem 0.5rem';
    // Strong shadow for corner positions
    formWrapperElement.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.2)';
    
    return formWrapperElement;
  },
  
  // Default handler as fallback
  'default': (formWrapperElement: HTMLElement, params: any) => {
    const { isMobile } = params;
    
    // Default max-width
    formWrapperElement.style.maxWidth = '480px';
    // Default padding
    formWrapperElement.style.padding = isMobile ? '1rem' : '1.5rem';
    // Default shadow
    formWrapperElement.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.15)';
    
    return formWrapperElement;
  }
};
export function setupHeroContentAdjustment(): () => void {
  if (typeof window === 'undefined') return () => {};
  
  // Run immediately and also after a small delay to ensure positioning is correct
  const adjustHeroContent = () => {
    const header = document.querySelector('header');
    const heroSection = document.querySelector('#hero');
    const heroContainer = heroSection?.querySelector('.container');
    const heroTitleContainer = heroSection?.querySelector('.text-center');
    
    if (!header || !heroSection || !heroTitleContainer || !heroContainer) {
      console.warn('[Hero Adjustment] Could not find required elements');
      return;
    }
    
    // Get the header height and hero dimensions
    const headerHeight = header.getBoundingClientRect().height;
    const heroHeight = heroSection.getBoundingClientRect().height;
    const titleHeight = heroTitleContainer.getBoundingClientRect().height || 200; // Fallback height if not yet rendered
    
    // Center the content in the visible area (below the header)
    const visibleAreaHeight = heroHeight - headerHeight;
    const visibleAreaMiddle = headerHeight + (visibleAreaHeight / 2);
    
    // Calculate margin needed to center the title
    const marginNeeded = Math.max(64, visibleAreaMiddle - (titleHeight / 2) - headerHeight);
    
    // Ensure container is using flex properties correctly
    (heroContainer as HTMLElement).style.justifyContent = 'flex-start';
    (heroContainer as HTMLElement).style.alignItems = 'center';
    
    // Apply the calculated margin with a minimum to prevent text from being too close to the header
    (heroTitleContainer as HTMLElement).style.marginTop = `${marginNeeded}px`;
    
    // Position the form container relative to the title
    // The form needs appropriate spacing based on its position while working with the transparent header
    // First, try to find by class name (debugging)
    console.log("[HeroHelper DEBUG] Form selectors:", {
      bgBackgroundElements: heroSection.querySelectorAll('[class*="bg-background"]').length,
      roundedXlElements: heroSection.querySelectorAll('[class*="rounded-xl"]').length,
      bookingContainerElements: heroSection.querySelectorAll('.booking-form-flex-container').length,
      allClasses: Array.from(heroSection.querySelectorAll('*')).map(el => el.className).filter(Boolean).join(', ').substring(0, 200)
    });
    
    // More specific selector that targets both implementations
    const formWrapper = heroSection.querySelector('[class*="bg-background"]') || 
                       heroSection.querySelector('[class*="rounded-xl"]') || 
                       heroSection.querySelector('.booking-form-flex-container')?.parentElement;
                       
    if (formWrapper && heroTitleContainer) {
      console.log("[HeroHelper DEBUG] Found form wrapper:", formWrapper);
      // Determine the form's intended position and size from data attributes
      const positionAttribute = heroSection.getAttribute('data-form-position') || 'bottom';
      const sizeAttribute = heroSection.getAttribute('data-form-size') || 'compressed';
      
      // Enhanced debug logging to trace the data flow
      console.log('[HeroHelper] Form attributes from DOM:', { 
        positionAttribute, 
        sizeAttribute,
        heroSectionId: heroSection.id,
        heroDataAttributes: {
          'data-form-position': heroSection.getAttribute('data-form-position'),
          'data-form-size': heroSection.getAttribute('data-form-size')
        }
      });
      
      // Check if this is a schema-defined position or an extended position
      const isSchemaPosition = positionAttribute === 'top' || 
                               positionAttribute === 'bottom' || 
                               positionAttribute === 'center';
      
      // For logging and debugging
      const positionSource = isSchemaPosition ? 'schema-defined' : 'extended';
      
      // Measurements for calculations
      const titleHeight = heroTitleContainer.getBoundingClientRect().height;
      const formHeight = formWrapper.getBoundingClientRect().height;
      const availableSpace = heroHeight - headerHeight - titleHeight;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      // Get breakpoint size category
      const isMobile = viewportWidth < 768;
      const isTablet = viewportWidth >= 768 && viewportWidth < 1024;
      const isDesktop = viewportWidth >= 1024 && viewportWidth < 1280;
      const isLargeDesktop = viewportWidth >= 1280;
      
      // For bottom position on desktop/tablet: reduce the gap between title and widget
      // by shifting the title down when the gap exceeds ~10% of the hero height.
      // Uses getBoundingClientRect() for accurate measurement of rendered positions.
      if (positionAttribute === 'bottom' && !isMobile) {
        const heroRect = heroSection.getBoundingClientRect();
        const titleRect = heroTitleContainer.getBoundingClientRect();
        // Find the outer absolute-positioned widget wrapper (contains specs bar + booking card)
        const outerWidgetWrapper = Array.from((heroContainer as HTMLElement).children).find(
          (child) => (child as HTMLElement).style?.position === 'absolute'
        );
        if (outerWidgetWrapper) {
          const widgetRect = outerWidgetWrapper.getBoundingClientRect();
          const gapB = widgetRect.top - titleRect.bottom;
          const maxGap = heroHeight * 0.10;

          if (gapB > maxGap) {
            const currentMargin = parseFloat((heroTitleContainer as HTMLElement).style.marginTop) || marginNeeded;
            const adjustedMargin = currentMargin + (gapB - maxGap);
            (heroTitleContainer as HTMLElement).style.marginTop = `${adjustedMargin}px`;
          }
        }
      }

      // Form wrapper styling - common for all positions
      const formWrapperElement = formWrapper as HTMLElement;

      // Create a function to apply horizontal layout based on the position-size combination
      const applyHorizontalLayout = (positionAttribute: string, sizeAttribute: string, formWrapperElement: HTMLElement) => {
        if (positionAttribute === 'bottom' && sizeAttribute === 'large' && !isMobile) {
          console.log('[HeroHelper] Bottom position with large size detected - applying horizontal layout');
          
          // Apply horizontal layout after the component renders with direct styles
          setTimeout(() => {
            // Look for the booking form flex container - either legacy or new version
            const formContainer = formWrapperElement.querySelector('.booking-form-flex-container') || 
                                  formWrapperElement.querySelector('.space-y-4');
            if (formContainer) {
              // Add classes
              formContainer.classList.add('md:flex', 'md:flex-row', 'md:items-center',
                                        'md:space-y-0', 'md:space-x-6', 'md:justify-between');
              
              // Also apply direct styles to force horizontal layout
              (formContainer as HTMLElement).style.display = 'flex';
              (formContainer as HTMLElement).style.flexDirection = 'row';
              (formContainer as HTMLElement).style.alignItems = 'center';
              (formContainer as HTMLElement).style.justifyContent = 'space-between';
              (formContainer as HTMLElement).style.gap = '1.5rem';
              
              // Apply styles to child elements for perfect alignment - support both new and old structures
              const datePickerContainer = formContainer.querySelector('.booking-form-wrapper') || 
                                          formContainer.querySelector('div:first-child');
              const buttonContainer = formContainer.querySelector('.booking-price-container') || 
                                      formContainer.querySelector('div:last-child');
              
              if (datePickerContainer && buttonContainer) {
                (datePickerContainer as HTMLElement).style.marginBottom = '0';
                (datePickerContainer as HTMLElement).style.flexGrow = '1';
                (buttonContainer as HTMLElement).style.width = 'auto';
                (buttonContainer as HTMLElement).style.marginTop = '0';
              }
              
              console.log('[HeroHelper] Applied horizontal layout classes for bottom + large form');
            }
          }, 300);
        }
      };
      
      // Apply horizontal layout based on position and size
      applyHorizontalLayout(positionAttribute, sizeAttribute, formWrapperElement);
      
      // Add subtle transitions for smoother appearance
      formWrapperElement.style.transition = 'margin-top 0.3s ease-out, max-width 0.3s ease, padding 0.3s ease';
      
      // Calculate vertical margin based on position
      let verticalMargin = 0;
      
      // POSITION HANDLER SETUP
      // Calculate vertical margins based on position type
      if (positionAttribute === 'top') {
        // TOP POSITION
        // Minimal margin, just enough to clear header
        verticalMargin = Math.max(16, headerHeight * 0.25);
      } else if (positionAttribute === 'center') {
        // CENTER POSITION
        // Calculate the center point of the visible area
        const visibleAreaHeight = heroHeight - headerHeight;
        const visibleAreaCenter = headerHeight + (visibleAreaHeight / 2);
        
        // Position form so its center aligns with visible area center
        verticalMargin = visibleAreaCenter - titleHeight - (formHeight / 2);
        
        // Ensure minimum margin, especially on small screens
        verticalMargin = Math.max(24, verticalMargin);
      } else if (positionAttribute === 'bottom') {
        // BOTTOM POSITION (DEFAULT)
        // Position from bottom edge for more precise alignment
        // First determine how much space to leave at the bottom
        let bottomMargin;
        if (viewportHeight < 600) {
          // Extra small screens - minimal space at bottom
          bottomMargin = 8; // Reduced from 16
        } else if (viewportHeight < 900) {
          // Small to medium screens - minimal bottom margin
          bottomMargin = 12; // Reduced from 20
        } else {
          // Large screens - small bottom margin
          bottomMargin = 16; // Reduced from 24
        }
        
        // Calculate verticalMargin from top to achieve our desired bottom position
        // Available height minus form height minus bottom margin
        // NOTE: Removing titleHeight from this calculation as it causes the form to exceed hero's bottom
        verticalMargin = heroHeight - formHeight - bottomMargin;
      } else if (positionAttribute.includes('top-')) {
        // TOP CORNER POSITIONS (LEFT/RIGHT)
        // Minimal margin, similar to top
        verticalMargin = Math.max(16, headerHeight * 0.3);
      } else if (positionAttribute.includes('bottom-')) {
        // BOTTOM CORNER POSITIONS (LEFT/RIGHT)
        // Position from bottom edge for more precise alignment
        // First determine how much space to leave at the bottom
        let bottomMargin;
        if (viewportHeight < 600) {
          // Small screens - tighter to the bottom
          bottomMargin = 20;
        } else if (viewportHeight < 900) {
          // Medium screens - standard bottom margin
          bottomMargin = 28;
        } else {
          // Large screens - more generous bottom margin
          bottomMargin = 40;
        }
        
        // Calculate verticalMargin from top to achieve our desired bottom position
        // NOTE: Removing titleHeight from this calculation as it causes the form to exceed hero's bottom
        verticalMargin = heroHeight - formHeight - bottomMargin;
      } else {
        // FALLBACK FOR UNKNOWN POSITIONS
        // Default to bottom behavior
        console.warn(`Unrecognized form position: "${positionAttribute}". Using bottom position fallback.`);
        verticalMargin = Math.max(32, availableSpace * 0.5);
      }

      // FORM STYLING VIA HANDLERS
      
      // Get the handler key for this position+size combination
      const handlerKey = `${positionAttribute}-${sizeAttribute}`;
      
      // Create parameters object for the handler functions
      const handlerParams = {
        isMobile,
        isTablet,
        isDesktop,
        isLargeDesktop,
        viewportHeight,
        viewportWidth,
        headerHeight,
        heroHeight,
        titleHeight,
        formHeight,
        availableSpace
      };
      
      // Apply styling based on the position+size combination
      if (handlerKey in positionStyleHandlers) {
        // Use the specific handler for this position+size
        (positionStyleHandlers as any)[handlerKey](formWrapperElement, handlerParams);
        console.log(`[HeroHelper] Applied styling via handler for "${handlerKey}"`);
      } else {
        // If specific handler not found, try to find a default for the position
        const positionHandler = `${positionAttribute}-default`;
        if (positionHandler in positionStyleHandlers) {
          (positionStyleHandlers as any)[positionHandler](formWrapperElement, handlerParams);
          console.log(`[HeroHelper] Applied default styling for position "${positionAttribute}"`);
        } else {
          // Fallback to the default handler
          (positionStyleHandlers as any)['default'](formWrapperElement, handlerParams);
          console.log(`[HeroHelper] Applied default styling (no specific handler for "${handlerKey}")`);
        }
      }
      
      // Note: Corner-specific styling is now handled by the position handlers
      
      // Initialize finalMargin value for logging
      let finalMargin = 0;
      
      // Check if this is the bottom position
      if (positionAttribute === 'bottom') {
        // Bottom positioning is handled by the parent wrapper in hero-section.tsx
        // (absolute, bottom: 20px, left: 50%, translateX(-50%)).
        // We only apply styling (maxWidth, padding, shadow) here — not positioning.
        formWrapperElement.style.marginTop = '0'; // Clear any existing margin

        finalMargin = 0;
        console.log('[Hero Form] Bottom position — parent wrapper handles positioning');
      } else {
        // For other positions, use the calculated margin
        finalMargin = Math.min(verticalMargin, 80); // cap at 80px maximum
        formWrapperElement.style.marginTop = `${finalMargin}px`;
      }
      
      // Add subtle opacity transition for smoother appearance
      setTimeout(() => {
        formWrapperElement.style.opacity = '1';
      }, 100);
      
      console.log(`[Hero Form] Applied ${positionSource} position styling "${positionAttribute}" with size "${sizeAttribute}". ${positionAttribute === 'bottom' ? 'Bottom offset: 20px' : `Margin: ${finalMargin}px`}`);
    }
  };
  
  // Define a debounced version to avoid too many calculations
  let debounceTimer: number | null = null;
  const debouncedAdjust = () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = window.setTimeout(adjustHeroContent, 50) as unknown as number;
  };
  
  // Run immediately to reduce visible jump
  adjustHeroContent();
  
  // Run once after a short delay as a fallback
  setTimeout(adjustHeroContent, 100);
  
  // Use the debounced version for resize events to improve performance
  window.addEventListener('resize', debouncedAdjust);
  
  // Adjust on font load events which can change text height
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(adjustHeroContent);
  }
  
  // Cleanup function for use in useEffect
  return () => {
    window.removeEventListener('resize', debouncedAdjust);
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
  };
}