import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, setDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { AppSettings, User } from '../types';
import { updateWelfareApprovers, logActivity } from '../lib/services';
import { formatUGX } from '../lib/utils';
import { Settings2, Plus, X, Shield, Eye, Image as ImageIcon, CheckCircle, AlertCircle, Save, Loader2, SunMedium, RotateCcw } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';

const checkIsDirty = (draft: AppSettings | null, server: AppSettings | null): boolean => {
  if (!draft || !server) return false;
  
  if (draft.minimumWeeklyContribution !== server.minimumWeeklyContribution) return true;
  if ((draft.supportPhone || '') !== (server.supportPhone || '')) return true;
  if ((draft.supportWhatsApp || '') !== (server.supportWhatsApp || '')) return true;
  if ((draft.supportEmail || '') !== (server.supportEmail || '')) return true;
  if (!!draft.showTotalBalanceToMembers !== !!server.showTotalBalanceToMembers) return true;
  if (!!draft.showTopContributors !== !!server.showTopContributors) return true;
  
  // Compare maxAmounts
  const draftMax = draft.maxAmounts || {};
  const serverMax = server.maxAmounts || {};
  const maxKeys = Array.from(new Set([...Object.keys(draftMax), ...Object.keys(serverMax)]));
  for (const k of maxKeys) {
    if ((draftMax[k] ?? 0) !== (serverMax[k] ?? 0)) return true;
  }
  
  // Compare welfareCategories
  if (JSON.stringify(draft.welfareCategories || []) !== JSON.stringify(server.welfareCategories || [])) return true;
  
  // Compare allowedRelationships
  if (JSON.stringify(draft.allowedRelationships || []) !== JSON.stringify(server.allowedRelationships || [])) return true;
  
  // Compare welfareApprovers
  if (JSON.stringify(draft.welfareApprovers || []) !== JSON.stringify(server.welfareApprovers || [])) return true;

  // Compare banners
  if (JSON.stringify(draft.banners || []) !== JSON.stringify(server.banners || [])) return true;

  return false;
};

export default function AdminSettings() {
  const { currentUser, userProfile } = useAuth();
  
  const [serverSettings, setServerSettings] = useState<AppSettings | null>(null);
  const [formData, setFormData] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const [committeeMembers, setCommitteeMembers] = useState<User[]>([]);
  
  const [newCategory, setNewCategory] = useState('');
  const [newRelationship, setNewRelationship] = useState('');
  const [newBannerUrl, setNewBannerUrl] = useState('');
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const isDirty = checkIsDirty(formData, serverSettings);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    // Real-time listener for appSettings/main
    const unsub = onSnapshot(doc(db, 'appSettings', 'main'), (snap) => {
      let fullSettings: AppSettings;
      if (snap.exists()) {
        const data = snap.data() as AppSettings;
        const currentBanners = data.banners || data.landingBanners || [];
        fullSettings = {
          id: 'main',
          welfareCategories: data.welfareCategories || ['Medical Emergency', 'Bereavement', 'Education Support', 'Wedding / Marriage', 'General Welfare'],
          allowedRelationships: data.allowedRelationships || ['Self', 'Spouse', 'Child', 'Parent', 'Sibling'],
          maxAmounts: data.maxAmounts || { 'Medical Emergency': 1000000, 'Bereavement': 800000, 'Education Support': 500000, 'Wedding / Marriage': 500000, 'General Welfare': 300000 },
          welfareApprovers: data.welfareApprovers || [],
          showTotalBalanceToMembers: data.showTotalBalanceToMembers !== undefined ? !!data.showTotalBalanceToMembers : true,
          showTopContributors: data.showTopContributors !== undefined ? !!data.showTopContributors : true,
          minimumWeeklyContribution: data.minimumWeeklyContribution || 5000,
          banners: currentBanners,
          landingBanners: currentBanners,
          supportPhone: data.supportPhone || '+256 770 000000',
          supportWhatsApp: data.supportWhatsApp || '+256 700 000000',
          supportEmail: data.supportEmail || 'support@mamas.org'
        };
      } else {
        fullSettings = {
          id: 'main',
          welfareCategories: ['Medical Emergency', 'Bereavement', 'Education Support', 'Wedding / Marriage', 'General Welfare'],
          allowedRelationships: ['Self', 'Spouse', 'Child', 'Parent', 'Sibling'],
          maxAmounts: { 'Medical Emergency': 1000000, 'Bereavement': 800000, 'Education Support': 500000, 'Wedding / Marriage': 500000, 'General Welfare': 300000 },
          welfareApprovers: [],
          showTotalBalanceToMembers: true,
          showTopContributors: true,
          minimumWeeklyContribution: 5000,
          banners: [],
          landingBanners: [],
          supportPhone: '+256 770 000000',
          supportWhatsApp: '+256 700 000000',
          supportEmail: 'support@mamas.org'
        };
      }

      setServerSettings(fullSettings);
      
      setFormData(prevForm => {
        // If initial load or user has no dirty local edits, sync formData with server
        if (!prevForm || !isDirtyRef.current) {
          return fullSettings;
        }
        return prevForm;
      });

      setLoading(false);
    });

    // Fetch committee members for Welfare Approvers selection
    const fetchCommittee = async () => {
      try {
        const q = query(
          collection(db, 'users'),
          where('role', 'in', ['super_admin', 'chairperson', 'vice_chairperson', 'secretary', 'treasurer', 'auditor', 'mobiliser'])
        );
        const snap = await getDocs(q);
        setCommitteeMembers(snap.docs.map(d => d.data() as User));
      } catch (err) {
        console.error(err);
      }
    };
    fetchCommittee();

    return () => unsub();
  }, []);

  if (!currentUser || !userProfile) return null;

  const isSuperAdmin = userProfile.role === 'super_admin';
  const isChairperson = userProfile.role === 'chairperson';
  const isViceChairperson = userProfile.role === 'vice_chairperson';
  const isTreasurer = userProfile.role === 'treasurer';

  if (!isSuperAdmin && !isChairperson && !isViceChairperson && !isTreasurer) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 my-8">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center mb-4 text-rose-500">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Access Denied</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm max-w-md">You do not have administrative permissions to view or edit system settings.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-500 dark:text-slate-400 font-medium">
      <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
      <span>Loading system configuration...</span>
    </div>
  );

  if (!formData) return (
    <div className="p-8 text-center text-rose-500 font-semibold bg-rose-50 dark:bg-rose-950/40 rounded-3xl border border-rose-200 dark:border-rose-900/60">
      Settings configuration object missing!
    </div>
  );

  const showNotification = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3500);
  };

  const handleDiscardChanges = () => {
    if (serverSettings) {
      setFormData(serverSettings);
      showNotification("Unsaved changes discarded.");
    }
  };

  const handleUpdateBoolean = async (field: keyof AppSettings, value: boolean) => {
    setFormData(prev => prev ? ({ ...prev, [field]: value }) : null);
    try {
      await setDoc(doc(db, 'appSettings', 'main'), { [field]: value }, { merge: true });
      await logActivity('UPDATE_SETTINGS', currentUser.uid, 'main', `Toggled ${field} to ${value}`);
      showNotification("Setting updated successfully.");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleApprover = async (uid: string) => {
    const approvers = formData?.welfareApprovers || [];
    const isCurrentlyApprover = approvers.includes(uid);
    let newApprovers = [...approvers];
    
    if (isCurrentlyApprover) {
      newApprovers = newApprovers.filter(id => id !== uid);
    } else {
      if (newApprovers.length >= 3) {
        setError("Maximum of 3 approvers allowed. Unselect one before adding another.");
        return;
      }
      newApprovers.push(uid);
    }

    setFormData(prev => prev ? ({ ...prev, welfareApprovers: newApprovers }) : null);

    try {
      await updateWelfareApprovers(currentUser.uid, newApprovers);
      showNotification("Welfare approvers updated successfully.");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const addCategory = async () => {
    if (!formData || !newCategory.trim()) return;
    const cat = newCategory.trim();
    if (formData.welfareCategories.includes(cat)) {
      setError("Category already exists.");
      return;
    }
    const updatedCategories = [...formData.welfareCategories, cat];
    const updatedMaxAmounts = { ...formData.maxAmounts, [cat]: formData.maxAmounts[cat] ?? 0 };

    setFormData(prev => prev ? ({
      ...prev,
      welfareCategories: updatedCategories,
      maxAmounts: updatedMaxAmounts
    }) : null);

    try {
      await setDoc(doc(db, 'appSettings', 'main'), {
        welfareCategories: updatedCategories,
        maxAmounts: updatedMaxAmounts
      }, { merge: true });
      await logActivity('UPDATE_SETTINGS', currentUser.uid, 'main', `Added welfare category: ${cat}`);
      setNewCategory('');
      showNotification("Category added.");
    } catch (err: any) { setError(err.message); }
  };

  const removeCategory = async (catToRemove: string) => {
    if (!formData) return;
    const updatedCategories = formData.welfareCategories.filter(c => c !== catToRemove);
    const updatedMaxAmounts = { ...formData.maxAmounts };
    delete updatedMaxAmounts[catToRemove];

    setFormData(prev => prev ? ({
      ...prev,
      welfareCategories: updatedCategories,
      maxAmounts: updatedMaxAmounts
    }) : null);

    try {
      await setDoc(doc(db, 'appSettings', 'main'), { 
        welfareCategories: updatedCategories,
        maxAmounts: updatedMaxAmounts
      }, { merge: true });
      await logActivity('UPDATE_SETTINGS', currentUser.uid, 'main', `Removed welfare category: ${catToRemove}`);
      showNotification("Category removed.");
    } catch (err: any) { setError(err.message); }
  };

  const addRelationship = async () => {
    if (!formData || !newRelationship.trim()) return;
    const rel = newRelationship.trim();
    if (formData.allowedRelationships.includes(rel)) {
      setError("Relationship already exists.");
      return;
    }
    const updated = [...formData.allowedRelationships, rel];

    setFormData(prev => prev ? ({ ...prev, allowedRelationships: updated }) : null);

    try {
      await setDoc(doc(db, 'appSettings', 'main'), { allowedRelationships: updated }, { merge: true });
      await logActivity('UPDATE_SETTINGS', currentUser.uid, 'main', `Added allowed relationship: ${rel}`);
      setNewRelationship('');
      showNotification("Relationship added.");
    } catch (err: any) { setError(err.message); }
  };

  const removeRelationship = async (relToRemove: string) => {
    if (!formData) return;
    const updated = formData.allowedRelationships.filter(r => r !== relToRemove);

    setFormData(prev => prev ? ({ ...prev, allowedRelationships: updated }) : null);

    try {
      await setDoc(doc(db, 'appSettings', 'main'), { allowedRelationships: updated }, { merge: true });
      await logActivity('UPDATE_SETTINGS', currentUser.uid, 'main', `Removed allowed relationship: ${relToRemove}`);
      showNotification("Relationship removed.");
    } catch (err: any) { setError(err.message); }
  };

  const handleMaxAmountChange = (cat: string, val: string) => {
    const num = parseInt(val, 10) || 0;
    setFormData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        maxAmounts: {
          ...(prev.maxAmounts || {}),
          [cat]: num
        }
      };
    });
  };

  const saveMaxAmounts = async () => {
    if (!formData) return;
    try {
      await setDoc(doc(db, 'appSettings', 'main'), { maxAmounts: formData.maxAmounts }, { merge: true });
      await logActivity('UPDATE_SETTINGS', currentUser.uid, 'main', `Updated category max amounts`);
      showNotification("Category maximum amounts saved successfully.");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveAllSettings = async () => {
    if (!formData) return;
    setSaving(true);
    setError('');
    try {
      await setDoc(doc(db, 'appSettings', 'main'), {
        welfareCategories: formData.welfareCategories,
        allowedRelationships: formData.allowedRelationships,
        maxAmounts: formData.maxAmounts,
        showTotalBalanceToMembers: formData.showTotalBalanceToMembers,
        showTopContributors: formData.showTopContributors,
        minimumWeeklyContribution: formData.minimumWeeklyContribution,
        welfareApprovers: formData.welfareApprovers || [],
        banners: formData.banners || [],
        landingBanners: formData.banners || [],
        supportPhone: formData.supportPhone || '+256 770 000000',
        supportWhatsApp: formData.supportWhatsApp || '+256 700 000000',
        supportEmail: formData.supportEmail || 'support@mamas.org'
      }, { merge: true });

      await logActivity('UPDATE_SETTINGS', currentUser.uid, 'main', 'Saved all system settings');
      showNotification("All system settings saved successfully to Firestore.");
    } catch (err: any) {
      console.error("Error saving settings:", err);
      setError("Failed to save settings: " + (err.message || 'Permission denied or network error'));
    } finally {
      setSaving(false);
    }
  };

  const addBannerUrl = async (urlToAdd?: string) => {
    if (!formData) return;
    const targetUrl = urlToAdd || newBannerUrl.trim();
    if (!targetUrl) return;

    const currentList = formData.banners || formData.landingBanners || [];
    const updated = [...currentList, targetUrl];

    setFormData(prev => prev ? ({
      ...prev,
      banners: updated,
      landingBanners: updated
    }) : null);

    try {
      await setDoc(doc(db, 'appSettings', 'main'), {
        banners: updated,
        landingBanners: updated
      }, { merge: true });
      await logActivity('UPDATE_SETTINGS', currentUser.uid, 'main', `Added landing banner`);
      setNewBannerUrl('');
      showNotification("Banner image added.");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const removeBannerUrl = async (index: number) => {
    if (!formData) return;
    const currentList = formData.banners || formData.landingBanners || [];
    const updated = currentList.filter((_, i) => i !== index);

    setFormData(prev => prev ? ({
      ...prev,
      banners: updated,
      landingBanners: updated
    }) : null);

    try {
      await setDoc(doc(db, 'appSettings', 'main'), {
        banners: updated,
        landingBanners: updated
      }, { merge: true });
      await logActivity('UPDATE_SETTINGS', currentUser.uid, 'main', `Removed landing banner`);
      showNotification("Banner image removed.");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleBannerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBanner(true);
    setError('');

    try {
      const fileRef = ref(storage, `banners/banner_${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      await addBannerUrl(url);
    } catch (err: any) {
      console.error(err);
      setError("Failed to upload banner image: " + err.message);
    } finally {
      setUploadingBanner(false);
    }
  };

  const canEditWelfare = isSuperAdmin || isChairperson || isViceChairperson;
  const canEditApprovers = isSuperAdmin || isChairperson;
  const canEditBanners = isSuperAdmin || isChairperson || isViceChairperson;
  const isOnlyTreasurer = isTreasurer && !isSuperAdmin && !isChairperson && !isViceChairperson;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 px-4 sm:px-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs border border-amber-200/50 dark:border-amber-900/40">
            <Settings2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              System Settings
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Configure global application parameters, welfare limits, and landing page assets.
            </p>
          </div>
        </div>
      </div>

      {/* Unsaved Changes Alert Banner */}
      {isDirty && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 p-4 rounded-2xl text-amber-900 dark:text-amber-200 text-sm font-medium flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-start sm:items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <span>
              You have unsaved local changes. Click <strong>"Save All Changes"</strong> below to persist them to Firestore.
            </span>
          </div>
          <button 
            onClick={handleDiscardChanges}
            className="text-xs text-amber-800 dark:text-amber-300 font-semibold px-3 py-1.5 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors shrink-0 flex items-center gap-1.5 underline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Discard Changes
          </button>
        </div>
      )}

      {/* Success Notification Banner */}
      {message && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200 p-4 rounded-2xl text-sm font-medium flex items-center gap-2.5 shadow-sm animate-in fade-in duration-200">
          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Error Notification Banner */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 p-4 rounded-2xl text-sm font-medium flex items-center justify-between gap-3 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LEFT COLUMN: Welfare Policy & Limits */}
        {!isOnlyTreasurer && (
          <div className="space-y-6">
            
            {/* CARD 1: Welfare Categories & Allowed Relationships */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800/60 hover:shadow-md transition-all">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center shrink-0 font-bold shadow-xs">
                    <Settings2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-white text-base tracking-tight">
                      Welfare Categories & Relationships
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Manage categories and eligible relationships</p>
                  </div>
                </div>
                {canEditWelfare && (
                  <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                    Editable
                  </span>
                )}
              </div>
            
              <div className="space-y-6">
                
                {/* Section A: Weekly Min Contribution */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                    Weekly Min. Contribution (UGX)
                  </label>
                  <input 
                    type="number" 
                    disabled={!canEditWelfare}
                    value={formData.minimumWeeklyContribution} 
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      setFormData(prev => prev ? ({ ...prev, minimumWeeklyContribution: val }) : null);
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-base font-bold text-slate-900 dark:text-white focus:border-amber-500 focus:bg-white dark:focus:bg-slate-900 outline-none disabled:opacity-60 transition-all" 
                  />
                </div>

                {/* Section B: Active Categories */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2.5">
                    Active Categories
                  </label>
                  <div className="space-y-2 mb-3">
                    {formData.welfareCategories.map((cat) => (
                      <div key={cat} className="flex justify-between items-center bg-white dark:bg-slate-800/60 px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs hover:border-slate-200 transition-colors">
                        <span className="font-semibold text-sm text-slate-900 dark:text-white">{cat}</span>
                        {canEditWelfare && (
                          <button 
                            onClick={() => removeCategory(cat)} 
                            className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/60 flex items-center justify-center transition-colors"
                            title="Remove category"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {canEditWelfare && (
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={newCategory} 
                        onChange={e => setNewCategory(e.target.value)} 
                        placeholder="Add new category name..." 
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-amber-500 transition-all placeholder:text-slate-400" 
                      />
                      <button 
                        onClick={addCategory} 
                        className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white rounded-xl px-4 py-2 text-sm font-bold transition-all flex items-center gap-1.5 active:scale-[0.97]"
                      >
                        <Plus className="w-4 h-4" /> Add
                      </button>
                    </div>
                  )}
                </div>

                {/* Section C: Allowed Beneficiary Relationships */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2.5">
                    Allowed Beneficiary Relationships
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formData.allowedRelationships.map((rel) => (
                      <span key={rel} className="inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 rounded-full px-3.5 py-1.5 text-sm font-medium">
                        {rel} 
                        {canEditWelfare && (
                          <button 
                            onClick={() => removeRelationship(rel)} 
                            className="text-amber-500 hover:text-amber-800 dark:hover:text-amber-100 transition-colors"
                            title="Remove relationship"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                  {canEditWelfare && (
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={newRelationship} 
                        onChange={e => setNewRelationship(e.target.value)} 
                        placeholder="Add relationship (e.g., Parent)..." 
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-amber-500 transition-all placeholder:text-slate-400" 
                      />
                      <button 
                        onClick={addRelationship} 
                        className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white rounded-xl px-4 py-2 text-sm font-bold transition-all flex items-center gap-1.5 active:scale-[0.97]"
                      >
                        <Plus className="w-4 h-4" /> Add
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* CARD 2: Maximum Amounts per Category */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800/60 hover:shadow-md transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-4">
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white text-base tracking-tight">
                    Category Maximum Payout Limits (UGX)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Enforced on welfare application forms.</p>
                </div>
                {canEditWelfare && (
                  <button 
                    onClick={saveMaxAmounts}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.97] shrink-0"
                  >
                    <Save className="w-4 h-4" /> Save Amounts
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {formData.welfareCategories.length === 0 ? (
                  <p className="text-sm text-slate-400 italic py-2">No categories created yet.</p>
                ) : (
                  formData.welfareCategories.map((cat) => (
                    <div key={cat} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{cat}</span>
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-semibold text-slate-400">UGX</span>
                        <input
                          type="number"
                          disabled={!canEditWelfare}
                          value={formData.maxAmounts?.[cat] ?? 0}
                          onChange={(e) => handleMaxAmountChange(cat, e.target.value)}
                          className="w-full sm:w-40 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 px-3 py-1.5 text-right font-bold text-slate-900 dark:text-white focus:border-amber-500 outline-none disabled:opacity-60 transition-all"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {/* RIGHT COLUMN: Approvers, Visibility, Support Contacts, Theme, and Banners */}
        <div className={`space-y-6 ${isOnlyTreasurer ? 'lg:col-span-2' : ''}`}>
          
          {/* CARD 3: Welfare Approvers Selection */}
          {!isOnlyTreasurer && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800/60 hover:shadow-md transition-all">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white text-base tracking-tight">
                    Welfare Approvers (Exactly 3)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Select exactly 3 committee members. Welfare requests require 2-of-3 votes.
                  </p>
                </div>
              </div>
            
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {committeeMembers.map(member => {
                  const isApprover = (formData.welfareApprovers || []).includes(member.uid);
                  const initials = member.fullName
                    ? member.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                    : 'U';

                  return (
                    <div 
                      key={member.uid} 
                      className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                        isApprover 
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 border-l-4 border-l-emerald-500' 
                          : 'bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                          {initials}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white">{member.fullName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                            {member.role.replace('_', ' ')} • {member.phoneNumber}
                          </p>
                        </div>
                      </div>

                      {canEditApprovers ? (
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={isApprover} 
                            onChange={() => toggleApprover(member.uid)} 
                            disabled={!isApprover && formData.welfareApprovers.length >= 3} 
                          />
                          <div className="w-12 h-7 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all after:shadow-sm peer-checked:after:translate-x-5"></div>
                        </label>
                      ) : (
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${isApprover ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' : 'text-slate-400'}`}>
                          {isApprover ? 'Approver' : ''}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs font-semibold text-slate-500 dark:text-slate-400 flex justify-between items-center">
                <span>Selected Approvers:</span>
                <span className={formData.welfareApprovers.length === 3 ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-amber-600 dark:text-amber-400 font-bold"}>
                  {formData.welfareApprovers.length} / 3 selected
                </span>
              </div>
            </div>
          )}

          {/* CARD 4: Visibility Controls */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800/60 hover:shadow-md transition-all">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white text-base tracking-tight">
                  Member Visibility Settings
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Control metric visibility on member dashboards</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer p-4 bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xs hover:border-slate-200 transition-colors">
                <div className="pr-4">
                  <p className="font-bold text-sm text-slate-900 dark:text-white">Show Total Balance to Members</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Allow ordinary members to see total fund balance on dashboard.</p>
                </div>
                <div className="relative shrink-0">
                  <input 
                    type="checkbox" 
                    checked={formData.showTotalBalanceToMembers} 
                    onChange={(e) => handleUpdateBoolean('showTotalBalanceToMembers', e.target.checked)} 
                    className="sr-only peer" 
                  />
                  <div className="w-12 h-7 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:bg-slate-900 dark:peer-checked:bg-emerald-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all after:shadow-sm peer-checked:after:translate-x-5"></div>
                </div>
              </label>

              {canEditWelfare && (
                <label className="flex items-center justify-between cursor-pointer p-4 bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xs hover:border-slate-200 transition-colors">
                  <div className="pr-4">
                    <p className="font-bold text-sm text-slate-900 dark:text-white">Show Top Contributors Leaderboard</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Display top contributors on member dashboard.</p>
                  </div>
                  <div className="relative shrink-0">
                    <input 
                      type="checkbox" 
                      checked={formData.showTopContributors} 
                      onChange={(e) => handleUpdateBoolean('showTopContributors', e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-12 h-7 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:bg-slate-900 dark:peer-checked:bg-emerald-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all after:shadow-sm peer-checked:after:translate-x-5"></div>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* CARD 5: Executive Support Contacts */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800/60 hover:shadow-md transition-all">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white text-base tracking-tight">
                  Executive Support Contacts
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Direct Phone Call, WhatsApp, and Email shown on Login, Approval, and Help screens.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                  Support Call Phone Number
                </label>
                <input
                  type="text"
                  value={formData.supportPhone || ''}
                  onChange={(e) => setFormData(prev => prev ? ({ ...prev, supportPhone: e.target.value }) : null)}
                  placeholder="+256 770 000000"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus:border-amber-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                  Support WhatsApp Number
                </label>
                <input
                  type="text"
                  value={formData.supportWhatsApp || ''}
                  onChange={(e) => setFormData(prev => prev ? ({ ...prev, supportWhatsApp: e.target.value }) : null)}
                  placeholder="+256 700 000000"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus:border-amber-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
                  Support Email Address
                </label>
                <input
                  type="email"
                  value={formData.supportEmail || ''}
                  onChange={(e) => setFormData(prev => prev ? ({ ...prev, supportEmail: e.target.value }) : null)}
                  placeholder="support@mamas.org"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus:border-amber-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>

          {/* CARD 6: Theme & Appearance Preference */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800/60 hover:shadow-md transition-all">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <SunMedium className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white text-base tracking-tight">
                  System Theme & Appearance
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select your preferred system theme mode (Light, Dark, or System).
                </p>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
              <ThemeToggle />
            </div>
          </div>

          {/* CARD 7: Landing Page Banners Manager */}
          {canEditBanners && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800/60 hover:shadow-md transition-all">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white text-base tracking-tight">
                    Landing Page Banners
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Manage hero carousel images displayed on the public landing page.
                  </p>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                {(formData.banners || []).map((url, idx) => (
                  <div key={idx} className="flex items-center gap-4 bg-white dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs">
                    <img src={url} alt={`Banner ${idx + 1}`} className="w-20 h-14 object-cover rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0 border border-slate-100 dark:border-slate-800" />
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate flex-1 font-mono">{url}</span>
                    <button 
                      onClick={() => removeBannerUrl(idx)} 
                      className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/60 flex items-center justify-center transition-colors shrink-0"
                      title="Remove banner"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {(formData.banners || []).length === 0 && (
                  <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mb-2">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">No custom banners added yet.</p>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex gap-2">
                  <input 
                    type="url" 
                    value={newBannerUrl} 
                    onChange={e => setNewBannerUrl(e.target.value)} 
                    placeholder="Paste banner image URL..." 
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-amber-500 transition-all placeholder:text-slate-400" 
                  />
                  <button 
                    onClick={() => addBannerUrl()} 
                    disabled={!newBannerUrl.trim()}
                    className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white rounded-xl px-4 py-2 text-sm font-bold transition-all disabled:opacity-50 shrink-0"
                  >
                    Add URL
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest shrink-0">OR UPLOAD IMAGE FILE:</span>
                  <input 
                    type="file" 
                    accept="image/*"
                    disabled={uploadingBanner}
                    onChange={handleBannerFileUpload}
                    className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-300 hover:file:bg-slate-200"
                  />
                  {uploadingBanner && <span className="text-xs text-amber-500 font-semibold animate-pulse">Uploading...</span>}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Master Save Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-xl shadow-slate-900/20 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-8 transition-all">
        <div>
          <h3 className="font-bold text-white text-base tracking-tight">Save Configuration Changes</h3>
          <p className="text-xs text-slate-300 mt-0.5">
            Ensure all changes to categories, relationships, limits, and banners are committed to Firestore.
          </p>
        </div>
        <button
          onClick={saveAllSettings}
          disabled={saving}
          className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 active:scale-[0.97] text-slate-950 font-bold px-8 py-3.5 rounded-full shadow-lg transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 text-base shrink-0"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Saving Settings...</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>Save All Changes</span>
            </>
          )}
        </button>
      </div>

    </div>
  );
}

