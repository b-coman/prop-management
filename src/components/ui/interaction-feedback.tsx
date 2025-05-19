'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Loader2 } from 'lucide-react';

interface InteractionFeedbackProps {
  children: React.ReactNode;
  variant?: 'hover' | 'ripple' | 'scale';
  state?: 'idle' | 'loading' | 'success' | 'error';
  className?: string;
  onSuccess?: () => void;
  onError?: () => void;
}

export function InteractionFeedback({
  children,
  variant = 'hover',
  state = 'idle',
  className,
  onSuccess,
  onError
}: InteractionFeedbackProps) {
  const [localState, setLocalState] = React.useState(state);
  const [ripples, setRipples] = React.useState<{ x: number; y: number; id: number }[]>([]);

  React.useEffect(() => {
    setLocalState(state);
    
    if (state === 'success' && onSuccess) {
      const timer = setTimeout(onSuccess, 1000);
      return () => clearTimeout(timer);
    }
    
    if (state === 'error' && onError) {
      const timer = setTimeout(onError, 1000);
      return () => clearTimeout(timer);
    }
  }, [state, onSuccess, onError]);

  const handleRipple = (e: React.MouseEvent<HTMLDivElement>) => {
    if (variant !== 'ripple') return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    
    setRipples([...ripples, { x, y, id }]);
    
    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== id));
    }, 600);
  };

  const feedbackVariants = {
    hover: {
      idle: {},
      loading: {},
      success: {},
      error: {}
    },
    scale: {
      idle: { scale: 1 },
      loading: { scale: 0.95 },
      success: { scale: [1, 1.05, 1] },
      error: { scale: [1, 0.95, 1] }
    },
    ripple: {
      idle: {},
      loading: {},
      success: {},
      error: {}
    }
  };

  const stateIcons = {
    loading: <Loader2 className="h-5 w-5 animate-spin" />,
    success: <Check className="h-5 w-5" />,
    error: <X className="h-5 w-5" />
  };

  return (
    <motion.div
      className={cn("relative overflow-hidden", className)}
      animate={variant === 'scale' ? feedbackVariants.scale[localState] : undefined}
      transition={{ duration: 0.3 }}
      onClick={handleRipple}
      whileHover={variant === 'hover' ? { scale: 1.02, transition: { duration: 0.2 } } : undefined}
      whileTap={variant === 'hover' ? { scale: 0.98 } : undefined}
    >
      {children}
      
      {/* Ripple Effect */}
      {variant === 'ripple' && (
        <>
          {ripples.map(ripple => (
            <motion.span
              key={ripple.id}
              className="absolute inset-0 pointer-events-none"
              initial={{ scale: 0, opacity: 0.5 }}
              animate={{ scale: 4, opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              style={{
                left: ripple.x,
                top: ripple.y,
                width: 20,
                height: 20,
                borderRadius: '50%',
                backgroundColor: 'currentColor',
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
        </>
      )}
      
      {/* State Overlay */}
      <AnimatePresence>
        {localState !== 'idle' && (
          <motion.div
            className={cn(
              "absolute inset-0 flex items-center justify-center",
              "bg-background/80 backdrop-blur-sm",
              localState === 'success' && "text-green-600",
              localState === 'error' && "text-destructive"
            )}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {stateIcons[localState]}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface SuccessAnimationProps {
  show: boolean;
  onComplete?: () => void;
}

export function SuccessAnimation({ show, onComplete }: SuccessAnimationProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onAnimationComplete={onComplete}
        >
          <motion.div
            className="bg-green-500 text-white rounded-full p-4"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <Check className="h-8 w-8" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ErrorShakeProps {
  children: React.ReactNode;
  shake: boolean;
  onShakeComplete?: () => void;
}

export function ErrorShake({ children, shake, onShakeComplete }: ErrorShakeProps) {
  return (
    <motion.div
      animate={shake ? {
        x: [-10, 10, -10, 10, 0],
        transition: { duration: 0.5 }
      } : {}}
      onAnimationComplete={onShakeComplete}
    >
      {children}
    </motion.div>
  );
}

interface LoadingOverlayProps {
  show: boolean;
  message?: string;
}

export function LoadingOverlay({ show, message = "Loading..." }: LoadingOverlayProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="absolute inset-0 z-40 flex items-center justify-center bg-background/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}