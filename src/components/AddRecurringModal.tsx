'use client';

import React, { useState } from 'react';
import { X, Calendar, DollarSign, Repeat, CreditCard } from 'lucide-react';
import { Category, FrequencyType } from '@/lib/types';

interface AddRecurringModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onAddRecurring: (item: {
    name: string;
    categoryId: string;
    amount: number;
    type: 'expense' | 'income';
    frequency: FrequencyType;
    dueDay: number;
    nextDueDate: string;
    autopay: boolean;
    notes?: string;
  }) => Promise<void>;
}

export function AddRecurringModal({
  isOpen,
  onClose,
  categories,
  onAddRecurring,
}: AddRecurringModalProps) {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<FrequencyType>('monthly');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [dueDay, setDueDay] = useState('1');
  const [nextDueDate, setNextDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [autopay, setAutopay] = useState(true);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const filteredCategories = categories.filter((c) => c.type === type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    const parsedDay = parseInt(dueDay, 10);

    if (!name.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid bill name and amount.');
      return;
    }

    setLoading(true);
    try {
      await onAddRecurring({
        name: name.trim(),
        categoryId: categoryId || filteredCategories[0]?.id || '',
        amount: parsedAmount,
        type,
        frequency,
        dueDay: isNaN(parsedDay) ? 1 : Math.max(1, Math.min(31, parsedDay)),
        nextDueDate,
        autopay,
        notes: notes.trim() || undefined,
      });

      setName('');
      setAmount('');
      setNotes('');
      onClose();
    } catch (err) {
      alert('Failed to save recurring commitment: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-base font-bold text-white mb-4">Add Recurring Commitment</h3>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setType('expense');
                const expCats = categories.filter((c) => c.type === 'expense');
                if (expCats.length > 0) setCategoryId(expCats[0].id);
              }}
              className={`py-2 rounded-lg font-semibold transition ${
                type === 'expense'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Recurring Bill / Expense
            </button>
            <button
              type="button"
              onClick={() => {
                setType('income');
                const incCats = categories.filter((c) => c.type === 'income');
                if (incCats.length > 0) setCategoryId(incCats[0].id);
              }}
              className={`py-2 rounded-lg font-semibold transition ${
                type === 'income'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Recurring Inflow / Salary
            </button>
          </div>

          {/* Name */}
          <div>
            <label className="block text-slate-400 mb-1">Commitment Name</label>
            <input
              type="text"
              placeholder="e.g. Apartment Rent, Netflix, Kaiser Health"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          {/* Amount & Frequency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Amount ($)</label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-sm focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as FrequencyType)}
                className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-hidden focus:border-indigo-500"
              >
                <option value="monthly">Monthly</option>
                <option value="biweekly">Bi-Weekly (every 14d)</option>
                <option value="weekly">Weekly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual (once/yr)</option>
              </select>
            </div>
          </div>

          {/* Category & Due Day */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-hidden focus:border-indigo-500"
              >
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Day of Month (1-31)</label>
              <input
                type="number"
                min="1"
                max="31"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Next Due Date & Autopay Checkbox */}
          <div className="grid grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-slate-400 mb-1">Next Payment Date</label>
              <input
                type="date"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div className="pt-4 flex items-center gap-2">
              <input
                type="checkbox"
                id="autopayCheck"
                checked={autopay}
                onChange={(e) => setAutopay(e.target.checked)}
                className="w-4 h-4 rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
              />
              <label htmlFor="autopayCheck" className="text-slate-300 font-medium cursor-pointer">
                Autopay Enabled
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-400 mb-1">Notes / Account Reference</label>
            <input
              type="text"
              placeholder="Optional notes or account number"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-600/30 transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Add Recurring Commitment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
