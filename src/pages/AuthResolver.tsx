import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendEmailVerification, 
  GoogleAuthProvider 
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { 
  Mail, KeyRound, Eye, EyeOff, ShieldCheck, 
  Sparkles, PhoneCall, HelpCircle, ArrowRight, 
  AlertCircle, CheckCircle2, RefreshCw, User, HelpCircle as QuestionIcon
} from 'lucide-react';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { getAppSettings } from '../lib/services';
import { getActiveBanners } from '../lib/bannerService';
import { 
  normalizeEmail, 
  detectSignInMethods, 
  resolveUserStatusRoute, 
  sendPasswordReset 
} from '../lib/authResolver';
import { getAuthActionSettings } from '../lib/authActionSettings';
import { openTel, openMailto, openWhatsApp } from '../lib/openExternal';
import { LostEmailModal } from '../components/LostEmailModal';
import { AccountLinkModal } from '../components/AccountLinkModal';

interface AuthResolverProps {
  initialMode: 'login' | 'register';
}

export default function AuthResolver({ initialMode }: AuthResolverProps) {
  const { currentUser, userProfile, loading: authLoading, logout, googleSignIn, checkUserExists } = useAuth();
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
  const [googlePromptMessage, setGooglePromptMessage] = useState<string | null>(null);

  // Modals
  const [isLostEmailOpen, setIsLostEmailOpen] = useState(false);
  const [accountLinkState, setAccountLinkState] = useState<{
    isOpen: boolean;
    email: string;
    credential: any;
  }>({
    isOpen: false,
    email: '',
    credential: null
  });

  // Support & banners
  const [supportPhone, setSupportPhone] = useState<string>('');
  const [supportWhatsApp, setSupportWhatsApp] = useState<string>('');
  const [supportEmail, setSupportEmail] = useState<string>('');
  const [activeBanners, setActiveBanners] = useState<string[]>([]);
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);

  useEffect(() => {
    setMode(initialMode);
    setError('');
    setSuccess('');
    setGooglePromptMessage(null);
  }, [initialMode]);

  useEffect(() => {
    let isMounted = true;
    getActiveBanners().then(banners => {
      if (isMounted) {
        const urls = banners.map(b => b.url).filter(Boolean);
        if (urls.length > 0) setActiveBanners(urls);
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

  // Route authenticated user based on membership status
  useEffect(() => {
    if (authLoading) return;

    if (currentUser) {
      if (userProfile) {
        // Sync emailVerified if user has now verified
        if (currentUser.emailVerified && !userProfile.emailVerified) {
          updateDoc(doc(db, 'users', currentUser.uid), { emailVerified: true }).catch(console.warn);
        }

        const destination = userProfile.status === 'approved' 
          ? (returnUrl !== '/login' && returnUrl !== '/register' ? returnUrl : '/dashboard')
          : resolveUserStatusRoute(userProfile, currentUser);
        
        navigate(destination, { replace: true });
      } else if (mode === 'register') {
        // User is authenticated in Firebase Auth and in register flow but has no Firestore profile doc
        navigate('/register/details', {
          state: {
            email: currentUser.email,
            fullName: currentUser.displayName || fullName,
            authProvider: currentUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'email',
            googleUid: currentUser.uid
          },
          replace: true
        });
      }
    }
  }, [currentUser, userProfile, authLoading, mode, navigate, returnUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setGooglePromptMessage(null);
    setLoading(true);

    const cleanEmail = normalizeEmail(email);

    try {
      if (mode === 'login') {
        // First, check sign-in methods to give precise feedback if Google-only or non-existent
        try {
          const methods = await detectSignInMethods(cleanEmail);
          if (methods.length > 0 && methods.includes('google.com') && !methods.includes('password')) {
            setGooglePromptMessage("This account was created with Google sign-in. Please continue with Google, or set a password using Forgot Password.");
            setLoading(false);
            return;
          }
        } catch (checkErr) {
          // Continue to attempt sign in if detection throws
        }

        await signInWithEmailAndPassword(auth, cleanEmail, password);
        // Navigation will be handled by useEffect above
      } else if (mode === 'register') {
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }
        if (!agreedToTerms) {
          setError('You must agree to the Terms of Service and Privacy Policy.');
          setLoading(false);
          return;
        }

        // Check if account exists first
        const methods = await detectSignInMethods(cleanEmail);
        if (methods.length > 0) {
          setError('An account with this email already exists. Please sign in or reset your password.');
          setLoading(false);
          return;
        }

        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        try {
          await sendEmailVerification(cred.user, getAuthActionSettings('/pending-approval?mode=verifyEmail'));
        } catch (emailErr) {
          console.warn("Could not send verification email on signup:", emailErr);
        }

        navigate('/register/details', {
          state: {
            email: cleanEmail,
            fullName,
            authProvider: 'email'
          },
          replace: true
        });
      } else if (mode === 'forgot-password') {
        const res = await sendPasswordReset(cleanEmail);
        setSuccess(res.message);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already in use. Please sign in instead.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (err.code === 'auth/user-not-found') {
        setError('No account found with this email. Would you like to create one?');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please verify your credentials or use Forgot Password.');
      } else {
        setError(err.message || 'An authentication error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGooglePromptMessage(null);
    setLoading(true);
    try {
      const cred = await googleSignIn();
      const exists = await checkUserExists(cred.user.uid);
      if (exists) {
        // Will be routed by useEffect
      } else {
        // New Google user -> route to details
        navigate('/register/details', {
          state: {
            email: cred.user.email,
            fullName: cred.user.displayName,
            googleUid: cred.user.uid,
            authProvider: 'google'
          },
          replace: true
        });
      }
    } catch (err: any) {
      console.error("Google sign in error:", err);
      if (err.code === 'auth/account-exists-with-different-credential') {
        const pendingCred = GoogleAuthProvider.credentialFromError(err);
        const emailFromError = err.customData?.email || email;
        setAccountLinkState({
          isOpen: true,
          email: emailFromError,
          credential: pendingCred
        });
      } else if (err.code === 'auth/popup-blocked' || err.message?.includes('popup')) {
        setError('Please allow popups for this site or use email/password instead.');
      } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setError(err.message || 'Google sign-in failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-mamas-bg flex flex-col animate-in fade-in duration-300">
      
      {/* Sliding Header Banner */}
      <div className="relative w-full overflow-hidden min-h-[280px] sm:min-h-[340px] flex flex-col items-center justify-center p-6 text-center">
        {activeBanners.length > 0 ? (
          <div className="absolute inset-0 z-0">
            <div 
              className="absolute inset-0 bg-cover bg-center transition-all duration-1000 transform scale-100"
              style={{ backgroundImage: `url(${activeBanners[activeBannerIdx]})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/50" />
          </div>
        ) : (
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#07132c] via-[#0f2756] to-[#1e3a8a]" />
        )}

        <div className="relative z-10 space-y-4 max-w-xl">
          <div className="inline-block transform hover:scale-105 transition-all">
            <Logo dark />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight drop-shadow-sm flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400 animate-pulse shrink-0" />
              <span>MAMAS Solidarity Network</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-200/90 max-w-md mx-auto leading-relaxed drop-shadow-xs font-medium">
              Official welfare and mutual aid platform for Matuumu Alumni Mutual Aid Association.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="flex-1 w-full max-w-md mx-auto px-4 pb-16 -mt-8 relative z-20">
        <div className="bg-white dark:bg-[#0c1731] rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xl p-6 sm:p-8 space-y-5">
          
          {/* Mode Switch Tabs */}
          {mode !== 'forgot-password' ? (
            <div className="flex p-1 bg-slate-100 dark:bg-slate-900/60 rounded-2xl border border-slate-200/60 dark:border-slate-800">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setSuccess(''); setGooglePromptMessage(null); }}
                className={`flex-1 py-2.5 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); setSuccess(''); setGooglePromptMessage(null); }}
                className={`flex-1 py-2.5 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                  mode === 'register'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Join MAMAS
              </button>
            </div>
          ) : (
            <div className="text-center space-y-1">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Reset / Set Password</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Enter your email address. If you registered with Google, this link allows you to create a direct login password.
              </p>
            </div>
          )}

          {/* Incomplete Registration Warning for Existing Firebase Auth session */}
          {currentUser && !userProfile && !authLoading && mode === 'login' && (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl text-xs text-amber-900 dark:text-amber-200 space-y-2">
              <p className="font-medium">
                Active session detected for <strong>{currentUser.email}</strong> with incomplete member registration details.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => navigate('/register/details', {
                    state: {
                      email: currentUser.email,
                      fullName: currentUser.displayName || '',
                      authProvider: currentUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'email',
                      googleUid: currentUser.uid
                    }
                  })}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  Complete Details
                </button>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Sign Out / Switch User
                </button>
              </div>
            </div>
          )}

          {/* Feedback messages */}
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-start gap-2.5 shadow-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{error}</span>
                {error.includes('already in use') && (
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(''); }}
                    className="block mt-1.5 font-bold text-blue-600 dark:text-blue-400 underline cursor-pointer"
                  >
                    Switch to Sign In
                  </button>
                )}
                {error.includes('No account found') && (
                  <button
                    type="button"
                    onClick={() => { setMode('register'); setError(''); }}
                    className="block mt-1.5 font-bold text-blue-600 dark:text-blue-400 underline cursor-pointer"
                  >
                    Create a new account with this email
                  </button>
                )}
              </div>
            </div>
          )}

          {googlePromptMessage && (
            <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-2xl text-xs font-semibold text-blue-800 dark:text-blue-300 space-y-2">
              <p>{googlePromptMessage}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-all"
                >
                  Continue with Google
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('forgot-password'); setGooglePromptMessage(null); }}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-bold cursor-pointer text-slate-700 dark:text-slate-200"
                >
                  Set Password
                </button>
              </div>
            </div>
          )}

          {success && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl text-xs font-semibold text-emerald-750 dark:text-emerald-300 flex items-start gap-2.5 shadow-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                  Full Name (As in School Records) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="e.g. Mukasa John Bosco"
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl py-2.5 pl-10 pr-4 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                Email Address *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="e.g. member@gmail.com"
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl py-2.5 pl-10 pr-4 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white font-medium"
                />
              </div>
            </div>

            {mode !== 'forgot-password' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Password *
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setMode('forgot-password'); setError(''); setSuccess(''); }}
                      className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl py-2.5 pl-10 pr-10 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <KeyRound className="w-4 h-4" />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl py-2.5 pl-10 pr-4 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-900 dark:text-white"
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
              className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-extrabold uppercase tracking-wider shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>
                    {mode === 'login' ? 'Sign In' : mode === 'register' ? 'Register Account' : 'Send Setup Link'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Social Provider Section */}
          {mode !== 'forgot-password' && (
            <div className="space-y-3.5 pt-1">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100 dark:border-slate-800" />
                </div>
                <span className="relative z-10 px-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-400 bg-white dark:bg-[#0c1731]">
                  Or Connect With
                </span>
              </div>

              <GoogleSignInButton 
                onClick={handleGoogleSignIn} 
                disabled={loading} 
                mode={mode === 'register' ? 'register' : 'login'} 
              />
            </div>
          )}

          {mode === 'forgot-password' && (
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
            >
              Back to Sign In
            </button>
          )}

          {/* Lost Email / Account Recovery Link */}
          {mode === 'login' && (
            <div className="pt-2 text-center border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => setIsLostEmailOpen(true)}
                className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <QuestionIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>Lost access to your email address? Recover Account</span>
              </button>
            </div>
          )}

          {/* Notice Card */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800/60 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 leading-snug font-medium">
              We verify all alumni registrations manually against official Matuumu Secondary School graduation records.
            </div>
          </div>

        </div>

        {/* Public Support Contacts */}
        {(supportPhone || supportWhatsApp || supportEmail) && (
          <div className="mt-5 text-center space-y-2">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Need assistance? Contact support
            </p>
            <div className="flex items-center justify-center gap-3 text-xs">
              {supportPhone && (
                <button
                  type="button"
                  onClick={() => openTel(supportPhone)}
                  className="inline-flex items-center gap-1.5 text-slate-500 hover:text-blue-600 dark:text-slate-400 transition-colors cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Call</span>
                </button>
              )}
              {supportWhatsApp && (
                <button
                  type="button"
                  onClick={() => openWhatsApp(supportWhatsApp, 'Hello MAMAS Support, I need assistance with my account access.')}
                  className="inline-flex items-center gap-1.5 text-slate-500 hover:text-emerald-600 dark:text-slate-400 transition-colors cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              )}
              {supportEmail && (
                <button
                  type="button"
                  onClick={() => openMailto(supportEmail, 'MAMAS Account Assistance Request')}
                  className="inline-flex items-center gap-1.5 text-slate-500 hover:text-rose-600 dark:text-slate-400 transition-colors cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lost Email Modal */}
      <LostEmailModal
        isOpen={isLostEmailOpen}
        onClose={() => setIsLostEmailOpen(false)}
        prefillEmail={email}
      />

      {/* Account Link Modal */}
      <AccountLinkModal
        isOpen={accountLinkState.isOpen}
        onClose={() => setAccountLinkState({ isOpen: false, email: '', credential: null })}
        email={accountLinkState.email}
        pendingCredential={accountLinkState.credential}
        onSuccess={() => {
          setAccountLinkState({ isOpen: false, email: '', credential: null });
        }}
      />

    </div>
  );
}
