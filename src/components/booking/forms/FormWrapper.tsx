'use client';

import React, { useRef, useEffect } from 'react';
import { useFocusTrap } from '@/hooks/useKeyboardNavigation';
import { motion, AnimatePresence } from 'framer-motion';

interface FormWrapperProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose?: () => void;
  focusTrap?: boolean;
  className?: string;
}

export function FormWrapper({ 
  children, 
  isOpen, 
  onClose, 
  focusTrap = true,
  className = ''
}: FormWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Enable focus trap when form is open
  useFocusTrap(containerRef, isOpen && focusTrap);
  
  // Handle escape key
  useEffect(() => {
    if (!isOpen || !onClose) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);
  
  // Focus first input when form opens
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    
    // Small delay to ensure animations complete
    const timeout = setTimeout(() => {
      const firstInput = containerRef.current?.querySelector<HTMLInputElement>(
        'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])'
      );
      firstInput?.focus();
    }, 100);
    
    return () => clearTimeout(timeout);
  }, [isOpen]);
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className={className}
          role="region"
          aria-live="polite"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Focus indicator component for better visibility
export function FocusIndicator({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {children}
      <div className="absolute inset-0 rounded-[var(--input-radius)] pointer-events-none ring-2 ring-primary/20 ring-offset-2 opacity-0 focus-within:opacity-100 transition-opacity duration-200" />
    </div>
  );
}

// Accessible form field wrapper
export function FormField({ 
  label, 
  required, 
  error, 
  children,
  fieldId,
  helpText
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  fieldId: string;
  helpText?: string;
}) {
  return (
    <div className="space-y-2">
      <label 
        htmlFor={fieldId}
        className="text-sm font-medium text-foreground flex items-center gap-2"
      >
        {label}
        {required && <span className="text-destructive" aria-label="required">*</span>}
      </label>
      
      {children}
      
      {helpText && !error && (
        <p id={`${fieldId}-help`} className="text-xs text-muted-foreground">
          {helpText}
        </p>
      )}
      
      {error && (
        <p id={`${fieldId}-error`} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}