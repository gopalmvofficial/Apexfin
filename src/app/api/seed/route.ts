import { NextResponse } from 'next/server';
import { getStore, resetStoreToDefaults, saveStore } from '@/lib/store';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'reset';

    if (action === 'reset') {
      const restored = resetStoreToDefaults();
      return NextResponse.json({ success: true, message: 'Restored sample financial dataset', data: restored });
    }

    if (action === 'import') {
      const body = await request.json();
      if (!body.accounts || !body.recurringPayments || !body.transactions) {
        return NextResponse.json({ error: 'Invalid financial data format' }, { status: 400 });
      }
      saveStore(body);
      return NextResponse.json({ success: true, message: 'Data imported successfully' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Seed operation failed', details: String(error) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const store = getStore();
    return NextResponse.json(store);
  } catch (error) {
    return NextResponse.json({ error: 'Export failed', details: String(error) }, { status: 500 });
  }
}
