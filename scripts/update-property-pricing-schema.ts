import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Initialize Firebase Admin SDK
let db: admin.firestore.Firestore;

function initializeFirebaseAdmin() {
  // Check if already initialized
  if (admin.apps.length === 0) {
    try {
      // Try to use service account from environment
      if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH) {
        const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
        console.log(`Initializing Firebase Admin with service account from: ${serviceAccountPath}`);
        
        // Initialize with service account
        admin.initializeApp({
          credential: admin.credential.cert(path.resolve(serviceAccountPath))
        });
      } else {
        // Initialize with explicit config from env variables
        console.log('Initializing Firebase Admin with explicit configuration from env variables');
        
        // Use the client config values for admin SDK
        admin.initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        });
      }
      
      console.log('Firebase Admin SDK initialized successfully.');
    } catch (error) {
      console.error('Failed to initialize Firebase Admin SDK:', error);
      throw error;
    }
  } else {
    console.log('Firebase Admin SDK already initialized');
  }
  
  // Get Firestore instance
  db = admin.firestore();
  return db;
}

/**
 * This script updates existing properties with the new pricing configuration fields
 * It preserves all existing pricing data while adding the new structure
 */
async function updatePropertyPricingSchema() {
  try {
    console.log('Starting property schema update for pricing...');

    // Initialize Firebase if needed
    if (!db) {
      db = initializeFirebaseAdmin();
    }

    // Get all properties
    const propertiesSnapshot = await db.collection('properties').get();
    console.log(`Found ${propertiesSnapshot.size} properties to update`);

    const updatePromises = propertiesSnapshot.docs.map(async (doc) => {
      const property = doc.data();

      // Skip if property already has the new schema
      if (property.pricingConfig) {
        console.log(`Property ${property.id} already has pricingConfig, skipping`);
        return;
      }

      // Create default pricing config based on existing data
      const pricingConfig = {
        weekendAdjustment: 1.2, // Default 20% increase for weekends
        weekendDays: ['friday', 'saturday'], // Default weekend days
        lengthOfStayDiscounts: [
          {
            nightsThreshold: 7,
            discountPercentage: 5,
            enabled: true
          },
          {
            nightsThreshold: 14,
            discountPercentage: 10,
            enabled: true
          }
        ]
      };

      // Update the property
      await doc.ref.update({
        pricingConfig,
        updatedAt: Timestamp.now()
      });

      console.log(`Updated property ${property.id} with pricing configuration`);
    });

    await Promise.all(updatePromises);
    console.log('Property schema update completed successfully');

  } catch (error) {
    console.error('Error updating property schema:', error);
  }
}

// Create the collections needed for the new pricing system
async function createPricingCollections() {
  try {
    console.log('Creating pricing collections...');

    // Initialize Firebase if needed
    if (!db) {
      db = initializeFirebaseAdmin();
    }

    // Check if collections exist by trying to get a document
    const collections = [
      'seasonalPricing',
      'dateOverrides',
      'minimumStayRules',
      'holidays',
      'pricingTemplates',
      'priceCalendar'
    ];

    for (const collectionName of collections) {
      // We don't need to actually create the collection in Firestore
      // Collections are created automatically when the first document is added
      // But we'll log the creation for tracking purposes
      console.log(`Collection '${collectionName}' is ready`);
    }

    // Create sample pricing template
    const templateId = 'default';
    const templateRef = db.collection('pricingTemplates').doc(templateId);
    const templateDoc = await templateRef.get();

    if (!templateDoc.exists) {
      await templateRef.set({
        id: templateId,
        name: 'Default Pricing Template',
        description: 'Standard template with common seasonal pricing',
        defaultPricing: {
          weekendAdjustment: 1.2,
          weekendDays: ['friday', 'saturday']
        },
        seasons: [
          {
            name: 'Winter High Season',
            seasonType: 'high',
            startMonth: 12,
            startDay: 15,
            endMonth: 3,
            endDay: 15,
            priceMultiplier: 1.5,
            minimumStay: 3
          },
          {
            name: 'Summer Season',
            seasonType: 'medium',
            startMonth: 6,
            startDay: 1,
            endMonth: 8,
            endDay: 31,
            priceMultiplier: 1.3,
            minimumStay: 2
          },
          {
            name: 'Low Season',
            seasonType: 'low',
            startMonth: 10,
            startDay: 1,
            endMonth: 11,
            endDay: 30,
            priceMultiplier: 0.8,
            minimumStay: 1
          }
        ],
        suggestedLengthOfStayDiscounts: [
          {
            nightsThreshold: 7,
            discountPercentage: 5
          },
          {
            nightsThreshold: 14,
            discountPercentage: 10
          }
        ],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      console.log('Created default pricing template');
    } else {
      console.log('Default pricing template already exists');
    }

    console.log('Pricing collections setup completed');

  } catch (error) {
    console.error('Error creating pricing collections:', error);
  }
}

// Run both functions
async function main() {
  try {
    // Initialize Firebase Admin first
    db = initializeFirebaseAdmin();

    await createPricingCollections();
    await updatePropertyPricingSchema();
    console.log('Schema update completed');
  } catch (error) {
    console.error('Error in main execution:', error);
  }
}

// Check if being run directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

export { updatePropertyPricingSchema, createPricingCollections };