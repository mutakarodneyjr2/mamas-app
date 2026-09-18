import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { Mail, KeyRound, Eye, EyeOff, ShieldCheck, Heart, GraduationCap, ArrowRight, Sparkles, PhoneCall, MessageSquare, HelpCircle, ShieldAlert } from 'lucide-react';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { LostEmailModal } from '../components/LostEmailModal';
import { getAppSettings } from '../lib/services';
import { getActiveBanners } from '../lib/bannerService';
import { getAuthActionSettings } from '../lib/authActionSettings';
import { openTel, openWhatsApp, openMailto } from '../lib/openExternal';

type LoginStep = 'login' | 'forgot-password';

export default function Login() {
  const { currentUser, userProfile, googleSignIn, checkUserExists, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const returnUrl = (location.state as any)?.from || searchParams.get('returnUrl') || '/dashboard';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<LoginStep>('login');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);

  const [supportPhone, setSupportPhone] = useState<string>('');
  const [supportWhatsApp, setSupportWhatsApp] = useState<string>('');
  const [supportEmail, setSupportEmail] = useState<string>('');

  const [activeBanners, setActiveBanners] = useState<string[]>([]);
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);

  useEffect(() => {
    let isMounted = true;
    getActiveBanners().then(banners => {
      if (isMounted) {
        const urls = banners.map(b => b.url).filter(Boolean);
        if (urls.length > 0) {
          setActiveBanners(urls);
        }
      }
    }).catch(err => console.error("Error loading banners for Login page:", err));

    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (activeBanners.length <= 1) return;
    const interval = setInterval(() => {
      setActiveBannerIdx(prev => (prev + 1) % activeBanners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeBanners]);

  useEffect(() => {
    let isMounted = true;
    getAppSettings().then(settings => {
      if (isMounted) {
        if (settings.supportPhone) setSupportPhone(settings.supportPhone);
        if (settings.supportWhatsApp) setSupportWhatsApp(settings.supportWhatsApp);
        if (settings.supportEmail) setSupportEmail(settings.supportEmail);
      }
    }).catch(err => console.error("Error loading app settings for Login page:", err));

    return () => { isMounted = false; };
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
      if (err.code === 'auth/popup-blocked' || err.message?.includes('popup')) {
        setError('Please allow popups for this site or use email/password login instead.');
      } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setError(err.message || 'Failed to sign in with Google.');
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
      await sendPasswordResetEmail(auth, email, getAuthActionSettings('/login?mode=resetPassword'));
      setSuccess('Check your email for password reset instructions.');
    } catch (err: any) {
      console.error(err);
      setError('Failed to send reset email. Please check the email address.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-mamas-bg flex flex-col animate-in fade-in duration-300">
      
      {/* Immersive Banner Section at the top (covers from top to near middle, NO card boundary, banner is perfectly visible and clear) */}
      <div className="relative w-full overflow-hidden min-h-[300px] sm:min-h-[380px] flex flex-col items-center justify-center p-6 text-center">
        
        {/* Sliding Background */}
        {activeBanners.length > 0 ? (
          <div className="absolute inset-0 z-0">
            <div 
              className="absolute inset-0 bg-cover bg-center transition-all duration-1000 transform scale-100"
              style={{ 
                backgroundImage: `url(${activeBanners[activeBannerIdx]})`,
              }}
            />
            {/* Extremely subtle top & bottom shadow gradient vignette to keep banner crisp and 100% visible, no dark blur */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/45" />
          </div>
        ) : (
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#07132c] via-[#0f2756] to-[#1e3a8a]" />
        )}

        {/* Content sitting cleanly inside the background */}
        <div className="relative z-10 space-y-4.5 max-w-xl">
          <div className="inline-block transform hover:scale-105 transition-all">
            <Logo dark />
          </div>
          
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3.5xl font-black text-white tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]">
              {step === 'login' ? 'Welcome Back' : 'Reset Password'}
            </h1>
            <p className="text-xs sm:text-sm text-blue-50 font-bold max-w-sm mx-auto leading-relaxed drop-shadow-[0_1.5px_2.5px_rgba(0,0,0,0.85)]">
              {step === 'login' 
                ? 'Sign in to continue your journey with the Matuumu Alumni family.'
                : 'Enter your email address to receive password reset instructions.'}
            </p>
          </div>
        </div>

        {/* Carousel indicator dots */}
        {activeBanners.length > 1 && (
          <div className="absolute bottom-4 flex gap-1.5 z-10 bg-black/40 px-3 py-1 rounded-full backdrop-blur-xs">
            {activeBanners.map((_, idx) => (
              <span 
                key={idx}
                className={`h-1.5 rounded-full transition-all ${idx === activeBannerIdx ? 'w-5 bg-blue-400' : 'w-1.5 bg-white/40'}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Main Login Form Container below */}
      <div className="w-full max-w-md mx-auto py-8 px-4 sm:px-6 flex-1">
        
        {/* Feedback Messages */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold animate-in fade-in space-y-2">
              <p>{error}</p>
              {error.includes('register first') && (
                <Link to="/register" className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 hover:underline">
                  <span>Register with Google now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
              {success}
            </div>
          )}

          {/* LOGIN STEP */}
          {step === 'login' && (
            <div className="space-y-6">
              
              {/* Google Sign-In Button */}
              <div>
                <GoogleSignInButton
                  mode="login"
                  onClick={handleGoogleSignIn}
                  loading={loading}
                  className="rounded-2xl py-3.5 font-semibold text-sm shadow-xs hover:shadow-md border-slate-300 dark:border-slate-700 transition-all active:scale-[0.99]"
                />
              </div>

              {/* Divider */}
              <div className="relative flex items-center justify-center my-4">
                <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                <span className="absolute bg-white dark:bg-[#0c1731] px-3 text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                  OR
                </span>
              </div>

              {/* Email & Password Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                
                {/* Email Field */}
                <div>
                  <label htmlFor="email" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-4 h-4" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      required
                      placeholder="e.g. member@mamas.org"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => { setError(''); setSuccess(''); setStep('forgot-password'); }}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <KeyRound className="h-4 h-4" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading || !email || !password}
                    className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md shadow-blue-500/25 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <span>Signing in...</span>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

              </form>

              {/* Bottom Register & Recovery CTA */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center gap-2 text-center text-xs text-slate-600 dark:text-slate-400">
                <div>
                  Don't have an account yet?{' '}
                  <Link 
                    to="/register" 
                    className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Become a Member
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRecoveryOpen(true)}
                  className="text-[11px] font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors cursor-pointer flex items-center gap-1 mt-1"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Lost access to your email? Recover Account</span>
                </button>
              </div>

            </div>
          )}

          {/* FORGOT PASSWORD STEP */}
          {step === 'forgot-password' && (
            <form onSubmit={handleForgotPassword} className="space-y-4 animate-in fade-in duration-200">
              <div>
                <label htmlFor="resetEmail" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Your Account Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 h-4" />
                  </div>
                  <input
                    id="resetEmail"
                    type="email"
                    required
                    placeholder="e.g. member@mamas.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md shadow-blue-500/25 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer"
              >
                {loading ? 'Sending link...' : 'Send Reset Link'}
              </button>

              <div className="flex flex-col items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setError(''); setSuccess(''); setStep('login'); }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                >
                  &larr; Back to Login
                </button>
                <button
                  type="button"
                  onClick={() => setIsRecoveryOpen(true)}
                  className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Lost access to inbox? Recover Account</span>
                </button>
              </div>
            </form>
          )}

          {/* Executive Support Contacts */}
          {(supportPhone || supportWhatsApp || supportEmail) && (
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80">
              <div className="text-center mb-2.5">
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center justify-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  Need Help or Executive Support?
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {supportPhone && (
                  <button
                    type="button"
                    onClick={() => openTel(supportPhone)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Call Support</span>
                  </button>
                )}
                {supportWhatsApp && (
                  <button
                    type="button"
                    onClick={() => openWhatsApp(supportWhatsApp, 'Hello MAMAS Executive, I need assistance with my account access.')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/60 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                    <span>WhatsApp</span>
                  </button>
                )}
                {supportEmail && (
                  <button
                    type="button"
                    onClick={() => openMailto(supportEmail, 'MAMAS Account Assistance Request')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>Email Us</span>
                  </button>
                )}
              </div>
            </div>
          )}

      </div>

      {/* Account & Lost Email Recovery Modal */}
      <LostEmailModal
        isOpen={isRecoveryOpen}
        onClose={() => setIsRecoveryOpen(false)}
        prefillEmail={email}
      />
    </div>
  );
}
