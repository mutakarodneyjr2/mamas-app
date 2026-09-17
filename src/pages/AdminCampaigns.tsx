import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { SchoolCampaign } from '../types';
import { createSchoolCampaign, updateCampaignStatus, logActivity, transferCampaignExcessFunds, deleteSchoolCampaign, archiveSchoolCampaign } from '../lib/services';
import { formatUGX, DEFAULT_CAMPAIGN_PLACEHOLDER } from '../lib/utils';
import { Target, Plus, Shield, CheckCircle, ArrowRightLeft, XCircle, Clock, Trash2, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';
import { uploadImage } from '../lib/storage';
import { PromptModal } from '../components/PromptModal';
import { ConfirmationModal } from '../components/ConfirmationModal';

export default function AdminCampaigns() {
  const { currentUser, userProfile } = useAuth();
  const [campaigns, setCampaigns] = useState<SchoolCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [coverImage, setCoverImage] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [promptAction, setPromptAction] = useState<"close" | "transfer" | null>(null);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<{id: string, title: string, isFunded: boolean} | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'schoolCampaigns'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCampaigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolCampaign)));
      setLoading(false);
    }, (err) => {
      console.error("Error loading campaigns:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    const amount = parseInt(targetAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid target amount.");
      return;
    }

    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      let imageUrls: string[] = [];
      if (coverImage) {
        const path = `campaigns/${Date.now()}_${coverImage.name}`;
        const url = await uploadImage(coverImage, path);
        imageUrls.push(url);
      }

      await createSchoolCampaign(currentUser.uid, {
        title,
        description,
        targetAmount: amount,
        imageUrls
      });
      await logActivity('CREATE_CAMPAIGN', currentUser.uid, 'campaign', `Created campaign: ${title}`);
      setMessage('Campaign created successfully.');
      setTimeout(() => setMessage(''), 3000);
      setTitle('');
      setDescription('');
      setTargetAmount('');
      setCoverImage(null);
    } catch (err: any) {
      setError(err.message || 'Failed to create campaign.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const initiateAction = (campaignId: string, action: "close" | "transfer") => {
    setActiveCampaignId(campaignId);
    setPromptAction(action);
    setPromptModalOpen(true);
  };

  const handleActionConfirm = async (note: string) => {
    if (!currentUser || !activeCampaignId || !promptAction) return;

    try {
      if (promptAction === "transfer") {
        await transferCampaignExcessFunds(activeCampaignId, currentUser.uid, note);
        setMessage('Campaign excess funds transferred and closed.');
      } else {
        await updateCampaignStatus(activeCampaignId, currentUser.uid, 'closed', note);
        setMessage('Campaign successfully closed.');
      }
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError("Failed to update campaign: " + err.message);
    } finally {
      setPromptModalOpen(false);
      setActiveCampaignId(null);
      setPromptAction(null);
    }
  };

  const initiateDelete = (campaignId: string, campaignTitle: string, isFunded: boolean) => {
    setCampaignToDelete({ id: campaignId, title: campaignTitle, isFunded });
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!currentUser || !campaignToDelete) return;
    
    try {
      if (campaignToDelete.isFunded) {
        await archiveSchoolCampaign(campaignToDelete.id, currentUser.uid);
        setMessage('Campaign archived successfully.');
      } else {
        await deleteSchoolCampaign(campaignToDelete.id, currentUser.uid);
        setMessage('Campaign deleted successfully.');
      }
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(`Failed to ${campaignToDelete.isFunded ? 'archive' : 'delete'} campaign: ` + err.message);
    } finally {
      setDeleteModalOpen(false);
      setCampaignToDelete(null);
    }
  };

  const isChairperson = userProfile?.role === 'chairperson' || userProfile?.role === 'super_admin';

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 px-4 font-sans">
      
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#0c1731] rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/50 dark:border-blue-900/60">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 text-[10px] font-extrabold uppercase tracking-wider rounded-full px-2.5 py-0.5 border border-blue-200 dark:border-blue-900/60">
                School Development
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              School Campaigns Management
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Launch and administer capital projects, grants, and fundraising drives for St. Aloysius
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 shadow-xs animate-in fade-in">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Form: Launch New Campaign */}
      <div className="bg-white dark:bg-[#0c1731] rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        <div className="px-6 md:px-8 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Launch New School Initiative</h3>
        </div>
        
        <div className="p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="title" className="block text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Campaign Title</label>
                <input
                  type="text"
                  name="title"
                  id="title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none font-medium placeholder:text-slate-400 transition-all"
                  placeholder="e.g. Science Laboratory Renovation"
                />
              </div>

              <div>
                <label htmlFor="targetAmount" className="block text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Target Goal Amount (UGX)</label>
                <input
                  type="number"
                  name="targetAmount"
                  id="targetAmount"
                  required
                  min="1000"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none font-bold font-mono placeholder:text-slate-400 transition-all"
                  placeholder="e.g. 5000000"
                />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Detailed Narrative & Objectives</label>
              <textarea
                id="description"
                name="description"
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none font-medium placeholder:text-slate-400 resize-none transition-all"
                placeholder="Explain the background, budget breakdown, and impact for the students..."
              />
            </div>

            <div>
              <label htmlFor="coverImage" className="block text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Feature Cover Photo (Optional)</label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  id="coverImage"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setCoverImage(file);
                  }}
                  className="w-full text-xs text-slate-500 dark:text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:uppercase file:tracking-wider file:bg-blue-50 dark:file:bg-blue-950/60 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 transition-colors cursor-pointer"
                />
                {coverImage && (
                  <button 
                    type="button" 
                    onClick={(e) => { e.preventDefault(); setCoverImage(null); (document.getElementById('coverImage') as HTMLInputElement).value = ''; }} 
                    className="text-rose-600 dark:text-rose-400 hover:text-rose-700 text-xs font-bold shrink-0 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3.5 px-8 rounded-2xl shadow-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Launch Campaign</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Campaigns Listing */}
      <div className="space-y-4">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Active & Past Campaigns ({campaigns.length})</h3>

        {loading ? (
          <div className="p-12 text-center text-slate-400 font-medium">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-4 border border-blue-200/50 dark:border-blue-900/60">
              <Target className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mb-1">No Campaigns Yet</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-xs">
              No school campaigns have been launched yet. Use the form above to post your first initiative.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.map(camp => {
              const progress = camp.targetAmount > 0 ? (camp.raisedAmount / camp.targetAmount) * 100 : 0;
              const isFullyFunded = camp.status === 'fully_funded';
              const isClosed = camp.status === 'closed';

              return (
                <div key={camp.id} className="bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between gap-4 hover:border-blue-500/40 transition-all">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        camp.status === 'active' ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60' :
                        isFullyFunded ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60' :
                        'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                      }`}>
                        {camp.status.replace('_', ' ')}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {new Date(camp.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg mb-2">{camp.title}</h4>
                    
                    <div className="w-full h-40 rounded-2xl overflow-hidden mb-3 bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 relative">
                      <img 
                        src={(camp.imageUrls && camp.imageUrls[0]) || camp.imageUrl || DEFAULT_CAMPAIGN_PLACEHOLDER} 
                        alt={camp.title} 
                        className="w-full h-full object-cover" 
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = DEFAULT_CAMPAIGN_PLACEHOLDER;
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed">{camp.description}</p>

                    {camp.actionNotes && (
                      <p className="text-xs text-amber-800 dark:text-amber-300 mt-2.5 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-2xl border border-amber-200/80 dark:border-amber-900/60 font-medium">
                        Note: {camp.actionNotes}
                      </p>
                    )}
                  </div>

                  <div>
                    {/* Progress Bar */}
                    <div className="space-y-2 mb-4 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between text-xs font-extrabold">
                        <span className="text-slate-900 dark:text-white">{formatUGX(camp.raisedAmount)}</span>
                        <span className="text-slate-400">Target: {formatUGX(camp.targetAmount)}</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${isFullyFunded || progress >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                          style={{ width: `${Math.min(100, progress)}%` }}
                        />
                      </div>
                      <div className="text-right text-[10px] font-extrabold text-blue-600 dark:text-blue-400">
                        {progress.toFixed(1)}% funded
                      </div>
                    </div>

                    {/* Action buttons */}
                    {isChairperson && (
                      <div className="flex gap-2 items-center">
                        {!isClosed && isFullyFunded && (
                          <button
                            onClick={() => initiateAction(camp.id, 'transfer')}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 py-2.5 px-3 rounded-2xl border border-blue-200 dark:border-blue-900/60 transition-colors cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" /> Transfer
                          </button>
                        )}
                        {!isClosed && (
                          <button
                            onClick={() => initiateAction(camp.id, 'close')}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-2.5 px-3 rounded-2xl transition-colors cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Close
                          </button>
                        )}
                        <button
                          onClick={() => initiateDelete(camp.id, camp.title, (camp.raisedAmount || 0) > 0)}
                          className="inline-flex items-center justify-center p-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-2xl transition-colors border border-rose-200/60 dark:border-rose-900/50 cursor-pointer"
                          title={(camp.raisedAmount || 0) > 0 ? "Archive Campaign" : "Delete Campaign"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <PromptModal
        isOpen={promptModalOpen}
        title={promptAction === 'transfer' ? "Transfer Excess Funds" : "Close Campaign"}
        label={promptAction === 'transfer' ? "Reason/Note for transferring excess funds to Welfare Pool:" : "Reason/Note for closing this campaign:"}
        placeholder="e.g. Campaign completed successfully"
        confirmText="Confirm"
        onConfirm={handleActionConfirm}
        onCancel={() => {
          setPromptModalOpen(false);
          setActiveCampaignId(null);
          setPromptAction(null);
        }}
        minLength={3}
      />

      <ConfirmationModal
        isOpen={deleteModalOpen}
        title={campaignToDelete?.isFunded ? "Archive Campaign" : "Delete Campaign"}
        message={`Are you sure you want to ${campaignToDelete?.isFunded ? 'archive' : 'permanently delete'} the campaign "${campaignToDelete?.title}"? ${campaignToDelete?.isFunded ? '(This hides the campaign but keeps records)' : 'This action cannot be undone.'}`}
        confirmText={campaignToDelete?.isFunded ? "Archive" : "Delete"}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModalOpen(false)}
        isDanger={true}
      />
    </div>
  );
}
