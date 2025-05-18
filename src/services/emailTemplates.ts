/**
 * Bilingual email templates for RentalSpot
 * All templates show content in both English and Romanian
 */

interface BilingualContent {
  en: string;
  ro: string;
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
 * Creates bilingual email header
 */
function createBilingualHeader(title: BilingualContent): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; }
    .header { background-color: #4f46e5; color: white; padding: 30px; text-align: center; }
    .content { padding: 30px; }
    .bilingual-section { margin: 20px 0; }
    .lang-label { font-weight: bold; color: #6b7280; margin-bottom: 5px; font-size: 14px; }
    .lang-content { margin-bottom: 20px; }
    .info-box { background-color: #f9fafb; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #4f46e5; }
    .footer { text-align: center; padding: 30px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 8px 0; }
    .right { text-align: right; }
    .total-row { font-weight: bold; font-size: 18px; border-top: 2px solid #e5e7eb; padding-top: 10px; }
    h1 { margin: 0; }
    h2 { color: #4f46e5; margin-top: 30px; }
    .highlight { background-color: #fef3c7; padding: 15px; border-radius: 5px; margin: 15px 0; }
    .button { background-color: #4f46e5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title.en}</h1>
    <p style="margin-top: 5px; font-size: 18px;">${title.ro}</p>
  </div>
`;
}

/**
 * Creates bilingual section with language labels
 */
function createBilingualSection(content: BilingualContent, includeLabels: boolean = true): string {
  if (includeLabels) {
    return `
    <div class="bilingual-section">
      <div class="lang-content">
        <div class="lang-label">English:</div>
        ${content.en}
      </div>
      <div class="lang-content">
        <div class="lang-label">Română:</div>
        ${content.ro}
      </div>
    </div>
    `;
  } else {
    return `
    <div class="bilingual-section">
      <div class="lang-content">${content.en}</div>
      <div class="lang-content">${content.ro}</div>
    </div>
    `;
  }
}

/**
 * Creates bilingual footer
 */
function createBilingualFooter(): string {
  return `
  <div class="footer">
    <div class="bilingual-section">
      <p>Thank you for choosing RentalSpot! | Vă mulțumim că ați ales RentalSpot!</p>
      <p style="margin-top: 10px;">
        This is an automated message. Please do not reply to this email.<br>
        Acesta este un mesaj automat. Vă rugăm să nu răspundeți la acest email.
      </p>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Creates booking confirmation email template
 */
export function createBookingConfirmationTemplate(data: BookingEmailData): { text: string; html: string } {
  const text = `
Booking Confirmation | Confirmare Rezervare

English:
--------
Dear ${data.guestName},

Thank you for your booking! Your reservation is confirmed.

Booking Details:
- Booking ID: ${data.bookingId}
- Property: ${data.propertyName}
- Check-in: ${data.checkInDate}${data.checkInTime ? ` (After ${data.checkInTime})` : ''}
- Check-out: ${data.checkOutDate}${data.checkOutTime ? ` (Before ${data.checkOutTime})` : ''}
- Guests: ${data.numberOfGuests}

Payment Summary:
- ${data.numberOfNights} nights: ${data.baseAmount}
- Cleaning fee: ${data.cleaningFee}
${data.extraGuestFee ? `- Extra guest fee: ${data.extraGuestFee}` : ''}
- Total: ${data.totalAmount} ${data.currency}

${data.propertyAddress ? `Property Address:\n${data.propertyAddress}\n` : ''}
${data.hostName ? `Host: ${data.hostName}` : ''}
${data.hostPhone ? `\nHost Phone: ${data.hostPhone}` : ''}

${data.cancellationPolicy ? `Cancellation Policy:\n${data.cancellationPolicy}\n` : ''}

Română:
-------
Dragă ${data.guestName},

Vă mulțumim pentru rezervare! Rezervarea dumneavoastră este confirmată.

Detalii Rezervare:
- ID Rezervare: ${data.bookingId}
- Proprietate: ${data.propertyName}
- Check-in: ${data.checkInDate}${data.checkInTime ? ` (După ${data.checkInTime})` : ''}
- Check-out: ${data.checkOutDate}${data.checkOutTime ? ` (Înainte de ${data.checkOutTime})` : ''}
- Oaspeți: ${data.numberOfGuests}

Sumar Plată:
- ${data.numberOfNights} nopți: ${data.baseAmount}
- Taxă curățenie: ${data.cleaningFee}
${data.extraGuestFee ? `- Taxă oaspeți suplimentari: ${data.extraGuestFee}` : ''}
- Total: ${data.totalAmount} ${data.currency}

${data.propertyAddress ? `Adresa Proprietății:\n${data.propertyAddress}\n` : ''}
${data.hostName ? `Gazdă: ${data.hostName}` : ''}
${data.hostPhone ? `\nTelefon Gazdă: ${data.hostPhone}` : ''}

${data.cancellationPolicy ? `Politica de Anulare:\n${data.cancellationPolicy}\n` : ''}

Thank you! | Vă mulțumim!
The RentalSpot Team | Echipa RentalSpot
`;

  const html = `
${createBilingualHeader({ en: 'Booking Confirmation', ro: 'Confirmare Rezervare' })}
  <div class="content">
    ${createBilingualSection({
      en: `<p>Dear ${data.guestName},</p><p>Thank you for your booking! Your reservation is confirmed.</p>`,
      ro: `<p>Dragă ${data.guestName},</p><p>Vă mulțumim pentru rezervare! Rezervarea dumneavoastră este confirmată.</p>`
    })}
    
    <div class="info-box">
      <h2>Booking Details | Detalii Rezervare</h2>
      ${createBilingualSection({
        en: `
          <p><strong>Booking ID:</strong> ${data.bookingId}</p>
          <p><strong>Property:</strong> ${data.propertyName}</p>
          <p><strong>Check-in:</strong> ${data.checkInDate}${data.checkInTime ? ` (After ${data.checkInTime})` : ''}</p>
          <p><strong>Check-out:</strong> ${data.checkOutDate}${data.checkOutTime ? ` (Before ${data.checkOutTime})` : ''}</p>
          <p><strong>Guests:</strong> ${data.numberOfGuests}</p>
        `,
        ro: `
          <p><strong>ID Rezervare:</strong> ${data.bookingId}</p>
          <p><strong>Proprietate:</strong> ${data.propertyName}</p>
          <p><strong>Check-in:</strong> ${data.checkInDate}${data.checkInTime ? ` (După ${data.checkInTime})` : ''}</p>
          <p><strong>Check-out:</strong> ${data.checkOutDate}${data.checkOutTime ? ` (Înainte de ${data.checkOutTime})` : ''}</p>
          <p><strong>Oaspeți:</strong> ${data.numberOfGuests}</p>
        `
      }, false)}
    </div>
    
    <div class="info-box">
      <h2>Payment Summary | Sumar Plată</h2>
      <table>
        <tr>
          <td>${data.numberOfNights} nights | nopți</td>
          <td class="right">${data.baseAmount}</td>
        </tr>
        <tr>
          <td>Cleaning fee | Taxă curățenie</td>
          <td class="right">${data.cleaningFee}</td>
        </tr>
        ${data.extraGuestFee ? `
        <tr>
          <td>Extra guest fee | Taxă oaspeți suplimentari</td>
          <td class="right">${data.extraGuestFee}</td>
        </tr>
        ` : ''}
        <tr class="total-row">
          <td>Total</td>
          <td class="right">${data.totalAmount} ${data.currency}</td>
        </tr>
      </table>
    </div>
    
    ${data.propertyAddress || data.hostName ? `
    <div class="info-box">
      <h2>Property Information | Informații Proprietate</h2>
      ${createBilingualSection({
        en: `
          ${data.propertyAddress ? `<p><strong>Address:</strong><br>${data.propertyAddress}</p>` : ''}
          ${data.hostName ? `<p><strong>Host:</strong> ${data.hostName}</p>` : ''}
          ${data.hostPhone ? `<p><strong>Host Phone:</strong> ${data.hostPhone}</p>` : ''}
        `,
        ro: `
          ${data.propertyAddress ? `<p><strong>Adresă:</strong><br>${data.propertyAddress}</p>` : ''}
          ${data.hostName ? `<p><strong>Gazdă:</strong> ${data.hostName}</p>` : ''}
          ${data.hostPhone ? `<p><strong>Telefon Gazdă:</strong> ${data.hostPhone}</p>` : ''}
        `
      }, false)}
    </div>
    ` : ''}
    
    ${data.cancellationPolicy ? `
    <div class="info-box">
      <h2>Cancellation Policy | Politica de Anulare</h2>
      ${createBilingualSection({
        en: `<p>${data.cancellationPolicy}</p>`,
        ro: `<p>${data.cancellationPolicy}</p>`
      }, false)}
    </div>
    ` : ''}
    
    ${data.specialRequests ? `
    <div class="highlight">
      ${createBilingualSection({
        en: `<p><strong>Special Requests:</strong><br>${data.specialRequests}</p>`,
        ro: `<p><strong>Cereri Speciale:</strong><br>${data.specialRequests}</p>`
      }, false)}
    </div>
    ` : ''}
  </div>
${createBilingualFooter()}
`;

  return { text, html };
}

/**
 * Creates hold confirmation email template
 */
export function createHoldConfirmationTemplate(data: HoldEmailData): { text: string; html: string } {
  const text = `
Hold Confirmation | Confirmare Rezervare Temporară

English:
--------
Dear ${data.guestName},

Your temporary hold has been created! Please complete your booking before it expires.

Hold Details:
- Hold ID: ${data.holdId}
- Property: ${data.propertyName}
- Check-in: ${data.checkInDate}
- Check-out: ${data.checkOutDate}
- Guests: ${data.numberOfGuests}
- Expires: ${data.expirationTime}
- Estimated Total: ${data.estimatedTotal} ${data.currency}

IMPORTANT: This hold will expire at ${data.expirationTime}. Please complete your booking before then.

Română:
-------
Dragă ${data.guestName},

Rezervarea dvs. temporară a fost creată! Vă rugăm să finalizați rezervarea înainte de expirare.

Detalii Rezervare Temporară:
- ID: ${data.holdId}
- Proprietate: ${data.propertyName}
- Check-in: ${data.checkInDate}
- Check-out: ${data.checkOutDate}
- Oaspeți: ${data.numberOfGuests}
- Expiră: ${data.expirationTime}
- Total Estimat: ${data.estimatedTotal} ${data.currency}

IMPORTANT: Această rezervare temporară va expira la ${data.expirationTime}. Vă rugăm să finalizați rezervarea înainte de această oră.

Thank you! | Vă mulțumim!
The RentalSpot Team | Echipa RentalSpot
`;

  const html = `
${createBilingualHeader({ en: 'Hold Confirmation', ro: 'Confirmare Rezervare Temporară' })}
  <div class="content">
    ${createBilingualSection({
      en: `<p>Dear ${data.guestName},</p><p>Your temporary hold has been created! Please complete your booking before it expires.</p>`,
      ro: `<p>Dragă ${data.guestName},</p><p>Rezervarea dvs. temporară a fost creată! Vă rugăm să finalizați rezervarea înainte de expirare.</p>`
    })}
    
    <div class="info-box">
      <h2>Hold Details | Detalii Rezervare Temporară</h2>
      ${createBilingualSection({
        en: `
          <p><strong>Hold ID:</strong> ${data.holdId}</p>
          <p><strong>Property:</strong> ${data.propertyName}</p>
          <p><strong>Check-in:</strong> ${data.checkInDate}</p>
          <p><strong>Check-out:</strong> ${data.checkOutDate}</p>
          <p><strong>Guests:</strong> ${data.numberOfGuests}</p>
          <p><strong>Estimated Total:</strong> ${data.estimatedTotal} ${data.currency}</p>
        `,
        ro: `
          <p><strong>ID:</strong> ${data.holdId}</p>
          <p><strong>Proprietate:</strong> ${data.propertyName}</p>
          <p><strong>Check-in:</strong> ${data.checkInDate}</p>
          <p><strong>Check-out:</strong> ${data.checkOutDate}</p>
          <p><strong>Oaspeți:</strong> ${data.numberOfGuests}</p>
          <p><strong>Total Estimat:</strong> ${data.estimatedTotal} ${data.currency}</p>
        `
      }, false)}
    </div>
    
    <div class="highlight">
      ${createBilingualSection({
        en: `<p><strong>IMPORTANT:</strong> This hold will expire at <strong>${data.expirationTime}</strong>. Please complete your booking before then.</p>`,
        ro: `<p><strong>IMPORTANT:</strong> Această rezervare temporară va expira la <strong>${data.expirationTime}</strong>. Vă rugăm să finalizați rezervarea înainte de această oră.</p>`
      }, false)}
    </div>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="#" class="button">Complete Booking | Finalizează Rezervarea</a>
    </div>
  </div>
${createBilingualFooter()}
`;

  return { text, html };
}

/**
 * Creates inquiry confirmation email template  
 */
export function createInquiryConfirmationTemplate(data: InquiryEmailData): { text: string; html: string } {
  const text = `
Inquiry Confirmation | Confirmare Solicitare

English:
--------
Dear ${data.guestName},

Thank you for your inquiry! We have received your message and will respond as soon as possible.

Inquiry Details:
- Inquiry ID: ${data.inquiryId}
- Property: ${data.propertyName}

Your Message:
${data.message}

What's Next:
- We will review your inquiry
- You will receive a response within 24-48 hours
- Check your email for updates

Română:
-------
Dragă ${data.guestName},

Vă mulțumim pentru solicitare! Am primit mesajul dvs. și vă vom răspunde cât mai curând posibil.

Detalii Solicitare:
- ID Solicitare: ${data.inquiryId}
- Proprietate: ${data.propertyName}

Mesajul Dvs.:
${data.message}

Ce Urmează:
- Vom analiza solicitarea dvs.
- Veți primi un răspuns în 24-48 de ore
- Verificați email-ul pentru actualizări

Thank you! | Vă mulțumim!
The RentalSpot Team | Echipa RentalSpot
`;

  const html = `
${createBilingualHeader({ en: 'Inquiry Confirmation', ro: 'Confirmare Solicitare' })}
  <div class="content">
    ${createBilingualSection({
      en: `<p>Dear ${data.guestName},</p><p>Thank you for your inquiry! We have received your message and will respond as soon as possible.</p>`,
      ro: `<p>Dragă ${data.guestName},</p><p>Vă mulțumim pentru solicitare! Am primit mesajul dvs. și vă vom răspunde cât mai curând posibil.</p>`
    })}
    
    <div class="info-box">
      <h2>Inquiry Details | Detalii Solicitare</h2>
      ${createBilingualSection({
        en: `
          <p><strong>Inquiry ID:</strong> ${data.inquiryId}</p>
          <p><strong>Property:</strong> ${data.propertyName}</p>
        `,
        ro: `
          <p><strong>ID Solicitare:</strong> ${data.inquiryId}</p>
          <p><strong>Proprietate:</strong> ${data.propertyName}</p>
        `
      }, false)}
    </div>
    
    <div class="info-box">
      <h2>Your Message | Mesajul Dvs.</h2>
      <p style="font-style: italic; color: #6b7280;">${data.message}</p>
    </div>
    
    <div class="info-box">
      <h2>What's Next | Ce Urmează</h2>
      ${createBilingualSection({
        en: `
          <ul>
            <li>We will review your inquiry</li>
            <li>You will receive a response within 24-48 hours</li>
            <li>Check your email for updates</li>
          </ul>
        `,
        ro: `
          <ul>
            <li>Vom analiza solicitarea dvs.</li>
            <li>Veți primi un răspuns în 24-48 de ore</li>
            <li>Verificați email-ul pentru actualizări</li>
          </ul>
        `
      }, false)}
    </div>
  </div>
${createBilingualFooter()}
`;

  return { text, html };
}

/**
 * Creates inquiry response email template
 */
export function createInquiryResponseTemplate(data: InquiryEmailData): { text: string; html: string } {
  const text = `
Response to Your Inquiry | Răspuns la Solicitarea Dvs.

English:
--------
Dear ${data.guestName},

${data.hostName || 'The host'} has responded to your inquiry about ${data.propertyName}.

Original Inquiry:
${data.message}

Response:
${data.responseMessage}

What's Next:
- If you're satisfied with the response, you can proceed with booking
- If you have more questions, feel free to submit another inquiry
- Visit our website to check availability and make a reservation

Română:
-------
Dragă ${data.guestName},

${data.hostName || 'Gazda'} a răspuns la solicitarea dvs. despre ${data.propertyName}.

Solicitare Originală:
${data.message}

Răspuns:
${data.responseMessage}

Ce Urmează:
- Dacă sunteți mulțumit de răspuns, puteți continua cu rezervarea
- Dacă aveți mai multe întrebări, nu ezitați să trimiteți o altă solicitare
- Vizitați site-ul nostru pentru a verifica disponibilitatea și a face o rezervare

Thank you! | Vă mulțumim!
The RentalSpot Team | Echipa RentalSpot
`;

  const html = `
${createBilingualHeader({ en: 'Response to Your Inquiry', ro: 'Răspuns la Solicitarea Dvs.' })}
  <div class="content">
    ${createBilingualSection({
      en: `<p>Dear ${data.guestName},</p><p>${data.hostName || 'The host'} has responded to your inquiry about ${data.propertyName}.</p>`,
      ro: `<p>Dragă ${data.guestName},</p><p>${data.hostName || 'Gazda'} a răspuns la solicitarea dvs. despre ${data.propertyName}.</p>`
    })}
    
    <div class="info-box">
      <h2>Original Inquiry | Solicitare Originală</h2>
      <p style="font-style: italic; color: #6b7280;">${data.message}</p>
    </div>
    
    <div class="info-box" style="background-color: #f0f9ff; border-left-color: #0ea5e9;">
      <h2>Response | Răspuns</h2>
      <p>${data.responseMessage}</p>
    </div>
    
    <div class="info-box">
      <h2>What's Next | Ce Urmează</h2>
      ${createBilingualSection({
        en: `
          <ul>
            <li>If you're satisfied with the response, you can proceed with booking</li>
            <li>If you have more questions, feel free to submit another inquiry</li>
            <li>Visit our website to check availability and make a reservation</li>
          </ul>
        `,
        ro: `
          <ul>
            <li>Dacă sunteți mulțumit de răspuns, puteți continua cu rezervarea</li>
            <li>Dacă aveți mai multe întrebări, nu ezitați să trimiteți o altă solicitare</li>
            <li>Vizitați site-ul nostru pentru a verifica disponibilitatea și a face o rezervare</li>
          </ul>
        `
      }, false)}
    </div>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="#" class="button">Book Now | Rezervă Acum</a>
    </div>
  </div>
${createBilingualFooter()}
`;

  return { text, html };
}

/**
 * Creates booking cancellation email template
 */
export function createBookingCancellationTemplate(data: BookingEmailData): { text: string; html: string } {
  const text = `
Booking Cancellation | Anulare Rezervare

English:
--------
Dear ${data.guestName},

Your booking has been cancelled as requested.

Cancelled Booking Details:
- Booking ID: ${data.bookingId}
- Property: ${data.propertyName}
- Check-in: ${data.checkInDate}
- Check-out: ${data.checkOutDate}
- Refund Amount: ${data.totalAmount} ${data.currency}

Your refund will be processed within 5-10 business days.

Română:
-------
Dragă ${data.guestName},

Rezervarea dvs. a fost anulată conform solicitării.

Detalii Rezervare Anulată:
- ID Rezervare: ${data.bookingId}
- Proprietate: ${data.propertyName}
- Check-in: ${data.checkInDate}
- Check-out: ${data.checkOutDate}
- Sumă Rambursată: ${data.totalAmount} ${data.currency}

Rambursarea va fi procesată în 5-10 zile lucrătoare.

Thank you! | Vă mulțumim!
The RentalSpot Team | Echipa RentalSpot
`;

  const html = `
${createBilingualHeader({ en: 'Booking Cancellation', ro: 'Anulare Rezervare' })}
  <div class="content">
    ${createBilingualSection({
      en: `<p>Dear ${data.guestName},</p><p>Your booking has been cancelled as requested.</p>`,
      ro: `<p>Dragă ${data.guestName},</p><p>Rezervarea dvs. a fost anulată conform solicitării.</p>`
    })}
    
    <div class="info-box">
      <h2>Cancelled Booking Details | Detalii Rezervare Anulată</h2>
      ${createBilingualSection({
        en: `
          <p><strong>Booking ID:</strong> ${data.bookingId}</p>
          <p><strong>Property:</strong> ${data.propertyName}</p>
          <p><strong>Check-in:</strong> ${data.checkInDate}</p>
          <p><strong>Check-out:</strong> ${data.checkOutDate}</p>
          <p><strong>Refund Amount:</strong> ${data.totalAmount} ${data.currency}</p>
        `,
        ro: `
          <p><strong>ID Rezervare:</strong> ${data.bookingId}</p>
          <p><strong>Proprietate:</strong> ${data.propertyName}</p>
          <p><strong>Check-in:</strong> ${data.checkInDate}</p>
          <p><strong>Check-out:</strong> ${data.checkOutDate}</p>
          <p><strong>Sumă Rambursată:</strong> ${data.totalAmount} ${data.currency}</p>
        `
      }, false)}
    </div>
    
    <div class="highlight">
      ${createBilingualSection({
        en: `<p>Your refund will be processed within 5-10 business days.</p>`,
        ro: `<p>Rambursarea va fi procesată în 5-10 zile lucrătoare.</p>`
      }, false)}
    </div>
  </div>
${createBilingualFooter()}
`;

  return { text, html };
}