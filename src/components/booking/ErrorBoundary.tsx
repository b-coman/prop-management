"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component to catch and handle JavaScript errors
 * anywhere in the child component tree.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to an error reporting service
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // If a custom fallback is provided, render it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="p-4 border border-amber-300 bg-amber-50 rounded-md my-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-amber-800 font-medium mb-1">Something went wrong</h3>
              {this.state.error && (
                <p className="text-amber-700 text-sm mb-2">
                  {this.state.error.name}: {this.state.error.message}
                </p>
              )}
              <Button 
                onClick={this.handleReset}
                size="sm"
                variant="outline"
                className="border-amber-300 hover:bg-amber-100 text-amber-700"
              >
                Try again
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // If no error, render children normally
    return this.props.children;
  }
}