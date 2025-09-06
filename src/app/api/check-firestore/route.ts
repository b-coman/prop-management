import { NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET() {
  try {
    const result: any = {
      propertyOverrides: null,
      properties: null
    };
    
    // Fetch propertyOverrides document
    const overridesRef = doc(db, 'propertyOverrides', 'prahova-mountain-chalet');
    const overridesSnap = await getDoc(overridesRef);
    
    if (overridesSnap.exists()) {
      const data = overridesSnap.data();
      result.propertyOverrides = {
        hero: {
          title: data.homepage?.hero?.title,
          subtitle: data.homepage?.hero?.subtitle,
        },
        experience: {
          title: data.homepage?.experience?.title,
          description: data.homepage?.experience?.description,
          highlights: data.homepage?.experience?.highlights?.map((h: any) => ({
            title: h.title,
            description: h.description
          }))
        },
        host: {
          description: data.homepage?.host?.description,
          backstory: data.homepage?.host?.backstory,
          backstoryType: typeof data.homepage?.host?.backstory
        },
        features: data.homepage?.features?.map((f: any) => ({
          title: f.title,
          description: f.description
        })),
        location: {
          title: data.homepage?.location?.title
        },
        cta: {
          title: data.homepage?.cta?.title,
          description: data.homepage?.cta?.description,
          buttonText: data.homepage?.cta?.buttonText
        }
      };
    }
    
    // Fetch properties document
    const propertyRef = doc(db, 'properties', 'prahova-mountain-chalet');
    const propertySnap = await getDoc(propertyRef);
    
    if (propertySnap.exists()) {
      const data = propertySnap.data();
      result.properties = {
        name: data.name,
        nameType: typeof data.name,
        description: data.description,
        descriptionType: typeof data.description,
        shortDescription: data.shortDescription,
        shortDescriptionType: typeof data.shortDescription
      };
    }
    
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error fetching Firestore data:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch Firestore data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}