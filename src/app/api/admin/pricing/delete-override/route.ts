import { NextRequest, NextResponse } from 'next/server';
import { deleteDateOverride } from '@/app/admin/pricing/actions';
import { requirePropertyAccess, AuthorizationError } from '@/lib/authorization';
import { loggers } from '@/lib/logger';

const logger = loggers.adminPricing;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const propertyId = formData.get('propertyId') as string;

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'Property ID required' },
        { status: 400 }
      );
    }

    // Check authorization (the action also checks, but we want proper HTTP status codes)
    try {
      await requirePropertyAccess(propertyId);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        logger.warn('Authorization failed for delete-override', { error: error.message });
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 403 }
        );
      }
      throw error;
    }

    await deleteDateOverride(formData);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting date override', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete date override' },
      { status: 500 }
    );
  }
}
