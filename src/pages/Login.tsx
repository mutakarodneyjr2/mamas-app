import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { LogoLarge } from '../components/Logo';
import { Mail, Phone, KeyRound, ArrowRight } from 'lucide-react';

type LoginStep = 'phone' | 'otp' | 'recovery-email' | 'recovery-code' | 'recovery-new-phone' | 'recovery-new-otp';

export default function Login() {
  const { sendOtp, verifyOtp, setupRecaptcha, currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<LoginStep>('phone');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Recovery States
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [recoveryRequestId, setRecoveryRequestId] = useState('');
  const [recoveryNewPhone, setRecoveryNewPhone] = useState('');
  const [recoveryNewOtp, setRecoveryNewOtp] = useState('');

  useEffect(() => {
    setupRecaptcha('recaptcha-container');
  }, [setupRecaptcha]);

  useEffect(() => {
    // Only auto-redirect if we are not in the middle of a recovery phone update
    if (currentUser && step !== 'recovery-new-phone' && step !== 'recovery-new-otp') {
      if (userProfile) {
        navigate('/dashboard');
      } else {
        navigate('/register');
      }
    }
  }, [currentUser, userProfile, navigate, step]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let formattedPhone = phoneNumber;
      if (formattedPhone.startsWith('0')) formattedPhone = '+256' + formattedPhone.substring(1);
      else if (!formattedPhone.startsWith('+')) formattedPhone = '+' + formattedPhone;
      
      await sendOtp(formattedPhone);
      setStep('otp');
    } catch (err: any) {
      console.error(err);
      const msg = err.message || '';
      if (err.code === 'auth/invalid-phone-number' || msg.includes('invalid-phone-number')) {
        setError('Invalid phone number format. Please check the number and try again.');
      } else if (err.code === 'auth/too-many-requests' || msg.includes('too-many-requests')) {
        setError('Too many attempts. Please wait a few minutes before trying again.');
      } else if (err.code === 'auth/network-request-failed' || msg.includes('network')) {
        setError('Network error. Please check your internet connection and try again.');
      } else if (err.code === 'auth/captcha-check-failed' || msg.includes('recaptcha')) {
        setError('Security check failed. Please refresh the page and try again.');
      } else if (err.code === 'auth/operation-not-allowed' || msg.includes('region')) {
        setError('SMS login is not enabled. Please contact support.');
      } else {
        setError('Failed to send verification code. Please check your number and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verifyOtp(otp);
      // navigation handled by useEffect
    } catch (err: any) {
      console.error(err);
      const msg = err.message || '';
      if (err.code === 'auth/invalid-verification-code' || msg.includes('invalid-verification-code')) {
        setError('The verification code is incorrect. Please try again.');
      } else if (err.code === 'auth/code-expired' || msg.includes('code-expired')) {
        setError('The verification code has expired. Please request a new one.');
      } else {
        setError('Failed to verify code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // --- RECOVERY HANDLERS ---

  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await fetch('/api/recovery/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setSuccess(data.message);
      setStep('recovery-code');
    } catch (err: any) {
      setError(err.message || 'Failed to request recovery code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRecoveryCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await fetch('/api/recovery/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail, code: recoveryCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setRecoveryToken(data.recoveryToken);
      setRecoveryRequestId(data.requestId);
      setSuccess('Code verified. Please set your new phone number.');
      setStep('recovery-new-phone');
      
      // Re-setup recaptcha for the new flow just in case
      setTimeout(() => {
        setupRecaptcha('recaptcha-container-recovery');
      }, 500);
      
    } catch (err: any) {
      setError(err.message || 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRecoveryNewOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      let formattedPhone = recoveryNewPhone;
      if (formattedPhone.startsWith('0')) formattedPhone = '+256' + formattedPhone.substring(1);
      else if (!formattedPhone.startsWith('+')) formattedPhone = '+' + formattedPhone;
      
      await sendOtp(formattedPhone);
      setStep('recovery-new-otp');
    } catch (err: any) {
      console.error(err);
      const msg = err.message || '';
      if (err.code === 'auth/invalid-phone-number' || msg.includes('invalid-phone-number')) {
        setError('Invalid phone number format. Please check the number and try again.');
      } else if (err.code === 'auth/too-many-requests' || msg.includes('too-many-requests')) {
        setError('Too many attempts. Please wait a few minutes before trying again.');
      } else if (err.code === 'auth/network-request-failed' || msg.includes('network')) {
        setError('Network error. Please check your internet connection and try again.');
      } else if (err.code === 'auth/captcha-check-failed' || msg.includes('recaptcha')) {
        setError('Security check failed. Please refresh the page and try again.');
      } else {
        setError('Failed to send OTP. Please check the phone number.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      // 1. Verify OTP with Firebase Auth -> Creates/signs in the NEW user
      const cred: any = await verifyOtp(recoveryNewOtp);
      const newUid = cred.user.uid;

      let formattedPhone = recoveryNewPhone;
      if (formattedPhone.startsWith('0')) formattedPhone = '+256' + formattedPhone.substring(1);
      else if (!formattedPhone.startsWith('+')) formattedPhone = '+' + formattedPhone;

      // 2. Complete recovery on backend -> Moves data from OLD_UID to newUid
      const res = await fetch('/api/recovery/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: recoveryRequestId,
          recoveryToken,
          newUid,
          newPhoneNumber: formattedPhone
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      // Success! The useEffect will navigate them appropriately once userProfile re-fetches.
      // But we need to trigger a re-render or let it settle.
      setSuccess('Account recovered successfully! Logging you in...');
      setTimeout(() => {
        navigate('/dashboard');
        window.location.reload(); // Force full reload to get fresh profile data from new UID
      }, 1500);

    } catch (err: any) {
      console.error(err);
      const msg = err.message || '';
      if (err.code === 'auth/invalid-verification-code' || msg.includes('invalid-verification-code')) {
        setError('The verification code is incorrect. Please try again.');
      } else if (err.code === 'auth/code-expired' || msg.includes('code-expired')) {
        setError('The verification code has expired. Please request a new one.');
      } else {
        setError(msg || 'Failed to complete recovery.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mamas-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-mamas-accent opacity-10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-mamas-primary opacity-5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
        <LogoLarge className="scale-75 origin-center mx-auto" />
      </div>

      <div className="mt-4 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="bg-mamas-card py-10 px-6 shadow-xl shadow-mamas-primary/5 sm:rounded-2xl sm:px-12 border border-slate-100">
          <h2 className="text-2xl font-display font-bold text-mamas-primary text-center mb-8">
            {step.startsWith('recovery') ? 'Account Recovery' : 'Welcome Back'}
          </h2>

          {error && (
            <div className="mb-6 bg-rose-50 border-l-4 border-mamas-danger text-mamas-danger px-4 py-3 rounded-r text-sm font-medium shadow-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 bg-teal-50 border-l-4 border-teal-600 text-teal-700 px-4 py-3 rounded-r text-sm font-medium shadow-sm">
              {success}
            </div>
          )}

          {step === 'phone' && (
            <form className="space-y-6" onSubmit={handleSendOtp}>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
                  Phone Number
                </label>
                <div className="mt-2 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    placeholder="+256 700 000000"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-mamas-primary sm:text-base transition-colors"
                  />
                </div>
              </div>

              <div id="recaptcha-container" className="flex justify-center"></div>

              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="terms"
                    name="terms"
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="focus:ring-mamas-primary h-4 w-4 text-mamas-primary border-slate-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="terms" className="font-medium text-slate-700">
                    I agree to the <Link to="/terms" className="text-mamas-primary hover:underline">Terms of Service</Link> and <Link to="/privacy" className="text-mamas-primary hover:underline">Privacy Policy</Link>
                  </label>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading || !agreedToTerms}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-full shadow-md text-sm font-medium text-white bg-mamas-primary hover:bg-mamas-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mamas-primary disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Sending Code...' : 'Send Verification Code'}
                </button>
              </div>
              
              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => { setError(''); setSuccess(''); setStep('recovery-email'); }}
                  className="text-sm font-medium text-mamas-text-muted hover:text-mamas-accent transition-colors"
                >
                  Lost your phone? Recover account
                </button>
              </div>
            </form>
          )}

          {step === 'otp' && (
            <form className="space-y-6" onSubmit={handleVerifyOtp}>
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-slate-700 text-center">
                  Enter Verification Code sent to {phoneNumber}
                </label>
                <div className="mt-4">
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-mamas-primary sm:text-lg tracking-[0.5em] font-mono text-center transition-colors"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-full shadow-md text-sm font-medium text-white bg-mamas-primary hover:bg-mamas-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mamas-primary disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Verifying...' : 'Verify & Login'}
                </button>
              </div>
              
              <div className="text-center mt-6">
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="text-sm font-medium text-mamas-text-muted hover:text-mamas-primary transition-colors"
                >
                  Use a different phone number
                </button>
              </div>
            </form>
          )}

          {/* RECOVERY FLOW */}
          {step === 'recovery-email' && (
            <form className="space-y-6 animate-in fade-in slide-in-from-right-4" onSubmit={handleRequestRecovery}>
              <p className="text-sm text-slate-600 mb-4 text-center">
                Enter your registered email address to receive a secure recovery code.
              </p>
              <div>
                <label htmlFor="recoveryEmail" className="block text-sm font-medium text-slate-700">Email Address</label>
                <div className="mt-2 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="recoveryEmail"
                    type="email"
                    required
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-mamas-primary transition-colors"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 rounded-full shadow-md text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Recovery Code'}
              </button>
              <div className="text-center mt-4">
                <button type="button" onClick={() => setStep('phone')} className="text-sm text-slate-500 hover:text-mamas-primary">Back to Login</button>
              </div>
            </form>
          )}

          {step === 'recovery-code' && (
            <form className="space-y-6 animate-in fade-in slide-in-from-right-4" onSubmit={handleVerifyRecoveryCode}>
              <p className="text-sm text-slate-600 mb-4 text-center">
                We sent a 6-digit code to <strong>{recoveryEmail}</strong>.
              </p>
              <div>
                <label htmlFor="recoveryCode" className="block text-sm font-medium text-slate-700 text-center">Enter Recovery Code</label>
                <div className="mt-4 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <KeyRound className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="recoveryCode"
                    type="text"
                    required
                    maxLength={6}
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg tracking-widest font-mono text-center focus:ring-2 focus:ring-mamas-primary transition-colors"
                    placeholder="000000"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 rounded-full shadow-md text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
            </form>
          )}

          {step === 'recovery-new-phone' && (
            <form className="space-y-6 animate-in fade-in slide-in-from-right-4" onSubmit={handleSendRecoveryNewOtp}>
              <p className="text-sm text-slate-600 mb-4 text-center">
                Code verified. Please enter your <strong className="text-mamas-primary">new</strong> phone number.
              </p>
              <div>
                <label htmlFor="recoveryNewPhone" className="block text-sm font-medium text-slate-700">New Phone Number</label>
                <div className="mt-2 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="recoveryNewPhone"
                    type="tel"
                    required
                    value={recoveryNewPhone}
                    onChange={(e) => setRecoveryNewPhone(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-mamas-primary transition-colors"
                    placeholder="+256 700 000000"
                  />
                </div>
              </div>
              <div id="recaptcha-container-recovery" className="flex justify-center"></div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 rounded-full shadow-md text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-50"
              >
                {loading ? 'Sending OTP...' : 'Send Verification OTP'}
              </button>
            </form>
          )}

          {step === 'recovery-new-otp' && (
            <form className="space-y-6 animate-in fade-in slide-in-from-right-4" onSubmit={handleCompleteRecovery}>
              <p className="text-sm text-slate-600 mb-4 text-center">
                Enter the OTP sent to your new phone number to complete account recovery.
              </p>
              <div>
                <label htmlFor="recoveryNewOtp" className="block text-sm font-medium text-slate-700 text-center">OTP for New Phone</label>
                <div className="mt-4">
                  <input
                    id="recoveryNewOtp"
                    type="text"
                    required
                    maxLength={6}
                    value={recoveryNewOtp}
                    onChange={(e) => setRecoveryNewOtp(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 border border-slate-300 rounded-lg tracking-widest font-mono text-center focus:ring-2 focus:ring-mamas-primary transition-colors"
                    placeholder="000000"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-full shadow-md text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? 'Updating Account...' : 'Complete Recovery'} <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
          {/* END RECOVERY FLOW */}

          {!step.startsWith('recovery') && (
            <div className="mt-8 text-center text-sm text-slate-600">
              Don't have an account?{' '}
              <Link to="/register" className="font-semibold text-mamas-accent hover:text-mamas-accent-hover transition-colors">
                Become a member
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
