'use client';

import React, { useState } from 'react';
import {
  X,
  Lock,
  Mail,
  User,
  Shield,
  Fingerprint,
  Sparkles,
  ArrowRight,
  LogOut,
  KeyRound,
} from 'lucide-react';
import { apiClient, AuthUser } from '@/lib/api-client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  onUserChanged: (user: AuthUser | null) => void;
}

export function AuthModal({ isOpen, onClose, currentUser, onUserChanged }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState<'free' | 'pro' | 'enterprise'>('pro');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        const { user } = await apiClient.login(identifier, password);
        onUserChanged(user);
        onClose();
      } else {
        const { user } = await apiClient.register(name || 'Apex User', email, password, tier);
        onUserChanged(user);
        onClose();
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Authentication request failed. Please verify credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'apple' | 'github') => {
    setSocialLoading(provider);
    setError(null);
    try {
      const { user } = await apiClient.loginWithOAuth(provider);
      onUserChanged(user);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSocialLoading(null);
    }
  };

  const handlePasskeySignIn = async () => {
    setSocialLoading('passkey');
    setError(null);
    try {
      const { user } = await apiClient.loginWithPasskey();
      onUserChanged(user);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSocialLoading(null);
    }
  };

  const handleQuickDemo = async (demoIdentifier: string, demoPass: string) => {
    setLoading(true);
    setError(null);
    try {
      const { user } = await apiClient.login(demoIdentifier, demoPass);
      onUserChanged(user);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    apiClient.setStoredUser(null);
    onUserChanged(null);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-blue-500/10 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 id="auth-modal-title" className="text-base font-bold text-white">
                {currentUser
                  ? 'ApexFin User Identity'
                  : mode === 'login'
                  ? 'Sign In to ApexFin'
                  : 'Create Enterprise Account'}
              </h2>
              <p className="text-[11px] text-slate-400">
                Multi-tenant session with OAuth & WebAuthn Passkeys
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close authentication modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Active Profile View */}
        {currentUser ? (
          <div className="mt-5 space-y-4">
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">{currentUser.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">{currentUser.email}</p>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400">
                  {currentUser.tier} Plan
                </span>
              </div>
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Tenant Isolation ID:</span>
                <span className="font-mono text-slate-300">{currentUser.tenantId}</span>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex-1 py-2.5 px-4 rounded-xl border border-red-500/30 bg-red-950/20 hover:bg-red-900/30 text-red-300 text-xs font-semibold transition flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition"
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {/* Social OAuth Buttons */}
            <div className="space-y-2">
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Instant Single Sign-On (SSO)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {/* Google Sign In */}
                <button
                  type="button"
                  onClick={() => handleOAuthSignIn('google')}
                  disabled={!!socialLoading || loading}
                  className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-slate-800 bg-slate-950/70 hover:bg-slate-800/90 hover:border-slate-700 text-white text-xs font-medium transition active:scale-98 disabled:opacity-50"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>{socialLoading === 'google' ? 'Connecting...' : 'Google'}</span>
                </button>

                {/* Apple Sign In (Apple HIG Compliant) */}
                <button
                  type="button"
                  onClick={() => handleOAuthSignIn('apple')}
                  disabled={!!socialLoading || loading}
                  className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-slate-700 bg-white hover:bg-slate-100 text-black text-xs font-semibold transition active:scale-98 disabled:opacity-50 shadow-sm"
                >
                  <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 170 170">
                    <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.08-7.73-7.94-12.13-14.58-6.19-9.35-11.05-20.1-14.58-32.25-3.53-12.15-5.3-23.73-5.3-34.74 0-16.14 4.09-29.6 12.27-40.38 8.18-10.78 18.57-16.27 31.17-16.48 4.8.12 10.23 1.29 16.3 3.51 6.07 2.22 10.15 3.38 12.25 3.48 1.63-.22 5.75-1.42 12.35-3.6 6.6-2.18 12.22-3.19 16.86-3.04 12.9.64 23.41 5.3 31.53 13.99-11.22 6.8-16.71 16.27-16.48 28.41.22 9.58 3.82 17.63 10.8 24.16 6.98 6.53 15.34 10.23 25.09 11.11-2.07 6.42-4.79 13.43-8.16 21.03zm-31.53-112.5c0-7.3-2.61-14.15-7.83-20.55-5.22-6.4-11.64-10.23-19.26-11.49-.22 1.09-.33 2.18-.33 3.27 0 7.08 2.61 14.15 7.83 21.2 5.22 7.05 11.75 11.02 19.59 11.91 0-1.44 0-2.88 0-4.34z" />
                  </svg>
                  <span>{socialLoading === 'apple' ? 'Connecting...' : 'Apple ID'}</span>
                </button>
              </div>

              {/* Hardware Passkey & Biometric Sign In */}
              <button
                type="button"
                onClick={handlePasskeySignIn}
                disabled={!!socialLoading || loading}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-indigo-500/30 bg-indigo-950/30 hover:bg-indigo-900/40 text-indigo-200 text-xs font-semibold transition active:scale-98 disabled:opacity-50"
              >
                <Fingerprint className="w-4 h-4 text-indigo-400" />
                <span>
                  {socialLoading === 'passkey'
                    ? 'Authenticating Biometrics...'
                    : 'Sign In with Passkey / Face ID'}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 my-2 text-slate-600">
              <div className="h-px bg-slate-800 flex-1" />
              <span className="text-[10px] uppercase font-bold tracking-wider">or with credentials</span>
              <div className="h-px bg-slate-800 flex-1" />
            </div>

            {error && (
              <div className="p-3 rounded-xl border border-red-500/30 bg-red-950/30 text-red-300 text-xs flex items-center gap-2">
                <Shield className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Email or Username Credentials Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'register' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Jordan Lee"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        required
                        placeholder="name@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Email or Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="alex@apexfin.io or Alex Rivera"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Initial Membership Plan</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['free', 'pro', 'enterprise'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTier(t)}
                        className={`py-1.5 rounded-lg border text-xs capitalize font-medium transition ${
                          tier === t
                            ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                            : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition active:scale-98 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <span>{loading ? 'Authenticating...' : mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                {!loading && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </form>

            {/* Quick Demo Logins Bar */}
            <div className="p-3 rounded-xl border border-slate-800/80 bg-slate-950/40 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                <span>Instant Demo Accounts</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemo('alex@apexfin.io', 'apex1234')}
                  disabled={loading}
                  className="p-2 rounded-lg border border-slate-800 bg-slate-900 hover:border-blue-500/40 hover:bg-slate-800/80 transition text-left group"
                >
                  <div className="text-xs font-semibold text-white group-hover:text-blue-300">Alex Rivera</div>
                  <div className="text-[10px] text-slate-400">Pro Tier ($19/mo)</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemo('maya@creative.studio', 'maya1234')}
                  disabled={loading}
                  className="p-2 rounded-lg border border-slate-800 bg-slate-900 hover:border-emerald-500/40 hover:bg-slate-800/80 transition text-left group"
                >
                  <div className="text-xs font-semibold text-white group-hover:text-emerald-300">Maya Chen</div>
                  <div className="text-[10px] text-slate-400">Enterprise ($49/mo)</div>
                </button>
              </div>
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                className="text-xs text-slate-400 hover:text-blue-400 transition"
              >
                {mode === 'login' ? "Don't have an enterprise account? Sign up" : 'Already have credentials? Sign in'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
