'use client';

import React from 'react';
import {
  Sparkles,
  Sliders,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  Zap,
  Info,
} from 'lucide-react';
import { ScenarioAdjustment } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';

interface WhatIfSimulatorProps {
  scenario: ScenarioAdjustment;
  onChange: (updated: ScenarioAdjustment) => void;
  currency?: string;
  horizonDays: number;
}

export function WhatIfSimulator({
  scenario,
  onChange,
  currency = 'USD',
  horizonDays,
}: WhatIfSimulatorProps) {
  const PRESETS = [
    {
      name: 'New Car Lease',
      description: '-$450/mo lease with $2,000 down payment on day 10',
      monthlyExpenseDelta: 450,
      monthlyIncomeDelta: 0,
      oneTimeAmount: -2000,
      oneTimeDayOffset: 10,
    },
    {
      name: '10% Salary Promotion',
      description: '+$750/mo gross direct deposit increase',
      monthlyExpenseDelta: 0,
      monthlyIncomeDelta: 750,
      oneTimeAmount: 0,
      oneTimeDayOffset: 0,
    },
    {
      name: 'Emergency Home / Car Repair',
      description: 'One-off -$1,800 out-of-pocket on Day 15',
      monthlyExpenseDelta: 0,
      monthlyIncomeDelta: 0,
      oneTimeAmount: -1800,
      oneTimeDayOffset: 15,
    },
    {
      name: 'Subscription & Dining Trim',
      description: 'Cut -$160/mo in recurring SaaS and entertainment',
      monthlyExpenseDelta: -160,
      monthlyIncomeDelta: 0,
      oneTimeAmount: 0,
      oneTimeDayOffset: 0,
    },
  ];

  const handleToggle = () => {
    onChange({ ...scenario, enabled: !scenario.enabled });
  };

  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    onChange({
      enabled: true,
      name: preset.name,
      monthlyExpenseDelta: preset.monthlyExpenseDelta,
      monthlyIncomeDelta: preset.monthlyIncomeDelta,
      oneTimeAmount: preset.oneTimeAmount,
      oneTimeDayOffset: preset.oneTimeDayOffset,
    });
  };

  const handleReset = () => {
    onChange({
      enabled: false,
      name: '',
      monthlyExpenseDelta: 0,
      monthlyIncomeDelta: 0,
      oneTimeAmount: 0,
      oneTimeDayOffset: 0,
    });
  };

  return (
    <div className={`glass-panel rounded-2xl p-6 transition-all border ${
      scenario.enabled ? 'border-purple-500/40 shadow-lg shadow-purple-900/10' : 'border-slate-800/80'
    }`}>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              What-If Scenario Simulator
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Interactive Sandbox
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Simulate changes in income, new recurring leases, or emergency expenses without altering real data
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {scenario.enabled && (
            <button
              onClick={handleReset}
              className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg hover:bg-slate-900 transition flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}

          <button
            onClick={handleToggle}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 ${
              scenario.enabled
                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            {scenario.enabled ? 'Simulation Active' : 'Enable Simulation'}
          </button>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="mb-6">
        <div className="text-xs font-medium text-slate-400 mb-2.5 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Quick 1-Click Scenarios:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handleApplyPreset(preset)}
              className="p-2.5 text-left rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-purple-500/40 transition group"
            >
              <div className="text-xs font-semibold text-slate-200 group-hover:text-purple-300 transition">
                {preset.name}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                {preset.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Controls & Sliders */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-5 transition-opacity ${
        scenario.enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'
      }`}>
        {/* 1. Monthly Income Adjustment */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-slate-300">Monthly Income Delta</span>
            <span className={`text-xs font-bold font-mono tabular-nums ${
              scenario.monthlyIncomeDelta > 0 ? 'text-emerald-400' : 'text-slate-400'
            }`}>
              {scenario.monthlyIncomeDelta > 0 ? '+' : ''}
              {formatCurrency(scenario.monthlyIncomeDelta, currency, 0)}/mo
            </span>
          </div>
          <input
            type="range"
            min="-2000"
            max="4000"
            step="50"
            value={scenario.monthlyIncomeDelta}
            onChange={(e) =>
              onChange({
                ...scenario,
                enabled: true,
                monthlyIncomeDelta: parseFloat(e.target.value),
              })
            }
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>-$2,000</span>
            <span>$0</span>
            <span>+$4,000</span>
          </div>
        </div>

        {/* 2. Monthly Expense Adjustment */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-slate-300">Monthly Expense Delta</span>
            <span className={`text-xs font-bold font-mono tabular-nums ${
              scenario.monthlyExpenseDelta > 0 ? 'text-rose-400' : scenario.monthlyExpenseDelta < 0 ? 'text-emerald-400' : 'text-slate-400'
            }`}>
              {scenario.monthlyExpenseDelta > 0 ? '+' : ''}
              {formatCurrency(scenario.monthlyExpenseDelta, currency, 0)}/mo
            </span>
          </div>
          <input
            type="range"
            min="-1000"
            max="3000"
            step="50"
            value={scenario.monthlyExpenseDelta}
            onChange={(e) =>
              onChange({
                ...scenario,
                enabled: true,
                monthlyExpenseDelta: parseFloat(e.target.value),
              })
            }
            className="w-full accent-rose-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>-$1,000 (Cut)</span>
            <span>$0</span>
            <span>+$3,000 (Lease/Loan)</span>
          </div>
        </div>

        {/* 3. One-Time Lump Sum Windfall / Expense */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-slate-300">One-Time Lump Sum</span>
            <span className={`text-xs font-bold font-mono tabular-nums ${
              scenario.oneTimeAmount > 0 ? 'text-emerald-400' : scenario.oneTimeAmount < 0 ? 'text-rose-400' : 'text-slate-400'
            }`}>
              {scenario.oneTimeAmount > 0 ? '+' : ''}
              {formatCurrency(scenario.oneTimeAmount, currency, 0)}
              {scenario.oneTimeAmount !== 0 && (
                <span className="text-[10px] text-slate-400 ml-1 font-normal">
                  (Day {scenario.oneTimeDayOffset})
                </span>
              )}
            </span>
          </div>
          <div className="space-y-2">
            <input
              type="range"
              min="-5000"
              max="5000"
              step="100"
              value={scenario.oneTimeAmount}
              onChange={(e) =>
                onChange({
                  ...scenario,
                  enabled: true,
                  oneTimeAmount: parseFloat(e.target.value),
                })
              }
              className="w-full accent-purple-500 cursor-pointer"
            />
            {scenario.oneTimeAmount !== 0 && (
              <div className="pt-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Trigger Day Offset:</span>
                  <span className="font-mono text-purple-300">Day {scenario.oneTimeDayOffset}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max={Math.min(90, horizonDays)}
                  value={scenario.oneTimeDayOffset}
                  onChange={(e) =>
                    onChange({
                      ...scenario,
                      oneTimeDayOffset: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full accent-purple-400 cursor-pointer h-1"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
