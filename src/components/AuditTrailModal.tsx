'use client';

import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Activity, CheckCircle, RefreshCw, Server, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuditTrailModal({ isOpen, onClose }: AuditTrailModalProps) {
  const [health, setHealth] = useState<any | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [h, l] = await Promise.all([
        apiClient.getSystemHealth(),
        apiClient.getAuditLogs(),
      ]);
      setHealth(h);
      setLogs(l || []);
    } catch (e) {
      console.error('Failed to load audit logs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
    >
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-indigo-500/10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 id="audit-modal-title" className="text-lg font-bold text-white">
                Incident Response & Audit Telemetry
              </h2>
              <p className="text-xs text-slate-400">
                Continuous circuit breaker monitoring, deadlocks prevention, and immutable security audit logs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              title="Refresh telemetry"
              disabled={loading}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              aria-label="Close audit modal"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* System Health Telemetry Bar */}
        {health && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/50">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">System Status</span>
              <div className="flex items-center gap-1.5 mt-1">
                <div className={`w-2 h-2 rounded-full ${health.status === 'healthy' ? 'bg-emerald-400 animate-ping' : 'bg-red-400'}`} />
                <span className="text-xs font-bold text-white capitalize">{health.status}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/50">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Circuit Breaker</span>
              <div className="flex items-center gap-1.5 mt-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-bold text-white uppercase">{health.circuit_breaker}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/50">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Engine Uptime</span>
              <span className="text-xs font-bold font-mono text-white mt-1 block">
                {Math.round(health.uptime_seconds)}s
              </span>
            </div>

            <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/50">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Storage Engine</span>
              <span className="text-xs font-bold font-mono text-indigo-300 mt-1 block truncate">
                {health.database || 'SQLite WAL'}
              </span>
            </div>
          </div>
        )}

        {/* Audit Events Stream */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white">Security & Operation Events Log</span>
            <span className="text-[11px] text-slate-400 font-mono">{logs.length} events recorded</span>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60 max-h-72 overflow-y-auto divide-y divide-slate-800/60">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No recent security incidents or audit entries found.
              </div>
            ) : (
              logs.map((log) => {
                const isWarn = log.severity === 'warning';
                const isCrit = log.severity === 'critical';

                return (
                  <div key={log.id} className="p-3 flex items-start gap-3 hover:bg-slate-900/40 transition">
                    <div className="mt-0.5">
                      {isCrit ? (
                        <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                      ) : isWarn ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-blue-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-semibold text-slate-200 truncate">
                          {log.event_type}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 break-words">
                        {log.details}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
          >
            Close Audit Log
          </button>
        </div>
      </div>
    </div>
  );
}
