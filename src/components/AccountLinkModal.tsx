import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, X, ShieldAlert, RefreshCw, CheckCircle2 } from 'lucide-react';
import { linkGoogleWithPasswordAccount, sendPasswordReset } from '../lib/authResolver';
import { useRegisterModal } from '../lib/nativeBack';

interface AccountLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  pendingCredential: any;
  onSuccess: (user: any) => void;
}

export function AccountLinkModal({
  isOpen,
  onClose,
  email,
  pendingCredential,
  onSuccess
}: AccountLinkModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useRegisterModal(isOpen && !loading, onClose, 'account-link-modal');

  if (!isOpen) return null;

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter your account password.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const user = await linkGoogleWithPasswordAccount(email, password, pendingCredential);
      onSuccess(user);
    } catch (err: any) {
      console.error("Account linking error:", err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Incorrect password. Please verify and try again, or use password reset.');
      } else {
        setError(err.message || 'Failed to link account.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setResetLoading(true);
    setError('');
    try {
      await sendPasswordReset(email);
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || 'Could not send reset email.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0c1731] w-full max-w-md rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Existing Account Found</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Link your Google sign-in to existing account</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            An account already exists for <strong className="text-slate-900 dark:text-white">{email}</strong> with password login.
            Enter your password to securely link your Google account so you can sign in with either in the future.
          </p>

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-700 dark:text-rose-300 font-medium text-[11px]">
              {error}
            </div>
          )}

          {resetSent && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-emerald-700 dark:text-emerald-300 font-medium text-[11px] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Password reset link sent to your email. You can reset and return to link your account.</span>
            </div>
          )}

          <form onSubmit={handleLink} className="space-y-3 pt-1">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Account Password</label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer disabled:opacity-50"
                >
                  {resetLoading ? 'Sending...' : 'Forgot password?'}
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <KeyRound className="w-3.5 h-3.5" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-9 pr-9 text-xs outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{loading ? 'Linking...' : 'Link & Continue'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
