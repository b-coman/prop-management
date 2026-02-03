'use server';

import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { format } from 'date-fns';
import type { Booking, Property, Inquiry, LanguageCode } from '@/types';
import { getPropertyBySlug } from '@/lib/property-utils';
import {
  createBookingConfirmationTemplate,
  createHoldConfirmationTemplate,
  createInquiryConfirmationTemplate,
  createInquiryResponseTemplate,
  createBookingCancellationTemplate
} from './emailTemplates';

// Development transporter for testing - uses Ethereal
let devTransporter: nodemailer.Transporter | null = null;

// Production email client - uses Resend
let resendClient: Resend | null = null;

// Check if we should use Resend (has API key configured)
function useResend(): boolean {
  return !!process.env.RESEND_API_KEY;
}

// Get Resend client
function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

// Initialize development transporter (Ethereal)
async function getDevTransporter() {
  if (!devTransporter) {
    const testAccount = await nodemailer.createTestAccount();
    devTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log(`[EmailService] Created test email account: ${testAccount.user}`);
  }
  return devTransporter;
}

// Send email using Resend (production)
async function sendWithResend(
  to: string,
  subject: string,
  text: string,
  html: string,
  from?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const resend = getResendClient();
    const fromEmail = from || process.env.RESEND_FROM_EMAIL || 'RentalSpot <bookings@rentalspot.com>';

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject,
      text,
      html,
    });

    if (error) {
      console.error('[EmailService] Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log(`[EmailService] Email sent via Resend, ID: ${data?.id}`);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('[EmailService] Error sending via Resend:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// Send email using Nodemailer (development/Ethereal)
async function sendWithNodemailer(
  to: string,
  subject: string,
  text: string,
  html: string,
  from?: string
): Promise<{ success: boolean; messageId?: string; previewUrl?: string; error?: string }> {
  try {
    const transporter = await getDevTransporter();
    const fromEmail = from || '"RentalSpot" <bookings@rentalspot.com>';

    const info = await transporter.sendMail({
      from: fromEmail,
      to,
      subject,
      text,
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) as string;
    console.log(`[EmailService] Email sent via Ethereal, Preview: ${previewUrl}`);

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (error) {
    console.error('[EmailService] Error sending via Nodemailer:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// Unified email sending function
async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html: string,
  from?: string
): Promise<{ success: boolean; messageId?: string; previewUrl?: string; error?: string }> {
  // Use Resend if API key is configured
  if (useResend()) {
    return sendWithResend(to, subject, text, html, from);
  }
  // Fall back to Ethereal for development/testing
  return sendWithNodemailer(to, subject, text, html, from);
}

// Format dates for display
function formatDate(date: any): string {
  if (!date) return 'N/A';
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    return format(dateObj, 'PPP');
  } catch (e) {
    return 'Invalid date';
  }
}

// Format currency for display
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount);
}

// Helper to get booking by ID (avoids circular dependencies)
async function getBookingById(bookingId: string): Promise<Booking | null> {
  try {
    const { getBookingById: fetchBooking } = await import('./bookingService');
    return await fetchBooking(bookingId);
  } catch (error) {
    console.error(`[EmailService] Error importing getBookingById: ${error}`);
    return null;
  }
}

// Helper to get property name
function getPropertyName(property: Property | null, fallback: string): string {
  if (!property?.name) return fallback;
  return typeof property.name === 'string'
    ? property.name
    : (property.name as any)?.en || fallback;
}

/**
 * Sends a booking confirmation email to the guest
 */
export async function sendBookingConfirmationEmail(
  bookingId: string,
  recipientEmail?: string
): Promise<{ success: boolean; messageId?: string; previewUrl?: string; error?: string }> {
  try {
    console.log(`[EmailService] Preparing booking confirmation for ${bookingId}`);

    const booking = await getBookingById(bookingId);
    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    const email = recipientEmail || booking.guestInfo.email;
    if (!email) {
      return { success: false, error: 'No recipient email' };
    }

    const property = await getPropertyBySlug(booking.propertyId);
    const propertyName = getPropertyName(property, booking.propertyId);

    // Use stored language preference, default to 'en'
    const language: LanguageCode = booking.language || 'en';

    const { text, html, subject } = createBookingConfirmationTemplate({
      guestName: `${booking.guestInfo.firstName} ${booking.guestInfo.lastName || ''}`.trim(),
      bookingId: booking.id,
      propertyName,
      checkInDate: formatDate(booking.checkInDate),
      checkOutDate: formatDate(booking.checkOutDate),
      checkInTime: property?.checkInTime,
      checkOutTime: property?.checkOutTime,
      numberOfGuests: booking.numberOfGuests,
      numberOfNights: booking.pricing.numberOfNights,
      baseAmount: formatCurrency(booking.pricing.baseRate * booking.pricing.numberOfNights, booking.pricing.currency),
      cleaningFee: formatCurrency(booking.pricing.cleaningFee, booking.pricing.currency),
      extraGuestFee: booking.pricing.extraGuestFee ? formatCurrency(booking.pricing.extraGuestFee, booking.pricing.currency) : undefined,
      totalAmount: formatCurrency(booking.pricing.total, booking.pricing.currency),
      currency: booking.pricing.currency,
      cancellationPolicy: typeof property?.cancellationPolicy === 'string' ? property.cancellationPolicy : (property?.cancellationPolicy as any)?.en,
      propertyAddress: property?.location ? `${property.location.address}, ${property.location.city}, ${property.location.state}, ${property.location.country}` : undefined,
      hostName: (property as any)?.hostInfo?.name,
      hostPhone: (property as any)?.hostInfo?.phone,
      specialRequests: (booking as any).specialRequests
    }, language);

    const emailSubject = `${subject} - ${propertyName}`;
    console.log(`[EmailService] Sending booking confirmation (${language}) to ${email}`);

    return sendEmail(email, emailSubject, text, html);
  } catch (error) {
    console.error('[EmailService] Error sending booking confirmation:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Sends a hold confirmation email to the guest
 */
export async function sendHoldConfirmationEmail(
  bookingId: string,
  recipientEmail?: string
): Promise<{ success: boolean; messageId?: string; previewUrl?: string; error?: string }> {
  try {
    console.log(`[EmailService] Preparing hold confirmation for ${bookingId}`);

    const booking = await getBookingById(bookingId);
    if (!booking) {
      return { success: false, error: 'Hold booking not found' };
    }

    const email = recipientEmail || booking.guestInfo.email;
    if (!email) {
      return { success: false, error: 'No recipient email' };
    }

    const property = await getPropertyBySlug(booking.propertyId);
    const propertyName = getPropertyName(property, booking.propertyId);

    // Use stored language preference, default to 'en'
    const language: LanguageCode = booking.language || 'en';

    const { text, html, subject } = createHoldConfirmationTemplate({
      guestName: `${booking.guestInfo.firstName} ${booking.guestInfo.lastName || ''}`.trim(),
      holdId: booking.id,
      propertyName,
      checkInDate: formatDate(booking.checkInDate),
      checkOutDate: formatDate(booking.checkOutDate),
      numberOfGuests: booking.numberOfGuests,
      expirationTime: booking.holdUntil ? formatDate(booking.holdUntil) : 'N/A',
      estimatedTotal: formatCurrency(booking.holdFee || 0, booking.pricing?.currency || 'EUR'),
      currency: booking.pricing?.currency || 'EUR',
      completeBookingUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/booking/check/${booking.propertyId}`
    }, language);

    const emailSubject = `${subject} - ${propertyName}`;
    console.log(`[EmailService] Sending hold confirmation (${language}) to ${email}`);

    return sendEmail(email, emailSubject, text, html);
  } catch (error) {
    console.error('[EmailService] Error sending hold confirmation:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Sends a booking notification email to the property owner or admin
 */
export async function sendBookingNotificationEmail(
  bookingId: string,
  recipientEmail: string
): Promise<{ success: boolean; messageId?: string; previewUrl?: string; error?: string }> {
  try {
    console.log(`[EmailService] Preparing booking notification for ${bookingId}`);

    const booking = await getBookingById(bookingId);
    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    const property = await getPropertyBySlug(booking.propertyId);
    const propertyName = getPropertyName(property, booking.propertyId);
    const checkInDate = formatDate(booking.checkInDate);
    const checkOutDate = formatDate(booking.checkOutDate);

    const text = `
New Booking Notification

A new booking has been made for your property.

Booking Details:
------------------
Booking ID: ${booking.id}
Property: ${propertyName}
Check-in: ${checkInDate}
Check-out: ${checkOutDate}
Guests: ${booking.numberOfGuests}

Guest Information:
------------------
Name: ${booking.guestInfo.firstName} ${booking.guestInfo.lastName || ''}
Email: ${booking.guestInfo.email}
Phone: ${booking.guestInfo.phone || 'Not provided'}

Payment Summary:
------------------
${booking.pricing.numberOfNights} nights: ${formatCurrency(booking.pricing.baseRate * booking.pricing.numberOfNights, booking.pricing.currency)}
Cleaning fee: ${formatCurrency(booking.pricing.cleaningFee, booking.pricing.currency)}
${booking.pricing.extraGuestFee ? `Extra guest fee: ${formatCurrency(booking.pricing.extraGuestFee, booking.pricing.currency)}\n` : ''}${booking.pricing.taxes ? `Taxes: ${formatCurrency(booking.pricing.taxes, booking.pricing.currency)}\n` : ''}${booking.pricing.discountAmount ? `Discount: -${formatCurrency(booking.pricing.discountAmount, booking.pricing.currency)}\n` : ''}Total: ${formatCurrency(booking.pricing.total, booking.pricing.currency)}

You can view the full booking details in your admin dashboard.

Thank you,
The RentalSpot Team
    `;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto}
.header{background:#4f46e5;color:white;padding:20px;text-align:center}
.content{padding:20px}
.section{background:#f9fafb;padding:15px;margin-bottom:20px;border-radius:5px}
.footer{text-align:center;padding:20px;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb}
table{width:100%}td{padding:5px 0}.right{text-align:right}
.total{font-weight:bold;font-size:18px}
.button{display:inline-block;background:#4f46e5;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;margin-top:15px}
</style></head><body>
<div class="header"><h1>New Booking Notification</h1></div>
<div class="content">
<p>A new booking has been made for your property.</p>
<div class="section"><h2>Booking Details</h2>
<p><strong>Booking ID:</strong> ${booking.id}</p>
<p><strong>Property:</strong> ${propertyName}</p>
<p><strong>Check-in:</strong> ${checkInDate}</p>
<p><strong>Check-out:</strong> ${checkOutDate}</p>
<p><strong>Guests:</strong> ${booking.numberOfGuests}</p></div>
<div class="section"><h2>Guest Information</h2>
<p><strong>Name:</strong> ${booking.guestInfo.firstName} ${booking.guestInfo.lastName || ''}</p>
<p><strong>Email:</strong> ${booking.guestInfo.email}</p>
<p><strong>Phone:</strong> ${booking.guestInfo.phone || 'Not provided'}</p></div>
<div class="section"><h2>Payment Summary</h2>
<table>
<tr><td>${booking.pricing.numberOfNights} nights</td><td class="right">${formatCurrency(booking.pricing.baseRate * booking.pricing.numberOfNights, booking.pricing.currency)}</td></tr>
<tr><td>Cleaning fee</td><td class="right">${formatCurrency(booking.pricing.cleaningFee, booking.pricing.currency)}</td></tr>
${booking.pricing.extraGuestFee ? `<tr><td>Extra guest fee</td><td class="right">${formatCurrency(booking.pricing.extraGuestFee, booking.pricing.currency)}</td></tr>` : ''}
${booking.pricing.taxes ? `<tr><td>Taxes</td><td class="right">${formatCurrency(booking.pricing.taxes, booking.pricing.currency)}</td></tr>` : ''}
${booking.pricing.discountAmount ? `<tr><td>Discount</td><td class="right">-${formatCurrency(booking.pricing.discountAmount, booking.pricing.currency)}</td></tr>` : ''}
<tr class="total"><td>Total</td><td class="right">${formatCurrency(booking.pricing.total, booking.pricing.currency)}</td></tr>
</table></div>
<a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://rentalspot.com'}/admin/bookings/${booking.id}" class="button">View Booking Details</a>
<p>Thank you,<br>The RentalSpot Team</p></div>
<div class="footer"><p>&copy; ${new Date().getFullYear()} RentalSpot. All rights reserved.</p></div>
</body></html>`;

    const subject = `New Booking - ${propertyName}`;
    console.log(`[EmailService] Sending booking notification to ${recipientEmail}`);

    return sendEmail(recipientEmail, subject, text, html);
  } catch (error) {
    console.error('[EmailService] Error sending booking notification:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Sends an inquiry confirmation email to the guest
 */
export async function sendInquiryConfirmationEmail(
  recipientEmail: string,
  inquiry: Inquiry
): Promise<{ success: boolean; messageId?: string; previewUrl?: string; error?: string }> {
  try {
    console.log(`[EmailService] Preparing inquiry confirmation to ${recipientEmail}`);

    const property = await getPropertyBySlug(inquiry.propertySlug);
    const propertyName = getPropertyName(property, inquiry.propertySlug);

    // Use stored language preference, default to 'en'
    const language: LanguageCode = inquiry.language || 'en';

    const { text, html, subject } = createInquiryConfirmationTemplate({
      guestName: `${inquiry.guestInfo.firstName} ${inquiry.guestInfo.lastName || ''}`.trim(),
      inquiryId: inquiry.id,
      propertyName,
      message: inquiry.message
    }, language);

    const emailSubject = `${subject} - ${propertyName}`;
    console.log(`[EmailService] Sending inquiry confirmation (${language}) to ${recipientEmail}`);

    return sendEmail(recipientEmail, emailSubject, text, html);
  } catch (error) {
    console.error('[EmailService] Error sending inquiry confirmation:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Sends an inquiry notification email to the property owner or admin
 */
export async function sendInquiryNotificationEmail(
  recipientEmail: string,
  inquiry: Inquiry
): Promise<{ success: boolean; messageId?: string; previewUrl?: string; error?: string }> {
  try {
    console.log(`[EmailService] Preparing inquiry notification to ${recipientEmail}`);

    const property = await getPropertyBySlug(inquiry.propertySlug);
    const propertyName = getPropertyName(property, inquiry.propertySlug);
    const checkInDate = formatDate(inquiry.checkIn);
    const checkOutDate = formatDate(inquiry.checkOut);

    const text = `
New Inquiry Notification

You have received a new inquiry for your property.

Inquiry Details:
------------------
Inquiry ID: ${inquiry.id}
Property: ${propertyName}
Check-in: ${checkInDate}
Check-out: ${checkOutDate}
Guests: ${inquiry.guestCount}

Guest Information:
------------------
Name: ${inquiry.guestInfo.firstName} ${inquiry.guestInfo.lastName || ''}
Email: ${inquiry.guestInfo.email}
Phone: ${inquiry.guestInfo.phone || 'Not provided'}

Guest Message:
------------------
${inquiry.message}

You can respond to this inquiry through your admin dashboard.

Thank you,
The RentalSpot Team
    `;

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto}
.header{background:#4f46e5;color:white;padding:20px;text-align:center}
.content{padding:20px}
.section{background:#f9fafb;padding:15px;margin-bottom:20px;border-radius:5px}
.footer{text-align:center;padding:20px;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb}
.button{display:inline-block;background:#4f46e5;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;margin-top:15px}
</style></head><body>
<div class="header"><h1>New Inquiry Notification</h1></div>
<div class="content">
<p>You have received a new inquiry for your property.</p>
<div class="section"><h2>Inquiry Details</h2>
<p><strong>Inquiry ID:</strong> ${inquiry.id}</p>
<p><strong>Property:</strong> ${propertyName}</p>
<p><strong>Check-in:</strong> ${checkInDate}</p>
<p><strong>Check-out:</strong> ${checkOutDate}</p>
<p><strong>Guests:</strong> ${inquiry.guestCount}</p></div>
<div class="section"><h2>Guest Information</h2>
<p><strong>Name:</strong> ${inquiry.guestInfo.firstName} ${inquiry.guestInfo.lastName || ''}</p>
<p><strong>Email:</strong> ${inquiry.guestInfo.email}</p>
<p><strong>Phone:</strong> ${inquiry.guestInfo.phone || 'Not provided'}</p></div>
<div class="section"><h2>Guest Message</h2><p>${inquiry.message}</p></div>
<a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://rentalspot.com'}/admin/inquiries/${inquiry.id}" class="button">Respond to Inquiry</a>
<p>Thank you,<br>The RentalSpot Team</p></div>
<div class="footer"><p>&copy; ${new Date().getFullYear()} RentalSpot. All rights reserved.</p></div>
</body></html>`;

    const subject = `New Inquiry - ${propertyName}`;
    console.log(`[EmailService] Sending inquiry notification to ${recipientEmail}`);

    return sendEmail(recipientEmail, subject, text, html);
  } catch (error) {
    console.error('[EmailService] Error sending inquiry notification:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Sends an inquiry response email to the guest
 */
export async function sendInquiryResponseEmail(
  inquiryId: string,
  responseMessage: string,
  recipientEmail: string
): Promise<{ success: boolean; messageId?: string; previewUrl?: string; error?: string }> {
  try {
    console.log(`[EmailService] Preparing inquiry response for ${inquiryId}`);

    const { getInquiryById } = await import('./inquiryService');
    const inquiry = await getInquiryById(inquiryId);
    if (!inquiry) {
      return { success: false, error: 'Inquiry not found' };
    }

    const property = await getPropertyBySlug(inquiry.propertySlug);
    const propertyName = getPropertyName(property, inquiry.propertySlug);

    // Use stored language preference, default to 'en'
    const language: LanguageCode = inquiry.language || 'en';

    const { text, html, subject } = createInquiryResponseTemplate({
      guestName: `${inquiry.guestInfo.firstName} ${inquiry.guestInfo.lastName || ''}`.trim(),
      inquiryId: inquiry.id,
      propertyName,
      message: inquiry.message,
      responseMessage,
      hostName: (property as any)?.hostInfo?.name
    }, language);

    const emailSubject = `${subject} - ${propertyName}`;
    console.log(`[EmailService] Sending inquiry response (${language}) to ${recipientEmail}`);

    return sendEmail(recipientEmail, emailSubject, text, html);
  } catch (error) {
    console.error('[EmailService] Error sending inquiry response:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Sends a booking cancellation email to the guest
 */
export async function sendBookingCancellationEmail(
  bookingId: string,
  recipientEmail?: string
): Promise<{ success: boolean; messageId?: string; previewUrl?: string; error?: string }> {
  try {
    console.log(`[EmailService] Preparing booking cancellation for ${bookingId}`);

    const booking = await getBookingById(bookingId);
    if (!booking) {
      return { success: false, error: 'Booking not found' };
    }

    const email = recipientEmail || booking.guestInfo.email;
    if (!email) {
      return { success: false, error: 'No recipient email' };
    }

    const property = await getPropertyBySlug(booking.propertyId);
    const propertyName = getPropertyName(property, booking.propertyId);

    // Use stored language preference, default to 'en'
    const language: LanguageCode = booking.language || 'en';

    const { text, html, subject } = createBookingCancellationTemplate({
      guestName: `${booking.guestInfo.firstName} ${booking.guestInfo.lastName || ''}`.trim(),
      bookingId: booking.id,
      propertyName,
      checkInDate: formatDate(booking.checkInDate),
      checkOutDate: formatDate(booking.checkOutDate),
      checkInTime: property?.checkInTime,
      checkOutTime: property?.checkOutTime,
      numberOfGuests: booking.numberOfGuests,
      numberOfNights: booking.pricing.numberOfNights,
      baseAmount: formatCurrency(booking.pricing.baseRate * booking.pricing.numberOfNights, booking.pricing.currency),
      cleaningFee: formatCurrency(booking.pricing.cleaningFee, booking.pricing.currency),
      extraGuestFee: booking.pricing.extraGuestFee ? formatCurrency(booking.pricing.extraGuestFee, booking.pricing.currency) : undefined,
      totalAmount: formatCurrency(booking.pricing.total, booking.pricing.currency),
      currency: booking.pricing.currency
    }, language);

    const emailSubject = `${subject} - ${propertyName}`;
    console.log(`[EmailService] Sending booking cancellation (${language}) to ${email}`);

    return sendEmail(email, emailSubject, text, html);
  } catch (error) {
    console.error('[EmailService] Error sending booking cancellation:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
