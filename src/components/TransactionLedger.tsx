'use client';

import React, { useState } from 'react';
import {
  Search,
  Filter,
  Plus,
  Trash2,
  Calendar,
  Tag,
  ArrowDownRight,
  ArrowUpRight,
  Receipt,
} from 'lucide-react';
import { Account, Category, Transaction } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/formatters';

interface TransactionLedgerProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  onDeleteTransaction: (id: string) => Promise<void>;
  onOpenAddModal: () => void;
  currency?: string;
}

export function TransactionLedger({
  transactions,
  categories,
  accounts,
  onDeleteTransaction,
  onOpenAddModal,
  currency = 'USD',
}: TransactionLedgerProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'expense' | 'income'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  const filtered = transactions.filter((tx) => {
    if (selectedType !== 'all' && tx.type !== selectedType) return false;
    if (selectedCategory !== 'all' && tx.categoryId !== selectedCategory) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const descMatch = tx.description.toLowerCase().includes(q);
      const tagMatch = tx.tags.some((t) => t.toLowerCase().includes(q));
      if (!descMatch && !tagMatch) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="glass-panel rounded-2xl p-6 border border-slate-800/80">
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Transaction Ledger & Spendings
                <span className="text-xs text-slate-400 font-normal font-mono">
                  ({filtered.length} entries)
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Reconciled debit and credit activity with categorized tags
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Live Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search description, tags..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-blue-500 w-48 sm:w-56"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="py-1.5 px-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300 focus:outline-hidden focus:border-blue-500"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <div className="flex items-center bg-slate-900/90 rounded-lg p-1 border border-slate-800 text-xs">
            <button
              onClick={() => {
                setSelectedType('all');
                setPage(1);
              }}
              className={`px-2 py-1 rounded text-xs font-medium transition ${
                selectedType === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => {
                setSelectedType('expense');
                setPage(1);
              }}
              className={`px-2 py-1 rounded text-xs font-medium transition ${
                selectedType === 'expense' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Expenses
            </button>
            <button
              onClick={() => {
                setSelectedType('income');
                setPage(1);
              }}
              className={`px-2 py-1 rounded text-xs font-medium transition ${
                selectedType === 'income' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Income
            </button>
          </div>

          {/* New Transaction Button */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Table Ledger */}
      <div className="overflow-x-auto rounded-xl border border-slate-800/80">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-medium">
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4 hidden md:table-cell">Account</th>
              <th className="py-3 px-4 text-right">Amount</th>
              <th className="py-3 px-4 text-center w-12">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {paginated.map((tx) => {
              const cat = categoryMap.get(tx.categoryId);
              const acc = accountMap.get(tx.accountId);
              const isIncome = tx.type === 'income';

              return (
                <tr key={tx.id} className="hover:bg-slate-900/40 transition">
                  {/* Date */}
                  <td className="py-3 px-4 text-slate-400 font-mono whitespace-nowrap">
                    {formatDate(tx.date)}
                  </td>

                  {/* Description & Tags */}
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-100 flex items-center gap-2">
                      <span>{tx.description}</span>
                      {tx.isRecurring && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-normal">
                          Recurring
                        </span>
                      )}
                    </div>
                    {tx.tags && tx.tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        {tx.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] text-slate-400 px-1.5 py-0.2 rounded bg-slate-800/60"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Category */}
                  <td className="py-3 px-4">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium"
                      style={{
                        backgroundColor: `${cat?.colorHex || '#6366f1'}15`,
                        color: cat?.colorHex || '#a5b4fc',
                      }}
                    >
                      {cat?.name || 'General'}
                    </span>
                  </td>

                  {/* Account */}
                  <td className="py-3 px-4 text-slate-400 hidden md:table-cell text-[11px]">
                    {acc?.name || 'Account'}
                  </td>

                  {/* Amount */}
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`font-mono font-bold tabular-nums text-sm ${
                        isIncome ? 'text-emerald-400' : 'text-slate-100'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                      {formatCurrency(tx.amount, currency)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => {
                        if (confirm(`Delete transaction "${tx.description}"?`)) {
                          onDeleteTransaction(tx.id);
                        }
                      }}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition"
                      title="Delete transaction"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {paginated.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  No transactions match the specified query.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs text-slate-400">
          <span>
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filtered.length)} of{' '}
            {filtered.length} entries
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition"
            >
              Previous
            </button>
            <span className="px-2 font-mono">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
