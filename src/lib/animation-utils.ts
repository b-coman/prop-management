/**
 * Animation utility classes and configurations
 * For consistent animations throughout the application
 */

export const animations = {
  // Fade in/out animations
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.3 }
  },
  
  fadeInUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: "easeOut" }
  },
  
  fadeInDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: "easeOut" }
  },
  
  // Scale animations
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.3, ease: "easeOut" }
  },
  
  // Slide animations
  slideInRight: {
    initial: { opacity: 0, x: 50 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.4, ease: "easeOut" }
  },
  
  slideInLeft: {
    initial: { opacity: 0, x: -50 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.4, ease: "easeOut" }
  },
  
  // Stagger animations for lists
  staggerChildren: {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  },
  
  staggeredFadeIn: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3 }
  }
};

// Transition presets
export const transitions = {
  spring: {
    type: "spring",
    stiffness: 400,
    damping: 30
  },
  
  smooth: {
    type: "spring",
    stiffness: 100,
    damping: 20
  },
  
  bouncy: {
    type: "spring",
    stiffness: 500,
    damping: 25
  },
  
  // Hover transitions
  hoverScale: {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.98 },
    transition: { type: "spring", stiffness: 400, damping: 30 }
  },
  
  hoverLift: {
    whileHover: { y: -5 },
    whileTap: { y: 0 },
    transition: { type: "spring", stiffness: 400, damping: 30 }
  }
};

// CSS animation classes for non-framer motion components
export const cssAnimations = {
  fadeIn: "animate-in fade-in duration-300",
  fadeInUp: "animate-in fade-in slide-in-from-bottom-4 duration-400",
  fadeInDown: "animate-in fade-in slide-in-from-top-4 duration-400",
  slideInRight: "animate-in fade-in slide-in-from-right-8 duration-400",
  slideInLeft: "animate-in fade-in slide-in-from-left-8 duration-400",
  scaleIn: "animate-in fade-in zoom-in-95 duration-300",
  
  // Exit animations
  fadeOut: "animate-out fade-out duration-300",
  fadeOutUp: "animate-out fade-out slide-out-to-top-4 duration-400",
  fadeOutDown: "animate-out fade-out slide-out-to-bottom-4 duration-400",
  
  // Loading animations
  pulse: "animate-pulse",
  spin: "animate-spin",
  bounce: "animate-bounce",
  
  // Micro interactions
  wiggle: "hover:animate-wiggle",
  ring: "hover:animate-ring",
  tada: "hover:animate-tada"
};

// Animation delays
export const delays = {
  none: 0,
  fast: 100,
  normal: 200,
  slow: 300,
  verySlow: 500
};

// Utility function to apply staggered animation delays
export const staggerDelay = (index: number, baseDelay: number = 100) => ({
  animationDelay: `${index * baseDelay}ms`
});

export const animationVariants = {
  container: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  },
  item: {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: "easeOut"
      }
    }
  }
};