/**
 * Import historical bookings from CSV into Firestore.
 *
 * Usage:
 *   npx tsx scripts/import-bookings-csv.ts <csv-file> <property-slug> [--dry-run]
 *
 * Examples:
 *   npx tsx scripts/import-bookings-csv.ts ~/Downloads/comarnic.csv prahova-mountain-chalet --dry-run
 *   npx tsx scripts/import-bookings-csv.ts ~/Downloads/comarnic.csv prahova-mountain-chalet
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as admin from 'firebase-admin';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH not set in .env.local');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(path.resolve(serviceAccountPath)),
});

const db = admin.firestore();

// --- Import utilities (inline to avoid TS path alias issues in scripts) ---

function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '');
  cleaned = cleaned.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = '+' + cleaned.substring(1).replace(/\+/g, '');
  } else {
    cleaned = cleaned.replace(/\+/g, '');
  }

  if (cleaned.startsWith('0040')) {
    cleaned = '+40' + cleaned.substring(4);
  } else if (cleaned.startsWith('0') && cleaned.length === 10 && cleaned[1] === '7') {
    cleaned = '+40' + cleaned.substring(1);
  } else if (!cleaned.startsWith('+') && cleaned.startsWith('40') && cleaned.length === 11) {
    cleaned = '+' + cleaned;
  } else if (cleaned.startsWith('+')) {
    // already international
  } else if (cleaned.length >= 10 && !cleaned.startsWith('+')) {
    const knownPrefixes = ['972', '44', '49', '33', '31', '48', '39', '34', '380', '32', '966', '1', '7'];
    for (const prefix of knownPrefixes) {
      if (cleaned.startsWith(prefix)) {
        cleaned = '+' + cleaned;
        break;
      }
    }
  }
  return cleaned;
}

function parseName(fullName: string): { firstName: string; lastName?: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: '' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function normalizeNameForMatching(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-\s]+/g, ' ')
    .trim();
}

function parseEarning(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/RON/gi, '').replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num);
}

function parseCSVDate(raw: string): Date | null {
  if (!raw || !raw.trim()) return null;
  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const parts = raw.trim().split('-');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = months[parts[1]];
  const yearShort = parseInt(parts[2], 10);
  if (isNaN(day) || month === undefined || isNaN(yearShort)) return null;
  return new Date(2000 + yearShort, month, day);
}

function mapSource(csvSource: string): string {
  const normalized = csvSource.toLowerCase().trim();
  switch (normalized) {
    case 'airbnb': return 'airbnb';
    case 'booking': return 'booking.com';
    case 'personal': return 'direct';
    case 'travelmint': return 'travelmint';
    default: return normalized || 'unknown';
  }
}

function mapCountry(csvCountry: string): string | undefined {
  const trimmed = csvCountry?.trim();
  if (!trimmed || trimmed === '?') return undefined;
  if (trimmed === 'UC') return 'UA';
  return trimmed;
}

// --- CSV Parsing ---

interface CSVRow {
  guestName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  persons: number;
  adults: number;
  children: number;
  earning: string;
  source: string;
  contact: string;
  notes: string;
  country: string;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Join lines that are part of multiline quoted fields.
 * A line is incomplete if it has an odd number of unescaped quotes.
 */
function joinMultilineFields(rawLines: string[]): string[] {
  const result: string[] = [];
  let pending = '';

  for (const line of rawLines) {
    if (pending) {
      pending += '\n' + line;
    } else {
      pending = line;
    }

    // Count unescaped quotes
    const quoteCount = (pending.match(/"/g) || []).length;
    if (quoteCount % 2 === 0) {
      result.push(pending);
      pending = '';
    }
  }

  // If there's still pending text, add it
  if (pending) {
    result.push(pending);
  }

  return result;
}

function parseCSV(filePath: string): CSVRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const rawLines = content.split('\n');

  // Join multiline quoted fields before processing
  const lines = joinMultilineFields(rawLines).filter((l) => l.trim());

  // Skip header
  const dataLines = lines.slice(1);
  const rows: CSVRow[] = [];

  for (const line of dataLines) {
    const fields = parseCSVLine(line);
    const guestName = fields[0]?.trim();

    // Skip empty rows (Excel artifacts)
    if (!guestName) continue;

    rows.push({
      guestName,
      checkIn: fields[1]?.trim() || '',
      checkOut: fields[2]?.trim() || '',
      nights: parseInt(fields[3]?.trim() || '0', 10) || 0,
      persons: parseInt(fields[4]?.trim() || '0', 10) || 0,
      adults: parseInt(fields[5]?.trim() || '0', 10) || 0,
      children: parseInt(fields[6]?.trim() || '0', 10) || 0,
      earning: fields[7]?.trim() || '',
      source: fields[8]?.trim() || '',
      contact: fields[9]?.trim() || '',
      notes: fields[10]?.trim() || '',
      country: fields[11]?.trim() || '',
    });
  }

  return rows;
}

// --- Guest Grouping (dedup by phone + name) ---

interface GuestGroup {
  key: string;
  normalizedName: string;
  phone: string;
  normalizedPhone: string;
  rows: CSVRow[];
}

function groupGuests(rows: CSVRow[]): GuestGroup[] {
  const groups: GuestGroup[] = [];
  const phoneMap = new Map<string, number>(); // normalizedPhone → group index
  const nameMap = new Map<string, number>(); // normalizedName → group index

  for (const row of rows) {
    const normalized = normalizePhone(row.contact);
    const normalizedName = normalizeNameForMatching(row.guestName);

    let groupIdx: number | undefined;

    // Try phone match first (if phone exists)
    if (normalized) {
      groupIdx = phoneMap.get(normalized);
    }

    // Try name match if no phone match
    if (groupIdx === undefined) {
      groupIdx = nameMap.get(normalizedName);
    }

    if (groupIdx !== undefined) {
      groups[groupIdx].rows.push(row);
      // If this row has a phone we haven't seen, register it
      if (normalized && !phoneMap.has(normalized)) {
        phoneMap.set(normalized, groupIdx);
      }
    } else {
      // New group
      const idx = groups.length;
      groups.push({
        key: normalized || normalizedName,
        normalizedName,
        phone: row.contact,
        normalizedPhone: normalized,
        rows: [row],
      });
      if (normalized) phoneMap.set(normalized, idx);
      nameMap.set(normalizedName, idx);
    }
  }

  return groups;
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const filteredArgs = args.filter((a) => a !== '--dry-run');

  const csvFile = filteredArgs[0];
  const propertySlug = filteredArgs[1];

  if (!csvFile || !propertySlug) {
    console.error('Usage: npx tsx scripts/import-bookings-csv.ts <csv-file> <property-slug> [--dry-run]');
    process.exit(1);
  }

  const resolvedPath = path.resolve(csvFile);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  // Verify property exists
  const propertyDoc = await db.collection('properties').doc(propertySlug).get();
  if (!propertyDoc.exists) {
    console.error(`Property '${propertySlug}' not found in Firestore`);
    process.exit(1);
  }
  const propertyData = propertyDoc.data()!;
  const baseCurrency = propertyData.baseCurrency || 'RON';
  console.log(`Property: ${propertyData.name?.en || propertySlug} (${baseCurrency})`);

  // Parse CSV
  const rows = parseCSV(resolvedPath);
  console.log(`Parsed ${rows.length} booking rows from CSV\n`);

  // Group guests
  const guestGroups = groupGuests(rows);
  console.log(`Identified ${guestGroups.length} unique guests:\n`);

  // Print guest groups
  const now = new Date();
  let totalBookings = 0;
  let futureBookings = 0;

  for (const group of guestGroups) {
    const totalSpent = group.rows.reduce((sum, r) => sum + parseEarning(r.earning), 0);
    const sources = [...new Set(group.rows.map((r) => mapSource(r.source)))];
    console.log(
      `  ${group.rows[0].guestName} (${group.rows.length} bookings, ${totalSpent} ${baseCurrency})` +
      `${group.normalizedPhone ? ' | Phone: ' + group.normalizedPhone : ' | No phone'}` +
      ` | Sources: ${sources.join(', ')}`
    );
    for (const row of group.rows) {
      const checkOut = parseCSVDate(row.checkOut);
      const isFuture = checkOut && checkOut > now;
      if (isFuture) futureBookings++;
      totalBookings++;
      console.log(
        `    - ${row.checkIn} to ${row.checkOut} (${row.nights}N, ${row.persons}P) = ${row.earning}` +
        ` [${row.source}]${isFuture ? ' [FUTURE → confirmed]' : ''}` +
        `${row.notes ? ' | Notes: ' + row.notes.substring(0, 50) : ''}`
      );
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Total bookings: ${totalBookings}`);
  console.log(`  Future bookings (→ confirmed): ${futureBookings}`);
  console.log(`  Past bookings (→ completed): ${totalBookings - futureBookings}`);
  console.log(`  Unique guests: ${guestGroups.length}`);
  console.log(`  Repeat guests: ${guestGroups.filter((g) => g.rows.length > 1).length}`);

  if (dryRun) {
    console.log(`\n[DRY RUN] No data written to Firestore.`);
    process.exit(0);
  }

  // --- Write to Firestore ---
  console.log(`\nWriting to Firestore...\n`);

  let bookingsCreated = 0;
  let guestsCreated = 0;
  let guestsUpdated = 0;

  for (const group of guestGroups) {
    // Sort rows chronologically
    group.rows.sort((a, b) => {
      const dateA = parseCSVDate(a.checkIn)?.getTime() || 0;
      const dateB = parseCSVDate(b.checkIn)?.getTime() || 0;
      return dateA - dateB;
    });

    let guestId: string | null = null;

    for (const row of group.rows) {
      const checkInDate = parseCSVDate(row.checkIn);
      const checkOutDate = parseCSVDate(row.checkOut);
      if (!checkInDate || !checkOutDate) {
        console.error(`  Skipping row with invalid dates: ${row.guestName} ${row.checkIn}-${row.checkOut}`);
        continue;
      }

      const { firstName, lastName } = parseName(row.guestName);
      const normalized = normalizePhone(row.contact);
      const earning = parseEarning(row.earning);
      const source = mapSource(row.source);
      const country = mapCountry(row.country);
      const isFuture = checkOutDate > now;
      const nights = row.nights || Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

      // Build booking document
      const bookingData: Record<string, unknown> = {
        propertyId: propertySlug,
        guestInfo: {
          firstName,
          ...(lastName && { lastName }),
          ...(normalized && { phone: normalized }),
          ...(country && { country }),
        },
        checkInDate: admin.firestore.Timestamp.fromDate(checkInDate),
        checkOutDate: admin.firestore.Timestamp.fromDate(checkOutDate),
        numberOfGuests: row.persons,
        ...(row.adults > 0 && { numberOfAdults: row.adults }),
        ...(row.children > 0 && { numberOfChildren: row.children }),
        pricing: {
          total: earning,
          currency: baseCurrency,
          baseRate: nights > 0 ? Math.round(earning / nights) : earning,
          numberOfNights: nights,
          cleaningFee: 0,
          accommodationTotal: earning,
          subtotal: earning,
        },
        paymentInfo: {
          status: 'succeeded',
          amount: earning,
        },
        status: isFuture ? 'confirmed' : 'completed',
        source,
        imported: true,
        createdAt: admin.firestore.Timestamp.fromDate(checkInDate),
        updatedAt: admin.firestore.Timestamp.fromDate(checkInDate),
      };

      // Add notes if present
      if (row.notes) {
        bookingData.notes = row.notes;
      }

      // Write booking
      const bookingRef = await db.collection('bookings').add(bookingData);
      bookingsCreated++;

      // Now upsert guest using the same layered dedup logic
      const bookingForGuest = {
        id: bookingRef.id,
        ...bookingData,
      };

      // Find existing guest by phone or email
      const guestsRef = db.collection('guests');
      let existingSnap: FirebaseFirestore.QuerySnapshot | null = null;

      if (normalized) {
        const snap = await guestsRef.where('normalizedPhone', '==', normalized).limit(1).get();
        if (!snap.empty) existingSnap = snap;
      }

      if (existingSnap) {
        // Update existing guest
        const guestDoc = existingSnap.docs[0];
        guestId = guestDoc.id;

        await guestDoc.ref.update({
          bookingIds: admin.firestore.FieldValue.arrayUnion(bookingRef.id),
          propertyIds: admin.firestore.FieldValue.arrayUnion(propertySlug),
          totalBookings: admin.firestore.FieldValue.increment(1),
          totalSpent: admin.firestore.FieldValue.increment(earning),
          lastBookingDate: admin.firestore.Timestamp.fromDate(checkInDate),
          ...(bookingData.status === 'completed' ? { lastStayDate: admin.firestore.Timestamp.fromDate(checkOutDate) } : {}),
          sources: admin.firestore.FieldValue.arrayUnion(source),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        guestsUpdated++;
      } else if (guestId) {
        // We already created a guest for this group in a previous iteration
        const guestRef = guestsRef.doc(guestId);
        await guestRef.update({
          bookingIds: admin.firestore.FieldValue.arrayUnion(bookingRef.id),
          propertyIds: admin.firestore.FieldValue.arrayUnion(propertySlug),
          totalBookings: admin.firestore.FieldValue.increment(1),
          totalSpent: admin.firestore.FieldValue.increment(earning),
          lastBookingDate: admin.firestore.Timestamp.fromDate(checkInDate),
          ...(bookingData.status === 'completed' ? { lastStayDate: admin.firestore.Timestamp.fromDate(checkOutDate) } : {}),
          sources: admin.firestore.FieldValue.arrayUnion(source),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        guestsUpdated++;
      } else {
        // Create new guest
        const newGuestData: Record<string, unknown> = {
          firstName,
          ...(lastName && { lastName }),
          ...(normalized && { phone: normalized, normalizedPhone: normalized }),
          language: 'ro', // Default Romanian for historical guests
          bookingIds: [bookingRef.id],
          propertyIds: [propertySlug],
          totalBookings: 1,
          totalSpent: earning,
          currency: baseCurrency,
          firstBookingDate: admin.firestore.Timestamp.fromDate(checkInDate),
          lastBookingDate: admin.firestore.Timestamp.fromDate(checkInDate),
          ...(bookingData.status === 'completed' ? { lastStayDate: admin.firestore.Timestamp.fromDate(checkOutDate) } : {}),
          reviewSubmitted: false,
          tags: [],
          sources: [source],
          unsubscribed: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // Special case: "!!! sa NU ii mai scriu" → do-not-contact
        if (row.notes && row.notes.includes('sa NU ii mai scriu')) {
          newGuestData.tags = ['do-not-contact'];
          newGuestData.unsubscribed = true;
          newGuestData.unsubscribedAt = admin.firestore.FieldValue.serverTimestamp();
        }

        const guestRef = await guestsRef.add(newGuestData);
        guestId = guestRef.id;
        guestsCreated++;
      }
    }

    // Check do-not-contact tag for existing guests (if the note is on a non-first booking)
    for (const row of group.rows) {
      if (row.notes && row.notes.includes('sa NU ii mai scriu') && guestId) {
        const guestRef = db.collection('guests').doc(guestId);
        const guestDoc = await guestRef.get();
        const guestData = guestDoc.data();
        if (guestData && !guestData.unsubscribed) {
          const currentTags = guestData.tags || [];
          if (!currentTags.includes('do-not-contact')) {
            await guestRef.update({
              tags: admin.firestore.FieldValue.arrayUnion('do-not-contact'),
              unsubscribed: true,
              unsubscribedAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }
      }
    }
  }

  console.log(`\nImport complete:`);
  console.log(`  Bookings created: ${bookingsCreated}`);
  console.log(`  Guests created: ${guestsCreated}`);
  console.log(`  Guest updates: ${guestsUpdated}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
