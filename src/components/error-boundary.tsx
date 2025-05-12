'use client';

import React, { ErrorInfo, Component } from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary component that catches JavaScript errors in its child component tree
 * and displays a fallback UI instead of crashing the whole app
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // You can also log the error to an error reporting service
    console.error('Caught by error boundary:', error);
    console.log('Component stack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="p-4 m-4 bg-red-50 border border-red-100 rounded-md">
          <h2 className="text-lg font-bold text-red-700">Something went wrong</h2>
          <p className="text-sm text-red-600 mt-1">{this.state.error?.message || 'An error occurred'}</p>
          <div className="mt-4">
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Simple error component for displaying inline errors
 */
export function ErrorDisplay({ error }: { error: string | Error }) {
  const message = typeof error === 'string' ? error : error.message;
  
  return (
    <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
      <p>{message}</p>
    </div>
  );
}