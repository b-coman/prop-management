'use server';

import nodemailer from 'nodemailer';
import { format } from 'date-fns';
import type { Booking, Property, Inquiry } from '@/types';
import { getPropertyBySlug } from '@/lib/property-utils';

// Development transporter for testing - uses Ethereal
let devTransporter: nodemailer.Transporter | null = null;

// For production, you would use an actual SMTP service or API
// Examples:
// - AWS SES
// - SendGrid
// - Resend
// - Mailgun

// Initialize transporters
async function getTransporter() {
  // In development, use Ethereal for testing emails
  if (process.env.NODE_ENV !== 'production') {
    if (!devTransporter) {
      // Create a test account at Ethereal
      const testAccount = await nodemailer.createTestAccount();
      
      // Create a testing transporter
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
  
  // For production, use configured service
  // This should be set up based on environment variables
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('[EmailService] Missing email configuration');
    throw new Error('Email service is not properly configured');
  }
  
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

// Format dates for display
function formatDate(date: any): string {
  if (!date) return 'N/A';
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    return format(dateObj, 'PPP'); // e.g., "Apr 29, 2025"
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

/**
 * Sends a booking confirmation email to the guest
 * @param booking Booking details
 * @param property Optional property details (will be fetched if not provided)
 * @returns Email sending result with message ID and preview URL (for development)
 */
export async function sendBookingConfirmationEmail(
  bookingId: string,
  recipientEmail?: string
): Promise<{ success: boolean; messageId?: string; previewUrl?: string; error?: string }> {
  try {
    console.log(`[EmailService] Preparing to send booking confirmation for booking ${bookingId}`);
    
    // Fetch booking data
    const booking = await getBookingById(bookingId);
    if (!booking) {
      console.error(`[EmailService] Booking not found with ID: ${bookingId}`);
      return { success: false, error: 'Booking not found' };
    }
    
    // Use provided email or get from booking
    const email = recipientEmail || booking.guestInfo.email;
    if (!email) {
      console.error(`[EmailService] No recipient email for booking ${bookingId}`);
      return { success: false, error: 'No recipient email' };
    }
    
    // Fetch property data
    const property = await getPropertyBySlug(booking.propertyId);
    if (!property) {
      console.warn(`[EmailService] Property not found for booking ${bookingId}`);
    }
    
    // Create transporter
    const transporter = await getTransporter();
    
    // Format dates for display
    const checkInDate = formatDate(booking.checkInDate);
    const checkOutDate = formatDate(booking.checkOutDate);
    
    // Format message
    const message = {
      from: process.env.EMAIL_FROM || '"RentalSpot" <bookings@rentalspot.com>',
      to: email,
      subject: `Booking Confirmation - ${property?.name || booking.propertyId}`,
      text: `
Booking Confirmation

Dear ${booking.guestInfo.firstName} ${booking.guestInfo.lastName || ''},

Thank you for your booking! Your reservation is confirmed.

Booking Details:
------------------
Booking ID: ${booking.id}
Property: ${property?.name || booking.propertyId}
Check-in: ${checkInDate}${property?.checkInTime ? ` (After ${property.checkInTime})` : ''}
Check-out: ${checkOutDate}${property?.checkOutTime ? ` (Before ${property.checkOutTime})` : ''}
Guests: ${booking.numberOfGuests}

Payment Summary:
------------------
${booking.pricing.numberOfNights} nights: ${formatCurrency(booking.pricing.baseRate * booking.pricing.numberOfNights, booking.pricing.currency)}
Cleaning fee: ${formatCurrency(booking.pricing.cleaningFee, booking.pricing.currency)}
${booking.pricing.extraGuestFee ? `Extra guest fee: ${formatCurrency(booking.pricing.extraGuestFee, booking.pricing.currency)}\n` : ''}
${booking.pricing.taxes ? `Taxes: ${formatCurrency(booking.pricing.taxes, booking.pricing.currency)}\n` : ''}
${booking.pricing.discountAmount ? `Discount: -${formatCurrency(booking.pricing.discountAmount, booking.pricing.currency)}\n` : ''}
Total: ${formatCurrency(booking.pricing.total, booking.pricing.currency)}

If you have any questions or need assistance, please don't hesitate to contact us.

Thank you,
The RentalSpot Team
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .booking-details, .payment-details { background-color: #f9fafb; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
    .total { font-weight: bold; font-size: 18px; margin-top: 10px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    table { width: 100%; }
    td { padding: 5px 0; }
    .right { text-align: right; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Booking Confirmation</h1>
  </div>
  <div class="content">
    <p>Dear ${booking.guestInfo.firstName} ${booking.guestInfo.lastName || ''},</p>
    <p>Thank you for your booking! Your reservation is confirmed.</p>
    
    <div class="booking-details">
      <h2>Booking Details</h2>
      <p><strong>Booking ID:</strong> ${booking.id}</p>
      <p><strong>Property:</strong> ${property?.name || booking.propertyId}</p>
      <p><strong>Check-in:</strong> ${checkInDate}${property?.checkInTime ? ` (After ${property.checkInTime})` : ''}</p>
      <p><strong>Check-out:</strong> ${checkOutDate}${property?.checkOutTime ? ` (Before ${property.checkOutTime})` : ''}</p>
      <p><strong>Guests:</strong> ${booking.numberOfGuests}</p>
    </div>
    
    <div class="payment-details">
      <h2>Payment Summary</h2>
      <table>
        <tr>
          <td>${booking.pricing.numberOfNights} nights</td>
          <td class="right">${formatCurrency(booking.pricing.baseRate * booking.pricing.numberOfNights, booking.pricing.currency)}</td>
        </tr>
        <tr>
          <td>Cleaning fee</td>
          <td class="right">${formatCurrency(booking.pricing.cleaningFee, booking.pricing.currency)}</td>
        </tr>
        ${booking.pricing.extraGuestFee ? `
        <tr>
          <td>Extra guest fee</td>
          <td class="right">${formatCurrency(booking.pricing.extraGuestFee, booking.pricing.currency)}</td>
        </tr>` : ''}
        ${booking.pricing.taxes ? `
        <tr>
          <td>Taxes</td>
          <td class="right">${formatCurrency(booking.pricing.taxes, booking.pricing.currency)}</td>
        </tr>` : ''}
        ${booking.pricing.discountAmount ? `
        <tr>
          <td>Discount</td>
          <td class="right">-${formatCurrency(booking.pricing.discountAmount, booking.pricing.currency)}</td>
        </tr>` : ''}
        <tr class="total">
          <td>Total</td>
          <td class="right">${formatCurrency(booking.pricing.total, booking.pricing.currency)}</td>
        </tr>
      </table>
    </div>
    
    <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
    <p>Thank you,<br>The RentalSpot Team</p>
  </div>
  <div class="footer">
    <p>This email was sent by RentalSpot.</p>
    <p>&copy; ${new Date().getFullYear()} RentalSpot. All rights reserved.</p>
  </div>
</body>
</html>
      `,
    };
    
    // Send email
    console.log(`[EmailService] Sending booking confirmation to ${email}`);
    const info = await transporter.sendMail(message);
    
    // For development, log preview URL
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[EmailService] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      return { 
        success: true, 
        messageId: info.messageId, 
        previewUrl: nodemailer.getTestMessageUrl(info) as string 
      };
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EmailService] Error sending booking confirmation email:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
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
    console.log(`[EmailService] Preparing to send booking notification for booking ${bookingId}`);
    
    // Fetch booking data
    const booking = await getBookingById(bookingId);
    if (!booking) {
      console.error(`[EmailService] Booking not found with ID: ${bookingId}`);
      return { success: false, error: 'Booking not found' };
    }
    
    // Fetch property data
    const property = await getPropertyBySlug(booking.propertyId);
    if (!property) {
      console.warn(`[EmailService] Property not found for booking ${bookingId}`);
    }
    
    // Create transporter
    const transporter = await getTransporter();
    
    // Format dates for display
    const checkInDate = formatDate(booking.checkInDate);
    const checkOutDate = formatDate(booking.checkOutDate);
    
    // Format message
    const message = {
      from: process.env.EMAIL_FROM || '"RentalSpot" <bookings@rentalspot.com>',
      to: recipientEmail,
      subject: `New Booking - ${property?.name || booking.propertyId}`,
      text: `
New Booking Notification

A new booking has been made for your property.

Booking Details:
------------------
Booking ID: ${booking.id}
Property: ${property?.name || booking.propertyId}
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
${booking.pricing.extraGuestFee ? `Extra guest fee: ${formatCurrency(booking.pricing.extraGuestFee, booking.pricing.currency)}\n` : ''}
${booking.pricing.taxes ? `Taxes: ${formatCurrency(booking.pricing.taxes, booking.pricing.currency)}\n` : ''}
${booking.pricing.discountAmount ? `Discount: -${formatCurrency(booking.pricing.discountAmount, booking.pricing.currency)}\n` : ''}
Total: ${formatCurrency(booking.pricing.total, booking.pricing.currency)}

You can view the full booking details in your admin dashboard.

Thank you,
The RentalSpot Team
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .booking-details, .guest-details, .payment-details { background-color: #f9fafb; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
    .total { font-weight: bold; font-size: 18px; margin-top: 10px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    table { width: 100%; }
    td { padding: 5px 0; }
    .right { text-align: right; }
    .button { display: inline-block; background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>New Booking Notification</h1>
  </div>
  <div class="content">
    <p>A new booking has been made for your property.</p>
    
    <div class="booking-details">
      <h2>Booking Details</h2>
      <p><strong>Booking ID:</strong> ${booking.id}</p>
      <p><strong>Property:</strong> ${property?.name || booking.propertyId}</p>
      <p><strong>Check-in:</strong> ${checkInDate}</p>
      <p><strong>Check-out:</strong> ${checkOutDate}</p>
      <p><strong>Guests:</strong> ${booking.numberOfGuests}</p>
    </div>
    
    <div class="guest-details">
      <h2>Guest Information</h2>
      <p><strong>Name:</strong> ${booking.guestInfo.firstName} ${booking.guestInfo.lastName || ''}</p>
      <p><strong>Email:</strong> ${booking.guestInfo.email}</p>
      <p><strong>Phone:</strong> ${booking.guestInfo.phone || 'Not provided'}</p>
    </div>
    
    <div class="payment-details">
      <h2>Payment Summary</h2>
      <table>
        <tr>
          <td>${booking.pricing.numberOfNights} nights</td>
          <td class="right">${formatCurrency(booking.pricing.baseRate * booking.pricing.numberOfNights, booking.pricing.currency)}</td>
        </tr>
        <tr>
          <td>Cleaning fee</td>
          <td class="right">${formatCurrency(booking.pricing.cleaningFee, booking.pricing.currency)}</td>
        </tr>
        ${booking.pricing.extraGuestFee ? `
        <tr>
          <td>Extra guest fee</td>
          <td class="right">${formatCurrency(booking.pricing.extraGuestFee, booking.pricing.currency)}</td>
        </tr>` : ''}
        ${booking.pricing.taxes ? `
        <tr>
          <td>Taxes</td>
          <td class="right">${formatCurrency(booking.pricing.taxes, booking.pricing.currency)}</td>
        </tr>` : ''}
        ${booking.pricing.discountAmount ? `
        <tr>
          <td>Discount</td>
          <td class="right">-${formatCurrency(booking.pricing.discountAmount, booking.pricing.currency)}</td>
        </tr>` : ''}
        <tr class="total">
          <td>Total</td>
          <td class="right">${formatCurrency(booking.pricing.total, booking.pricing.currency)}</td>
        </tr>
      </table>
    </div>
    
    <p>You can view the full booking details in your admin dashboard.</p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://rentalspot.com'}/admin/bookings/${booking.id}" class="button">View Booking Details</a>
    
    <p>Thank you,<br>The RentalSpot Team</p>
  </div>
  <div class="footer">
    <p>This email was sent by RentalSpot.</p>
    <p>&copy; ${new Date().getFullYear()} RentalSpot. All rights reserved.</p>
  </div>
</body>
</html>
      `,
    };
    
    // Send email
    console.log(`[EmailService] Sending booking notification to ${recipientEmail}`);
    const info = await transporter.sendMail(message);
    
    // For development, log preview URL
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[EmailService] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      return { 
        success: true, 
        messageId: info.messageId, 
        previewUrl: nodemailer.getTestMessageUrl(info) as string 
      };
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EmailService] Error sending booking notification email:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
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
    console.log(`[EmailService] Preparing to send inquiry confirmation to ${recipientEmail}`);
    
    // Fetch property data
    const property = await getPropertyBySlug(inquiry.propertySlug);
    if (!property) {
      console.warn(`[EmailService] Property not found for inquiry ${inquiry.id}`);
    }
    
    // Create transporter
    const transporter = await getTransporter();
    
    // Format dates for display
    const checkInDate = formatDate(inquiry.checkIn);
    const checkOutDate = formatDate(inquiry.checkOut);
    
    // Format message
    const message = {
      from: process.env.EMAIL_FROM || '"RentalSpot" <inquiries@rentalspot.com>',
      to: recipientEmail,
      subject: `Inquiry Received - ${property?.name || inquiry.propertySlug}`,
      text: `
Inquiry Confirmation

Dear ${inquiry.guestInfo.firstName} ${inquiry.guestInfo.lastName || ''},

Thank you for your inquiry about ${property?.name || inquiry.propertySlug}!

Inquiry Details:
------------------
Inquiry ID: ${inquiry.id}
Property: ${property?.name || inquiry.propertySlug}
Check-in: ${checkInDate}
Check-out: ${checkOutDate}
Guests: ${inquiry.guestCount}

Your Message:
------------------
${inquiry.message}

We will review your inquiry and get back to you as soon as possible.

Thank you,
The RentalSpot Team
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .inquiry-details, .message-details { background-color: #f9fafb; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Inquiry Received</h1>
  </div>
  <div class="content">
    <p>Dear ${inquiry.guestInfo.firstName} ${inquiry.guestInfo.lastName || ''},</p>
    <p>Thank you for your inquiry about ${property?.name || inquiry.propertySlug}!</p>
    
    <div class="inquiry-details">
      <h2>Inquiry Details</h2>
      <p><strong>Inquiry ID:</strong> ${inquiry.id}</p>
      <p><strong>Property:</strong> ${property?.name || inquiry.propertySlug}</p>
      <p><strong>Check-in:</strong> ${checkInDate}</p>
      <p><strong>Check-out:</strong> ${checkOutDate}</p>
      <p><strong>Guests:</strong> ${inquiry.guestCount}</p>
    </div>
    
    <div class="message-details">
      <h2>Your Message</h2>
      <p>${inquiry.message}</p>
    </div>
    
    <p>We will review your inquiry and get back to you as soon as possible.</p>
    <p>Thank you,<br>The RentalSpot Team</p>
  </div>
  <div class="footer">
    <p>This email was sent by RentalSpot.</p>
    <p>&copy; ${new Date().getFullYear()} RentalSpot. All rights reserved.</p>
  </div>
</body>
</html>
      `,
    };
    
    // Send email
    console.log(`[EmailService] Sending inquiry confirmation to ${recipientEmail}`);
    const info = await transporter.sendMail(message);
    
    // For development, log preview URL
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[EmailService] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      return { 
        success: true, 
        messageId: info.messageId, 
        previewUrl: nodemailer.getTestMessageUrl(info) as string 
      };
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EmailService] Error sending inquiry confirmation email:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
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
    console.log(`[EmailService] Preparing to send inquiry notification to ${recipientEmail}`);
    
    // Fetch property data
    const property = await getPropertyBySlug(inquiry.propertySlug);
    if (!property) {
      console.warn(`[EmailService] Property not found for inquiry ${inquiry.id}`);
    }
    
    // Create transporter
    const transporter = await getTransporter();
    
    // Format dates for display
    const checkInDate = formatDate(inquiry.checkIn);
    const checkOutDate = formatDate(inquiry.checkOut);
    
    // Format message
    const message = {
      from: process.env.EMAIL_FROM || '"RentalSpot" <inquiries@rentalspot.com>',
      to: recipientEmail,
      subject: `New Inquiry - ${property?.name || inquiry.propertySlug}`,
      text: `
New Inquiry Notification

You have received a new inquiry for your property.

Inquiry Details:
------------------
Inquiry ID: ${inquiry.id}
Property: ${property?.name || inquiry.propertySlug}
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
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .inquiry-details, .guest-details, .message-details { background-color: #f9fafb; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    .button { display: inline-block; background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>New Inquiry Notification</h1>
  </div>
  <div class="content">
    <p>You have received a new inquiry for your property.</p>
    
    <div class="inquiry-details">
      <h2>Inquiry Details</h2>
      <p><strong>Inquiry ID:</strong> ${inquiry.id}</p>
      <p><strong>Property:</strong> ${property?.name || inquiry.propertySlug}</p>
      <p><strong>Check-in:</strong> ${checkInDate}</p>
      <p><strong>Check-out:</strong> ${checkOutDate}</p>
      <p><strong>Guests:</strong> ${inquiry.guestCount}</p>
    </div>
    
    <div class="guest-details">
      <h2>Guest Information</h2>
      <p><strong>Name:</strong> ${inquiry.guestInfo.firstName} ${inquiry.guestInfo.lastName || ''}</p>
      <p><strong>Email:</strong> ${inquiry.guestInfo.email}</p>
      <p><strong>Phone:</strong> ${inquiry.guestInfo.phone || 'Not provided'}</p>
    </div>
    
    <div class="message-details">
      <h2>Guest Message</h2>
      <p>${inquiry.message}</p>
    </div>
    
    <p>You can respond to this inquiry through your admin dashboard.</p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://rentalspot.com'}/admin/inquiries/${inquiry.id}" class="button">Respond to Inquiry</a>
    
    <p>Thank you,<br>The RentalSpot Team</p>
  </div>
  <div class="footer">
    <p>This email was sent by RentalSpot.</p>
    <p>&copy; ${new Date().getFullYear()} RentalSpot. All rights reserved.</p>
  </div>
</body>
</html>
      `,
    };
    
    // Send email
    console.log(`[EmailService] Sending inquiry notification to ${recipientEmail}`);
    const info = await transporter.sendMail(message);
    
    // For development, log preview URL
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[EmailService] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      return { 
        success: true, 
        messageId: info.messageId, 
        previewUrl: nodemailer.getTestMessageUrl(info) as string 
      };
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EmailService] Error sending inquiry notification email:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Sends a hold confirmation email to the guest
 * @param bookingId The ID of the hold booking to send confirmation for
 * @param recipientEmail Optional: Override recipient email (defaults to guest email)
 * @returns Success status with additional details
 */
export async function sendHoldConfirmationEmail(
  bookingId: string,
  recipientEmail?: string
): Promise<{ success: boolean; messageId?: string; previewUrl?: string; error?: string }> {
  try {
    console.log(`[EmailService] Preparing to send hold confirmation for booking ${bookingId}`);

    // Fetch booking data
    const booking = await getBookingById(bookingId);
    if (!booking) {
      console.error(`[EmailService] Hold booking not found with ID: ${bookingId}`);
      return { success: false, error: 'Hold booking not found' };
    }

    // Use provided email or get from booking
    const email = recipientEmail || booking.guestInfo.email;
    if (!email) {
      console.error(`[EmailService] No recipient email for hold booking ${bookingId}`);
      return { success: false, error: 'No recipient email' };
    }

    // Fetch property data
    const property = await getPropertyBySlug(booking.propertyId);
    if (!property) {
      console.warn(`[EmailService] Property not found for hold booking ${bookingId}`);
    }

    // Create transporter
    const transporter = await getTransporter();

    // Format dates for display
    const checkInDate = formatDate(booking.checkInDate);
    const checkOutDate = formatDate(booking.checkOutDate);

    // Format hold expiration date
    const holdUntil = booking.holdUntil ? formatDate(booking.holdUntil) : 'N/A';

    // Format message
    const message = {
      from: process.env.EMAIL_FROM || '"RentalSpot" <bookings@rentalspot.com>',
      to: email,
      subject: `Dates On Hold - ${property?.name || booking.propertyId}`,
      text: `
Dates On Hold Confirmation

Dear ${booking.guestInfo.firstName} ${booking.guestInfo.lastName || ''},

Thank you for placing a hold on your selected dates! Your hold is confirmed.

Hold Details:
------------------
Hold ID: ${booking.id}
Property: ${property?.name || booking.propertyId}
Check-in: ${checkInDate}
Check-out: ${checkOutDate}
Hold Expires: ${holdUntil}
Guests: ${booking.numberOfGuests}

Payment Summary:
------------------
Hold fee: ${formatCurrency(booking.holdFee || 0, booking.pricing?.currency || 'EUR')}
${booking.holdFeeRefundable ? 'This hold fee is refundable when you complete your booking.' : 'This hold fee is non-refundable.'}

Your dates will be held until ${holdUntil}. To complete your booking, please visit the property page before this time.

If you have any questions or need assistance, please don't hesitate to contact us.

Thank you,
The RentalSpot Team
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .hold-details, .payment-details { background-color: #f9fafb; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
    .expiry { background-color: #fef3c7; padding: 15px; margin-bottom: 20px; border-radius: 5px; color: #92400e; }
    .total { font-weight: bold; font-size: 18px; margin-top: 10px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    table { width: 100%; }
    td { padding: 5px 0; }
    .right { text-align: right; }
    .button { display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Dates On Hold</h1>
  </div>
  <div class="content">
    <p>Dear ${booking.guestInfo.firstName} ${booking.guestInfo.lastName || ''},</p>
    <p>Thank you for placing a hold on your selected dates! Your hold is confirmed.</p>

    <div class="hold-details">
      <h2>Hold Details</h2>
      <p><strong>Hold ID:</strong> ${booking.id}</p>
      <p><strong>Property:</strong> ${property?.name || booking.propertyId}</p>
      <p><strong>Check-in:</strong> ${checkInDate}</p>
      <p><strong>Check-out:</strong> ${checkOutDate}</p>
      <p><strong>Guests:</strong> ${booking.numberOfGuests}</p>
    </div>

    <div class="expiry">
      <h2>Hold Expiration</h2>
      <p><strong>Your hold expires:</strong> ${holdUntil}</p>
      <p>To complete your booking, please visit the property page before this time.</p>
    </div>

    <div class="payment-details">
      <h2>Payment Summary</h2>
      <table>
        <tr>
          <td>Hold fee</td>
          <td class="right">${formatCurrency(booking.holdFee || 0, booking.pricing?.currency || 'EUR')}</td>
        </tr>
        <tr class="total">
          <td>Total Paid</td>
          <td class="right">${formatCurrency(booking.holdFee || 0, booking.pricing?.currency || 'EUR')}</td>
        </tr>
      </table>
      <p class="mt-2 text-sm ${booking.holdFeeRefundable ? 'text-green-600' : 'text-gray-500'}">
        ${booking.holdFeeRefundable ? 'This hold fee is refundable when you complete your booking.' : 'This hold fee is non-refundable.'}
      </p>
    </div>

    <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://rentalspot.com'}/properties/${booking.propertyId}" class="button">Complete Your Booking</a>

    <p>Thank you,<br>The RentalSpot Team</p>
  </div>
  <div class="footer">
    <p>This email was sent by RentalSpot.</p>
    <p>&copy; ${new Date().getFullYear()} RentalSpot. All rights reserved.</p>
  </div>
</body>
</html>
      `,
    };

    // Send email
    console.log(`[EmailService] Sending hold confirmation to ${email}`);
    const info = await transporter.sendMail(message);

    // For development, log preview URL
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[EmailService] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      return {
        success: true,
        messageId: info.messageId,
        previewUrl: nodemailer.getTestMessageUrl(info) as string
      };
    }

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EmailService] Error sending hold confirmation email:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

// Helper to get booking by ID for email use
// This should be imported from bookingService, but including here to avoid circular dependencies
async function getBookingById(bookingId: string): Promise<Booking | null> {
  try {
    // Import dynamically to avoid circular dependencies
    const { getBookingById: fetchBooking } = await import('./bookingService');
    return await fetchBooking(bookingId);
  } catch (error) {
    console.error(`[EmailService] Error dynamically importing getBookingById: ${error}`);
    return null;
  }
}