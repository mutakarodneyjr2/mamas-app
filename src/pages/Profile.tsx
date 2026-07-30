import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Camera, Mail, MapPin, Briefcase, Phone, User, Shield, ChevronRight, LogOut, SunMoon, Sparkles } from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

export default function Profile() {
  const { userProfile, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPhone, setShowPhone] = useState(userProfile?.privacySettings?.showPhone ?? true);
  const [showEmail, setShowEmail] = useState(userProfile?.privacySettings?.showEmail ?? false);

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

  if (!userProfile) return null;

  return (
    <div className="max-w-2xl mx-auto w-full animate-in fade-in duration-300 pb-8">
      
      {/* HERO / AVATAR */}
      <div className="flex flex-col items-center mb-8 pt-4">
        <div className="relative mb-4">
          <div className="w-24 h-24 rounded-full bg-gray-100 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center">
            {userProfile.profilePictureUrl ? (
              <img src={userProfile.profilePictureUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-gray-300" />
            )}
          </div>
          <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-mamas-accent border-2 border-white flex items-center justify-center text-white shadow-sm hover:scale-110 transition-transform">
            <Camera className="w-4 h-4" />
          </button>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{userProfile.fullName}</h1>
        
        <div className="flex flex-col items-center gap-2 mt-2">
          <div className="bg-amber-50 text-mamas-accent border border-amber-200/50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
            {userProfile.role.replace('_', ' ')}
          </div>
          <span className="text-sm text-gray-500 font-medium">{userProfile.phoneNumber}</span>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* PERSONAL DETAILS CARD */}
        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Personal Details</h2>
          </div>
          <div className="divide-y divide-gray-100">
            <InfoRow icon={Mail} label="Email" value={userProfile.email} />
            <InfoRow icon={Briefcase} label="Occupation" value={userProfile.occupation} />
            <InfoRow icon={Shield} label="Year Left School" value={userProfile.yearLeftSchool?.toString()} />
            <InfoRow icon={MapPin} label="District" value={userProfile.district} />
          </div>
        </section>

        {/* NEXT OF KIN CARD */}
        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Next of Kin</h2>
          </div>
          <div className="divide-y divide-gray-100">
            <InfoRow icon={User} label="Name" value={userProfile.nextOfKinName} />
            <InfoRow icon={Phone} label="Phone" value={userProfile.nextOfKinPhone} />
          </div>
        </section>

        {/* PRIVACY SETTINGS */}
        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Directory Privacy</h2>
          </div>
          <div className="divide-y divide-gray-100">
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
        
        {/* PREFERENCES */}
        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Preferences</h2>
          </div>
          <div className="divide-y divide-gray-100">
            <ActionRow icon={SunMoon} label="Appearance" value="Light" />
            <ActionRow icon={Sparkles} label="App Tour" />
          </div>
        </section>

        {/* ACCOUNT ACTIONS */}
        <section className="pt-4 pb-8 space-y-4">
          <button className="w-full bg-mamas-primary text-white rounded-full py-4 font-bold shadow-lg shadow-mamas-primary/20 hover:bg-mamas-primary-hover active:scale-[0.98] transition-all">
            Edit Profile
          </button>
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 text-rose-500 font-bold py-4 hover:bg-rose-50 rounded-full transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Log Out
          </button>
        </section>

      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any, label: string, value: string | undefined }) {
  return (
    <div className="px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-gray-400" />
        <span className="text-gray-900 font-medium">{label}</span>
      </div>
      <span className="text-gray-500 text-sm text-right max-w-[50%] truncate">{value || 'Not provided'}</span>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string, checked: boolean, onChange: (val: boolean) => void }) {
  return (
    <div className="px-6 py-4 flex items-center justify-between">
      <span className="text-gray-900 font-medium">{label}</span>
      <button 
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${checked ? 'bg-mamas-primary' : 'bg-gray-200'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

function ActionRow({ icon: Icon, label, value }: { icon: any, label: string, value?: string }) {
  return (
    <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-gray-400" />
        <span className="text-gray-900 font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {value && <span className="text-sm text-gray-500">{value}</span>}
        <ChevronRight className="w-5 h-5 text-gray-300" />
      </div>
    </button>
  );
}
