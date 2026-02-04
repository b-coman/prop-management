import { NextRequest, NextResponse } from 'next/server';
import { deleteDateOverride } from '@/app/admin/pricing/actions';
import { loggers } from '@/lib/logger';

const logger = loggers.adminPricing;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
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