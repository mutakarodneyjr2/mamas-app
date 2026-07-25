import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Link } from 'react-router-dom';
import { User, Camera, Shield, FileText, CheckCircle2, AlertCircle, Upload, HelpCircle, SunMedium, Sparkles } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { OnboardingTour } from '../components/OnboardingTour';

const compressImageToBlob = async (file: File, maxWidth = 500, maxHeight = 500, quality = 0.8): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas toBlob failed'));
          }
        }, 'image/jpeg', quality);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export default function Profile() {
  const { userProfile, currentUser } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    occupation: '',
    placeOfResidence: '',
    district: '',
    nextOfKinName: '',
    nextOfKinPhone: '',
    showPhone: true,
    showEmail: true
  });
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [error, setError] = useState('');
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setFormData({
        email: userProfile.email || '',
        occupation: userProfile.occupation || '',
        placeOfResidence: userProfile.placeOfResidence || '',
        district: userProfile.district || '',
        nextOfKinName: userProfile.nextOfKinName || '',
        nextOfKinPhone: userProfile.nextOfKinPhone || '',
        showPhone: userProfile.privacySettings?.showPhone ?? true,
        showEmail: userProfile.privacySettings?.showEmail ?? true
      });
    }
  }, [userProfile]);

  if (!userProfile || !currentUser) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProfilePicFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setToastMessage('');
    setError('');

    try {
      let profilePictureUrl = userProfile.profilePictureUrl;
      
      if (profilePicFile) {
        try {
          const compressedBlob = await compressImageToBlob(profilePicFile);
          const picRef = ref(storage, `profile_pictures/${currentUser.uid}_${Date.now()}.jpg`);
          await uploadBytes(picRef, compressedBlob);
          profilePictureUrl = await getDownloadURL(picRef);
        } catch (e: any) {
          console.error("Image upload failed:", e);
          throw new Error("Unable to process or upload profile picture. Please try again.");
        }
      }

      await updateDoc(doc(db, 'users', currentUser.uid), {
        email: formData.email,
        occupation: formData.occupation,
        placeOfResidence: formData.placeOfResidence,
        district: formData.district,
        nextOfKinName: formData.nextOfKinName,
        nextOfKinPhone: formData.nextOfKinPhone,
        profilePictureUrl,
        privacySettings: {
          showPhone: formData.showPhone,
          showEmail: formData.showEmail
        },
        updatedAt: Date.now()
      });

      setToastMessage('Profile details updated successfully!');
      setProfilePicFile(null);

      // Auto dismiss toast
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-12 space-y-6 relative">
      
      {/* Success Toast */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-teal-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-teal-700 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-mamas-text">Member Profile</h1>
          <p className="text-sm text-mamas-text-muted mt-0.5">Manage your personal details and privacy preferences.</p>
        </div>
      </div>

      <div className="bg-mamas-card rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
        <form onSubmit={handleSubmit} className="divide-y divide-slate-100">
          
          {/* Prominent Header & Avatar Upload Section */}
          <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 bg-gradient-to-r from-slate-50 via-slate-50 to-blue-50/30">
            <div className="relative group flex-shrink-0">
              <div className="h-32 w-32 rounded-full overflow-hidden bg-slate-200 border-4 border-white shadow-lg flex items-center justify-center text-4xl font-bold text-slate-400 relative">
                {profilePicFile ? (
                  <img src={URL.createObjectURL(profilePicFile)} alt="Preview" className="h-full w-full object-cover" />
                ) : userProfile.profilePictureUrl ? (
                  <img src={userProfile.profilePictureUrl} alt={userProfile.fullName} className="h-full w-full object-cover" />
                ) : (
                  userProfile.fullName.charAt(0)
                )}
              </div>

              {/* Prominent Camera Overlay */}
              <label className="absolute inset-0 bg-slate-900/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer backdrop-blur-[2px]">
                <Camera className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Change Photo</span>
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>

              <label className="absolute -bottom-1 -right-1 bg-mamas-accent text-mamas-primary p-2.5 rounded-full shadow-lg cursor-pointer hover:bg-mamas-accent-hover transition-all border-2 border-white" title="Upload Photo">
                <Upload className="w-4 h-4" />
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
            </div>

            <div className="text-center sm:text-left flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <h2 className="text-2xl font-display font-bold text-mamas-text">{userProfile.fullName}</h2>
                <span className="inline-flex items-center gap-1 bg-mamas-primary/10 text-mamas-primary px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider self-center sm:self-auto border border-mamas-primary/20">
                  <Shield className="w-3 h-3" />
                  {userProfile.role.replace('_', ' ')}
                </span>
              </div>
              <p className="text-slate-500 font-semibold text-sm mt-1">{userProfile.phoneNumber}</p>
              <p className="text-xs text-slate-400 mt-0.5">Click camera icon or badge on avatar to upload a photo</p>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-8">
            {error && (
              <div className="bg-rose-50 text-rose-800 p-4 rounded-2xl text-sm font-medium border border-rose-200 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Personal Details */}
            <div>
              <h3 className="text-base font-bold text-mamas-text mb-4">Personal Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                  <input 
                    type="email" 
                    name="email" 
                    value={formData.email} 
                    onChange={handleChange} 
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-mamas-accent outline-none text-mamas-text font-semibold" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Occupation</label>
                  <input 
                    type="text" 
                    name="occupation" 
                    value={formData.occupation} 
                    onChange={handleChange} 
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-mamas-accent outline-none text-mamas-text font-semibold" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">District of Origin</label>
                  <input 
                    type="text" 
                    name="district" 
                    value={formData.district} 
                    onChange={handleChange} 
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-mamas-accent outline-none text-mamas-text font-semibold" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Place of Residence</label>
                  <input 
                    type="text" 
                    name="placeOfResidence" 
                    value={formData.placeOfResidence} 
                    onChange={handleChange} 
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-mamas-accent outline-none text-mamas-text font-semibold" 
                  />
                </div>
              </div>
            </div>

            {/* Next of Kin */}
            <div className="pt-2">
              <h3 className="text-base font-bold text-mamas-text mb-4">Next of Kin</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Name <span className="text-rose-500">*</span></label>
                  <input 
                    type="text" 
                    name="nextOfKinName" 
                    required 
                    value={formData.nextOfKinName} 
                    onChange={handleChange} 
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-mamas-accent outline-none text-mamas-text font-semibold" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone <span className="text-rose-500">*</span></label>
                  <input 
                    type="text" 
                    name="nextOfKinPhone" 
                    required 
                    value={formData.nextOfKinPhone} 
                    onChange={handleChange} 
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-mamas-accent outline-none text-mamas-text font-semibold" 
                  />
                </div>
              </div>
            </div>

            {/* Privacy Settings */}
            <div className="pt-2">
              <h3 className="text-base font-bold text-mamas-text mb-4">Directory Privacy</h3>
              <div className="space-y-4 bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="font-bold text-sm text-mamas-text">Show Phone Number in Directory</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Allow other approved alumni members to view your phone number.</p>
                  </div>
                  <div className="relative">
                    <input type="checkbox" name="showPhone" checked={formData.showPhone} onChange={handleChange} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-mamas-primary"></div>
                  </div>
                </label>
                <div className="h-px w-full bg-slate-200 dark:bg-slate-700"></div>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="font-bold text-sm text-mamas-text">Show Email Address in Directory</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Allow other approved alumni members to view your email address.</p>
                  </div>
                  <div className="relative">
                    <input type="checkbox" name="showEmail" checked={formData.showEmail} onChange={handleChange} className="sr-only peer" />
                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-mamas-primary"></div>
                  </div>
                </label>
              </div>
            </div>

            {/* Appearance / Theme Preference */}
            <div className="pt-2">
              <h3 className="text-base font-bold text-mamas-text mb-4 flex items-center gap-2">
                <SunMedium className="w-5 h-5 text-mamas-accent" /> Appearance & Theme
              </h3>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                <div>
                  <p className="font-bold text-sm text-mamas-text">Interface Theme Preference</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Choose between Light, Dark, or System theme across all MAMAS screens.</p>
                </div>
                <div className="pt-2 max-w-sm">
                  <ThemeToggle />
                </div>
              </div>
            </div>

            {/* App Onboarding Tour */}
            <div className="pt-2">
              <h3 className="text-base font-bold text-mamas-text mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-teal-600" /> App Guidance & Onboarding
              </h3>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-sm text-mamas-text">App Onboarding Tour</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Review how to make contributions, apply for welfare, view statements, and manage privacy settings.</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await updateDoc(doc(db, 'users', currentUser.uid), {
                      hasCompletedOnboarding: false,
                      updatedAt: Date.now()
                    });
                    setShowTour(true);
                  }}
                  className="bg-white dark:bg-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 whitespace-nowrap"
                >
                  <HelpCircle className="w-4 h-4 text-mamas-primary" /> Restart Tour
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-6 sm:p-8 bg-slate-50/50 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto bg-mamas-primary hover:bg-mamas-primary-hover text-white font-bold py-3.5 px-8 rounded-2xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Saving Profile...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>

      {showTour && (
        <OnboardingTour userProfile={userProfile} onComplete={() => setShowTour(false)} />
      )}

      <div className="text-center pt-4 pb-8 text-sm text-slate-500">
        <div className="flex justify-center items-center gap-4">
          <Link to="/help" className="font-bold text-mamas-primary hover:underline flex items-center gap-1">
            <HelpCircle className="w-4 h-4" /> Help Center & Support
          </Link>
          <span>&middot;</span>
          <Link to="/terms" className="hover:text-mamas-primary transition-colors">Terms of Service</Link>
          <span>&middot;</span>
          <Link to="/privacy" className="hover:text-mamas-primary transition-colors">Privacy Policy</Link>
        </div>
      </div>
    </div>
  );
}
