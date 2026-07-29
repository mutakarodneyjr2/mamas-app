import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { LogoLarge } from '../components/Logo';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { Mail, KeyRound, HelpCircle, ChevronDown, ChevronUp, PhoneCall, MessageSquare } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

type LoginStep = 'login' | 'forgot-password';

export default function Login() {
  const { currentUser, userProfile, googleSignIn, checkUserExists, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/dashboard';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<LoginStep>('login');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLoginHelp, setShowLoginHelp] = useState(false);

  // Support contacts
  const [supportPhone, setSupportPhone] = useState('+256 770 000000');
  const [supportWhatsApp, setSupportWhatsApp] = useState('+256 700 000000');

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
    if (currentUser && step === 'login') {
      if (userProfile) {
        navigate(returnUrl);
      }
    }
  }, [currentUser, userProfile, navigate, step, returnUrl]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error(err);
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const cred = await googleSignIn();
      const exists = await checkUserExists(cred.user.uid);
      if (exists) {
        // user exists, useEffect will navigate to dashboard
      } else {
        await logout(); // Sign out since they don't have an account
        setError('No account found for this Google account. Please register first.');
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-blocked') {
        setError('Please allow popups for this site to sign in with Google.');
      } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setError('Failed to sign in with Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess('Check your email for reset instructions.');
    } catch (err: any) {
      console.error(err);
      setError('Failed to send reset email. Please check the email address.');
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
            {step === 'login' ? 'Welcome Back' : 'Reset Password'}
          </h2>

          {step === 'login' && (
            <div className="mb-6 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/60 text-left">
              <button
                type="button"
                onClick={() => setShowLoginHelp(!showLoginHelp)}
                className="w-full p-3.5 flex items-center justify-between text-left text-xs font-bold text-mamas-primary hover:bg-slate-100/80 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-mamas-accent shrink-0" />
                  Important Update: Email Login
                </span>
                {showLoginHelp ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
              </button>

              {showLoginHelp && (
                <div className="p-4 pt-0 text-xs text-slate-600 space-y-3 border-t border-slate-200/60 bg-white">
                  <p className="font-semibold text-mamas-text mt-3">We have upgraded our security.</p>
                  <p>MAMAS now uses Email and Password for logging in instead of phone number and PIN.</p>
                  <p><strong>If you previously used a phone number and PIN, you must create a new account by clicking "Become a Member" below.</strong></p>

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
                        href={`https://wa.me/${supportWhatsApp.replace(/[^0-9]/g, '')}?text=Hello%20MAMAS%20Executive,%20I%20need%20help%20with%20my%20Matuumu%20Alumni%20login`}
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
            <div className="mb-6 bg-rose-50 border-l-4 border-mamas-danger text-mamas-danger px-4 py-3 rounded-r text-sm font-medium shadow-sm flex flex-col gap-2">
              <span>{error}</span>
              {error.includes('register first') && (
                <Link to="/register" className="inline-block mt-2 font-semibold text-mamas-primary hover:underline">
                  Register with Google &rarr;
                </Link>
              )}
            </div>
          )}
          {success && (
            <div className="mb-6 bg-teal-50 border-l-4 border-teal-600 text-teal-700 px-4 py-3 rounded-r text-sm font-medium shadow-sm">
              {success}
            </div>
          )}

          {step === 'login' && (
            <div className="space-y-6">
              <GoogleSignInButton
                mode="login"
                onClick={handleGoogleSignIn}
                loading={loading}
              />

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-mamas-card text-slate-500 font-medium">— OR —</span>
                </div>
              </div>

              <form className="space-y-6" onSubmit={handleLogin}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                    Email Address
                  </label>
                  <div className="mt-2 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="appearance-none block w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-mamas-primary sm:text-base transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <div className="mt-2 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <KeyRound className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="appearance-none block w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-mamas-primary sm:text-base transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading || !email || !password}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-full shadow-md text-sm font-medium text-white bg-mamas-primary hover:bg-mamas-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mamas-primary disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'Logging in...' : 'Log In'}
                  </button>
                </div>
                
                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => { setError(''); setSuccess(''); setStep('forgot-password'); }}
                    className="text-sm font-medium text-mamas-primary hover:text-mamas-primary-hover transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
              </form>
            </div>
          )}

          {step === 'forgot-password' && (
            <form className="space-y-6 animate-in fade-in slide-in-from-right-4" onSubmit={handleForgotPassword}>
              <p className="text-sm text-slate-600 mb-4 text-center">
                Enter your email address to receive a password reset link.
              </p>
              <div>
                <label htmlFor="resetEmail" className="block text-sm font-medium text-slate-700">Email Address</label>
                <div className="mt-2 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="resetEmail"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-mamas-primary transition-colors"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full flex justify-center py-3 px-4 rounded-full shadow-md text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
              <div className="text-center mt-4">
                <button type="button" onClick={() => setStep('login')} className="text-sm text-slate-500 hover:text-mamas-primary">Back to Login</button>
              </div>
            </form>
          )}

          {step === 'login' && (
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
