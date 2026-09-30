/**
 * @fileoverview Email templates for RentalSpot
 * @module services/emailTemplates
 * @description Single-language email templates that use the user's stored language preference
 */

import type { LanguageCode } from '@/types';
import { getEmailPalette, type EmailPalette } from '@/lib/email-theme';
import { formatGuestCount, asLanguage } from '@/lib/occupancy';

// Email translations for all templates
const emailTranslations = {
  en: {
    // Common
    dear: 'Dear',
    thankYou: 'Thank you!',
    theTeam: 'The {propertyName} Team',
    automatedMessage: 'This is an automated message. Please do not reply to this email.',
    thankYouForChoosing: 'Thank you for choosing {propertyName}!',

    // Booking confirmation
    bookingConfirmation: 'Booking Confirmation',
    bookingConfirmedMessage: 'Thank you for your booking! Your reservation is confirmed.',
    bookingDetails: 'Booking Details',
    bookingId: 'Booking reference',
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
    paidInFull: 'Paid in full',
    replyPrompt: 'This confirmation was sent automatically, but you can reply to it - your message reaches us.',
    paidOn: 'Paid on {date}',
    amountPaid: 'Amount paid',
    specialRequests: 'Special Requests',

    // Guest guide + pre-arrival. Romanian wording deliberately mirrors the guide page itself
    // ("Cum ajungeți", "Căutați numărul acesta pe poartă") so a guest who reads both does not
    // meet two different phrasings for the same thing.
    guideHeading: 'Your guest guide',
    guidePrompt: 'Directions, the gate number, the Wi-Fi and who to call are all in your guide. Keep this link - it works until after you leave.',
    guideCta: 'Open your guide',
    preArrival: 'We are looking forward to it',
    // Used only when check-in really IS the next day, so the word stays true whenever it is sent.
    preArrivalTomorrow: 'We look forward to seeing you tomorrow',
    preArrivalMessage: '{date} is your check-in date at our house in Comarnic. Everything you need is below.',
    preArrivalDirections: 'Getting here',
    preArrivalWaze: 'Waze',
    preArrivalMaps: 'Google Maps',
    preArrivalGate: 'the number you will see on the gate',
    // Composed from the host contact rather than taken from the guide's own call note: the guide
    // lists the caretakers by name because its contacts card introduces them, but an arriving
    // guest reading an email has never heard of them.
    preArrivalCall: 'Call {name} on {phone} about 10-15 minutes before you arrive.',
    preArrivalWhatTime: 'What time will you arrive?',
    preArrivalWhatTimeBody: 'Reply to this email and let us know - it helps us have everything ready for you.',

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

    // Review request
    reviewRequest: 'How Was Your Stay?',
    reviewRequestMessage: 'We hope you enjoyed your stay at {propertyName}! We would love to hear about your experience.',
    reviewStayDetails: 'Your Stay',
    leaveReview: 'Leave a Review',
    reviewRequestThanks: 'Your feedback helps future guests and helps us improve.',
    reviewRequestPrompt: 'It only takes a minute to share your thoughts.',

    // Checkout confirmation (Day 0)
    checkoutConfirmation: 'Thank You for Your Stay!',
    checkoutConfirmationMessage: 'We hope you had a wonderful time at {propertyName}. Have a safe journey home!',
    checkoutSafeTravel: 'We wish you safe travels and hope to welcome you back soon.',

    // Return incentive (Day 14)
    returnIncentive: 'A Special Offer Just for You',
    returnIncentiveMessage: 'We loved hosting you at {propertyName} and would like to offer you a special discount on your next stay.',
    returnIncentiveCoupon: 'Your Coupon Code',
    returnIncentiveDiscount: '{discount}% off your next booking',
    returnIncentiveExpiry: 'Valid until {expiryDate}',
    returnIncentiveBook: 'Book Again',

    // Seasonal reminder (Day 90)
    seasonalReminder: 'We Miss You at {propertyName}!',
    seasonalReminderMessage: "It's been a while since your stay at {propertyName}. We'd love to welcome you back for another memorable experience.",
    seasonalReminderBook: 'Check Availability',

    // Unsubscribe
    unsubscribeText: 'If you no longer wish to receive these emails, you can',
    unsubscribeLink: 'unsubscribe here',
  },
  ro: {
    // Common
    dear: 'Dragă',
    thankYou: 'Mulțumim!',
    theTeam: 'Echipa {propertyName}',
    automatedMessage: 'Acesta este un mesaj automat. Vă rugăm să nu răspundeți la acest email.',
    thankYouForChoosing: 'Mulțumim că ai ales {propertyName}!',

    // Booking confirmation
    bookingConfirmation: 'Confirmare Rezervare',
    bookingConfirmedMessage: 'Îți mulțumim, rezervarea ta este confirmată.',
    bookingDetails: 'Detalii Rezervare',
    bookingId: 'Referință rezervare',
    property: 'Proprietate',
    checkIn: 'Check-in',
    checkOut: 'Check-out',
    guests: 'Oaspeți',
    after: 'după',
    before: 'înainte de',
    paymentSummary: 'Sumar Plată',
    nights: 'nopți',
    cleaningFee: 'Taxă curățenie',
    extraGuestFee: 'Taxă oaspeți suplimentari',
    total: 'Total',
    propertyInformation: 'Informații Proprietate',
    address: 'Adresă',
    host: 'Gazdă',
    hostPhone: 'Telefon gazdă',
    cancellationPolicy: 'Politica de Anulare',
    paidInFull: 'Achitat integral',
    replyPrompt: 'Acest mesaj a fost trimis automat, dar poți răspunde - mesajul ajunge la noi.',
    paidOn: 'Achitat pe {date}',
    amountPaid: 'Sumă achitată',
    specialRequests: 'Cereri Speciale',

    // Ghid + înainte de sosire. Formularea urmează intenționat pagina de ghid, ca un oaspete
    // care le citește pe amândouă să nu întâlnească două exprimări diferite pentru același lucru.
    guideHeading: 'Ghidul tău',
    guidePrompt: 'Cum ajungi, detalii despre proprietate, WiFi - toate le găsești aici în ghid.',
    guideCta: 'Deschide ghidul',
    preArrival: 'Vă așteptăm cu drag',
    // Folosit doar când check-in-ul chiar e a doua zi, ca „mâine" să rămână adevărat.
    preArrivalTomorrow: 'Vă așteptăm cu drag mâine',
    preArrivalMessage: '{date} este data check-in-ului tău la căsuța noastră din Comarnic. Ai mai jos toate detaliile necesare.',
    preArrivalDirections: 'Cum ajungi',
    preArrivalWaze: 'Waze',
    preArrivalMaps: 'Google Maps',
    preArrivalGate: 'numărul pe care îl vezi pe poartă',
    preArrivalCall: 'Sună-l pe {name} la {phone} cu 10-15 minute înainte să ajungi.',
    preArrivalWhatTime: 'La ce oră ajungi?',
    preArrivalWhatTimeBody: 'Răspunde la acest e-mail și spune-ne - ne ajută să avem totul pregătit.',

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
    inquiryReceivedMessage: 'Mulțumim pentru solicitare! Am primit mesajul tău și îți răspundem cât mai curând.',
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

    // Review request
    reviewRequest: 'Cum a Fost Sejurul Dvs.?',
    reviewRequestMessage: 'Sperăm că v-a plăcut sejurul la {propertyName}! Ne-ar plăcea să aflăm despre experiența dvs.',
    reviewStayDetails: 'Detalii Sejur',
    leaveReview: 'Lăsați o Recenzie',
    reviewRequestThanks: 'Feedback-ul dvs. ajută viitorii oaspeți și ne ajută să ne îmbunătățim.',
    reviewRequestPrompt: 'Durează doar un minut să vă împărtășiți gândurile.',

    // Checkout confirmation (Day 0)
    checkoutConfirmation: 'Mulțumim pentru sejur!',
    checkoutConfirmationMessage: 'Sperăm că ați avut o experiență minunată la {propertyName}. Drum bun spre casă!',
    checkoutSafeTravel: 'Vă dorim călătorie plăcută și sperăm să vă revedem curând.',

    // Return incentive (Day 14)
    returnIncentive: 'O Ofertă Specială pentru Dvs.',
    returnIncentiveMessage: 'Ne-a făcut plăcere să vă găzduim la {propertyName} și am dori să vă oferim o reducere specială pentru următorul sejur.',
    returnIncentiveCoupon: 'Codul Dvs. de Cupon',
    returnIncentiveDiscount: '{discount}% reducere la următoarea rezervare',
    returnIncentiveExpiry: 'Valabil până la {expiryDate}',
    returnIncentiveBook: 'Rezervă Din Nou',

    // Seasonal reminder (Day 90)
    seasonalReminder: 'Ne Lipsești la {propertyName}!',
    seasonalReminderMessage: 'A trecut ceva timp de la sejurul dvs. la {propertyName}. Ne-ar plăcea să vă primim înapoi pentru o nouă experiență de neuitat.',
    seasonalReminderBook: 'Verifică Disponibilitatea',

    // Unsubscribe
    unsubscribeText: 'Dacă nu mai doriți să primiți aceste emailuri, puteți',
    unsubscribeLink: 'dezabona aici',
  }
} as const;

type TranslationKey = keyof typeof emailTranslations.en;

// Helper to get translation
/**
 * "2 adulți, 1 copil" when the booking recorded a composition, otherwise the bare total exactly as
 * before. Absent is an unknown, not a zero, so it must not render as "N adults, 0 children".
 */
function guestsLine(data: { numberOfGuests: number; numberOfAdults?: number; numberOfChildren?: number }, lang: LanguageCode): string {
  if (data.numberOfAdults != null && data.numberOfChildren != null) {
    return formatGuestCount(data.numberOfAdults, data.numberOfChildren, asLanguage(lang as string), { diacritics: true });
  }
  return String(data.numberOfGuests);
}

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

interface ReviewRequestEmailData {
  guestName: string;
  propertyName: string;
  brand?: EmailBrand;
  checkInDate: string;
  checkOutDate: string;
  reviewUrl: string;
  unsubscribeUrl?: string;
}

interface CheckoutConfirmationEmailData {
  guestName: string;
  propertyName: string;
  brand?: EmailBrand;
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  totalAmount: string;
  currency: string;
  unsubscribeUrl: string;
}

interface ReturnIncentiveEmailData {
  guestName: string;
  propertyName: string;
  brand?: EmailBrand;
  propertyId: string;
  couponCode: string;
  discount: number;
  expiryDate: string;
  unsubscribeUrl: string;
}

interface SeasonalReminderEmailData {
  guestName: string;
  propertyName: string;
  brand?: EmailBrand;
  propertyId: string;
  unsubscribeUrl: string;
}

export interface BookingEmailData {
  guestName: string;
  bookingId: string;
  propertyName: string;
  brand?: EmailBrand;
  checkInDate: string;
  checkOutDate: string;
  checkInTime?: string;
  checkOutTime?: string;
  numberOfGuests: number;
  /** Composition when the booking recorded one. Absent means unknown, never zero. */
  numberOfAdults?: number;
  numberOfChildren?: number;
  numberOfNights: number;
  baseAmount: string;
  cleaningFee: string;
  extraGuestFee?: string;
  totalAmount: string;
  currency: string;
  cancellationPolicy?: string;
  /** Set when the money has actually landed, so the email states it plainly. */
  isPaid?: boolean;
  paidOnDate?: string;
  propertyAddress?: string;
  hostName?: string;
  /** Display form - localised. The dial form lives in hostPhoneHref. */
  hostPhone?: string;
  specialRequests?: string;
  /** Personalised guest-guide link. Omitted (and the whole block hidden) when it cannot be built. */
  guideUrl?: string;
}

interface HoldEmailData {
  guestName: string;
  holdId: string;
  propertyName: string;
  brand?: EmailBrand;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  /** Composition when the booking recorded one. Absent means unknown, never zero. */
  numberOfAdults?: number;
  numberOfChildren?: number;
  expirationTime: string;
  estimatedTotal: string;
  currency: string;
  completeBookingUrl?: string;
}

interface InquiryEmailData {
  guestName: string;
  inquiryId: string;
  propertyName: string;
  brand?: EmailBrand;
  message: string;
  responseMessage?: string;
  hostName?: string;
}

/**
 * Creates email header with consistent styling
 */
export interface EmailBrand {
  /** Owner address blind-copied on guest mail, so sends are verifiable from his own inbox. */
  bccEmail?: string;
  propertyName: string;
  palette: EmailPalette;
  /** Absolute URL of the property hero. Omitted -> the card simply has no image. */
  heroImageUrl?: string;
  websiteUrl?: string;
  /** An inbox a human reads. Set -> the footer invites a reply instead of forbidding one. */
  replyToEmail?: string;
}

const NEUTRAL_BRAND_PALETTE = getEmailPalette(undefined);

/**
 * Opens the email: canvas, centred card, optional hero, overline + title.
 *
 * Layout is a table because Outlook's Word engine ignores most modern CSS. The
 * <style> block below is progressive enhancement (spacing, mobile) - every
 * colour that matters is also inlined so the design survives a client that
 * drops embedded styles.
 */
function createHeader(title: string, brand?: EmailBrand): string {
  const c = brand?.palette || NEUTRAL_BRAND_PALETTE;
  const hero = brand?.heroImageUrl
    ? `      <tr>
        <td style="padding:0;">
          <img src="${brand.heroImageUrl}" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;" />
        </td>
      </tr>
`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <style>
    body { margin:0; padding:0; background:${c.canvas}; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    .content { padding: 32px 40px 8px 40px; font-family:${c.bodyFont}; font-size:16px; line-height:1.65; color:${c.foreground}; }
    .content p { margin: 0 0 14px 0; }
    /* Measured in Georgia Bold - the REAL fallback, since no webfont is loaded.
       The widest one-line title, "Confirmare Rezervare", costs ~11.6px of width
       per 1px of font-size, against an available width of viewport-70. 5.8vw
       therefore holds it on one line from a 360px phone up, while genuinely long
       titles ("We Miss You at <property>!", 568px at 26px) still wrap - which is
       right. The plain px declaration is the fallback where clamp() is unknown. */
    h1 { margin:0; font-family:${c.headingFont}; font-weight:600; font-size:30px; font-size:clamp(20px, 5.8vw, 30px); line-height:1.25; color:${c.foreground}; letter-spacing:-0.01em; }
    .reference { margin:18px 0 0 0; font-family:${c.bodyFont}; font-size:12px; letter-spacing:0.03em; color:${c.mutedForeground}; }
    h2 { margin:0 0 14px 0; font-family:${c.headingFont}; font-weight:600; font-size:16px; letter-spacing:0.06em; text-transform:uppercase; color:${c.primary}; }
    .overline { font-family:${c.bodyFont}; font-size:12px; letter-spacing:0.18em; text-transform:uppercase; color:${c.mutedForeground}; margin:0 0 10px 0; }
    /* Sections are separated by a hairline rather than sitting in grey boxes. */
    .info-box { background:transparent; border:0; border-top:1px solid ${c.border}; border-radius:0; padding:24px 0 4px 0; margin:24px 0 0 0; }
    .highlight { background:${c.canvas}; border:1px solid ${c.border}; border-radius:0; padding:16px 18px; margin:20px 0; }
    table { width:100%; border-collapse:collapse; }
    td { padding:8px 0; font-size:16px; }
    .right { text-align:right; }
    .total-row td { border-top:1px solid ${c.border}; padding-top:16px; font-weight:700; font-size:21px; font-family:${c.headingFont}; color:${c.foreground}; }
    /* States a fact; it is not pressable. Solid primary + white + uppercase made it the loudest
       thing on the page and indistinguishable from the button, so people reached for it. Now it
       is quiet text in the brand colour, sentence case, with a hairline instead of a fill. */
    .paid-pill { display:inline-block; padding:5px 12px; background:transparent; border:1px solid ${c.border}; border-radius:4px; color:${c.primary}; font-family:${c.bodyFont}; font-size:13px; font-weight:600; letter-spacing:0; text-transform:none; }
    /* A button has to look pressable, and it has to look DIFFERENT from the paid badge below -
       both were solid primary with white text, so the badge read as clickable and this read as a
       section label. Rounder corners, a deeper pad and a soft shadow do the work; the shadow is
       ignored by Outlook, which still gets a solid, well-padded, rounded block. */
    .button { display:inline-block; background:${c.primary}; color:#ffffff !important; padding:15px 34px; text-decoration:none; border-radius:8px; font-family:${c.bodyFont}; font-size:16px; font-weight:700; letter-spacing:0.01em; margin-top:6px; box-shadow:0 2px 5px rgba(0,0,0,0.18); }
    .footer { padding:28px 40px 36px 40px; text-align:center; font-family:${c.bodyFont}; font-size:13px; line-height:1.6; color:${c.mutedForeground}; border-top:1px solid ${c.border}; }
    ul { margin:10px 0; padding-left:20px; } li { margin-bottom:6px; }
    a { color:${c.primary}; }
    @media only screen and (max-width:620px) {
      .masthead { padding:26px 22px 0 22px !important; }
      .content { padding:26px 22px 4px 22px !important; font-size:17px !important; }
      .content p, .content td { font-size:17px !important; }
      .content p.reference { font-size:12px !important; }
      .footer { padding:24px 22px 30px 22px !important; font-size:14px !important; }
      /* 25px fits a 375px phone when clamp() is unsupported; clamp wins where it is. */
      h1 { font-size:21px !important; font-size:clamp(20px, 5.8vw, 30px) !important; }
      h2 { font-size:16px !important; }
      .total-row td { font-size:21px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${c.canvas};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${c.canvas};">
  <tr>
    <td align="center" style="padding:28px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${c.surface};border:1px solid ${c.border};">
${hero}        <tr>
          <td class="masthead" style="padding:34px 40px 0 40px;">
            ${brand?.propertyName ? `<p class="overline">${brand.propertyName}</p>` : ''}
            <h1>${title}</h1>
          </td>
        </tr>
        <tr>
          <td>
`;
}

/**
 * Closes the card opened by createHeader.
 */
function createFooter(lang: LanguageCode, brandOrName: EmailBrand | string, unsubscribeUrl?: string): string {
  const brand = typeof brandOrName === 'string' ? undefined : brandOrName;
  const propertyName = typeof brandOrName === 'string' ? brandOrName : brandOrName.propertyName;
  const c = brand?.palette || NEUTRAL_BRAND_PALETTE;
  return `
          </td>
        </tr>
        <tr>
          <td class="footer">
            <p style="margin:0 0 8px 0; color:${c.foreground};">${t(lang, 'thankYouForChoosing', { propertyName })}</p>
            ${brand?.websiteUrl ? `<p style="margin:0 0 8px 0;"><a href="${brand.websiteUrl}" style="color:${c.primary}; text-decoration:none;">${brand.websiteUrl.replace(/^https?:\/\//, '')}</a></p>` : ''}
            ${unsubscribeUrl ? `
            <p style="margin-top:10px; font-size:11px;">
              ${t(lang, 'unsubscribeText')} <a href="${unsubscribeUrl}" style="color:${c.mutedForeground}; text-decoration:underline;">${t(lang, 'unsubscribeLink')}</a>.
            </p>
            ` : ''}
            <p style="margin-top:10px; font-size:11px;">${brand?.replyToEmail ? t(lang, 'replyPrompt') : t(lang, 'automatedMessage')}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
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
- ${t(lang, 'property')}: ${data.propertyName}
- ${t(lang, 'checkIn')}: ${data.checkInDate}${data.checkInTime ? ` (${t(lang, 'after')} ${data.checkInTime})` : ''}
- ${t(lang, 'checkOut')}: ${data.checkOutDate}${data.checkOutTime ? ` (${t(lang, 'before')} ${data.checkOutTime})` : ''}
- ${t(lang, 'guests')}: ${guestsLine(data, lang)}
- ${t(lang, 'bookingId')}: ${data.bookingId}
${data.guideUrl ? `
${t(lang, 'guideHeading')}:
${t(lang, 'guidePrompt')}
${data.guideUrl}
` : ''}
${t(lang, 'paymentSummary')}:
- ${data.numberOfNights} ${t(lang, 'nights')}: ${data.baseAmount}
- ${t(lang, 'cleaningFee')}: ${data.cleaningFee}
${data.extraGuestFee ? `- ${t(lang, 'extraGuestFee')}: ${data.extraGuestFee}` : ''}
- ${t(lang, 'total')}: ${data.totalAmount}${data.isPaid ? `
- ${t(lang, 'paidInFull')}${data.paidOnDate ? ` (${t(lang, 'paidOn', { date: data.paidOnDate })})` : ''}` : ''}

${data.propertyAddress ? `${t(lang, 'address')}:\n${data.propertyAddress}\n` : ''}
${data.hostName ? `${t(lang, 'host')}: ${data.hostName}` : ''}
${data.hostPhone ? `${t(lang, 'hostPhone')}: ${data.hostPhone}` : ''}

${data.cancellationPolicy ? `${t(lang, 'cancellationPolicy')}:\n${data.cancellationPolicy}\n` : ''}

${t(lang, 'thankYou')}
${t(lang, 'theTeam', { propertyName: data.propertyName })}
`;

  const html = `
${createHeader(t(lang, 'bookingConfirmation'), data.brand)}
  <div class="content">
    <p>${t(lang, 'dear')} ${data.guestName},</p>
    <p>${t(lang, 'bookingConfirmedMessage')}</p>

    <div class="info-box">
      <h2>${t(lang, 'bookingDetails')}</h2>
      <p><strong>${t(lang, 'property')}:</strong> ${data.propertyName}</p>
      <p><strong>${t(lang, 'checkIn')}:</strong> ${data.checkInDate}${data.checkInTime ? ` (${t(lang, 'after')} ${data.checkInTime})` : ''}</p>
      <p><strong>${t(lang, 'checkOut')}:</strong> ${data.checkOutDate}${data.checkOutTime ? ` (${t(lang, 'before')} ${data.checkOutTime})` : ''}</p>
      <p><strong>${t(lang, 'guests')}:</strong> ${guestsLine(data, lang)}</p>
      <!-- A reference, not information: opaque to the guest, needed only if
           something goes wrong. So it closes the block quietly instead of leading it. -->
      <p class="reference">${t(lang, 'bookingId')} ${data.bookingId}</p>
    </div>

    ${data.guideUrl ? `
    <!-- The guide carries the directions, gate number, Wi-Fi and contacts that this email
         deliberately does not repeat. It sits above the payment summary because it is the only
         part of this message the guest will come back to, and on a phone anything below the
         total is a scroll away. -->
    <div class="info-box">
      <h2>${t(lang, 'guideHeading')}</h2>
      <p>${t(lang, 'guidePrompt')}</p>
      <p style="margin:18px 0 0 0;"><a href="${data.guideUrl}" class="button">${t(lang, 'guideCta')}</a></p>
    </div>
    ` : ''}

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
          <td class="right">${data.totalAmount}</td>
        </tr>
      </table>
      ${data.isPaid ? `
      <p style="margin:18px 0 0 0;">
        <span class="paid-pill">${t(lang, 'paidInFull')}</span>
      </p>
      ${data.paidOnDate ? `<p style="margin:8px 0 0 0; font-size:13px;">${t(lang, 'paidOn', { date: data.paidOnDate })}</p>` : ''}
      ` : ''}
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
${createFooter(lang, data.brand || data.propertyName)}
`;

  return { text, html, subject };
}

/**
 * The pre-arrival note, sent a few days before check-in.
 *
 * WHY IT EXISTS. Until now the sequence went confirmation -> checkout -> review, with nothing at
 * all between booking and arrival. A guest who booked in July heard nothing for months, and a
 * guest driving up a mountain road had a street address and no gate number.
 *
 * WHAT IT DELIBERATELY IS NOT. It does not repeat the guide. It carries only the three things
 * that matter while someone is in a car - how to drive there, which gate, who to ring - and
 * points at the guide for everything else. Every one of those facts is read from the guide's own
 * config, so the two cannot drift apart.
 *
 * The closing question is the point of the whole email: asking what time they expect to arrive
 * opens a conversation before anything can go wrong, and it is the reply-to that makes it work.
 */
export interface PreArrivalEmailData {
  guestName: string;
  propertyName: string;
  brand?: EmailBrand;
  checkInDate: string;
  checkInTime?: string;
  /** True only when check-in is the next day; drives the "tomorrow" wording. */
  isTomorrow?: boolean;
  guideUrl?: string;
  wazeUrl?: string;
  mapsUrl?: string;
  gateNumber?: string;
  /** The walk up from the parking, and what it means for luggage. Read from the guide's own
   *  `arrival.access`, so the two cannot disagree. Acted on BEFORE packing, which is the whole
   *  reason this email goes out days ahead rather than on the morning. */
  accessNote?: string;
  hostName?: string;
  /** Display form - localised (a Romanian reads 0723..., not +40723...). */
  hostPhone?: string;
  /** E.164 for the `tel:` link, so it still dials from a foreign SIM. */
  hostPhoneHref?: string;
  unsubscribeUrl?: string;
}

export function createPreArrivalTemplate(
  data: PreArrivalEmailData,
  language: LanguageCode = 'en'
): { text: string; html: string; subject: string } {
  const lang = language;
  // "mâine" is only true if check-in actually is the next day. The cron selects on exactly that,
  // but this email is also sent by hand days ahead — so the claim is made by the data, not by the
  // schedule, and a missed run can never produce an email that lies about the date.
  const subject = data.isTomorrow ? t(lang, 'preArrivalTomorrow') : t(lang, 'preArrival');
  // The date opens the sentence, so it goes in clean. The time is arrival logistics and sits with
  // the gate number instead, where someone actually looks for it.
  const arrivalLine = data.checkInDate;
  const checkInLine = data.checkInTime ? `${t(lang, 'checkIn')}: ${t(lang, 'after')} ${data.checkInTime}` : undefined;
  const hasDetails = (x: unknown) => Boolean(x);
  // Composed here rather than taken from the guide's `arrival.call`: the guide names the
  // caretakers because its contacts card introduces them first, but a guest reading this email
  // has never heard of them. One instruction, one name, one number.
  const callLine = data.hostName && data.hostPhone
    ? t(lang, 'preArrivalCall', { name: data.hostName, phone: data.hostPhone })
    : undefined;
  const hasDirections = data.wazeUrl || data.mapsUrl || data.gateNumber || callLine || data.accessNote || checkInLine;

  const text = `
${subject}

${t(lang, 'dear')} ${data.guestName},

${t(lang, 'preArrivalMessage', { date: arrivalLine })}
${hasDirections ? `
${t(lang, 'preArrivalDirections')}:
${data.wazeUrl ? `- Waze: ${data.wazeUrl}` : ''}
${data.mapsUrl ? `- Google Maps: ${data.mapsUrl}` : ''}
${checkInLine ? `- ${checkInLine}` : ''}
${data.gateNumber ? `- ${data.gateNumber} - ${t(lang, 'preArrivalGate')}` : ''}
${callLine ? `\n${callLine}` : ''}
${data.accessNote ? `\n${data.accessNote}` : ''}
` : ''}
${data.guideUrl ? `
${t(lang, 'guideHeading')}:
${t(lang, 'guidePrompt')}
${data.guideUrl}
` : ''}
${t(lang, 'preArrivalWhatTime')}
${t(lang, 'preArrivalWhatTimeBody')}

${t(lang, 'thankYou')}
${t(lang, 'theTeam', { propertyName: data.propertyName })}
`;

  const html = `
${createHeader(subject, data.brand)}
  <div class="content">
    <p>${t(lang, 'dear')} ${data.guestName},</p>
    <p>${t(lang, 'preArrivalMessage', { date: arrivalLine })}</p>

    ${hasDirections ? `
    <div class="info-box">
      <h2>${t(lang, 'preArrivalDirections')}</h2>
      ${data.wazeUrl || data.mapsUrl ? `
      <!-- Routes lead the section. Someone opening this in a car wants the map before they want
           prose, and the gate number only matters once they have arrived. -->
      <p style="margin:0 0 16px 0;">
        ${data.wazeUrl ? `<a href="${data.wazeUrl}" class="button" style="margin-right:8px;">${t(lang, 'preArrivalWaze')}</a>` : ''}
        ${data.mapsUrl ? `<a href="${data.mapsUrl}" class="button">${t(lang, 'preArrivalMaps')}</a>` : ''}
      </p>
      ` : ''}
      ${checkInLine ? `<p><strong>${t(lang, 'checkIn')}:</strong> ${t(lang, 'after')} ${data.checkInTime}</p>` : ''}
      ${data.gateNumber ? `<p><strong>${data.gateNumber}</strong> - ${t(lang, 'preArrivalGate')}</p>` : ''}
      ${callLine ? `<p>${data.hostPhoneHref ? callLine.replace(data.hostPhone!, `<a href="tel:${data.hostPhoneHref.replace(/\s/g, '')}">${data.hostPhone}</a>`) : callLine}</p>` : ''}
      ${data.accessNote ? `<p>${data.accessNote}</p>` : ''}
    </div>
    ` : ''}

    ${data.guideUrl ? `
    <p style="margin-top:24px;">${t(lang, 'guidePrompt')}</p>
    <p><a href="${data.guideUrl}" class="button">${t(lang, 'guideCta')}</a></p>
    ` : ''}

    <!-- The whole point of this email. Asking opens a conversation before anything can go wrong,
         so it gets a panel of its own rather than closing as a throwaway line. -->
    <div class="highlight" style="margin-top:28px;">
      <p style="margin:0 0 6px 0; font-weight:700;">${t(lang, 'preArrivalWhatTime')}</p>
      <p style="margin:0;">${t(lang, 'preArrivalWhatTimeBody')}</p>
    </div>
  </div>
${createFooter(lang, data.brand || data.propertyName, data.unsubscribeUrl)}
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
- ${t(lang, 'guests')}: ${guestsLine(data, lang)}
- ${t(lang, 'expires')}: ${data.expirationTime}
- ${t(lang, 'estimatedTotal')}: ${data.estimatedTotal}

${t(lang, 'holdExpirationWarning', { time: data.expirationTime })}

${t(lang, 'thankYou')}
${t(lang, 'theTeam', { propertyName: data.propertyName })}
`;

  const html = `
${createHeader(t(lang, 'holdConfirmation'), data.brand)}
  <div class="content">
    <p>${t(lang, 'dear')} ${data.guestName},</p>
    <p>${t(lang, 'holdCreatedMessage')}</p>

    <div class="info-box">
      <h2>${t(lang, 'holdDetails')}</h2>
      <p><strong>${t(lang, 'holdId')}:</strong> ${data.holdId}</p>
      <p><strong>${t(lang, 'property')}:</strong> ${data.propertyName}</p>
      <p><strong>${t(lang, 'checkIn')}:</strong> ${data.checkInDate}</p>
      <p><strong>${t(lang, 'checkOut')}:</strong> ${data.checkOutDate}</p>
      <p><strong>${t(lang, 'guests')}:</strong> ${guestsLine(data, lang)}</p>
      <p><strong>${t(lang, 'estimatedTotal')}:</strong> ${data.estimatedTotal}</p>
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
${createFooter(lang, data.brand || data.propertyName)}
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
${t(lang, 'theTeam', { propertyName: data.propertyName })}
`;

  const html = `
${createHeader(t(lang, 'inquiryConfirmation'), data.brand)}
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
${createFooter(lang, data.brand || data.propertyName)}
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
${t(lang, 'theTeam', { propertyName: data.propertyName })}
`;

  const html = `
${createHeader(t(lang, 'inquiryResponse'), data.brand)}
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
${createFooter(lang, data.brand || data.propertyName)}
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
- ${t(lang, 'refundAmount')}: ${data.totalAmount}

${t(lang, 'refundProcessingTime')}

${t(lang, 'thankYou')}
${t(lang, 'theTeam', { propertyName: data.propertyName })}
`;

  const html = `
${createHeader(t(lang, 'bookingCancellation'), data.brand)}
  <div class="content">
    <p>${t(lang, 'dear')} ${data.guestName},</p>
    <p>${t(lang, 'bookingCancelledMessage')}</p>

    <div class="info-box">
      <h2>${t(lang, 'cancelledBookingDetails')}</h2>
      <p><strong>${t(lang, 'bookingId')}:</strong> ${data.bookingId}</p>
      <p><strong>${t(lang, 'property')}:</strong> ${data.propertyName}</p>
      <p><strong>${t(lang, 'checkIn')}:</strong> ${data.checkInDate}</p>
      <p><strong>${t(lang, 'checkOut')}:</strong> ${data.checkOutDate}</p>
      <p><strong>${t(lang, 'refundAmount')}:</strong> ${data.totalAmount}</p>
    </div>

    <div class="highlight">
      <p>${t(lang, 'refundProcessingTime')}</p>
    </div>
  </div>
${createFooter(lang, data.brand || data.propertyName)}
`;

  return { text, html, subject };
}

/**
 * Creates review request email template
 */
export function createReviewRequestTemplate(
  data: ReviewRequestEmailData,
  language: LanguageCode = 'en'
): { text: string; html: string; subject: string } {
  const lang = language;

  const subject = lang === 'ro'
    ? `Cum a Fost Sejurul la ${data.propertyName}?`
    : `How Was Your Stay at ${data.propertyName}?`;

  const text = `
${t(lang, 'reviewRequest')}

${t(lang, 'dear')} ${data.guestName},

${t(lang, 'reviewRequestMessage', { propertyName: data.propertyName })}

${t(lang, 'reviewStayDetails')}:
- ${t(lang, 'checkIn')}: ${data.checkInDate}
- ${t(lang, 'checkOut')}: ${data.checkOutDate}

${t(lang, 'reviewRequestPrompt')}

${data.reviewUrl}

${t(lang, 'reviewRequestThanks')}

${t(lang, 'thankYou')}
${t(lang, 'theTeam', { propertyName: data.propertyName })}
`;

  const html = `
${createHeader(t(lang, 'reviewRequest'), data.brand)}
  <div class="content">
    <p>${t(lang, 'dear')} ${data.guestName},</p>
    <p>${t(lang, 'reviewRequestMessage', { propertyName: data.propertyName })}</p>

    <div class="info-box">
      <h2>${t(lang, 'reviewStayDetails')}</h2>
      <p><strong>${t(lang, 'checkIn')}:</strong> ${data.checkInDate}</p>
      <p><strong>${t(lang, 'checkOut')}:</strong> ${data.checkOutDate}</p>
    </div>

    <p>${t(lang, 'reviewRequestPrompt')}</p>

    <div style="text-align: center; margin-top: 30px;">
      <a href="${data.reviewUrl}" class="button">${t(lang, 'leaveReview')}</a>
    </div>

    <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">${t(lang, 'reviewRequestThanks')}</p>
  </div>
${createFooter(lang, data.brand || data.propertyName, data.unsubscribeUrl)}
`;

  return { text, html, subject };
}

/**
 * Creates checkout confirmation email template (Day 0)
 */
export function createCheckoutConfirmationTemplate(
  data: CheckoutConfirmationEmailData,
  language: LanguageCode = 'en'
): { text: string; html: string; subject: string } {
  const lang = language;

  const subject = t(lang, 'checkoutConfirmation');

  const text = `
${t(lang, 'checkoutConfirmation')}

${t(lang, 'dear')} ${data.guestName},

${t(lang, 'checkoutConfirmationMessage', { propertyName: data.propertyName })}

${t(lang, 'reviewStayDetails')}:
- ${t(lang, 'property')}: ${data.propertyName}
- ${t(lang, 'checkIn')}: ${data.checkInDate}
- ${t(lang, 'checkOut')}: ${data.checkOutDate}
- ${t(lang, 'total')}: ${data.totalAmount}

${t(lang, 'checkoutSafeTravel')}

${t(lang, 'thankYou')}
${t(lang, 'theTeam', { propertyName: data.propertyName })}
`;

  const html = `
${createHeader(t(lang, 'checkoutConfirmation'), data.brand)}
  <div class="content">
    <p>${t(lang, 'dear')} ${data.guestName},</p>
    <p>${t(lang, 'checkoutConfirmationMessage', { propertyName: data.propertyName })}</p>

    <div class="info-box">
      <h2>${t(lang, 'reviewStayDetails')}</h2>
      <p><strong>${t(lang, 'property')}:</strong> ${data.propertyName}</p>
      <p><strong>${t(lang, 'checkIn')}:</strong> ${data.checkInDate}</p>
      <p><strong>${t(lang, 'checkOut')}:</strong> ${data.checkOutDate}</p>
      <p><strong>${t(lang, 'total')}:</strong> ${data.totalAmount}</p>
    </div>

    <p>${t(lang, 'checkoutSafeTravel')}</p>
  </div>
${createFooter(lang, data.brand || data.propertyName, data.unsubscribeUrl)}
`;

  return { text, html, subject };
}

/**
 * Creates return incentive email template (Day 14)
 */
export function createReturnIncentiveTemplate(
  data: ReturnIncentiveEmailData,
  language: LanguageCode = 'en'
): { text: string; html: string; subject: string } {
  const lang = language;

  const subject = t(lang, 'returnIncentive');
  // From the brand, not from env. NEXT_PUBLIC_APP_URL has never been set on the running service,
  // so this read produced a bare "/booking/check/..." — a relative path, which is dead in every
  // mail client. It is the only call to action in this email, so the email was pointless whenever
  // it fired. `brand.websiteUrl` is the property's custom domain, or the app base, already
  // resolved; every other link in these templates comes from there.
  const bookUrl = `${data.brand?.websiteUrl ?? ''}/booking/check/${data.propertyId}`;

  const text = `
${t(lang, 'returnIncentive')}

${t(lang, 'dear')} ${data.guestName},

${t(lang, 'returnIncentiveMessage', { propertyName: data.propertyName })}

${t(lang, 'returnIncentiveCoupon')}: ${data.couponCode}
${t(lang, 'returnIncentiveDiscount', { discount: String(data.discount) })}
${t(lang, 'returnIncentiveExpiry', { expiryDate: data.expiryDate })}

${bookUrl}

${t(lang, 'thankYou')}
${t(lang, 'theTeam', { propertyName: data.propertyName })}
`;

  const html = `
${createHeader(t(lang, 'returnIncentive'), data.brand)}
  <div class="content">
    <p>${t(lang, 'dear')} ${data.guestName},</p>
    <p>${t(lang, 'returnIncentiveMessage', { propertyName: data.propertyName })}</p>

    <div class="info-box" style="text-align: center;">
      <h2>${t(lang, 'returnIncentiveCoupon')}</h2>
      <p style="font-size: 24px; font-weight: bold; color: #4f46e5; letter-spacing: 2px; margin: 15px 0;">${data.couponCode}</p>
      <p>${t(lang, 'returnIncentiveDiscount', { discount: String(data.discount) })}</p>
      <p style="color: #6b7280; font-size: 13px;">${t(lang, 'returnIncentiveExpiry', { expiryDate: data.expiryDate })}</p>
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <a href="${bookUrl}" class="button">${t(lang, 'returnIncentiveBook')}</a>
    </div>
  </div>
${createFooter(lang, data.brand || data.propertyName, data.unsubscribeUrl)}
`;

  return { text, html, subject };
}

/**
 * Creates seasonal reminder email template (Day 90)
 */
export function createSeasonalReminderTemplate(
  data: SeasonalReminderEmailData,
  language: LanguageCode = 'en'
): { text: string; html: string; subject: string } {
  const lang = language;

  const subject = t(lang, 'seasonalReminder', { propertyName: data.propertyName });
  // From the brand, not from env. NEXT_PUBLIC_APP_URL has never been set on the running service,
  // so this read produced a bare "/booking/check/..." — a relative path, which is dead in every
  // mail client. It is the only call to action in this email, so the email was pointless whenever
  // it fired. `brand.websiteUrl` is the property's custom domain, or the app base, already
  // resolved; every other link in these templates comes from there.
  const bookUrl = `${data.brand?.websiteUrl ?? ''}/booking/check/${data.propertyId}`;

  const text = `
${t(lang, 'seasonalReminder', { propertyName: data.propertyName })}

${t(lang, 'dear')} ${data.guestName},

${t(lang, 'seasonalReminderMessage', { propertyName: data.propertyName })}

${bookUrl}

${t(lang, 'thankYou')}
${t(lang, 'theTeam', { propertyName: data.propertyName })}
`;

  const html = `
${createHeader(t(lang, 'seasonalReminder', { propertyName: data.propertyName }), data.brand)}
  <div class="content">
    <p>${t(lang, 'dear')} ${data.guestName},</p>
    <p>${t(lang, 'seasonalReminderMessage', { propertyName: data.propertyName })}</p>

    <div style="text-align: center; margin-top: 30px;">
      <a href="${bookUrl}" class="button">${t(lang, 'seasonalReminderBook')}</a>
    </div>
  </div>
${createFooter(lang, data.brand || data.propertyName, data.unsubscribeUrl)}
`;

  return { text, html, subject };
}
