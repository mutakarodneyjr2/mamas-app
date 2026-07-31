import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { Mail, KeyRound, Eye, EyeOff, ShieldCheck, Heart, GraduationCap, ArrowRight, Sparkles, PhoneCall, MessageSquare, HelpCircle } from 'lucide-react';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { getAppSettings } from '../lib/services';

type LoginStep = 'login' | 'forgot-password';

export default function Login() {
  const { currentUser, userProfile, googleSignIn, checkUserExists, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/dashboard';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<LoginStep>('login');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const [supportPhone, setSupportPhone] = useState<string>('');
  const [supportWhatsApp, setSupportWhatsApp] = useState<string>('');
  const [supportEmail, setSupportEmail] = useState<string>('');

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
      setSuccess('Check your email for password reset instructions.');
    } catch (err: any) {
      console.error(err);
      setError('Failed to send reset email. Please check the email address.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden selection:bg-mamas-accent selection:text-mamas-primary">
      {/* Background Floating Abstract Blobs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 right-1/3 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Main Split Screen Container */}
      <div className="w-full max-w-5xl bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
        
        {/* Left Desktop Hero Section (50% on lg) */}
        <div className="hidden lg:flex lg:col-span-6 bg-gradient-to-br from-slate-900 via-mamas-primary to-slate-950 p-12 flex-col justify-between relative overflow-hidden border-r border-slate-800">
          
          {/* Subtle Graphic Accents */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Top Header Logo */}
          <div className="relative z-10">
            <Logo />
          </div>

          {/* Middle Content Quote */}
          <div className="relative z-10 space-y-6 my-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Matuumu Alumni Network</span>
            </div>

            <h2 className="text-3xl xl:text-4xl font-serif font-extrabold text-white leading-tight">
              Welcome Back to <br />
              <span className="text-amber-400">Our Alumni Family.</span>
            </h2>

            <p className="text-slate-300 text-sm leading-relaxed max-w-md">
              Where alumni support one another in times of need, fund school development, and grow together as one strong community.
            </p>

            {/* Feature Pills */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Heart className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Mutual Aid Welfare</h4>
                  <p className="text-[11px] text-slate-400">Grants and emergency support for members</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">School Development</h4>
                  <p className="text-[11px] text-slate-400">Giving back to Matuumu projects</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Footer Note */}
          <div className="relative z-10 pt-6 text-xs text-slate-400 border-t border-white/10 flex items-center justify-between">
            <span>&copy; {new Date().getFullYear()} MAMAS</span>
            <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <ShieldCheck className="w-4 h-4" /> Official Portal
            </span>
          </div>
        </div>

        {/* Right Form Card Section */}
        <div className="lg:col-span-6 p-6 sm:p-10 md:p-12 flex flex-col justify-center bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
          
          {/* Mobile Logo Header */}
          <div className="lg:hidden mb-6 text-center">
            <div className="inline-block">
              <Logo />
            </div>
          </div>

          {/* Form Hero Titles */}
          <div className="text-center sm:text-left mb-8">
            <h1 className="text-2xl sm:text-3xl font-serif font-extrabold text-slate-900 dark:text-white tracking-tight">
              {step === 'login' ? 'Welcome Back' : 'Reset Password'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5">
              {step === 'login' 
                ? 'Sign in to continue your journey with the Matuumu Alumni family.'
                : 'Enter your email address to receive password reset instructions.'}
            </p>
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold animate-in fade-in space-y-2">
              <p>{error}</p>
              {error.includes('register first') && (
                <Link to="/register" className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 hover:underline">
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
                  className="rounded-xl py-3.5 font-semibold text-sm shadow-sm hover:shadow-md border-slate-300 dark:border-slate-700 transition-all active:scale-[0.99]"
                />
              </div>

              {/* Divider */}
              <div className="relative flex items-center justify-center my-4">
                <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                <span className="absolute bg-white dark:bg-slate-900 px-3 text-[11px] font-bold tracking-widest text-slate-400 uppercase">
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
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
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
                      className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
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
                      className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
                    className="w-full py-3.5 px-6 rounded-full bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-400 text-white dark:text-slate-950 font-bold text-sm shadow-xl hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2"
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

              {/* Bottom Register CTA */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-600 dark:text-slate-400">
                Don't have an account yet?{' '}
                <Link 
                  to="/register" 
                  className="font-bold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  Become a Member
                </Link>
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
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3.5 px-6 rounded-full bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-bold text-sm shadow-lg hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all"
              >
                {loading ? 'Sending link...' : 'Send Reset Link'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setError(''); setSuccess(''); setStep('login'); }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                >
                  &larr; Back to Login
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
                  <a
                    href={`tel:${supportPhone}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-xs transition-colors"
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Call Support</span>
                  </a>
                )}
                {supportWhatsApp && (
                  <a
                    href={`https://wa.me/${supportWhatsApp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hello MAMAS Executive, I need assistance with my account access.')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/60 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 font-semibold text-xs transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                    <span>WhatsApp</span>
                  </a>
                )}
                {supportEmail && (
                  <a
                    href={`mailto:${supportEmail}?subject=${encodeURIComponent('MAMAS Account Assistance Request')}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 font-semibold text-xs transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>Email Us</span>
                  </a>
                )}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
