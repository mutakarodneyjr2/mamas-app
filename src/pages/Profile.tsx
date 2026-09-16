import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  User, Mail, Phone, MapPin, Briefcase, GraduationCap, 
  Shield, Check, Edit3, Camera, Save, X, Eye, EyeOff, Lock,
  Bell, BellRing, Trash2, AlertTriangle, Clock, Settings,
  Sliders, ChevronRight, CheckCircle2, ShieldCheck, Heart
} from 'lucide-react';
import { PrivacyLevel } from '../types';
import { registerFCMToken } from '../lib/fcmService';
import { scheduleAccountDeletion, cancelAccountDeletion } from '../lib/auth';
import { motion, AnimatePresence } from 'motion/react';

export default function Profile() {
  const { userProfile, currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sheet / Drawer State
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState<'menu' | 'edit' | 'privacy' | 'notifications' | 'delete'>('menu');

  // Form states
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Editable fields
  const [phoneNumber, setPhoneNumber] = useState('');
  const [occupation, setOccupation] = useState('');
  const [district, setDistrict] = useState('');
  const [yearLeftSchool, setYearLeftSchool] = useState('');
  const [nextOfKinName, setNextOfKinName] = useState('');
  const [nextOfKinPhone, setNextOfKinPhone] = useState('');

  // Privacy fields
  const [privacyPhone, setPrivacyPhone] = useState<PrivacyLevel>('committee_only');
  const [privacyEmail, setPrivacyEmail] = useState<PrivacyLevel>('committee_only');
  const [privacyWhatsapp, setPrivacyWhatsapp] = useState<PrivacyLevel>('committee_only');
  const [privacyLocation, setPrivacyLocation] = useState<PrivacyLevel>('visible_to_verified_members');
  const [privacyProfession, setPrivacyProfession] = useState<PrivacyLevel>('visible_to_verified_members');

  // Push notification state
  const [enablingNotifications, setEnablingNotifications] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [hasTokens, setHasTokens] = useState(false);

  // Account deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [cancellingDeletion, setCancellingDeletion] = useState(false);
  const [deletionError, setDeletionError] = useState('');

  const isPendingDeletion = userProfile?.status === 'pending_deletion';

  useEffect(() => {
    if (userProfile) {
      setPhoneNumber(userProfile.phoneNumber || '');
      setOccupation(userProfile.occupation || '');
      setDistrict(userProfile.district || '');
      setYearLeftSchool(userProfile.yearLeftSchool ? userProfile.yearLeftSchool.toString() : '');
      setNextOfKinName(userProfile.nextOfKinName || '');
      setNextOfKinPhone(userProfile.nextOfKinPhone || '');

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfile?.uid) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image size should be less than 5MB');
      return;
    }

    setUploadingPhoto(true);
    setErrorMsg('');
    try {
      const storageRef = ref(storage, `profile_pictures/${userProfile.uid}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      await updateDoc(doc(db, 'users', userProfile.uid), {
        profilePictureUrl: downloadURL,
      });

      await setDoc(doc(db, 'directoryProfiles', userProfile.uid), {
        profilePictureUrl: downloadURL,
        updatedAt: Date.now()
      }, { merge: true });

      setSuccessMsg('Profile picture updated successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error("Error uploading photo:", err);
      setErrorMsg('Failed to upload image. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleEnableNotifications = async () => {
    if (!currentUser?.uid) return;
    setEnablingNotifications(true);
    setErrorMsg('');
    try {
      const token = await registerFCMToken(currentUser.uid);
      if (token) {
        setNotifPermission('granted');
        setHasTokens(true);
        setSuccessMsg('Push alerts enabled for this device.');
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setErrorMsg('Push notification permission was not granted or not supported in this browser.');
      }
    } catch (err: any) {
      console.error("FCM enable error:", err);
      setErrorMsg('Could not register push notifications.');
    } finally {
      setEnablingNotifications(false);
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
        yearLeftSchool: Number(yearLeftSchool) || null,
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

      setSuccessMsg('Profile updated successfully!');
      setIsSheetOpen(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error("Error saving profile", err);
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrivacy = async () => {
    if (!userProfile?.uid) return;
    setLoading(true);
    try {
      const updatedPrivacy = {
        phone: privacyPhone,
        email: privacyEmail,
        whatsapp: privacyWhatsapp,
        location: privacyLocation,
        profession: privacyProfession
      };

      await updateDoc(doc(db, 'users', userProfile.uid), {
        privacySettings: updatedPrivacy
      });

      await setDoc(doc(db, 'directoryProfiles', userProfile.uid), {
        privacySettings: updatedPrivacy,
        updatedAt: Date.now()
      }, { merge: true });

      setSuccessMsg('Privacy preferences saved.');
      setIsSheetOpen(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save privacy settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleDeletion = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE' || !userProfile?.uid || !currentUser) {
      return;
    }
    setDeletingAccount(true);
    setDeletionError('');

    try {
      await scheduleAccountDeletion(currentUser.uid, deleteReason);
      setShowDeleteModal(false);
      setIsSheetOpen(false);
      setSuccessMsg('Your account deletion is scheduled. You have a 30-day grace period to cancel.');
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
      await cancelAccountDeletion(currentUser.uid);
      setSuccessMsg('Your account deletion request has been cancelled. Membership restored.');
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err: any) {
      console.error('Failed to cancel account deletion:', err);
      setErrorMsg(err.message || 'Failed to cancel deletion request');
      setTimeout(() => setErrorMsg(''), 6000);
    } finally {
      setCancellingDeletion(false);
    }
  };

  if (!userProfile) return null;

  return (
    <div className="max-w-2xl mx-auto w-full pb-20 px-4 sm:px-6 pt-4 animate-in fade-in duration-300">
      
      {/* SUCCESS / ERROR ALERTS */}
      {successMsg && (
        <div className="mb-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between">
          <span className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> {successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 p-3.5 rounded-2xl text-xs font-bold">
          {errorMsg}
        </div>
      )}

      {/* PENDING DELETION ALERT BANNER */}
      {isPendingDeletion && (
        <div className="mb-5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-3xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-extrabold text-sm">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Account Scheduled for Deletion (30-Day Grace Period)</span>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            Your account is scheduled for final anonymization on {userProfile?.deletionEffectiveAt ? new Date(userProfile.deletionEffectiveAt).toLocaleDateString() : '30 days from request'}. You can cancel anytime.
          </p>
          <button
            type="button"
            onClick={handleCancelDeletion}
            disabled={cancellingDeletion}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
          >
            {cancellingDeletion ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Cancel Deletion & Restore Full Access
          </button>
        </div>
      )}

      {/* COMPACT PROFILE HERO - Serves as the page header directly below the system top toolbar */}
      <div className="bg-gradient-to-r from-[#07132c] via-[#0f2756] to-[#1e3a8a] rounded-3xl p-5 sm:p-6 text-white shadow-xl border border-blue-900/40 mb-6 relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <span className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-blue-200 border border-white/15">
            {userProfile?.role?.replace('_', ' ') || 'Member'}
          </span>

          {/* Single, Unified Settings & Privacy Button */}
          <button
            onClick={() => { setSheetTab('menu'); setIsSheetOpen(true); }}
            className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white px-3.5 py-1.5 rounded-full text-xs font-bold border border-white/20 transition-all cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Profile Settings</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <div className="relative shrink-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-blue-950 border-2 border-white/30 shadow-lg overflow-hidden flex items-center justify-center relative">
              {userProfile.profilePictureUrl ? (
                <img src={userProfile.profilePictureUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User className="w-8 h-8 text-blue-300" />
              )}
              {uploadingPhoto && (
                <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-blue-600 border border-white flex items-center justify-center text-white shadow-md hover:bg-blue-500 transition-all cursor-pointer"
              title="Change photo"
            >
              <Camera className="w-3 h-3" />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight truncate">
              {userProfile.fullName}
            </h1>
            <p className="text-blue-200 text-xs truncate mt-0.5">{userProfile.email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-blue-100/90 font-medium">
              <span>{userProfile.phoneNumber}</span>
              {userProfile.yearLeftSchool && (
                <>
                  <span className="opacity-40">•</span>
                  <span>Class of {userProfile.yearLeftSchool}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CORE PERSONAL DETAILS CARDS (EDGE-TO-EDGE) */}
      <div className="space-y-4">
        {/* Core Info */}
        <section className="bg-white dark:bg-[#0c1731] border-b border-slate-200/60 dark:border-slate-800/60 py-3">
          <div className="px-4 sm:px-6 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Membership Details
            </h2>
            <button 
              onClick={() => { setSheetTab('edit'); setIsSheetOpen(true); }}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-500 flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit Details
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 px-4 sm:px-6">
            <ProfileRow icon={Briefcase} label="Occupation" value={userProfile.occupation} />
            <ProfileRow icon={GraduationCap} label="Class Year" value={userProfile.yearLeftSchool ? `Class of ${userProfile.yearLeftSchool}` : undefined} />
            <ProfileRow icon={MapPin} label="District / Residence" value={userProfile.district} />
            <ProfileRow icon={ShieldCheck} label="Account Status" value={(userProfile.status || 'Active').toUpperCase()} isHighlight />
          </div>
        </section>

        {/* Next of Kin */}
        <section className="bg-white dark:bg-[#0c1731] border-b border-slate-200/60 dark:border-slate-800/60 py-3">
          <div className="px-4 sm:px-6 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Next of Kin
            </h2>
            <button 
              onClick={() => { setSheetTab('edit'); setIsSheetOpen(true); }}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-500 flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 px-4 sm:px-6">
            <ProfileRow icon={User} label="Name" value={userProfile.nextOfKinName} />
            <ProfileRow icon={Phone} label="Phone Number" value={userProfile.nextOfKinPhone} />
          </div>
        </section>

        {/* Quick Management Shortcuts */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => { setSheetTab('privacy'); setIsSheetOpen(true); }}
            className="p-4 bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-xs hover:border-blue-500/50 transition-all text-left flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">Privacy Controls</h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">Directory visibility</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors" />
          </button>

          <button
            onClick={() => { setSheetTab('notifications'); setIsSheetOpen(true); }}
            className="p-4 bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-xs hover:border-blue-500/50 transition-all text-left flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">Push Alerts</h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  {hasTokens && notifPermission === 'granted' ? 'Enabled' : 'Setup alert'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-amber-500 transition-colors" />
          </button>
        </div>
      </div>

      {/* PROFILE RIGHT MENU / SHEET */}
      <AnimatePresence>
        {isSheetOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
              onClick={() => setIsSheetOpen(false)}
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative w-full max-w-md bg-white dark:bg-[#0c1731] h-full shadow-2xl border-l border-slate-200/80 dark:border-slate-800 flex flex-col z-10 overflow-hidden"
            >
              {/* Sheet Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                    {sheetTab === 'menu' && 'Settings & Privacy'}
                    {sheetTab === 'edit' && 'Edit Member Details'}
                    {sheetTab === 'privacy' && 'Directory Privacy'}
                    {sheetTab === 'notifications' && 'Push Notifications'}
                    {sheetTab === 'delete' && 'Account Management'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsSheetOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sheet Body */}
              <div className="flex-1 overflow-y-auto p-5">
                {/* MENU HUB */}
                {sheetTab === 'menu' && (
                  <div className="space-y-3">
                    <button
                      onClick={() => setSheetTab('edit')}
                      className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-left transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Edit3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">Edit Profile</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Phone, occupation, location, next of kin</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>

                    <button
                      onClick={() => setSheetTab('privacy')}
                      className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-left transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">Directory Privacy</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Control what alumni and committee can see</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>

                    <button
                      onClick={() => setSheetTab('notifications')}
                      className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-left transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">Push Notifications</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Real-time alerts on your device</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => setSheetTab('delete')}
                        className="w-full p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200/80 dark:border-rose-900/60 flex items-center justify-between text-left transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                          <div>
                            <h4 className="font-bold text-sm text-rose-900 dark:text-rose-200">Delete Account</h4>
                            <p className="text-xs text-rose-700 dark:text-rose-400">30-day protected grace period</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-rose-400" />
                      </button>
                    </div>
                  </div>
                )}

                {/* EDIT FORM */}
                {sheetTab === 'edit' && (
                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Phone Number</label>
                      <input
                        type="text"
                        required
                        value={phoneNumber}
                        onChange={e => setPhoneNumber(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Occupation</label>
                      <input
                        type="text"
                        value={occupation}
                        onChange={e => setOccupation(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Class / Year Left School</label>
                      <input
                        type="text"
                        value={yearLeftSchool}
                        onChange={e => setYearLeftSchool(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">District / Residence</label>
                      <input
                        type="text"
                        value={district}
                        onChange={e => setDistrict(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="pt-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Next of Kin Name</label>
                      <input
                        type="text"
                        value={nextOfKinName}
                        onChange={e => setNextOfKinName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Next of Kin Phone</label>
                      <input
                        type="text"
                        value={nextOfKinPhone}
                        onChange={e => setNextOfKinPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex gap-2.5 pt-4">
                      <button
                        type="button"
                        onClick={() => setSheetTab('menu')}
                        className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-2xl text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl text-xs shadow-xs shadow-blue-500/25 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {loading ? 'Saving...' : 'Save Profile'}
                      </button>
                    </div>
                  </form>
                )}

                {/* PRIVACY SETTINGS */}
                {sheetTab === 'privacy' && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Select who can see your contact information in the Alumni Directory.
                    </p>

                    <div className="space-y-3">
                      <PrivacySelect label="Phone Number" value={privacyPhone} onChange={setPrivacyPhone} />
                      <PrivacySelect label="WhatsApp Button" value={privacyWhatsapp} onChange={setPrivacyWhatsapp} />
                      <PrivacySelect label="Email Address" value={privacyEmail} onChange={setPrivacyEmail} />
                      <PrivacySelect label="Location / District" value={privacyLocation} onChange={setPrivacyLocation} />
                      <PrivacySelect label="Profession / Occupation" value={privacyProfession} onChange={setPrivacyProfession} />
                    </div>

                    <div className="flex gap-2.5 pt-4">
                      <button
                        type="button"
                        onClick={() => setSheetTab('menu')}
                        className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-2xl text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handleSavePrivacy}
                        disabled={loading}
                        className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl text-xs shadow-xs shadow-blue-500/25 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {loading ? 'Saving...' : 'Save Privacy'}
                      </button>
                    </div>
                  </div>
                )}

                {/* PUSH NOTIFICATIONS */}
                {sheetTab === 'notifications' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">Status:</span>
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          hasTokens && notifPermission === 'granted'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {hasTokens && notifPermission === 'granted' ? 'Enabled' : 'Not Setup'}
                        </span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                        Receive instant push notifications for membership approval, welfare assistance milestones, contribution receipts, and urgent notices.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleEnableNotifications}
                      disabled={enablingNotifications}
                      className="w-full py-3 px-4 rounded-2xl font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {enablingNotifications ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <BellRing className="w-4 h-4" />
                      )}
                      {hasTokens && notifPermission === 'granted' ? 'Refresh Device Token' : 'Enable Push Notifications'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setSheetTab('menu')}
                      className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-2xl text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      Back
                    </button>
                  </div>
                )}

                {/* ACCOUNT DELETION */}
                {sheetTab === 'delete' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900/60 text-xs space-y-2">
                      <h4 className="font-extrabold text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        Account Deletion Policy
                      </h4>
                      <p className="text-rose-800 dark:text-rose-300 leading-relaxed">
                        Requesting deletion schedules your account to be deleted in 30 days. During this period, you can log in and cancel anytime. Association financial records remain preserved for statutory audit compliance.
                      </p>
                    </div>

                    {isPendingDeletion ? (
                      <button
                        type="button"
                        onClick={handleCancelDeletion}
                        disabled={cancellingDeletion}
                        className="w-full py-3 px-4 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {cancellingDeletion ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                        Cancel Deletion Request
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setShowDeleteModal(true); setDeleteConfirmText(''); setDeleteReason(''); setDeletionError(''); }}
                        className="w-full py-3 px-4 rounded-2xl font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                      >
                        <Trash2 className="w-4 h-4" />
                        Schedule Account Deletion
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setSheetTab('menu')}
                      className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-2xl text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      Back
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRM DELETION MODAL */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs"
              onClick={() => setShowDeleteModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-white dark:bg-[#0c1731] border border-rose-200 dark:border-rose-900/60 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl z-10"
            >
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Schedule Account Deletion</h3>
                </div>
                <button onClick={() => setShowDeleteModal(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-2xl text-rose-800 dark:text-rose-300 space-y-1 border border-rose-200 dark:border-rose-900/50">
                  <strong className="block font-bold">30-Day Grace Period:</strong>
                  <p>Your personal data will be scheduled for permanent anonymization in 30 days. You can cancel at any time.</p>
                </div>

                {deletionError && (
                  <div className="p-3 bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-bold">
                    {deletionError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Reason (Optional)
                  </label>
                  <textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-2.5 text-xs text-slate-900 dark:text-white h-16 resize-none focus:outline-none focus:ring-2 focus:ring-rose-500"
                    placeholder="Tell us why you are leaving..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Type <span className="text-rose-600 dark:text-rose-400 font-mono font-black">DELETE</span> to confirm:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-2.5 rounded-2xl font-bold text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleScheduleDeletion}
                  disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE' || deletingAccount}
                  className="flex-1 py-2.5 rounded-2xl font-bold text-xs text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {deletingAccount ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                  Confirm Deletion
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

function ProfileRow({ icon: Icon, label, value, isHighlight }: { icon: any, label: string, value: string | undefined, isHighlight?: boolean }) {
  return (
    <div className="px-5 py-3.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <Icon className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0" />
        <span className="text-slate-700 dark:text-slate-300 font-medium text-xs sm:text-sm">{label}</span>
      </div>
      <span className={`text-xs sm:text-sm font-bold text-right max-w-[55%] truncate ${
        isHighlight 
          ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60' 
          : 'text-slate-900 dark:text-white'
      }`}>
        {value || 'Not provided'}
      </span>
    </div>
  );
}

function PrivacySelect({ label, value, onChange }: { label: string, value: PrivacyLevel, onChange: (val: PrivacyLevel) => void }) {
  return (
    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/60 space-y-1.5">
      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PrivacyLevel)}
        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
      >
        <option value="visible_to_verified_members">Visible to Verified Members</option>
        <option value="committee_only">Visible to Committee Only</option>
        <option value="hidden">Hidden completely</option>
      </select>
    </div>
  );
}
