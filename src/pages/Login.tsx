import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { LogoLarge } from '../components/Logo';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { verifyPin, setPin } from '../lib/auth-pin';
import { 
  Mail, 
  Phone, 
  KeyRound, 
  ArrowRight, 
  GraduationCap, 
  HelpCircle, 
  PhoneCall, 
  MessageSquare, 
  ChevronDown, 
  ChevronUp
} from 'lucide-react';

type LoginStep = 'phone' | 'forgot-pin-phone' | 'forgot-pin-otp' | 'forgot-pin-new' | 'recovery-email' | 'recovery-code' | 'recovery-choose-action' | 'recovery-reset-pin' | 'recovery-new-phone' | 'recovery-new-otp';

export default function Login() {
  const { sendOtp, verifyOtp, setupRecaptcha, currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pin, setPinValue] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<LoginStep>('phone');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLoginHelp, setShowLoginHelp] = useState(false);

  // Support contacts
  const [supportPhone, setSupportPhone] = useState('+256 770 000000');
  const [supportWhatsApp, setSupportWhatsApp] = useState('+256 700 000000');

  // Recovery States
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [recoveryRequestId, setRecoveryRequestId] = useState('');
  const [recoveryOldPhone, setRecoveryOldPhone] = useState('');
  const [recoveryNewPhone, setRecoveryNewPhone] = useState('');
  const [recoveryNewOtp, setRecoveryNewOtp] = useState('');
  const [recoveryNewPin, setRecoveryNewPin] = useState('');
  const [recoveryConfirmNewPin, setRecoveryConfirmNewPin] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'appSettings', 'main'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.supportPhone) setSupportPhone(data.supportPhone);
          if (data.supportWhatsApp) setSupportWhatsApp(data.supportWhatsApp);
        }
      } catch (e) {
        console.error("Error loading support contacts:", e);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (step === 'forgot-pin-phone' || step === 'recovery-new-phone') {
      setupRecaptcha('recaptcha-container-recovery');
    }
  }, [step, setupRecaptcha]);

  useEffect(() => {
    if (currentUser && step === 'phone') {
      if (userProfile) {
        navigate('/dashboard');
      } else {
        navigate('/register');
      }
    }
  }, [currentUser, userProfile, navigate, step]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let formattedPhone = phoneNumber;
      if (formattedPhone.startsWith('0')) formattedPhone = '+256' + formattedPhone.substring(1);
      else if (!formattedPhone.startsWith('+')) formattedPhone = '+' + formattedPhone;
      
      await verifyPin(formattedPhone, pin);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("Account locked")) {
         setError(err.message);
      } else {
         setError('Invalid phone number or PIN. If you forgot your PIN, click "Forgot PIN?" below.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPinSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let formattedPhone = phoneNumber;
      if (formattedPhone.startsWith('0')) formattedPhone = '+256' + formattedPhone.substring(1);
      else if (!formattedPhone.startsWith('+')) formattedPhone = '+' + formattedPhone;
      
      await sendOtp(formattedPhone, 'recaptcha-container-recovery');
      setStep('forgot-pin-otp');
    } catch (err: any) {
      console.error(err);
      setError('Failed to send verification code. Please check your number and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPinVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verifyOtp(otp);
      setStep('forgot-pin-new');
    } catch (err: any) {
      console.error(err);
      setError('Failed to verify code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPinCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPin.length < 4 || newPin.length > 6) {
      setError("PIN must be between 4 and 6 digits");
      return;
    }
    
    if (newPin !== confirmNewPin) {
      setError("PINs do not match");
      return;
    }
    
    setLoading(true);
    try {
      if (!currentUser) throw new Error("Not authenticated");
      let formattedPhone = phoneNumber;
      if (formattedPhone.startsWith('0')) formattedPhone = '+256' + formattedPhone.substring(1);
      else if (!formattedPhone.startsWith('+')) formattedPhone = '+' + formattedPhone;

      await setPin(currentUser.uid, formattedPhone, newPin);
      
      setSuccess("PIN reset successfully! You can now log in.");
      setStep('phone');
      setPinValue('');
      setNewPin('');
      setConfirmNewPin('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to set PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
      setRecoveryOldPhone(data.phoneNumber);
      setSuccess('Code verified.');
      setStep('recovery-choose-action');
      
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
      
      await sendOtp(formattedPhone, 'recaptcha-container-recovery');
      setStep('recovery-new-otp');
    } catch (err: any) {
      console.error(err);
      const msg = err.message || '';
      if (err.code === 'auth/invalid-phone-number' || msg.includes('invalid-phone-number')) {
        setError('Invalid phone number format.');
      } else if (err.code === 'auth/too-many-requests' || msg.includes('too-many-requests')) {
        setError('Too many attempts. Please try again later.');
      } else if (err.code === 'auth/network-request-failed' || msg.includes('network')) {
        setError('Network error. Please check your connection.');
      } else if (err.code === 'auth/captcha-check-failed' || msg.includes('recaptcha')) {
        setError('Security check failed. Please refresh.');
      } else {
        setError('Failed to send OTP. Please check the phone number.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRecoveryResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recoveryNewPin.length < 4 || recoveryNewPin.length > 6) {
      setError('PIN must be 4 to 6 digits.');
      return;
    }
    if (recoveryNewPin !== recoveryConfirmNewPin) {
      setError('PINs do not match.');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const cleanPhone = recoveryOldPhone.replace(/[^a-zA-Z0-9+]/g, '');
      const timestamp = Date.now();
      const syntheticEmail = `${cleanPhone}_${timestamp}@mama-alumin.local`;
      const syntheticPassword = `MAMAS-PIN-${recoveryNewPin}`;
      
      const { auth } = await import('../firebase');
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      
      const newCred = await createUserWithEmailAndPassword(auth, syntheticEmail, syntheticPassword);
      const newIdToken = await newCred.user.getIdToken();

      const res = await fetch('/api/recovery/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: recoveryRequestId,
          recoveryToken,
          newIdToken
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccess('PIN reset successfully! Logging you in...');
      setTimeout(() => {
        navigate('/dashboard');
        window.location.reload(); 
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to reset PIN.');
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
      const cred: any = await verifyOtp(recoveryNewOtp);
      const newIdToken = await cred.user.getIdToken();

      const res = await fetch('/api/recovery/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: recoveryRequestId,
          recoveryToken,
          newIdToken
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setSuccess('Account recovered successfully! Logging you in...');
      setTimeout(() => {
        navigate('/dashboard');
        window.location.reload(); 
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
          
          <h2 className="text-2xl font-display font-bold text-mamas-primary text-center mb-6">
            {step === 'phone' && 'Welcome Back'}
            {step.startsWith('forgot-pin') && 'Reset Your PIN'}
            {step.startsWith('recovery') && 'Account Recovery'}
          </h2>

          {step === 'phone' && (
            <div className="mb-6 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/60 text-left">
              <button
                type="button"
                onClick={() => setShowLoginHelp(!showLoginHelp)}
                className="w-full p-3.5 flex items-center justify-between text-left text-xs font-bold text-mamas-primary hover:bg-slate-100/80 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-mamas-accent shrink-0" />
                  How Login, Registration & Approvals Work
                </span>
                {showLoginHelp ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
              </button>

              {showLoginHelp && (
                <div className="p-4 pt-0 text-xs text-slate-600 space-y-3 border-t border-slate-200/60 bg-white">
                  <p className="font-semibold text-mamas-text mt-3">Steps to join and access MAMAS:</p>
                  <ol className="list-decimal pl-4 space-y-2 leading-relaxed">
                    <li><strong>Registration:</strong> Click "Become a Member" to verify your phone number and create your profile.</li>
                    <li><strong>PIN Setup:</strong> During registration, you create a secure PIN.</li>
                    <li><strong>Login:</strong> Once registered, log in simply by entering your Phone Number and PIN.</li>
                    <li><strong>Executive Approval:</strong> The Executive Committee verifies your alumni records before you can use most features.</li>
                  </ol>

                  <div className="pt-3 border-t border-slate-100">
                    <p className="font-bold text-slate-700 mb-2">Need Help?</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <a
                        href={`tel:${supportPhone}`}
                        className="flex items-center justify-center gap-1.5 p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl hover:bg-emerald-100 font-bold transition-colors text-xs"
                      >
                        <PhoneCall className="w-3.5 h-3.5" /> Call Executive
                      </a>
                      <a
                        href={`https://wa.me/${supportWhatsApp.replace(/[^0-9]/g, '')}?text=Hello%20MAMAS%20Executive,%20I%20need%20help%20with%20my%20Matuumu%20Alumni%20registration/login`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 p-2.5 bg-teal-50 text-teal-800 border border-teal-200 rounded-xl hover:bg-teal-100 font-bold transition-colors text-xs"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Help
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
            <form className="space-y-6" onSubmit={handleLogin}>
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

              <div>
                <label htmlFor="pin" className="block text-sm font-medium text-slate-700">
                  PIN
                </label>
                <div className="mt-2 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <KeyRound className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="pin"
                    name="pin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]{4,6}"
                    required
                    placeholder="Enter your PIN"
                    value={pin}
                    onChange={(e) => setPinValue(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-mamas-primary sm:text-base transition-colors"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading || !phoneNumber || !pin}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-full shadow-md text-sm font-medium text-white bg-mamas-primary hover:bg-mamas-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mamas-primary disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Logging in...' : 'Log In'}
                </button>
              </div>
              
              <div className="text-center mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => { setError(''); setSuccess(''); setStep('forgot-pin-phone'); }}
                  className="text-sm font-medium text-mamas-primary hover:text-mamas-primary-hover transition-colors"
                >
                  Forgot PIN?
                </button>
                <button
                  type="button"
                  onClick={() => { setError(''); setSuccess(''); setStep('recovery-email'); }}
                  className="text-sm font-medium text-slate-500 hover:text-mamas-accent transition-colors"
                >
                  Lost your phone? Recover account
                </button>
              </div>
            </form>
          )}

          {step === 'forgot-pin-phone' && (
            <form className="space-y-6 animate-in fade-in slide-in-from-right-4" onSubmit={handleForgotPinSendOtp}>
              <p className="text-sm text-slate-600 mb-4 text-center">
                Enter your registered phone number to receive a verification code.
              </p>
              <div>
                <label htmlFor="forgotPhone" className="block text-sm font-medium text-slate-700">Phone Number</label>
                <div className="mt-2 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="forgotPhone"
                    type="tel"
                    required
                    placeholder="+256 700 000000"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-mamas-primary transition-colors"
                  />
                </div>
              </div>
              <div id="recaptcha-container-recovery" className="flex justify-center"></div>
              <button
                type="submit"
                disabled={loading || !phoneNumber}
                className="w-full flex justify-center py-3 px-4 rounded-full shadow-md text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-50"
              >
                {loading ? 'Sending OTP...' : 'Send Verification Code'}
              </button>
              <div className="text-center mt-4">
                <button type="button" onClick={() => setStep('phone')} className="text-sm text-slate-500 hover:text-mamas-primary">Back to Login</button>
              </div>
            </form>
          )}

          {step === 'forgot-pin-otp' && (
            <form className="space-y-6 animate-in fade-in slide-in-from-right-4" onSubmit={handleForgotPinVerifyOtp}>
              <p className="text-sm text-slate-600 mb-4 text-center">
                We sent a 6-digit code to <strong>{phoneNumber}</strong>.
              </p>
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-slate-700 text-center">Enter Verification Code</label>
                <div className="mt-4 relative">
                  <input
                    id="otp"
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 border border-slate-300 rounded-lg tracking-widest font-mono text-center focus:ring-2 focus:ring-mamas-primary transition-colors"
                    placeholder="000000"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full flex justify-center py-3 px-4 rounded-full shadow-md text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
              <div className="text-center mt-4">
                <button type="button" onClick={() => setStep('forgot-pin-phone')} className="text-sm text-slate-500 hover:text-mamas-primary">Go Back</button>
              </div>
            </form>
          )}

          {step === 'forgot-pin-new' && (
            <form className="space-y-6 animate-in fade-in slide-in-from-right-4" onSubmit={handleForgotPinCreateNew}>
              <p className="text-sm text-slate-600 mb-4 text-center">
                Create a new 4 to 6 digit PIN.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700">New PIN</label>
                <input
                  type="password"
                  required
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  className="mt-2 block w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-mamas-primary tracking-widest text-center"
                  placeholder="••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Confirm New PIN</label>
                <input
                  type="password"
                  required
                  maxLength={6}
                  value={confirmNewPin}
                  onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
                  className="mt-2 block w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-mamas-primary tracking-widest text-center"
                  placeholder="••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading || newPin.length < 4}
                className="w-full flex justify-center py-3 px-4 rounded-full shadow-md text-sm font-medium text-white bg-mamas-primary hover:bg-mamas-primary-hover disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save New PIN'}
              </button>
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

          {step === 'recovery-choose-action' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <p className="text-sm text-slate-600 mb-4 text-center">
                What would you like to do?
              </p>
              <div className="flex flex-col gap-4">
                <button
                  type="button"
                  onClick={() => setStep('recovery-reset-pin')}
                  className="w-full flex justify-center py-3 px-4 rounded-full shadow-sm text-sm font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  I just forgot my PIN
                </button>
                <button
                  type="button"
                  onClick={() => setStep('recovery-new-phone')}
                  className="w-full flex justify-center py-3 px-4 rounded-full shadow-sm text-sm font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  I have a new phone number
                </button>
              </div>
            </div>
          )}

          {step === 'recovery-reset-pin' && (
            <form className="space-y-6 animate-in fade-in slide-in-from-right-4" onSubmit={handleRecoveryResetPin}>
              <p className="text-sm text-slate-600 mb-4 text-center">
                Set a new PIN for your account. You will keep your existing phone number ({recoveryOldPhone}).
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700">New PIN</label>
                <input
                  type="password"
                  required
                  maxLength={6}
                  value={recoveryNewPin}
                  onChange={(e) => setRecoveryNewPin(e.target.value.replace(/\D/g, ''))}
                  className="mt-2 block w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-mamas-primary tracking-widest text-center"
                  placeholder="••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Confirm New PIN</label>
                <input
                  type="password"
                  required
                  maxLength={6}
                  value={recoveryConfirmNewPin}
                  onChange={(e) => setRecoveryConfirmNewPin(e.target.value.replace(/\D/g, ''))}
                  className="mt-2 block w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-mamas-primary tracking-widest text-center"
                  placeholder="••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading || recoveryNewPin.length < 4}
                className="w-full flex justify-center py-3 px-4 rounded-full shadow-md text-sm font-medium text-white bg-mamas-primary hover:bg-mamas-primary-hover disabled:opacity-50"
              >
                {loading ? 'Resetting PIN...' : 'Reset PIN'}
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

          {!step.startsWith('recovery') && !step.startsWith('forgot-pin') && (
            <div className="mt-8 text-center text-sm text-slate-600 border-t border-slate-200 pt-6">
              Don't have an account?{' '}
              <Link to="/register" className="font-semibold text-mamas-accent hover:text-mamas-accent-hover transition-colors">
                Become a Member
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
