import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getAppSettings } from '../lib/services';
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
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  User,
  School,
  MapPin,
  Check,
  Sparkles,
  Copy
} from 'lucide-react';

export default function PendingApproval() {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [supportPhone, setSupportPhone] = useState<string>('');
  const [supportWhatsApp, setSupportWhatsApp] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Fetch support contacts from settings if available
  useEffect(() => {
    let isMounted = true;
    getAppSettings().then(settings => {
      if (isMounted) {
        if (settings.supportPhone) setSupportPhone(settings.supportPhone);
        if (settings.supportWhatsApp) setSupportWhatsApp(settings.supportWhatsApp);
      }
    }).catch(err => console.error("Error loading app settings:", err));

    return () => { isMounted = false; };
  }, []);

  // Check status automatically every 30 seconds
  const checkStatus = useCallback(async (manual = false) => {
    if (!currentUser) return;
    if (manual) setIsRefreshing(true);

    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const currentStatus = data.status;

        if (currentStatus === 'approved' || currentStatus === 'active') {
          setToastMessage("🎉 Congratulations! Your account has been approved!");
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 2000);
        } else if (manual) {
          setToastMessage("Status checked: Account is still under review.");
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
    // If auth state or profile already shows approved, navigate immediately
    if (userProfile?.status === 'approved') {
      setToastMessage("🎉 Your account is active!");
      const timer = setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1500);
      return () => clearTimeout(timer);
    }

    // Set 30 second polling interval
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

  const isRejected = userProfile?.status === 'rejected';
  const isApproved = userProfile?.status === 'approved';

  // Support links
  const defaultWhatsApp = supportWhatsApp || '256700000000'; // fallback WhatsApp number if non-configured
  const whatsappUrl = `https://wa.me/${defaultWhatsApp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello MAMAS Support, I need assistance with my account review for ${userProfile?.fullName || userProfile?.email || 'my account'}.`)}`;
  const mailtoUrl = `mailto:support@mamas.org?subject=${encodeURIComponent(`Account Verification Inquiry - ${userProfile?.fullName || 'Member'}`)}&body=${encodeURIComponent(`Hello Admin Team,\n\nI registered for MAMAS with the email ${userProfile?.email || ''} and phone number ${userProfile?.phoneNumber || ''}.\n\nPlease assist in reviewing my account verification.\n\nThank you!`)}`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between font-sans selection:bg-mamas-accent selection:text-mamas-primary transition-colors duration-200">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-mamas-primary text-white text-sm font-semibold px-5 py-3.5 rounded-2xl shadow-2xl border border-mamas-accent/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-mamas-accent animate-spin" />
              <span>{toastMessage}</span>
            </div>
            <button 
              onClick={() => setToastMessage(null)}
              className="text-slate-300 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-white/10"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <header className="w-full bg-mamas-primary border-b border-mamas-primary-hover/50 px-4 sm:px-8 py-4 flex items-center justify-between shadow-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Logo />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => checkStatus(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 hover:text-white bg-white/10 hover:bg-white/15 px-3 py-2 rounded-xl transition-all disabled:opacity-50"
            title="Check verification status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-mamas-accent' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs font-semibold text-rose-300 hover:text-rose-100 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-2 rounded-xl border border-rose-500/20 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-10 my-4 sm:my-8">
        <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden transition-all duration-300 animate-in fade-in zoom-in-95">
          
          {/* Top Hero Banner */}
          <div className={`p-8 sm:p-10 text-center relative overflow-hidden ${
            isRejected 
              ? 'bg-gradient-to-br from-rose-900 via-rose-950 to-slate-950 text-white' 
              : 'bg-gradient-to-br from-slate-900 via-mamas-primary to-slate-900 text-white'
          }`}>
            {/* Background Accent Graphics */}
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-mamas-accent/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Top Icon Badge */}
            <div className="relative inline-flex items-center justify-center mb-6">
              {isRejected ? (
                <div className="w-20 h-20 rounded-3xl bg-rose-500/20 border-2 border-rose-500/40 flex items-center justify-center shadow-lg shadow-rose-950/50">
                  <XCircle className="w-10 h-10 text-rose-400" />
                </div>
              ) : isApproved ? (
                <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-950/50 animate-bounce">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute inset-0 rounded-3xl bg-mamas-accent/30 blur-md animate-pulse" />
                  <div className="relative w-20 h-20 rounded-3xl bg-mamas-primary-hover border-2 border-mamas-accent/60 flex items-center justify-center shadow-xl">
                    <Hourglass className="w-10 h-10 text-mamas-accent animate-pulse" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mamas-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-mamas-accent"></span>
                  </span>
                </div>
              )}
            </div>

            {/* Headlines */}
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 text-white">
              {isRejected 
                ? "Account Registration Declined" 
                : isApproved 
                ? "Account Approved!" 
                : "Account Under Review"}
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-md mx-auto leading-relaxed">
              {isRejected 
                ? "Unfortunately, your account registration could not be verified by the admin team at this time." 
                : isApproved 
                ? "Your membership has been verified! Redirecting to your dashboard..." 
                : "Thank you for joining MAMAS! Your account is currently being verified by our admin team."}
            </p>
          </div>

          {/* Body Section */}
          <div className="p-6 sm:p-8 space-y-6">

            {/* 3-Step Progress Tracker (Only for Pending) */}
            {!isRejected && (
              <div className="bg-slate-50 dark:bg-slate-800/60 p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-4 text-center">
                  Verification Progress
                </h3>
                
                <div className="relative flex items-center justify-between max-w-md mx-auto">
                  {/* Connecting Line */}
                  <div className="absolute left-6 right-6 top-5 h-1 bg-slate-200 dark:bg-slate-700 -z-0">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        isApproved ? 'w-full bg-emerald-500' : 'w-1/2 bg-mamas-accent'
                      }`} 
                    />
                  </div>

                  {/* Step 1: Registered */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-2">Registered</span>
                    <span className="text-[10px] text-slate-400">Completed</span>
                  </div>

                  {/* Step 2: Under Review */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md font-bold text-sm transition-all ${
                      isApproved 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-mamas-accent text-mamas-primary ring-4 ring-mamas-accent/30 animate-pulse'
                    }`}>
                      {isApproved ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                    </div>
                    <span className={`text-xs font-bold mt-2 ${isApproved ? 'text-slate-700 dark:text-slate-200' : 'text-mamas-accent dark:text-mamas-accent font-extrabold'}`}>
                      Under Review
                    </span>
                    <span className="text-[10px] text-mamas-accent/90 font-medium">
                      {isApproved ? 'Passed' : 'Active Step'}
                    </span>
                  </div>

                  {/* Step 3: Approved */}
                  <div className="relative z-10 flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md font-bold text-sm transition-all ${
                      isApproved 
                        ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/30' 
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                    }`}>
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <span className={`text-xs font-semibold mt-2 ${isApproved ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
                      Approved
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {isApproved ? 'Unlocked' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Information Notice Box */}
            <div className={`p-4 sm:p-5 rounded-2xl border ${
              isRejected 
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200' 
                : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-900/50 text-slate-800 dark:text-slate-200'
            }`}>
              <div className="flex items-start gap-3">
                {isRejected ? (
                  <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <HelpCircle className="w-5 h-5 text-amber-600 dark:text-mamas-accent shrink-0 mt-0.5" />
                )}
                <div className="space-y-2 text-xs sm:text-sm">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    {isRejected ? "What happens next?" : "What you need to know:"}
                  </h4>
                  {isRejected ? (
                    <ul className="list-disc list-inside space-y-1 text-rose-800 dark:text-rose-300 leading-relaxed">
                      <li>Your registration details did not meet the verification criteria.</li>
                      <li>You can contact the Executive Committee for clarification or resubmission.</li>
                      <li>Reach out via WhatsApp or email using the support links below.</li>
                    </ul>
                  ) : (
                    <ul className="space-y-1.5 text-slate-600 dark:text-slate-300 leading-relaxed">
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span><strong>Verification Timeline:</strong> Usually takes 1–2 business days.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span><strong>Automatic Notification:</strong> You will receive an email as soon as approved.</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span><strong>Urgent Requests:</strong> Contact the Secretary or Super Admin for fast tracking.</span>
                      </li>
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* User Account Details Summary */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Submitted Account Info
                </span>
                <span className="text-[11px] font-semibold text-mamas-primary dark:text-slate-300 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                  Read Only
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Full Name */}
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1.5 text-[11px] mb-1">
                    <User className="w-3.5 h-3.5 text-slate-400" /> Member Name
                  </span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                    {userProfile?.fullName || 'N/A'}
                  </p>
                </div>

                {/* Registered Phone */}
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-400 dark:text-slate-500 flex items-center justify-between text-[11px] mb-1">
                    <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" /> Phone</span>
                    <button 
                      onClick={() => copyToClipboard(userProfile?.phoneNumber || '', 'phone')}
                      className="text-[10px] text-mamas-accent hover:underline flex items-center gap-0.5"
                    >
                      {copiedField === 'phone' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                    {userProfile?.phoneNumber || 'N/A'}
                  </p>
                </div>

                {/* Registered Email */}
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-400 dark:text-slate-500 flex items-center justify-between text-[11px] mb-1">
                    <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-400" /> Email</span>
                    <button 
                      onClick={() => copyToClipboard(userProfile?.email || '', 'email')}
                      className="text-[10px] text-mamas-accent hover:underline flex items-center gap-0.5"
                    >
                      {copiedField === 'email' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                    {userProfile?.email || currentUser?.email || 'N/A'}
                  </p>
                </div>

                {/* School Year / District */}
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1.5 text-[11px] mb-1">
                    <School className="w-3.5 h-3.5 text-slate-400" /> Year Left School
                  </span>
                  <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                    {userProfile?.yearLeftSchool || 'N/A'} {userProfile?.district ? `(${userProfile.district})` : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions Grid */}
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Contact Support via WhatsApp */}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all active:scale-[0.99]"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Contact via WhatsApp</span>
                </a>

                {/* Contact Support via Email */}
                <a
                  href={mailtoUrl}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm border border-slate-200 dark:border-slate-700 transition-all active:scale-[0.99]"
                >
                  <Mail className="w-4 h-4 text-mamas-primary dark:text-mamas-accent" />
                  <span>Email Admin Team</span>
                </a>
              </div>

              {/* Status Action Row */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => checkStatus(true)}
                  disabled={isRefreshing}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-mamas-accent' : ''}`} />
                  <span>{isRefreshing ? 'Checking Firestore...' : 'Re-check Status Now'}</span>
                </button>

                {/* Go to Dashboard button (Disabled until active/approved) */}
                <button
                  onClick={() => isApproved && navigate('/dashboard')}
                  disabled={!isApproved}
                  className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all ${
                    isApproved
                      ? 'bg-mamas-accent text-mamas-primary hover:bg-mamas-accent-hover shadow-lg cursor-pointer'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60'
                  }`}
                  title={isApproved ? 'Go to Dashboard' : 'Dashboard locked until account is approved'}
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>

          {/* Footer note */}
          <div className="px-6 py-4 bg-slate-100/60 dark:bg-slate-900/80 border-t border-slate-200/80 dark:border-slate-800 text-center text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
            <span>MAMAS Member Directory & Welfare</span>
            <span>Auto-refreshing live state</span>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-400 dark:text-slate-600">
        &copy; {new Date().getFullYear()} MAMAS Welfare & Alumni Association. All rights reserved.
      </footer>
    </div>
  );
}
