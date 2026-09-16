import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getAppSettings } from '../lib/services';
import { cancelAccountDeletion } from '../lib/auth';
import { Logo } from '../components/Logo';
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
  Lock 
} from 'lucide-react';

export default function PendingApproval() {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [supportPhone, setSupportPhone] = useState<string>('');
  const [supportWhatsApp, setSupportWhatsApp] = useState<string>('');
  const [supportEmail, setSupportEmail] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [cancellingDeletion, setCancellingDeletion] = useState(false);

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
          setToastMessage("Status checked: Account is under review.");
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
            {isPendingDeletion
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
            {isPendingDeletion
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
