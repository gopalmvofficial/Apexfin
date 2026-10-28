'use client';

import React, { useState } from 'react';
import { X, Shield, DollarSign, User, Check } from 'lucide-react';
import { UserFinancials } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  metrics: UserFinancials | null;
  onSaveSettings: (settings: { safetyBuffer: number; currency: string; name: string }) => Promise<void>;
}

export function SettingsModal({
  isOpen,
  onClose,
  metrics,
  onSaveSettings,
}: SettingsModalProps) {
  const [safetyBuffer, setSafetyBuffer] = useState(String(metrics?.safetyBuffer || 1500));
  const [currency, setCurrency] = useState(metrics?.currency || 'USD');
  const [name, setName] = useState('Alex Rivera');
  const [backendUrl, setBackendUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('apexfin_backend_url') || process.env.NEXT_PUBLIC_API_URL || '';
    }
    return '';
  });
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (metrics) {
      setSafetyBuffer(String(metrics.safetyBuffer));
      setCurrency(metrics.currency || 'USD');
    }
  }, [metrics, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedBuffer = parseFloat(safetyBuffer);
    if (isNaN(parsedBuffer) || parsedBuffer < 0) {
      alert('Please enter a valid non-negative safety buffer.');
      return;
    }

    setLoading(true);
    try {
      if (typeof window !== 'undefined') {
        if (backendUrl.trim()) {
          localStorage.setItem('apexfin_backend_url', backendUrl.trim().replace(/\/$/, ''));
        } else {
          localStorage.removeItem('apexfin_backend_url');
        }
      }
      await onSaveSettings({
        safetyBuffer: parsedBuffer,
        currency,
        name: name.trim() || 'Alex Rivera',
      });
      onClose();
    } catch (err) {
      alert('Failed to save settings: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  const CURRENCIES = [
    { code: 'USD', symbol: '$', name: 'US Dollar (USD)' },
    { code: 'EUR', symbol: '€', name: 'Euro (EUR)' },
    { code: 'GBP', symbol: '£', name: 'British Pound (GBP)' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee (INR / UPI)' },
    { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar (CAD)' },
    { code: 'AUD', symbol: 'AU$', name: 'Australian Dollar (AUD)' },
    { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah (IDR)' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen (JPY)' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Financial Guardrails</h3>
            <p className="text-xs text-slate-400">Configure safety liquidity buffer and currency</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* User Display Name */}
          <div>
            <label className="block text-slate-400 mb-1">User Profile Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>

          {/* Safety Buffer */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-slate-400">Emergency Safety Buffer</label>
              <span className="text-amber-400 font-mono font-bold">
                {formatCurrency(parseFloat(safetyBuffer) || 0, currency, 0)}
              </span>
            </div>
            <div className="relative">
              <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                step="50"
                min="0"
                value={safetyBuffer}
                onChange={(e) => setSafetyBuffer(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-sm focus:outline-hidden focus:border-blue-500"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              When projected liquidity falls below this buffer, ApexFin flags an urgent alert.
            </p>
          </div>

          {/* Currency Selection */}
          <div>
            <label className="block text-slate-400 mb-1">Currency Standard</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-hidden focus:border-blue-500"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Backend API Gateway URL */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-slate-400">Backend API URL (Render / Cloud)</label>
              <span className="text-[10px] text-slate-500 font-mono">e.g. https://apexfin-backend.onrender.com</span>
            </div>
            <input
              type="url"
              placeholder="https://apexfin-backend.onrender.com (or empty for auto-detect)"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-xs focus:outline-hidden focus:border-blue-500"
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
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md shadow-blue-600/30 transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
