import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { LogoLarge } from '../components/Logo';
import { Phone, ArrowRight, Mail, KeyRound } from 'lucide-react';
import { UserProfile } from '../types';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

type RegisterStep = 'form' | 'success';

export default function Register() {
  const { currentUser, userProfile, googleSignIn, checkUserExists, logout } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState<RegisterStep>('form');
  
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
    nextOfKinName: '',
    nextOfKinPhone: '',
    showPhone: true,
    showEmail: true
  });

  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [profilePicUrl, setProfilePicUrl] = useState<string>('');

  useEffect(() => {
    if (userProfile && step === 'form') {
      navigate('/dashboard');
    }
  }, [userProfile, navigate, step]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProfilePicFile(e.target.files[0]);
    }
  };

  const uploadProfilePic = async (uid: string, file: File): Promise<string> => {
    try {
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('../firebase');
      const ext = file.name.split('.').pop() || 'jpg';
      const storageRef = ref(storage, `users/${uid}/profile.${ext}`);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (err) {
      console.error("Failed to upload profile picture:", err);
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
        // User already exists, they will be redirected to dashboard by AuthContext/useEffect
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
        setProfilePicUrl(cred.user.photoURL);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-blocked') {
        setError('Please allow popups for this site to sign in with Google.');
      } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setError('Failed to sign in with Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (authProvider === 'email') {
      if (formData.password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }
      
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match");
        return;
      }
    }

    if (!agreedToTerms) {
      setError("You must agree to the Terms of Service");
      return;
    }
    
    setLoading(true);
    
    try {
      let uid = googleUid;
      let finalProfilePicUrl = profilePicUrl;

      if (authProvider === 'email') {
        // 1. Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        uid = userCredential.user.uid;
      }

      if (!uid) {
        throw new Error("No valid user ID found.");
      }

      // 2. Upload profile pic if provided
      if (profilePicFile) {
        finalProfilePicUrl = await uploadProfilePic(uid, profilePicFile);
      }

      // 3. Create profile in Firestore
      const newProfile: Partial<UserProfile> = {
        uid,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        fullName: formData.fullName,
        yearLeftSchool: parseInt(formData.yearLeftSchool, 10) || 0,
        district: formData.district,
        placeOfResidence: formData.placeOfResidence,
        occupation: formData.occupation,
        nextOfKinName: formData.nextOfKinName,
        nextOfKinPhone: formData.nextOfKinPhone,
        profilePictureUrl: finalProfilePicUrl,
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
      
      setStep('success');
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

  const currentYear = new Date().getFullYear();
  const years = Array.from(new Array(currentYear - 1980 + 1), (val, index) => currentYear - index);

  return (
    <div className="min-h-screen bg-mamas-bg flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-mamas-accent opacity-10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-mamas-primary opacity-5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-3xl z-10 relative">
        <div className="text-center mb-8">
          <LogoLarge className="scale-75 origin-center mx-auto" />
        </div>
        
        <div className="bg-mamas-card rounded-2xl shadow-xl shadow-mamas-primary/5 border border-slate-100 overflow-hidden">
          
          {step === 'form' && (
            <>
              <div className="px-6 py-6 border-b border-slate-100 sm:px-10 flex flex-col items-center bg-white/50 backdrop-blur-sm text-center">
                <h3 className="text-2xl font-display font-bold text-mamas-primary tracking-tight">Create Your Account</h3>
                <p className="text-sm text-mamas-text-muted mt-1">Tell us more about yourself to join the community.</p>
              </div>
              
              <div className="px-6 py-8 sm:p-10">
                {authProvider === 'email' && (
                  <div className="mb-8">
                    <GoogleSignInButton
                      mode="register"
                      onClick={handleGoogleSignUp}
                      loading={loading}
                    />
                    <div className="relative mt-8">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-mamas-card text-slate-500 font-medium">— OR —</span>
                      </div>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmitProfile} className="space-y-8">
                  {error && (
                    <div className="bg-rose-50 border-l-4 border-mamas-danger text-mamas-danger px-4 py-3 rounded-r text-sm font-medium shadow-sm">
                      {error}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label htmlFor="fullName" className="block text-sm font-medium text-slate-700">Full Name</label>
                      <div className="mt-2">
                        <input type="text" name="fullName" id="fullName" required value={formData.fullName} onChange={handleChange} className="appearance-none block w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-mamas-primary focus:border-transparent sm:text-sm transition-colors" />
                      </div>
                    </div>

                    <div className="sm:col-span-2 md:col-span-1">
                      <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email Address</label>
                      <div className="mt-2 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Mail className="h-5 w-5 text-slate-400" />
                        </div>
                        <input type="email" name="email" id="email" required value={formData.email} onChange={handleChange} disabled={authProvider === 'google'} className="appearance-none block w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-mamas-primary focus:border-transparent sm:text-sm transition-colors disabled:bg-slate-50 disabled:text-slate-500" />
                      </div>
                    </div>
                    
                    <div className="sm:col-span-2 md:col-span-1">
                      <label htmlFor="phoneNumber" className="block text-sm font-medium text-slate-700">Phone Number</label>
                      <div className="mt-2 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Phone className="h-5 w-5 text-slate-400" />
                        </div>
                        <input type="tel" name="phoneNumber" id="phoneNumber" required value={formData.phoneNumber} onChange={handleChange} placeholder="+256 700 000000" className="appearance-none block w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-mamas-primary focus:border-transparent sm:text-sm transition-colors" />
                      </div>
                    </div>

                    {authProvider === 'email' && (
                      <>
                        <div>
                          <label htmlFor="password" className="block text-sm font-medium text-slate-700">Password</label>
                          <div className="mt-2 relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <KeyRound className="h-5 w-5 text-slate-400" />
                            </div>
                            <input type="password" name="password" id="password" required value={formData.password} onChange={handleChange} placeholder="Min 6 characters" className="appearance-none block w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-mamas-primary focus:border-transparent sm:text-sm transition-colors" />
                          </div>
                        </div>

                        <div>
                          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">Confirm Password</label>
                          <div className="mt-2 relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <KeyRound className="h-5 w-5 text-slate-400" />
                            </div>
                            <input type="password" name="confirmPassword" id="confirmPassword" required value={formData.confirmPassword} onChange={handleChange} placeholder="Re-enter password" className="appearance-none block w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-mamas-primary focus:border-transparent sm:text-sm transition-colors" />
                          </div>
                        </div>
                      </>
                    )}

                    <div>
                      <label htmlFor="yearLeftSchool" className="block text-sm font-medium text-slate-700">Year Left School</label>
                      <div className="mt-2">
                        <select
                          name="yearLeftSchool"
                          id="yearLeftSchool"
                          required
                          value={formData.yearLeftSchool}
                          onChange={handleChange}
                          className="block w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-mamas-primary focus:border-transparent sm:text-sm transition-colors bg-white"
                        >
                          <option value="" disabled>Select a year</option>
                          {years.map(year => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="occupation" className="block text-sm font-medium text-slate-700">Occupation</label>
                      <div className="mt-2">
                        <input type="text" name="occupation" id="occupation" required value={formData.occupation} onChange={handleChange} className="appearance-none block w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-mamas-primary focus:border-transparent sm:text-sm transition-colors" />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="district" className="block text-sm font-medium text-slate-700">District of Origin</label>
                      <div className="mt-2">
                        <input type="text" name="district" id="district" required value={formData.district} onChange={handleChange} className="appearance-none block w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-mamas-primary focus:border-transparent sm:text-sm transition-colors" />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="placeOfResidence" className="block text-sm font-medium text-slate-700">Current Place of Residence</label>
                      <div className="mt-2">
                        <input type="text" name="placeOfResidence" id="placeOfResidence" required value={formData.placeOfResidence} onChange={handleChange} className="appearance-none block w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-mamas-primary focus:border-transparent sm:text-sm transition-colors" />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-8 mt-8">
                    <h4 className="text-lg font-display font-semibold text-mamas-primary mb-6">Next of Kin Details</h4>
                    <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2">
                      <div>
                        <label htmlFor="nextOfKinName" className="block text-sm font-medium text-slate-700">Next of Kin Name</label>
                        <div className="mt-2">
                          <input type="text" name="nextOfKinName" id="nextOfKinName" required value={formData.nextOfKinName} onChange={handleChange} className="appearance-none block w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-mamas-primary focus:border-transparent sm:text-sm transition-colors" />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="nextOfKinPhone" className="block text-sm font-medium text-slate-700">Next of Kin Phone</label>
                        <div className="mt-2">
                          <input type="tel" name="nextOfKinPhone" id="nextOfKinPhone" required value={formData.nextOfKinPhone} onChange={handleChange} className="appearance-none block w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-mamas-primary focus:border-transparent sm:text-sm transition-colors" />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t border-slate-100 pt-8 mt-8">
                    <h4 className="text-lg font-display font-semibold text-mamas-primary mb-6">Profile Picture</h4>
                    <div className="mt-2 flex items-center gap-4">
                      <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                        {profilePicFile ? (
                          <img src={URL.createObjectURL(profilePicFile)} alt="Preview" className="h-full w-full object-cover" />
                        ) : profilePicUrl ? (
                          <img src={profilePicUrl} alt="Google Profile" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-slate-400 text-2xl font-bold uppercase">{formData.fullName ? formData.fullName[0] : 'U'}</span>
                        )}
                      </div>
                      <input type="file" accept="image/*" onChange={handleFileChange} className="appearance-none block text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-mamas-primary file:text-white hover:file:bg-mamas-primary-hover transition-colors cursor-pointer" />
                    </div>
                  </div>

                  <div className="flex items-start mt-6">
                    <div className="flex items-center h-5">
                      <input
                        id="terms"
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="focus:ring-mamas-primary h-4 w-4 text-mamas-primary border-slate-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="terms" className="font-medium text-slate-700">
                        I agree to the <Link to="/terms" className="text-mamas-primary hover:underline">Terms of Service</Link> and <Link to="/privacy" className="text-mamas-primary hover:underline">Privacy Policy</Link>
                      </label>
                    </div>
                  </div>
                  
                  <div className="pt-6">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex justify-center items-center py-3.5 px-6 border border-transparent rounded-full shadow-md text-base font-medium text-white bg-mamas-primary hover:bg-mamas-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mamas-primary disabled:opacity-50 transition-all"
                    >
                      {loading ? 'Creating Account...' : 'Complete Registration'}
                    </button>
                  </div>
                  
                  <div className="text-center mt-6 text-sm text-slate-600">
                    Already a member? <Link to="/login" className="font-semibold text-mamas-accent hover:text-mamas-accent-hover transition-colors">Log In</Link>
                  </div>
                </form>
              </div>
            </>
          )}

          {step === 'success' && (
            <div className="px-6 py-12 sm:p-14 text-center max-w-lg mx-auto">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <ArrowRight className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-3xl font-display font-bold text-mamas-primary mb-4">Registration Submitted!</h2>
              <p className="text-slate-600 text-lg mb-8">
                Your profile has been created successfully. Please wait for an administrator to approve your account. You will receive an email notification once approved.
              </p>
              <Link
                to="/"
                onClick={() => logout()}
                className="inline-flex justify-center py-3 px-8 border border-transparent rounded-full shadow-md text-base font-medium text-white bg-mamas-primary hover:bg-mamas-primary-hover transition-colors"
              >
                Return to Home
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

