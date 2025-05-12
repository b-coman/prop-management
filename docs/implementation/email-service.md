# Email Service Documentation

The RentalSpot platform includes an email notification system that sends transactional emails for various events in the booking flow. This document explains how the email service works and how to configure it.

## Overview

The email service is implemented in `src/services/emailService.ts` and provides the following functionality:

1. **Booking confirmation emails** - Sent to guests when their booking is confirmed
2. **Booking notification emails** - Sent to property owners/admins when a new booking is made
3. **Inquiry confirmation emails** - Sent to guests when they submit an inquiry
4. **Inquiry notification emails** - Sent to property owners/admins when a new inquiry is received

All emails include detailed information about the booking or inquiry and are formatted in both plain text and HTML versions for compatibility with all email clients.

## Configuration

The email service uses environment variables for configuration. In production, you'll need to set the following variables in your `.env.local` file:

```
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-email-password
EMAIL_FROM=RentalSpot <bookings@example.com>
EMAIL_SECURE=false
ADMIN_EMAIL=admin@example.com
```

## Development Mode

In development mode, the email service uses [Ethereal Email](https://ethereal.email/) to create temporary test accounts for sending emails. This allows you to view the emails without actually sending them to real recipients.

When emails are sent in development mode, a preview URL will be logged to the console. You can click this URL to view the email in your browser.

## Integration Points

The email service is integrated with the following components:

1. **Stripe Webhook Handler** (`src/app/api/webhooks/stripe/route.ts`) - Sends booking confirmation emails when a payment is successful
2. **Inquiry Creation** (`src/app/actions/createInquiryAction.ts`) - Sends inquiry confirmation and notification emails
3. **Booking Success Page** (`src/app/booking/success/page.tsx`) - Provides a UI button to resend booking confirmation emails

## Email Templates

The email templates are defined directly in the email service functions. Each email type has both HTML and plain text versions. The HTML templates use inline CSS for maximum compatibility with email clients.

### Booking Confirmation Email

This email is sent to guests when their booking is confirmed. It includes:

- Booking details (ID, dates, guests)
- Property information
- Payment summary
- Contact information

### Booking Notification Email

This email is sent to property owners/admins when a new booking is made. It includes:

- Booking details
- Guest information
- Payment summary
- Link to admin dashboard

### Inquiry Confirmation Email

This email is sent to guests when they submit an inquiry. It includes:

- Inquiry details
- Property information
- Guest's original message
- Next steps

### Inquiry Notification Email

This email is sent to property owners/admins when a new inquiry is received. It includes:

- Inquiry details
- Guest information
- Guest's message
- Link to respond in admin dashboard

## Production Recommendations

For production use, we recommend the following email providers:

1. **Amazon SES** - Cost-effective for high volume
2. **SendGrid** - Good deliverability and analytics
3. **Mailgun** - Developer-friendly API
4. **Postmark** - Excellent for transactional emails

To use these services, you'll need to update the configuration in the email service and possibly modify the transport setup.

## Expanding the Email Service

To add new email types:

1. Create a new function in `src/services/emailService.ts`
2. Design the HTML and plain text templates
3. Integrate the function with the appropriate part of the application

## Troubleshooting

Common issues:

1. **Emails not sending in production** - Check your SMTP credentials and server configuration
2. **Emails going to spam** - Ensure your domain has proper SPF, DKIM, and DMARC records
3. **Preview URLs not working** - This is normal in production mode; preview URLs are only available in development

For any issues, check the application logs for detailed error messages from the email service.