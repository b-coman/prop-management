/**
 * @fileoverview Professional IconInputField Component
 * @module components/ui/icon-input-field
 * 
 * @description
 * State-of-the-art reusable component for input fields with icons.
 * Provides consistent visual treatment across all forms while maintaining
 * accessibility and form functionality.
 * 
 * @architecture
 * Location: UI component library
 * Layer: Reusable component abstraction
 * Pattern: Container-border pattern for visual consistency
 */

import * as React from "react"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { TouchTarget } from "@/components/ui/touch-target"

export interface IconInputFieldProps extends React.ComponentProps<typeof Input> {
  /** Icon component to display (e.g., Mail, Phone, User). Optional for text-only fields */
  icon?: LucideIcon
  /** Additional CSS classes for the container */
  containerClassName?: string
  /** Additional CSS classes for the icon */
  iconClassName?: string
}

/**
 * Professional input field with icon integration
 * 
 * @description
 * Implements state-of-the-art visual design with:
 * - Container-based border system for consistent appearance
 * - Perfect icon-text alignment
 * - Smooth interactive states (hover, focus, error)
 * - Accessibility compliance with proper focus management
 * - Cross-form consistency
 * 
 * @example
 * ```tsx
 * <IconInputField
 *   icon={Mail}
 *   type="email"
 *   placeholder="Enter your email address"
 *   {...formField}
 * />
 * ```
 */
export const IconInputField = React.forwardRef<HTMLInputElement, IconInputFieldProps>(
  ({ 
    icon: Icon, 
    className, 
    containerClassName, 
    iconClassName,
    disabled,
    ...props 
  }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);
    
    // Professional spacing calculation with pixel-perfect precision
    const hasIcon = !!Icon;
    const inputPadding = hasIcon ? "pl-10 pr-4" : "px-4";

    return (
      <TouchTarget>
        <div 
          className={cn(
            // PRECISION CONTAINER - Exact height and positioning control
            "relative flex items-center justify-start",
            
            // EXACT HEIGHT SPECIFICATION - No variations allowed
            "h-11 min-h-11 max-h-11", // 44px exact - prevents any compression/expansion
            "w-full",
            
            // PROFESSIONAL VISUAL FOUNDATION
            "rounded-md bg-background", // Consistent radius across design system
            
            // EXACT BORDER SPECIFICATION - No inheritance issues
            "border border-solid transition-all duration-200 ease-out",
            
            // PIXEL-PERFECT STATE MANAGEMENT
            isFocused 
              ? "border-primary ring-2 ring-primary/20 ring-offset-0 shadow-sm" 
              : isHovered && !disabled
                ? "border-primary/50 shadow-sm"
                : "border-input",
            
            // PROFESSIONAL DISABLED STATE
            disabled && "opacity-50 cursor-not-allowed bg-muted/30",
            
            // DARK MODE PRECISION
            "dark:bg-background dark:border-input",
            
            containerClassName
          )}
          onMouseEnter={() => !disabled && setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* OPTICAL ICON POSITIONING - Not just mathematical center */}
          {Icon && (
            <Icon 
              className={cn(
                // EXACT POSITIONING - 12px from edge, optically centered
                "absolute left-3 top-1/2",
                "w-4 h-4", // Exact 16x16px
                "transform -translate-y-1/2", // Mathematical center
                "pointer-events-none select-none",
                "transition-colors duration-200 ease-out",
                
                // PROFESSIONAL STATE-COORDINATED COLORS
                isFocused && !disabled 
                  ? "text-primary/80" 
                  : disabled 
                    ? "text-muted-foreground/40"
                    : "text-muted-foreground/70",
                
                iconClassName
              )}
              style={{
                // OPTICAL ADJUSTMENT - Compensate for visual weight
                transform: 'translateY(calc(-50% + 0.5px))'
              }}
            />
          )}
          
          {/* PRECISION INPUT WITH PERFECT BASELINE ALIGNMENT */}
          <Input
            ref={ref}
            className={cn(
              // COMPLETE STYLE RESET - Total container control
              "border-0 bg-transparent shadow-none outline-none ring-0 ring-offset-0",
              "focus:border-0 focus:shadow-none focus:outline-none focus:ring-0",
              "focus-visible:border-0 focus-visible:shadow-none focus-visible:outline-none focus-visible:ring-0",
              
              // EXACT DIMENSIONS
              "h-11 w-full", // Match container exactly
              
              // PROFESSIONAL PADDING SYSTEM
              inputPadding,
              
              // TYPOGRAPHY PRECISION - Exact specifications
              "text-sm font-normal text-foreground",
              "leading-none", // Eliminate line-height variations
              "tracking-normal", // No letter spacing variations
              
              // PLACEHOLDER OPTIMIZATION
              "placeholder:text-muted-foreground/50 placeholder:font-normal placeholder:tracking-normal",
              
              // ENSURE VERTICAL CENTER ALIGNMENT
              "flex items-center",
              
              className
            )}
            disabled={disabled}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            style={{
              // CSS CUSTOM PROPERTIES FOR PIXEL-PERFECT CONTROL
              lineHeight: '1',
              fontSize: '14px',
              fontWeight: '400'
            }}
            {...props}
          />
        </div>
      </TouchTarget>
    )
  }
)

IconInputField.displayName = "IconInputField"