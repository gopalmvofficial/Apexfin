'use client';

import React, { useState, useRef } from 'react';
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle, Sparkles, Tag } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface CSVUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export function CSVUploadModal({ isOpen, onClose, onUploadSuccess }: CSVUploadModalProps) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<any | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessFile = async (f: File) => {
    if (!f.name.endsWith('.csv')) {
      setError('Please provide a valid .csv bank or credit card statement file.');
      return;
    }
    setFile(f);
    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.uploadCSVStatement(f);
      setUploadResult(res);
      onUploadSuccess();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to parse and classify CSV statement.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleLoadSampleCSV = () => {
    const sampleCsvContent = `Date,Description,Amount\n` +
      `2026-10-24,WHOLE FOODS MKT 10452,87.42\n` +
      `2026-10-23,UBER TRIP PENDING,24.50\n` +
      `2026-10-22,AMZN MKTP US*2B718,142.10\n` +
      `2026-10-21,DIRECT DEP STRIPE PAYOUT,-3250.00\n` +
      `2026-10-20,NETFLIX.COM DIGITAL SUBSCR,22.99\n` +
      `2026-10-19,CHEVRON GAS STATION 041,55.00`;

    const blob = new Blob([sampleCsvContent], { type: 'text/csv' });
    const sampleFile = new File([blob], 'sample_chase_statement.csv', { type: 'text/csv' });
    handleProcessFile(sampleFile);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="csv-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
    >
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-blue-500/10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 id="csv-modal-title" className="text-lg font-bold text-white">
                Bank CSV Statement Importer
              </h2>
              <p className="text-xs text-slate-400">
                Automatic NLP transaction categorization and ledger reconciliation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close CSV upload modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {uploadResult ? (
          <div className="mt-5 space-y-4">
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Imported {uploadResult.imported_count} Transactions
                  </h3>
                  <p className="text-xs text-emerald-300 font-mono">
                    File: {uploadResult.filename}
                  </p>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                Classified 100%
              </span>
            </div>

            {/* Classified Items Table */}
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60 max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Description</th>
                    <th className="p-2.5 text-right">Amount</th>
                    <th className="p-2.5">AI Category</th>
                    <th className="p-2.5 text-right">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {uploadResult.classified_items?.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition">
                      <td className="p-2.5 font-mono text-slate-400 text-[11px]">{item.date}</td>
                      <td className="p-2.5 text-white font-medium truncate max-w-[160px]">{item.description}</td>
                      <td className={`p-2.5 text-right font-mono font-semibold ${item.type === 'income' ? 'text-emerald-400' : 'text-slate-200'}`}>
                        {item.type === 'income' ? '+' : '-'}${parseFloat(item.amount).toFixed(2)}
                      </td>
                      <td className="p-2.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
                          <Tag className="w-2.5 h-2.5" />
                          {item.suggested_category}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-mono text-emerald-400 text-[11px]">
                        {Math.round(item.confidence * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setUploadResult(null);
                  setFile(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
              >
                Upload Another Statement
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {error && (
              <div className="p-3 rounded-xl border border-red-500/30 bg-red-950/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`p-8 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                dragOver
                  ? 'border-blue-500 bg-blue-950/20'
                  : 'border-slate-800 bg-slate-950/50 hover:border-slate-700 hover:bg-slate-900/30'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleProcessFile(e.target.files[0]);
                  }
                }}
              />
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-white">
                {loading ? 'Analyzing CSV & Classifying...' : 'Drop your bank statement .CSV here'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Compatible with Chase, Bank of America, Wells Fargo, Mercury, Brex, and Revolut exports
              </p>
              <div className="mt-3 px-3 py-1 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 text-xs font-medium">
                Browse Files
              </div>
            </div>

            {/* Demo Sample Button */}
            <div className="p-3 rounded-xl border border-slate-800/80 bg-slate-950/40 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Don&apos;t have a file ready?</span>
              </div>
              <button
                type="button"
                onClick={handleLoadSampleCSV}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-950/30 hover:bg-blue-900/40 text-blue-300 text-xs font-semibold transition"
              >
                Load Sample Chase Statement
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
