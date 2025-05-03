
// scripts/convertTimestamps.ts
import { Timestamp } from 'firebase/firestore';

/**
 * Checks if an object is a Firestore-like timestamp object.
 * @param obj - The object to check.
 * @returns True if the object has _seconds and _nanoseconds properties.
 */
function isFirestoreTimestampObject(obj: any): obj is { _seconds: number; _nanoseconds: number } {
  return typeof obj === 'object' && obj !== null &&
         typeof obj._seconds === 'number' &&
         typeof obj._nanoseconds === 'number';
}

/**
 * Recursively traverses an object or array and converts Firestore-like
 * timestamp objects ({ _seconds: ..., _nanoseconds: ... }) into
 * actual Firestore Timestamp instances.
 *
 * @param data - The data structure (object or array) to process.
 * @returns The processed data structure with Timestamps converted.
 */
export function convertObjectToFirestoreTimestamps(data: any): any {
  if (Array.isArray(data)) {
    // If it's an array, process each element
    return data.map(item => convertObjectToFirestoreTimestamps(item));
  } else if (typeof data === 'object' && data !== null) {
    // Check if the current object itself is a timestamp object
    if (isFirestoreTimestampObject(data)) {
      return new Timestamp(data._seconds, data._nanoseconds);
    }

    // If it's a regular object, process its properties
    const newData: { [key: string]: any } = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        newData[key] = convertObjectToFirestoreTimestamps(data[key]);
      }
    }
    return newData;
  } else {
    // If it's not an object or array, return it as is
    return data;
  }
}
