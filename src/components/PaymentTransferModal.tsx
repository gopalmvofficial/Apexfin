'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Send,
  QrCode,
  Scan,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  UserCheck,
  Copy,
  Check,
  Download,
  ArrowRight,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { sounds } from '@/lib/sound-effects';
import { EXCHANGE_RATES_TO_USD, convertCurrencyClient } from '@/lib/formatters';

interface PaymentTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  liquidBalance: number;
  soundEnabled: boolean;
  onTransferSuccess: () => void;
}

type ModalTab = 'send' | 'receive' | 'scan';
type TransferMethod = 'userid' | 'upi' | 'email';

const SUPPORTED_CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee (UPI)', flag: '🇮🇳' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', flag: '🇮🇩' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'AUD', symbol: 'AU$', name: 'Australian Dollar', flag: '🇦🇺' },
];

export function PaymentTransferModal({
  isOpen,
  onClose,
  liquidBalance,
  soundEnabled,
  onTransferSuccess,
}: PaymentTransferModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>('send');

  // Tab 1: Send Transfer State
  const [transferMethod, setTransferMethod] = useState<TransferMethod>('upi');
  const [recipient, setRecipient] = useState('maya@creative.studio');
  const [amount, setAmount] = useState('100.00');
  const [currency, setCurrency] = useState('USD');
  const [note, setNote] = useState('Sprint payment');
  const [pin, setPin] = useState('1234');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<any | null>(null);

  // Recipient Lookup & Verification
  const [lookupResult, setLookupResult] = useState<{
    name: string;
    is_registered_user: boolean;
    is_valid_upi: boolean;
    preferred_currency?: string;
  } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  // Tab 2: Receive / Generate QR Code State
  const [qrIdentifier, setQrIdentifier] = useState('alex@okapexbank');
  const [qrName, setQrName] = useState('Alex Rivera');
  const [qrAmount, setQrAmount] = useState('100.00');
  const [qrCurrency, setQrCurrency] = useState('INR');
  const [qrNote, setQrNote] = useState('ApexFin Invoice #1042');
  const [qrData, setQrData] = useState<{
    qr_payload: string;
    svg_qr: string;
    qr_type: string;
  } | null>(null);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Tab 3: Scan / Paste QR URI State
  const [scannedUri, setScannedUri] = useState('');
  const [parsedQrInfo, setParsedQrInfo] = useState<{
    type: string;
    pa: string;
    pn?: string;
    am?: string;
    cu?: string;
    tn?: string;
  } | null>(null);

  // Reset & Initialize on Open
  useEffect(() => {
    if (isOpen) {
      setIdempotencyKey(`idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
      setError(null);
      setSuccessReceipt(null);
      const user = apiClient.getStoredUser();
      if (user) {
        setQrName(user.name || 'Alex Rivera');
        setQrIdentifier(user.email.replace('@', '@ok') || 'alex@okapexbank');
      }
    }
  }, [isOpen]);

  // Debounced recipient lookup
  useEffect(() => {
    if (!recipient || recipient.length < 3) {
      setLookupResult(null);
      return;
    }
    const timer = setTimeout(async () => {
      setLookingUp(true);
      try {
        const res = await apiClient.lookupRecipient(recipient);
        setLookupResult(res);
      } catch {
        setLookupResult(null);
      } finally {
        setLookingUp(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [recipient]);

  // Generate QR Code on Tab 2 change
  const refreshQrCode = useCallback(async () => {
    setGeneratingQr(true);
    try {
      const parsedAmt = parseFloat(qrAmount);
      const res = await apiClient.generatePaymentQRCode({
        recipient_identifier: qrIdentifier,
        recipient_name: qrName,
        amount: isNaN(parsedAmt) ? undefined : parsedAmt,
        currency: qrCurrency,
        note: qrNote,
      });
      setQrData(res);
    } catch {
      // Fallback
    } finally {
      setGeneratingQr(false);
    }
  }, [qrIdentifier, qrName, qrAmount, qrCurrency, qrNote]);

  useEffect(() => {
    if (isOpen && activeTab === 'receive') {
      refreshQrCode();
    }
  }, [isOpen, activeTab, refreshQrCode]);

  // Parse QR URI
  const handleParseUri = (uri: string) => {
    setScannedUri(uri);
    const trimmed = uri.trim();
    if (!trimmed) {
      setParsedQrInfo(null);
      return;
    }

    try {
      if (trimmed.startsWith('upi://pay')) {
        const url = new URL(trimmed.replace('upi://pay', 'http://dummy.com'));
        const pa = url.searchParams.get('pa') || '';
        const pn = url.searchParams.get('pn') || '';
        const am = url.searchParams.get('am') || '';
        const cu = url.searchParams.get('cu') || 'INR';
        const tn = url.searchParams.get('tn') || '';
        setParsedQrInfo({ type: 'UPI Payment QR', pa, pn, am, cu, tn });
      } else if (trimmed.startsWith('apexfin://pay')) {
        const url = new URL(trimmed.replace('apexfin://pay', 'http://dummy.com'));
        const to = url.searchParams.get('to') || '';
        const am = url.searchParams.get('am') || '';
        const cu = url.searchParams.get('cu') || 'USD';
        const memo = url.searchParams.get('memo') || '';
        setParsedQrInfo({ type: 'ApexFin P2P QR', pa: to, am, cu, tn: memo });
      } else {
        setParsedQrInfo(null);
      }
    } catch {
      setParsedQrInfo(null);
    }
  };

  const handleApplyParsedQr = () => {
    if (!parsedQrInfo) return;
    setRecipient(parsedQrInfo.pa);
    if (parsedQrInfo.am) setAmount(parsedQrInfo.am);
    if (parsedQrInfo.cu) setCurrency(parsedQrInfo.cu);
    if (parsedQrInfo.tn) setNote(parsedQrInfo.tn);
    if (parsedQrInfo.pa.includes('@') && !parsedQrInfo.pa.includes('.com')) {
      setTransferMethod('upi');
    } else {
      setTransferMethod('userid');
    }
    setActiveTab('send');
    if (soundEnabled) sounds.playClick();
  };

  if (!isOpen) return null;

  // Approximate balance debit calculation
  const numericAmount = parseFloat(amount) || 0;
  const estimatedUsdDebit = convertCurrencyClient(numericAmount, currency, 'USD');

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please specify a valid payment amount greater than 0.');
      return;
    }
    if (estimatedUsdDebit > liquidBalance) {
      setError(
        `Insufficient liquid checking funds. Required: $${estimatedUsdDebit.toLocaleString('en-US', {
          minimumFractionDigits: 2,
        })} USD (Available: $${liquidBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD)`
      );
      if (soundEnabled) sounds.playDanger();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const receipt = await apiClient.sendPaymentTransfer({
        recipient_identifier: recipient,
        amount: numericAmount,
        currency,
        transfer_method: transferMethod,
        note: note || 'Disbursement',
        security_pin: pin,
        idempotency_key: idempotencyKey,
      });

      setSuccessReceipt(receipt);
      if (soundEnabled) sounds.playSuccess();
      onTransferSuccess();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Transfer rejected by gateway.');
      }
      if (soundEnabled) sounds.playDanger();
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text);
      setCopiedLink(true);
      if (soundEnabled) sounds.playClick();
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const downloadSvgQr = () => {
    if (!qrData?.svg_qr) return;
    const blob = new Blob([qrData.svg_qr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ApexFin_Payment_QR_${qrCurrency}_${qrAmount}.svg`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-emerald-500/10 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 id="transfer-modal-title" className="text-lg font-bold text-white">
                Multi-Currency & UPI Payment Hub
              </h2>
              <p className="text-xs text-slate-400">
                Idempotent P2P transfer, dynamic QR code engine & multi-currency settlement
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close transfer modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 mt-4 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('send');
              if (soundEnabled) sounds.playClick();
            }}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
              activeTab === 'send'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Payment</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('receive');
              if (soundEnabled) sounds.playClick();
            }}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
              activeTab === 'receive'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Receive via QR Code</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('scan');
              if (soundEnabled) sounds.playClick();
            }}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
              activeTab === 'scan'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Scan className="w-3.5 h-3.5" />
            <span>Scan / Paste QR</span>
          </button>
        </div>

        {/* TAB 1: SEND PAYMENT */}
        {activeTab === 'send' && (
          <div>
            {successReceipt ? (
              <div className="mt-5 space-y-4">
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/30 space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                    <div>
                      <h3 className="text-sm font-semibold text-white">Payment Successfully Disbursed</h3>
                      <p className="text-xs text-emerald-300 font-mono">
                        ID: {successReceipt.transfer_id}
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-emerald-800/40 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block">Recipient</span>
                      <span className="text-white font-medium">{successReceipt.recipient}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Amount Sent</span>
                      <span className="text-emerald-300 font-bold tabular-nums">
                        {successReceipt.currency} {parseFloat(successReceipt.amount).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Debit Source</span>
                      <span className="text-slate-300 font-mono">
                        {successReceipt.source_currency} {parseFloat(successReceipt.debit_amount_source || successReceipt.amount).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Method</span>
                      <span className="text-slate-300 uppercase font-mono">
                        {successReceipt.transfer_method}
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-300 pt-1">
                    {successReceipt.message}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSuccessReceipt(null);
                      setIdempotencyKey(`idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition"
                  >
                    Send Another Payment
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 transition active:scale-98"
                  >
                    Done & Return
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleTransfer} className="mt-5 space-y-4">
                {error && (
                  <div className="p-3 rounded-xl border border-red-500/30 bg-red-950/30 text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Transfer Channel Selector */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Payment Method / Destination Channel
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTransferMethod('upi');
                        if (!recipient.includes('@')) setRecipient('alex@okapexbank');
                      }}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-medium text-center transition ${
                        transferMethod === 'upi'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      UPI ID (VPA)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTransferMethod('userid');
                        setRecipient('usr_maya_01');
                      }}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-medium text-center transition ${
                        transferMethod === 'userid'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      ApexFin User ID
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTransferMethod('email');
                        setRecipient('maya@creative.studio');
                      }}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-medium text-center transition ${
                        transferMethod === 'email'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      Email Address
                    </button>
                  </div>
                </div>

                {/* Recipient Identifier */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-slate-300">
                      {transferMethod === 'upi'
                        ? 'Recipient UPI ID (Virtual Payment Address)'
                        : transferMethod === 'userid'
                        ? 'ApexFin User ID (e.g. usr_maya_01)'
                        : 'Recipient Email Address'}
                    </label>
                    {lookingUp && <span className="text-[10px] text-slate-400 animate-pulse">Verifying...</span>}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder={
                      transferMethod === 'upi'
                        ? 'username@okhdfcbank or merchant@upi'
                        : transferMethod === 'userid'
                        ? 'usr_maya_01 or usr_alex_01'
                        : 'maya@creative.studio'
                    }
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition font-mono"
                  />

                  {/* Recipient Verification Status Badge */}
                  {lookupResult && (
                    <div className="mt-1.5 p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-[10px]">
                          {lookupResult.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-white font-medium">{lookupResult.name}</span>
                      </div>
                      {lookupResult.is_registered_user ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                          <UserCheck className="w-3 h-3" />
                          ApexFin Registered (Instant Credit)
                        </span>
                      ) : lookupResult.is_valid_upi ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-cyan-400 font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                          <Check className="w-3 h-3" />
                          Valid UPI VPA
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">External Recipient</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Amount and Currency Selection */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-slate-300">Amount & Currency</label>
                    <span className="text-[11px] text-slate-400">
                      Liquid Available: <strong className="text-emerald-400 font-mono">${liquidBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 relative">
                      <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                    <div>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full px-2 py-2 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs font-semibold focus:outline-none focus:border-emerald-500 transition"
                      >
                        {SUPPORTED_CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.flag} {c.code} ({c.symbol})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Multi-Currency Conversion Preview */}
                  <div className="mt-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-[11px] text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Estimated checking debit:</span>
                      <strong className="text-emerald-400 font-mono">
                        ${estimatedUsdDebit.toFixed(2)} USD
                      </strong>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      1 USD = {EXCHANGE_RATES_TO_USD[currency] || 1.0} {currency}
                    </span>
                  </div>

                  {/* Preset amounts */}
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {[
                      { label: '+50', val: '50.00' },
                      { label: '+100', val: '100.00' },
                      { label: '+500', val: '500.00' },
                      { label: '+1000', val: '1000.00' },
                    ].map((p) => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => setAmount(p.val)}
                        className="py-1 rounded-lg border border-slate-800 bg-slate-950/60 hover:border-emerald-500/40 text-[11px] font-mono text-slate-300 hover:text-white transition"
                      >
                        {p.label} {currency}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Note & Security PIN */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Payment Purpose / Memo
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Design review milestone"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Security PIN
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      required
                      placeholder="1234"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs font-mono text-center tracking-widest placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>

                {/* Idempotency Key Guard Badge */}
                <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="shrink-0">Idempotency Guard:</span>
                    <span className="font-mono text-slate-300 truncate">{idempotencyKey}</span>
                  </div>
                  <button
                    type="button"
                    title="Regenerate idempotency key"
                    onClick={() => setIdempotencyKey(`idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`)}
                    className="p-1 text-slate-500 hover:text-slate-300 transition"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 transition active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {loading
                      ? 'Authorizing Multi-Currency Transfer...'
                      : `Authorize & Send ${currency} ${parseFloat(amount || '0').toFixed(2)}`}
                  </span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* TAB 2: RECEIVE VIA DYNAMIC QR CODE GENERATOR */}
        {activeTab === 'receive' && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-800 bg-slate-950/80">
              {generatingQr ? (
                <div className="w-48 h-48 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
                </div>
              ) : qrData?.svg_qr ? (
                <div
                  className="w-48 h-48 rounded-xl overflow-hidden shadow-lg p-2 bg-white"
                  dangerouslySetInnerHTML={{ __html: qrData.svg_qr }}
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-slate-500 text-xs">
                  Generate QR code below
                </div>
              )}

              <div className="mt-3 text-center">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {qrData?.qr_type === 'upi' ? '⚡ UPI Standard QR' : 'ApexFin P2P QR'}
                </span>
                <p className="text-xs text-white font-medium mt-1">{qrName}</p>
                <p className="text-[11px] font-mono text-slate-400">{qrIdentifier}</p>
                <p className="text-sm font-bold text-emerald-400 font-mono mt-1">
                  {qrCurrency} {parseFloat(qrAmount || '0').toFixed(2)}
                </p>
              </div>

              {/* Action Buttons for QR */}
              <div className="flex gap-2 mt-3 w-full">
                <button
                  type="button"
                  onClick={() => copyToClipboard(qrData?.qr_payload || '')}
                  className="flex-1 py-1.5 px-3 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 transition"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied URI' : 'Copy Pay Link'}</span>
                </button>
                <button
                  type="button"
                  onClick={downloadSvgQr}
                  className="py-1.5 px-3 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 transition"
                  title="Download Vector SVG"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>SVG</span>
                </button>
              </div>
            </div>

            {/* Customizer for Receiving QR */}
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Your UPI ID / Payee ID
                  </label>
                  <input
                    type="text"
                    value={qrIdentifier}
                    onChange={(e) => setQrIdentifier(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs font-mono focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={qrName}
                    onChange={(e) => setQrName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Requested Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={qrAmount}
                    onChange={(e) => setQrAmount(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs font-mono focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Currency
                  </label>
                  <select
                    value={qrCurrency}
                    onChange={(e) => setQrCurrency(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs font-semibold focus:outline-none focus:border-emerald-500 transition"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Payment Note / Invoice Ref
                </label>
                <input
                  type="text"
                  value={qrNote}
                  onChange={(e) => setQrNote(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <button
                type="button"
                onClick={refreshQrCode}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Regenerate Dynamic QR</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: SCAN / PASTE QR CODE */}
        {activeTab === 'scan' && (
          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Paste UPI QR URI or ApexFin Payment Link
              </label>
              <textarea
                rows={3}
                placeholder="Paste upi://pay?pa=merchant@upi&pn=Store&am=250&cu=INR or apexfin://pay?to=usr_maya_01&am=100&cu=USD"
                value={scannedUri}
                onChange={(e) => handleParseUri(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition resize-none"
              />
            </div>

            {/* Quick Demo QR Links */}
            <div>
              <span className="text-[11px] text-slate-400 block mb-1">Quick Sample QR Links to Test:</span>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => handleParseUri('upi://pay?pa=alex@okhdfcbank&pn=Alex+Rivera&am=8350.00&cu=INR&tn=Consulting+Retainer')}
                  className="w-full text-left p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 text-[11px] font-mono text-cyan-300 truncate block transition"
                >
                  upi://pay?pa=alex@okhdfcbank&am=8350.00&cu=INR
                </button>
                <button
                  type="button"
                  onClick={() => handleParseUri('apexfin://pay?to=usr_maya_01&am=250.00&cu=USD&memo=UI+Sprint+Q4')}
                  className="w-full text-left p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 text-[11px] font-mono text-emerald-300 truncate block transition"
                >
                  apexfin://pay?to=usr_maya_01&am=250.00&cu=USD
                </button>
              </div>
            </div>

            {/* Parsed Result Display */}
            {parsedQrInfo && (
              <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">{parsedQrInfo.type} Detected</span>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/10">
                    Ready
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-emerald-800/30">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Payee / VPA</span>
                    <span className="text-white font-mono font-medium">{parsedQrInfo.pa}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Amount</span>
                    <span className="text-emerald-300 font-bold font-mono">
                      {parsedQrInfo.cu || 'INR'} {parsedQrInfo.am || '0.00'}
                    </span>
                  </div>
                  {parsedQrInfo.tn && (
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[11px]">Memo / Purpose</span>
                      <span className="text-slate-300">{parsedQrInfo.tn}</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleApplyParsedQr}
                  className="w-full mt-2 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20"
                >
                  <span>Apply & Proceed to Pay</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
