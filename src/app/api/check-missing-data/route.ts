import { NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET() {
  try {
    const result: any = {
      testimonials: { configured: false, hasContent: false, content: null },
      gallery: { configured: false, hasContent: false, content: null },
      propertyImages: []
    };
    
    // Check template defaults
    const templateRef = doc(db, 'websiteTemplates', 'holiday-house');
    const templateSnap = await getDoc(templateRef);
    
    if (templateSnap.exists()) {
      const templateData = templateSnap.data();
      const defaults = templateData.defaults || {};
      
      if (defaults.testimonials) {
        result.testimonials.content = defaults.testimonials;
        result.testimonials.configured = true;
        result.testimonials.hasContent = !!(defaults.testimonials.reviews && defaults.testimonials.reviews.length > 0);
      }
      
      if (defaults.gallery) {
        result.gallery.content = defaults.gallery;
        result.gallery.configured = true;
        result.gallery.hasContent = !!(defaults.gallery.images && defaults.gallery.images.length > 0);
      }
    }
    
    // Check property overrides
    const overridesRef = doc(db, 'propertyOverrides', 'prahova-mountain-chalet');
    const overridesSnap = await getDoc(overridesRef);
    
    if (overridesSnap.exists()) {
      const overridesData = overridesSnap.data();
      
      // Check if testimonials exist in overrides
      if (overridesData.homepage?.testimonials) {
        result.testimonials.content = overridesData.homepage.testimonials;
        result.testimonials.configured = true;
        result.testimonials.hasContent = !!(
          overridesData.homepage.testimonials.reviews && 
          overridesData.homepage.testimonials.reviews.length > 0
        );
      }
      
      // Check if gallery exists in overrides
      if (overridesData.homepage?.gallery) {
        result.gallery.content = overridesData.homepage.gallery;
        result.gallery.configured = true;
        result.gallery.hasContent = !!(
          overridesData.homepage.gallery.images && 
          overridesData.homepage.gallery.images.length > 0
        );
      }
    }
    
    // Check property document for images
    const propertyRef = doc(db, 'properties', 'prahova-mountain-chalet');
    const propertySnap = await getDoc(propertyRef);
    
    if (propertySnap.exists()) {
      const propertyData = propertySnap.data();
      result.propertyImages = propertyData.images || [];
    }
    
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error checking missing data:', error);
    return NextResponse.json({ 
      error: 'Failed to check missing data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}