import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { Mail, KeyRound, Eye, EyeOff, ShieldCheck, Heart, GraduationCap, ArrowRight, Sparkles, PhoneCall, HelpCircle } from 'lucide-react';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { getAppSettings } from '../lib/services';
import { getActiveBanners } from '../lib/bannerService';

interface AuthResolverProps {
  initialMode: 'login' | 'register';
}

export default function AuthResolver({ initialMode }: AuthResolverProps) {
  const { currentUser, userProfile, googleSignIn, checkUserExists, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const returnUrl = (location.state as any)?.from || searchParams.get('returnUrl') || '/dashboard';

  const [mode, setMode] = useState<'login' | 'register' | 'forgot-password'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const [supportPhone, setSupportPhone] = useState<string>('');
  const [supportWhatsApp, setSupportWhatsApp] = useState<string>('');
  const [supportEmail, setSupportEmail] = useState<string>('');

  const [activeBanners, setActiveBanners] = useState<string[]>([]);
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);

  useEffect(() => {
    setMode(initialMode);
    setError('');
    setSuccess('');
  }, [initialMode]);

  useEffect(() => {
    let isMounted = true;
    getActiveBanners().then(banners => {
      if (isMounted) {
        const urls = banners.map(b => b.url).filter(Boolean);
        if (urls.length > 0) {
          setActiveBanners(urls);
        }
      }
    }).catch(err => console.error("Error loading banners for AuthResolver:", err));

    getAppSettings().then(settings => {
      if (isMounted) {
        if (settings.supportPhone) setSupportPhone(settings.supportPhone);
        if (settings.supportWhatsApp) setSupportWhatsApp(settings.supportWhatsApp);
        if (settings.supportEmail) setSupportEmail(settings.supportEmail);
      }
    }).catch(err => console.error("Error loading settings for AuthResolver:", err));

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
    if (currentUser) {
      if (userProfile) {
        navigate(returnUrl);
      } else if (currentUser.emailVerified) {
        // If they are logged in but don't have a profile yet, route to register details
        navigate('/register/details', {
          state: {
            email: currentUser.email,
            fullName: currentUser.displayName || fullName,
            authProvider: currentUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'email',
            googleUid: currentUser.providerData[0]?.providerId === 'google.com' ? currentUser.uid : ''
          }
        });
      }
    }
  }, [currentUser, userProfile, navigate, returnUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else if (mode === 'register') {
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          setLoading(false);
          return;
        }
        if (!agreedToTerms) {
          setError('You must agree to the Terms of Service and Privacy Policy.');
          setLoading(false);
          return;
        }

        const cred = await createUserWithEmailAndPassword(auth, email, password);
        try {
          await sendEmailVerification(cred.user);
        } catch (emailErr) {
          console.warn("Could not send verification email on signup:", emailErr);
        }

        // Navigate to details registration
        navigate('/register/details', {
          state: {
            email,
            fullName,
            authProvider: 'email'
          }
        });
      } else if (mode === 'forgot-password') {
        await sendPasswordResetEmail(auth, email);
        setSuccess('Check your email for password reset instructions.');
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already in use. Try signing in instead.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        setError('Invalid email or password. Please try again.');
      } else {
        setError(err.message || 'An authentication error occurred. Please try again.');
      }
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
        // User exists, redirect
        navigate(returnUrl);
      } else {
        // New Google user, proceed to details registration
        navigate('/register/details', {
          state: {
            email: cred.user.email,
            fullName: cred.user.displayName,
            googleUid: cred.user.uid,
            authProvider: 'google'
          }
        });
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-blocked' || err.message?.includes('popup')) {
        setError('Please allow popups for this site or use email/password instead.');
      } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setError('Google sign-in failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-mamas-bg flex flex-col animate-in fade-in duration-300">
      
      {/* Sliding Header Banner */}
      <div className="relative w-full overflow-hidden min-h-[300px] sm:min-h-[380px] flex flex-col items-center justify-center p-6 text-center">
        {activeBanners.length > 0 ? (
          <div className="absolute inset-0 z-0">
            <div 
              className="absolute inset-0 bg-cover bg-center transition-all duration-1000 transform scale-100"
              style={{ backgroundImage: `url(${activeBanners[activeBannerIdx]})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/45" />
          </div>
        ) : (
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#07132c] via-[#0f2756] to-[#1e3a8a]" />
        )}

        <div className="relative z-10 space-y-4.5 max-w-xl">
          <div className="inline-block transform hover:scale-105 transition-all">
            <Logo dark />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight drop-shadow-sm flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400 animate-pulse shrink-0" />
              <span>MAMAS Solidarity Network</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-200/90 max-w-md mx-auto leading-relaxed drop-shadow-xs font-semibold">
              The official welfare and solidarity platform for Matuumu Alumni Mutual Aid Association (MAMAS). Supporting members and school development.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 w-full mx-auto px-4 pb-16 relative z-20 transition-all duration-300 ${
        mode === 'register' ? 'max-w-6xl' : 'max-w-md -mt-10'
      }`}>
        <div className={
          mode === 'register'
            ? "space-y-6 w-full py-6"
            : "bg-white dark:bg-[#0c1731] rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xl p-6 sm:p-8 space-y-6"
        }>
          
          {/* Mode Switch Tabs */}
          {mode !== 'forgot-password' && (
            <div className="flex p-1 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setMode('login')}
                className={`flex-1 py-3 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setMode('register')}
                className={`flex-1 py-3 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                  mode === 'register'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Register
              </button>
            </div>
          )}

          {mode === 'forgot-password' && (
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-950 dark:text-white">Reset Password</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter your email address to receive reset instructions.
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0 animate-pulse" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl text-xs font-semibold text-emerald-750 dark:text-emerald-300 flex items-center gap-2.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                  Full Name (As in School Records)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <GraduationCap className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="e.g. John Doe"
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 pl-11 pr-4 text-xs sm:text-sm outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 font-medium"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="e.g. brother@mamas.org"
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 pl-11 pr-4 text-xs sm:text-sm outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 font-medium"
                />
              </div>
            </div>

            {mode !== 'forgot-password' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setMode('forgot-password')}
                      className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 pl-11 pr-11 text-xs sm:text-sm outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 font-medium font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <KeyRound className="w-4 h-4" />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 pl-11 pr-4 text-xs sm:text-sm outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 font-medium font-mono"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-2.5 p-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    required
                    className="w-4 h-4 text-blue-600 rounded mt-0.5"
                  />
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    I agree to the <Link to="/terms" className="text-blue-600 hover:underline">Terms of Service</Link> and <Link to="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
                  </span>
                </label>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-extrabold uppercase tracking-wider shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In' : mode === 'register' ? 'Register Account' : 'Send Reset Link'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {mode !== 'forgot-password' && (
            <div className="space-y-4">
              <div className="relative flex items-center justify-center py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100 dark:border-slate-800" />
                </div>
                <span className={`relative z-10 px-4 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 ${
                  mode === 'register' ? 'bg-mamas-bg' : 'bg-white dark:bg-[#0c1731]'
                }`}>
                  Or Connect With
                </span>
              </div>

              <GoogleSignInButton onClick={handleGoogleSignIn} disabled={loading} mode={mode === 'register' ? 'register' : 'login'} />
            </div>
          )}

          {mode === 'forgot-password' && (
            <button
              type="button"
              onClick={() => setMode('login')}
              className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
            >
              Back to Sign In
            </button>
          )}

          <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800/60 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 leading-snug font-medium">
              We verify all members manually against official Matuumu Secondary School graduation records for network security.
            </div>
          </div>

        </div>

        {/* Support Section */}
        {(supportPhone || supportWhatsApp || supportEmail) && (
          <div className="mt-6 text-center space-y-2">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Need assistance? Contact support
            </p>
            <div className="flex items-center justify-center gap-3 text-xs">
              {supportPhone && (
                <a href={`tel:${supportPhone}`} className="inline-flex items-center gap-1.5 text-slate-500 hover:text-blue-600 dark:text-slate-400 transition-colors">
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Call</span>
                </a>
              )}
              {supportWhatsApp && (
                <a href={`https://wa.me/${supportWhatsApp}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-emerald-600 dark:text-slate-400 transition-colors">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              )}
              {supportEmail && (
                <a href={`mailto:${supportEmail}`} className="inline-flex items-center gap-1.5 text-slate-500 hover:text-rose-600 dark:text-slate-400 transition-colors">
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email</span>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
