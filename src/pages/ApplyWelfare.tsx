import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { submitWelfareRequest } from '../lib/services';
import { AppSettings } from '../types';
import { formatUGX } from '../lib/utils';
import { Heart, ArrowLeft, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';

export default function ApplyWelfare() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  
  const [formData, setFormData] = useState({
    category: '',
    relationship: '',
    personName: '',
    district: '',
    villageTown: '',
    description: '',
    amountRequested: '',
    recipientPhoneNumber: '',
    recipientName: '',
    recipientNetwork: 'MTN'
  });
  
  const [evidenceFiles, setEvidenceFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const docSnap = await getDoc(doc(db, 'appSettings', 'main'));
      if (docSnap.exists()) {
        setSettings({ id: 'main', ...docSnap.data() } as AppSettings);
      } else {
        setSettings({
          id: 'main',
          welfareCategories: ['Bereavement', 'Medical Emergency', 'Wedding'],
          allowedRelationships: ['Self', 'Spouse', 'Child', 'Parent'],
          maxAmounts: {},
          welfareApprovers: [],
          showTotalBalanceToMembers: false,
          showTopContributors: false,
          minimumWeeklyContribution: 5000
        });
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEvidenceFiles(e.target.files);
  };

  const maxAllowedForCategory = formData.category && settings?.maxAmounts?.[formData.category]
    ? settings.maxAmounts[formData.category]
    : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const amount = parseInt(formData.amountRequested, 10);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount requested.");
      return;
    }

    if (!formData.category || !formData.relationship) {
      setError("Please select a valid welfare category and relationship.");
      return;
    }

    if (!formData.recipientPhoneNumber || formData.recipientPhoneNumber.trim() === "") {
      setError("Please provide the Mobile Money number that will receive the funds.");
      return;
    }

    const phoneRegex = /^(?:\+?256|0)?(7[012578]\d{7})$/;
    const cleanPhone = formData.recipientPhoneNumber.replace(/\s+/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      setError("Please enter a valid Ugandan Mobile Money phone number (e.g., 0772123456 or +256772123456).");
      return;
    }

    // Maximum amount validation
    if (maxAllowedForCategory && amount > maxAllowedForCategory) {
      setError(`The maximum allowed welfare payout for ${formData.category} is ${formatUGX(maxAllowedForCategory)}.`);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const evidenceUrls: string[] = [];
      
      if (evidenceFiles) {
        for (let i = 0; i < evidenceFiles.length; i++) {
          const file = evidenceFiles[i];
          const fileRef = ref(storage, `welfare_evidence/${currentUser.uid}_${Date.now()}_${file.name}`);
          await uploadBytes(fileRef, file);
          const url = await getDownloadURL(fileRef);
          evidenceUrls.push(url);
        }
      }

      await submitWelfareRequest(currentUser.uid, {
        ...formData,
        amountRequested: amount,
        evidenceUrls
      });

      setIsSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to submit welfare application.');
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="max-w-md mx-auto pt-8 pb-16 animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 rounded-full flex items-center justify-center mb-5 border border-teal-200 dark:border-teal-900/50">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-display font-bold text-mamas-text dark:text-white mb-2">Application Submitted!</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
            Your welfare request has been successfully submitted and is now pending review by the Welfare Committee. You will be notified once a decision is made.
          </p>

          <div className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 mb-6 text-left space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-medium">Category</span>
              <span className="font-bold text-mamas-text dark:text-white capitalize">{formData.category}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-medium">Amount Requested</span>
              <span className="font-bold text-mamas-text dark:text-white">UGX {new Intl.NumberFormat('en-UG').format(parseInt(formData.amountRequested, 10))}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-medium">Recipient Name</span>
              <span className="font-bold text-mamas-text dark:text-white capitalize">{formData.recipientName || 'Not provided'}</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/welfare')}
            className="w-full bg-mamas-primary hover:bg-mamas-primary-hover text-white font-bold py-3.5 px-6 rounded-2xl transition-colors shadow-md flex items-center justify-center"
          >
            Go to Welfare Directory
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <button 
            onClick={() => navigate('/welfare')} 
            className="text-xs font-semibold text-mamas-primary hover:text-mamas-primary-hover flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Welfare
          </button>
          <h2 className="text-2xl font-display font-bold text-mamas-text flex items-center gap-2">
            <Heart className="w-6 h-6 text-rose-500" /> Apply for Welfare Aid
          </h2>
          <p className="text-mamas-text-muted text-sm mt-1">Submit a financial aid request for review by the Welfare Committee.</p>
        </div>
      </div>

      <div className="bg-mamas-card rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-sm font-medium flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="category" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Welfare Category <span className="text-rose-500">*</span>
                </label>
                <select
                  id="category"
                  name="category"
                  required
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-mamas-text focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-mamas-accent outline-none"
                >
                  <option value="">-- Select Category --</option>
                  {settings?.welfareCategories?.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="relationship" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Beneficiary Relationship <span className="text-rose-500">*</span>
                </label>
                <select
                  id="relationship"
                  name="relationship"
                  required
                  value={formData.relationship}
                  onChange={handleChange}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-mamas-text focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-mamas-accent outline-none"
                >
                  <option value="">-- Select Relationship --</option>
                  {settings?.allowedRelationships?.map(rel => (
                    <option key={rel} value={rel}>{rel}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="personName" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Beneficiary Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="personName"
                  id="personName"
                  required
                  placeholder="Full name of beneficiary"
                  value={formData.personName}
                  onChange={handleChange}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-mamas-text focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-mamas-accent outline-none"
                />
              </div>

              <div>
                <label htmlFor="amountRequested" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Amount Requested (UGX) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  name="amountRequested"
                  id="amountRequested"
                  required
                  min="1000"
                  placeholder="e.g. 500000"
                  value={formData.amountRequested}
                  onChange={handleChange}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-mamas-text focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-mamas-accent outline-none"
                />
                {maxAllowedForCategory !== undefined && (
                  <p className="mt-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 inline-block">
                    Maximum limit for {formData.category}: <span className="font-bold">{formatUGX(maxAllowedForCategory)}</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="district" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  District (Event Location) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="district"
                  id="district"
                  required
                  placeholder="e.g. Kampala, Mukono..."
                  value={formData.district}
                  onChange={handleChange}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-mamas-text focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-mamas-accent outline-none"
                />
              </div>

              <div>
                <label htmlFor="villageTown" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Village / Town <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="villageTown"
                  id="villageTown"
                  required
                  placeholder="e.g. Matuumu Village"
                  value={formData.villageTown}
                  onChange={handleChange}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-mamas-text focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-mamas-accent outline-none"
                />
              </div>
            </div>

            <div className="bg-amber-50/60 p-6 rounded-2xl border border-amber-200/80 space-y-4">
              <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wider flex items-center gap-2">
                Mobile Money Payout Details
              </h3>
              <p className="text-xs text-amber-700">Provide the Mobile Money account where funds should be sent upon committee approval.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label htmlFor="recipientNetwork" className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Network <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="recipientNetwork"
                    name="recipientNetwork"
                    value={formData.recipientNetwork}
                    onChange={handleChange}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm font-semibold text-mamas-text focus:ring-2 focus:ring-mamas-accent outline-none"
                  >
                    <option value="MTN">MTN Mobile Money</option>
                    <option value="Airtel">Airtel Money</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="recipientPhoneNumber" className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Mobile Money Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="recipientPhoneNumber"
                    id="recipientPhoneNumber"
                    required
                    placeholder="e.g. 0772123456 or +256772123456"
                    value={formData.recipientPhoneNumber}
                    onChange={handleChange}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold text-mamas-text focus:ring-2 focus:ring-mamas-accent outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="recipientName" className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Name Registered on Number <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  name="recipientName"
                  id="recipientName"
                  placeholder="e.g. Namubiru Sarah"
                  value={formData.recipientName}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-mamas-text focus:ring-2 focus:ring-mamas-accent outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Description / Details <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                required
                value={formData.description}
                onChange={handleChange}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-sm font-medium text-mamas-text focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-mamas-accent outline-none"
                placeholder="Provide detailed circumstances surrounding this welfare request..."
              />
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-mamas-primary" /> Supporting Evidence (Certificates, Receipts, Medical Reports)
              </label>
              <input 
                type="file" 
                multiple 
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="mt-1 block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-mamas-primary file:text-white hover:file:bg-mamas-primary-hover transition-colors" 
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto bg-mamas-primary hover:bg-mamas-primary-hover text-white py-3 px-8 rounded-xl font-bold shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? 'Submitting Application...' : 'Submit Application'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
