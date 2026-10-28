'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Repeat,
  Target,
  Receipt,
  Sparkles,
  Layers,
  ShieldCheck,
  ShieldAlert,
  Send,
  Plus,
  QrCode,
} from 'lucide-react';

import { Header } from '@/components/Header';
import { QuickStatsCards } from '@/components/QuickStatsCards';
import { CashflowPredictionChart } from '@/components/CashflowPredictionChart';
import { WhatIfSimulator } from '@/components/WhatIfSimulator';
import { RecurringPaymentsManager } from '@/components/RecurringPaymentsManager';
import { SpendingAnalytics, BudgetCategoryItem } from '@/components/SpendingAnalytics';
import { TransactionLedger } from '@/components/TransactionLedger';
import { AddTransactionModal } from '@/components/AddTransactionModal';
import { AddRecurringModal } from '@/components/AddRecurringModal';
import { SettingsModal } from '@/components/SettingsModal';
import { AuthModal } from '@/components/AuthModal';
import { PaymentTransferModal } from '@/components/PaymentTransferModal';
import { SubscriptionModal } from '@/components/SubscriptionModal';
import { CSVUploadModal } from '@/components/CSVUploadModal';
import { AuditTrailModal } from '@/components/AuditTrailModal';
import { apiClient, AuthUser } from '@/lib/api-client';
import { Spatial3DCanvas } from '@/components/Spatial3DCanvas';
import { HolographicCard3D } from '@/components/HolographicCard3D';
import { ThreeVaultGyro } from '@/components/ThreeVaultGyro';
import { ThreeCashflowHorizon } from '@/components/ThreeCashflowHorizon';
import { ThreeBackgroundCosmos } from '@/components/ThreeBackgroundCosmos';
import { sounds } from '@/lib/sound-effects';

import {
  Account,
  Category,
  PredictionResult,
  RecurringPayment,
  ScenarioAdjustment,
  Transaction,
  UserFinancials,
} from '@/lib/types';

import {
  computeClientFinancials,
  loadClientStore,
  saveClientStore,
  getInitialClientStore,
} from '@/lib/client-store';
import { projectCashflow } from '@/lib/predictive-engine';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<UserFinancials | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recurringPayments, setRecurringPayments] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<BudgetCategoryItem[]>([]);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);

  const [loading, setLoading] = useState(true);
  const [predictLoading, setPredictLoading] = useState(false);
  const [selectedHorizon, setSelectedHorizon] = useState(90);
  const [variableBurnMultiplier, setVariableBurnMultiplier] = useState(1.0);
  const [activeTab, setActiveTab] = useState<'all' | 'predictions' | 'recurring' | 'analytics' | 'ledger'>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [scenario, setScenario] = useState<ScenarioAdjustment>({
    enabled: false,
    monthlyExpenseDelta: 0,
    monthlyIncomeDelta: 0,
    oneTimeAmount: 0,
    oneTimeDayOffset: 14,
  });

  // User & Modals state
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [isAddRecurringOpen, setIsAddRecurringOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [isCSVUploadOpen, setIsCSVUploadOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  useEffect(() => {
    const user = apiClient.getStoredUser();
    if (user) {
      setCurrentUser(user);
    } else {
      // Initialize with default demo pro profile
      const defaultUser: AuthUser = {
        id: 'usr_alex_01',
        email: 'alex@apexfin.io',
        name: 'Alex Rivera',
        tier: 'pro',
        tenantId: 'ten_alex_01',
      };
      apiClient.setStoredUser(defaultUser);
      setCurrentUser(defaultUser);
    }
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sounds.setEnabled(next);
    if (next) sounds.playTick();
  };

  // Resilient Dual-Mode Data Loader (API + Offline LocalStorage Fallback)
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [finRes, recRes, txRes, budRes] = await Promise.all([
        fetch('/api/financials').catch(() => null),
        fetch('/api/recurring').catch(() => null),
        fetch('/api/transactions?limit=100').catch(() => null),
        fetch('/api/budgets').catch(() => null),
      ]);

      if (finRes && finRes.ok && recRes && recRes.ok && txRes && txRes.ok && budRes && budRes.ok) {
        const finData = await finRes.json();
        const recData = await recRes.json();
        const txData = await txRes.json();
        const budData = await budRes.json();

        setMetrics(finData.metrics || null);
        setAccounts(finData.accounts || []);
        setCategories(finData.categories || []);
        setRecurringPayments(recData.recurringPayments || []);
        setTransactions(txData.transactions || []);
        setBudgets(budData.budgets || []);
      } else {
        // Fallback for static drag-and-drop hosting (Netlify Drop / Cloudflare Pages)
        const local = loadClientStore();
        setMetrics(computeClientFinancials(local));
        setAccounts(local.accounts);
        setCategories(local.categories);
        setTransactions(local.transactions);

        const categoriesMap = new Map(local.categories.map((c) => [c.id, c]));
        const enriched = local.recurringPayments.map((item) => {
          const parts = item.nextDueDate.split('-');
          const target = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          target.setHours(0, 0, 0, 0);
          const daysUntilDue = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const status = daysUntilDue < 0 ? 'OVERDUE' : daysUntilDue <= 7 ? 'DUE_SOON' : 'UPCOMING';
          return {
            ...item,
            category: categoriesMap.get(item.categoryId) || null,
            daysUntilDue,
            status,
          };
        });
        setRecurringPayments(enriched);

        const budgetsList: BudgetCategoryItem[] = local.categories
          .filter((c) => c.type === 'expense')
          .map((c) => {
            const spent = local.transactions
              .filter((t) => t.type === 'expense' && t.categoryId === c.id)
              .reduce((sum, t) => sum + t.amount, 0);
            return {
              categoryId: c.id,
              categoryName: c.name,
              colorHex: c.colorHex,
              iconName: c.iconName,
              isEssential: c.isEssential,
              allocatedAmount: c.defaultBudget,
              spentAmount: spent,
              remainingAmount: c.defaultBudget - spent,
              utilizationPct: c.defaultBudget > 0 ? Math.round((spent / c.defaultBudget) * 100) : 0,
              isOverBudget: spent > c.defaultBudget,
            };
          });
        setBudgets(budgetsList);
      }
    } catch (err) {
      console.warn('Falling back to local client store:', err);
      const local = loadClientStore();
      setMetrics(computeClientFinancials(local));
      setAccounts(local.accounts);
      setCategories(local.categories);
      setTransactions(local.transactions);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch predictive simulation (Server API or Instant In-Browser Fallback)
  const fetchPrediction = useCallback(
    async (horizon: number, multiplier: number, scen: ScenarioAdjustment) => {
      try {
        setPredictLoading(true);
        const res = await fetch('/api/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            horizonDays: horizon,
            variableBurnMultiplier: multiplier,
            scenario: scen,
          }),
        }).catch(() => null);

        if (res && res.ok) {
          const data = await res.json();
          setPrediction(data);
        } else {
          // Client-side pure calculation fallback
          const local = loadClientStore();
          const liquidBalance = local.accounts
            .filter((a) => a.type === 'checking' || a.type === 'savings')
            .reduce((sum, a) => sum + a.currentBalance, 0);

          const result = projectCashflow({
            startBalance: liquidBalance,
            safetyBuffer: local.user.safetyBuffer,
            recurringPayments: local.recurringPayments,
            transactions: local.transactions,
            categories: local.categories,
            horizonDays: horizon,
            variableBurnMultiplier: multiplier,
            scenario: scen,
          });
          setPrediction(result);
        }
      } catch {
        const local = loadClientStore();
        const liquidBalance = local.accounts
          .filter((a) => a.type === 'checking' || a.type === 'savings')
          .reduce((sum, a) => sum + a.currentBalance, 0);

        const result = projectCashflow({
          startBalance: liquidBalance,
          safetyBuffer: local.user.safetyBuffer,
          recurringPayments: local.recurringPayments,
          transactions: local.transactions,
          categories: local.categories,
          horizonDays: horizon,
          variableBurnMultiplier: multiplier,
          scenario: scen,
        });
        setPrediction(result);
      } finally {
        setPredictLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!loading) {
      fetchPrediction(selectedHorizon, variableBurnMultiplier, scenario);
    }
  }, [loading, selectedHorizon, variableBurnMultiplier, scenario, fetchPrediction]);

  // Handlers for Transactions
  const handleAddTransaction = async (newTx: any) => {
    sounds.playSuccess();
    try {
      await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTx),
      });
    } catch {
      // offline / static fallback
    }
    const local = loadClientStore();
    const txObj: Transaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      accountId: newTx.accountId || local.accounts[0]?.id || '',
      categoryId: newTx.categoryId,
      amount: newTx.amount,
      type: newTx.type,
      description: newTx.description,
      date: newTx.date,
      status: 'cleared',
      tags: newTx.tags || [],
      isRecurring: false,
      createdAt: new Date().toISOString(),
    };
    local.transactions.unshift(txObj);
    const acc = local.accounts.find((a) => a.id === txObj.accountId);
    if (acc) {
      if (txObj.type === 'income') acc.currentBalance += txObj.amount;
      else acc.currentBalance -= txObj.amount;
    }
    saveClientStore(local);
    await fetchData();
    fetchPrediction(selectedHorizon, variableBurnMultiplier, scenario);
  };

  const handleDeleteTransaction = async (id: string) => {
    sounds.playTick();
    try {
      await fetch(`/api/transactions?id=${id}`, { method: 'DELETE' });
    } catch {
      // offline / static fallback
    }
    const local = loadClientStore();
    const idx = local.transactions.findIndex((t) => t.id === id);
    if (idx !== -1) {
      const [del] = local.transactions.splice(idx, 1);
      const acc = local.accounts.find((a) => a.id === del.accountId);
      if (acc) {
        if (del.type === 'income') acc.currentBalance -= del.amount;
        else acc.currentBalance += del.amount;
      }
      saveClientStore(local);
    }
    await fetchData();
    fetchPrediction(selectedHorizon, variableBurnMultiplier, scenario);
  };

  // Handlers for Recurring Commitments
  const handleAddRecurring = async (newItem: any) => {
    sounds.playSuccess();
    try {
      await fetch('/api/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });
    } catch {
      // offline / static fallback
    }
    const local = loadClientStore();
    const recObj: RecurringPayment = {
      id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: newItem.name,
      categoryId: newItem.categoryId,
      amount: newItem.amount,
      type: newItem.type,
      frequency: newItem.frequency,
      dueDay: newItem.dueDay,
      nextDueDate: newItem.nextDueDate,
      autopay: newItem.autopay,
      isActive: true,
      notes: newItem.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    local.recurringPayments.push(recObj);
    saveClientStore(local);
    await fetchData();
    fetchPrediction(selectedHorizon, variableBurnMultiplier, scenario);
  };

  const handleToggleRecurringActive = async (id: string, currentActive: boolean) => {
    sounds.playTick();
    try {
      await fetch('/api/recurring', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !currentActive }),
      });
    } catch {
      // offline fallback
    }
    const local = loadClientStore();
    const target = local.recurringPayments.find((r) => r.id === id);
    if (target) {
      target.isActive = !currentActive;
      saveClientStore(local);
    }
    setRecurringPayments((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isActive: !currentActive } : r))
    );
    fetchPrediction(selectedHorizon, variableBurnMultiplier, scenario);
  };

  const handleToggleRecurringAutopay = async (id: string, currentAutopay: boolean) => {
    sounds.playTick();
    try {
      await fetch('/api/recurring', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, autopay: !currentAutopay }),
      });
    } catch {
      // offline fallback
    }
    const local = loadClientStore();
    const target = local.recurringPayments.find((r) => r.id === id);
    if (target) {
      target.autopay = !currentAutopay;
      saveClientStore(local);
    }
    setRecurringPayments((prev) =>
      prev.map((r) => (r.id === id ? { ...r, autopay: !currentAutopay } : r))
    );
  };

  const handleDeleteRecurring = async (id: string) => {
    sounds.playTick();
    try {
      await fetch(`/api/recurring?id=${id}`, { method: 'DELETE' });
    } catch {
      // offline fallback
    }
    const local = loadClientStore();
    local.recurringPayments = local.recurringPayments.filter((r) => r.id !== id);
    saveClientStore(local);
    setRecurringPayments((prev) => prev.filter((r) => r.id !== id));
    fetchPrediction(selectedHorizon, variableBurnMultiplier, scenario);
  };

  // Handlers for Budgets
  const handleUpdateBudget = async (categoryId: string, allocated: number) => {
    sounds.playSuccess();
    try {
      await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, allocatedAmount: allocated }),
      });
    } catch {
      // offline fallback
    }
    const local = loadClientStore();
    const b = local.budgets.find((bg) => bg.categoryId === categoryId);
    if (b) b.allocatedAmount = allocated;
    else {
      local.budgets.push({
        id: `b-${Date.now()}`,
        categoryId,
        period: 'monthly',
        allocatedAmount: allocated,
        monthYear: '2026-10',
      });
    }
    saveClientStore(local);
    setBudgets((prev) =>
      prev.map((item) =>
        item.categoryId === categoryId
          ? {
              ...item,
              allocatedAmount: allocated,
              remainingAmount: allocated - item.spentAmount,
              utilizationPct: allocated > 0 ? Math.round((item.spentAmount / allocated) * 100) : 0,
              isOverBudget: item.spentAmount > allocated,
            }
          : item
      )
    );
  };

  // Currency Change Handler (Instant Dynamic Persistence)
  const handleCurrencyChange = async (newCurr: string) => {
    sounds.playTick();
    if (metrics) {
      setMetrics({ ...metrics, currency: newCurr });
    }
    await apiClient.updateCurrency(newCurr);
    await fetchData();
    fetchPrediction(selectedHorizon, variableBurnMultiplier, scenario);
  };

  // Settings Handler
  const handleSaveSettings = async (newSettings: { safetyBuffer: number; currency: string; name: string }) => {
    sounds.playSuccess();
    try {
      await fetch('/api/financials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
    } catch {
      // offline fallback
    }
    await apiClient.updateSettings(newSettings);
    const local = loadClientStore();
    local.user.safetyBuffer = newSettings.safetyBuffer;
    local.user.currency = newSettings.currency;
    local.user.name = newSettings.name;
    saveClientStore(local);
    await fetchData();
    fetchPrediction(selectedHorizon, variableBurnMultiplier, scenario);
  };

  // Demo Reset Handler
  const handleResetData = async () => {
    sounds.playSuccess();
    try {
      await fetch('/api/seed?action=reset', { method: 'POST' });
    } catch {
      // offline fallback
    }
    const initial = getInitialClientStore();
    saveClientStore(initial);
    await fetchData();
    fetchPrediction(selectedHorizon, variableBurnMultiplier, scenario);
  };

  // Export JSON Handler
  const handleExportData = async () => {
    sounds.playSuccess();
    let data;
    try {
      const res = await fetch('/api/seed');
      data = await res.json();
    } catch {
      data = loadClientStore();
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apexfin-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleHorizonChange = (h: number) => {
    sounds.playTick();
    setSelectedHorizon(h);
  };

  const handleBurnChange = (m: number) => {
    sounds.playTick();
    setVariableBurnMultiplier(m);
  };

  const handleScenarioChange = (s: ScenarioAdjustment) => {
    if (s.enabled !== scenario.enabled) {
      sounds.playScenarioToggle();
    }
    setScenario(s);
  };

  // 3D Canvas visual status
  const canvasStatus = scenario.enabled
    ? 'scenario'
    : prediction?.baselineBreachDetected
    ? 'warning'
    : 'safe';

  const primaryAccount = accounts.find((a) => a.type === 'checking') || accounts[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-16 relative overflow-x-hidden">
      {/* Interactive WebGL 3D Background Cosmos */}
      <ThreeBackgroundCosmos status={canvasStatus} />

      {/* Top Navigation */}
      <Header
        metrics={metrics}
        currentUser={currentUser}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        onOpenNewTransaction={() => setIsAddTxOpen(true)}
        onOpenNewRecurring={() => setIsAddRecurringOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onResetData={handleResetData}
        onExportData={handleExportData}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenTransfer={() => setIsTransferOpen(true)}
        onOpenSubscription={() => setIsSubscriptionOpen(true)}
        onOpenCSVUpload={() => setIsCSVUploadOpen(true)}
        onOpenAudit={() => setIsAuditOpen(true)}
        onExportPDF={() => apiClient.downloadStatementPDF(currentUser?.name || 'Alex Rivera')}
        onCurrencyChanged={handleCurrencyChange}
      />

      {/* Main Container */}
      <main
        role="main"
        aria-label="ApexFin Financial Dashboard"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 w-full space-y-6 relative z-10"
      >
        {/* Hero Section: Three.js 3D Interactive Vault Gyroscope + KPI Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-4 flex justify-center">
            <ThreeVaultGyro
              cardholderName="Alex Rivera"
              balance={metrics?.liquidBalance || 0}
              safetyBuffer={metrics?.safetyBuffer || 1500}
              currency={metrics?.currency}
              accountName={primaryAccount?.name || 'Primary Checking'}
            />
          </div>
          <div className="lg:col-span-8">
            <QuickStatsCards metrics={metrics} />
          </div>
        </div>

        {/* Instant Money Transfer & UPI Quick Bar */}
        <div className="glass-panel p-4 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-slate-950/40 flex flex-wrap items-center justify-between gap-4 shadow-lg shadow-emerald-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">Instant Transfer & UPI Payment Hub</h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Zero Fees
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Send & receive money via <strong className="text-slate-200">UPI ID (VPA)</strong>, generate dynamic <strong className="text-slate-200">QR codes</strong>, or transfer to registered ApexFin user accounts.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sounds.playTick();
                setIsTransferOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 transition active:scale-95 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Transfer Money (UPI / QR)</span>
            </button>
            <button
              onClick={() => {
                sounds.playTick();
                setIsAddTxOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-blue-400" />
              <span>+ New Transaction</span>
            </button>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-medium">
            <button
              onClick={() => {
                sounds.playTick();
                setActiveTab('all');
              }}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> All Intelligence
            </button>
            <button
              onClick={() => {
                sounds.playTick();
                setActiveTab('predictions');
              }}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'predictions'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" /> Cashflow Forecast
            </button>
            <button
              onClick={() => {
                sounds.playTick();
                setActiveTab('recurring');
              }}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'recurring'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" /> Monthly Bills ({recurringPayments.length})
            </button>
            <button
              onClick={() => {
                sounds.playTick();
                setActiveTab('analytics');
              }}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'analytics'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Target className="w-3.5 h-3.5" /> Spending & Budgets
            </button>
            <button
              onClick={() => {
                sounds.playTick();
                setActiveTab('ledger');
              }}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'ledger'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" /> Ledger ({transactions.length})
            </button>
          </div>

          {/* Quick Transfer Button on Tab Bar */}
          <button
            onClick={() => {
              sounds.playTick();
              setIsTransferOpen(true);
            }}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 text-xs font-semibold transition active:scale-95 shrink-0 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pay / UPI</span>
          </button>
        </div>

        {/* Predictive Horizon Visualizer & What-If Sandbox */}
        {(activeTab === 'all' || activeTab === 'predictions') && (
          <div className="space-y-6">
            {/* Interactive 3D WebGL Cashflow Landscape */}
            <ThreeCashflowHorizon
              prediction={prediction}
              currency={metrics?.currency}
              isScenarioActive={scenario.enabled}
            />

            <CashflowPredictionChart
              prediction={prediction}
              loading={predictLoading}
              selectedHorizon={selectedHorizon}
              onHorizonChange={handleHorizonChange}
              variableBurnMultiplier={variableBurnMultiplier}
              onBurnMultiplierChange={handleBurnChange}
              isScenarioActive={scenario.enabled}
              currency={metrics?.currency}
            />

            <WhatIfSimulator
              scenario={scenario}
              onChange={handleScenarioChange}
              currency={metrics?.currency}
              horizonDays={selectedHorizon}
            />
          </div>
        )}

        {/* Monthly Recurring Obligations */}
        {(activeTab === 'all' || activeTab === 'recurring') && (
          <RecurringPaymentsManager
            recurringPayments={recurringPayments}
            categories={categories}
            onToggleActive={handleToggleRecurringActive}
            onToggleAutopay={handleToggleRecurringAutopay}
            onDelete={handleDeleteRecurring}
            onOpenAddModal={() => setIsAddRecurringOpen(true)}
            currency={metrics?.currency}
          />
        )}

        {/* Spending Analytics & Category Budgets */}
        {(activeTab === 'all' || activeTab === 'analytics') && (
          <SpendingAnalytics
            budgets={budgets}
            onUpdateBudget={handleUpdateBudget}
            currency={metrics?.currency}
          />
        )}

        {/* Transaction Ledger */}
        {(activeTab === 'all' || activeTab === 'ledger') && (
          <TransactionLedger
            transactions={transactions}
            categories={categories}
            accounts={accounts}
            onDeleteTransaction={handleDeleteTransaction}
            onOpenAddModal={() => setIsAddTxOpen(true)}
            currency={metrics?.currency}
          />
        )}
      </main>

      {/* Modals */}
      <AddTransactionModal
        isOpen={isAddTxOpen}
        onClose={() => setIsAddTxOpen(false)}
        categories={categories}
        accounts={accounts}
        onAddTransaction={handleAddTransaction}
      />

      <AddRecurringModal
        isOpen={isAddRecurringOpen}
        onClose={() => setIsAddRecurringOpen(false)}
        categories={categories}
        onAddRecurring={handleAddRecurring}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        metrics={metrics}
        onSaveSettings={handleSaveSettings}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        currentUser={currentUser}
        onUserChanged={(u) => {
          setCurrentUser(u);
          fetchData();
        }}
      />

      <PaymentTransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        liquidBalance={metrics?.liquidBalance || 0}
        soundEnabled={soundEnabled}
        onTransferSuccess={() => fetchData()}
      />

      <SubscriptionModal
        isOpen={isSubscriptionOpen}
        onClose={() => setIsSubscriptionOpen(false)}
        currentUser={currentUser}
        onTierUpdated={(tier) => {
          if (currentUser) {
            setCurrentUser({ ...currentUser, tier });
          }
        }}
      />

      <CSVUploadModal
        isOpen={isCSVUploadOpen}
        onClose={() => setIsCSVUploadOpen(false)}
        onUploadSuccess={() => fetchData()}
      />

      <AuditTrailModal
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
      />
    </div>
  );
}
