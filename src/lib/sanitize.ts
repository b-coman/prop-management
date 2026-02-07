// src/lib/sanitize.ts
/**
 * Basic HTML tag stripper.
 * WARNING: This is a very basic sanitizer and may not be sufficient for all use cases.
 * For robust sanitization, consider using a dedicated library like DOMPurify (client-side)
 * or a server-side sanitization library.
 * @param html The HTML string to sanitize.
 * @returns The sanitized string.
 */
export function stripHtmlTags(html: string | null | undefined): string {
  if (html === null || html === undefined) {
    return '';
  }
  // Replace HTML tags with an empty string
  return String(html).replace(/(<([^>]+)>)/gi, '');
}

/**
 * Sanitizes text by trimming whitespace and stripping HTML tags.
 * @param text The text string to sanitize.
 * @returns The sanitized string.
 */
export function sanitizeText(text: string | null | undefined): string {
  if (text === null || text === undefined) {
    return '';
  }
  return stripHtmlTags(String(text).trim());
}

/**
 * A more specific sanitizer for email inputs.
 * For emails, we typically want to trim whitespace but not strip characters
 * like '<' or '>' which might (rarely) be part of a display name in an email string,
 * though for simple email address fields, simple trimming is often enough.
 * HTML tags should still be stripped.
 * @param email The email string to sanitize.
 * @returns The sanitized email string.
 */
export function sanitizeEmail(email: string | null | undefined): string {
  if (email === null || email === undefined) {
    return '';
  }
  // Trim whitespace and strip HTML tags.
  // Avoid overly aggressive sanitization that might break valid email formats.
  return stripHtmlTags(String(email).trim());
}

/**
 * A specific sanitizer for phone number inputs.
 * Often involves stripping non-numeric characters except for a leading '+'.
 * This example is basic and might need adjustment based on expected phone formats.
 * @param phone The phone number string to sanitize.
 * @returns The sanitized phone number string.
 */
export function sanitizePhone(phone: string | null | undefined): string {
  if (phone === null || phone === undefined) {
    return '';
  }
  // Basic: remove common non-numeric chars except '+' if it's at the start.
  // This is highly dependent on the desired phone number formats.
  // For more robust phone number handling, use a library like 'libphonenumber-js'.
  let sanitized = String(phone).replace(/[^\d+]/g, ''); // Allow + and digits
  if (sanitized.startsWith('+')) {
    sanitized = '+' + sanitized.substring(1).replace(/\+/g, ''); // Keep only leading +
  } else {
    sanitized = sanitized.replace(/\+/g, ''); // Remove + if not leading
  }
  return sanitized;
}

/**
 * Normalize a phone number to E.164 format.
 * Strips invisible Unicode characters (RTL marks, zero-width spaces),
 * handles Romanian number formats, and ensures international prefix.
 *
 * Examples:
 *   "0723184334"           → "+40723184334"
 *   "‭0729122829‬"         → "+40729122829"  (had RTL marks)
 *   "(+972) 54 549 3899"  → "+972545493899"
 *   "+44 7425 752603"     → "+447425752603"
 *   "0040712345678"       → "+40712345678"
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';

  // 1. Strip invisible Unicode characters (RTL marks, zero-width spaces, etc.)
  let cleaned = phone.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '');

  // 2. Strip all non-digit, non-+ characters
  cleaned = cleaned.replace(/[^\d+]/g, '');

  // 3. Remove any '+' that isn't at the start
  if (cleaned.startsWith('+')) {
    cleaned = '+' + cleaned.substring(1).replace(/\+/g, '');
  } else {
    cleaned = cleaned.replace(/\+/g, '');
  }

  // 4. Handle Romanian number formats
  // 0040... → +40...
  if (cleaned.startsWith('0040')) {
    cleaned = '+40' + cleaned.substring(4);
  }
  // 07XXXXXXXX (10 digits, Romanian mobile) → +407XXXXXXXX
  else if (cleaned.startsWith('0') && cleaned.length === 10 && cleaned[1] === '7') {
    cleaned = '+40' + cleaned.substring(1);
  }
  // 40XXXXXXXXX (11 digits starting with 40, no prefix) → +40XXXXXXXXX
  else if (!cleaned.startsWith('+') && cleaned.startsWith('40') && cleaned.length === 11) {
    cleaned = '+' + cleaned;
  }
  // Already has + prefix — leave as is
  else if (cleaned.startsWith('+')) {
    // Already in international format
  }
  // Bare digits with known country code lengths (best effort)
  else if (cleaned.length >= 10 && !cleaned.startsWith('+')) {
    // Assume needs + prefix if starts with a known country code
    // Common codes: 972 (IL), 44 (UK), 49 (DE), 33 (FR), 31 (NL), 48 (PL), 39 (IT), 34 (ES), 380 (UA), 32 (BE), 7 (RU), 966 (SA), 1 (US/CA)
    const knownPrefixes = ['972', '44', '49', '33', '31', '48', '39', '34', '380', '32', '966', '1'];
    for (const prefix of knownPrefixes) {
      if (cleaned.startsWith(prefix)) {
        cleaned = '+' + cleaned;
        break;
      }
    }
  }

  return cleaned;
}
