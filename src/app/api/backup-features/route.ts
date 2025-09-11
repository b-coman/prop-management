import { NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET() {
  try {
    // Get current features data
    const overridesRef = doc(db, 'propertyOverrides', 'prahova-mountain-chalet');
    const overridesSnap = await getDoc(overridesRef);
    
    if (!overridesSnap.exists()) {
      return NextResponse.json({ error: 'Property overrides not found' }, { status: 404 });
    }
    
    const data = overridesSnap.data();
    const currentFeatures = data.homepage?.features;
    
    if (!currentFeatures) {
      return NextResponse.json({ error: 'No features found' }, { status: 404 });
    }
    
    // Show current structure and proposed new structure
    const backup = {
      current: {
        structure: Array.isArray(currentFeatures) ? 'direct array' : 'object',
        data: currentFeatures
      },
      proposed: {
        title: {
          en: "Unique Features",
          ro: "Caracteristici Unice"
        },
        description: {
          en: "Discover what makes this chalet special",
          ro: "Descoperă ce face această cabană specială"
        },
        features: Array.isArray(currentFeatures) ? currentFeatures : (currentFeatures.features || [])
      }
    };
    
    return NextResponse.json(backup, { status: 200 });
  } catch (error) {
    console.error('Error backing up features:', error);
    return NextResponse.json({ 
      error: 'Failed to backup features',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}