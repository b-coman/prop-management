/**
 * @fileoverview Centralized logging system with runtime configuration
 * @module lib/logger
 * 
 * @description
 * Performance-aware logging system that can be controlled without code changes.
 * Supports namespace-based filtering, multiple configuration methods, and
 * structured metadata. Designed for zero overhead when disabled in production
 * while maintaining detailed debugging capabilities when needed.
 * 
 * @architecture
 * Location: Infrastructure layer - cross-cutting concern
 * Layer: Infrastructure/Utilities
 * Pattern: Factory pattern with singleton loggers per namespace
 * 
 * @dependencies
 * - Internal: None (standalone utility)
 * - External: Browser APIs (console, localStorage, URLSearchParams)
 * - Future: Sentry, LogRocket, or other monitoring services
 * 
 * @relationships
 * - Provides: Logging capabilities to all v2 components
 * - Consumers: All booking-v2 components and services
 * - Configuration: Via environment, URL params, localStorage, or runtime
 * 
 * @state-management
 * - Config Storage: localStorage for persistence, URL for temporary
 * - Runtime Control: LoggerConfig helper methods
 * - No React state - pure JavaScript for universal usage
 * 
 * @performance
 * - Zero overhead when disabled (early return, no string formatting)
 * - Lazy evaluation support for expensive computations
 * - Namespace filtering happens before any processing
 * 
 * @example
 * ```typescript
 * import { loggers } from '@/lib/logger';
 * const logger = loggers.bookingContext;
 * 
 * logger.debug('State updated', { checkIn, checkOut });
 * logger.error('Booking failed', error);
 * 
 * // Enable debugging via URL: ?debug=booking:*
 * // Or via console: LoggerConfig.enableDebug('booking:*')
 * ```
 * 
 * @migration-notes
 * - Version: v2.0
 * - Purpose: Replace console.log scattered throughout v1
 * - Compatible with both v1 and v2 systems
 * 
 * @todos
 * - [ ] Add external service integration (Sentry, etc.)
 * - [ ] Add log batching for high-frequency events
 * - [ ] Add log export functionality for debugging
 * 
 * @see {@link ../docs/implementation/booking-system-v2-logging-strategy.md}
 * @since v2.0.0
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 99
}

export interface LogConfig {
  level: LogLevel;
  namespaces: string[];
  enabledInProduction: boolean;
  prettyPrint: boolean;
  includeTimestamp: boolean;
  includeStackTrace: boolean;
}

export interface LogMetadata {
  [key: string]: any;
}

class Logger {
  private config: LogConfig;
  private namespace: string;

  constructor(namespace: string) {
    this.namespace = namespace;
    this.config = this.loadConfig();
  }

  private loadConfig(): LogConfig {
    // Default configuration
    const defaultConfig: LogConfig = {
      level: LogLevel.INFO,
      namespaces: ['*'], // All namespaces enabled by default
      enabledInProduction: true,
      prettyPrint: true,
      includeTimestamp: true,
      includeStackTrace: false
    };

    // Override with environment variables
    if (typeof window !== 'undefined') {
      // Client-side configuration
      const savedConfig = window.localStorage.getItem('RENTAL_SPOT_LOG_CONFIG');
      if (savedConfig) {
        try {
          const parsed = JSON.parse(savedConfig);
          return { ...defaultConfig, ...parsed };
        } catch (e) {
          console.warn('Invalid log config in localStorage');
        }
      }

      // Check URL parameters for temporary debugging
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('debug')) {
        const debugNamespaces = urlParams.get('debug') || '*';
        return {
          ...defaultConfig,
          level: LogLevel.DEBUG,
          namespaces: debugNamespaces.split(','),
          enabledInProduction: true
        };
      }
    }

    // Server-side configuration from environment variables
    if (process.env.RENTAL_SPOT_LOG_LEVEL) {
      defaultConfig.level = LogLevel[process.env.RENTAL_SPOT_LOG_LEVEL as keyof typeof LogLevel] || LogLevel.INFO;
    }
    if (process.env.RENTAL_SPOT_LOG_NAMESPACES) {
      defaultConfig.namespaces = process.env.RENTAL_SPOT_LOG_NAMESPACES.split(',');
    }
    if (process.env.RENTAL_SPOT_LOG_PRODUCTION === 'true') {
      defaultConfig.enabledInProduction = true;
    }

    return defaultConfig;
  }

  private shouldLog(level: LogLevel): boolean {
    // Check if logging is enabled for production
    if (process.env.NODE_ENV === 'production' && !this.config.enabledInProduction) {
      return false;
    }

    // Check log level
    if (level < this.config.level) {
      return false;
    }

    // Check namespace filtering
    if (!this.isNamespaceEnabled()) {
      return false;
    }

    return true;
  }

  private isNamespaceEnabled(): boolean {
    // Check if all namespaces are enabled
    if (this.config.namespaces.includes('*')) {
      return true;
    }

    // Check specific namespace patterns
    return this.config.namespaces.some(pattern => {
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        return this.namespace.startsWith(prefix);
      }
      return this.namespace === pattern;
    });
  }

  private formatMessage(level: string, message: string, metadata?: LogMetadata): string {
    const parts = [];

    if (this.config.includeTimestamp) {
      parts.push(new Date().toISOString());
    }

    parts.push(`[${level}]`);
    parts.push(`[${this.namespace}]`);
    parts.push(message);

    if (metadata && Object.keys(metadata).length > 0) {
      if (this.config.prettyPrint) {
        parts.push('\n' + JSON.stringify(metadata, null, 2));
      } else {
        parts.push(JSON.stringify(metadata));
      }
    }

    return parts.join(' ');
  }

  private log(level: LogLevel, levelName: string, message: string, metadata?: LogMetadata) {
    if (!this.shouldLog(level)) {
      return;
    }

    // Cloud Run: output structured JSON so Cloud Logging picks it up
    const isServer = typeof window === 'undefined';
    if (isServer && process.env.NODE_ENV === 'production') {
      const severityMap: Record<string, string> = {
        DEBUG: 'DEBUG',
        INFO: 'INFO',
        WARN: 'WARNING',
        ERROR: 'ERROR',
      };
      const entry: Record<string, any> = {
        severity: severityMap[levelName] || 'DEFAULT',
        message,
        component: this.namespace,
      };
      if (metadata) {
        const { error: _err, ...rest } = metadata;
        if (Object.keys(rest).length > 0) entry.metadata = rest;
        if (_err) {
          entry.error = typeof _err === 'object' && _err.message
            ? { message: _err.message, stack: _err.stack }
            : _err;
        }
      }
      // Single-line JSON to stdout — Cloud Run logging agent parses this
      process.stdout.write(JSON.stringify(entry) + '\n');
      return;
    }

    const formattedMessage = this.formatMessage(levelName, message, metadata);

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage);
        if (this.config.includeStackTrace && metadata?.error) {
          console.error(metadata.error.stack);
        }
        break;
    }

    // Send to external logging service if configured
    this.sendToExternalLogger(level, levelName, message, metadata);
  }

  private sendToExternalLogger(level: LogLevel, levelName: string, message: string, metadata?: LogMetadata) {
    // TODO: Implement external logging service integration (e.g., Sentry, LogRocket, DataDog)
    // This is where you'd send logs to your monitoring service
  }

  debug(message: string, metadata?: LogMetadata) {
    this.log(LogLevel.DEBUG, 'DEBUG', message, metadata);
  }

  info(message: string, metadata?: LogMetadata) {
    this.log(LogLevel.INFO, 'INFO', message, metadata);
  }

  warn(message: string, metadata?: LogMetadata) {
    this.log(LogLevel.WARN, 'WARN', message, metadata);
  }

  error(message: string, error?: Error | any, metadata?: LogMetadata) {
    const meta = {
      ...metadata,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error
    };
    this.log(LogLevel.ERROR, 'ERROR', message, meta);
  }

  // Performance logging helpers
  time(label: string) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.time(`[${this.namespace}] ${label}`);
    }
  }

  timeEnd(label: string) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.timeEnd(`[${this.namespace}] ${label}`);
    }
  }

  // Group logging for related operations
  group(label: string) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.group(`[${this.namespace}] ${label}`);
    }
  }

  groupEnd() {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.groupEnd();
    }
  }
}

// Factory function to create loggers
export function createLogger(namespace: string): Logger {
  return new Logger(namespace);
}

// Global logger configuration helpers
export const LoggerConfig = {
  /**
   * Set global log configuration (client-side only)
   */
  setConfig(config: Partial<LogConfig>) {
    if (typeof window !== 'undefined') {
      const currentConfig = window.localStorage.getItem('RENTAL_SPOT_LOG_CONFIG');
      const merged = currentConfig 
        ? { ...JSON.parse(currentConfig), ...config }
        : config;
      window.localStorage.setItem('RENTAL_SPOT_LOG_CONFIG', JSON.stringify(merged));
      console.info('[Logger] Configuration updated. Reload page to apply changes.');
    }
  },

  /**
   * Enable debug mode for specific namespaces
   */
  enableDebug(namespaces: string | string[]) {
    const ns = Array.isArray(namespaces) ? namespaces : [namespaces];
    this.setConfig({
      level: LogLevel.DEBUG,
      namespaces: ns,
      enabledInProduction: true
    });
  },

  /**
   * Disable all logging
   */
  disable() {
    this.setConfig({
      level: LogLevel.NONE
    });
  },

  /**
   * Reset to default configuration
   */
  reset() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('RENTAL_SPOT_LOG_CONFIG');
      console.info('[Logger] Configuration reset. Reload page to apply changes.');
    }
  }
};

// Pre-configured loggers for different parts of the application
export const loggers = {
  booking: createLogger('booking'),
  bookingContext: createLogger('booking:context'),
  bookingAPI: createLogger('booking:api'),
  bookingStorage: createLogger('booking:storage'),
  bookingUI: createLogger('booking:ui'),
  pricing: createLogger('pricing'),
  availability: createLogger('availability'),
  auth: createLogger('auth'),
  stripe: createLogger('stripe'),
  email: createLogger('email'),
  performance: createLogger('performance'),
  error: createLogger('error'),
  languageSystem: createLogger('language:system'),
  admin: createLogger('admin'),
  adminBookings: createLogger('admin:bookings'),
  adminPricing: createLogger('admin:pricing'),
  authorization: createLogger('authorization'),
  icalSync: createLogger('ical:sync'),
  adminReviews: createLogger('admin:reviews'),
  review: createLogger('review'),
  tracking: createLogger('tracking'),
  guest: createLogger('guest'),
  whatsapp: createLogger('whatsapp'),
  housekeeping: createLogger('housekeeping'),
  contentData: createLogger('content:data'),
};

// Type-safe logger categories
export type LoggerCategory = keyof typeof loggers;