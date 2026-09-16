import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { SchoolCampaign } from '../types';
import { Link } from 'react-router-dom';
import { formatUGX, DEFAULT_CAMPAIGN_PLACEHOLDER } from '../lib/utils';
import { Target, AlertCircle, RefreshCw } from 'lucide-react';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<SchoolCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'schoolCampaigns'),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolCampaign));
        list.sort((a, b) => b.createdAt - a.createdAt);
        setCampaigns(list);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error loading campaigns:', err);
        setError('Could not load campaigns. Please try again.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [retryKey]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-3 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28 animate-in fade-in duration-300">
      <div className="bg-gradient-to-r from-[#07132c] via-[#0f2756] to-[#1e3a8a] rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-blue-900/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-bold text-blue-200 border border-white/15 mb-3 uppercase tracking-wider">
            Alma Mater Development
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">School Support Campaigns</h1>
          <p className="text-blue-100/80 text-xs sm:text-sm mt-1 max-w-xl">
            Fund specific infrastructure, educational awards, and developmental projects for St. Aloysius Secondary School, Matuumu.
          </p>
        </div>
      </div>

      {error ? (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-3xl p-8 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-rose-900 dark:text-rose-200 mb-1">Unable to Load Campaigns</h3>
          <p className="text-xs text-rose-700 dark:text-rose-400 mb-4 max-w-md">{error}</p>
          <button
            onClick={() => setRetryKey(prev => prev + 1)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-2xl transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white dark:bg-[#0c1731] rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 p-12 sm:p-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-4 border border-blue-100 dark:border-blue-900/60">
            <Target className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">No Active Campaigns</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto text-xs leading-relaxed">
            There are no ongoing school support campaigns at this time. Check back later for new initiatives to support our alma mater.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {campaigns.map(campaign => {
            const progress = campaign.targetAmount > 0 
              ? Math.min(100, (campaign.raisedAmount / campaign.targetAmount) * 100) 
              : 0;

            return (
              <div key={campaign.id} className="bg-white dark:bg-[#0c1731] rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all">
                <div className="w-full h-48 bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                  <img 
                    src={(campaign.imageUrls && campaign.imageUrls[0]) || campaign.imageUrl || DEFAULT_CAMPAIGN_PLACEHOLDER} 
                    alt={campaign.title} 
                    className="w-full h-full object-cover" 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_CAMPAIGN_PLACEHOLDER;
                    }}
                  />
                  <div className="absolute top-3 right-3">
                    <span className="px-3 py-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs text-blue-700 dark:text-blue-400 text-[10px] font-extrabold rounded-full uppercase tracking-wider border border-blue-200/50 dark:border-blue-800/50 shadow-xs">
                      Active
                    </span>
                  </div>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mb-1 tracking-tight">{campaign.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 line-clamp-3 leading-relaxed">{campaign.description}</p>
                  
                  <div className="mt-auto space-y-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-900 dark:text-white">{formatUGX(campaign.raisedAmount)} <span className="font-normal text-slate-400">Raised</span></span>
                      <span className="text-slate-500 dark:text-slate-400">Goal: {formatUGX(campaign.targetAmount)}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                      <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                    </div>
                    <p className="text-[11px] font-bold text-right text-blue-600 dark:text-blue-400">{progress.toFixed(1)}% Funded</p>
                  </div>
                </div>
                
                <div className="bg-slate-50/70 dark:bg-slate-800/40 p-4 border-t border-slate-100 dark:border-slate-800">
                  <Link 
                    to={`/contribute?campaignId=${campaign.id}`}
                    className="w-full inline-flex justify-center items-center py-3 px-4 shadow-sm text-xs font-bold rounded-2xl text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Contribute to this Campaign
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
