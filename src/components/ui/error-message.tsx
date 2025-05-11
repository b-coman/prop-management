'use client';

import * as React from 'react';
import { AlertTriangle, AlertCircle, AlertOctagon, RefreshCw } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Button } from './button';

const errorMessageVariants = cva(
  "rounded-md p-4 flex items-start space-x-3",
  {
    variants: {
      variant: {
        default: "bg-destructive/10 border border-destructive/30 text-destructive",
        warning: "bg-amber-50 border border-amber-200 text-amber-900",
        info: "bg-blue-50 border border-blue-200 text-blue-900",
        network: "bg-orange-50 border border-orange-200 text-orange-900",
        validation: "bg-violet-50 border border-violet-200 text-violet-900",
        server: "bg-red-50 border border-red-200 text-red-900",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const iconMap = {
  default: AlertTriangle,
  warning: AlertTriangle,
  info: AlertCircle,
  network: RefreshCw,
  validation: AlertOctagon,
  server: AlertOctagon,
};

export interface ErrorMessageProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof errorMessageVariants> {
  title?: string;
  error?: string | React.ReactNode;
  onRetry?: () => void;
  errorType?: string;
  iconClassName?: string;
}

export function ErrorMessage({ 
  className, 
  title, 
  error, 
  variant = "default", 
  onRetry,
  errorType,
  iconClassName,
  ...props 
}: ErrorMessageProps) {
  // Select icon based on variant or errorType
  let displayVariant = variant;
  
  // Map errorType to variant if provided
  if (errorType) {
    if (errorType.includes('network') || errorType === 'network_error') {
      displayVariant = 'network';
    } else if (errorType.includes('validation') || errorType === 'validation_error') {
      displayVariant = 'validation';
    } else if (errorType.includes('server') || errorType === 'service_unavailable') {
      displayVariant = 'server';
    }
  }
  
  const IconComponent = iconMap[displayVariant as keyof typeof iconMap] || AlertTriangle;
  
  // Default title based on variant if not provided
  const displayTitle = title || {
    default: 'Error',
    warning: 'Warning',
    info: 'Information',
    network: 'Connection Issue',
    validation: 'Invalid Input',
    server: 'Service Unavailable',
  }[displayVariant as keyof typeof iconMap] || 'Error';

  return (
    <div className={cn(errorMessageVariants({ variant: displayVariant }), className)} {...props}>
      <div className="flex-shrink-0 mt-0.5">
        <IconComponent className={cn("h-5 w-5", iconClassName)} />
      </div>
      
      <div className="flex-1">
        <h3 className="text-sm font-medium">{displayTitle}</h3>
        {error && <div className="mt-1 text-sm">{error}</div>}
        
        {onRetry && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRetry} 
            className="mt-2 bg-white hover:bg-gray-50 text-xs h-8"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
}