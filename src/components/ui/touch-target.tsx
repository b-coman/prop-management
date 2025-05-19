'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface TouchTargetProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  as?: 'div' | 'button' | 'a';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function TouchTarget({ 
  children, 
  as: Component = 'div', 
  size = 'md',
  className,
  ...props 
}: TouchTargetProps) {
  // Minimum touch target sizes for better mobile UX
  const sizeClasses = {
    sm: 'min-h-[36px] min-w-[36px]', // iOS minimum
    md: 'min-h-[44px] min-w-[44px]', // Recommended
    lg: 'min-h-[48px] min-w-[48px]', // Material Design
  };
  
  return (
    <Component
      className={cn(
        'relative inline-flex items-center justify-center',
        'touch-manipulation', // Disables double-tap zoom
        sizeClasses[size],
        'after:absolute after:inset-0',
        'after:content-[""]',
        'after:-m-2', // Extends touch area beyond visual bounds
        'isolate', // Creates new stacking context
        className
      )}
      {...props}
    >
      <span className="relative z-10 w-full h-full flex items-center justify-center">
        {children}
      </span>
    </Component>
  );
}

// Touch-friendly link component
export function TouchLink({ 
  children, 
  className,
  ...props 
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={cn(
        'inline-flex items-center justify-center',
        'min-h-[44px] px-4',
        'touch-manipulation',
        'relative isolate',
        'after:absolute after:inset-0 after:-m-2',
        'hover:bg-accent/5 active:bg-accent/10',
        'transition-colors',
        className
      )}
      {...props}
    >
      <span className="relative z-10">{children}</span>
    </a>
  );
}

// Touch-friendly button
export function TouchButton({ 
  children, 
  className,
  size = 'md',
  variant = 'default',
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'outline';
}) {
  const sizeClasses = {
    sm: 'min-h-[36px] px-3 text-sm',
    md: 'min-h-[44px] px-4',
    lg: 'min-h-[48px] px-6 text-lg',
  };
  
  const variantClasses = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  };
  
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center',
        'rounded-[var(--button-radius)]',
        'font-medium',
        'touch-manipulation',
        'transition-all duration-200',
        'active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// Touch-friendly icon button
export function TouchIconButton({ 
  children, 
  className,
  size = 'md',
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'h-9 w-9',
    md: 'h-11 w-11',
    lg: 'h-12 w-12',
  };
  
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center',
        'rounded-full',
        'touch-manipulation',
        'transition-all duration-200',
        'hover:bg-accent/10',
        'active:bg-accent/20 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}