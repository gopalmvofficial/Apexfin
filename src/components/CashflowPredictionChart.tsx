'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Calendar,
  Sparkles,
  Info,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react';
import { PredictionResult, PredictionTimelinePoint } from '@/lib/types';
import { formatCurrency, formatDate, formatShortDate } from '@/lib/formatters';

interface CashflowPredictionChartProps {
  prediction: PredictionResult | null;
  loading: boolean;
  selectedHorizon: number;
  onHorizonChange: (days: number) => void;
  variableBurnMultiplier: number;
  onBurnMultiplierChange: (mult: number) => void;
  isScenarioActive: boolean;
  currency?: string;
}

export function CashflowPredictionChart({
  prediction,
  loading,
  selectedHorizon,
  onHorizonChange,
  variableBurnMultiplier,
  onBurnMultiplierChange,
  isScenarioActive,
  currency = 'USD',
}: CashflowPredictionChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<PredictionTimelinePoint | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const HORIZONS = [
    { label: '30D', days: 30 },
    { label: '60D', days: 60 },
    { label: '90D', days: 90 },
    { label: '180D', days: 180 },
    { label: '1 Year', days: 365 },
  ];

  const BURN_LEVELS = [
    { label: 'Frugal (0.8x)', value: 0.8 },
    { label: 'Normal (1.0x)', value: 1.0 },
    { label: 'Heavy (1.3x)', value: 1.3 },
  ];

  // SVG coordinate calculations
  const chartData = useMemo(() => {
    if (!prediction || prediction.dailyTimeline.length === 0) return null;

    const timeline = prediction.dailyTimeline;
    const safetyBuffer = prediction.safetyBuffer;

    let minVal = Math.min(
      prediction.startBalance,
      prediction.baselineLowestBalance,
      isScenarioActive ? prediction.simulatedLowestBalance : Infinity,
      safetyBuffer
    );
    let maxVal = Math.max(
      prediction.startBalance,
      ...timeline.map((d) => Math.max(d.baselineBalance, isScenarioActive ? d.simulatedBalance : 0))
    );

    // Add padding to domain
    const range = maxVal - minVal || 1000;
    minVal = Math.max(0, minVal - range * 0.1);
    maxVal = maxVal + range * 0.1;

    const width = 900;
    const height = 300;
    const padding = { top: 20, right: 30, bottom: 40, left: 60 };

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const getX = (index: number) =>
      padding.left + (index / Math.max(1, timeline.length - 1)) * plotWidth;

    const getY = (val: number) => {
      const normalized = (val - minVal) / (maxVal - minVal);
      return padding.top + plotHeight * (1 - normalized);
    };

    // Build SVG Path strings
    const baselinePoints = timeline.map((d, i) => `${getX(i).toFixed(1)},${getY(d.baselineBalance).toFixed(1)}`);
    const baselinePath = `M ${baselinePoints.join(' L ')}`;

    // Build area fill path
    const baselineArea = `${baselinePath} L ${getX(timeline.length - 1).toFixed(1)},${(padding.top + plotHeight).toFixed(1)} L ${padding.left.toFixed(1)},${(padding.top + plotHeight).toFixed(1)} Z`;

    let simulatedPath = '';
    if (isScenarioActive) {
      const simPoints = timeline.map((d, i) => `${getX(i).toFixed(1)},${getY(d.simulatedBalance).toFixed(1)}`);
      simulatedPath = `M ${simPoints.join(' L ')}`;
    }

    const safetyBufferY = getY(safetyBuffer);

    // Find coordinate for lowest point
    const lowestIdx = timeline.findIndex((d) => d.date === prediction.baselineLowestDate);
    const lowestCoord = lowestIdx >= 0 ? { x: getX(lowestIdx), y: getY(prediction.baselineLowestBalance) } : null;

    // Y Axis ticks (4 levels)
    const yTicks = [0, 0.33, 0.66, 1].map((pct) => {
      const val = minVal + pct * (maxVal - minVal);
      return { val, y: getY(val) };
    });

    return {
      width,
      height,
      padding,
      plotWidth,
      plotHeight,
      timeline,
      baselinePath,
      baselineArea,
      simulatedPath,
      safetyBufferY,
      lowestCoord,
      minVal,
      maxVal,
      yTicks,
      getX,
      getY,
    };
  }, [prediction, isScenarioActive]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!chartData || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const svgX = (clientX / rect.width) * chartData.width;

    const relativeX = svgX - chartData.padding.left;
    const pct = Math.max(0, Math.min(1, relativeX / chartData.plotWidth));
    const index = Math.round(pct * (chartData.timeline.length - 1));

    if (index >= 0 && index < chartData.timeline.length) {
      setHoveredPoint(chartData.timeline[index]);
      setMousePos({
        x: chartData.getX(index),
        y: chartData.getY(chartData.timeline[index].baselineBalance),
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
    setMousePos(null);
  };

  return (
    <div className="glass-panel rounded-2xl p-6 relative overflow-hidden border border-slate-800/80">
      {/* Top Header & Horizon Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Predictive Cashflow Horizon
                {isScenarioActive && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-normal">
                    Scenario Active
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Continuous liquidity trajectory modeled from recurring obligations & daily variable burn
              </p>
            </div>
          </div>
        </div>

        {/* Controls: Burn Multiplier + Horizon Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Burn Multiplier Selector */}
          <div className="flex items-center bg-slate-900/90 rounded-lg p-1 border border-slate-800 text-xs">
            <span className="text-slate-500 px-2 flex items-center gap-1 font-medium">
              <SlidersHorizontal className="w-3 h-3" /> Burn:
            </span>
            {BURN_LEVELS.map((burn) => (
              <button
                key={burn.label}
                onClick={() => onBurnMultiplierChange(burn.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  variableBurnMultiplier === burn.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {burn.label}
              </button>
            ))}
          </div>

          {/* Horizon Selector */}
          <div className="flex items-center bg-slate-900/90 rounded-lg p-1 border border-slate-800 text-xs">
            {HORIZONS.map((h) => (
              <button
                key={h.days}
                onClick={() => onHorizonChange(h.days)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                  selectedHorizon === h.days
                    ? 'bg-slate-800 text-blue-400 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Critical Liquidity Warning Banner (If Breach Predicted) */}
      {prediction?.baselineBreachDetected && (
        <div className="mb-5 p-3.5 rounded-xl bg-amber-950/40 border border-amber-600/40 text-amber-200 flex items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <strong className="font-semibold text-amber-300">Safety Buffer Breach Alert:</strong>{' '}
              Projected balance dips below your {formatCurrency(prediction.safetyBuffer, currency, 0)} safety buffer on{' '}
              <span className="font-mono font-semibold underline">{formatDate(prediction.baselineLowestDate)}</span>{' '}
              (Day {prediction.baselineDaysUntilBreach}). Minimum liquidity will reach{' '}
              <span className="font-mono font-semibold">{formatCurrency(prediction.baselineLowestBalance, currency)}</span>.
            </div>
          </div>
          <span className="hidden sm:inline-block px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 text-[11px] font-mono whitespace-nowrap">
            Trough on Day {prediction.baselineDaysUntilBreach}
          </span>
        </div>
      )}

      {/* Chart Canvas Area */}
      <div className="relative w-full h-[320px] bg-slate-950/40 rounded-xl border border-slate-800/60 p-2 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs">
            <div className="flex items-center gap-2 text-sm text-blue-400">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span>Simulating {selectedHorizon}-day cashflow...</span>
            </div>
          </div>
        )}

        {chartData && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${chartData.width} ${chartData.height}`}
            className="w-full h-full cursor-crosshair overflow-visible"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <defs>
              {/* Gradient for Baseline Curve Area */}
              <linearGradient id="baselineAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
              </linearGradient>

              {/* Gradient for Line */}
              <linearGradient id="baselineLineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines */}
            {chartData.yTicks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={chartData.padding.left}
                  y1={tick.y}
                  x2={chartData.width - chartData.padding.right}
                  y2={tick.y}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text
                  x={chartData.padding.left - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                  className="text-[10px] fill-slate-500 font-mono"
                >
                  {formatCurrency(tick.val, currency, 0)}
                </text>
              </g>
            ))}

            {/* Horizontal Safety Buffer Line */}
            {chartData.safetyBufferY >= chartData.padding.top &&
              chartData.safetyBufferY <= chartData.height - chartData.padding.bottom && (
                <g>
                  <line
                    x1={chartData.padding.left}
                    y1={chartData.safetyBufferY}
                    x2={chartData.width - chartData.padding.right}
                    y2={chartData.safetyBufferY}
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    opacity="0.8"
                  />
                  <text
                    x={chartData.width - chartData.padding.right}
                    y={chartData.safetyBufferY - 6}
                    textAnchor="end"
                    className="text-[10px] fill-amber-400 font-semibold font-mono"
                  >
                    Buffer Threshold ({formatCurrency(prediction?.safetyBuffer || 0, currency, 0)})
                  </text>
                </g>
              )}

            {/* Baseline Cashflow Area Fill */}
            <path d={chartData.baselineArea} fill="url(#baselineAreaGrad)" />

            {/* Baseline Trajectory Line */}
            <path
              d={chartData.baselinePath}
              fill="none"
              stroke="url(#baselineLineGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Simulated Trajectory Line (If Scenario Active) */}
            {isScenarioActive && chartData.simulatedPath && (
              <path
                d={chartData.simulatedPath}
                fill="none"
                stroke="#a855f7"
                strokeWidth="2"
                strokeDasharray="5 4"
                strokeLinecap="round"
              />
            )}

            {/* Lowest Liquidity Trough Beacon */}
            {chartData.lowestCoord && (
              <g>
                <circle
                  cx={chartData.lowestCoord.x}
                  cy={chartData.lowestCoord.y}
                  r="6"
                  className="fill-rose-500/30 animate-ping"
                />
                <circle
                  cx={chartData.lowestCoord.x}
                  cy={chartData.lowestCoord.y}
                  r="4"
                  className="fill-rose-500 stroke-white stroke-2"
                />
              </g>
            )}

            {/* Hover Guide Line and Cursor */}
            {mousePos && hoveredPoint && (
              <g>
                <line
                  x1={mousePos.x}
                  y1={chartData.padding.top}
                  x2={mousePos.x}
                  y2={chartData.height - chartData.padding.bottom}
                  stroke="#64748b"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <circle
                  cx={mousePos.x}
                  cy={mousePos.y}
                  r="5"
                  className="fill-blue-400 stroke-slate-950 stroke-2"
                />
                {isScenarioActive && (
                  <circle
                    cx={mousePos.x}
                    cy={chartData.getY(hoveredPoint.simulatedBalance)}
                    r="5"
                    className="fill-purple-400 stroke-slate-950 stroke-2"
                  />
                )}
              </g>
            )}

            {/* X Axis Time Labels */}
            {chartData.timeline
              .filter((_, idx) => {
                const interval = Math.max(1, Math.floor(chartData.timeline.length / 6));
                return idx % interval === 0 || idx === chartData.timeline.length - 1;
              })
              .map((d) => {
                const idx = d.day - 1;
                return (
                  <text
                    key={d.date}
                    x={chartData.getX(idx)}
                    y={chartData.height - 12}
                    textAnchor="middle"
                    className="text-[10px] fill-slate-500 font-mono"
                  >
                    {formatShortDate(d.date)}
                  </text>
                );
              })}
          </svg>
        )}

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div className="absolute top-4 right-4 z-30 pointer-events-none p-3.5 rounded-xl bg-slate-900/95 border border-slate-700 shadow-xl backdrop-blur-md min-w-[240px]">
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2 mb-2 font-mono">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                {formatDate(hoveredPoint.date)}
              </span>
              <span className="text-[10px] text-slate-500">Day {hoveredPoint.day}</span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" /> Baseline:
                </span>
                <span className="font-mono font-bold text-white tabular-nums">
                  {formatCurrency(hoveredPoint.baselineBalance, currency)}
                </span>
              </div>

              {isScenarioActive && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500" /> Simulated:
                  </span>
                  <span className="font-mono font-bold text-purple-300 tabular-nums">
                    {formatCurrency(hoveredPoint.simulatedBalance, currency)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center text-slate-400 pt-1 border-t border-slate-800/80">
                <span>Daily Variable Burn:</span>
                <span className="font-mono text-amber-400 tabular-nums">
                  -{formatCurrency(hoveredPoint.dailyVariableBurn, currency)}
                </span>
              </div>

              {/* Inflow Events on this day */}
              {hoveredPoint.incomeEvents.length > 0 && (
                <div className="pt-1.5 text-[11px] text-emerald-400 border-t border-slate-800/80">
                  <div className="font-semibold mb-0.5">Inflow Events:</div>
                  {hoveredPoint.incomeEvents.map((evt, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="truncate max-w-[140px] text-slate-300">{evt.name}</span>
                      <span className="font-mono font-bold">+{formatCurrency(evt.amount, currency)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Outflow Events on this day */}
              {hoveredPoint.expenseEvents.length > 0 && (
                <div className="pt-1.5 text-[11px] text-rose-400 border-t border-slate-800/80">
                  <div className="font-semibold mb-0.5">Scheduled Outflows:</div>
                  {hoveredPoint.expenseEvents.map((evt, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="truncate max-w-[140px] text-slate-300">{evt.name}</span>
                      <span className="font-mono font-bold">-{formatCurrency(evt.amount, currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Projection Summary Badges Bar */}
      {prediction && (
        <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Start Liquidity</span>
            <span className="font-mono font-bold text-white text-sm tabular-nums">
              {formatCurrency(prediction.startBalance, currency)}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Lowest Projected Trough</span>
            <div className="flex items-center gap-1.5">
              <span className={`font-mono font-bold text-sm tabular-nums ${
                prediction.baselineLowestBalance < prediction.safetyBuffer ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {formatCurrency(prediction.baselineLowestBalance, currency)}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">({formatShortDate(prediction.baselineLowestDate)})</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Projected End Balance</span>
            <span className="font-mono font-bold text-blue-400 text-sm tabular-nums">
              {formatCurrency(prediction.summary.baselineEndBalance, currency)}
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-slate-400 block text-[11px]">Buffer Status</span>
              <span className={`font-semibold text-xs ${
                prediction.baselineBreachDetected ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {prediction.baselineBreachDetected ? 'Buffer Breached' : 'Secure & Liquid'}
              </span>
            </div>
            {prediction.baselineBreachDetected ? (
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
