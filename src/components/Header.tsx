'use client';

import React, { useState } from 'react';
import {
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  Download,
  Plus,
  Sliders,
  Calendar,
  Volume2,
  VolumeX,
  Send,
  UploadCloud,
  FileDown,
  Activity,
  Sparkles,
  User,
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { UserFinancials } from '@/lib/types';
import { AuthUser } from '@/lib/api-client';

interface HeaderProps {
  metrics: UserFinancials | null;
  currentUser: AuthUser | null;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenNewTransaction: () => void;
  onOpenNewRecurring: () => void;
  onOpenSettings: () => void;
  onResetData: () => void;
  onExportData: () => void;
  onOpenAuth: () => void;
  onOpenTransfer: () => void;
  onOpenSubscription: () => void;
  onOpenCSVUpload: () => void;
  onOpenAudit: () => void;
  onExportPDF: () => void;
  onCurrencyChanged: (currency: string) => void;
}

export function Header({
  metrics,
  currentUser,
  soundEnabled,
  onToggleSound,
  onOpenNewTransaction,
  onOpenNewRecurring,
  onOpenSettings,
  onResetData,
  onExportData,
  onOpenAuth,
  onOpenTransfer,
  onOpenSubscription,
  onOpenCSVUpload,
  onOpenAudit,
  onExportPDF,
  onCurrencyChanged,
}: HeaderProps) {
  const [resetting, setResetting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleReset = async () => {
    if (confirm('Reset to rich demo dataset? This will restore sample bills and transactions.')) {
      setResetting(true);
      await onResetData();
      setResetting(false);
    }
  };

  const handlePdfExport = async () => {
    setExportingPdf(true);
    try {
      await onExportPDF();
    } finally {
      setExportingPdf(false);
    }
  };

  const isBufferSafe = metrics ? metrics.liquidBalance >= metrics.safetyBuffer : true;
  const userTier = currentUser?.tier || 'pro';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-emerald-400 p-[1px] flex items-center justify-center shadow-lg shadow-blue-500/10">
            <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white text-base sm:text-lg">ApexFin</span>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hidden sm:inline-block">
                Spatial 3D
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden lg:block">
              Continuous Cashflow & Obligation Intelligence
            </p>
          </div>
        </div>

        {/* Primary Interactive Actions */}
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {/* Pay Anyone Button */}
          <button
            onClick={onOpenTransfer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 text-xs font-semibold shadow-sm transition active:scale-95 shrink-0"
          >
            <Send className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pay Anyone</span>
          </button>

          {/* Export PDF Report */}
          <button
            onClick={handlePdfExport}
            disabled={exportingPdf}
            title="Download ReportLab PDF Statement"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition active:scale-95 shrink-0"
          >
            <FileDown className={`w-3.5 h-3.5 ${exportingPdf ? 'animate-bounce text-blue-400' : 'text-slate-400'}`} />
            <span>{exportingPdf ? 'Generating...' : 'PDF Report'}</span>
          </button>

          {/* Upload CSV Statement */}
          <button
            onClick={onOpenCSVUpload}
            title="Import Bank CSV Statement"
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition active:scale-95 shrink-0"
          >
            <UploadCloud className="w-3.5 h-3.5 text-slate-400" />
            <span>Import CSV</span>
          </button>

          {/* SaaS Tier / Upgrade Plan Button */}
          <button
            onClick={onOpenSubscription}
            title="Manage subscription plan and pricing tiers"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-950/30 hover:bg-indigo-900/40 text-indigo-300 text-xs font-medium transition active:scale-95 shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span className="capitalize">{userTier} Plan</span>
          </button>

          {/* Audit & System Telemetry */}
          <button
            onClick={onOpenAudit}
            title="Incident Response & Security Audit Trail"
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition active:scale-95 shrink-0"
          >
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span>Audit Trail</span>
          </button>

          {/* Safety Buffer Indicator */}
          {metrics && (
            <button
              onClick={onOpenSettings}
              title="Click to adjust safety buffer threshold"
              aria-label={`Safety Buffer: ${formatCurrency(metrics.safetyBuffer, metrics.currency, 0)}`}
              className={`hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all shrink-0 ${
                isBufferSafe
                  ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300 hover:bg-emerald-900/40'
                  : 'bg-amber-950/30 border-amber-800/50 text-amber-300 hover:bg-amber-900/40 animate-pulse'
              }`}
            >
              {isBufferSafe ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-amber-400" />
              )}
              <span>
                Buffer: <strong className="tabular-nums font-mono">{formatCurrency(metrics.safetyBuffer, metrics.currency, 0)}</strong>
              </span>
            </button>
          )}

          {/* Currency Standard Selector */}
          <div className="relative shrink-0 flex items-center">
            <select
              value={metrics?.currency || 'USD'}
              onChange={(e) => onCurrencyChanged(e.target.value)}
              title="Select dynamic currency standard"
              aria-label="Select dynamic currency standard"
              className="bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-200 focus:outline-none focus:border-blue-500 transition cursor-pointer"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="JPY">JPY (¥)</option>
              <option value="IDR">IDR (Rp)</option>
              <option value="CAD">CAD (CA$)</option>
              <option value="AUD">AUD (AU$)</option>
            </select>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={onToggleSound}
            title={soundEnabled ? 'Mute synthesized sound effects' : 'Enable synthesized sound effects'}
            aria-label={soundEnabled ? 'Mute audio feedback' : 'Unmute audio feedback'}
            className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900 hover:border-slate-700 transition shrink-0"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-blue-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Export JSON */}
          <button
            onClick={onExportData}
            title="Export full financial data (JSON)"
            className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900 hover:border-slate-700 transition shrink-0"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Reset Demo */}
          <button
            onClick={handleReset}
            disabled={resetting}
            title="Reset to default sample dataset"
            className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900 hover:border-slate-700 transition shrink-0"
          >
            <RotateCcw className={`w-4 h-4 ${resetting ? 'animate-spin' : ''}`} />
          </button>

          {/* Settings Modal */}
          <button
            onClick={onOpenSettings}
            title="Financial Settings"
            className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900 hover:border-slate-700 transition shrink-0"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Add Recurring Bill */}
          <button
            onClick={onOpenNewRecurring}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-300 text-xs font-medium transition active:scale-95 shrink-0"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>+ Bill</span>
          </button>

          {/* New Transaction */}
          <button
            onClick={onOpenNewTransaction}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition active:scale-95 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Tx</span>
          </button>

          {/* User Account / Profile */}
          <button
            onClick={onOpenAuth}
            title={currentUser ? `Signed in as ${currentUser.name}` : 'Sign in to enterprise account'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition active:scale-95 shrink-0"
          >
            <User className="w-3.5 h-3.5 text-blue-400" />
            <span className="max-w-[70px] truncate">{currentUser?.name?.split(' ')[0] || 'Sign In'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
