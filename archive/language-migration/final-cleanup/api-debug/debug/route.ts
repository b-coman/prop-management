import { NextRequest, NextResponse } from 'next/server';

/**
 * Simple debug endpoint to verify API routing is working correctly
 */
export async function GET(request: NextRequest) {
  try {
    console.log(`🛠️ DEBUG API endpoint called: ${request.url}`);
    
    return NextResponse.json({
      success: true,
      message: 'API endpoint is working correctly',
      timestamp: new Date().toISOString(),
      requestUrl: request.url
    });
    
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error in debug endpoint' },
      { status: 500 }
    );
  }
}