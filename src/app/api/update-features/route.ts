import { NextResponse } from 'next/server';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST() {
  try {
    // Get current document
    const overridesRef = doc(db, 'propertyOverrides', 'prahova-mountain-chalet');
    const overridesSnap = await getDoc(overridesRef);
    
    if (!overridesSnap.exists()) {
      return NextResponse.json({ error: 'Property overrides not found' }, { status: 404 });
    }
    
    const data = overridesSnap.data();
    const currentFeatures = data.homepage?.features;
    
    if (!currentFeatures || !Array.isArray(currentFeatures)) {
      return NextResponse.json({ error: 'Current features not found or invalid format' }, { status: 400 });
    }
    
    // Create new features structure
    const newFeaturesStructure = {
      title: {
        en: "Unique Features",
        ro: "Caracteristici Unice"
      },
      description: {
        en: "Discover what makes this chalet special",
        ro: "Descoperă ce face această cabană specială"
      },
      features: currentFeatures // Keep existing feature array
    };
    
    // Update the document
    await updateDoc(overridesRef, {
      'homepage.features': newFeaturesStructure
    });
    
    return NextResponse.json({ 
      success: true,
      message: 'Features updated successfully',
      oldStructure: 'direct array',
      newStructure: 'object with title, description, and features array',
      featuresCount: currentFeatures.length
    }, { status: 200 });
    
  } catch (error) {
    console.error('Error updating features:', error);
    return NextResponse.json({ 
      error: 'Failed to update features',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}