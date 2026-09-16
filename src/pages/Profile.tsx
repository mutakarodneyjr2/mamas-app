import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Camera, Mail, MapPin, Briefcase, Phone, User, Shield, ChevronRight, LogOut, SunMoon, Sparkles, Check, Edit3, X, Save, Bell, BellRing, GraduationCap, Eye, EyeOff, Lock
} from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { registerFCMToken } from '../lib/fcmService';
import { uploadImage } from '../lib/storage';
import { PrivacyLevel } from '../types';

export default function Profile() {
  const { userProfile, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  
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
          <section className="pt-4 pb-8 space-y-4">
            <button 
              onClick={() => setIsEditing(true)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-2xl py-4 font-bold shadow-md shadow-blue-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Edit3 className="w-5 h-5 text-blue-200" /> Edit Profile Details
            </button>
            <button 
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 text-rose-500 hover:text-rose-600 font-bold py-3 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-2xl transition-colors text-sm cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
          </section>

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
