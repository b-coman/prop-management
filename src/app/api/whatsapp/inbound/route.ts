import { NextRequest, NextResponse } from 'next/server';
import { loggers } from '@/lib/logger';
import { isStopKeyword, handleInboundStop } from '@/services/suppressionService';
import { checkRateLimit } from '@/lib/rate-limiter';

const logger = loggers.executionGateway;

// Empty TwiML — acknowledges receipt without auto-replying.
const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
const twiml = () =>
  new NextResponse(EMPTY_TWIML, { status: 200, headers: { 'Content-Type': 'text/xml' } });

/**
 * Twilio inbound WhatsApp webhook. Its only job today is to honor STOP /
 * unsubscribe keywords — writing the sender to the suppressionList and marking
 * the guest unsubscribed. Always returns 200 so Twilio does not retry.
 *
 * NOTE (finalization): add Twilio request-signature validation before relying
 * on this for anything beyond opt-out. Spoofed input can only suppress a
 * number (fail-safe), so it is acceptable for the dark launch.
 */
export async function POST(request: NextRequest) {
  // Rate-limit the public endpoint to blunt write-amplification abuse. Still
  // returns 200 (drop) so legitimate Twilio traffic isn't retried into a storm.
  const rl = checkRateLimit(request, { maxRequests: 30, windowSeconds: 60, keyPrefix: 'whatsapp-inbound' });
  if (!rl.allowed) {
    logger.warn('Inbound WhatsApp webhook rate limited');
    return twiml();
  }

  try {
    const form = await request.formData();
    const from = ((form.get('From') as string) || '').replace(/^whatsapp:/, '');
    const body = (form.get('Body') as string) || '';

    logger.info('Inbound WhatsApp message', {
      from: from ? from.slice(0, 6) + '***' : 'unknown',
      isStop: isStopKeyword(body),
    });

    if (from && isStopKeyword(body)) {
      await handleInboundStop(from, 'whatsapp-inbound');
    }
    return twiml();
  } catch (error) {
    logger.error('Error handling inbound WhatsApp webhook', error as Error);
    return twiml();
  }
}
