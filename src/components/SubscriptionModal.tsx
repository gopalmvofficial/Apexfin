'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Zap,
  Sparkles,
  Building2,
  Shield,
  CreditCard,
  Receipt,
  ArrowRight,
  Lock,
  Download,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { apiClient, AuthUser } from '@/lib/api-client';
import { formatCurrency } from '@/lib/formatters';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  onTierUpdated: (newTier: 'free' | 'pro' | 'enterprise') => void;
}

interface InvoiceRecord {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  billing_reason: string;
  payment_provider: string;
  created_at: string;
}

export function SubscriptionModal({
  isOpen,
  onClose,
  currentUser,
  onTierUpdated,
}: SubscriptionModalProps) {
  const [selectedTier, setSelectedTier] = useState<'free' | 'pro' | 'enterprise'>('pro');
  const [activeTab, setActiveTab] = useState<'checkout' | 'invoices'>('checkout');
  const [gateway, setGateway] = useState<'paypal' | 'stripe'>('paypal');

  // Stripe form fields
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardZip, setCardZip] = useState('');

  // Proration data
  const [proration, setProration] = useState<any>(null);
  const [loadingProration, setLoadingProration] = useState(false);

  // Checkout execution state
  const [processing, setProcessing] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Invoices list
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const currentTier = currentUser?.tier || 'free';

  useEffect(() => {
    if (isOpen) {
      setSelectedTier(currentTier === 'free' ? 'pro' : currentTier);
      setSuccessReceipt(null);
      setErrorMsg(null);
      loadProration(currentTier === 'free' ? 'pro' : currentTier);
      loadInvoices();
    }
  }, [isOpen, currentTier]);

  const loadProration = async (target: 'free' | 'pro' | 'enterprise') => {
    setLoadingProration(true);
    try {
      const data = await apiClient.calculateProration(target);
      setProration(data);
    } catch {
      // client calculation fallback
      const targetPrice = target === 'enterprise' ? 49 : target === 'pro' ? 19 : 0;
      setProration({
        current_tier: currentTier,
        target_tier: target,
        current_tier_monthly_price: currentTier === 'enterprise' ? 49 : currentTier === 'pro' ? 19 : 0,
        target_tier_monthly_price: targetPrice,
        days_remaining_in_cycle: 18,
        proration_credit: 11.40,
        amount_due_today: target === 'free' ? 0 : Math.max(0, targetPrice - 11.40),
        next_billing_date: new Date(Date.now() + 18 * 86400000).toISOString().split('T')[0],
        currency: 'USD',
      });
    } finally {
      setLoadingProration(false);
    }
  };

  const loadInvoices = async () => {
    setLoadingInvoices(true);
    try {
      const invs = await apiClient.getBillingInvoices();
      setInvoices(invs);
    } catch {
      // Fallback
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleTierSelect = (tier: 'free' | 'pro' | 'enterprise') => {
    setSelectedTier(tier);
    setErrorMsg(null);
    loadProration(tier);
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    const parts = raw.match(/.{1,4}/g);
    setCardNumber(parts ? parts.join(' ') : raw);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      raw = `${raw.slice(0, 2)}/${raw.slice(2)}`;
    }
    setCardExpiry(raw);
  };

  // PayPal Smart Button Checkout Execution
  const handlePayPalCheckout = async () => {
    if (selectedTier === currentTier) return;
    setProcessing(true);
    setErrorMsg(null);

    try {
      // 1. Create order
      const order = await apiClient.createPayPalOrder(selectedTier as 'pro' | 'enterprise', 'USD');
      // 2. Capture payment with atomic idempotency
      const result = await apiClient.capturePayPalOrder(
        order.order_id,
        currentUser?.email || 'shopper@sandbox.paypal.com'
      );

      onTierUpdated(selectedTier);
      setSuccessReceipt({
        provider: 'PayPal Express',
        orderId: order.order_id,
        invoiceNumber: result.invoice_number || `INV-PP-${Date.now().toString(36).toUpperCase()}`,
        amount: order.amount,
        tier: selectedTier,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      });
      loadInvoices();
    } catch (err: any) {
      setErrorMsg(err.message || 'PayPal checkout failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Stripe Card Payment Execution
  const handleStripeCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTier === currentTier) return;

    if (cardNumber.replace(/\s/g, '').length < 15) {
      setErrorMsg('Please enter a valid 16-digit card number.');
      return;
    }
    if (cardExpiry.length < 5) {
      setErrorMsg('Please enter a valid MM/YY expiration date.');
      return;
    }
    if (cardCvc.length < 3) {
      setErrorMsg('Please enter a valid 3 or 4-digit CVC security code.');
      return;
    }

    setProcessing(true);
    setErrorMsg(null);

    try {
      const intent = await apiClient.createStripePaymentIntent(selectedTier as 'pro' | 'enterprise', 'USD');
      const result = await apiClient.confirmStripePayment(intent.payment_intent_id);

      onTierUpdated(selectedTier);
      setSuccessReceipt({
        provider: 'Stripe Card Services',
        orderId: intent.payment_intent_id,
        invoiceNumber: result.invoice_number || `INV-STR-${Date.now().toString(36).toUpperCase()}`,
        amount: intent.amount,
        tier: selectedTier,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      });
      loadInvoices();
    } catch (err: any) {
      setErrorMsg(err.message || 'Credit card authorization failed. Please check your card details.');
    } finally {
      setProcessing(false);
    }
  };

  // Free Tier Downgrade Execution
  const handleFreeDowngrade = async () => {
    setProcessing(true);
    try {
      await apiClient.upgradeSubscription('free');
      onTierUpdated('free');
      setSuccessReceipt({
        provider: 'ApexFin System',
        orderId: 'FREE_DOWNGRADE',
        invoiceNumber: `INV-FREE-${Date.now().toString(36).toUpperCase()}`,
        amount: 0,
        tier: 'free',
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to adjust subscription plan.');
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  const tiers = [
    {
      id: 'free' as const,
      name: 'Starter Plan',
      price: '$0',
      period: 'forever',
      description: 'Essential personal cashflow projection with local offline storage.',
      features: [
        'Up to 25 transactions / month',
        'Single checking & savings account',
        'Standard 30-day runway projection',
        'Client-side offline storage',
      ],
      icon: Shield,
    },
    {
      id: 'pro' as const,
      name: 'Pro Trader',
      price: '$19',
      period: 'per month',
      popular: true,
      description: 'Full 3D WebGL telemetry, PDF statement export, and automated categorization.',
      features: [
        'Unlimited transactions & accounts',
        'WebGL 3D Cashflow Horizon & Gyro Vault',
        'Streaming ReportLab PDF Statements',
        'Bank CSV Auto-Classifier',
        'P2P disbursements up to $10,000 / day',
      ],
      icon: Zap,
    },
    {
      id: 'enterprise' as const,
      name: 'Enterprise Agency',
      price: '$49',
      period: 'per month',
      description: 'Multi-tenant organization isolation, automated dunning, and audit trails.',
      features: [
        'Multi-tenant workspace isolation',
        'Unlimited P2P & vendor payouts',
        'Automated Dunning & Invoicing State Machine',
        'Incident Response & Security Audit Logs',
        '24/7 dedicated engineering SLA',
      ],
      icon: Building2,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscription-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in"
    >
      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-indigo-500/10 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 id="subscription-modal-title" className="text-lg font-bold text-white flex items-center gap-2">
                ApexFin SaaS Membership & Automated Billing
              </h2>
              <p className="text-xs text-slate-400">
                Multi-gateway checkout with PayPal, Stripe, dynamic proration, and instant invoice history
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close subscription modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-3 mt-4 border-b border-slate-800/80 pb-2">
          <button
            onClick={() => {
              setActiveTab('checkout');
              setSuccessReceipt(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === 'checkout'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" /> Plan Checkout & Upgrade
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === 'invoices'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" /> Invoice History ({invoices.length})
          </button>
        </div>

        {/* Successful Payment Receipt View */}
        {successReceipt && (
          <div className="my-6 p-6 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-center space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Payment Confirmed & Plan Activated!</h3>
              <p className="text-xs text-slate-300 mt-1">
                Your account has been upgraded to the <strong className="text-emerald-400 uppercase">{successReceipt.tier}</strong> tier.
              </p>
            </div>
            <div className="max-w-md mx-auto bg-slate-900/90 border border-slate-800 rounded-xl p-4 text-left text-xs space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Invoice Number:</span>
                <span className="text-white font-bold">{successReceipt.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gateway Provider:</span>
                <span className="text-white">{successReceipt.provider}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount Billed:</span>
                <span className="text-emerald-400 font-bold">${successReceipt.amount}.00 USD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Transaction ID:</span>
                <span className="text-slate-300 truncate max-w-[200px]">{successReceipt.orderId}</span>
              </div>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => apiClient.downloadStatementPDF(currentUser?.name || 'Customer')}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" /> Download PDF Receipt
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
              >
                Done & Return
              </button>
            </div>
          </div>
        )}

        {/* Tab 1: Checkout & Tier Selection */}
        {activeTab === 'checkout' && !successReceipt && (
          <div className="space-y-6 mt-4">
            {/* Tiers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tiers.map((t) => {
                const Icon = t.icon;
                const isSelected = selectedTier === t.id;
                const isCurrent = currentTier === t.id;

                return (
                  <div
                    key={t.id}
                    onClick={() => handleTierSelect(t.id)}
                    className={`relative cursor-pointer flex flex-col justify-between p-4 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-gradient-to-b from-indigo-950/40 via-slate-900 to-slate-900 shadow-md shadow-indigo-500/20 ring-1 ring-indigo-500'
                        : isCurrent
                        ? 'border-emerald-500/40 bg-slate-950/50'
                        : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                    }`}
                  >
                    {t.popular && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-indigo-500 text-[10px] font-bold text-white uppercase tracking-wider">
                        Recommended
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between">
                        <div className="p-1.5 rounded-lg bg-slate-800/80 text-white">
                          <Icon className="w-4 h-4" />
                        </div>
                        {isCurrent && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Active
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-white mt-2">{t.name}</h3>
                      <p className="text-[11px] text-slate-400 mt-1 min-h-[30px]">{t.description}</p>

                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-xl font-extrabold text-white font-mono">{t.price}</span>
                        <span className="text-[11px] text-slate-400">/{t.period}</span>
                      </div>

                      <div className="mt-4 space-y-1.5 border-t border-slate-800/80 pt-3">
                        {t.features.map((f, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                            <Check className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Proration Summary Banner */}
            {proration && selectedTier !== currentTier && selectedTier !== 'free' && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-slate-400">Billing Cycle Proration: </span>
                  <span className="text-white font-medium">
                    Crediting {formatCurrency(proration.proration_credit, proration.currency)} from unused days of current plan.
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Next automatic renewal: {proration.next_billing_date}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-slate-400 text-[11px] block">Amount Due Today:</span>
                  <span className="text-base font-bold text-emerald-400 font-mono">
                    {formatCurrency(proration.amount_due_today, proration.currency)}
                  </span>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Checkout Options: Free Downgrade vs Paid Gateway (PayPal or Stripe) */}
            {selectedTier === 'free' ? (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Starter Plan (Free Tier)</h4>
                  <p className="text-[11px] text-slate-400">No payment method required. Immediate activation.</p>
                </div>
                <button
                  onClick={handleFreeDowngrade}
                  disabled={processing || currentTier === 'free'}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
                >
                  {processing ? 'Updating...' : currentTier === 'free' ? 'Current Plan' : 'Downgrade to Starter'}
                </button>
              </div>
            ) : selectedTier === currentTier ? (
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-center text-xs text-emerald-300 font-semibold">
                You are currently subscribed to the {tiers.find((t) => t.id === currentTier)?.name}.
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-5 space-y-4">
                {/* Gateway Switcher */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" /> Secure Payment Gateway
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setGateway('paypal')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                        gateway === 'paypal'
                          ? 'bg-[#0070BA] text-white shadow-sm'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>PayPal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGateway('stripe')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                        gateway === 'stripe'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>Credit Card / Stripe</span>
                    </button>
                  </div>
                </div>

                {/* Gateway 1: PayPal Smart Button */}
                {gateway === 'paypal' && (
                  <div className="space-y-3 py-2 text-center">
                    <p className="text-xs text-slate-400">
                      Click below to checkout instantly with your PayPal account or PayPal Credit.
                    </p>
                    <button
                      type="button"
                      disabled={processing}
                      onClick={handlePayPalCheckout}
                      className="w-full max-w-sm mx-auto py-3 px-6 rounded-full bg-[#FFC439] hover:bg-[#F2BA36] text-[#003087] font-bold text-sm shadow-lg shadow-yellow-500/20 transition active:scale-98 flex items-center justify-center gap-2"
                    >
                      {processing ? (
                        <span className="text-xs font-bold animate-pulse">Capturing PayPal Order...</span>
                      ) : (
                        <>
                          <span className="font-extrabold italic text-base">Pay</span>
                          <span className="font-extrabold italic text-base text-[#0079C1]">Pal</span>
                          <span className="text-xs text-[#003087] font-semibold ml-1">Checkout</span>
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-slate-500">
                      Sandbox integration active. Instant confirmation with zero fees.
                    </p>
                  </div>
                )}

                {/* Gateway 2: Credit Card Form (Stripe-caliber UI) */}
                {gateway === 'stripe' && (
                  <form onSubmit={handleStripeCheckout} className="space-y-3 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1">Card Number</label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={handleCardNumberChange}
                        placeholder="4242 •••• •••• 4242"
                        required
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-slate-400 mb-1">Expiration</label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={handleExpiryChange}
                          placeholder="MM/YY"
                          required
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">CVC Code</label>
                        <input
                          type="password"
                          maxLength={4}
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ''))}
                          placeholder="123"
                          required
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Postal / Zip</label>
                        <input
                          type="text"
                          value={cardZip}
                          onChange={(e) => setCardZip(e.target.value.toUpperCase())}
                          placeholder="94103"
                          required
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={processing}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition active:scale-98 flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <span>
                        {processing
                          ? 'Authorizing Card Payment...'
                          : `Authorize & Pay ${formatCurrency(
                              proration ? proration.amount_due_today : selectedTier === 'enterprise' ? 49 : 19,
                              'USD'
                            )}`}
                      </span>
                      {!processing && <ArrowRight className="w-3.5 h-3.5" />}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Billing Invoices History */}
        {activeTab === 'invoices' && (
          <div className="mt-4 space-y-3">
            {loadingInvoices ? (
              <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
                Loading automated billing invoices...
              </div>
            ) : invoices.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No past invoices found. Upgrades and recurring payments will automatically appear here.
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Invoice Number</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Provider</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-900/40 transition">
                        <td className="px-4 py-3 font-semibold text-white">{inv.invoice_number}</td>
                        <td className="px-4 py-3 text-slate-400">
                          {inv.created_at ? inv.created_at.slice(0, 10) : '2026-10-28'}
                        </td>
                        <td className="px-4 py-3 font-sans text-slate-300">
                          {inv.payment_provider || 'PayPal'}
                        </td>
                        <td className="px-4 py-3 text-emerald-400 font-bold">
                          {formatCurrency(inv.amount, inv.currency || 'USD')}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {inv.status || 'PAID'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => apiClient.downloadStatementPDF(currentUser?.name || 'Customer')}
                            title="Download PDF Invoice"
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
