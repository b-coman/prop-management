import { NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET() {
  try {
    const result: any = {
      overrideBlocks: [],
      visibleBlocks: [],
      analysis: { 
        hasContentButNotVisible: [],
        visibleButNoContent: [],
        shouldDisplay: [],
        configured: 0,
        visible: 0
      }
    };
    
    // Fetch property overrides
    const overridesRef = doc(db, 'propertyOverrides', 'prahova-mountain-chalet');
    const overridesSnap = await getDoc(overridesRef);
    
    if (overridesSnap.exists()) {
      const overridesData = overridesSnap.data();
      const homepageData = overridesData.homepage || {};
      
      // Get visible blocks list
      result.visibleBlocks = overridesData.homepage?.visibleBlocks || [];
      result.analysis.visible = result.visibleBlocks.length;
      
      // Find all blocks that have content configured in homepage
      for (const [blockId, blockData] of Object.entries(homepageData)) {
        if (blockId !== 'visibleBlocks' && blockData && typeof blockData === 'object') {
          const blockInfo = {
            id: blockId,
            hasContent: true,
            isVisible: result.visibleBlocks.includes(blockId),
            contentPreview: {}
          };
          
          // Create content preview
          if (typeof blockData === 'object') {
            for (const [key, value] of Object.entries(blockData as any)) {
              if (key === 'title' || key === 'description') {
                blockInfo.contentPreview[key] = typeof value === 'object' ? 
                  `{en: "${(value as any)?.en?.substring(0, 30)}...", ro: "${(value as any)?.ro?.substring(0, 30)}..."}` :
                  `"${String(value).substring(0, 40)}..."`;
              } else if (key === 'highlights' || key === 'features' || key === 'reviews') {
                blockInfo.contentPreview[key] = `Array(${(value as any[])?.length || 0} items)`;
              } else if (key === 'backgroundImage' || key === 'imageUrl') {
                blockInfo.contentPreview[key] = String(value);
              }
            }
          }
          
          result.overrideBlocks.push(blockInfo);
          result.analysis.configured++;
          
          // Check if has content but not visible
          if (!blockInfo.isVisible) {
            result.analysis.hasContentButNotVisible.push({
              id: blockId,
              reason: 'Block has content in overrides but is not in visibleBlocks list'
            });
          } else {
            result.analysis.shouldDisplay.push(blockId);
          }
        }
      }
      
      // Check visible blocks that don't have content
      for (const blockId of result.visibleBlocks) {
        if (!result.overrideBlocks.find(b => b.id === blockId)) {
          result.analysis.visibleButNoContent.push({
            id: blockId,
            reason: 'Block is in visibleBlocks list but has no content in overrides (will try template defaults)'
          });
        }
      }
    }
    
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error checking all blocks:', error);
    return NextResponse.json({ 
      error: 'Failed to check all blocks',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}