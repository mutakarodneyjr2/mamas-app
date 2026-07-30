import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Camera, Mail, MapPin, Briefcase, Phone, User, Shield, ChevronRight, LogOut, SunMoon, Sparkles, Check, Edit3, X, Save 
} from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

export default function Profile() {
  const { userProfile, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPhone, setShowPhone] = useState(userProfile?.privacySettings?.showPhone ?? true);
  const [showEmail, setShowEmail] = useState(userProfile?.privacySettings?.showEmail ?? false);

  const [isEditing, setIsEditing] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(userProfile?.phoneNumber || '');
  const [occupation, setOccupation] = useState(userProfile?.occupation || '');
  const [district, setDistrict] = useState(userProfile?.district || '');
  const [nextOfKinName, setNextOfKinName] = useState(userProfile?.nextOfKinName || '');
  const [nextOfKinPhone, setNextOfKinPhone] = useState(userProfile?.nextOfKinPhone || '');
  
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleTogglePrivacy = async (field: 'showPhone' | 'showEmail', value: boolean) => {
    if (!userProfile?.uid) return;
    try {
      if (field === 'showPhone') setShowPhone(value);
      if (field === 'showEmail') setShowEmail(value);
      
      await updateDoc(doc(db, 'users', userProfile.uid), {
        [`privacySettings.${field}`]: value
      });
    } catch (err) {
      console.error("Error updating privacy", err);
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
        nextOfKinName,
        nextOfKinPhone
      });

      setSuccessMsg('Profile updated successfully!');
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
        <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-sm font-bold flex items-center justify-between">
          <span className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> {successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-sm font-bold">
          {errorMsg}
        </div>
      )}

      {/* HERO / NAVY BANNER PROFILE HEADER */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-mamas-primary rounded-3xl overflow-hidden shadow-xl border border-slate-700/50 mb-8 text-white relative">
        <div className="h-28 bg-amber-500/10 border-b border-white/10 relative">
          <div className="absolute top-4 right-4 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-amber-300 border border-white/10">
            {userProfile.role.replace('_', ' ')}
          </div>
        </div>
        
        <div className="px-6 pb-6 pt-0 flex flex-col items-center text-center -mt-14 relative z-10">
          <div className="relative mb-3">
            <div className="w-24 h-24 rounded-full bg-slate-800 border-4 border-slate-900 shadow-2xl overflow-hidden flex items-center justify-center">
              {userProfile.profilePictureUrl ? (
                <img src={userProfile.profilePictureUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-slate-400" />
              )}
            </div>
            <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-amber-500 border-2 border-slate-900 flex items-center justify-center text-slate-950 shadow-md hover:scale-110 transition-transform">
              <Camera className="w-4 h-4" />
            </button>
          </div>
          
          <h1 className="text-2xl font-bold tracking-tight text-white">{userProfile.fullName}</h1>
          <p className="text-slate-300 text-xs font-medium mt-1">{userProfile.email}</p>
          <p className="text-amber-400 text-xs font-bold mt-1">{userProfile.phoneNumber}</p>
        </div>
      </div>

      {isEditing ? (
        /* EDIT PROFILE FORM */
        <form onSubmit={handleSaveProfile} className="space-y-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-amber-500" /> Edit Member Details
            </h2>
            <button 
              type="button" 
              onClick={() => setIsEditing(false)}
              className="p-2 rounded-full hover:bg-slate-100 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone Number</label>
              <input
                type="text"
                required
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Occupation</label>
              <input
                type="text"
                value={occupation}
                onChange={e => setOccupation(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">District / Residence</label>
              <input
                type="text"
                value={district}
                onChange={e => setDistrict(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Next of Kin Name</label>
              <input
                type="text"
                value={nextOfKinName}
                onChange={e => setNextOfKinName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Next of Kin Phone</label>
              <input
                type="text"
                value={nextOfKinPhone}
                onChange={e => setNextOfKinPhone(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-amber-500 text-slate-950 font-bold rounded-xl text-sm shadow-md hover:bg-amber-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      ) : (
        /* READ ONLY VIEW */
        <div className="space-y-6">
          
          {/* PERSONAL DETAILS CARD */}
          <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Personal Details</h2>
              <button 
                onClick={() => setIsEditing(true)}
                className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              <InfoRow icon={Mail} label="Email" value={userProfile.email} />
              <InfoRow icon={Briefcase} label="Occupation" value={userProfile.occupation} />
              <InfoRow icon={Shield} label="Year Left School" value={userProfile.yearLeftSchool?.toString()} />
              <InfoRow icon={MapPin} label="District" value={userProfile.district} />
            </div>
          </section>

          {/* NEXT OF KIN CARD */}
          <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Next of Kin</h2>
            </div>
            <div className="divide-y divide-slate-100">
              <InfoRow icon={User} label="Name" value={userProfile.nextOfKinName} />
              <InfoRow icon={Phone} label="Phone" value={userProfile.nextOfKinPhone} />
            </div>
          </section>

          {/* PRIVACY SETTINGS */}
          <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Directory Privacy</h2>
            </div>
            <div className="divide-y divide-slate-100">
              <ToggleRow 
                label="Show Phone in Directory" 
                checked={showPhone} 
                onChange={(val) => handleTogglePrivacy('showPhone', val)} 
              />
              <ToggleRow 
                label="Show Email in Directory" 
                checked={showEmail} 
                onChange={(val) => handleTogglePrivacy('showEmail', val)} 
              />
            </div>
          </section>

          {/* ACCOUNT ACTIONS */}
          <section className="pt-4 pb-8 space-y-4">
            <button 
              onClick={() => setIsEditing(true)}
              className="w-full bg-slate-900 text-white rounded-full py-4 font-bold shadow-lg hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Edit3 className="w-5 h-5 text-amber-400" /> Edit Profile Details
            </button>
            <button 
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 text-rose-500 font-bold py-3 hover:bg-rose-50 rounded-full transition-colors text-sm"
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
        <Icon className="w-5 h-5 text-slate-400" />
        <span className="text-slate-900 font-medium text-sm">{label}</span>
      </div>
      <span className="text-slate-500 text-sm font-medium text-right max-w-[50%] truncate">{value || 'Not provided'}</span>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string, checked: boolean, onChange: (val: boolean) => void }) {
  return (
    <div className="px-6 py-4 flex items-center justify-between">
      <span className="text-slate-900 font-medium text-sm">{label}</span>
      <button 
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${checked ? 'bg-amber-500' : 'bg-slate-200'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}
