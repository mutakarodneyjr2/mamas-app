import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { submitWelfareRequest } from '../lib/services';
import { AppSettings } from '../types';
import { formatUGX } from '../lib/utils';
import { Heart, ArrowLeft, AlertCircle, FileText, CheckCircle2, MapPin, User, Shield, Phone, DollarSign } from 'lucide-react';
import { SelectDropdown } from '../components/SelectDropdown';
import { UGANDAN_DISTRICTS } from '../lib/constants';

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

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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

    if (!formData.district) {
      setError("Please select a valid district.");
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
      <div className="max-w-md mx-auto pt-4 pb-28 animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4 border border-emerald-200">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Application Submitted!</h2>
          <p className="text-slate-500 text-xs leading-relaxed mb-6">
            Your welfare request has been successfully submitted and is now under review by the Executive Welfare Committee.
          </p>

          <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-4 mb-6 text-left space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Category</span>
              <span className="font-bold text-slate-900 capitalize">{formData.category}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Amount Requested</span>
              <span className="font-bold text-slate-900">{formatUGX(parseInt(formData.amountRequested, 10))}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Location</span>
              <span className="font-bold text-slate-900 capitalize">{formData.district}, {formData.villageTown}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Recipient MoMo</span>
              <span className="font-bold text-slate-900">{formData.recipientPhoneNumber} ({formData.recipientNetwork})</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/welfare')}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-6 rounded-2xl transition-colors shadow-lg text-sm"
          >
            Go to Welfare Directory
          </button>
        </div>
      </div>
    );
  }

  const categoryOptions = (settings?.welfareCategories || ['Bereavement', 'Medical Emergency', 'Wedding']).map(c => ({
    label: c,
    value: c
  }));

  const relationshipOptions = (settings?.allowedRelationships || ['Self', 'Spouse', 'Child', 'Parent']).map(r => ({
    label: r,
    value: r
  }));

  const districtDropdownOptions = UGANDAN_DISTRICTS.map(d => ({
    label: d,
    value: d
  }));

  const networkOptions = [
    { label: 'MTN Mobile Money', value: 'MTN' },
    { label: 'Airtel Money', value: 'Airtel' }
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-28 animate-in fade-in duration-300">
      
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <button 
          onClick={() => navigate('/welfare')} 
          className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Welfare
        </button>
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center shrink-0">
            <Heart className="w-5 h-5 text-rose-400" fill="currentColor" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white">Apply for Emergency Welfare Aid</h1>
            <p className="text-slate-300 text-xs mt-0.5">Official relief request for review by the Association Welfare Committee.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* SECTION 1: BENEFICIARY & CATEGORY */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-500" /> Request Details & Beneficiary
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Welfare Category <span className="text-rose-500">*</span>
              </label>
              <SelectDropdown
                options={categoryOptions}
                value={formData.category}
                onChange={(val) => handleFieldChange('category', val)}
                placeholder="Select Welfare Category"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Beneficiary Relationship <span className="text-rose-500">*</span>
              </label>
              <SelectDropdown
                options={relationshipOptions}
                value={formData.relationship}
                onChange={(val) => handleFieldChange('relationship', val)}
                placeholder="Select Relationship"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Beneficiary Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Full name of beneficiary"
                value={formData.personName}
                onChange={(e) => handleFieldChange('personName', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Amount Requested (UGX) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-4 flex items-center text-slate-400 font-extrabold text-sm">UGX</span>
                <input
                  type="number"
                  required
                  min="1000"
                  placeholder="e.g. 500000"
                  value={formData.amountRequested}
                  onChange={(e) => handleFieldChange('amountRequested', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-16 pr-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white transition-all"
                />
              </div>
              {maxAllowedForCategory !== undefined && (
                <p className="mt-2 text-[11px] font-bold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 inline-block">
                  Maximum cap for {formData.category}: <strong>{formatUGX(maxAllowedForCategory)}</strong>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 2: LOCATION DETAILS WITH SEARCHABLE DISTRICT DROPDOWN */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-amber-500" /> Event Location
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                District <span className="text-rose-500">*</span>
              </label>
              <SelectDropdown
                options={districtDropdownOptions}
                value={formData.district}
                onChange={(val) => handleFieldChange('district', val)}
                placeholder="Select District"
                searchable
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Village / Town <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Matuumu Village, Kyebando..."
                value={formData.villageTown}
                onChange={(e) => handleFieldChange('villageTown', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white transition-all"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: MOBILE MONEY PAYOUT RECEIVER */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-2">
            <Phone className="w-4 h-4 text-amber-500" /> Payout Mobile Money Account
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Network <span className="text-rose-500">*</span>
                </label>
                <SelectDropdown
                  options={networkOptions}
                  value={formData.recipientNetwork}
                  onChange={(val) => handleFieldChange('recipientNetwork', val)}
                  placeholder="Network"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Mobile Money Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 0772123456"
                  value={formData.recipientPhoneNumber}
                  onChange={(e) => handleFieldChange('recipientPhoneNumber', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Registered Name on Account <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Namubiru Sarah"
                value={formData.recipientName}
                onChange={(e) => handleFieldChange('recipientName', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white transition-all"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: DESCRIPTION & EVIDENCE */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-500" /> Explanation & Supporting Evidence
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Detailed Circumstances <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={formData.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white transition-all"
                placeholder="Describe the emergency or circumstances surrounding this request..."
              />
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Attach Supporting Documents (Medical report, Death certificate, Invoices)
              </label>
              <input 
                type="file" 
                multiple 
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer transition-colors" 
              />
            </div>
          </div>
        </div>

        {/* SUBMIT BUTTON */}
        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 text-white rounded-full py-4 text-base font-bold shadow-xl hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Submitting Welfare Application...' : 'Submit Relief Application'}
          </button>
        </div>
      </form>
    </div>
  );
}
