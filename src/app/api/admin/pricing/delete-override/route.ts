import { NextRequest, NextResponse } from 'next/server';
import { deleteDateOverride } from '@/app/admin/pricing/actions';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    await deleteDateOverride(formData);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting date override:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete date override' },
      { status: 500 }
    );
  }
}