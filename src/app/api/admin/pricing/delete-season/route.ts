import { NextRequest, NextResponse } from 'next/server';
import { deleteSeasonalPricing } from '@/app/admin/pricing/actions';
import { loggers } from '@/lib/logger';

const logger = loggers.adminPricing;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    await deleteSeasonalPricing(formData);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting season', error as Error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete season' },
      { status: 500 }
    );
  }
}