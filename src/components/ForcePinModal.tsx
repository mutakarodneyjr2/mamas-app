import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { setPin } from '../lib/auth-pin';
import { KeyRound, ArrowRight } from 'lucide-react';

export function ForcePinModal({ forceShow = false, onClose }: { forceShow?: boolean; onClose?: () => void }) {
  const { currentUser, userProfile } = useAuth();
  const [pin, setPinValue] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // If already has pin and not force showing, do not render
  if (!forceShow && (!userProfile || userProfile.hasPin)) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (pin.length < 4 || pin.length > 6) {
      setError("PIN must be 4 to 6 digits");
      return;
    }

    if (pin !== confirmPin) {
      setError("PINs do not match");
      return;
    }

    setLoading(true);
    try {
      const phoneToUse = currentUser?.phoneNumber || userProfile?.phoneNumber;
      if (!currentUser || !phoneToUse) throw new Error("Authentication missing phone number");
      await setPin(currentUser.uid, phoneToUse, pin);
      setSuccess(true);
      // Wait a moment so user sees success, then reload or close
      setTimeout(() => {
        if (forceShow && onClose) {
           onClose();
           window.location.reload();
        } else {
           window.location.reload();
        }
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to set PIN. Try again.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-mamas-bg/95 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800">PIN Set Successfully!</h2>
          <p className="text-slate-500 mt-2 text-sm">You can now use your Phone + PIN to log in.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-mamas-bg/95 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 relative">
        {forceShow && onClose && (
           <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
        )}
        <div className="p-6 sm:p-8">
          <div className="w-12 h-12 bg-mamas-primary/10 rounded-2xl flex items-center justify-center mb-6 text-mamas-primary">
            <KeyRound className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Security Update</h2>
          <p className="text-slate-500 mt-2 text-sm leading-relaxed mb-6">
            MAMAS has updated its login system. You must create a secure PIN (4-6 digits) to continue using your account. This replaces SMS codes for regular logins.
          </p>

          {error && (
            <div className="mb-6 p-3 bg-rose-50 text-rose-600 text-sm font-medium rounded-lg border border-rose-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="new-pin" className="block text-sm font-semibold text-slate-700 mb-1.5">Create PIN</label>
              <input
                id="new-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4,6}"
                required
                value={pin}
                onChange={e => setPinValue(e.target.value)}
                placeholder="4-6 digits"
                className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-mamas-primary focus:border-mamas-primary sm:text-lg tracking-[0.2em] font-mono transition-all outline-none"
              />
            </div>
            <div>
              <label htmlFor="confirm-pin" className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm PIN</label>
              <input
                id="confirm-pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4,6}"
                required
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value)}
                placeholder="Re-enter PIN"
                className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-mamas-primary focus:border-mamas-primary sm:text-lg tracking-[0.2em] font-mono transition-all outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading || pin.length < 4}
              className="w-full mt-2 flex items-center justify-center py-3.5 px-4 bg-mamas-primary hover:bg-mamas-primary-hover text-white rounded-xl font-bold shadow-md shadow-mamas-primary/20 transition-all disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Set PIN & Continue'}
              {!loading && <ArrowRight className="w-5 h-5 ml-2" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
