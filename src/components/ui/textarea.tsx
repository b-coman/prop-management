import * as React from 'react';

import {cn} from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({className, ...props}, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    
    return (
      <textarea
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={cn(
          // Base styles
          'flex min-h-[80px] w-full rounded-[var(--input-radius)] bg-background text-foreground',
          'px-3 py-2 text-base md:text-sm',
          'transition-all duration-200 ease-in-out',
          'resize-y',
          
          // Border styles
          'border-[var(--input-border-width)]',
          isFocused 
            ? 'border-primary ring-2 ring-primary/20' 
            : 'border-border hover:border-primary/50',
          
          // Placeholder styles
          'placeholder:text-muted-foreground/70',
          
          // Focus styles
          'focus-visible:outline-none focus-visible:border-primary',
          'focus-visible:ring-2 focus-visible:ring-primary/20',
          
          // Disabled styles
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/50 disabled:resize-none',
          
          // Dark mode
          'dark:bg-background/50 dark:hover:bg-background/70',
          
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export {Textarea};
