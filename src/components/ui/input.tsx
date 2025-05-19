import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, value, onChange, disabled = false, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    
    // Add debugging for input values and events - only runs on client
    const isClient = typeof window !== 'undefined';
    React.useEffect(() => {
      if (isClient) {
        console.log(`🎛️ [CLIENT] Input mounted with value="${value}" disabled=${!!disabled}`);
      }
    }, [value, disabled, isClient]);

    // Ensure we handle controlled inputs properly
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isClient) {
        console.log(`🔄 [CLIENT] Input change event: value="${e.target.value}"`);
      }
      if (onChange) {
        onChange(e);
      }
    };

    // Ensure disabled is always a boolean
    const isDisabled = !!disabled;

    return (
      <input
        type={type}
        value={value !== undefined ? value : ''}
        onChange={handleChange}
        disabled={isDisabled}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={cn(
          // Base styles
          "flex h-10 w-full rounded-[var(--input-radius)] bg-background text-foreground",
          "px-3 py-2 text-base md:text-sm",
          "transition-all duration-200 ease-in-out",
          
          // Border styles
          "border-[var(--input-border-width)]",
          isFocused 
            ? "border-primary ring-2 ring-primary/20" 
            : "border-border hover:border-primary/50",
          
          // Placeholder and file styles
          "placeholder:text-muted-foreground/70",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          
          // Focus styles
          "focus-visible:outline-none focus-visible:border-primary",
          "focus-visible:ring-2 focus-visible:ring-primary/20",
          
          // Disabled styles
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/50",
          
          // Dark mode
          "dark:bg-background/50 dark:hover:bg-background/70",
          
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
