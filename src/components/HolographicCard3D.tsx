'use client';

import React, { useState, useRef } from 'react';
import { Wifi, ShieldCheck, ShieldAlert, Sparkles, CreditCard } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface HolographicCard3DProps {
  cardholderName: string;
  balance: number;
  safetyBuffer: number;
  currency?: string;
  accountName: string;
}

export function HolographicCard3D({
  cardholderName,
  balance,
  safetyBuffer,
  currency = 'USD',
  accountName,
}: HolographicCard3DProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });

  const isSafe = balance >= safetyBuffer;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = ((y - centerY) / centerY) * -12; // tilt degrees
    const rotY = ((x - centerX) / centerX) * 12;

    setRotateX(rotX);
    setRotateY(rotY);
    setGlarePos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.45,
    });
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setGlarePos((prev) => ({ ...prev, opacity: 0 }));
  };

  return (
    <div
      className="relative w-full max-w-sm mx-auto select-none"
      style={{ perspective: '1200px' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      role="region"
      aria-label="Interactive 3D Liquidity Card"
    >
      <div
        ref={cardRef}
        className="w-full h-52 rounded-2xl p-5 relative overflow-hidden transition-transform duration-150 ease-out shadow-2xl border border-white/15 cursor-pointer backdrop-blur-xl"
        style={{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.6), inset 0 1px 1px 0 rgba(255, 255, 255, 0.2)',
        }}
      >
        {/* Specular Glare Sheen Reflection Layer */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            opacity: glarePos.opacity,
            background: `radial-gradient(circle 240px at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.25) 0%, transparent 80%)`,
          }}
        />

        {/* Ambient Holographic Hue Overlay */}
        <div
          className="absolute -right-12 -top-12 w-44 h-44 rounded-full blur-2xl pointer-events-none"
          style={{
            background: isSafe
              ? 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(245, 158, 11, 0.3) 0%, transparent 70%)',
          }}
        />

        {/* Card Top: Chip and Contactless Icon */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            {/* Gold EMV Chip */}
            <div className="w-10 h-7 rounded-md bg-gradient-to-tr from-amber-300 via-amber-400 to-amber-200 border border-amber-500/50 shadow-inner flex items-center justify-center relative overflow-hidden">
              <div className="w-full h-[1px] bg-amber-600/60 absolute top-2" />
              <div className="w-full h-[1px] bg-amber-600/60 absolute bottom-2" />
              <div className="h-full w-[1px] bg-amber-600/60 absolute left-3" />
            </div>
            <Wifi className="w-4 h-4 text-slate-400 rotate-90" aria-label="Contactless payment enabled" />
          </div>

          {/* Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border backdrop-blur-md ${
              isSafe
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
            }`}
          >
            {isSafe ? <ShieldCheck className="w-3 h-3 text-emerald-400" /> : <ShieldAlert className="w-3 h-3 text-amber-400" />}
            <span>{isSafe ? 'Runway Protected' : 'Low Buffer'}</span>
          </div>
        </div>

        {/* Card Middle: Primary Liquid Balance */}
        <div className="mt-4 relative z-10">
          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">
            {accountName}
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tabular-nums tracking-tight mt-0.5">
            {formatCurrency(balance, currency)}
          </div>
        </div>

        {/* Card Bottom: Cardholder and Security Standard */}
        <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between text-xs text-slate-400 z-10">
          <div>
            <span className="text-[9px] uppercase tracking-wider block text-slate-500">Account Holder</span>
            <span className="font-semibold text-slate-200 font-mono tracking-wide">{cardholderName}</span>
          </div>
          <div className="text-right">
            <span className="text-[9px] uppercase tracking-wider block text-slate-500">Safety Buffer</span>
            <span className="font-mono text-slate-300 font-semibold">
              {formatCurrency(safetyBuffer, currency, 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
