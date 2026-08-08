import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { uploadImage } from '../lib/storage';
import { Logo } from '../components/Logo';
import { 
  Phone, 
  ArrowRight, 
  ArrowLeft, 
  Mail, 
  KeyRound, 
  User as UserIcon, 
  Check, 
  X, 
  Camera, 
  CheckCircle2, 
  ShieldCheck, 
  Eye, 
  EyeOff,
  Sparkles,
  School,
  MapPin,
  Briefcase,
  Users
} from 'lucide-react';
import type { User } from '../types';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { SelectDropdown, type Option } from '../components/SelectDropdown';

type RegisterStep = 1 | 2 | 3 | 'success';

// Constants for Dropdowns
const DISTRICTS = [
  'Abim', 'Adjumani', 'Agago', 'Alebtong', 'Amolatar', 'Amudat', 'Amuria', 'Amuru', 'Apac', 'Arua', 'Budaka', 'Bududa', 'Bugiri', 'Bugweri', 'Buhweju', 'Buikwe', 'Bukedea', 'Bukomansimbi', 'Bukwo', 'Bulambuli', 'Buliisa', 'Bundibugyo', 'Bunyangabu', 'Bushenyi', 'Busia', 'Butaleja', 'Butambala', 'Buvuma', 'Buyende', 'Dokolo', 'Gomba', 'Gulu', 'Hoima', 'Ibanda', 'Iganga', 'Isingiro', 'Jinja', 'Kaabong', 'Kabale', 'Kabarole', 'Kaberamaido', 'Kagadi', 'Kakumiro', 'Kalaki', 'Kalangala', 'Kaliro', 'Kalungu', 'Kampala', 'Kamuli', 'Kamwenge', 'Kanungu', 'Kapchorwa', 'Kapelebyong', 'Karenga', 'Kasanda', 'Kasese', 'Katakwi', 'Kayunga', 'Kazo', 'Kibaale', 'Kiboga', 'Kibuku', 'Kigezi', 'Kikuube', 'Kiruhura', 'Kiryandongo', 'Kisoro', 'Kitagwenda', 'Kitgum', 'Koboko', 'Kole', 'Kotido', 'Kumi', 'Kwania', 'Kween', 'Kyankwanzi', 'Kyegegwa', 'Kyenjojo', 'Kyotera', 'Lamwo', 'Lira', 'Luuka', 'Luweero', 'Lwengo', 'Lyantonde', 'Manafwa', 'Maracha', 'Masaka', 'Masindi', 'Mayuge', 'Mbale', 'Mbarara', 'Mitooma', 'Mityana', 'Moroto', 'Moyo', 'Mpigi', 'Mubende', 'Mukono', 'Nabilatuk', 'Nakapiripirit', 'Nakaseke', 'Nakasongola', 'Namayingo', 'Namisindwa', 'Namutumba', 'Napak', 'Nebbi', 'Ngora', 'Ntoroko', 'Ntungamo', 'Nwoya', 'Obongi', 'Omoro', 'Otuke', 'Oyam', 'Pader', 'Pakwach', 'Pallisa', 'Rakai', 'Rubanda', 'Rubirizi', 'Rukiga', 'Rukungiri', 'Rwampara', 'Serere', 'Sheema', 'Sironko', 'Soroti', 'Tororo', 'Wakiso', 'Yumbe', 'Zombo'
];

const DISTRICT_OPTIONS: Option[] = DISTRICTS.map(d => ({ label: d, value: d }));

const OCCUPATION_OPTIONS: Option[] = [
  // Education
  { label: 'Student', value: 'Student', icon: '🎓', category: 'Education' },
  { label: 'Teacher / Lecturer', value: 'Teacher / Lecturer', icon: '👨‍🏫', category: 'Education' },
  { label: 'Professor', value: 'Professor', icon: '👨‍🔬', category: 'Education' },
  { label: 'School Administrator', value: 'School Administrator', icon: '🏫', category: 'Education' },
  // Healthcare
  { label: 'Doctor / Physician', value: 'Doctor / Physician', icon: '👨‍⚕️', category: 'Healthcare' },
  { label: 'Nurse', value: 'Nurse', icon: '👩‍⚕️', category: 'Healthcare' },
  { label: 'Pharmacist', value: 'Pharmacist', icon: '💊', category: 'Healthcare' },
  { label: 'Medical Officer', value: 'Medical Officer', icon: '🩺', category: 'Healthcare' },
  { label: 'Dentist', value: 'Dentist', icon: '🦷', category: 'Healthcare' },
  { label: 'Veterinary Doctor', value: 'Veterinary Doctor', icon: '🐕', category: 'Healthcare' },
  { label: 'Clinical Officer', value: 'Clinical Officer', icon: '🏥', category: 'Healthcare' },
  // Engineering & Tech
  { label: 'Civil Engineer', value: 'Civil Engineer', icon: '🏗️', category: 'Engineering & Tech' },
  { label: 'Electrical Engineer', value: 'Electrical Engineer', icon: '⚡', category: 'Engineering & Tech' },
  { label: 'Mechanical Engineer', value: 'Mechanical Engineer', icon: '⚙️', category: 'Engineering & Tech' },
  { label: 'Software Engineer / Developer', value: 'Software Engineer / Developer', icon: '💻', category: 'Engineering & Tech' },
  { label: 'IT Specialist / Technician', value: 'IT Specialist / Technician', icon: '🖥️', category: 'Engineering & Tech' },
  { label: 'Architect', value: 'Architect', icon: '📐', category: 'Engineering & Tech' },
  // Business & Finance
  { label: 'Accountant', value: 'Accountant', icon: '📊', category: 'Business & Finance' },
  { label: 'Auditor', value: 'Auditor', icon: '📋', category: 'Business & Finance' },
  { label: 'Banker', value: 'Banker', icon: '🏦', category: 'Business & Finance' },
  { label: 'Business Owner / Entrepreneur', value: 'Business Owner / Entrepreneur', icon: '💼', category: 'Business & Finance' },
  { label: 'Sales / Marketing Professional', value: 'Sales / Marketing Professional', icon: '📈', category: 'Business & Finance' },
  { label: 'Human Resources Manager', value: 'Human Resources Manager', icon: '🤝', category: 'Business & Finance' },
  // Legal & Government
  { label: 'Lawyer / Advocate', value: 'Lawyer / Advocate', icon: '⚖️', category: 'Legal & Government' },
  { label: 'Judge / Magistrate', value: 'Judge / Magistrate', icon: '🔨', category: 'Legal & Government' },
  { label: 'Police Officer', value: 'Police Officer', icon: '👮', category: 'Legal & Government' },
  { label: 'Military / Army Officer', value: 'Military / Army Officer', icon: '🪖', category: 'Legal & Government' },
  { label: 'Civil Servant', value: 'Civil Servant', icon: '🏛️', category: 'Legal & Government' },
  { label: 'Politician / Member of Parliament', value: 'Politician / Member of Parliament', icon: '🗳️', category: 'Legal & Government' },
  { label: 'Local Council Leader (LC)', value: 'Local Council Leader (LC)', icon: '🏘️', category: 'Legal & Government' },
  // Agriculture
  { label: 'Farmer', value: 'Farmer', icon: '🌾', category: 'Agriculture' },
  { label: 'Agricultural Officer', value: 'Agricultural Officer', icon: '🚜', category: 'Agriculture' },
  { label: 'Veterinarian', value: 'Veterinarian', icon: '🐄', category: 'Agriculture' },
  // Media & Creative
  { label: 'Journalist / Reporter', value: 'Journalist / Reporter', icon: '🎤', category: 'Media & Creative' },
  { label: 'Radio / TV Presenter', value: 'Radio / TV Presenter', icon: '📻', category: 'Media & Creative' },
  { label: 'Photographer', value: 'Photographer', icon: '📸', category: 'Media & Creative' },
  { label: 'Graphic Designer', value: 'Graphic Designer', icon: '🎨', category: 'Media & Creative' },
  { label: 'Musician / Artist', value: 'Musician / Artist', icon: '🎸', category: 'Media & Creative' },
  { label: 'Writer / Author', value: 'Writer / Author', icon: '✍️', category: 'Media & Creative' },
  // Trade & Services
  { label: 'Driver (Taxi, Boda Boda, Truck)', value: 'Driver (Taxi, Boda Boda, Truck)', icon: '🚗', category: 'Trade & Services' },
  { label: 'Mechanic', value: 'Mechanic', icon: '🔧', category: 'Trade & Services' },
  { label: 'Carpenter', value: 'Carpenter', icon: '🪚', category: 'Trade & Services' },
  { label: 'Mason / Builder', value: 'Mason / Builder', icon: '🧱', category: 'Trade & Services' },
  { label: 'Electrician', value: 'Electrician', icon: '🔌', category: 'Trade & Services' },
  { label: 'Plumber', value: 'Plumber', icon: '🚰', category: 'Trade & Services' },
  { label: 'Tailor / Fashion Designer', value: 'Tailor / Fashion Designer', icon: '🧵', category: 'Trade & Services' },
  { label: 'Chef / Cook', value: 'Chef / Cook', icon: '👨‍🍳', category: 'Trade & Services' },
  { label: 'Hairdresser / Barber', value: 'Hairdresser / Barber', icon: '✂️', category: 'Trade & Services' },
  // Religious
  { label: 'Pastor / Priest', value: 'Pastor / Priest', icon: '⛪', category: 'Religious' },
  { label: 'Imam', value: 'Imam', icon: '🕌', category: 'Religious' },
  { label: 'Religious Leader', value: 'Religious Leader', icon: '🕊️', category: 'Religious' },
  // Other
  { label: 'Retired', value: 'Retired', icon: '🌅', category: 'Other' },
  { label: 'Unemployed', value: 'Unemployed', icon: '⏳', category: 'Other' },
  { label: 'Other', value: 'Other', icon: '📝', category: 'Other' }
];

const COURSE_OPTIONS: Option[] = [
  { label: 'Medicine', value: 'Medicine' },
  { label: 'Law', value: 'Law' },
  { label: 'Engineering', value: 'Engineering' },
  { label: 'Education', value: 'Education' },
  { label: 'Business & Finance', value: 'Business & Finance' },
  { label: 'IT & Computer Science', value: 'IT & Computer Science' },
  { label: 'Agriculture', value: 'Agriculture' },
  { label: 'Arts & Humanities', value: 'Arts & Humanities' },
  { label: 'Science', value: 'Science' },
  { label: 'Other', value: 'Other' }
];

export default function Register() {
  const { userProfile, googleSignIn, checkUserExists, logout } = useAuth();
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState<RegisterStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  const [authProvider, setAuthProvider] = useState<'email' | 'google'>('email');
  const [googleUid, setGoogleUid] = useState('');

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    yearLeftSchool: '',
    district: '',
    placeOfResidence: '',
    occupation: '',
    otherOccupation: '',
    university: '',
    course: '',
    nextOfKinName: '',
    nextOfKinPhone: '',
    showPhone: true,
    showEmail: true
  });

  const [showPassword, setShowPassword] = useState(false);
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [profilePicPreview, setProfilePicPreview] = useState<string>('');

  useEffect(() => {
    if (userProfile && currentStep !== 'success') {
      navigate('/dashboard');
    }
  }, [userProfile, navigate, currentStep]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfilePicFile(file);
      setProfilePicPreview(URL.createObjectURL(file));
    }
  };

  const uploadProfilePic = async (uid: string, file: File): Promise<string> => {
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `users/${uid}/profile_${Date.now()}.${ext}`;
      return await uploadImage(file, path, { timeoutMs: 8000, allowDataUrlFallback: true });
    } catch (err) {
      console.warn("Failed to upload profile picture during registration:", err);
      return '';
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');
    setLoading(true);
    try {
      const cred = await googleSignIn();
      const exists = await checkUserExists(cred.user.uid);
      if (exists) {
        // User already exists
        return;
      }
      
      // New user, pre-fill form
      setAuthProvider('google');
      setGoogleUid(cred.user.uid);
      setFormData(prev => ({
        ...prev,
        fullName: cred.user.displayName || '',
        email: cred.user.email || ''
      }));
      if (cred.user.photoURL) {
        setProfilePicPreview(cred.user.photoURL);
      }
      // Advance to step 2 directly
      setCurrentStep(2);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-blocked' || err.message?.includes('popup')) {
        setError('Please allow popups for this site or use email/password login instead.');
      } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setError('Failed to sign in with Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Real-time validations
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
  
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 8 && /[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score++;
    return score; // 1: Weak, 2: Medium, 3: Strong
  };

  const pwdStrength = getPasswordStrength(formData.password);
  const isPasswordMatch = formData.password.length > 0 && formData.password === formData.confirmPassword;

  // Step validation helpers
  const handleNextStep1 = () => {
    setError('');
    if (authProvider === 'email') {
      if (!formData.email.trim()) {
        setError('Please enter your email address.');
        return;
      }
      if (!isEmailValid) {
        setError('Please enter a valid email address.');
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }
    setCurrentStep(2);
  };

  const handleNextStep2 = () => {
    setError('');
    if (formData.fullName.trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (formData.phoneNumber.trim().length < 8) {
      setError('Please enter a valid phone number.');
      return;
    }
    if (!formData.yearLeftSchool) {
      setError('Please select the year you left school.');
      return;
    }
    if (!formData.district) {
      setError('Please select your district of origin.');
      return;
    }
    if (!formData.occupation) {
      setError('Please select your occupation.');
      return;
    }
    if (formData.occupation === 'Other' && formData.otherOccupation.trim().length === 0) {
      setError('Please specify your occupation.');
      return;
    }
    if (formData.occupation === 'Student') {
      if (formData.university.trim().length === 0) {
        setError('Please enter your university/institution.');
        return;
      }
      if (formData.course.trim().length === 0) {
        setError('Please select your course of study.');
        return;
      }
    }
    setCurrentStep(3);
  };

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.nextOfKinName.trim()) {
      setError('Please enter your Next of Kin name.');
      return;
    }
    
    if (!formData.nextOfKinPhone.trim()) {
      setError('Please enter your Next of Kin phone.');
      return;
    }

    if (!agreedToTerms) {
      setError("You must agree to the Terms of Service to proceed.");
      return;
    }

    setLoading(true);
    
    try {
      let uid = googleUid;
      let finalProfilePicUrl = profilePicPreview;

      const performRegistration = async () => {
        if (authProvider === 'email') {
          // 1. Create user in Firebase Auth
          const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
          uid = userCredential.user.uid;
        }

        if (!uid) {
          throw new Error("No valid user ID found.");
        }

        // 2. Immediately create profile in Firestore FIRST with initial/preview photo
        const newProfile: Partial<User> = {
          uid,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          fullName: formData.fullName,
          yearLeftSchool: formData.yearLeftSchool,
          district: formData.district,
          placeOfResidence: formData.placeOfResidence,
          occupation: formData.occupation === 'Other' ? formData.otherOccupation : formData.occupation,
          ...(formData.occupation === 'Student' && {
            university: formData.university,
            course: formData.course
          }),
          nextOfKinName: formData.nextOfKinName,
          nextOfKinPhone: formData.nextOfKinPhone,
          profilePictureUrl: finalProfilePicUrl || '',
          privacySettings: {
            showPhone: formData.showPhone,
            showEmail: formData.showEmail
          },
          status: 'pending', // Requires admin approval
          role: 'member',
          createdAt: new Date().toISOString(),
          authProvider: authProvider
        };

        await setDoc(doc(db, 'users', uid), newProfile);

        // 3. Upload profile photo AFTER profile doc exists (non-blocking)
        if (profilePicFile) {
          try {
            const uploadedUrl = await uploadProfilePic(uid, profilePicFile);
            if (uploadedUrl) {
              await updateDoc(doc(db, 'users', uid), { profilePictureUrl: uploadedUrl });
            }
          } catch (photoErr) {
            console.warn("Photo upload warning during registration:", photoErr);
          }
        }
      };

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Request timed out. Please check your internet connection and try again.")), 20000);
      });

      await Promise.race([performRegistration(), timeoutPromise]);
      
      setCurrentStep('success');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please log in.');
      } else {
        setError(err.message || 'Failed to complete registration.');
      }
    } finally {
      setLoading(false);
    }
  };

  const currentYear = new Date().getFullYear() + 2;
  const years = Array.from(new Array(currentYear - 1960 + 1), (val, index) => currentYear - index);
  const YEAR_OPTIONS: Option[] = years.map(y => ({ label: y.toString(), value: y.toString() }));

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden selection:bg-mamas-accent selection:text-mamas-primary">
      {/* Background Floating Orbs */}
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Header Bar */}
        <div className="p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-mamas-primary to-slate-900 text-white flex items-center justify-between border-b border-slate-800 relative">
          <Logo />
          <Link 
            to="/login" 
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 px-3.5 py-1.5 rounded-full border border-amber-500/20 transition-all"
          >
            Log In
          </Link>
        </div>

        {/* STEP PROGRESS INDICATOR (Steps 1, 2, 3) */}
        {currentStep !== 'success' && (
          <div className="px-6 py-5 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800">
            <div className="max-w-md mx-auto relative flex items-center justify-between">
              
              {/* Connecting Progress Line */}
              <div className="absolute left-6 right-6 top-4 h-1 bg-slate-200 dark:bg-slate-800 -z-0">
                <div 
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{
                    width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%'
                  }}
                />
              </div>

              {/* Step 1 Circle */}
              <div className="relative z-10 flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-md transition-all ${
                  currentStep === 1 
                    ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-500/20' 
                    : currentStep > 1 
                    ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950' 
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                }`}>
                  {currentStep > 1 ? <Check className="w-4 h-4" /> : '1'}
                </div>
                <span className={`text-[11px] font-bold mt-1.5 ${currentStep === 1 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
                  Account
                </span>
              </div>

              {/* Step 2 Circle */}
              <div className="relative z-10 flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-md transition-all ${
                  currentStep === 2 
                    ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-500/20' 
                    : currentStep > 2 
                    ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950' 
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                }`}>
                  {currentStep > 2 ? <Check className="w-4 h-4" /> : '2'}
                </div>
                <span className={`text-[11px] font-bold mt-1.5 ${currentStep === 2 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
                  Profile
                </span>
              </div>

              {/* Step 3 Circle */}
              <div className="relative z-10 flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-md transition-all ${
                  currentStep === 3 
                    ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-500/20' 
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                }`}>
                  3
                </div>
                <span className={`text-[11px] font-bold mt-1.5 ${currentStep === 3 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
                  Finalize
                </span>
              </div>

            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 sm:p-10">
          
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold animate-in fade-in">
              {error}
            </div>
          )}

          {/* ================= STEP 1: ACCOUNT ================= */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              
              <div className="text-center sm:text-left">
                <h2 className="text-2xl sm:text-3xl font-serif font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Create Your Account
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Let's get you started with MAMAS.
                </p>
              </div>

              {/* Google Sign-Up Option */}
              {authProvider === 'email' && (
                <div>
                  <GoogleSignInButton
                    mode="register"
                    onClick={handleGoogleSignUp}
                    loading={loading}
                    className="rounded-xl py-3.5 font-semibold text-sm shadow-sm hover:shadow-md border-slate-300 dark:border-slate-700 transition-all active:scale-[0.99]"
                  />

                  <div className="relative flex items-center justify-center my-6">
                    <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                    <span className="absolute bg-white dark:bg-slate-900 px-3 text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                      OR REGISTER WITH EMAIL
                    </span>
                  </div>
                </div>
              )}

              {/* Email & Password Form */}
              <div className="space-y-4">
                
                {/* Email Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="email" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Email Address
                    </label>
                    {formData.email && (
                      <span className="text-[11px] font-bold flex items-center gap-1">
                        {isEmailValid ? (
                          <span className="text-emerald-500 flex items-center gap-0.5"><Check className="w-3.5 h-3.5" /> Valid</span>
                        ) : (
                          <span className="text-rose-500">Invalid format</span>
                        )}
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-4 h-4" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      required
                      placeholder="e.g. member@mamas.org"
                      value={formData.email}
                      onChange={handleChange}
                      name="email"
                      disabled={authProvider === 'google'}
                      className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all disabled:opacity-60"
                    />
                    {isEmailValid && (
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-emerald-500 pointer-events-none">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                </div>

                {authProvider === 'email' && (
                  <>
                    {/* Password Field */}
                    <div>
                      <label htmlFor="password" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                        Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <KeyRound className="h-4 h-4" />
                        </div>
                        <input
                          id="password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          placeholder="At least 6 characters"
                          value={formData.password}
                          onChange={handleChange}
                          className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Password Strength Meter */}
                      {formData.password.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="flex gap-1.5 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full transition-all duration-300 ${pwdStrength >= 1 ? (pwdStrength === 1 ? 'w-1/3 bg-rose-500' : pwdStrength === 2 ? 'w-2/3 bg-amber-500' : 'w-full bg-emerald-500') : 'w-0'}`} />
                          </div>
                          <p className="text-[11px] font-semibold text-slate-400 flex justify-between">
                            <span>Strength:</span>
                            <span className={pwdStrength === 1 ? 'text-rose-500 font-bold' : pwdStrength === 2 ? 'text-amber-500 font-bold' : 'text-emerald-500 font-bold'}>
                              {pwdStrength === 1 ? 'Weak' : pwdStrength === 2 ? 'Medium' : 'Strong'}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Confirm Password Field */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="confirmPassword" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Confirm Password
                        </label>
                        {formData.confirmPassword && (
                          <span className="text-[11px] font-bold">
                            {isPasswordMatch ? (
                              <span className="text-emerald-500 flex items-center gap-0.5"><Check className="w-3.5 h-3.5" /> Matches</span>
                            ) : (
                              <span className="text-rose-500 flex items-center gap-0.5"><X className="w-3.5 h-3.5" /> Mismatch</span>
                            )}
                          </span>
                        )}
                      </div>

                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <KeyRound className="h-4 h-4" />
                        </div>
                        <input
                          id="confirmPassword"
                          name="confirmPassword"
                          type={showPassword ? 'text' : 'password'}
                          required
                          placeholder="Re-enter password"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                        />
                        {formData.confirmPassword.length > 0 && (
                          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                            {isPasswordMatch ? <Check className="w-4 h-4 text-emerald-500" /> : <X className="w-4 h-4 text-rose-500" />}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

              </div>

              {/* Next Button */}
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleNextStep1}
                  className="w-full py-3.5 px-6 rounded-full bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-bold text-sm shadow-xl hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continue to Profile</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          )}

          {/* ================= STEP 2: PROFILE ================= */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              
              <div className="text-center sm:text-left">
                <h2 className="text-2xl sm:text-3xl font-serif font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Tell Us About Yourself
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  This helps us verify you're a Matuumu alumnus.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Full Name */}
                <div className="sm:col-span-2">
                  <label htmlFor="fullName" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                    Full Name *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <UserIcon className="h-4 h-4" />
                    </div>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      required
                      placeholder="e.g. John Okello"
                      value={formData.fullName}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                    />
                  </div>
                </div>

                {/* Phone Number */}
                <div className="sm:col-span-1">
                  <label htmlFor="phoneNumber" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                    Phone Number *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Phone className="h-4 h-4" />
                    </div>
                    <input
                      id="phoneNumber"
                      name="phoneNumber"
                      type="tel"
                      required
                      placeholder="+256 700 000000"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                    />
                  </div>
                </div>

                {/* Year Left School */}
                <div className="sm:col-span-1">
                  <label htmlFor="yearLeftSchool" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                    Year Left School *
                  </label>
                  <SelectDropdown
                    id="yearLeftSchool"
                    name="yearLeftSchool"
                    options={YEAR_OPTIONS}
                    value={formData.yearLeftSchool}
                    onChange={(val) => setFormData(prev => ({ ...prev, yearLeftSchool: val }))}
                    placeholder="Select graduation year"
                    icon={<School className="w-4 h-4" />}
                  />
                  {formData.yearLeftSchool === '' && (
                     <div className="text-[10px] text-slate-500 mt-1">Required</div>
                  )}
                </div>

                {/* Occupation */}
                <div className="sm:col-span-1">
                  <label htmlFor="occupation" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                    Occupation *
                  </label>
                  <SelectDropdown
                    id="occupation"
                    name="occupation"
                    options={OCCUPATION_OPTIONS}
                    value={formData.occupation}
                    onChange={(val) => setFormData(prev => ({ ...prev, occupation: val }))}
                    placeholder="Select your occupation"
                    searchable
                    icon={<Briefcase className="w-4 h-4" />}
                  />
                  {formData.occupation === '' && (
                     <div className="text-[10px] text-slate-500 mt-1">Required</div>
                  )}
                </div>

                {/* Conditional Fields based on Occupation */}
                {formData.occupation === 'Other' && (
                  <div className="sm:col-span-2">
                    <label htmlFor="otherOccupation" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                      Please specify your occupation *
                    </label>
                    <input
                      id="otherOccupation"
                      name="otherOccupation"
                      type="text"
                      required
                      placeholder="Enter occupation"
                      value={formData.otherOccupation}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                    />
                  </div>
                )}

                {formData.occupation === 'Student' && (
                  <>
                    <div className="sm:col-span-1">
                      <label htmlFor="university" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                        Current Institution / University *
                      </label>
                      <input
                        id="university"
                        name="university"
                        type="text"
                        required
                        placeholder="e.g. Makerere University"
                        value={formData.university}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label htmlFor="course" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                        Course of Study *
                      </label>
                      <SelectDropdown
                        id="course"
                        name="course"
                        options={COURSE_OPTIONS}
                        value={formData.course}
                        onChange={(val) => setFormData(prev => ({ ...prev, course: val }))}
                        placeholder="Select course"
                        icon={<Briefcase className="w-4 h-4" />}
                      />
                    </div>
                  </>
                )}

                {/* District of Origin */}
                <div className="sm:col-span-1">
                  <label htmlFor="district" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                    District of Origin *
                  </label>
                  <SelectDropdown
                    id="district"
                    name="district"
                    options={DISTRICT_OPTIONS}
                    value={formData.district}
                    onChange={(val) => setFormData(prev => ({ ...prev, district: val }))}
                    placeholder="Select your district"
                    searchable
                    icon={<MapPin className="w-4 h-4" />}
                  />
                  {formData.district === '' && (
                     <div className="text-[10px] text-slate-500 mt-1">Required</div>
                  )}
                </div>

                {/* Place of Residence */}
                <div className="sm:col-span-2">
                  <label htmlFor="placeOfResidence" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 uppercase tracking-wider">
                    Current Place of Residence
                  </label>
                  <input
                    id="placeOfResidence"
                    name="placeOfResidence"
                    type="text"
                    placeholder="e.g. Ntinda, Kampala"
                    value={formData.placeOfResidence}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                  />
                </div>

              </div>

              {/* Navigation Buttons */}
              <div className="pt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="w-1/3 py-3.5 px-4 rounded-full border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={handleNextStep2}
                  className="w-2/3 py-3.5 px-6 rounded-full bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-bold text-sm shadow-xl hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continue to Final Step</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          )}

          {/* ================= STEP 3: FINALIZE ================= */}
          {currentStep === 3 && (
            <form onSubmit={handleSubmitRegistration} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              
              <div className="text-center sm:text-left">
                <h2 className="text-2xl sm:text-3xl font-serif font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Almost There!
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Just a few more details to keep your account secure.
                </p>
              </div>

              {/* Next of Kin Details */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> Next of Kin Information
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="nextOfKinName" className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                      Next of Kin Name *
                    </label>
                    <input
                      id="nextOfKinName"
                      name="nextOfKinName"
                      type="text"
                      required
                      placeholder="e.g. Mary Okello"
                      value={formData.nextOfKinName}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="nextOfKinPhone" className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase">
                      Next of Kin Phone *
                    </label>
                    <input
                      id="nextOfKinPhone"
                      name="nextOfKinPhone"
                      type="tel"
                      required
                      placeholder="+256 770 000000"
                      value={formData.nextOfKinPhone}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Profile Photo Upload */}
              <div className="flex items-center gap-5 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                <div className="relative group shrink-0">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-amber-500/40 flex items-center justify-center overflow-hidden shadow-inner">
                    {profilePicPreview ? (
                      <img src={profilePicPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-8 h-8 text-slate-400" />
                    )}
                  </div>
                  <label 
                    htmlFor="profilePic"
                    className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center cursor-pointer shadow-md hover:scale-110 transition-transform"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </label>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Profile Picture</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Add a clear photo (Optional, helps admin verify your identity).</p>
                  <label htmlFor="profilePic" className="inline-block text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline mt-1 cursor-pointer">
                    {profilePicFile ? 'Change image' : 'Upload photo'}
                  </label>
                  <input 
                    type="file" 
                    id="profilePic"
                    accept="image/*" 
                    onChange={handleFileChange} 
                    className="hidden" 
                  />
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40">
                <input
                  id="terms"
                  type="checkbox"
                  required
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 text-amber-500 focus:ring-amber-500 rounded border-slate-300 dark:border-slate-700 cursor-pointer"
                />
                <label htmlFor="terms" className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed cursor-pointer">
                  I agree to the <Link to="/terms" target="_blank" className="font-bold text-amber-600 dark:text-amber-400 hover:underline">Terms of Service</Link> and <Link to="/privacy" target="_blank" className="font-bold text-amber-600 dark:text-amber-400 hover:underline">Privacy Policy</Link> of the Matuumu Alumni Mutual Aid Association.
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="w-1/3 py-3.5 px-4 rounded-full border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-2/3 py-4 px-6 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm shadow-xl hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <span>Creating Account...</span>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 fill-slate-950" />
                      <span>Complete Registration</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          )}

          {/* ================= SUCCESS STATE ================= */}
          {currentStep === 'success' && (
            <div className="py-8 px-4 text-center max-w-md mx-auto space-y-6 animate-in fade-in zoom-in duration-300">
              
              {/* Animated Success Badge */}
              <div className="relative inline-flex items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center shadow-2xl animate-bounce">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                </div>
              </div>

              <div>
                <h2 className="text-3xl font-serif font-extrabold text-slate-900 dark:text-white">
                  Welcome to MAMAS!
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                  Your account has been created successfully and is currently under review by our executive committee.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  You will receive an email notification once approved.
                </p>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => navigate('/pending-approval')}
                  className="w-full py-4 px-8 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Check Account Status</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          )}

        </div>

        {/* Footer info */}
        {currentStep !== 'success' && (
          <div className="px-6 py-4 bg-slate-100/70 dark:bg-slate-900/80 border-t border-slate-200/80 dark:border-slate-800 text-center text-xs text-slate-500 flex items-center justify-between">
            <span>Already registered? <Link to="/login" className="font-bold text-amber-600 dark:text-amber-400 hover:underline">Log In</Link></span>
            <span className="flex items-center gap-1 text-[11px]"><ShieldCheck className="w-3.5 h-3.5 text-amber-500" /> Secure Member Portal</span>
          </div>
        )}

      </div>
    </div>
  );
}
