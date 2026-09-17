import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  User, Mail, Phone, MapPin, Briefcase, GraduationCap, 
  Camera, Save, Edit3, X, Lock, Bell, BellRing,
  LogOut, Trash2, AlertTriangle, Clock, Check, ShieldCheck,
  ChevronDown
} from 'lucide-react';
import { PrivacyLevel } from '../types';
import { registerFCMToken } from '../lib/fcmService';
import { scheduleAccountDeletion, cancelAccountDeletion } from '../lib/auth';
import { StatusBadge } from '../components/StatusBadge';
import { motion, AnimatePresence } from 'motion/react';

export default function Profile() {
  const { userProfile, currentUser, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
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
  const [savingPrivacy, setSavingPrivacy] = useState(false);

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

      setSuccessMsg('Profile picture updated successfully.');
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.uid) return;
    
    setLoading(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const parsedYear = Number(yearLeftSchool) || null;
      await updateDoc(doc(db, 'users', userProfile.uid), {
        phoneNumber,
        occupation,
        district,
        yearLeftSchool: parsedYear,
        nextOfKinName,
        nextOfKinPhone,
        updatedAt: Date.now()
      });

      // Sync safe directory projection
      await setDoc(doc(db, 'directoryProfiles', userProfile.uid), {
        uid: userProfile.uid,
        fullName: userProfile.fullName,
        yearLeftSchool: parsedYear || userProfile.yearLeftSchool || null,
        district: district || '',
        occupation: occupation || '',
        profilePictureUrl: userProfile.profilePictureUrl || '',
        status: userProfile.status || 'approved',
        role: userProfile.role || 'member',
        updatedAt: Date.now()
      }, { merge: true });

      setSuccessMsg('Profile details saved successfully.');
      setIsEditing(false);
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

  const handleScheduleDeletion = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE' || !userProfile?.uid || !currentUser) {
      return;
    }
    setDeletingAccount(true);
    setDeletionError('');

    try {
      await scheduleAccountDeletion(currentUser.uid, deleteReason);
      setShowDeleteModal(false);
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
    <div className="max-w-2xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      
      {/* STICKY TITLE HEADER */}
      <div className="sticky top-0 z-30 bg-mamas-bg/95 backdrop-blur-md px-4 sm:px-6 py-3.5 border-b border-slate-200/60 dark:border-slate-800/60 mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
            Profile
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your association credentials, status & privacy
          </p>
        </div>

        {!isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 bg-white dark:bg-[#0c1731] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-xl font-medium text-xs border border-slate-200 dark:border-slate-700 shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <Edit3 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Edit Profile</span>
          </button>
        )}
      </div>

      <div className="px-4 sm:px-6 space-y-5">
        {/* SUCCESS / ERROR ALERTS */}
        {successMsg && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 p-3 rounded-xl text-xs font-medium flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 p-3 rounded-xl text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {/* PENDING DELETION ALERT BANNER */}
        {isPendingDeletion && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-xs">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Account Scheduled for Deletion (30-Day Grace Period)</span>
            </div>
            <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
              Your account is scheduled for permanent anonymization on {userProfile?.deletionEffectiveAt ? new Date(userProfile.deletionEffectiveAt).toLocaleDateString() : '30 days from request'}. You can cancel anytime.
            </p>
            <button
              type="button"
              onClick={handleCancelDeletion}
              disabled={cancellingDeletion}
              className="py-1.5 px-3 rounded-lg font-medium text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {cancellingDeletion ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Cancel Deletion & Restore Access</span>
            </button>
          </div>
        )}

        {/* 1. IDENTITY HEADER SURFACE */}
        <div className="bg-white dark:bg-[#0c1731] rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-4">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <div className="relative shrink-0">
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center relative">
              {userProfile.profilePictureUrl ? (
                <img src={userProfile.profilePictureUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User className="w-8 h-8 text-slate-400" />
              )}
              {uploadingPhoto && (
                <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-blue-600 border-2 border-white dark:border-[#0c1731] flex items-center justify-center text-white shadow-xs hover:bg-blue-500 transition-all cursor-pointer"
              title="Change photo"
            >
              <Camera className="w-3 h-3" />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white tracking-tight truncate">
                {userProfile.fullName}
              </h2>
              <StatusBadge status={userProfile.status || 'pending'} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{userProfile.email}</p>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              <span>Role: <strong className="font-semibold text-slate-600 dark:text-slate-300 capitalize">{userProfile.role?.replace('_', ' ') || 'Member'}</strong></span>
              {userProfile.yearLeftSchool && (
                <>
                  <span>•</span>
                  <span>Class of {userProfile.yearLeftSchool}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 2. MEMBERSHIP STATUS EXPLANATION */}
        <div className="bg-white dark:bg-[#0c1731] rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Membership Status
              </h3>
            </div>
            <StatusBadge status={userProfile.status || 'pending'} />
          </div>

          <div className="pt-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {isVerified ? (
              <p className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>Your membership is fully verified. You have full directory access, voting privileges, and welfare benefits.</span>
              </p>
            ) : isPending ? (
              <div className="space-y-1.5">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  Verification Pending Committee Review
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Your account is awaiting committee review. Ensure your Class Year and Phone Number are accurate so alumni administrators can verify your identity.
                </p>
              </div>
            ) : (
              <p className="text-slate-500 dark:text-slate-400">
                Status: {userProfile.status || 'Active'}. Contact committee administration if you have questions about your standing.
              </p>
            )}
          </div>
        </div>

        {/* 3. IDENTITY & DETAILS (READ OR EDIT MODE) */}
        <div className="bg-white dark:bg-[#0c1731] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Identity & Contact Details
            </h3>
            {isEditing && (
              <button
                onClick={() => setIsEditing(false)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>

          {isEditing ? (
            <form onSubmit={handleSaveProfile} className="p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g. 0771234567"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Class / Year Left School
                  </label>
                  <input
                    type="number"
                    value={yearLeftSchool}
                    onChange={e => setYearLeftSchool(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g. 2008"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Occupation / Profession
                  </label>
                  <input
                    type="text"
                    value={occupation}
                    onChange={e => setOccupation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g. Civil Engineer"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    District / Residence
                  </label>
                  <input
                    type="text"
                    value={district}
                    onChange={e => setDistrict(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g. Kampala"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Next of Kin Name
                  </label>
                  <input
                    type="text"
                    value={nextOfKinName}
                    onChange={e => setNextOfKinName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Full name"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Next of Kin Phone
                  </label>
                  <input
                    type="text"
                    value={nextOfKinPhone}
                    onChange={e => setNextOfKinPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Phone number"
                  />
                </div>
              </div>

              {/* SINGLE PRIMARY SAVE BUTTON */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{loading ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              <RowItem icon={Mail} label="Email Address" value={userProfile.email} />
              <RowItem icon={Phone} label="Phone Number" value={userProfile.phoneNumber} />
              <RowItem icon={GraduationCap} label="Class Year" value={userProfile.yearLeftSchool ? `Class of ${userProfile.yearLeftSchool}` : undefined} />
              <RowItem icon={Briefcase} label="Occupation" value={userProfile.occupation} />
              <RowItem icon={MapPin} label="District / Residence" value={userProfile.district} />
              <RowItem icon={User} label="Next of Kin" value={userProfile.nextOfKinName ? `${userProfile.nextOfKinName} (${userProfile.nextOfKinPhone || 'No phone'})` : undefined} />
            </div>
          )}
        </div>

        {/* 4. DIRECTORY PRIVACY PREFERENCES */}
        <div className="bg-white dark:bg-[#0c1731] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-4 sm:p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Directory Privacy
              </h3>
            </div>
            <button
              type="button"
              onClick={handleSavePrivacy}
              disabled={savingPrivacy}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 font-medium cursor-pointer disabled:opacity-50"
            >
              {savingPrivacy ? 'Saving...' : 'Save Privacy'}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
            Control which contact details are visible to other verified members in the Alumni Directory.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <PrivacyRow label="Phone Number" value={privacyPhone} onChange={setPrivacyPhone} />
            <PrivacyRow label="WhatsApp Button" value={privacyWhatsapp} onChange={setPrivacyWhatsapp} />
            <PrivacyRow label="Email Address" value={privacyEmail} onChange={setPrivacyEmail} />
            <PrivacyRow label="Location / District" value={privacyLocation} onChange={setPrivacyLocation} />
            <PrivacyRow label="Occupation" value={privacyProfession} onChange={setPrivacyProfession} />
          </div>
        </div>

        {/* 5. SECURITY, NOTIFICATIONS & ACCOUNT */}
        <div className="bg-white dark:bg-[#0c1731] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden">
          <div className="px-4 sm:px-5 py-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Security & Session
            </h3>
          </div>

          {/* Notifications */}
          <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-medium text-slate-900 dark:text-white">Push Notifications</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {hasTokens && notifPermission === 'granted' ? 'Enabled on this device' : 'Receive instant alerts for welfare dues & notices'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleEnableNotifications}
              disabled={enablingNotifications}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
            >
              {enablingNotifications ? 'Enabling...' : hasTokens && notifPermission === 'granted' ? 'Refresh Token' : 'Enable'}
            </button>
          </div>

          {/* Sign Out */}
          <div className="p-4 sm:p-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0">
                <LogOut className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-medium text-slate-900 dark:text-white">Sign Out</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Logged in as {currentUser?.email}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              Sign Out
            </button>
          </div>

          {/* Danger zone: Account deletion */}
          <div className="p-4 sm:p-5 flex items-center justify-between gap-3 bg-rose-50/30 dark:bg-rose-950/10">
            <div>
              <h4 className="text-xs font-medium text-rose-700 dark:text-rose-400">Delete Account</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Schedules 30-day protected grace period before permanent deletion
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setShowDeleteModal(true); setDeleteConfirmText(''); setDeleteReason(''); setDeletionError(''); }}
              className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-medium text-rose-700 dark:text-rose-400 cursor-pointer"
            >
              Delete...
            </button>
          </div>
        </div>
      </div>

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
              className="relative bg-white dark:bg-[#0c1731] border border-rose-200 dark:border-rose-900/60 rounded-2xl w-full max-w-md overflow-hidden shadow-xl z-10"
            >
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Schedule Account Deletion</h3>
                </div>
                <button onClick={() => setShowDeleteModal(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3 text-xs">
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl text-rose-800 dark:text-rose-300 space-y-1 border border-rose-200 dark:border-rose-900/50">
                  <strong className="block font-semibold">30-Day Grace Period:</strong>
                  <p className="text-[11px] leading-relaxed">Your personal profile will be scheduled for permanent anonymization in 30 days. You can cancel at any time by logging back in.</p>
                </div>

                {deletionError && (
                  <div className="p-2.5 bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-xs font-medium">
                    {deletionError}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Reason (Optional)
                  </label>
                  <textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs text-slate-900 dark:text-white h-16 resize-none focus:outline-none focus:ring-1 focus:ring-rose-500"
                    placeholder="Tell us why you are leaving..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Type <span className="text-rose-600 dark:text-rose-400 font-mono font-bold">DELETE</span> to confirm:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="px-3.5 py-1.5 rounded-xl font-medium text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleScheduleDeletion}
                  disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE' || deletingAccount}
                  className="px-4 py-1.5 rounded-xl font-semibold text-xs text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {deletingAccount ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
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
      <span className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PrivacyLevel)}
        className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-medium text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
      >
        <option value="visible_to_verified_members">Verified Members</option>
        <option value="committee_only">Committee Only</option>
        <option value="hidden">Hidden</option>
      </select>
    </div>
  );
}
