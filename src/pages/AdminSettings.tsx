import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc, setDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { AppSettings, User } from '../types';
import { updateWelfareApprovers, logActivity } from '../lib/services';
import { formatUGX } from '../lib/utils';
import { Settings2, Plus, X, Shield, Eye, Image as ImageIcon, CheckCircle, AlertCircle, Save, Loader2, SunMedium } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';

export default function AdminSettings() {
  const { currentUser, userProfile } = useAuth();
  
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const [committeeMembers, setCommitteeMembers] = useState<User[]>([]);
  
  const [newCategory, setNewCategory] = useState('');
  const [newRelationship, setNewRelationship] = useState('');
  const [newBannerUrl, setNewBannerUrl] = useState('');
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // Local state for max amounts editing
  const [maxAmountsState, setMaxAmountsState] = useState<Record<string, number>>({});

  useEffect(() => {
    // Real-time listener for appSettings/main
    const unsub = onSnapshot(doc(db, 'appSettings', 'main'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as AppSettings;
        const currentBanners = data.banners || data.landingBanners || [];
        const fullSettings: AppSettings = {
          id: 'main',
          welfareCategories: data.welfareCategories || ['Medical Emergency', 'Bereavement', 'Education Support', 'Wedding / Marriage', 'General Welfare'],
          allowedRelationships: data.allowedRelationships || ['Self', 'Spouse', 'Child', 'Parent', 'Sibling'],
          maxAmounts: data.maxAmounts || { 'Medical Emergency': 1000000, 'Bereavement': 800000, 'Education Support': 500000, 'Wedding / Marriage': 500000, 'General Welfare': 300000 },
          welfareApprovers: data.welfareApprovers || [],
          showTotalBalanceToMembers: !!data.showTotalBalanceToMembers,
          showTopContributors: !!data.showTopContributors,
          minimumWeeklyContribution: data.minimumWeeklyContribution || 5000,
          banners: currentBanners,
          landingBanners: currentBanners,
          supportPhone: data.supportPhone || '+256 770 000000',
          supportWhatsApp: data.supportWhatsApp || '+256 700 000000'
        };
        setSettings(fullSettings);
        setMaxAmountsState(data.maxAmounts || {});
      } else {
        const defaultSettings: AppSettings = {
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
          supportWhatsApp: '+256 700 000000'
        };
        setSettings(defaultSettings);
        setMaxAmountsState(defaultSettings.maxAmounts);
      }
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
      <div className="flex flex-col items-center justify-center p-12 text-center bg-mamas-card rounded-2xl shadow-sm border border-slate-200">
        <Shield className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-mamas-text">Access Denied</h2>
        <p className="text-mamas-text-muted mt-2">You do not have permission to view system settings.</p>
      </div>
    );
  }

  if (loading) return <div className="p-8 text-center text-mamas-text-muted">Loading configuration...</div>;
  if (!settings) return <div className="p-8 text-center text-rose-500">Settings missing!</div>;

  const showNotification = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3500);
  };

  const handleUpdateBoolean = async (field: keyof AppSettings, value: boolean) => {
    try {
      await setDoc(doc(db, 'appSettings', 'main'), { [field]: value }, { merge: true });
      await logActivity('UPDATE_SETTINGS', currentUser.uid, 'main', `Toggled ${field} to ${value}`);
      showNotification("Setting updated successfully.");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateNumber = async (field: keyof AppSettings, value: number) => {
    try {
      await setDoc(doc(db, 'appSettings', 'main'), { [field]: value }, { merge: true });
      await logActivity('UPDATE_SETTINGS', currentUser.uid, 'main', `Updated ${field} to ${value}`);
      showNotification("Setting updated successfully.");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleApprover = async (uid: string) => {
    const isCurrentlyApprover = settings.welfareApprovers.includes(uid);
    let newApprovers = [...settings.welfareApprovers];
    
    if (isCurrentlyApprover) {
      newApprovers = newApprovers.filter(id => id !== uid);
    } else {
      if (newApprovers.length >= 3) {
        setError("Maximum of 3 approvers allowed. Unselect one before adding another.");
        return;
      }
      newApprovers.push(uid);
    }

    try {
      await updateWelfareApprovers(currentUser.uid, newApprovers);
      showNotification("Welfare approvers updated successfully.");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const addCategory = async () => {
    if (!newCategory.trim()) return;
    const cat = newCategory.trim();
    if (settings.welfareCategories.includes(cat)) {
      setError("Category already exists.");
      return;
    }
    const updated = [...settings.welfareCategories, cat];
    try {
      await setDoc(doc(db, 'appSettings', 'main'), { welfareCategories: updated }, { merge: true });
      await logActivity('UPDATE_SETTINGS', currentUser.uid, 'main', `Added welfare category: ${cat}`);
      setNewCategory('');
      showNotification("Category added.");
    } catch (err: any) { setError(err.message); }
  };

  const removeCategory = async (catToRemove: string) => {
    const updatedCategories = settings.welfareCategories.filter(c => c !== catToRemove);
    const updatedMaxAmounts = { ...settings.maxAmounts };
    delete updatedMaxAmounts[catToRemove];

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
    if (!newRelationship.trim()) return;
    const rel = newRelationship.trim();
    if (settings.allowedRelationships.includes(rel)) {
      setError("Relationship already exists.");
      return;
    }
    const updated = [...settings.allowedRelationships, rel];
    try {
      await setDoc(doc(db, 'appSettings', 'main'), { allowedRelationships: updated }, { merge: true });
      await logActivity('UPDATE_SETTINGS', currentUser.uid, 'main', `Added allowed relationship: ${rel}`);
      setNewRelationship('');
      showNotification("Relationship added.");
    } catch (err: any) { setError(err.message); }
  };

  const removeRelationship = async (relToRemove: string) => {
    const updated = settings.allowedRelationships.filter(r => r !== relToRemove);
    try {
      await setDoc(doc(db, 'appSettings', 'main'), { allowedRelationships: updated }, { merge: true });
      await logActivity('UPDATE_SETTINGS', currentUser.uid, 'main', `Removed allowed relationship: ${relToRemove}`);
      showNotification("Relationship removed.");
    } catch (err: any) { setError(err.message); }
  };

  const handleMaxAmountChange = (cat: string, val: string) => {
    const num = parseInt(val, 10) || 0;
    setMaxAmountsState(prev => ({ ...prev, [cat]: num }));
  };

  const saveMaxAmounts = async () => {
    try {
      await setDoc(doc(db, 'appSettings', 'main'), { maxAmounts: maxAmountsState }, { merge: true });
      await logActivity('UPDATE_SETTINGS', currentUser.uid, 'main', `Updated category max amounts`);
      showNotification("Category maximum amounts saved successfully.");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveAllSettings = async () => {
    setSaving(true);
    setError('');
    try {
      await setDoc(doc(db, 'appSettings', 'main'), {
        welfareCategories: settings.welfareCategories,
        allowedRelationships: settings.allowedRelationships,
        maxAmounts: maxAmountsState,
        showTotalBalanceToMembers: settings.showTotalBalanceToMembers,
        showTopContributors: settings.showTopContributors,
        minimumWeeklyContribution: settings.minimumWeeklyContribution,
        banners: settings.banners || [],
        landingBanners: settings.banners || [],
        supportPhone: settings.supportPhone || '+256 770 000000',
        supportWhatsApp: settings.supportWhatsApp || '+256 700 000000'
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
    const targetUrl = urlToAdd || newBannerUrl.trim();
    if (!targetUrl) return;

    const currentList = settings.banners || settings.landingBanners || [];
    const updated = [...currentList, targetUrl];

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
    const currentList = settings.banners || settings.landingBanners || [];
    const updated = currentList.filter((_, i) => i !== index);

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
    <div className="space-y-8 max-w-5xl mx-auto pb-10">
      <div>
        <h2 className="text-2xl font-display font-bold text-mamas-text flex items-center gap-2">
          <Settings2 className="w-6 h-6 text-mamas-accent" /> System Settings
        </h2>
        <p className="text-mamas-text-muted text-sm mt-1">Configure global application parameters, welfare limits, and landing page assets.</p>
      </div>

      {message && (
        <div className="bg-teal-50 border border-teal-200 text-teal-800 px-4 py-3 rounded-2xl text-sm font-medium flex items-center gap-2 shadow-sm">
          <CheckCircle className="w-5 h-5 text-teal-600 flex-shrink-0" />
          {message}
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl text-sm font-medium flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="p-1 hover:bg-rose-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Welfare Policy & Limits */}
        {!isOnlyTreasurer && (
          <div className="space-y-6">
            
            <div className="bg-mamas-card border border-slate-200 rounded-3xl p-6 shadow-sm">
              <h3 className="font-bold text-mamas-text mb-4 text-lg border-b border-slate-100 pb-3 flex items-center justify-between">
                <span>Welfare Categories & Allowed Relationships</span>
                {canEditWelfare && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-normal">Editable</span>}
              </h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Weekly Min. Contribution (UGX)</label>
                <input 
                  type="number" 
                  disabled={!canEditWelfare}
                  value={settings.minimumWeeklyContribution} 
                  onChange={(e) => handleUpdateNumber('minimumWeeklyContribution', parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-mamas-accent outline-none font-bold text-mamas-text disabled:opacity-60" 
                />
              </div>

              {/* Welfare Categories List */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Active Categories</label>
                <div className="space-y-2 mb-3">
                  {settings.welfareCategories.map((cat) => (
                    <div key={cat} className="flex justify-between items-center bg-slate-50 px-3.5 py-2 rounded-xl text-sm border border-slate-200">
                      <span className="font-semibold text-mamas-text">{cat}</span>
                      {canEditWelfare && (
                        <button onClick={() => removeCategory(cat)} className="text-rose-400 hover:text-rose-600 p-1 transition-colors">
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
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-mamas-accent" 
                    />
                    <button onClick={addCategory} className="bg-mamas-primary hover:bg-mamas-primary-hover text-white rounded-xl px-4 py-2 text-sm font-bold transition-colors flex items-center gap-1">
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>
                )}
              </div>

              {/* Allowed Relationships List */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Allowed Beneficiary Relationships</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {settings.allowedRelationships.map((rel) => (
                    <span key={rel} className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1 rounded-full text-xs font-semibold">
                      {rel} 
                      {canEditWelfare && (
                        <button onClick={() => removeRelationship(rel)} className="text-blue-400 hover:text-blue-700">
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
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-mamas-accent" 
                    />
                    <button onClick={addRelationship} className="bg-mamas-primary hover:bg-mamas-primary-hover text-white rounded-xl px-4 py-2 text-sm font-bold transition-colors flex items-center gap-1">
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Maximum Amounts per Category */}
          <div className="bg-mamas-card border border-slate-200 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="font-bold text-mamas-text text-lg">Category Maximum Payout Limits (UGX)</h3>
                <p className="text-xs text-mamas-text-muted">Enforced on welfare application forms.</p>
              </div>
              {canEditWelfare && (
                <button 
                  onClick={saveMaxAmounts}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Save className="w-4 h-4" /> Save Amounts
                </button>
              )}
            </div>

            <div className="space-y-3">
              {settings.welfareCategories.length === 0 ? (
                <p className="text-sm text-mamas-text-muted italic">No categories created yet.</p>
              ) : (
                settings.welfareCategories.map((cat) => (
                  <div key={cat} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-sm font-bold text-mamas-text">{cat}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-400">UGX</span>
                      <input
                        type="number"
                        disabled={!canEditWelfare}
                        value={maxAmountsState[cat] ?? 0}
                        onChange={(e) => handleMaxAmountChange(cat, e.target.value)}
                        className="w-36 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-mamas-accent outline-none disabled:opacity-60"
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

        {/* Right Column: Approvers, Visibility, and Banners */}
        <div className={`space-y-6 ${isOnlyTreasurer ? 'lg:col-span-2' : ''}`}>
          
          {/* Welfare Approvers Selection */}
          {!isOnlyTreasurer && (
            <div className="bg-mamas-card border border-slate-200 rounded-3xl p-6 shadow-sm">
              <h3 className="font-bold text-mamas-text mb-1 text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-teal-600" /> Welfare Approvers (Exactly 3)
              </h3>
            <p className="text-xs text-mamas-text-muted mb-4">
              Select exactly 3 committee members. Welfare requests require at least 2 out of 3 votes to approve or reject.
            </p>
            
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {committeeMembers.map(member => {
                const isApprover = settings.welfareApprovers.includes(member.uid);
                return (
                  <div key={member.uid} className={`flex items-center justify-between p-3 rounded-2xl border transition-colors ${isApprover ? 'bg-teal-50/70 border-teal-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div>
                      <p className="font-bold text-sm text-mamas-text">{member.fullName}</p>
                      <p className="text-xs text-slate-500 capitalize">{member.role.replace('_', ' ')} • {member.phoneNumber}</p>
                    </div>
                    {canEditApprovers ? (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={isApprover} 
                          onChange={() => toggleApprover(member.uid)} 
                          disabled={!isApprover && settings.welfareApprovers.length >= 3} 
                        />
                        <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-teal-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                      </label>
                    ) : (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isApprover ? 'bg-teal-100 text-teal-800' : 'text-slate-400'}`}>
                        {isApprover ? 'Approver' : ''}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-500 flex justify-between">
              <span>Selected Approvers:</span>
              <span className={settings.welfareApprovers.length === 3 ? "text-teal-600 font-bold" : "text-amber-600"}>
                {settings.welfareApprovers.length} / 3 selected
              </span>
            </div>
          </div>
          )}

          {/* Visibility Controls */}
          <div className="bg-mamas-card border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="font-bold text-mamas-text mb-4 text-lg border-b border-slate-100 pb-2 flex items-center gap-2">
              <Eye className="w-5 h-5 text-indigo-600" /> Member Visibility Settings
            </h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                <div>
                  <p className="font-bold text-sm text-mamas-text">Show Total Balance to Members</p>
                  <p className="text-xs text-slate-500">Allow ordinary members to see the total fund balance on dashboard.</p>
                </div>
                <div className="relative">
                  <input 
                    type="checkbox" 
                    checked={settings.showTotalBalanceToMembers} 
                    onChange={(e) => handleUpdateBoolean('showTotalBalanceToMembers', e.target.checked)} 
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-mamas-primary"></div>
                </div>
              </label>

              {canEditWelfare && (
                <label className="flex items-center justify-between cursor-pointer p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div>
                    <p className="font-bold text-sm text-mamas-text">Show Top Contributors Leaderboard</p>
                    <p className="text-xs text-slate-500">Display top contributors on member dashboard.</p>
                  </div>
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      checked={settings.showTopContributors} 
                      onChange={(e) => handleUpdateBoolean('showTopContributors', e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-mamas-primary"></div>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* Support Phone & WhatsApp Numbers */}
          <div className="bg-mamas-card border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="font-bold text-mamas-text mb-1 text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600" /> Executive Support Contacts
            </h3>
            <p className="text-xs text-mamas-text-muted mb-4">
              Direct Phone Call and WhatsApp contact numbers shown on Login Page and In-App Help Center.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Support Call Phone Number
                </label>
                <input
                  type="text"
                  value={settings.supportPhone || ''}
                  onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
                  placeholder="+256 770 000000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-mamas-text focus:bg-white focus:ring-2 focus:ring-mamas-accent outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Support WhatsApp Number
                </label>
                <input
                  type="text"
                  value={settings.supportWhatsApp || ''}
                  onChange={(e) => setSettings({ ...settings, supportWhatsApp: e.target.value })}
                  placeholder="+256 700 000000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-mamas-text focus:bg-white focus:ring-2 focus:ring-mamas-accent outline-none"
                />
              </div>
            </div>
          </div>

          {/* Theme & Appearance Preference */}
          <div className="bg-mamas-card border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <h3 className="font-bold text-mamas-text mb-1 text-lg flex items-center gap-2">
              <SunMedium className="w-5 h-5 text-mamas-accent" /> System Theme & Appearance
            </h3>
            <p className="text-xs text-mamas-text-muted mb-4">
              Select your preferred system theme mode (Light, Dark, or System).
            </p>
            <div className="max-w-sm">
              <ThemeToggle />
            </div>
          </div>

          {/* Landing Page Banners Manager */}
          {canEditBanners && (
            <div className="bg-mamas-card border border-slate-200 rounded-3xl p-6 shadow-sm">
              <h3 className="font-bold text-mamas-text mb-1 text-lg flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-amber-500" /> Landing Page Banners
              </h3>
              <p className="text-xs text-mamas-text-muted mb-4">
                Manage hero carousel images displayed on the public landing page.
              </p>

              <div className="space-y-3 mb-4">
                {(settings.banners || []).map((url, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                    <img src={url} alt={`Banner ${idx + 1}`} className="w-16 h-12 object-cover rounded-xl bg-slate-200 flex-shrink-0" />
                    <span className="text-xs text-slate-600 truncate flex-1 font-mono">{url}</span>
                    <button 
                      onClick={() => removeBannerUrl(idx)} 
                      className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 rounded-xl transition-colors"
                      title="Remove banner"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {(settings.banners || []).length === 0 && (
                  <p className="text-xs text-slate-400 italic">No custom banners added yet.</p>
                )}
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex gap-2">
                  <input 
                    type="url" 
                    value={newBannerUrl} 
                    onChange={e => setNewBannerUrl(e.target.value)} 
                    placeholder="Paste banner image URL..." 
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-mamas-accent" 
                  />
                  <button 
                    onClick={() => addBannerUrl()} 
                    disabled={!newBannerUrl.trim()}
                    className="bg-mamas-primary hover:bg-mamas-primary-hover text-white rounded-xl px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50"
                  >
                    Add URL
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">or upload image file:</span>
                  <input 
                    type="file" 
                    accept="image/*"
                    disabled={uploadingBanner}
                    onChange={handleBannerFileUpload}
                    className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                  />
                  {uploadingBanner && <span className="text-xs text-mamas-text-muted animate-pulse">Uploading...</span>}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Master Save Bar */}
      <div className="bg-mamas-card border border-slate-200 rounded-3xl p-6 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 bg-gradient-to-r from-teal-50/50 to-indigo-50/50">
        <div>
          <h3 className="font-bold text-mamas-text text-base">Save Configuration Changes</h3>
          <p className="text-xs text-mamas-text-muted">Ensure all changes to categories, relationships, limits, and banners are committed to Firestore.</p>
        </div>
        <button
          onClick={saveAllSettings}
          disabled={saving}
          className="w-full sm:w-auto bg-mamas-primary hover:bg-mamas-primary-hover text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-base"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving Settings...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save All Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}
