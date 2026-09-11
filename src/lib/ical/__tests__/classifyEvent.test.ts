/**
 * These cases come from the real feeds, not from imagination. The store's entire value is that
 * "a reservation appeared" means one did, so a mis-classification here is the failure mode that
 * matters most — it would either invent a booking or hide one.
 */
import { classifyIcalEvent, MAX_PLAUSIBLE_STAY_NIGHTS } from '../classifyEvent';

describe('classifyIcalEvent', () => {
  it('reads a real Booking.com closed-inventory block as blocked', () => {
    // Verbatim from the live feed, 11 Sep 2026.
    expect(classifyIcalEvent('CLOSED - Not available', 3)).toBe('blocked');
  });

  it('reads a real VRBO reservation as a reservation', () => {
    expect(classifyIcalEvent('Reserved - Carlon', 4)).toBe('reservation');
  });

  it('reads a bare Airbnb "Reserved" as a reservation', () => {
    expect(classifyIcalEvent('Reserved', 3)).toBe('reservation');
  });

  it('treats an implausibly long stay as inventory, whatever it calls itself', () => {
    // The live 551-night Booking.com horizon block. Length has to override wording, because a
    // channel could label its horizon anything at all.
    expect(classifyIcalEvent('CLOSED - Not available', 551)).toBe('blocked');
    expect(classifyIcalEvent('Reserved', 551)).toBe('blocked');
  });

  it('keeps the longest genuine stay in this property history as a reservation', () => {
    // 16 nights is the real maximum across 304 bookings; the threshold must sit well above it.
    expect(classifyIcalEvent('Reserved', 16)).toBe('reservation');
    expect(MAX_PLAUSIBLE_STAY_NIGHTS).toBeGreaterThan(16);
  });

  it('says unknown rather than guessing on an unrecognised summary', () => {
    // Airbnb has historically sent bare guest names. Guessing either way would be worse than a gap.
    expect(classifyIcalEvent('Ionescu', 3)).toBe('unknown');
    expect(classifyIcalEvent('', 3)).toBe('unknown');
    expect(classifyIcalEvent(undefined, 3)).toBe('unknown');
  });

  it('does not mistake the words "Booking.com" for the word "booking"', () => {
    // A summary naming the channel is not a summary saying somebody booked.
    expect(classifyIcalEvent('Booking.com', 3)).toBe('unknown');
  });

  it('recognises Romanian wording on both sides', () => {
    expect(classifyIcalEvent('Rezervare', 3)).toBe('reservation');
    expect(classifyIcalEvent('Nu este disponibil', 3)).toBe('blocked');
  });

  it('prefers blocked when a summary somehow says both', () => {
    // "Reserved - CLOSED" should not count toward bookings; the cautious read is the right one.
    expect(classifyIcalEvent('Reserved - CLOSED', 3)).toBe('blocked');
  });
});
