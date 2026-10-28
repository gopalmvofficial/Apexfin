'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Camera,
  CameraOff,
  Flashlight,
  Image as ImageIcon,
  ArrowLeft,
  Lock,
  Sparkles,
  Building2,
  ChevronDown,
  Gift,
  Share2,
} from 'lucide-react';
import jsQR from 'jsqr';
import { apiClient } from '@/lib/api-client';
import { sounds } from '@/lib/sound-effects';
import { convertCurrencyClient } from '@/lib/formatters';

interface PaymentTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  liquidBalance: number;
  soundEnabled: boolean;
  onTransferSuccess: () => void;
}

type ModalTab = 'scan' | 'send' | 'receive';
type ModalStep = 'view' | 'confirm_pay' | 'pin_pad' | 'success';

interface ParsedUPI {
  pa: string; // Payee VPA
  pn: string; // Payee Name
  am: string; // Amount
  cu: string; // Currency
  tn: string; // Note / Transaction ref
  verifiedMerchant?: boolean;
}

const DEMO_UPI_QRS = [
  {
    name: 'Starbucks Coffee',
    vpa: 'starbucks@okhdfcbank',
    amount: '240.00',
    currency: 'INR',
    note: 'Caramel Macchiato #4092',
    merchant: true,
    tag: 'Coffee & Cafe',
    category: 'Dining',
  },
  {
    name: 'Swiggy Food & Grocery',
    vpa: 'swiggy@okaxis',
    amount: '380.00',
    currency: 'INR',
    note: 'Order #SW-98102',
    merchant: true,
    tag: 'Food Delivery',
    category: 'Groceries',
  },
  {
    name: 'Supermoney Store',
    vpa: 'superstore@superyes',
    amount: '99.00',
    currency: 'INR',
    note: 'Supercashback Special',
    merchant: true,
    tag: '5% Instant Cashback',
    category: 'Shopping',
  },
  {
    name: 'Maya Sharma (P2P)',
    vpa: 'maya.sharma@oksbi',
    amount: '1200.00',
    currency: 'INR',
    note: 'Dinner bill split',
    merchant: false,
    tag: 'Personal Transfer',
    category: 'Transfer',
  },
];

export function PaymentTransferModal({
  isOpen,
  onClose,
  liquidBalance,
  soundEnabled,
  onTransferSuccess,
}: PaymentTransferModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>('scan');
  const [step, setStep] = useState<ModalStep>('view');

  // Scanner & Video Stream State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const scanLoopId = useRef<number | null>(null);

  // Active Payment State
  const [payee, setPayee] = useState<ParsedUPI>({
    pa: 'starbucks@okhdfcbank',
    pn: 'Starbucks Coffee',
    am: '240.00',
    cu: 'INR',
    tn: 'Coffee & Snacks',
    verifiedMerchant: true,
  });
  const [customAmount, setCustomAmount] = useState('240.00');
  const [customNote, setCustomNote] = useState('');
  const [selectedBank, setSelectedBank] = useState('ApexFin Instant Checking •••• 4242');

  // UPI PIN Pad State
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  // Success / Receipt State
  const [receipt, setReceipt] = useState<{
    utr: string;
    txnId: string;
    amount: string;
    currency: string;
    payeeName: string;
    payeeVpa: string;
    note: string;
    timestamp: string;
    cashbackEarned: number;
  } | null>(null);
  const [scratchcardRevealed, setScratchcardRevealed] = useState(false);

  // Direct Pay / UPI Input Form State
  const [manualVpa, setManualVpa] = useState('alex@okapexbank');
  const [manualAmount, setManualAmount] = useState('100.00');
  const [manualCurrency, setManualCurrency] = useState('INR');
  const [manualNote, setManualNote] = useState('Payment via ApexFin');

  // Receive / Personal QR Code State
  const [myVpa, setMyVpa] = useState('alex.rivera@okapexfin');
  const [myQrName, setMyQrName] = useState('Alex Rivera');
  const [myQrAmount, setMyQrAmount] = useState('');
  const [myQrSvg, setMyQrSvg] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [generatingQr, setGeneratingQr] = useState(false);

  // Calculate USD equivalent
  const numericAmount = parseFloat(customAmount) || 0;
  const estimatedUsdDebit = convertCurrencyClient(numericAmount, payee.cu || 'INR', 'USD');

  // Initialize on open
  useEffect(() => {
    if (isOpen) {
      setStep('view');
      setPin('');
      setPinError(null);
      setReceipt(null);
      setScratchcardRevealed(false);
      const user = apiClient.getStoredUser();
      if (user) {
        setMyQrName(user.name || 'Alex Rivera');
        setMyVpa(user.email.replace('@', '.') + '@okapexfin');
      }
    }
  }, [isOpen]);

  // Clean up camera stream on unmount or tab change
  const stopCamera = useCallback(() => {
    if (scanLoopId.current) {
      cancelAnimationFrame(scanLoopId.current);
      scanLoopId.current = null;
    }
    if (videoTrack) {
      videoTrack.stop();
      setVideoTrack(null);
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setTorchOn(false);
  }, [videoTrack]);

  // Start Live Camera
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera access is not supported by your browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);

        const track = stream.getVideoTracks()[0];
        setVideoTrack(track);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setCameraError('Camera access denied. You can still scan by uploading an image or picking a demo QR below.');
      } else {
        setCameraError('Unable to open camera stream.');
      }
      setCameraActive(false);
    }
  }, []);

  // Parse UPI URI string
  const parseUpiUri = useCallback((rawUri: string): ParsedUPI | null => {
    const trimmed = rawUri.trim();
    if (!trimmed) return null;

    try {
      if (trimmed.startsWith('upi://pay') || trimmed.includes('pa=')) {
        const dummyUrl = trimmed.startsWith('http')
          ? new URL(trimmed)
          : new URL(trimmed.replace('upi://pay', 'http://upi.dummy'));

        const pa = dummyUrl.searchParams.get('pa') || '';
        const pn = decodeURIComponent(dummyUrl.searchParams.get('pn') || '').replace(/\+/g, ' ') || pa.split('@')[0];
        const am = dummyUrl.searchParams.get('am') || '';
        const cu = dummyUrl.searchParams.get('cu') || 'INR';
        const tn = decodeURIComponent(dummyUrl.searchParams.get('tn') || '').replace(/\+/g, ' ') || '';

        return {
          pa,
          pn: pn || 'Verified UPI Merchant',
          am: am || '100.00',
          cu,
          tn,
          verifiedMerchant: pa.includes('merchant') || pa.includes('hdfc') || pa.includes('axis') || pa.includes('super'),
        };
      } else if (trimmed.includes('@')) {
        // Raw VPA format e.g. name@okhdfcbank
        return {
          pa: trimmed,
          pn: trimmed.split('@')[0],
          am: '100.00',
          cu: 'INR',
          tn: 'UPI Transfer',
          verifiedMerchant: false,
        };
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // Handle scanned or selected QR
  const handleDecodedQR = useCallback(
    (qrText: string) => {
      const parsed = parseUpiUri(qrText);
      if (parsed && parsed.pa) {
        sounds.playScannerBeep();
        stopCamera();
        setPayee(parsed);
        setCustomAmount(parsed.am || '240.00');
        setCustomNote(parsed.tn || '');
        setStep('confirm_pay');
      } else {
        // Fallback demo match
        const matchedDemo = DEMO_UPI_QRS.find((d) => qrText.toLowerCase().includes(d.name.toLowerCase()) || qrText.includes(d.vpa));
        if (matchedDemo) {
          sounds.playScannerBeep();
          stopCamera();
          setPayee({
            pa: matchedDemo.vpa,
            pn: matchedDemo.name,
            am: matchedDemo.amount,
            cu: matchedDemo.currency,
            tn: matchedDemo.note,
            verifiedMerchant: matchedDemo.merchant,
          });
          setCustomAmount(matchedDemo.amount);
          setCustomNote(matchedDemo.note);
          setStep('confirm_pay');
        }
      }
    },
    [parseUpiUri, stopCamera]
  );

  // QR Frame Reader Loop
  useEffect(() => {
    if (!isOpen || activeTab !== 'scan' || step !== 'view') {
      stopCamera();
      return;
    }

    startCamera();

    let isScanning = true;
    const scanFrame = () => {
      if (!isScanning) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data) {
            handleDecodedQR(code.data);
            return;
          }
        }
      }

      scanLoopId.current = requestAnimationFrame(scanFrame);
    };

    scanLoopId.current = requestAnimationFrame(scanFrame);

    return () => {
      isScanning = false;
      stopCamera();
    };
  }, [isOpen, activeTab, step, startCamera, stopCamera, handleDecodedQR]);

  // Flashlight toggle
  const toggleTorch = async () => {
    if (!videoTrack) return;
    try {
      const nextTorch = !torchOn;
      await (videoTrack as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
      sounds.playTick();
    } catch {
      // Torch not supported on desktop or front camera
    }
  };

  // Image Upload Scan
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            handleDecodedQR(code.data);
          } else {
            alert('No valid UPI QR code detected in the selected image. Please try another clear screenshot.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Quick select demo QR
  const handleSelectDemo = (demo: (typeof DEMO_UPI_QRS)[0]) => {
    sounds.playScannerBeep();
    stopCamera();
    setPayee({
      pa: demo.vpa,
      pn: demo.name,
      am: demo.amount,
      cu: demo.currency,
      tn: demo.note,
      verifiedMerchant: demo.merchant,
    });
    setCustomAmount(demo.amount);
    setCustomNote(demo.note);
    setStep('confirm_pay');
  };

  // Process payment with UPI PIN
  const handleExecutePayment = async () => {
    if (pin.length < 4) {
      setPinError('Please enter a 4-digit UPI PIN.');
      sounds.playDanger();
      return;
    }

    setProcessingPayment(true);
    setPinError(null);

    try {
      const debitAmount = parseFloat(customAmount) || 0;
      await apiClient.sendPaymentTransfer({
        recipient_identifier: payee.pa,
        amount: debitAmount,
        currency: payee.cu,
        transfer_method: 'upi',
        note: customNote || 'Google Pay / Supermoney UPI Transfer',
        security_pin: pin,
        idempotency_key: `upi_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      });

      // Generate authentic 12-digit UPI UTR
      const utr = Math.floor(100000000000 + Math.random() * 900000000000).toString();
      const txnId = `APX${Date.now().toString().slice(-8)}`;
      const cashback = Math.min(25, Math.max(5, Math.round(debitAmount * 0.05)));

      setReceipt({
        utr,
        txnId,
        amount: customAmount,
        currency: payee.cu,
        payeeName: payee.pn,
        payeeVpa: payee.pa,
        note: customNote || 'Payment to merchant',
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          month: 'short',
          day: 'numeric',
        }),
        cashbackEarned: cashback,
      });

      sounds.playUpiSuccessChime();
      setStep('success');
      onTransferSuccess();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setPinError(err.message);
      } else {
        setPinError('UPI Payment gateway error. Please verify your PIN and balance.');
      }
      sounds.playDanger();
    } finally {
      setProcessingPayment(false);
    }
  };

  // Keyboard numeric listener for PIN pad
  useEffect(() => {
    if (step !== 'pin_pad') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        if (pin.length < 4) {
          sounds.playTick();
          setPin((prev) => (prev.length < 4 ? prev + e.key : prev));
        }
      } else if (e.key === 'Backspace') {
        sounds.playTick();
        setPin((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        if (pin.length === 4) {
          handleExecutePayment();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, pin]);

  // Generate My QR Code for Receive tab
  const handleGenerateMyQr = useCallback(async () => {
    setGeneratingQr(true);
    try {
      const amt = parseFloat(myQrAmount);
      const res = await apiClient.generatePaymentQRCode({
        recipient_identifier: myVpa,
        recipient_name: myQrName,
        amount: isNaN(amt) ? undefined : amt,
        currency: 'INR',
        note: 'ApexFin Payment',
      });
      setMyQrSvg(res.svg_qr);
    } catch {
      // Fallback
    } finally {
      setGeneratingQr(false);
    }
  }, [myVpa, myQrName, myQrAmount]);

  useEffect(() => {
    if (isOpen && activeTab === 'receive') {
      handleGenerateMyQr();
    }
  }, [isOpen, activeTab, handleGenerateMyQr]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upi-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-emerald-500/10 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2">
            {step !== 'view' && step !== 'success' && (
              <button
                onClick={() => {
                  sounds.playTick();
                  if (step === 'pin_pad') setStep('confirm_pay');
                  else {
                    setStep('view');
                    startCamera();
                  }
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition mr-1"
                title="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Scan className="w-4 h-4" />
            </div>
            <div>
              <h2 id="upi-modal-title" className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>ApexFin UPI Hub</span>
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  GPay & Supermoney
                </span>
              </h2>
            </div>
          </div>

          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            aria-label="Close transfer modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation (Shown only on initial view) */}
        {step === 'view' && (
          <div className="flex border-b border-slate-800 bg-slate-950/40 px-2">
            <button
              onClick={() => {
                sounds.playTick();
                setActiveTab('scan');
              }}
              className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
                activeTab === 'scan'
                  ? 'border-emerald-400 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Scan Any QR</span>
            </button>
            <button
              onClick={() => {
                sounds.playTick();
                stopCamera();
                setActiveTab('send');
              }}
              className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
                activeTab === 'send'
                  ? 'border-emerald-400 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Pay UPI / Mobile</span>
            </button>
            <button
              onClick={() => {
                sounds.playTick();
                stopCamera();
                setActiveTab('receive');
              }}
              className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
                activeTab === 'receive'
                  ? 'border-emerald-400 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>My QR / Receive</span>
            </button>
          </div>
        )}

        {/* BODY CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* ================= STEP 1: SCANNER VIEW ================= */}
          {step === 'view' && activeTab === 'scan' && (
            <div className="space-y-4">
              {/* Google Pay / Supermoney Live Camera Viewfinder */}
              <div className="relative w-full aspect-square max-w-[320px] mx-auto rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-inner flex items-center justify-center">
                {/* Live Camera Video Feed */}
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline
                  autoPlay
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Camera Fallback / Inactive Notice */}
                {!cameraActive && (
                  <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4 text-center z-10 space-y-2">
                    <CameraOff className="w-8 h-8 text-slate-500 animate-pulse" />
                    <p className="text-xs text-slate-300 font-medium">Camera Feed Standby</p>
                    <p className="text-[11px] text-slate-400 max-w-[220px]">
                      {cameraError || 'Hold any QR code in front of camera or select an instant test merchant below.'}
                    </p>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition"
                    >
                      Enable Camera
                    </button>
                  </div>
                )}

                {/* Viewfinder Overlay with 4 Corner Brackets and Scanning Laser */}
                {cameraActive && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-56 h-56 relative rounded-2xl">
                      {/* 4 Glowing Corner Brackets */}
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl shadow-sm" />
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl shadow-sm" />
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl shadow-sm" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl shadow-sm" />

                      {/* Animated Laser Scanning Beam */}
                      <div className="absolute left-2 right-2 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#10b981] animate-pulse top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                )}

                {/* Floating Torch and Gallery Overlay Controls */}
                <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-3 z-20">
                  <button
                    type="button"
                    onClick={toggleTorch}
                    title="Toggle Flashlight"
                    className={`p-2.5 rounded-full backdrop-blur-md border transition shadow-lg ${
                      torchOn
                        ? 'bg-amber-500 text-white border-amber-400'
                        : 'bg-slate-900/80 text-slate-200 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    <Flashlight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Scan QR from Gallery Photo"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold transition shadow-lg"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                    <span>Upload Image</span>
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="text-center">
                <p className="text-xs text-slate-300 font-medium">
                  Scan any UPI QR code (Google Pay, PhonePe, Paytm, Supermoney)
                </p>
                <p className="text-[11px] text-slate-400">Instant camera detection or 1-tap demo test below</p>
              </div>

              {/* Instant 1-Tap Demo Merchant QRs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Or Test With Live Merchant QRs
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">1-Tap Scan</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {DEMO_UPI_QRS.map((demo) => (
                    <button
                      key={demo.name}
                      type="button"
                      onClick={() => handleSelectDemo(demo)}
                      className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/70 hover:border-emerald-500/50 hover:bg-emerald-950/20 text-left transition group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition truncate">
                          {demo.name}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400 font-bold">
                          ₹{demo.amount}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">{demo.vpa}</div>
                      <div className="text-[9px] text-slate-500 mt-1 flex items-center justify-between">
                        <span>{demo.tag}</span>
                        <ArrowRight className="w-2.5 h-2.5 text-slate-400 group-hover:translate-x-0.5 transition" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: MANUAL UPI / MOBILE PAY ================= */}
          {step === 'view' && activeTab === 'send' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Enter UPI ID or 10-Digit Mobile Number
                  </label>
                  <input
                    type="text"
                    value={manualVpa}
                    onChange={(e) => setManualVpa(e.target.value)}
                    placeholder="name@okhdfcbank or 9876543210"
                    className="w-full px-3 py-2 rounded-xl border border-slate-800 bg-slate-900 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
                  />
                  {/* Quick Handle Chips */}
                  <div className="flex items-center gap-1.5 mt-2 overflow-x-auto text-[10px]">
                    <span className="text-slate-500 shrink-0">Handles:</span>
                    {['@okhdfcbank', '@okaxis', '@oksbi', '@paytm', '@superyes'].map((handle) => (
                      <button
                        key={handle}
                        type="button"
                        onClick={() => {
                          const base = manualVpa.split('@')[0] || 'merchant';
                          setManualVpa(`${base}${handle}`);
                        }}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono border border-slate-700 transition shrink-0"
                      >
                        {handle}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        value={manualAmount}
                        onChange={(e) => setManualAmount(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-800 bg-slate-900 text-white text-xs font-mono focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Currency</label>
                    <select
                      value={manualCurrency}
                      onChange={(e) => setManualCurrency(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-800 bg-slate-900 text-white text-xs font-medium focus:outline-none focus:border-emerald-500 transition"
                    >
                      <option value="INR">🇮🇳 INR (₹)</option>
                      <option value="USD">🇺🇸 USD ($)</option>
                      <option value="EUR">🇪🇺 EUR (€)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Add a Note</label>
                  <input
                    type="text"
                    value={manualNote}
                    onChange={(e) => setManualNote(e.target.value)}
                    placeholder="e.g. Dinner, rent, supplies"
                    className="w-full px-3 py-2 rounded-xl border border-slate-800 bg-slate-900 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  sounds.playTick();
                  setPayee({
                    pa: manualVpa.includes('@') ? manualVpa : `${manualVpa}@upi`,
                    pn: manualVpa.split('@')[0],
                    am: manualAmount,
                    cu: manualCurrency,
                    tn: manualNote,
                    verifiedMerchant: false,
                  });
                  setCustomAmount(manualAmount);
                  setCustomNote(manualNote);
                  setStep('confirm_pay');
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition active:scale-98 flex items-center justify-center gap-1.5"
              >
                <span>Proceed to Pay</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* ================= TAB 3: RECEIVE / PERSONAL QR ================= */}
          {step === 'view' && activeTab === 'receive' && (
            <div className="space-y-4 text-center">
              <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950 flex flex-col items-center">
                <div className="text-xs font-bold text-white mb-1">{myQrName}</div>
                <div className="text-[11px] text-emerald-400 font-mono mb-3">{myVpa}</div>

                {/* QR Code SVG Display */}
                <div className="w-48 h-48 bg-white p-3 rounded-xl shadow-lg flex items-center justify-center">
                  {generatingQr ? (
                    <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
                  ) : myQrSvg ? (
                    <div
                      className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                      dangerouslySetInnerHTML={{ __html: myQrSvg }}
                    />
                  ) : (
                    <QrCode className="w-36 h-36 text-slate-900" />
                  )}
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof navigator !== 'undefined') {
                        navigator.clipboard.writeText(myVpa);
                        setCopiedLink(true);
                        sounds.playClick();
                        setTimeout(() => setCopiedLink(false), 2000);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copied VPA' : 'Copy UPI ID'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!myQrSvg) return;
                      const blob = new Blob([myQrSvg], { type: 'image/svg+xml' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `ApexFin_UPI_QR_${myVpa}.svg`;
                      document.body.appendChild(a);
                      a.click();
                      URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download QR</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 2: GOOGLE PAY / SUPERMONEY PAYMENT SHEET ================= */}
          {step === 'confirm_pay' && (
            <div className="space-y-4">
              {/* Payee Profile Card */}
              <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/80 text-center space-y-2">
                <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 p-[2px] shadow-lg shadow-emerald-500/20">
                  <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center font-bold text-white text-lg">
                    {payee.pn.slice(0, 2).toUpperCase()}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-center gap-1.5">
                    <h3 className="text-base font-bold text-white">{payee.pn}</h3>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  </div>
                  <p className="text-xs text-slate-400 font-mono">{payee.pa}</p>
                  <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Banking Name: {payee.pn.toUpperCase()}
                  </span>
                </div>

                {/* Amount Input (Google Pay Big Typography) */}
                <div className="pt-3">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-2xl font-bold text-slate-300">
                      {payee.cu === 'INR' ? '₹' : '$'}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className="text-3xl font-extrabold text-white text-center bg-transparent border-b border-slate-700 focus:border-emerald-500 focus:outline-none w-44 tabular-nums font-mono py-1"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Checking debit approx: <strong className="text-emerald-400 font-mono">${estimatedUsdDebit.toFixed(2)} USD</strong>
                  </p>
                </div>

                {/* Note Field */}
                <div className="pt-2">
                  <input
                    type="text"
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="Add a note (e.g. Coffee, rent, dinner)"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-center text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Supermoney 5% Cashback Banner */}
              <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/30 flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-emerald-300">Supermoney 5% Instant SuperCash</div>
                  <div className="text-[10px] text-slate-400">
                    Earn up to 5% instant cashback deposited directly into your balance.
                  </div>
                </div>
              </div>

              {/* Paying From Bank Selector */}
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  <div>
                    <span className="text-[10px] text-slate-400 block">Paying from</span>
                    <span className="text-xs font-semibold text-white">{selectedBank}</span>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                  ${liquidBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Proceed Button */}
              <button
                type="button"
                onClick={() => {
                  sounds.playTick();
                  setStep('pin_pad');
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 transition active:scale-98 flex items-center justify-center gap-2"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Pay {payee.cu === 'INR' ? '₹' : '$'}{customAmount}</span>
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Secured by NPCI 256-bit AES encryption</span>
              </div>
            </div>
          )}

          {/* ================= STEP 3: AUTHENTIC NPCI UPI PIN SCREEN ================= */}
          {step === 'pin_pad' && (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  NPCI UPI Gateway
                </span>
                <h3 className="text-sm font-bold text-white">ENTER 4-DIGIT UPI PIN</h3>
                <p className="text-xs text-slate-400">
                  Paying to <strong className="text-emerald-400">{payee.pn}</strong> •{' '}
                  <span className="font-mono">{payee.cu === 'INR' ? '₹' : '$'}{customAmount}</span>
                </p>
              </div>

              {pinError && (
                <div className="p-2.5 rounded-xl border border-red-500/30 bg-red-950/40 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{pinError}</span>
                </div>
              )}

              {/* 4 Masked PIN Indicator Circles */}
              <div className="flex items-center justify-center gap-4 py-3">
                {[0, 1, 2, 3].map((idx) => {
                  const filled = pin.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                        filled
                          ? 'bg-emerald-400 border-emerald-400 scale-110 shadow-sm shadow-emerald-400/50'
                          : 'border-slate-600 bg-slate-900'
                      }`}
                    />
                  );
                })}
              </div>

              {/* On-Screen Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto pt-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => {
                      sounds.playTick();
                      if (pin.length < 4) setPin((prev) => prev + digit);
                    }}
                    className="py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white font-bold text-base transition active:scale-95 shadow-sm"
                  >
                    {digit}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    sounds.playTick();
                    setPin((prev) => prev.slice(0, -1));
                  }}
                  className="py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-bold text-xs transition active:scale-95"
                >
                  ⌫
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sounds.playTick();
                    if (pin.length < 4) setPin((prev) => prev + '0');
                  }}
                  className="py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white font-bold text-base transition active:scale-95 shadow-sm"
                >
                  0
                </button>

                <button
                  type="button"
                  disabled={pin.length !== 4 || processingPayment}
                  onClick={handleExecutePayment}
                  className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition active:scale-95 flex items-center justify-center shadow-lg shadow-emerald-600/30"
                >
                  {processingPayment ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-5 h-5" />
                  )}
                </button>
              </div>

              <div className="text-center text-[10px] text-slate-500 pt-1">
                Demo UPI PIN: <code className="text-slate-300">1234</code> or any 4 digits
              </div>
            </div>
          )}

          {/* ================= STEP 4: GOOGLE PAY / SUPERMONEY CELEBRATION SCREEN ================= */}
          {step === 'success' && receipt && (
            <div className="space-y-4 text-center animate-in zoom-in-95 duration-200">
              {/* Green Circular Ripple Animation */}
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 shadow-xl shadow-emerald-500/40">
                  <Check className="w-9 h-9 stroke-[3]" />
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-black text-white tracking-tight">
                  {receipt.currency === 'INR' ? '₹' : '$'}{receipt.amount}
                </h3>
                <p className="text-xs text-emerald-400 font-semibold mt-0.5">
                  Paid to {receipt.payeeName}
                </p>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">{receipt.payeeVpa}</p>
              </div>

              {/* Supermoney Interactive Scratchcard */}
              <div
                onClick={() => {
                  if (!scratchcardRevealed) {
                    setScratchcardRevealed(true);
                    sounds.playSuccess();
                  }
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  scratchcardRevealed
                    ? 'border-amber-500/50 bg-gradient-to-tr from-amber-950/40 via-yellow-900/30 to-amber-900/20'
                    : 'border-indigo-500/40 bg-gradient-to-tr from-indigo-950/60 via-purple-950/40 to-slate-900 shadow-lg hover:border-indigo-400'
                }`}
              >
                {!scratchcardRevealed ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gift className="w-5 h-5 text-indigo-400 animate-bounce" />
                      <div className="text-left">
                        <span className="text-xs font-bold text-white block">SuperCash Scratchcard</span>
                        <span className="text-[10px] text-indigo-300">Tap to reveal instant cashback</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Tap to Scratch
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between animate-in zoom-in-95">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-400 animate-spin" />
                      <div className="text-left">
                        <span className="text-xs font-bold text-amber-300 block">
                          🎉 Won ₹{receipt.cashbackEarned} SuperCash!
                        </span>
                        <span className="text-[10px] text-slate-300">
                          Credited instantly to your checking account
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-black text-amber-300 font-mono">
                      +₹{receipt.cashbackEarned}
                    </span>
                  </div>
                )}
              </div>

              {/* Transaction Metadata Card */}
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-950 text-left text-xs space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">UPI Ref (UTR):</span>
                  <span className="text-slate-200 font-bold">{receipt.utr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Transaction ID:</span>
                  <span className="text-slate-200">{receipt.txnId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">From Account:</span>
                  <span className="text-slate-200">ApexFin •••• 4242</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Timestamp:</span>
                  <span className="text-slate-300">{receipt.timestamp}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playTick();
                    setStep('view');
                    setActiveTab('scan');
                    startCamera();
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition"
                >
                  Scan Another QR
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/25 transition active:scale-98"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
