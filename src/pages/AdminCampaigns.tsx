import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { SchoolCampaign } from '../types';
import { createSchoolCampaign, updateCampaignStatus, logActivity, transferCampaignExcessFunds, deleteSchoolCampaign } from '../lib/services';
import { formatUGX } from '../lib/utils';
import { Target, Plus, Shield, CheckCircle, ArrowRightLeft, XCircle, Clock, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react';
import { uploadImage } from '../lib/storage';

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

  useEffect(() => {
    const q = query(
      collection(db, 'schoolCampaigns'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCampaigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolCampaign)));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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

  const handleAction = async (campaignId: string, action: "close" | "transfer") => {
    if (!currentUser) return;
    
    let note = "";
    if (action === "transfer") {
      const promptNote = window.prompt("Reason/Note for transferring excess funds to Welfare Pool:");
      if (promptNote === null) return;
      note = promptNote;
    } else {
      const promptNote = window.prompt("Reason/Note for closing this campaign:");
      if (promptNote === null) return;
      note = promptNote;
    }

    try {
      if (action === "transfer") {
        await transferCampaignExcessFunds(campaignId, currentUser.uid, note);
        setMessage('Campaign excess funds transferred and closed.');
      } else {
        await updateCampaignStatus(campaignId, currentUser.uid, 'closed', note);
        setMessage('Campaign successfully closed.');
      }
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError("Failed to update campaign: " + err.message);
    }
  };

  const handleDelete = async (campaignId: string, campaignTitle: string) => {
    if (!currentUser) return;
    if (!window.confirm(`Are you sure you want to permanently delete the campaign "${campaignTitle}"? This cannot be undone.`)) return;

    try {
      await deleteSchoolCampaign(campaignId, currentUser.uid);
      setMessage('Campaign deleted successfully.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError("Failed to delete campaign: " + err.message);
    }
  };

  const isChairperson = userProfile?.role === 'chairperson' || userProfile?.role === 'vice_chairperson' || userProfile?.role === 'super_admin';

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      
      <div>
        <h2 className="text-2xl font-display font-bold text-mamas-text flex items-center gap-2">
          <Target className="w-6 h-6 text-mamas-accent" /> Campaigns Management
        </h2>
        <p className="text-mamas-text-muted text-sm mt-1">Create and manage fundraising initiatives for the school.</p>
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm font-medium">{error}</div>}
      {message && <div className="bg-teal-50 border border-teal-200 text-teal-700 px-4 py-3 rounded-xl text-sm font-medium">{message}</div>}

      {/* Form: Launch New Campaign */}
      <div className="bg-mamas-card rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-bold text-mamas-text">Launch New Campaign</h3>
        </div>
        
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="title" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Campaign Title</label>
                <input
                  type="text"
                  name="title"
                  id="title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-mamas-accent outline-none font-medium text-mamas-text"
                  placeholder="e.g. New Library Books"
                />
              </div>

              <div>
                <label htmlFor="targetAmount" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Amount (UGX)</label>
                <input
                  type="number"
                  name="targetAmount"
                  id="targetAmount"
                  required
                  min="1000"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-mamas-accent outline-none font-medium text-mamas-text"
                  placeholder="e.g. 5000000"
                />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
              <textarea
                id="description"
                name="description"
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-mamas-accent outline-none font-medium text-mamas-text resize-none"
                placeholder="Explain the purpose of this campaign..."
              />
            </div>

            <div>
              <label htmlFor="coverImage" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cover Image (Optional)</label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  id="coverImage"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setCoverImage(file);
                  }}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-colors"
                />
                {coverImage && (
                  <button type="button" onClick={(e) => { e.preventDefault(); setCoverImage(null); (document.getElementById('coverImage') as HTMLInputElement).value = ''; }} className="text-rose-500 hover:text-rose-600 text-xs font-bold">
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto bg-mamas-primary hover:bg-mamas-primary-hover text-white font-bold py-3 px-8 rounded-2xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> {isSubmitting ? 'Launching...' : 'Launch Campaign'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Mobile-First Card View for Campaigns */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-mamas-text">Active & Past Campaigns</h3>

        {loading ? (
          <div className="p-8 text-center text-slate-400 font-medium">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="bg-mamas-card border border-slate-100 rounded-3xl p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4">
              <Target className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-mamas-text mb-2">No Campaigns Yet</h3>
            <p className="text-slate-500 max-w-sm mx-auto text-sm">
              You haven't created any campaigns. Use the form above to start a new school support initiative.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.map(camp => {
              const progress = camp.targetAmount > 0 ? (camp.raisedAmount / camp.targetAmount) * 100 : 0;
              const isFullyFunded = camp.status === 'fully_funded';
              const isClosed = camp.status === 'closed';

              return (
                <div key={camp.id} className="bg-mamas-card border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        camp.status === 'active' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        isFullyFunded ? 'bg-teal-50 text-teal-700 border border-teal-200' :
                        'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {camp.status.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(camp.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 className="font-bold text-mamas-text text-lg mb-1">{camp.title}</h4>
                    {camp.imageUrls && camp.imageUrls.length > 0 && (
                      <div className="w-full h-32 rounded-xl overflow-hidden mb-3 bg-slate-100 border border-slate-200">
                        <img src={camp.imageUrls[0]} alt={camp.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">{camp.description}</p>

                    {camp.actionNotes && (
                      <p className="text-xs text-mamas-accent mt-2 bg-amber-50 p-2 rounded-xl border border-amber-200/80">
                        Note: {camp.actionNotes}
                      </p>
                    )}
                  </div>

                  <div>
                    {/* Progress Bar */}
                    <div className="space-y-1.5 mb-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-mamas-text">{formatUGX(camp.raisedAmount)}</span>
                        <span className="text-slate-400">/ {formatUGX(camp.targetAmount)}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${isFullyFunded || progress >= 100 ? 'bg-teal-500' : 'bg-mamas-accent'}`}
                          style={{ width: `${Math.min(100, progress)}%` }}
                        />
                      </div>
                      <div className="text-right text-[10px] font-bold text-slate-400">
                        {progress.toFixed(1)}% funded
                      </div>
                    </div>

                    {/* Action buttons */}
                    {isChairperson && (
                      <div className="flex gap-2 items-center">
                        {!isClosed && isFullyFunded && (
                          <button
                            onClick={() => handleAction(camp.id, 'transfer')}
                            className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 py-2.5 px-3 rounded-xl border border-indigo-200 transition-colors"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" /> Transfer
                          </button>
                        )}
                        {!isClosed && (
                          <button
                            onClick={() => handleAction(camp.id, 'close')}
                            className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 py-2.5 px-3 rounded-xl transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Close
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(camp.id, camp.title)}
                          className="inline-flex items-center justify-center p-2.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors border border-rose-200"
                          title="Delete Campaign"
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

    </div>
  );
}
