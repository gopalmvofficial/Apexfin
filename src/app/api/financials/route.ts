import { NextResponse } from 'next/server';
import { computeUserFinancials, getStore, saveStore } from '@/lib/store';

export async function GET() {
  try {
    const store = getStore();
    const metrics = computeUserFinancials(store);

    return NextResponse.json({
      metrics,
      user: store.user,
      accounts: store.accounts,
      categories: store.categories,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch financial metrics', details: String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const store = getStore();

    if (typeof body.safetyBuffer === 'number') {
      store.user.safetyBuffer = Math.max(0, body.safetyBuffer);
    }
    if (typeof body.currency === 'string') {
      store.user.currency = body.currency;
    }
    if (typeof body.name === 'string') {
      store.user.name = body.name;
    }

    saveStore(store);
    const metrics = computeUserFinancials(store);

    return NextResponse.json({
      success: true,
      user: store.user,
      metrics,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update financial settings', details: String(error) },
      { status: 400 }
    );
  }
}
