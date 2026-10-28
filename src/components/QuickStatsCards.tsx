'use client';

import React from 'react';
import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Flame,
  PiggyBank,
  CheckCircle2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { UserFinancials } from '@/lib/types';

interface QuickStatsCardsProps {
  metrics: UserFinancials | null;
}

export function QuickStatsCards({ metrics }: QuickStatsCardsProps) {
  if (!metrics) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-28 rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse"
          />
        ))}
      </div>
    );
  }

  const currency = metrics.currency || 'USD';
  const isSavingsPositive = metrics.monthlyNetSavings >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* 1. Liquid Cash Balance */}
      <div className="glass-panel rounded-xl p-4 flex flex-col justify-between relative overflow-hidden group">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Liquid Cash</span>
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
            <Wallet className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-white tabular-nums font-mono tracking-tight">
            {formatCurrency(metrics.liquidBalance, currency)}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
            <span>Net Worth</span>
            <span className="text-slate-300 font-mono tabular-nums font-semibold">
              {formatCurrency(metrics.netWorth, currency, 0)}
            </span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500/40" />
      </div>

      {/* 2. Monthly Income */}
      <div className="glass-panel rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Monthly Income</span>
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-emerald-400 tabular-nums font-mono tracking-tight">
            +{formatCurrency(metrics.monthlyIncome, currency)}
          </div>
          <p className="text-xs text-slate-400 mt-1">Salary & regular inflows</p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-500/40" />
      </div>

      {/* 3. Fixed Monthly Commitments */}
      <div className="glass-panel rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Fixed Monthly Bills</span>
          <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
            <ArrowDownRight className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-rose-400 tabular-nums font-mono tracking-tight">
            -{formatCurrency(metrics.monthlyFixedExpenses, currency)}
          </div>
          <p className="text-xs text-slate-400 mt-1">Rent, insurance & subscriptions</p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-rose-500/40" />
      </div>

      {/* 4. Variable Spend Burn */}
      <div className="glass-panel rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Est. Variable Burn</span>
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
            <Flame className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold text-amber-400 tabular-nums font-mono tracking-tight">
            ~{formatCurrency(metrics.monthlyVariableEstimated, currency)}
          </div>
          <p className="text-xs text-slate-400 mt-1">Groceries, dining, transit & misc</p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-500/40" />
      </div>

      {/* 5. Net Monthly Savings */}
      <div className="glass-panel rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-medium uppercase tracking-wider">Net Monthly Savings</span>
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
            <PiggyBank className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div
            className={`text-2xl font-bold tabular-nums font-mono tracking-tight ${
              isSavingsPositive ? 'text-indigo-400' : 'text-rose-400'
            }`}
          >
            {isSavingsPositive ? '+' : ''}
            {formatCurrency(metrics.monthlyNetSavings, currency)}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Savings rate: <strong className="text-slate-200">{metrics.savingsRatePct}%</strong></span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500/40" />
      </div>
    </div>
  );
}
