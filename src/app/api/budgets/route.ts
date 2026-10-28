import { NextResponse } from 'next/server';
import { getStore, saveStore } from '@/lib/store';
import { Budget } from '@/lib/types';

export async function GET() {
  try {
    const store = getStore();
    const now = new Date();
    const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Expense transactions for current month
    const currentMonthTxs = store.transactions.filter((tx) => {
      if (tx.type !== 'expense') return false;
      return tx.date.startsWith(currentMonthYear);
    });

    const spendingByCategory = new Map<string, number>();
    for (const tx of currentMonthTxs) {
      spendingByCategory.set(
        tx.categoryId,
        (spendingByCategory.get(tx.categoryId) || 0) + tx.amount
      );
    }

    const budgets = store.categories
      .filter((c) => c.type === 'expense')
      .map((cat) => {
        const customBudget = store.budgets.find(
          (b) => b.categoryId === cat.id && b.monthYear === currentMonthYear
        );

        const allocated = customBudget ? customBudget.allocatedAmount : cat.defaultBudget;
        const spent = spendingByCategory.get(cat.id) || 0;
        const remaining = allocated - spent;
        const utilizationPct = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;

        return {
          categoryId: cat.id,
          categoryName: cat.name,
          colorHex: cat.colorHex,
          iconName: cat.iconName,
          isEssential: cat.isEssential,
          allocatedAmount: allocated,
          spentAmount: Math.round(spent * 100) / 100,
          remainingAmount: Math.round(remaining * 100) / 100,
          utilizationPct,
          isOverBudget: spent > allocated,
        };
      });

    // Sort by allocated amount descending
    budgets.sort((a, b) => b.allocatedAmount - a.allocatedAmount);

    const totalAllocated = budgets.reduce((sum, b) => sum + b.allocatedAmount, 0);
    const totalSpent = budgets.reduce((sum, b) => sum + b.spentAmount, 0);

    return NextResponse.json({
      monthYear: currentMonthYear,
      budgets,
      summary: {
        totalAllocated: Math.round(totalAllocated * 100) / 100,
        totalSpent: Math.round(totalSpent * 100) / 100,
        totalRemaining: Math.round((totalAllocated - totalSpent) * 100) / 100,
        overallUtilizationPct: totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to retrieve budgets', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { categoryId, allocatedAmount, monthYear } = body;

    if (!categoryId || typeof allocatedAmount !== 'number') {
      return NextResponse.json({ error: 'Invalid budget parameters' }, { status: 400 });
    }

    const store = getStore();
    const now = new Date();
    const currentMonthYear = monthYear || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const existingIndex = store.budgets.findIndex(
      (b) => b.categoryId === categoryId && b.monthYear === currentMonthYear
    );

    if (existingIndex >= 0) {
      store.budgets[existingIndex].allocatedAmount = Math.max(0, allocatedAmount);
    } else {
      const newBudget: Budget = {
        id: `b-${Date.now()}`,
        categoryId,
        period: 'monthly',
        allocatedAmount: Math.max(0, allocatedAmount),
        monthYear: currentMonthYear,
      };
      store.budgets.push(newBudget);
    }

    saveStore(store);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save budget', details: String(error) },
      { status: 400 }
    );
  }
}
