// src/lib/csv-review-parser.ts

import type { ReviewSource } from '@/types';

export interface ParsedReviewRow {
  guestName: string;
  rating: number;
  comment: string;
  date: string;
  source: ReviewSource;
  sourceUrl?: string;
  language?: string;
}

export interface CsvParseError {
  row: number;
  field: string;
  message: string;
  rawValue: string;
}

export interface CsvParseResult {
  reviews: ParsedReviewRow[];
  errors: CsvParseError[];
  totalRows: number;
}

const VALID_SOURCES: ReviewSource[] = ['direct', 'google', 'booking.com', 'airbnb', 'manual'];

const HEADER_MAP: Record<string, string> = {
  guestname: 'guestName',
  guest_name: 'guestName',
  name: 'guestName',
  rating: 'rating',
  comment: 'comment',
  review: 'comment',
  text: 'comment',
  date: 'date',
  source: 'source',
  sourceurl: 'sourceUrl',
  source_url: 'sourceUrl',
  url: 'sourceUrl',
  language: 'language',
  lang: 'language',
};

/**
 * Split a CSV line respecting quoted fields.
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parse CSV text into review rows with validation.
 */
export function parseCsvReviews(csvText: string): CsvParseResult {
  const reviews: ParsedReviewRow[] = [];
  const errors: CsvParseError[] = [];

  // Strip BOM
  let text = csvText;
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 2) {
    return { reviews: [], errors: [{ row: 0, field: '', message: 'CSV must have a header row and at least one data row.', rawValue: '' }], totalRows: 0 };
  }

  // Parse headers
  const headerLine = lines[0];
  const rawHeaders = splitCsvLine(headerLine);
  const headers = rawHeaders.map(h => {
    const normalized = h.toLowerCase().replace(/[^a-z_]/g, '');
    return HEADER_MAP[normalized] || normalized;
  });

  const totalRows = lines.length - 1;

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1; // 1-indexed, accounting for header
    const fields = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};

    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = fields[j] || '';
    }

    const rowErrors: CsvParseError[] = [];

    // Validate guestName (required)
    const guestName = (row.guestName || '').trim();
    if (!guestName) {
      rowErrors.push({ row: rowNum, field: 'guestName', message: 'Guest name is required.', rawValue: row.guestName || '' });
    }

    // Validate rating (1-5 integer)
    const ratingStr = (row.rating || '').trim();
    const rating = Number(ratingStr);
    if (!ratingStr || isNaN(rating) || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      rowErrors.push({ row: rowNum, field: 'rating', message: 'Rating must be an integer from 1 to 5.', rawValue: ratingStr });
    }

    // Validate comment (required)
    const comment = (row.comment || '').trim();
    if (!comment) {
      rowErrors.push({ row: rowNum, field: 'comment', message: 'Comment is required.', rawValue: row.comment || '' });
    }

    // Validate date (parseable)
    const dateStr = (row.date || '').trim();
    let dateVal = '';
    if (!dateStr) {
      rowErrors.push({ row: rowNum, field: 'date', message: 'Date is required.', rawValue: '' });
    } else {
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) {
        rowErrors.push({ row: rowNum, field: 'date', message: 'Date is not a valid date format.', rawValue: dateStr });
      } else {
        dateVal = parsed.toISOString();
      }
    }

    // Validate source
    const sourceRaw = (row.source || 'manual').trim().toLowerCase() as ReviewSource;
    if (!VALID_SOURCES.includes(sourceRaw)) {
      rowErrors.push({ row: rowNum, field: 'source', message: `Source must be one of: ${VALID_SOURCES.join(', ')}.`, rawValue: row.source || '' });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      reviews.push({
        guestName,
        rating,
        comment,
        date: dateVal,
        source: sourceRaw,
        sourceUrl: (row.sourceUrl || '').trim() || undefined,
        language: (row.language || '').trim() || undefined,
      });
    }
  }

  return { reviews, errors, totalRows };
}

/**
 * Generate a CSV template with headers and an example row.
 */
export function generateCsvTemplate(): string {
  const headers = 'guestName,rating,comment,date,source,sourceUrl,language';
  const example = '"John Smith",5,"Amazing stay, beautiful views!",2025-06-15,direct,,en';
  return `${headers}\n${example}\n`;
}
