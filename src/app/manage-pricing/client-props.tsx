'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface Property {
  id: string;
  name: string;
  location: string;
  status: string;
}

export function useProperties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticInfo, setDiagnosticInfo] = useState<any>({});

  useEffect(() => {
    const fetchProperties = async () => {
      const debug: any = {
        timestamp: new Date().toISOString(),
        steps: [],
        errors: []
      };

      try {
        debug.steps.push('Start fetching properties');
        console.log('🔍 [useProperties] Fetching properties...');

        if (!db) {
          const errorMsg = 'Firebase db is not initialized';
          debug.errors.push(errorMsg);
          console.error('❌ [useProperties]', errorMsg);
          setError('Firebase database is not initialized. Check your Firebase configuration.');
          setLoading(false);
          setDiagnosticInfo(debug);
          return;
        }

        // Check db type and configuration
        debug.firebaseConfig = {
          dbType: typeof db,
          hasFirestore: !!db,
          collections: ['properties'] // collections we expect to find
        };

        console.log('✅ [useProperties] Firebase DB initialized:', {
          dbType: typeof db,
          isNull: db === null,
          isObject: typeof db === 'object'
        });
        debug.steps.push('Firebase DB initialized');

        try {
          // Try to fetch from Firestore
          debug.steps.push('Creating properties collection reference');
          console.log('🔍 [useProperties] Creating Firestore collection reference');
          const propertiesCollection = collection(db, 'properties');

          console.log('🔍 [useProperties] Querying properties collection...');
          debug.steps.push('Executing Firestore query');

          // Track query start time for performance diagnostics
          const queryStartTime = performance.now();
          const snapshot = await getDocs(propertiesCollection);
          const queryEndTime = performance.now();

          debug.performance = {
            queryTime: `${(queryEndTime - queryStartTime).toFixed(2)}ms`
          };

          console.log(`✅ [useProperties] Query completed in ${(queryEndTime - queryStartTime).toFixed(2)}ms, documents count:`, snapshot.size);
          debug.steps.push(`Query completed, found ${snapshot.size} documents`);
          debug.queryResults = { count: snapshot.size };

          if (snapshot.empty) {
            debug.steps.push('Collection is empty');
            console.log('⚠️ [useProperties] No properties found in Firestore - collection is empty');

            // Create a temporary property for testing if none exist
            const tempProperty = {
              id: 'prahova-mountain-chalet',
              name: 'Prahova Mountain Chalet [Temp]',
              location: 'Comarnic, Romania',
              status: 'active'
            };
            console.log('ℹ️ [useProperties] Setting temporary property for testing:', tempProperty);
            debug.steps.push('Setting temporary property due to empty collection');
            setProperties([tempProperty]);
            setError('No properties found in database. Using a temporary property for testing.');
            setLoading(false);
            setDiagnosticInfo(debug);
            return;
          }

          // Process documents
          debug.steps.push('Processing documents');
          const docIds = snapshot.docs.map(doc => doc.id);
          console.log('🔍 [useProperties] Processing documents with IDs:', docIds);

          const fetchedProperties = snapshot.docs.map(doc => {
            const data = doc.data();

            // Handle complex location object or string
            let locationStr = '';
            if (data.location) {
              if (typeof data.location === 'string') {
                locationStr = data.location;
              } else if (data.location.city) {
                locationStr = `${data.location.city}${data.location.country ? ', ' + data.location.country : ''}`;
              }
            }

            return {
              id: doc.id,
              name: data.name || doc.id,
              location: locationStr,
              status: data.status || 'active'
            };
          });

          debug.processedResults = { count: fetchedProperties.length };

          if (fetchedProperties.length > 0) {
            console.log(`✅ [useProperties] Found and processed ${fetchedProperties.length} properties in Firestore`);
            debug.steps.push(`Successfully processed ${fetchedProperties.length} properties`);
            setProperties(fetchedProperties);
          } else {
            console.log('⚠️ [useProperties] No valid properties found after processing');
            debug.steps.push('No valid properties after processing');
            setProperties([]);
            setError('No valid properties found');
          }
        } catch (firestoreErr: any) {
          // Detailed Firestore error logging
          const errorDetails = {
            message: firestoreErr.message,
            code: firestoreErr.code,
            name: firestoreErr.name,
            stack: firestoreErr.stack
          };

          debug.errors.push(errorDetails);
          console.error('❌ [useProperties] Firestore query error:', errorDetails);

          // Use a temporary property if Firestore query fails
          const tempProperty = {
            id: 'prahova-mountain-chalet',
            name: 'Prahova Mountain Chalet [Error Fallback]',
            location: 'Comarnic, Romania',
            status: 'active'
          };
          console.log('ℹ️ [useProperties] Setting temporary fallback property due to error');
          debug.steps.push('Setting fallback property due to Firestore error');
          setProperties([tempProperty]);
          setError(`Firestore error: ${firestoreErr.message || 'Unknown error'}`);
        }
      } catch (err: any) {
        // General error handling
        const errorDetails = {
          message: err.message,
          name: err.name,
          stack: err.stack
        };

        debug.errors.push(errorDetails);
        console.error('❌ [useProperties] Error in fetchProperties:', errorDetails);
        setError(`Failed to load properties: ${err.message || 'Unknown error'}`);
        setProperties([]);
      } finally {
        debug.steps.push('Fetch operation completed');
        setLoading(false);
        setDiagnosticInfo(debug);

        // Log complete diagnostic info
        console.log('📊 [useProperties] Diagnostic info:', debug);
      }
    };

    fetchProperties();
  }, []);

  return { properties, loading, error, diagnosticInfo };
}