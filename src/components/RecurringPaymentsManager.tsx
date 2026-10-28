'use client';

import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Check,
  CreditCard,
  Shield,
  Zap,
  Repeat,
} from 'lucide-react';
import { Category, RecurringPayment } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/formatters';

interface RecurringItemEnriched extends RecurringPayment {
  category?: Category | null;
  daysUntilDue: number;
  status: 'OVERDUE' | 'DUE_SOON' | 'UPCOMING';
}

interface RecurringPaymentsManagerProps {
  recurringPayments: RecurringItemEnriched[];
  categories: Category[];
  onToggleActive: (id: string, currentActive: boolean) => Promise<void>;
  onToggleAutopay: (id: string, currentAutopay: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onOpenAddModal: () => void;
  currency?: string;
}

export function RecurringPaymentsManager({
  recurringPayments,
  categories,
  onToggleActive,
  onToggleAutopay,
  onDelete,
  onOpenAddModal,
  currency = 'USD',
}: RecurringPaymentsManagerProps) {
  const [filter, setFilter] = useState<'all' | 'expense' | 'income' | 'due_soon'>('all');

  const filteredItems = recurringPayments.filter((item) => {
    if (filter === 'expense') return item.type === 'expense';
    if (filter === 'income') return item.type === 'income';
    if (filter === 'due_soon') return item.daysUntilDue <= 7;
    return true;
  });

  const totalMonthlyExpenses = recurringPayments
    .filter((r) => r.isActive && r.type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);

  const dueSoonCount = recurringPayments.filter(
    (r) => r.isActive && (r.status === 'DUE_SOON' || r.status === 'OVERDUE')
  ).length;

  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800/80">
      {/* Header and Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Monthly Payments & Subscriptions
                {dueSoonCount > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {dueSoonCount} Due Soon
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Track fixed monthly recurring commitments, autopay schedules, and upcoming payment deadlines
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Filter Pills */}
          <div className="flex items-center bg-slate-900/90 rounded-lg p-1 border border-slate-800 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                filter === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({recurringPayments.length})
            </button>
            <button
              onClick={() => setFilter('expense')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                filter === 'expense'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Bills
            </button>
            <button
              onClick={() => setFilter('due_soon')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                filter === 'due_soon'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Due &lt;7d
            </button>
            <button
              onClick={() => setFilter('income')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                filter === 'income'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Inflow
            </button>
          </div>

          {/* Add New Button */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Bill</span>
          </button>
        </div>
      </div>

      {/* Grid of Recurring Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredItems.map((item) => {
          const isOverdue = item.status === 'OVERDUE';
          const isDueSoon = item.status === 'DUE_SOON';

          return (
            <div
              key={item.id}
              className={`p-4 rounded-xl border transition-all relative flex flex-col justify-between ${
                !item.isActive
                  ? 'bg-slate-950/40 border-slate-900 opacity-60'
                  : isOverdue
                  ? 'bg-rose-950/20 border-rose-800/40'
                  : isDueSoon
                  ? 'bg-amber-950/20 border-amber-800/40'
                  : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Top Row: Name and Due Badge */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-semibold text-slate-100 text-sm truncate" title={item.name}>
                    {item.name}
                  </div>
                  <div>
                    {isOverdue && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        <AlertCircle className="w-3 h-3" /> Overdue
                      </span>
                    )}
                    {!isOverdue && isDueSoon && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                        <Clock className="w-3 h-3" /> Due in {item.daysUntilDue}d
                      </span>
                    )}
                    {!isOverdue && !isDueSoon && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-slate-400 bg-slate-800/60 border border-slate-700/50 font-mono">
                        {item.daysUntilDue}d left
                      </span>
                    )}
                  </div>
                </div>

                {/* Amount and Frequency */}
                <div className="flex items-baseline gap-2 mb-3">
                  <span
                    className={`text-xl font-bold font-mono tabular-nums ${
                      item.type === 'income' ? 'text-emerald-400' : 'text-slate-100'
                    }`}
                  >
                    {item.type === 'income' ? '+' : '-'}
                    {formatCurrency(item.amount, currency)}
                  </span>
                  <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">
                    / {item.frequency}
                  </span>
                </div>

                {/* Details Bar: Category & Due Date */}
                <div className="flex items-center justify-between text-xs text-slate-400 pb-3 border-b border-slate-800/60 mb-3">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium"
                    style={{
                      backgroundColor: `${item.category?.colorHex || '#6366f1'}15`,
                      color: item.category?.colorHex || '#a5b4fc',
                    }}
                  >
                    {item.category?.name || 'General'}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    Due {formatDate(item.nextDueDate)}
                  </span>
                </div>
              </div>

              {/* Bottom Controls: Autopay, Active Toggle, Delete */}
              <div className="flex items-center justify-between pt-1 text-xs">
                {/* Autopay Pill */}
                <button
                  onClick={() => onToggleAutopay(item.id, item.autopay)}
                  title="Toggle Autopay status"
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition ${
                    item.autopay
                      ? 'bg-blue-950/40 text-blue-300 border border-blue-800/50 hover:bg-blue-900/50'
                      : 'bg-slate-800/50 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CreditCard className="w-3 h-3" />
                  <span>{item.autopay ? 'Autopay ON' : 'Manual'}</span>
                </button>

                <div className="flex items-center gap-2">
                  {/* Pause / Resume Toggle */}
                  <button
                    onClick={() => onToggleActive(item.id, item.isActive)}
                    title={item.isActive ? 'Pause commitment' : 'Resume commitment'}
                    className={`text-[11px] px-2 py-1 rounded border transition ${
                      item.isActive
                        ? 'border-emerald-800/40 text-emerald-400 hover:bg-emerald-950/40'
                        : 'border-slate-800 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {item.isActive ? 'Active' : 'Paused'}
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => {
                      if (confirm(`Delete recurring bill "${item.name}"?`)) {
                        onDelete(item.id);
                      }
                    }}
                    title="Delete recurring payment"
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="col-span-full py-8 text-center text-slate-500 text-xs">
            No recurring commitments found under the selected filter.
          </div>
        )}
      </div>
    </div>
  );
}
