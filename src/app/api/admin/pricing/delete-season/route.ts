import { NextRequest, NextResponse } from 'next/server';
import { deleteSeasonalPricing } from '@/app/admin/pricing/actions';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    await deleteSeasonalPricing(formData);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting season:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete season' },
      { status: 500 }
    );
  }
}