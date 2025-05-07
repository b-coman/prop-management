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
