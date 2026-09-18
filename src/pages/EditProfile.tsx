import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { uploadImage } from '../lib/storage';
import { useNavigate } from 'react-router-dom';
import { 
  User, Phone, MapPin, Briefcase, GraduationCap, 
  Camera, Save, ArrowLeft, Check, AlertCircle 
} from 'lucide-react';

export default function EditProfile() {
  const { userProfile, currentUser } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Editable fields
  const [phoneNumber, setPhoneNumber] = useState('');
  const [occupation, setOccupation] = useState('');
  const [district, setDistrict] = useState('');
  const [yearLeftSchool, setYearLeftSchool] = useState('');
  const [nextOfKinName, setNextOfKinName] = useState('');
  const [nextOfKinPhone, setNextOfKinPhone] = useState('');

  useEffect(() => {
    if (userProfile) {
      setPhoneNumber(userProfile.phoneNumber || '');
      setOccupation(userProfile.occupation || '');
      setDistrict(userProfile.district || '');
      setYearLeftSchool(userProfile.yearLeftSchool ? userProfile.yearLeftSchool.toString() : '');
      setNextOfKinName(userProfile.nextOfKinName || '');
      setNextOfKinPhone(userProfile.nextOfKinPhone || '');
    }
  }, [userProfile]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfile?.uid) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (JPEG, PNG, WEBP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Original image size should be less than 10MB.');
      return;
    }

    // Instant local preview
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    setUploadingPhoto(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Compress to 600px width/height and quality 0.8 with 10s safety timeout & fallback
      const downloadURL = await uploadImage(file, `profile_pictures/${userProfile.uid}/${Date.now()}.jpg`, {
        maxDimension: 600,
        quality: 0.8,
        timeoutMs: 12000,
        allowDataUrlFallback: true
      });

      setPreviewUrl(downloadURL);

      await updateDoc(doc(db, 'users', userProfile.uid), {
        profilePictureUrl: downloadURL,
        updatedAt: Date.now()
      });

      await setDoc(doc(db, 'directoryProfiles', userProfile.uid), {
        profilePictureUrl: downloadURL,
        updatedAt: Date.now()
      }, { merge: true });

      setSuccessMsg('Profile picture updated successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error("Error uploading photo:", err);
      setErrorMsg(err.message || 'Failed to upload image. Please try a smaller photo.');
      setPreviewUrl(userProfile.profilePictureUrl || null);
    } finally {
      setUploadingPhoto(false);
      // Clean up input value so user can re-select same file if desired
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
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
      setTimeout(() => {
        setSuccessMsg('');
        navigate('/profile');
      }, 1500);
    } catch (err: any) {
      console.error("Error saving profile", err);
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  if (!userProfile) return null;

  return (
    <div className="max-w-2xl mx-auto w-full pb-20 animate-in fade-in duration-300 px-4 sm:px-6">
      
      {/* BACK / HEADER ZONE */}
      <div className="py-4 mb-5 flex items-center gap-3">
        <button
          onClick={() => navigate('/profile')}
          className="p-1.5 rounded-xl bg-white dark:bg-[#0c1731] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Edit Personal Details</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Update your public directory card & contact info</p>
        </div>
      </div>

      {successMsg && (
        <div className="mb-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Photo Upload Zone (Navy/Deep weight) */}
        <div className="bg-[#0c1731] text-white rounded-2xl p-5 border border-slate-800/60 flex items-center gap-4">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-slate-800/80 border-2 border-slate-700 overflow-hidden flex items-center justify-center relative">
              {(previewUrl || userProfile.profilePictureUrl) ? (
                <img src={previewUrl || userProfile.profilePictureUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User className="w-10 h-10 text-slate-400" />
              )}
              {uploadingPhoto && (
                <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-blue-600 border-2 border-[#0c1731] flex items-center justify-center text-white shadow-md hover:bg-blue-500 transition-colors cursor-pointer"
              title="Change photo"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Profile Photo</h3>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              Upload a clear face photo. This helps other verified alumni identify you in the directory. Max 5MB.
            </p>
          </div>
        </div>

        {/* Full-width Form Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Phone Number
            </label>
            <input
              type="text"
              required
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#0c1731] border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
              placeholder="e.g. 0771234567"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Class / Year Left School
            </label>
            <input
              type="number"
              value={yearLeftSchool}
              onChange={e => setYearLeftSchool(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#0c1731] border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
              placeholder="e.g. 2012"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Occupation / Profession
            </label>
            <input
              type="text"
              value={occupation}
              onChange={e => setOccupation(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#0c1731] border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
              placeholder="e.g. Software Engineer"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              District / Residence
            </label>
            <input
              type="text"
              value={district}
              onChange={e => setDistrict(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#0c1731] border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
              placeholder="e.g. Kampala"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Next of Kin Name
            </label>
            <input
              type="text"
              value={nextOfKinName}
              onChange={e => setNextOfKinName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#0c1731] border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
              placeholder="Full name"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Next of Kin Phone
            </label>
            <input
              type="text"
              value={nextOfKinPhone}
              onChange={e => setNextOfKinPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#0c1731] border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
              placeholder="Next of kin phone number"
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-3">
          <button
            type="submit"
            disabled={loading || uploadingPhoto}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Saving details...' : 'Save Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
