import { NextResponse } from 'next/server';
import { getStore, saveStore } from '@/lib/store';
import { RecurringPayment } from '@/lib/types';
import { getDaysRemaining } from '@/lib/formatters';

export async function GET() {
  try {
    const store = getStore();
    const categoriesMap = new Map(store.categories.map((c) => [c.id, c]));

    const enriched = store.recurringPayments.map((item) => {
      const daysUntilDue = getDaysRemaining(item.nextDueDate);
      let status: 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' = 'UPCOMING';

      if (daysUntilDue < 0) {
        status = 'OVERDUE';
      } else if (daysUntilDue <= 7) {
        status = 'DUE_SOON';
      }

      return {
        ...item,
        category: categoriesMap.get(item.categoryId) || null,
        daysUntilDue,
        status,
      };
    });

    // Sort: overdue first, then due soon, then upcoming
    enriched.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    const totalMonthlyExpense = store.recurringPayments
      .filter((r) => r.isActive && r.type === 'expense')
      .reduce((sum, r) => sum + r.amount, 0);

    const totalMonthlyIncome = store.recurringPayments
      .filter((r) => r.isActive && r.type === 'income')
      .reduce((sum, r) => sum + r.amount, 0);

    return NextResponse.json({
      recurringPayments: enriched,
      summary: {
        totalMonthlyExpense,
        totalMonthlyIncome,
        activeCount: store.recurringPayments.filter((r) => r.isActive).length,
        dueSoonCount: enriched.filter((r) => r.isActive && r.status === 'DUE_SOON').length,
        overdueCount: enriched.filter((r) => r.isActive && r.status === 'OVERDUE').length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to retrieve recurring payments', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, categoryId, accountId, amount, type, frequency, dueDay, nextDueDate, autopay, notes } = body;

    if (!name || !categoryId || typeof amount !== 'number' || !type || !frequency || !dueDay || !nextDueDate) {
      return NextResponse.json(
        { error: 'Missing required recurring payment fields' },
        { status: 400 }
      );
    }

    const store = getStore();

    const newItem: RecurringPayment = {
      id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      categoryId,
      accountId,
      amount: Math.abs(amount),
      type,
      frequency,
      dueDay: Math.min(31, Math.max(1, parseInt(String(dueDay), 10))),
      nextDueDate,
      autopay: Boolean(autopay),
      isActive: true,
      notes: notes ? String(notes).trim() : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store.recurringPayments.push(newItem);
    saveStore(store);

    return NextResponse.json({ success: true, item: newItem }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create recurring payment', details: String(error) },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Recurring payment ID is required' }, { status: 400 });
    }

    const store = getStore();
    const target = store.recurringPayments.find((r) => r.id === id);

    if (!target) {
      return NextResponse.json({ error: 'Recurring payment not found' }, { status: 404 });
    }

    if (typeof updates.name === 'string') target.name = updates.name.trim();
    if (typeof updates.amount === 'number') target.amount = Math.abs(updates.amount);
    if (typeof updates.isActive === 'boolean') target.isActive = updates.isActive;
    if (typeof updates.autopay === 'boolean') target.autopay = updates.autopay;
    if (typeof updates.frequency === 'string') target.frequency = updates.frequency;
    if (typeof updates.dueDay === 'number') target.dueDay = updates.dueDay;
    if (typeof updates.nextDueDate === 'string') target.nextDueDate = updates.nextDueDate;
    if (typeof updates.categoryId === 'string') target.categoryId = updates.categoryId;
    if (typeof updates.notes === 'string') target.notes = updates.notes;

    target.updatedAt = new Date().toISOString();
    saveStore(store);

    return NextResponse.json({ success: true, item: target });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update recurring payment', details: String(error) },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const store = getStore();
    const index = store.recurringPayments.findIndex((r) => r.id === id);

    if (index === -1) {
      return NextResponse.json({ error: 'Recurring payment not found' }, { status: 404 });
    }

    store.recurringPayments.splice(index, 1);
    saveStore(store);

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete recurring payment', details: String(error) },
      { status: 500 }
    );
  }
}
