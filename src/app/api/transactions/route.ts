import { NextResponse } from 'next/server';
import { getStore, saveStore } from '@/lib/store';
import { Transaction } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const category = searchParams.get('category') || '';
    const type = searchParams.get('type') || '';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);

    const store = getStore();
    let txs = [...store.transactions];

    if (search) {
      txs = txs.filter(
        (t) =>
          t.description.toLowerCase().includes(search) ||
          t.tags.some((tag) => tag.toLowerCase().includes(search))
      );
    }

    if (category) {
      txs = txs.filter((t) => t.categoryId === category);
    }

    if (type) {
      txs = txs.filter((t) => t.type === type);
    }

    // Sort by date descending
    txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalCount = txs.length;
    const startIndex = (page - 1) * limit;
    const paginated = txs.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      transactions: paginated,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to retrieve transactions', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accountId, categoryId, amount, type, description, date, tags, status } = body;

    if (!accountId || !categoryId || typeof amount !== 'number' || !type || !description || !date) {
      return NextResponse.json(
        { error: 'Missing required transaction fields' },
        { status: 400 }
      );
    }

    const store = getStore();

    const newTx: Transaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      accountId,
      categoryId,
      amount: Math.abs(amount),
      type,
      description: description.trim(),
      date,
      status: status || 'cleared',
      tags: Array.isArray(tags) ? tags : [],
      isRecurring: false,
      createdAt: new Date().toISOString(),
    };

    // Update account balance
    const targetAccount = store.accounts.find((a) => a.id === accountId);
    if (targetAccount) {
      if (type === 'income') {
        targetAccount.currentBalance += newTx.amount;
      } else {
        targetAccount.currentBalance -= newTx.amount;
      }
      targetAccount.updatedAt = new Date().toISOString();
    }

    store.transactions.unshift(newTx);
    saveStore(store);

    return NextResponse.json({ success: true, transaction: newTx }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create transaction', details: String(error) },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
    }

    const store = getStore();
    const index = store.transactions.findIndex((t) => t.id === id);

    if (index === -1) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const [deleted] = store.transactions.splice(index, 1);

    // Revert account balance impact
    const targetAccount = store.accounts.find((a) => a.id === deleted.accountId);
    if (targetAccount) {
      if (deleted.type === 'income') {
        targetAccount.currentBalance -= deleted.amount;
      } else {
        targetAccount.currentBalance += deleted.amount;
      }
      targetAccount.updatedAt = new Date().toISOString();
    }

    saveStore(store);

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete transaction', details: String(error) },
      { status: 500 }
    );
  }
}
