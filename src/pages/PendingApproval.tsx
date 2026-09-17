import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getAppSettings } from '../lib/services';
import { cancelAccountDeletion, reapplyForMembership } from '../lib/auth';
import { Logo } from '../components/Logo';
import { getActiveBanners } from '../lib/bannerService';
import { 
  Clock, 
  Hourglass, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  LogOut, 
  MessageSquare, 
  Mail, 
  Phone, 
  ShieldAlert, 
  HelpCircle, 
  User, 
  School, 
  Sparkles, 
  Copy, 
  Check, 
  AlertTriangle, 
  Undo2, 
  Lock,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play
} from 'lucide-react';

export default function PendingApproval() {
  const { currentUser, userProfile, logout, reloadProfile } = useAuth();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [supportPhone, setSupportPhone] = useState<string>('');
  const [supportWhatsApp, setSupportWhatsApp] = useState<string>('');
  const [supportEmail, setSupportEmail] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [cancellingDeletion, setCancellingDeletion] = useState(false);

  const [activeBanners, setActiveBanners] = useState<string[]>([]);
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);
  const [isAutoplay, setIsAutoplay] = useState(true);

  // Re-apply state
  const [reapplying, setReapplying] = useState(false);
  const [reapplyData, setReapplyData] = useState({
    fullName: userProfile?.fullName || '',
    phoneNumber: userProfile?.phoneNumber || '',
    yearOfCompletion: userProfile?.yearLeftSchool || ''
  });

  const handleReapply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setReapplying(true);
    try {
      await reapplyForMembership(reapplyData);
      setToastMessage("Your re-application has been submitted!");
      if (reloadProfile) await reloadProfile();
    } catch (err: any) {
      setToastMessage("Failed to re-apply: " + (err.message || 'Unknown error'));
    } finally {
      setReapplying(false);
    }
  };

  // Fetch active banners for slider
  useEffect(() => {
    let isMounted = true;
    getActiveBanners().then(banners => {
      if (isMounted) {
        const urls = banners.map(b => b.url).filter(Boolean);
        if (urls.length > 0) {
          setActiveBanners(urls);
        }
      }
    }).catch(err => console.error("Error loading banners for Pending screen:", err));

    return () => { isMounted = false; };
  }, []);

  // Slide interval
  useEffect(() => {
    if (activeBanners.length <= 1 || !isAutoplay) return;
    const interval = setInterval(() => {
      setActiveBannerIdx(prev => (prev + 1) % activeBanners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [activeBanners, isAutoplay]);

  // Fetch support contacts from settings
  useEffect(() => {
    let isMounted = true;
    getAppSettings().then(settings => {
      if (isMounted) {
        if (settings.supportPhone) setSupportPhone(settings.supportPhone);
        if (settings.supportWhatsApp) setSupportWhatsApp(settings.supportWhatsApp);
        if (settings.supportEmail) setSupportEmail(settings.supportEmail);
      }
    }).catch(err => console.error("Error loading app settings:", err));

    return () => { isMounted = false; };
  }, []);

  // Check status automatically
  const checkStatus = useCallback(async (manual = false) => {
    if (!currentUser) return;
    if (manual) setIsRefreshing(true);

    try {
      await currentUser.reload();
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const currentStatus = data.status;

        if (currentStatus === 'approved' || currentStatus === 'active') {
          setToastMessage("🎉 Account approved! Redirecting to dashboard...");
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 1500);
        } else if (manual) {
          if (!currentUser.emailVerified && data.authProvider === 'email') {
            setToastMessage("Email is not verified yet.");
          } else {
            setToastMessage("Status checked: Account is under review.");
          }
          setTimeout(() => setToastMessage(null), 3000);
        }
      }
    } catch (error) {
      console.error("Error refreshing status:", error);
      if (manual) {
        setToastMessage("Could not refresh status. Please try again.");
        setTimeout(() => setToastMessage(null), 3000);
      }
    } finally {
      if (manual) setIsRefreshing(false);
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    if (userProfile?.status === 'approved') {
      setToastMessage("🎉 Your account is active!");
      const timer = setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1500);
      return () => clearTimeout(timer);
    }

    const interval = setInterval(() => {
      checkStatus(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [userProfile, checkStatus, navigate]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const isPendingDeletion = userProfile?.status === 'pending_deletion';
  const isSuspended = userProfile?.status === 'suspended';
  const isDeleted = userProfile?.status === 'deleted';
  const isRejected = userProfile?.status === 'rejected';
  const isApproved = userProfile?.status === 'approved';
  
  // Email verification check
  const isUnverifiedEmail = Boolean(currentUser && !currentUser.emailVerified && userProfile?.authProvider === 'email');

  const effectiveDate = userProfile?.deletionEffectiveAt 
    ? new Date(userProfile.deletionEffectiveAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : 'in 30 days';

  const handleCancelDeletion = async () => {
    if (!currentUser) return;
    setCancellingDeletion(true);
    try {
      await cancelAccountDeletion(currentUser.uid);
      setToastMessage("Account deletion cancelled! Restoring access...");
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (err: any) {
      setToastMessage("Failed to cancel deletion: " + (err.message || 'Unknown error'));
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setCancellingDeletion(false);
    }
  };

  const defaultWhatsApp = supportWhatsApp || '256700000000';
  const whatsappUrl = `https://wa.me/${defaultWhatsApp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello MAMAS Support, I need assistance with my account review for ${userProfile?.fullName || userProfile?.email || 'my account'}.`)}`;
  const mailtoUrl = `mailto:${supportEmail || 'support@mamas.org'}?subject=${encodeURIComponent(`Account Verification Inquiry - ${userProfile?.fullName || 'Member'}`)}&body=${encodeURIComponent(`Hello Admin Team,\n\nI registered for MAMAS with the email ${userProfile?.email || ''}.\n\nPlease assist in reviewing my account verification.\n\nThank you!`)}`;

  return (
    <div className="min-h-screen bg-mamas-bg flex flex-col justify-between font-sans transition-colors duration-200">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-blue-600 text-white text-xs sm:text-sm font-semibold px-4 py-3 rounded-2xl shadow-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
              <span>{toastMessage}</span>
            </div>
            <button 
              onClick={() => setToastMessage(null)}
              className="text-white/80 hover:text-white text-xs px-2 py-0.5 rounded-lg hover:bg-white/10"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Vibrant Light Blue Top Header Bar */}
      <header className="w-full bg-blue-600 dark:bg-blue-700 text-white border-b border-blue-500/40 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Logo dark />
        </div>
        <div className="flex items-center gap-2">
          {!isDeleted && !isSuspended && !isPendingDeletion && (
            <button
              onClick={() => checkStatus(true)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 text-xs font-bold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full border border-white/20 transition-all disabled:opacity-50 cursor-pointer"
              title="Check verification status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'Checking...' : 'Refresh Status'}</span>
            </button>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-rose-500/80 hover:bg-rose-500 px-3 py-1.5 rounded-full transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area (Compact, Edge-to-Edge, Zero Card Boundaries) */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6 text-slate-900 dark:text-slate-100">
        
        {/* Status Title & Badge */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-100 dark:border-blue-900/60 shadow-xs mb-1">
            {isPendingDeletion ? (
              <Clock className="w-8 h-8 text-amber-500" />
            ) : isSuspended || isDeleted || isRejected ? (
              <Lock className="w-8 h-8 text-rose-500" />
            ) : isApproved ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            ) : (
              <Hourglass className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-pulse" />
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {isUnverifiedEmail
              ? "Verify Your Email Address"
              : isPendingDeletion
              ? "Account Scheduled for Deletion"
              : isSuspended
              ? "Account Suspended"
              : isDeleted
              ? "Account Deleted"
              : isRejected 
              ? "Account Registration Declined" 
              : isApproved 
              ? "Account Approved!" 
              : "Account Under Review"}
          </h1>

          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            {isUnverifiedEmail
              ? `We have sent a verification link to ${currentUser?.email}. Please check your inbox and click the link to verify your email address.`
              : isPendingDeletion
              ? `Your account is scheduled for deletion on ${effectiveDate}. You may cancel anytime during this grace period.`
              : isSuspended
              ? (userProfile?.suspendReason ? `Reason: ${userProfile.suspendReason}` : "Your account access has been suspended.")
              : isDeleted
              ? "This account has been closed."
              : isRejected 
              ? "Your registration could not be verified by the admin team." 
              : isApproved 
              ? "Your membership has been verified! Redirecting..." 
              : "Thank you for joining MAMAS! Your account is currently being verified by our admin team (usually 1–2 business days)."}
          </p>
        </div>

        {/* Unverified Email Resend Banner */}
        {isUnverifiedEmail && (
          <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-2xl border border-amber-200 dark:border-amber-800/60 space-y-3">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-xs sm:text-sm">
              <Mail className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Did not receive the email?</span>
            </div>
            <button
              onClick={async () => {
                if (!currentUser) return;
                try {
                  const { sendEmailVerification } = await import('firebase/auth');
                  await sendEmailVerification(currentUser);
                  setToastMessage("Verification email resent! Check your inbox.");
                } catch (err: any) {
                  setToastMessage("Failed to resend: " + (err.message || 'Unknown error'));
                }
              }}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Resend Verification Email</span>
            </button>
          </div>
        )}

        {/* Pending Deletion Cancel Banner */}
        {isPendingDeletion && (
          <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-2xl border border-amber-200 dark:border-amber-800/60 space-y-3">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-xs sm:text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Cancel account deletion request</span>
            </div>
            <button
              onClick={handleCancelDeletion}
              disabled={cancellingDeletion}
              className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {cancellingDeletion ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
              <span>Restore Account & Full Access</span>
            </button>
          </div>
        )}

        {/* Rejected Re-apply Banner */}
        {isRejected && (
          <div className="bg-rose-50 dark:bg-rose-950/30 p-5 rounded-3xl border border-rose-200 dark:border-rose-900/60 space-y-4 shadow-sm">
            <div className="flex items-start gap-3 text-rose-900 dark:text-rose-200 font-bold text-sm">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p>Registration Declined</p>
                {userProfile?.rejectionReason && (
                  <p className="text-xs font-normal mt-1 opacity-90">Reason: {userProfile.rejectionReason}</p>
                )}
              </div>
            </div>
            
            <p className="text-xs text-rose-700 dark:text-rose-300">
              You can update your details and re-apply for membership. Your application will be reviewed again by the admin team.
            </p>
            
            <form onSubmit={handleReapply} className="space-y-3 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={reapplyData.fullName}
                    onChange={(e) => setReapplyData({ ...reapplyData, fullName: e.target.value })}
                    required
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={reapplyData.phoneNumber}
                    onChange={(e) => setReapplyData({ ...reapplyData, phoneNumber: e.target.value })}
                    required
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Year of Completion</label>
                  <input
                    type="text"
                    value={reapplyData.yearOfCompletion}
                    onChange={(e) => setReapplyData({ ...reapplyData, yearOfCompletion: e.target.value })}
                    required
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>
              </div>
              
              <button
                type="submit"
                disabled={reapplying}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2 shadow-md"
              >
                {reapplying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span>Update Details & Re-apply</span>
              </button>
            </form>
          </div>
        )}

        {/* Sleek 3-Step Progress Tracker */}
        {!isRejected && !isPendingDeletion && !isSuspended && !isDeleted && (
          <div className="bg-white dark:bg-[#0c1731] py-4 px-4 sm:px-6 border-y border-slate-200/60 dark:border-slate-800/60">
            <div className="flex items-center justify-between max-w-sm mx-auto relative">
              <div className="absolute left-6 right-6 top-4 h-0.5 bg-slate-200 dark:bg-slate-700 -z-0">
                <div className={`h-full transition-all ${isApproved ? 'w-full bg-emerald-500' : 'w-1/2 bg-blue-600'}`} />
              </div>

              {/* Step 1 */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">
                  <Check className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mt-1.5">Registered</span>
              </div>

              {/* Step 2 */}
              <div className="relative z-10 flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                  isApproved ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white ring-4 ring-blue-500/20 animate-pulse'
                }`}>
                  {isApproved ? <Check className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                </div>
                <span className="text-[11px] font-extrabold text-blue-600 dark:text-blue-400 mt-1.5">Under Review</span>
              </div>

              {/* Step 3 */}
              <div className="relative z-10 flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                  isApproved ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                }`}>
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className={`text-[11px] font-semibold mt-1.5 ${isApproved ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>Approved</span>
              </div>
            </div>
          </div>
        )}

        {/* Active Banners Slider Carousel */}
        {activeBanners.length > 0 && (
          <div className="bg-white dark:bg-[#0c1731] rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">MAMAS Highlights</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">See what is new in our community while we review your account.</p>
              </div>
            </div>

            <div className="relative aspect-video max-h-56 w-full bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-200/60 dark:border-slate-800/60 group">
              <img 
                src={activeBanners[activeBannerIdx]} 
                alt="Active MAMAS Banner" 
                className="h-full w-full object-contain transition-all duration-700 ease-in-out"
              />
              
              {activeBanners.length > 1 && (
                <>
                  <button
                    onClick={() => {
                      setIsAutoplay(false);
                      setActiveBannerIdx(prev => (prev - 1 + activeBanners.length) % activeBanners.length);
                    }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 hover:bg-blue-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setIsAutoplay(false);
                      setActiveBannerIdx(prev => (prev + 1) % activeBanners.length);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 hover:bg-blue-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1 z-10 bg-black/35 px-2 py-0.5 rounded-full animate-in fade-in">
                    {activeBanners.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setIsAutoplay(false);
                          setActiveBannerIdx(idx);
                        }}
                        className={`h-1 rounded-full transition-all cursor-pointer ${
                          idx === activeBannerIdx ? 'w-3.5 bg-blue-500' : 'w-1 bg-white/40'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Submitted Account Info Grid */}
        <div className="border-t border-b border-slate-200/60 dark:border-slate-800/60 py-4 space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Submitted Account Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 bg-white dark:bg-[#0c1731] border border-slate-200/60 dark:border-slate-800 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Member Name</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{userProfile?.fullName || 'N/A'}</span>
              </div>
              <User className="w-4 h-4 text-slate-400 shrink-0" />
            </div>

            <div className="p-3 bg-white dark:bg-[#0c1731] border border-slate-200/60 dark:border-slate-800 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Phone Number</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{userProfile?.phoneNumber || 'N/A'}</span>
              </div>
              <button onClick={() => copyToClipboard(userProfile?.phoneNumber || '', 'phone')} className="text-slate-400 hover:text-blue-500">
                {copiedField === 'phone' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="p-3 bg-white dark:bg-[#0c1731] border border-slate-200/60 dark:border-slate-800 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Email</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{userProfile?.email || currentUser?.email || 'N/A'}</span>
              </div>
              <button onClick={() => copyToClipboard(userProfile?.email || '', 'email')} className="text-slate-400 hover:text-blue-500">
                {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="p-3 bg-white dark:bg-[#0c1731] border border-slate-200/60 dark:border-slate-800 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Class Year</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                  {userProfile?.yearLeftSchool ? `Class of ${userProfile.yearLeftSchool}` : 'N/A'} {userProfile?.district ? `(${userProfile.district})` : ''}
                </span>
              </div>
              <School className="w-4 h-4 text-slate-400 shrink-0" />
            </div>
          </div>
        </div>

        {/* Quick Unlocked Action Links */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={() => navigate('/campaigns')}
            className="flex-1 py-3 px-4 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs rounded-2xl border border-blue-200/60 dark:border-blue-900/50 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <School className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Support School Campaigns</span>
          </button>

          <button
            onClick={() => navigate('/profile')}
            className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <User className="w-4 h-4 text-slate-500" />
            <span>Edit Profile & Privacy</span>
          </button>
        </div>

        {/* Contact Support Action Row */}
        <div className="pt-2 text-center space-y-2.5">
          <span className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
            Need Fast-Track Verification?
          </span>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {supportPhone && (
              <a
                href={`tel:${supportPhone}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-all active:scale-95 cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5 text-blue-600" />
                <span>Call Admin</span>
              </a>
            )}

            {supportWhatsApp && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp Admin</span>
              </a>
            )}

            {supportEmail && (
              <a
                href={mailtoUrl}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-all active:scale-95 cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5 text-blue-600" />
                <span>Email Support</span>
              </a>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
