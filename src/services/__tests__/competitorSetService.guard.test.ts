/** @jest-environment node */

/**
 * Curation must never clobber verification.
 *
 * The two are separate writes and they share fields: a seed carries `units: []` and `rating: null`
 * as placeholders for an entry nobody has read yet. Merging those over an EXISTING document threw
 * real measurements away — twice. Re-seeding once to add a comparable reset all seven verified
 * capacities to unread, and an earlier form of the same bug would have written `verifiedAt: null`
 * over fourteen verified listings.
 *
 * Both were found by reading the data back after a write rather than by trusting the write. These
 * tests pin the rule so the next shared field does not have to be found the same way.
 */
import { VERIFICATION_OWNED_FIELDS } from '../competitorSetService';

describe('the verification-owned field list', () => {
  it('covers every field recordVerification writes', () => {
    // Kept in step by hand; if recordVerification learns a new field it must be added here, or a
    // re-seed will silently overwrite it.
    for (const f of ['units', 'rating', 'reviewCount', 'qualityAsOf',
                     'heroPhotoUrl', 'photoProvenance', 'distanceKm', 'verifiedAt', 'verifiedBy']) {
      expect(VERIFICATION_OWNED_FIELDS).toContain(f);
    }
  });

  it('does NOT include fields curation owns, or a re-seed could never correct them', () => {
    for (const f of ['displayName', 'url', 'channel', 'substitutionBasis', 'active',
                     'propertyType', 'amenities', 'sameAs', 'curatedBy']) {
      expect(VERIFICATION_OWNED_FIELDS).not.toContain(f);
    }
  });
});
