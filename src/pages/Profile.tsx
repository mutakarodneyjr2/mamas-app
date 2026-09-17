import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { 
  User, Mail, Phone, MapPin, Briefcase, GraduationCap, 
  Camera, Lock, Bell, LogOut, Trash2, AlertTriangle, Clock, Check, ShieldCheck 
} from 'lucide-react';
import { PrivacyLevel } from '../types';
import { registerFCMToken } from '../lib/fcmService';
import { cancelAccountDeletion } from '../lib/auth';
import { StatusBadge } from '../components/StatusBadge';
import { motion, AnimatePresence } from 'motion/react';

export default function Profile() {
  const { userProfile, currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Privacy fields
  const [privacyPhone, setPrivacyPhone] = useState<PrivacyLevel>('committee_only');
  const [privacyEmail, setPrivacyEmail] = useState<PrivacyLevel>('committee_only');
  const [privacyWhatsapp, setPrivacyWhatsapp] = useState<PrivacyLevel>('committee_only');
  const [privacyLocation, setPrivacyLocation] = useState<PrivacyLevel>('visible_to_verified_members');
  const [privacyProfession, setPrivacyProfession] = useState<PrivacyLevel>('visible_to_verified_members');
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // Push notification state
  const [enablingNotifications, setEnablingNotifications] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [hasTokens, setHasTokens] = useState(false);

  // Account deletion state
  const [cancellingDeletion, setCancellingDeletion] = useState(false);

  const isPendingDeletion = userProfile?.status === 'pending_deletion';

  useEffect(() => {
    if (userProfile) {
      const p = userProfile.privacySettings || {};
      setPrivacyPhone((typeof p.phone === 'string' ? p.phone : p.phone ? 'visible_to_verified_members' : 'committee_only') as PrivacyLevel);
      setPrivacyEmail((typeof p.email === 'string' ? p.email : p.email ? 'visible_to_verified_members' : 'committee_only') as PrivacyLevel);
      setPrivacyWhatsapp((typeof p.whatsapp === 'string' ? p.whatsapp : p.whatsapp ? 'visible_to_verified_members' : 'committee_only') as PrivacyLevel);
      setPrivacyLocation((typeof p.location === 'string' ? p.location : p.location === false ? 'hidden' : 'visible_to_verified_members') as PrivacyLevel);
      setPrivacyProfession((typeof p.profession === 'string' ? p.profession : p.profession === false ? 'hidden' : 'visible_to_verified_members') as PrivacyLevel);

      setHasTokens(Array.isArray(userProfile.fcmTokens) && userProfile.fcmTokens.length > 0);
    }
  }, [userProfile]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const handleEnableNotifications = async () => {
    if (!currentUser?.uid) return;
    setEnablingNotifications(true);
    setErrorMsg('');
    try {
      const token = await registerFCMToken(currentUser.uid);
      if (token) {
        setNotifPermission('granted');
        setHasTokens(true);
        setSuccessMsg('Push notifications enabled for this device.');
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setErrorMsg('Push notification permission was not granted.');
      }
    } catch (err: any) {
      console.error("FCM enable error:", err);
      setErrorMsg('Could not register push notifications.');
    } finally {
      setEnablingNotifications(false);
    }
  };

  const handleSavePrivacy = async () => {
    if (!userProfile?.uid) return;
    setSavingPrivacy(true);
    try {
      const updatedPrivacy = {
        phone: privacyPhone,
        email: privacyEmail,
        whatsapp: privacyWhatsapp,
        location: privacyLocation,
        profession: privacyProfession
      };

      await updateDoc(doc(db, 'users', userProfile.uid), {
        privacySettings: updatedPrivacy,
        updatedAt: Date.now()
      });

      await setDoc(doc(db, 'directoryProfiles', userProfile.uid), {
        privacySettings: updatedPrivacy,
        updatedAt: Date.now()
      }, { merge: true });

      setSuccessMsg('Privacy preferences saved.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save privacy settings.');
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handleCancelDeletion = async () => {
    if (!userProfile?.uid || !currentUser) return;
    setCancellingDeletion(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await cancelAccountDeletion(currentUser.uid);
      setSuccessMsg('Account deletion cancelled. Membership active.');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error('Failed to cancel account deletion:', err);
      setErrorMsg(err.message || 'Failed to cancel deletion request');
    } finally {
      setCancellingDeletion(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  if (!userProfile) return null;

  const isVerified = (userProfile.status || '').toLowerCase() === 'approved';
  const isPending = (userProfile.status || '').toLowerCase() === 'pending';

  return (
    <div className="w-full pb-24 animate-in fade-in duration-300">
      
      {/* 1. NAVY IDENTITY HEADER (FULL WIDTH) */}
      <div className="bg-[#0a142c] text-white py-8 px-4 sm:px-6 md:px-8 border-b border-slate-800 text-center flex flex-col items-center justify-center relative">
        <div className="relative cursor-pointer group mb-4" onClick={() => navigate('/profile/edit')}>
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-slate-800 border-4 border-slate-700 overflow-hidden flex items-center justify-center relative shadow-xl">
            {userProfile.profilePictureUrl ? (
              <img 
                src={userProfile.profilePictureUrl} 
                alt={userProfile.fullName} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <User className="w-12 h-12 text-slate-400" />
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-lg bg-blue-600 border-2 border-[#0a142c] flex items-center justify-center text-white shadow-md group-hover:bg-blue-500 transition-colors">
            <Camera className="w-4 h-4" />
          </div>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-1.5">
          {userProfile.fullName}
        </h2>

        <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
          <StatusBadge status={userProfile.status || 'pending'} />
          <span className="text-xs text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded-md border border-slate-800">
            {userProfile.role?.replace('_', ' ').toUpperCase() || 'MEMBER'}
          </span>
          {userProfile.yearLeftSchool && (
            <span className="text-xs text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded-md border border-slate-800">
              Class of {userProfile.yearLeftSchool}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-2">{userProfile.email}</p>
      </div>

      {/* ALERTS ZONE */}
      <div className="max-w-4xl mx-auto w-full px-4 mt-4 space-y-4">
        {successMsg && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 p-3.5 rounded-xl text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* PENDING DELETION BANNER */}
        {isPendingDeletion && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-amber-500 font-semibold text-xs">
              <Clock className="w-4 h-4 shrink-0" />
              <span>Account Scheduled for Deletion (30-Day Grace Period)</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Your account is scheduled for permanent anonymization on {userProfile?.deletionEffectiveAt ? new Date(userProfile.deletionEffectiveAt).toLocaleDateString() : '30 days from request'}. You can cancel anytime to restore.
            </p>
            <button
              type="button"
              onClick={handleCancelDeletion}
              disabled={cancellingDeletion}
              className="py-1.5 px-3 rounded-lg font-semibold text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {cancellingDeletion ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Restore Account & Access</span>
            </button>
          </div>
        )}
      </div>

      {/* FULL-WIDTH SECTIONS BELOW NAVY HEADER */}
      <div className="max-w-4xl mx-auto w-full mt-4 space-y-6">
        
        {/* 2. MEMBERSHIP STATUS BAND */}
        <div className="bg-white dark:bg-[#0c1731] border-y sm:border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800/80">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Membership Verification
            </h3>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {isVerified ? (
              <p className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
                <Check className="w-4 h-4 shrink-0" />
                <span>Verified Active Alumni. Full directory access, voting privileges, and mutual-aid solidarity support are active.</span>
              </p>
            ) : isPending ? (
              <div className="space-y-1">
                <p className="font-semibold text-amber-600 dark:text-amber-400">Verification Pending Executive Approval</p>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Your credentials are being authenticated by the alumni committee. All mutual aid features will be unlocked once approved.
                </p>
              </div>
            ) : (
              <p className="text-slate-500 dark:text-slate-400">
                Status: <strong className="capitalize">{userProfile.status || 'Active'}</strong>. Contact a system administrator to verify your profile.
              </p>
            )}
          </div>
        </div>

        {/* 3. IDENTITY & CONTACT ROWS (Edge-to-edge list) */}
        <div className="bg-white dark:bg-[#0c1731] border-y sm:border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/10">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Personal Information
            </h3>
            <button
              onClick={() => navigate('/profile/edit')}
              className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-500 cursor-pointer"
            >
              Update
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            <RowItem icon={Mail} label="Email Address" value={userProfile.email} />
            <RowItem icon={Phone} label="Phone Number" value={userProfile.phoneNumber} />
            <RowItem icon={GraduationCap} label="Class Year" value={userProfile.yearLeftSchool ? `Class of ${userProfile.yearLeftSchool}` : undefined} />
            <RowItem icon={Briefcase} label="Occupation" value={userProfile.occupation} />
            <RowItem icon={MapPin} label="District / Residence" value={userProfile.district} />
            <RowItem icon={User} label="Next of Kin" value={userProfile.nextOfKinName ? `${userProfile.nextOfKinName} (${userProfile.nextOfKinPhone || 'No phone'})` : undefined} />
          </div>
        </div>

        {/* 4. PRIVACY SETTINGS ROWS */}
        <div className="bg-white dark:bg-[#0c1731] border-y sm:border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Directory Privacy Preferences
              </h3>
            </div>
            <button
              type="button"
              onClick={handleSavePrivacy}
              disabled={savingPrivacy}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 font-semibold cursor-pointer disabled:opacity-50"
            >
              {savingPrivacy ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
            Manage who is allowed to view your personal information inside the Alumni Directory.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PrivacyRow label="Phone Number" value={privacyPhone} onChange={setPrivacyPhone} />
            <PrivacyRow label="WhatsApp Button" value={privacyWhatsapp} onChange={setPrivacyWhatsapp} />
            <PrivacyRow label="Email Address" value={privacyEmail} onChange={setPrivacyEmail} />
            <PrivacyRow label="Location / District" value={privacyLocation} onChange={setPrivacyLocation} />
            <PrivacyRow label="Occupation" value={privacyProfession} onChange={setPrivacyProfession} />
          </div>
        </div>

        {/* 5. SYSTEM SETTINGS & UTILITIES (Full-width settings rows) */}
        <div className="bg-white dark:bg-[#0c1731] border-y sm:border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden">
          
          {/* Notifications */}
          <div className="p-4 sm:p-5 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white">Push Notifications</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {hasTokens && notifPermission === 'granted' ? 'Active on this device' : 'Receive instant alerts on dues & solidarity notices'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleEnableNotifications}
              disabled={enablingNotifications}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
            >
              {enablingNotifications ? 'Enabling...' : hasTokens && notifPermission === 'granted' ? 'Refresh' : 'Enable'}
            </button>
          </div>

          {/* Sign Out */}
          <div className="p-4 sm:p-5 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0">
                <LogOut className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white">Sign Out</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Securely terminate your session
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              Sign Out
            </button>
          </div>

          {/* Account Deletion (Grace Period) */}
          <div className="p-4 sm:p-5 flex items-center justify-between gap-3 text-xs bg-rose-50/20 dark:bg-rose-950/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-semibold text-rose-700 dark:text-rose-400">Schedule Account Deletion</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Schedules 30-day protected grace period before permanent deletion
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/profile/edit')}
              className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-semibold text-xs text-rose-700 dark:text-rose-400 cursor-pointer"
            >
              Delete...
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

function RowItem({ icon: Icon, label, value }: { icon: any, label: string, value: string | undefined }) {
  return (
    <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        <Icon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
        <span>{label}</span>
      </div>
      <span className="font-medium text-slate-900 dark:text-white text-right truncate max-w-[60%]">
        {value || 'Not provided'}
      </span>
    </div>
  );
}

function PrivacyRow({ label, value, onChange }: { label: string, value: PrivacyLevel, onChange: (val: PrivacyLevel) => void }) {
  return (
    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
      <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold truncate">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PrivacyLevel)}
        className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
      >
        <option value="visible_to_verified_members">Verified Members</option>
        <option value="committee_only">Committee Only</option>
        <option value="hidden">Hidden</option>
      </select>
    </div>
  );
}
