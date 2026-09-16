import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Camera, Mail, MapPin, Briefcase, Phone, User, Shield, ChevronRight, LogOut, SunMoon, Sparkles, Check, Edit3, X, Save, Bell, BellRing, GraduationCap, Eye, EyeOff, Lock, AlertTriangle, Trash2, ShieldAlert, Clock
} from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { registerFCMToken } from '../lib/fcmService';
import { uploadImage } from '../lib/storage';
import { scheduleAccountDeletion, cancelAccountDeletion } from '../lib/auth';
import { PrivacyLevel } from '../types';

export default function Profile() {
  const { currentUser, userProfile, isPendingDeletion, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Account Deletion State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [cancellingDeletion, setCancellingDeletion] = useState(false);
  const [deletionError, setDeletionError] = useState('');
  
  // Initialize with new structure or fallback to legacy booleans
  const getInitialPrivacy = (field: keyof typeof userProfile.privacySettings, defaultVal: PrivacyLevel): PrivacyLevel => {
    if (!userProfile?.privacySettings) return defaultVal;
    
    // Check new structured settings
    if (typeof userProfile.privacySettings[field] === 'string') {
      return userProfile.privacySettings[field] as PrivacyLevel;
    }
    
    // Fallback for legacy boolean data
    if (field === 'phone' && 'showPhone' in userProfile.privacySettings) {
      return userProfile.privacySettings.showPhone ? 'visible_to_verified_members' : 'committee_only';
    }
    if (field === 'email' && 'showEmail' in userProfile.privacySettings) {
      return userProfile.privacySettings.showEmail ? 'visible_to_verified_members' : 'hidden';
    }
    
    return defaultVal;
  };

  const [privacyPhone, setPrivacyPhone] = useState<PrivacyLevel>(getInitialPrivacy('phone', 'committee_only'));
  const [privacyEmail, setPrivacyEmail] = useState<PrivacyLevel>(getInitialPrivacy('email', 'visible_to_verified_members'));
  const [privacyWhatsapp, setPrivacyWhatsapp] = useState<PrivacyLevel>(getInitialPrivacy('whatsapp', 'committee_only'));
  const [privacyLocation, setPrivacyLocation] = useState<PrivacyLevel>(getInitialPrivacy('location', 'visible_to_verified_members'));
  const [privacyProfession, setPrivacyProfession] = useState<PrivacyLevel>(getInitialPrivacy('profession', 'visible_to_verified_members'));

  const [isEditing, setIsEditing] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(userProfile?.phoneNumber || '');
  const [occupation, setOccupation] = useState(userProfile?.occupation || '');
  const [district, setDistrict] = useState(userProfile?.district || '');
  const [yearLeftSchool, setYearLeftSchool] = useState(userProfile?.yearLeftSchool || '');
  const [nextOfKinName, setNextOfKinName] = useState(userProfile?.nextOfKinName || '');
  const [nextOfKinPhone, setNextOfKinPhone] = useState(userProfile?.nextOfKinPhone || '');
  
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfile?.uid) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    setUploadingPhoto(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const path = `profile_pictures/${userProfile.uid}_${Date.now()}.jpg`;
      const photoUrl = await uploadImage(file, path, { timeoutMs: 10000, allowDataUrlFallback: true });

      await updateDoc(doc(db, 'users', userProfile.uid), {
        profilePictureUrl: photoUrl,
        updatedAt: Date.now()
      });

      setSuccessMsg('Profile picture updated successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Failed to update profile picture:', err);
      setErrorMsg('Failed to update profile picture: ' + (err.message || 'Unknown error'));
    } finally {
      setUploadingPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  const [enablingNotifications, setEnablingNotifications] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const hasTokens = Array.isArray(userProfile?.fcmTokens) && userProfile.fcmTokens.length > 0;

  const handleEnableNotifications = async () => {
    if (!userProfile?.uid) return;
    setEnablingNotifications(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const token = await registerFCMToken(userProfile.uid);
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setNotifPermission(Notification.permission);
      }
      if (token) {
        setSuccessMsg('Push notifications enabled successfully for this device!');
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'denied') {
          setErrorMsg('Notification permission was blocked in your browser settings. Please allow notifications for this site to receive alerts.');
        } else {
          setErrorMsg('Could not register push notifications. Please verify browser notification support.');
        }
        setTimeout(() => setErrorMsg(''), 6000);
      }
    } catch (err: any) {
      console.error('Push notification registration error:', err);
      setErrorMsg('Failed to enable push notifications: ' + (err.message || 'Unknown error'));
      setTimeout(() => setErrorMsg(''), 6000);
    } finally {
      setEnablingNotifications(false);
    }
  };

  const handleScheduleDeletion = async () => {
    if (!userProfile?.uid || !currentUser) return;
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      setDeletionError('Please type "DELETE" exactly to confirm account deletion.');
      return;
    }

    setDeletingAccount(true);
    setDeletionError('');

    try {
      await scheduleAccountDeletion(userProfile.uid, deleteReason.trim(), currentUser);
      setShowDeleteModal(false);
      setSuccessMsg('Account scheduled for deletion. You have a 30-day grace period to cancel anytime.');
    } catch (err: any) {
      console.error('Failed to schedule account deletion:', err);
      setDeletionError(err.message || 'Failed to schedule account deletion');
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleCancelDeletion = async () => {
    if (!userProfile?.uid || !currentUser) return;
    setCancellingDeletion(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await cancelAccountDeletion(userProfile.uid, currentUser);
      setSuccessMsg('Your account deletion request has been cancelled. Your membership is fully active.');
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err: any) {
      console.error('Failed to cancel account deletion:', err);
      setErrorMsg(err.message || 'Failed to cancel deletion request');
      setTimeout(() => setErrorMsg(''), 6000);
    } finally {
      setCancellingDeletion(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.uid) return;
    
    setLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      await updateDoc(doc(db, 'users', userProfile.uid), {
        phoneNumber,
        occupation,
        district,
        yearLeftSchool,
        nextOfKinName,
        nextOfKinPhone,
        privacySettings: {
          phone: privacyPhone,
          email: privacyEmail,
          whatsapp: privacyWhatsapp,
          location: privacyLocation,
          profession: privacyProfession
        }
      });

      // Sync safe directory projection (CRIT-01)
      await setDoc(doc(db, 'directoryProfiles', userProfile.uid), {
        uid: userProfile.uid,
        fullName: userProfile.fullName,
        yearLeftSchool: Number(yearLeftSchool) || userProfile.yearLeftSchool || null,
        district: district || '',
        occupation: occupation || '',
        university: userProfile.university || '',
        profilePictureUrl: userProfile.profilePictureUrl || '',
        status: userProfile.status || 'approved',
        role: userProfile.role || 'member',
        privacySettings: {
          phone: privacyPhone,
          email: privacyEmail,
          whatsapp: privacyWhatsapp,
          location: privacyLocation,
          profession: privacyProfession
        },
        updatedAt: Date.now()
      }, { merge: true });

      setSuccessMsg('Profile and privacy settings updated successfully!');
      setIsEditing(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error("Error saving profile", err);
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  if (!userProfile) return null;

  return (
    <div className="max-w-2xl mx-auto w-full animate-in fade-in duration-300 pb-12">
      
      {/* SUCCESS / ERROR ALERT */}
      {successMsg && (
        <div className="mb-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 p-4 rounded-2xl text-sm font-bold flex items-center justify-between">
          <span className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> {successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 p-4 rounded-2xl text-sm font-bold">
          {errorMsg}
        </div>
      )}

      {/* HERO / BLUE BANNER PROFILE HEADER */}
      <div className="bg-gradient-to-r from-[#07132c] via-[#0f2756] to-[#1e3a8a] rounded-3xl overflow-hidden shadow-xl border border-blue-900/40 mb-8 text-white relative">
        <div className="h-28 bg-blue-500/10 border-b border-white/10 relative">
          <div className="absolute top-4 right-4 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-blue-200 border border-white/15">
            {userProfile?.role?.replace('_', ' ') || 'Alumni Member'}
          </div>
        </div>
        
        <div className="px-6 pb-6 pt-0 flex flex-col items-center text-center -mt-14 relative z-10">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <div className="relative mb-3">
            <div className="w-24 h-24 rounded-2xl bg-blue-950 border-4 border-white dark:border-[#0c1731] shadow-2xl overflow-hidden flex items-center justify-center relative">
              {userProfile.profilePictureUrl ? (
                <img src={userProfile.profilePictureUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-blue-300" />
              )}
              {uploadingPhoto && (
                <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-blue-600 border-2 border-white dark:border-[#0c1731] flex items-center justify-center text-white shadow-md hover:bg-blue-500 hover:scale-105 transition-all disabled:opacity-50 cursor-pointer"
              title="Change profile picture"
            >
              {uploadingPhoto ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </button>
          </div>
          
          <h1 className="text-2xl font-extrabold tracking-tight text-white">{userProfile.fullName}</h1>
          <p className="text-blue-100/80 text-xs font-medium mt-1">{userProfile.email}</p>
          <p className="text-blue-300 text-xs font-bold mt-1">{userProfile.phoneNumber}</p>
        </div>
      </div>

      {isEditing ? (
        /* EDIT PROFILE FORM */
        <form onSubmit={handleSaveProfile} className="space-y-6 bg-white dark:bg-[#0c1731] p-6 rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Edit Member Details
            </h2>
            <button 
              type="button" 
              onClick={() => setIsEditing(false)}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Phone Number</label>
              <input
                type="text"
                required
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Occupation</label>
              <input
                type="text"
                value={occupation}
                onChange={e => setOccupation(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Year Left School</label>
              <input
                type="text"
                value={yearLeftSchool}
                onChange={e => setYearLeftSchool(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">District / Residence</label>
              <input
                type="text"
                value={district}
                onChange={e => setDistrict(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Next of Kin Name</label>
              <input
                type="text"
                value={nextOfKinName}
                onChange={e => setNextOfKinName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Next of Kin Phone</label>
              <input
                type="text"
                value={nextOfKinPhone}
                onChange={e => setNextOfKinPhone(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Directory Privacy Settings</h3>
              
              <div className="space-y-4">
                <PrivacySelect label="Phone Number" value={privacyPhone} onChange={setPrivacyPhone} />
                <PrivacySelect label="WhatsApp Button" value={privacyWhatsapp} onChange={setPrivacyWhatsapp} />
                <PrivacySelect label="Email Address" value={privacyEmail} onChange={setPrivacyEmail} />
                <PrivacySelect label="Location / District" value={privacyLocation} onChange={setPrivacyLocation} />
                <PrivacySelect label="Profession / Occupation" value={privacyProfession} onChange={setPrivacyProfession} />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-2xl text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl text-sm shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" /> {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      ) : (
        /* READ ONLY VIEW */
        <div className="space-y-6">
          
          {/* PERSONAL DETAILS CARD */}
          <section className="bg-white dark:bg-[#0c1731] rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Personal Details</h2>
              <button 
                onClick={() => setIsEditing(true)}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-500 flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <InfoRow icon={Mail} label="Email" value={userProfile.email} />
              <InfoRow icon={Briefcase} label="Occupation" value={userProfile.occupation} />
              {userProfile.occupation === 'Student' && (
                <InfoRow icon={GraduationCap} label="University" value={userProfile.university || 'Not provided'} />
              )}
              <InfoRow icon={Shield} label="Year Left School" value={userProfile.yearLeftSchool?.toString()} />
              <InfoRow icon={MapPin} label="District" value={userProfile.district} />
            </div>
          </section>

          {/* NEXT OF KIN CARD */}
          <section className="bg-white dark:bg-[#0c1731] rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Next of Kin</h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <InfoRow icon={User} label="Name" value={userProfile.nextOfKinName} />
              <InfoRow icon={Phone} label="Phone" value={userProfile.nextOfKinPhone} />
            </div>
          </section>

          {/* PRIVACY SETTINGS VIEW */}
          <section className="bg-white dark:bg-[#0c1731] rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Lock className="w-4 h-4" /> Directory Privacy
              </h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <PrivacyDisplayRow label="Phone Number" value={privacyPhone} />
              <PrivacyDisplayRow label="WhatsApp Button" value={privacyWhatsapp} />
              <PrivacyDisplayRow label="Email Address" value={privacyEmail} />
              <PrivacyDisplayRow label="Location / District" value={privacyLocation} />
              <PrivacyDisplayRow label="Profession / Occupation" value={privacyProfession} />
            </div>
          </section>

          {/* PUSH NOTIFICATIONS */}
          <section className="bg-white dark:bg-[#0c1731] rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Push Notifications
              </h2>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                hasTokens && notifPermission === 'granted'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                  : notifPermission === 'denied'
                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                  : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
              }`}>
                {hasTokens && notifPermission === 'granted' ? 'Enabled' : notifPermission === 'denied' ? 'Blocked' : 'Not Setup'}
              </span>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                Receive real-time push alerts for member approvals, welfare request updates, contribution verifications, and urgent announcements on this device.
              </p>

              <button
                type="button"
                onClick={handleEnableNotifications}
                disabled={enablingNotifications}
                className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                  hasTokens && notifPermission === 'granted'
                    ? 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800'
                    : 'bg-blue-600 hover:bg-blue-500 text-white border-transparent shadow-md shadow-blue-500/25 active:scale-[0.98]'
                }`}
              >
                {enablingNotifications ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <BellRing className="w-4 h-4" />
                )}
                {hasTokens && notifPermission === 'granted'
                  ? 'Refresh Push Token'
                  : 'Enable Push Notifications'}
              </button>
            </div>
          </section>

          {/* ACCOUNT ACTIONS */}
          <section className="pt-4 pb-4 space-y-4">
            <button 
              onClick={() => setIsEditing(true)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-2xl py-4 font-bold shadow-md shadow-blue-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Edit3 className="w-5 h-5 text-blue-200" /> Edit Profile Details
            </button>
            <button 
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-bold py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-2xl transition-colors text-sm cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
          </section>

          {/* DANGER ZONE - ACCOUNT DELETION */}
          <section className="bg-rose-50/50 dark:bg-rose-950/20 rounded-3xl border border-rose-200/80 dark:border-rose-900/60 p-6 space-y-4 mb-8">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-rose-900 dark:text-rose-200">Account Management & Deletion</h3>
            </div>

            {isPendingDeletion ? (
              <div className="space-y-3">
                <div className="bg-amber-100/80 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 rounded-2xl p-4 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
                    <Clock className="w-4 h-4" />
                    <span>Your account is currently scheduled for deletion</span>
                  </div>
                  <p className="text-amber-700 dark:text-amber-400 leading-relaxed">
                    You have a 30-day grace period ending on {userProfile?.deletionEffectiveAt ? new Date(userProfile.deletionEffectiveAt).toLocaleDateString() : '30 days from request'}. 
                    You can cancel this deletion request anytime before this date to immediately restore full access.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCancelDeletion}
                  disabled={cancellingDeletion}
                  className="w-full py-3.5 px-4 rounded-2xl font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {cancellingDeletion ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Cancel Deletion Request & Keep Account
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-rose-700 dark:text-rose-400 leading-relaxed">
                  Requesting deletion initiates a 30-day grace period during which you can cancel anytime. Once finalized, your personal profile is scrubbed and login is blocked, while verified ledger records remain preserved for association financial integrity.
                </p>
                <button
                  type="button"
                  onClick={() => { setShowDeleteModal(true); setDeleteConfirmText(''); setDeleteReason(''); setDeletionError(''); }}
                  className="w-full py-3.5 px-4 rounded-2xl font-bold text-xs sm:text-sm bg-rose-600 hover:bg-rose-700 text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete My Account (30-Day Grace Period)
                </button>
              </div>
            )}
          </section>

        </div>
      )}

      {/* ACCOUNT DELETION CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0c1731] border border-rose-200 dark:border-rose-900/60 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-100 dark:bg-rose-950/80 rounded-xl text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">Delete Account</h3>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-xs sm:text-sm">
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-4 space-y-2 text-rose-900 dark:text-rose-200">
                <p className="font-bold flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  30-Day Grace Period Protection
                </p>
                <ul className="list-disc pl-4 space-y-1 text-rose-800 dark:text-rose-300 text-[11px] sm:text-xs">
                  <li>Your deletion is scheduled for 30 days from today.</li>
                  <li>You can log in and cancel this deletion at any time during the 30 days.</li>
                  <li>After 30 days, your personal profile will be anonymized and login deactivated.</li>
                  <li>Verified association financial history is preserved for regulatory integrity.</li>
                </ul>
              </div>

              {deletionError && (
                <div className="p-3 bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-semibold">
                  {deletionError}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Reason for leaving (Optional)
                </label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-xs outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white h-20 resize-none font-medium placeholder:text-slate-400"
                  placeholder="Help us improve: why are you requesting account deletion?"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                  Type <span className="text-rose-600 dark:text-rose-400 font-mono font-black">DELETE</span> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs font-mono font-bold outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-3 rounded-2xl font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleScheduleDeletion}
                disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE' || deletingAccount}
                className="flex-1 px-4 py-3 rounded-2xl font-bold text-xs sm:text-sm text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                {deletingAccount ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : null}
                Schedule Deletion
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any, label: string, value: string | undefined }) {
  return (
    <div className="px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-blue-500 dark:text-blue-400" />
        <span className="text-slate-900 dark:text-white font-medium text-sm">{label}</span>
      </div>
      <span className="text-slate-500 dark:text-slate-400 text-sm font-medium text-right max-w-[50%] truncate">{value || 'Not provided'}</span>
    </div>
  );
}

function PrivacySelect({ label, value, onChange }: { label: string, value: PrivacyLevel, onChange: (val: PrivacyLevel) => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/60">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PrivacyLevel)}
        className="w-full sm:w-auto px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
      >
        <option value="visible_to_verified_members">Visible to Verified Members</option>
        <option value="committee_only">Visible to Committee Only</option>
        <option value="hidden">Hidden completely</option>
      </select>
    </div>
  );
}

function PrivacyDisplayRow({ label, value }: { label: string, value: PrivacyLevel }) {
  const getDisplay = (val: PrivacyLevel) => {
    switch (val) {
      case 'visible_to_verified_members':
        return { text: 'Visible to Members', icon: Eye, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40' };
      case 'committee_only':
        return { text: 'Committee Only', icon: Shield, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40' };
      case 'hidden':
        return { text: 'Hidden', icon: EyeOff, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' };
      default:
        return { text: 'Visible to Members', icon: Eye, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40' };
    }
  };

  const display = getDisplay(value);
  const Icon = display.icon;

  return (
    <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <span className="text-slate-900 dark:text-white font-medium text-sm">{label}</span>
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${display.bg} ${display.color} text-xs font-bold w-fit`}>
        <Icon className="w-3.5 h-3.5" /> {display.text}
      </div>
    </div>
  );
}
