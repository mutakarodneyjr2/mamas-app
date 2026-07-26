import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { completeProfile } from '../lib/auth';
import { setPin } from '../lib/auth-pin';
import { LogoLarge } from '../components/Logo';
import { Phone, ArrowRight, KeyRound } from 'lucide-react';

type RegisterStep = 'phone' | 'otp' | 'profile' | 'success';

export default function Register() {
  const { currentUser, userProfile, logout, sendOtp, verifyOtp, setupRecaptcha } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState<RegisterStep>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    yearLeftSchool: '',
    district: '',
    placeOfResidence: '',
    occupation: '',
    nextOfKinName: '',
    nextOfKinPhone: '',
    showPhone: true,
    showEmail: true,
    pin: '',
    confirmPin: ''
  });

  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);

  useEffect(() => {
    // Setup recaptcha when on phone step
    if (step === 'phone') {
      setupRecaptcha('recaptcha-register');
    }
  }, [step, setupRecaptcha]);

  useEffect(() => {
    // If the user already has a profile and they load this page, send them to dashboard
    if (userProfile && step === 'phone') {
      navigate('/dashboard');
    }
  }, [userProfile, navigate, step]);

  useEffect(() => {
    // If they magically got currentUser (e.g. from previous session) but no profile, skip to profile step
    if (currentUser && !userProfile && step === 'phone') {
      setStep('profile');
    }
  }, [currentUser, userProfile, step]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let formattedPhone = phoneNumber;
      if (formattedPhone.startsWith('0')) formattedPhone = '+256' + formattedPhone.substring(1);
      else if (!formattedPhone.startsWith('+')) formattedPhone = '+' + formattedPhone;
      
      await sendOtp(formattedPhone, 'recaptcha-register');
      setStep('otp');
    } catch (err: any) {
      console.error(err);
      setError('Failed to send verification code. Please check your number and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verifyOtp(otp);
      setStep('profile');
    } catch (err: any) {
      console.error(err);
      setError('Failed to verify code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (formData.pin.length < 4 || formData.pin.length > 6) {
      setError("PIN must be between 4 and 6 digits");
      return;
    }
    
    if (formData.pin !== formData.confirmPin) {
      setError("PINs do not match");
      return;
    }
    
    setLoading(true);
    
    try {
      if (!currentUser) throw new Error("Not authenticated");
      
      await completeProfile(
        currentUser.uid,
        currentUser.phoneNumber || '',
        {
          fullName: formData.fullName,
          email: formData.email,
          yearLeftSchool: formData.yearLeftSchool,
          district: formData.district,
          placeOfResidence: formData.placeOfResidence,
          occupation: formData.occupation,
          nextOfKinName: formData.nextOfKinName,
          nextOfKinPhone: formData.nextOfKinPhone,
          privacySettings: {
            showPhone: formData.showPhone,
            showEmail: formData.showEmail
          }
        },
        profilePicFile || undefined
      );
      
      // Set the PIN using synthetic email/password
      await setPin(currentUser.uid, currentUser.phoneNumber || '', formData.pin);
      
      setStep('success');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to complete registration.');
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
          
          {step === 'phone' && (
            <div className="px-6 py-8 sm:p-10 max-w-md mx-auto">
              <h2 className="text-2xl font-display font-bold text-mamas-primary text-center mb-6">Create Your Account</h2>
              {error && (
                <div className="mb-6 bg-rose-50 border-l-4 border-mamas-danger text-mamas-danger px-4 py-3 rounded-r text-sm font-medium shadow-sm">
                  {error}
                </div>
              )}
              <form className="space-y-6" onSubmit={handleSendOtp}>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-700">Phone Number</label>
                  <div className="mt-2 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      id="phone"
                      type="tel"
                      required
                      placeholder="+256 700 000000"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="appearance-none block w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-mamas-primary sm:text-base transition-colors"
                    />
                  </div>
                </div>

                <div id="recaptcha-register" className="flex justify-center"></div>

                <div className="flex items-start">
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

                <button
                  type="submit"
                  disabled={loading || !phoneNumber || !agreedToTerms}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-full shadow-md text-sm font-medium text-white bg-mamas-primary hover:bg-mamas-primary-hover disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Sending OTP...' : 'Continue'}
                </button>
                
                <div className="text-center mt-6 text-sm text-slate-600">
                  Already a member? <Link to="/login" className="font-semibold text-mamas-accent hover:text-mamas-accent-hover transition-colors">Log In</Link>
                </div>
              </form>
            </div>
          )}

          {step === 'otp' && (
            <div className="px-6 py-8 sm:p-10 max-w-md mx-auto">
              <h2 className="text-2xl font-display font-bold text-mamas-primary text-center mb-6">Verify Your Number</h2>
              {error && (
                <div className="mb-6 bg-rose-50 border-l-4 border-mamas-danger text-mamas-danger px-4 py-3 rounded-r text-sm font-medium shadow-sm">
                  {error}
                </div>
              )}
              <form className="space-y-6" onSubmit={handleVerifyOtp}>
                <div>
                  <label htmlFor="otp" className="block text-sm font-medium text-slate-700 text-center">
                    Enter Verification Code sent to {phoneNumber}
                  </label>
                  <div className="mt-4">
                    <input
                      id="otp"
                      type="text"
                      required
                      maxLength={6}
                      autoFocus
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="appearance-none block w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-mamas-primary sm:text-lg tracking-[0.5em] font-mono text-center transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-full shadow-md text-sm font-medium text-white bg-mamas-primary hover:bg-mamas-primary-hover disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Verifying...' : 'Verify'}
                </button>
                
                <div className="text-center mt-6">
                  <button type="button" onClick={() => setStep('phone')} className="text-sm font-medium text-slate-500 hover:text-mamas-primary">
                    Use a different phone number
                  </button>
                </div>
              </form>
            </div>
          )}

          {step === 'profile' && (
            <>
              <div className="px-6 py-6 border-b border-slate-100 sm:px-10 flex justify-between items-center bg-white/50 backdrop-blur-sm">
                <div>
                  <h3 className="text-2xl font-display font-bold text-mamas-primary tracking-tight">Complete Your Profile</h3>
                  <p className="text-sm text-mamas-text-muted mt-1">Tell us more about yourself to join the community.</p>
                </div>
                <button onClick={async () => { await logout(); setStep('phone'); }} className="text-sm font-medium text-mamas-accent hover:text-mamas-accent-hover transition-colors">Cancel</button>
              </div>
              
              <div className="px-6 py-8 sm:p-10">
                <form onSubmit={handleSubmitProfile} className="space-y-8">
                  {error && (
                    <div className="bg-rose-50 border-l-4 border-mamas-danger text-mamas-danger px-4 py-3 rounded-r text-sm font-medium shadow-sm">
                      {error}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-slate-700">Phone Number (Verified)</label>
                      <div className="mt-2">
                        <input type="text" disabled value={currentUser?.phoneNumber || phoneNumber} className="appearance-none block w-full px-4 py-3 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 sm:text-sm font-medium cursor-not-allowed" />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="fullName" className="block text-sm font-medium text-slate-700">Full Name</label>
                      <div className="mt-2">
                        <input type="text" name="fullName" id="fullName" required value={formData.fullName} onChange={handleChange} className="appearance-none block w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-mamas-primary focus:border-transparent sm:text-sm transition-colors" />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email Address <span className="text-slate-400 font-normal">(Optional)</span></label>
                      <div className="mt-2">
                        <input type="email" name="email" id="email" value={formData.email} onChange={handleChange} className="appearance-none block w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-mamas-primary focus:border-transparent sm:text-sm transition-colors" />
                      </div>
                    </div>

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
                    <h4 className="text-lg font-display font-semibold text-mamas-primary mb-6">Security (PIN)</h4>
                    <p className="text-sm text-slate-500 mb-6">Create a 4 to 6 digit PIN to log in securely next time without waiting for SMS codes.</p>
                    <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2">
                      <div>
                        <label htmlFor="pin" className="block text-sm font-medium text-slate-700">Create PIN</label>
                        <div className="mt-2">
                          <input type="password" inputMode="numeric" pattern="[0-9]{4,6}" name="pin" id="pin" required value={formData.pin} onChange={handleChange} placeholder="4-6 digits" className="appearance-none block w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-mamas-primary focus:border-transparent sm:text-sm transition-colors" />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="confirmPin" className="block text-sm font-medium text-slate-700">Confirm PIN</label>
                        <div className="mt-2">
                          <input type="password" inputMode="numeric" pattern="[0-9]{4,6}" name="confirmPin" id="confirmPin" required value={formData.confirmPin} onChange={handleChange} placeholder="Re-enter PIN" className="appearance-none block w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-mamas-primary focus:border-transparent sm:text-sm transition-colors" />
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
                        ) : (
                          <span className="text-slate-400 text-2xl font-bold uppercase">{formData.fullName ? formData.fullName[0] : 'U'}</span>
                        )}
                      </div>
                      <input type="file" accept="image/*" onChange={handleFileChange} className="appearance-none block text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-mamas-primary file:text-white hover:file:bg-mamas-primary-hover transition-colors cursor-pointer" />
                    </div>
                  </div>
                  
                  <div className="pt-6">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full sm:w-auto sm:min-w-[200px] flex justify-center items-center py-3.5 px-6 border border-transparent rounded-full shadow-md text-base font-medium text-white bg-mamas-primary hover:bg-mamas-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mamas-primary disabled:opacity-50 transition-all mx-auto"
                    >
                      {loading ? 'Submitting...' : 'Complete Registration'}
                    </button>
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

