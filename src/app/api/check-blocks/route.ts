import { NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { loggers } from '@/lib/logger';

const logger = loggers.admin;

export async function GET() {
  try {
    const result: any = {
      template: { blocks: [] },
      overrides: { visibleBlocks: [], hasContent: {} },
      analysis: { shouldRender: [], missingContent: [] }
    };
    
    // Fetch template configuration
    const templateRef = doc(db, 'websiteTemplates', 'holiday-house');
    const templateSnap = await getDoc(templateRef);
    
    if (templateSnap.exists()) {
      const templateData = templateSnap.data();
      result.template.blocks = templateData.pages?.homepage?.blocks || [];
    }
    
    // Fetch property overrides
    const overridesRef = doc(db, 'propertyOverrides', 'prahova-mountain-chalet');
    const overridesSnap = await getDoc(overridesRef);
    
    if (overridesSnap.exists()) {
      const overridesData = overridesSnap.data();
      result.overrides.visibleBlocks = overridesData.homepage?.visibleBlocks || [];
      
      // Check which blocks have content
      const homepageData = overridesData.homepage || {};
      for (const key of Object.keys(homepageData)) {
        if (key !== 'visibleBlocks') {
          result.overrides.hasContent[key] = {
            hasData: !!homepageData[key],
            dataType: typeof homepageData[key],
            preview: homepageData[key] ? 
              (typeof homepageData[key] === 'object' ? 
                Object.keys(homepageData[key]).slice(0, 3) : 
                'primitive value') : 
              'no data'
          };
        }
      }
    }
    
    // Analyze what should render
    result.template.blocks.forEach((block: any) => {
      const blockId = block.id;
      const isVisible = result.overrides.visibleBlocks.includes(blockId);
      const hasContent = !!result.overrides.hasContent[blockId];
      
      result.analysis.shouldRender.push({
        id: blockId,
        type: block.type,
        inTemplate: true,
        inVisibleList: isVisible,
        hasContent: hasContent,
        willRender: isVisible && (hasContent || block.type === 'gallery' || block.type === 'testimonials')
      });
      
      if (isVisible && !hasContent) {
        result.analysis.missingContent.push({
          id: blockId,
          type: block.type,
          reason: 'Block is visible but has no content in overrides'
        });
      }
    });
    
    // Check for additional blocks in overrides not in template
    result.overrides.visibleBlocks.forEach((blockId: string) => {
      if (!result.template.blocks.find((b: any) => b.id === blockId)) {
        result.analysis.shouldRender.push({
          id: blockId,
          type: 'unknown',
          inTemplate: false,
          inVisibleList: true,
          hasContent: !!result.overrides.hasContent[blockId],
          willRender: false,
          note: 'Block in visible list but not in template'
        });
      }
    });
    
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logger.error('Error checking blocks', error as Error);
    return NextResponse.json({ 
      error: 'Failed to check blocks',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}