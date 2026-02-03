/**
 * @fileoverview Email templates for RentalSpot
 * @module services/emailTemplates
 * @description Single-language email templates that use the user's stored language preference
 */

import type { LanguageCode } from '@/types';

// Email translations for all templates
const emailTranslations = {
  en: {
    // Common
    dear: 'Dear',
    thankYou: 'Thank you!',
    theTeam: 'The RentalSpot Team',
    automatedMessage: 'This is an automated message. Please do not reply to this email.',
    thankYouForChoosing: 'Thank you for choosing RentalSpot!',

    // Booking confirmation
    bookingConfirmation: 'Booking Confirmation',
    bookingConfirmedMessage: 'Thank you for your booking! Your reservation is confirmed.',
    bookingDetails: 'Booking Details',
    bookingId: 'Booking ID',
    property: 'Property',
    checkIn: 'Check-in',
    checkOut: 'Check-out',
    guests: 'Guests',
    after: 'After',
    before: 'Before',
    paymentSummary: 'Payment Summary',
    nights: 'nights',
    cleaningFee: 'Cleaning fee',
    extraGuestFee: 'Extra guest fee',
    total: 'Total',
    propertyInformation: 'Property Information',
    address: 'Address',
    host: 'Host',
    hostPhone: 'Host Phone',
    cancellationPolicy: 'Cancellation Policy',
    specialRequests: 'Special Requests',

    // Hold confirmation
    holdConfirmation: 'Hold Confirmation',
    holdCreatedMessage: 'Your temporary hold has been created! Please complete your booking before it expires.',
    holdDetails: 'Hold Details',
    holdId: 'Hold ID',
    expires: 'Expires',
    estimatedTotal: 'Estimated Total',
    holdExpirationWarning: 'IMPORTANT: This hold will expire at {time}. Please complete your booking before then.',
    completeBooking: 'Complete Booking',

    // Inquiry confirmation
    inquiryConfirmation: 'Inquiry Confirmation',
    inquiryReceivedMessage: 'Thank you for your inquiry! We have received your message and will respond as soon as possible.',
    inquiryDetails: 'Inquiry Details',
    inquiryId: 'Inquiry ID',
    yourMessage: 'Your Message',
    whatsNext: "What's Next",
    whatsNextItems: [
      'We will review your inquiry',
      'You will receive a response within 24-48 hours',
      'Check your email for updates'
    ],

    // Inquiry response
    inquiryResponse: 'Response to Your Inquiry',
    inquiryResponseMessage: '{hostName} has responded to your inquiry about {propertyName}.',
    originalInquiry: 'Original Inquiry',
    response: 'Response',
    responseWhatsNextItems: [
      "If you're satisfied with the response, you can proceed with booking",
      'If you have more questions, feel free to submit another inquiry',
      'Visit our website to check availability and make a reservation'
    ],
    bookNow: 'Book Now',

    // Cancellation
    bookingCancellation: 'Booking Cancellation',
    bookingCancelledMessage: 'Your booking has been cancelled as requested.',
    cancelledBookingDetails: 'Cancelled Booking Details',
    refundAmount: 'Refund Amount',
    refundProcessingTime: 'Your refund will be processed within 5-10 business days.',
  },
  ro: {
    // Common
    dear: 'Dragă',
    thankYou: 'Vă mulțumim!',
    theTeam: 'Echipa RentalSpot',
    automatedMessage: 'Acesta este un mesaj automat. Vă rugăm să nu răspundeți la acest email.',
    thankYouForChoosing: 'Vă mulțumim că ați ales RentalSpot!',

    // Booking confirmation
    bookingConfirmation: 'Confirmare Rezervare',
    bookingConfirmedMessage: 'Vă mulțumim pentru rezervare! Rezervarea dumneavoastră este confirmată.',
    bookingDetails: 'Detalii Rezervare',
    bookingId: 'ID Rezervare',
    property: 'Proprietate',
    checkIn: 'Check-in',
    checkOut: 'Check-out',
    guests: 'Oaspeți',
    after: 'După',
    before: 'Înainte de',
    paymentSummary: 'Sumar Plată',
    nights: 'nopți',
    cleaningFee: 'Taxă curățenie',
    extraGuestFee: 'Taxă oaspeți suplimentari',
    total: 'Total',
    propertyInformation: 'Informații Proprietate',
    address: 'Adresă',
    host: 'Gazdă',
    hostPhone: 'Telefon Gazdă',
    cancellationPolicy: 'Politica de Anulare',
    specialRequests: 'Cereri Speciale',

    // Hold confirmation
    holdConfirmation: 'Confirmare Blocare Temporară',
    holdCreatedMessage: 'Blocarea dvs. temporară a fost creată! Vă rugăm să finalizați rezervarea înainte de expirare.',
    holdDetails: 'Detalii Blocare Temporară',
    holdId: 'ID',
    expires: 'Expiră',
    estimatedTotal: 'Total Estimat',
    holdExpirationWarning: 'IMPORTANT: Această blocare temporară va expira la {time}. Vă rugăm să finalizați rezervarea înainte de această oră.',
    completeBooking: 'Finalizează Rezervarea',

    // Inquiry confirmation
    inquiryConfirmation: 'Confirmare Solicitare',
    inquiryReceivedMessage: 'Vă mulțumim pentru solicitare! Am primit mesajul dvs. și vă vom răspunde cât mai curând posibil.',
    inquiryDetails: 'Detalii Solicitare',
    inquiryId: 'ID Solicitare',
    yourMessage: 'Mesajul Dvs.',
    whatsNext: 'Ce Urmează',
    whatsNextItems: [
      'Vom analiza solicitarea dvs.',
      'Veți primi un răspuns în 24-48 de ore',
      'Verificați email-ul pentru actualizări'
    ],

    // Inquiry response
    inquiryResponse: 'Răspuns la Solicitarea Dvs.',
    inquiryResponseMessage: '{hostName} a răspuns la solicitarea dvs. despre {propertyName}.',
    originalInquiry: 'Solicitare Originală',
    response: 'Răspuns',
    responseWhatsNextItems: [
      'Dacă sunteți mulțumit de răspuns, puteți continua cu rezervarea',
      'Dacă aveți mai multe întrebări, nu ezitați să trimiteți o altă solicitare',
      'Vizitați site-ul nostru pentru a verifica disponibilitatea și a face o rezervare'
    ],
    bookNow: 'Rezervă Acum',

    // Cancellation
    bookingCancellation: 'Anulare Rezervare',
    bookingCancelledMessage: 'Rezervarea dvs. a fost anulată conform solicitării.',
    cancelledBookingDetails: 'Detalii Rezervare Anulată',
    refundAmount: 'Sumă Rambursată',
    refundProcessingTime: 'Rambursarea va fi procesată în 5-10 zile lucrătoare.',
  }
} as const;

type TranslationKey = keyof typeof emailTranslations.en;

// Helper to get translation
function t(lang: LanguageCode, key: TranslationKey, replacements?: Record<string, string>): string {
  const translations = emailTranslations[lang] || emailTranslations.en;
  let text = translations[key] as string;

  if (replacements) {
    Object.entries(replacements).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, v);
    });
  }

  return text;
}

// Helper to get array translation
function tArray(lang: LanguageCode, key: TranslationKey): readonly string[] {
  const translations = emailTranslations[lang] || emailTranslations.en;
  return translations[key] as readonly string[];
}

interface BookingEmailData {
  guestName: string;
  bookingId: string;
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
  checkInTime?: string;
  checkOutTime?: string;
  numberOfGuests: number;
  numberOfNights: number;
  baseAmount: string;
  cleaningFee: string;
  extraGuestFee?: string;
  totalAmount: string;
  currency: string;
  cancellationPolicy?: string;
  propertyAddress?: string;
  hostName?: string;
  hostPhone?: string;
  specialRequests?: string;
}

interface HoldEmailData {
  guestName: string;
  holdId: string;
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  expirationTime: string;
  estimatedTotal: string;
  currency: string;
  completeBookingUrl?: string;
}

interface InquiryEmailData {
  guestName: string;
  inquiryId: string;
  propertyName: string;
  message: string;
  responseMessage?: string;
  hostName?: string;
}

/**
 * Creates email header with consistent styling
 */
function createHeader(title: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 0; }
    .header { background-color: #4f46e5; color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .info-box { background-color: #f9fafb; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #4f46e5; }
    .footer { text-align: center; padding: 30px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 8px 0; }
    .right { text-align: right; }
    .total-row { font-weight: bold; font-size: 18px; border-top: 2px solid #e5e7eb; padding-top: 10px; }
    h1 { margin: 0; font-size: 24px; }
    h2 { color: #4f46e5; margin-top: 0; margin-bottom: 15px; font-size: 18px; }
    .highlight { background-color: #fef3c7; padding: 15px; border-radius: 5px; margin: 15px 0; }
    .button { background-color: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 15px; }
    p { margin: 0 0 10px 0; }
    ul { margin: 10px 0; padding-left: 20px; }
    li { margin-bottom: 5px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
  </div>
`;
}

/**
 * Creates email footer
 */
function createFooter(lang: LanguageCode): string {
  return `
  <div class="footer">
    <p>${t(lang, 'thankYouForChoosing')}</p>
    <p style="margin-top: 10px; font-size: 11px; color: #9ca3af;">
      ${t(lang, 'automatedMessage')}
    </p>
  </div>
</body>
</html>
`;
}

/**
 * Creates booking confirmation email template
 */
export function createBookingConfirmationTemplate(
  data: BookingEmailData,
  language: LanguageCode = 'en'
): { text: string; html: string; subject: string } {
  const lang = language;

  const subject = t(lang, 'bookingConfirmation');

  const text = `
${t(lang, 'bookingConfirmation')}

${t(lang, 'dear')} ${data.guestName},

${t(lang, 'bookingConfirmedMessage')}

${t(lang, 'bookingDetails')}:
- ${t(lang, 'bookingId')}: ${data.bookingId}
- ${t(lang, 'property')}: ${data.propertyName}
- ${t(lang, 'checkIn')}: ${data.checkInDate}${data.checkInTime ? ` (${t(lang, 'after')} ${data.checkInTime})` : ''}
- ${t(lang, 'checkOut')}: ${data.checkOutDate}${data.checkOutTime ? ` (${t(lang, 'before')} ${data.checkOutTime})` : ''}
- ${t(lang, 'guests')}: ${data.numberOfGuests}

${t(lang, 'paymentSummary')}:
- ${data.numberOfNights} ${t(lang, 'nights')}: ${data.baseAmount}
- ${t(lang, 'cleaningFee')}: ${data.cleaningFee}
${data.extraGuestFee ? `- ${t(lang, 'extraGuestFee')}: ${data.extraGuestFee}` : ''}
- ${t(lang, 'total')}: ${data.totalAmount} ${data.currency}

${data.propertyAddress ? `${t(lang, 'address')}:\n${data.propertyAddress}\n` : ''}
${data.hostName ? `${t(lang, 'host')}: ${data.hostName}` : ''}
${data.hostPhone ? `${t(lang, 'hostPhone')}: ${data.hostPhone}` : ''}

${data.cancellationPolicy ? `${t(lang, 'cancellationPolicy')}:\n${data.cancellationPolicy}\n` : ''}

${t(lang, 'thankYou')}
${t(lang, 'theTeam')}
`;

  const html = `
${createHeader(t(lang, 'bookingConfirmation'))}
  <div class="content">
    <p>${t(lang, 'dear')} ${data.guestName},</p>
    <p>${t(lang, 'bookingConfirmedMessage')}</p>

    <div class="info-box">
      <h2>${t(lang, 'bookingDetails')}</h2>
      <p><strong>${t(lang, 'bookingId')}:</strong> ${data.bookingId}</p>
      <p><strong>${t(lang, 'property')}:</strong> ${data.propertyName}</p>
      <p><strong>${t(lang, 'checkIn')}:</strong> ${data.checkInDate}${data.checkInTime ? ` (${t(lang, 'after')} ${data.checkInTime})` : ''}</p>
      <p><strong>${t(lang, 'checkOut')}:</strong> ${data.checkOutDate}${data.checkOutTime ? ` (${t(lang, 'before')} ${data.checkOutTime})` : ''}</p>
      <p><strong>${t(lang, 'guests')}:</strong> ${data.numberOfGuests}</p>
    </div>

    <div class="info-box">
      <h2>${t(lang, 'paymentSummary')}</h2>
      <table>
        <tr>
          <td>${data.numberOfNights} ${t(lang, 'nights')}</td>
          <td class="right">${data.baseAmount}</td>
        </tr>
        <tr>
          <td>${t(lang, 'cleaningFee')}</td>
          <td class="right">${data.cleaningFee}</td>
        </tr>
        ${data.extraGuestFee ? `
        <tr>
          <td>${t(lang, 'extraGuestFee')}</td>
          <td class="right">${data.extraGuestFee}</td>
        </tr>
        ` : ''}
        <tr class="total-row">
          <td>${t(lang, 'total')}</td>
          <td class="right">${data.totalAmount} ${data.currency}</td>
        </tr>
      </table>
    </div>

    ${data.propertyAddress || data.hostName ? `
    <div class="info-box">
      <h2>${t(lang, 'propertyInformation')}</h2>
      ${data.propertyAddress ? `<p><strong>${t(lang, 'address')}:</strong><br>${data.propertyAddress}</p>` : ''}
      ${data.hostName ? `<p><strong>${t(lang, 'host')}:</strong> ${data.hostName}</p>` : ''}
      ${data.hostPhone ? `<p><strong>${t(lang, 'hostPhone')}:</strong> ${data.hostPhone}</p>` : ''}
    </div>
    ` : ''}

    ${data.cancellationPolicy ? `
    <div class="info-box">
      <h2>${t(lang, 'cancellationPolicy')}</h2>
      <p>${data.cancellationPolicy}</p>
    </div>
    ` : ''}

    ${data.specialRequests ? `
    <div class="highlight">
      <p><strong>${t(lang, 'specialRequests')}:</strong><br>${data.specialRequests}</p>
    </div>
    ` : ''}
  </div>
${createFooter(lang)}
`;

  return { text, html, subject };
}

/**
 * Creates hold confirmation email template
 */
export function createHoldConfirmationTemplate(
  data: HoldEmailData,
  language: LanguageCode = 'en'
): { text: string; html: string; subject: string } {
  const lang = language;

  const subject = t(lang, 'holdConfirmation');

  const text = `
${t(lang, 'holdConfirmation')}

${t(lang, 'dear')} ${data.guestName},

${t(lang, 'holdCreatedMessage')}

${t(lang, 'holdDetails')}:
- ${t(lang, 'holdId')}: ${data.holdId}
- ${t(lang, 'property')}: ${data.propertyName}
- ${t(lang, 'checkIn')}: ${data.checkInDate}
- ${t(lang, 'checkOut')}: ${data.checkOutDate}
- ${t(lang, 'guests')}: ${data.numberOfGuests}
- ${t(lang, 'expires')}: ${data.expirationTime}
- ${t(lang, 'estimatedTotal')}: ${data.estimatedTotal} ${data.currency}

${t(lang, 'holdExpirationWarning', { time: data.expirationTime })}

${t(lang, 'thankYou')}
${t(lang, 'theTeam')}
`;

  const html = `
${createHeader(t(lang, 'holdConfirmation'))}
  <div class="content">
    <p>${t(lang, 'dear')} ${data.guestName},</p>
    <p>${t(lang, 'holdCreatedMessage')}</p>

    <div class="info-box">
      <h2>${t(lang, 'holdDetails')}</h2>
      <p><strong>${t(lang, 'holdId')}:</strong> ${data.holdId}</p>
      <p><strong>${t(lang, 'property')}:</strong> ${data.propertyName}</p>
      <p><strong>${t(lang, 'checkIn')}:</strong> ${data.checkInDate}</p>
      <p><strong>${t(lang, 'checkOut')}:</strong> ${data.checkOutDate}</p>
      <p><strong>${t(lang, 'guests')}:</strong> ${data.numberOfGuests}</p>
      <p><strong>${t(lang, 'estimatedTotal')}:</strong> ${data.estimatedTotal} ${data.currency}</p>
    </div>

    <div class="highlight">
      <p><strong>${t(lang, 'holdExpirationWarning', { time: data.expirationTime })}</strong></p>
    </div>

    ${data.completeBookingUrl ? `
    <div style="text-align: center; margin-top: 30px;">
      <a href="${data.completeBookingUrl}" class="button">${t(lang, 'completeBooking')}</a>
    </div>
    ` : ''}
  </div>
${createFooter(lang)}
`;

  return { text, html, subject };
}

/**
 * Creates inquiry confirmation email template
 */
export function createInquiryConfirmationTemplate(
  data: InquiryEmailData,
  language: LanguageCode = 'en'
): { text: string; html: string; subject: string } {
  const lang = language;

  const subject = t(lang, 'inquiryConfirmation');
  const whatsNextItems = tArray(lang, 'whatsNextItems');

  const text = `
${t(lang, 'inquiryConfirmation')}

${t(lang, 'dear')} ${data.guestName},

${t(lang, 'inquiryReceivedMessage')}

${t(lang, 'inquiryDetails')}:
- ${t(lang, 'inquiryId')}: ${data.inquiryId}
- ${t(lang, 'property')}: ${data.propertyName}

${t(lang, 'yourMessage')}:
${data.message}

${t(lang, 'whatsNext')}:
${whatsNextItems.map(item => `- ${item}`).join('\n')}

${t(lang, 'thankYou')}
${t(lang, 'theTeam')}
`;

  const html = `
${createHeader(t(lang, 'inquiryConfirmation'))}
  <div class="content">
    <p>${t(lang, 'dear')} ${data.guestName},</p>
    <p>${t(lang, 'inquiryReceivedMessage')}</p>

    <div class="info-box">
      <h2>${t(lang, 'inquiryDetails')}</h2>
      <p><strong>${t(lang, 'inquiryId')}:</strong> ${data.inquiryId}</p>
      <p><strong>${t(lang, 'property')}:</strong> ${data.propertyName}</p>
    </div>

    <div class="info-box">
      <h2>${t(lang, 'yourMessage')}</h2>
      <p style="font-style: italic; color: #6b7280;">${data.message}</p>
    </div>

    <div class="info-box">
      <h2>${t(lang, 'whatsNext')}</h2>
      <ul>
        ${whatsNextItems.map(item => `<li>${item}</li>`).join('\n')}
      </ul>
    </div>
  </div>
${createFooter(lang)}
`;

  return { text, html, subject };
}

/**
 * Creates inquiry response email template
 */
export function createInquiryResponseTemplate(
  data: InquiryEmailData,
  language: LanguageCode = 'en'
): { text: string; html: string; subject: string } {
  const lang = language;
  const hostName = data.hostName || (lang === 'ro' ? 'Gazda' : 'The host');

  const subject = t(lang, 'inquiryResponse');
  const whatsNextItems = tArray(lang, 'responseWhatsNextItems');

  const text = `
${t(lang, 'inquiryResponse')}

${t(lang, 'dear')} ${data.guestName},

${t(lang, 'inquiryResponseMessage', { hostName, propertyName: data.propertyName })}

${t(lang, 'originalInquiry')}:
${data.message}

${t(lang, 'response')}:
${data.responseMessage}

${t(lang, 'whatsNext')}:
${whatsNextItems.map(item => `- ${item}`).join('\n')}

${t(lang, 'thankYou')}
${t(lang, 'theTeam')}
`;

  const html = `
${createHeader(t(lang, 'inquiryResponse'))}
  <div class="content">
    <p>${t(lang, 'dear')} ${data.guestName},</p>
    <p>${t(lang, 'inquiryResponseMessage', { hostName, propertyName: data.propertyName })}</p>

    <div class="info-box">
      <h2>${t(lang, 'originalInquiry')}</h2>
      <p style="font-style: italic; color: #6b7280;">${data.message}</p>
    </div>

    <div class="info-box" style="background-color: #f0f9ff; border-left-color: #0ea5e9;">
      <h2>${t(lang, 'response')}</h2>
      <p>${data.responseMessage}</p>
    </div>

    <div class="info-box">
      <h2>${t(lang, 'whatsNext')}</h2>
      <ul>
        ${whatsNextItems.map(item => `<li>${item}</li>`).join('\n')}
      </ul>
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <a href="#" class="button">${t(lang, 'bookNow')}</a>
    </div>
  </div>
${createFooter(lang)}
`;

  return { text, html, subject };
}

/**
 * Creates booking cancellation email template
 */
export function createBookingCancellationTemplate(
  data: BookingEmailData,
  language: LanguageCode = 'en'
): { text: string; html: string; subject: string } {
  const lang = language;

  const subject = t(lang, 'bookingCancellation');

  const text = `
${t(lang, 'bookingCancellation')}

${t(lang, 'dear')} ${data.guestName},

${t(lang, 'bookingCancelledMessage')}

${t(lang, 'cancelledBookingDetails')}:
- ${t(lang, 'bookingId')}: ${data.bookingId}
- ${t(lang, 'property')}: ${data.propertyName}
- ${t(lang, 'checkIn')}: ${data.checkInDate}
- ${t(lang, 'checkOut')}: ${data.checkOutDate}
- ${t(lang, 'refundAmount')}: ${data.totalAmount} ${data.currency}

${t(lang, 'refundProcessingTime')}

${t(lang, 'thankYou')}
${t(lang, 'theTeam')}
`;

  const html = `
${createHeader(t(lang, 'bookingCancellation'))}
  <div class="content">
    <p>${t(lang, 'dear')} ${data.guestName},</p>
    <p>${t(lang, 'bookingCancelledMessage')}</p>

    <div class="info-box">
      <h2>${t(lang, 'cancelledBookingDetails')}</h2>
      <p><strong>${t(lang, 'bookingId')}:</strong> ${data.bookingId}</p>
      <p><strong>${t(lang, 'property')}:</strong> ${data.propertyName}</p>
      <p><strong>${t(lang, 'checkIn')}:</strong> ${data.checkInDate}</p>
      <p><strong>${t(lang, 'checkOut')}:</strong> ${data.checkOutDate}</p>
      <p><strong>${t(lang, 'refundAmount')}:</strong> ${data.totalAmount} ${data.currency}</p>
    </div>

    <div class="highlight">
      <p>${t(lang, 'refundProcessingTime')}</p>
    </div>
  </div>
${createFooter(lang)}
`;

  return { text, html, subject };
}
