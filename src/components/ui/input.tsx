import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, value, onChange, disabled = false, ...props }, ref) => {
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
        className={cn(
          "flex h-10 w-full rounded-input border border-input bg-background p-input text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
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
