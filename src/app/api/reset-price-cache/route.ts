import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint to reset the pricing API cache from the client side
 * This can be useful for debugging or when caching issues occur
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { propertySlug } = body;
    
    // Return success - the actual cache reset will happen on the client
    // This endpoint just serves as a trigger point that can be called from admin tools
    return NextResponse.json({
      success: true,
      message: `Cache reset request received${propertySlug ? ` for property: ${propertySlug}` : ' for all properties'}`,
      property: propertySlug || 'all'
    });
  } catch (error) {
    console.error('Error resetting pricing cache:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to reset pricing cache'
      },
      { status: 200 } // Return 200 even on error to prevent retries
    );
  }
}