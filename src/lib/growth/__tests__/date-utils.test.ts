/** @jest-environment node */
import { seasonOf, monthsBetween, parseFirestoreDate } from '../date-utils';

describe('growth/date-utils', () => {
  describe('seasonOf', () => {
    it('maps Dec/Jan/Feb to winter', () => {
      expect(seasonOf(new Date(2026, 11, 15))).toBe('winter');
      expect(seasonOf(new Date(2026, 0, 15))).toBe('winter');
      expect(seasonOf(new Date(2026, 1, 15))).toBe('winter');
    });
    it('maps the other seasons by month', () => {
      expect(seasonOf(new Date(2026, 2, 1))).toBe('spring');
      expect(seasonOf(new Date(2026, 4, 30))).toBe('spring');
      expect(seasonOf(new Date(2026, 5, 1))).toBe('summer');
      expect(seasonOf(new Date(2026, 7, 31))).toBe('summer');
      expect(seasonOf(new Date(2026, 8, 1))).toBe('autumn');
      expect(seasonOf(new Date(2026, 10, 30))).toBe('autumn');
    });
  });

  describe('monthsBetween', () => {
    it('counts whole months', () => {
      expect(monthsBetween(new Date(2025, 0, 15), new Date(2026, 0, 15))).toBe(12);
      expect(monthsBetween(new Date(2026, 0, 15), new Date(2026, 3, 15))).toBe(3);
    });
    it('does not count a partial final month', () => {
      expect(monthsBetween(new Date(2026, 0, 15), new Date(2026, 3, 10))).toBe(2);
    });
    it('is 0 for the same date', () => {
      expect(monthsBetween(new Date(2026, 0, 15), new Date(2026, 0, 15))).toBe(0);
    });
  });

  describe('parseFirestoreDate', () => {
    it('parses a serialized {_seconds} object', () => {
      expect(parseFirestoreDate({ _seconds: 1700000000 })?.getTime()).toBe(1700000000 * 1000);
    });
    it('parses a Timestamp-like object via toDate()', () => {
      const d = new Date(2026, 0, 1);
      expect(parseFirestoreDate({ toDate: () => d })).toBe(d);
    });
    it('parses ISO strings and Date instances', () => {
      expect(parseFirestoreDate('2026-01-01')?.getFullYear()).toBe(2026);
      const d = new Date();
      expect(parseFirestoreDate(d)).toBe(d);
    });
    it('returns null for junk', () => {
      expect(parseFirestoreDate(null)).toBeNull();
      expect(parseFirestoreDate(undefined)).toBeNull();
      expect(parseFirestoreDate('not-a-date')).toBeNull();
      expect(parseFirestoreDate(123 as unknown)).toBeNull();
    });
  });
});
