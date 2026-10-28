import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { projectCashflow } from '@/lib/predictive-engine';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const horizonDays = Math.min(365, Math.max(7, parseInt(String(body.horizonDays || 90), 10)));
    const variableBurnMultiplier = typeof body.variableBurnMultiplier === 'number'
      ? Math.max(0, Math.min(3.0, body.variableBurnMultiplier))
      : 1.0;
    const scenario = body.scenario || undefined;

    const store = getStore();

    // Calculate current liquid balance across checking and savings
    const liquidBalance = store.accounts
      .filter((a) => a.type === 'checking' || a.type === 'savings')
      .reduce((sum, a) => sum + a.currentBalance, 0);

    const prediction = projectCashflow({
      startBalance: liquidBalance,
      safetyBuffer: store.user.safetyBuffer,
      recurringPayments: store.recurringPayments,
      transactions: store.transactions,
      categories: store.categories,
      horizonDays,
      variableBurnMultiplier,
      scenario,
    });

    return NextResponse.json(prediction);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to compute cashflow prediction', details: String(error) },
      { status: 500 }
    );
  }
}
