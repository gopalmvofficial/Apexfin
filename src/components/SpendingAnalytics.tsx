'use client';

import React, { useState } from 'react';
import {
  PieChart,
  Target,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
  Check,
  Edit2,
  DollarSign,
} from 'lucide-react';
import { Category } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';

export interface BudgetCategoryItem {
  categoryId: string;
  categoryName: string;
  colorHex: string;
  iconName: string;
  isEssential: boolean;
  allocatedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  utilizationPct: number;
  isOverBudget: boolean;
}

interface SpendingAnalyticsProps {
  budgets: BudgetCategoryItem[];
  onUpdateBudget: (categoryId: string, allocated: number) => Promise<void>;
  currency?: string;
  monthYear?: string;
}

export function SpendingAnalytics({
  budgets,
  onUpdateBudget,
  currency = 'USD',
  monthYear = 'Current Month',
}: SpendingAnalyticsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const totalAllocated = budgets.reduce((sum, b) => sum + b.allocatedAmount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spentAmount, 0);
  const overallUtilization = totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0;

  // Essential vs Discretionary
  const essentialSpent = budgets
    .filter((b) => b.isEssential)
    .reduce((sum, b) => sum + b.spentAmount, 0);
  const discretionarySpent = budgets
    .filter((b) => !b.isEssential)
    .reduce((sum, b) => sum + b.spentAmount, 0);

  const startEdit = (b: BudgetCategoryItem) => {
    setEditingId(b.categoryId);
    setEditValue(String(b.allocatedAmount));
  };

  const handleSave = async (categoryId: string) => {
    const val = parseFloat(editValue);
    if (!isNaN(val) && val >= 0) {
      await onUpdateBudget(categoryId, val);
    }
    setEditingId(null);
  };

  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800/80">
      {/* Header and Summary Metric */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Monthly Spending & Budget Intelligence
                <span className="text-xs font-mono text-slate-400 font-normal">({monthYear})</span>
              </h3>
              <p className="text-xs text-slate-400">
                Track category expense utilization and essential versus discretionary burn ratios
              </p>
            </div>
          </div>
        </div>

        {/* Global Progress Pill */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] text-slate-400 block">Total Budget Utilized</span>
            <span className="font-mono font-bold text-sm text-slate-100 tabular-nums">
              {formatCurrency(totalSpent, currency)} / {formatCurrency(totalAllocated, currency)}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center font-mono font-bold text-xs text-emerald-400">
            {overallUtilization}%
          </div>
        </div>
      </div>

      {/* Distribution Ratio Bar (Essential vs Discretionary) */}
      <div className="mb-6 p-4 rounded-xl bg-slate-950/40 border border-slate-800/60">
        <div className="flex justify-between items-center text-xs mb-2">
          <span className="text-slate-400">Spending Mix Distribution</span>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Essential: {formatCurrency(essentialSpent, currency, 0)} ({totalSpent > 0 ? Math.round((essentialSpent / totalSpent) * 100) : 0}%)
            </span>
            <span className="text-purple-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              Discretionary: {formatCurrency(discretionarySpent, currency, 0)} ({totalSpent > 0 ? Math.round((discretionarySpent / totalSpent) * 100) : 0}%)
            </span>
          </div>
        </div>

        {/* Dual Progress Track */}
        <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden flex">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${totalSpent > 0 ? (essentialSpent / totalSpent) * 100 : 50}%` }}
          />
          <div
            className="h-full bg-purple-500 transition-all duration-500"
            style={{ width: `${totalSpent > 0 ? (discretionarySpent / totalSpent) * 100 : 50}%` }}
          />
        </div>
      </div>

      {/* Category Budgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {budgets.map((b) => {
          const isOver = b.isOverBudget;
          const pct = Math.min(100, b.utilizationPct);
          const isEditing = editingId === b.categoryId;

          return (
            <div
              key={b.categoryId}
              className={`p-4 rounded-xl border transition-all ${
                isOver
                  ? 'bg-rose-950/20 border-rose-800/40'
                  : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: b.colorHex }}
                  />
                  <span className="font-semibold text-slate-100 text-sm">{b.categoryName}</span>
                  {b.isEssential ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      Essential
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950/50 text-purple-300">
                      Lifestyle
                    </span>
                  )}
                </div>

                {/* Utilization Pill */}
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-mono font-semibold tabular-nums ${
                      isOver ? 'text-rose-400' : 'text-slate-300'
                    }`}
                  >
                    {b.utilizationPct}%
                  </span>
                  {isOver && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden mb-3">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: isOver ? '#ef4444' : b.colorHex,
                  }}
                />
              </div>

              {/* Spent / Budget Row */}
              <div className="flex items-center justify-between text-xs text-slate-400">
                <div>
                  <span>Spent: </span>
                  <span className="font-mono font-bold text-slate-200 tabular-nums">
                    {formatCurrency(b.spentAmount, currency)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">$</span>
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-16 px-1.5 py-0.5 text-xs bg-slate-950 border border-blue-500 rounded text-white font-mono"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSave(b.categoryId)}
                        className="p-1 rounded bg-blue-600 text-white hover:bg-blue-500"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span>Limit: </span>
                      <span className="font-mono text-slate-300 tabular-nums">
                        {formatCurrency(b.allocatedAmount, currency, 0)}
                      </span>
                      <button
                        onClick={() => startEdit(b)}
                        className="text-slate-500 hover:text-slate-300 transition"
                        title="Edit allocated budget"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
