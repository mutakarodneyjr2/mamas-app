import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  HeartHandshake, Target, Sparkles, ChevronRight, 
  Calendar, CheckCircle2, PauseCircle, AlertCircle, ArrowRight,
  Shield, Filter, Layers, X, Info
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { formatUGX, DEFAULT_CAMPAIGN_PLACEHOLDER } from '../lib/utils';
import { WelfareRequest } from '../types';
import { motion, AnimatePresence } from 'motion/react';

type FeedItem = {
  id: string;
  itemType: 'campaign' | 'welfare';
  title: string;
  summary: string;
  category?: string;
  beneficiaryName?: string;
  location?: string;
  imageUrl?: string;
  targetAmount?: number;
  raisedAmount?: number;
  supporterCount?: number;
  status: string; // 'open' | 'active' | 'paused' | 'closed'
  date: number;
  raw: any;
};

export default function Dashboard() {
  const { userProfile } = useAuth();
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'announcement' | 'campaign' | 'welfare'>('all');
  const [selectedPost, setSelectedPost] = useState<FeedItem | null>(null);
  const [loading, setLoading] = useState(true);

  const isVerified = (userProfile?.status || '').toLowerCase() === 'approved';

  useEffect(() => {
    let isSubscribed = true;

    async function fetchHomeFeed() {
      setLoading(true);
      try {
        // 1. Fetch Active Campaigns
        let campsList: any[] = [];
        try {
          const qCamp = query(collection(db, 'schoolCampaigns'), where('status', '==', 'active'));
          const campSnap = await getDocs(qCamp);
          campsList = campSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (err) {
          console.warn("Falling back for school campaigns:", err);
          const campSnapAll = await getDocs(collection(db, 'schoolCampaigns'));
          campsList = campSnapAll.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter((c: any) => (c.status || '').toLowerCase() === 'active');
        }

        // 2. Fetch Published Welfare Appeals (CRIT-02 safe feed)
        let welfareList: WelfareRequest[] = [];
        try {
          const wSnap = await getDocs(collection(db, 'publishedWelfareFeed'));
          welfareList = wSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as WelfareRequest));
        } catch (wErr) {
          console.warn("Could not load published welfare feed:", wErr);
        }

        // Map into unified FeedItems
        const campaignFeedItems: FeedItem[] = campsList.map(c => {
          const raised = Number(c.raisedAmount) || 0;
          const target = Number(c.targetAmount) || 0;
          const imgUrl = (c.imageUrls && c.imageUrls[0]) || c.imageUrl;
          const createdAtVal = c.createdAt?.toMillis?.() || c.createdAt || Date.now();

          return {
            id: c.id,
            itemType: 'campaign',
            title: c.title || 'School Infrastructure Project',
            summary: c.description || 'Alumni school improvement project',
            imageUrl: imgUrl || DEFAULT_CAMPAIGN_PLACEHOLDER,
            targetAmount: target,
            raisedAmount: raised,
            status: c.status || 'active',
            date: typeof createdAtVal === 'number' ? createdAtVal : Date.now(),
            raw: c
          };
        });

        const welfareFeedItems: FeedItem[] = welfareList.map(w => {
          const target = Number(w.supportTargetAmount) || 0;
          const raised = Number(w.supportRaisedAmount) || 0;
          const contributors = Number(w.supportContributorCount) || 0;
          const pubDate = w.publishedAt || w.createdAt || Date.now();

          let st = 'open';
          if (w.supportStatus === 'paused') st = 'paused';
          else if (w.supportStatus === 'closed' || w.supportEnabled === false) st = 'closed';

          return {
            id: w.id,
            itemType: 'welfare',
            title: w.publicTitle || `${w.category || 'Welfare'} Solidarity Appeal`,
            summary: w.publicSummary || w.reason || 'Emergency assistance support for alumni member.',
            category: w.category || 'Welfare Support',
            beneficiaryName: w.personName || 'Alumni Member',
            location: w.district,
            targetAmount: target,
            raisedAmount: raised,
            supporterCount: contributors,
            status: st,
            date: typeof pubDate === 'number' ? pubDate : Date.now(),
            raw: w
          };
        });

        // Combined and sorted by newest first
        const combined = [...campaignFeedItems, ...welfareFeedItems].sort((a, b) => b.date - a.date);

        if (isSubscribed) {
          setFeedItems(combined);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load feed:", err);
        if (isSubscribed) setLoading(false);
      }
    }

    fetchHomeFeed();

    return () => {
      isSubscribed = false;
    };
  }, []);

  const filteredFeed = feedItems.filter(item => {
    if (filterType === 'all') return true;
    if (filterType === 'announcement') {
      return item.raw?.isOfficial === true || item.raw?.category?.toLowerCase() === 'announcement' || item.raw?.type === 'announcement';
    }
    return item.itemType === filterType;
  });

  return (
    <div className="max-w-2xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      
      {/* COMPACT GREETING LINE & STICKY FEED CONTROLS */}
      <div className="sticky top-0 z-30 bg-mamas-bg/95 backdrop-blur-md pt-3.5 pb-3 px-4 sm:px-6 border-b border-slate-200/60 dark:border-slate-800/60 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white tracking-tight truncate">
              Community Feed
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              Active school campaigns & alumni solidarity appeals
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/contribute"
              className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 px-3.5 py-1.5 rounded-xl transition-all active:scale-95 shadow-xs"
            >
              Pay Dues
            </Link>
          </div>
        </div>

        {/* Filter Segmented Control */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'bg-white dark:bg-[#0c1731] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            All Updates ({feedItems.length})
          </button>
          <button
            onClick={() => setFilterType('announcement')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              filterType === 'announcement'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'bg-white dark:bg-[#0c1731] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 opacity-70" />
            <span>Announcements</span>
          </button>
          <button
            onClick={() => setFilterType('campaign')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              filterType === 'campaign'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'bg-white dark:bg-[#0c1731] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Target className="w-3.5 h-3.5 opacity-70" />
            <span>Campaigns ({feedItems.filter(i => i.itemType === 'campaign').length})</span>
          </button>
          <button
            onClick={() => setFilterType('welfare')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              filterType === 'welfare'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'bg-white dark:bg-[#0c1731] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <HeartHandshake className="w-3.5 h-3.5 opacity-70" />
            <span>Welfare ({feedItems.filter(i => i.itemType === 'welfare').length})</span>
          </button>
        </div>
      </div>

      {/* FEED CONTENT */}
      <div className="mt-2 divide-y divide-slate-200/60 dark:divide-slate-800/60">
        {loading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white dark:bg-[#0c1731] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 animate-pulse space-y-3">
                <div className="flex justify-between items-center">
                  <div className="w-20 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="w-14 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
                <div className="w-3/4 h-5 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full" />
              </div>
            ))}
          </div>
        ) : filteredFeed.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Layers className="w-9 h-9 text-slate-300 dark:text-slate-600 mx-auto mb-2" strokeWidth={1.5} />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No Active Posts Right Now</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
              {filterType === 'campaign' 
                ? 'There are currently no active infrastructure campaigns.'
                : filterType === 'welfare'
                ? 'There are currently no published welfare solidarity appeals.'
                : 'Stay tuned for new campaigns and welfare solidarity announcements.'}
            </p>
          </div>
        ) : (
          filteredFeed.map(item => {
            const isCampaign = item.itemType === 'campaign';
            const target = item.targetAmount || 0;
            const raised = item.raisedAmount || 0;
            const hasTarget = target > 0;
            const pct = hasTarget ? Math.min(100, Math.round((raised / target) * 100)) : 0;
            const isSupportOpen = item.status === 'open' || item.status === 'active';
            const isSupportPaused = item.status === 'paused';
            const isSupportClosed = item.status === 'closed';

            return (
              <div 
                key={`${item.itemType}-${item.id}`}
                className="bg-white dark:bg-[#0c1731] py-4 px-4 sm:px-5 border-b border-slate-200/60 dark:border-slate-800/60 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Badge Row */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-full">
                        {isCampaign ? 'Campaign' : 'Welfare'}
                      </span>

                      {item.category && !isCampaign && (
                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 capitalize hidden sm:inline">
                          • {item.category.replace('_', ' ')}
                        </span>
                      )}
                    </div>

                    {isSupportOpen ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Active
                      </span>
                    ) : isSupportPaused ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-full">
                        <PauseCircle className="w-3 h-3" />
                        Paused
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3 text-slate-400" />
                        Concluded
                      </span>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="flex flex-col sm:flex-row gap-3.5 mb-3">
                    {isCampaign && item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full sm:w-24 h-28 sm:h-24 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = DEFAULT_CAMPAIGN_PLACEHOLDER;
                        }}
                      />
                    )}

                    <div className="flex-1 min-w-0">
                      <h2 
                        onClick={() => setSelectedPost(item)}
                        className="font-semibold text-slate-900 dark:text-white text-base tracking-tight hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer leading-snug mb-1"
                      >
                        {item.title}
                      </h2>
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                        {item.summary}
                      </p>

                      {!isCampaign && (
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                          <span>Beneficiary: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{item.beneficiaryName}</strong></span>
                          {item.location && (
                            <>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              <span>District: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{item.location}</strong></span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress & Actions */}
                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex justify-between items-baseline text-xs mb-1.5">
                    <div className="flex items-baseline gap-1">
                      <span className="font-semibold text-sm text-slate-900 dark:text-white">
                        {formatUGX(raised)}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">raised</span>
                    </div>

                    <div className="text-right text-[11px]">
                      {hasTarget ? (
                        <span className="text-slate-500 dark:text-slate-400 font-medium">
                          Goal: {formatUGX(target)} ({pct}%)
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">
                          {item.supporterCount || 0} {item.supporterCount === 1 ? 'supporter' : 'supporters'}
                        </span>
                      )}
                    </div>
                  </div>

                  {hasTarget && (
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
                      <div 
                        className="h-full rounded-full transition-all duration-500 bg-blue-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-2">
                    {isSupportOpen ? (
                      isCampaign ? (
                        <Link 
                          to={`/contribute?campaignId=${item.id}`}
                          className="flex-1 py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold text-xs text-center transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>Support Campaign</span>
                        </Link>
                      ) : (
                        <Link 
                          to={`/contribute?type=welfare_support&welfareId=${item.id}`}
                          className="flex-1 py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold text-xs text-center transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>Support Appeal</span>
                        </Link>
                      )
                    ) : (
                      <button 
                        disabled 
                        className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-medium text-xs text-center cursor-not-allowed border border-slate-200 dark:border-slate-700"
                      >
                        {isSupportPaused ? 'Support Paused' : 'Concluded'}
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedPost(item)}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs transition-colors cursor-pointer"
                    >
                      Details
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs"
              onClick={() => setSelectedPost(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-white dark:bg-[#0c1731] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 z-10 max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selectedPost.itemType === 'campaign' ? (
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 rounded-full">
                      CAMPAIGN
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-2.5 py-0.5 rounded-full">
                      WELFARE SOLIDARITY
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedPost(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="p-6 overflow-y-auto space-y-4">
                {selectedPost.imageUrl && (
                  <img
                    src={selectedPost.imageUrl}
                    alt={selectedPost.title}
                    className="w-full h-48 rounded-2xl object-cover border border-slate-200 dark:border-slate-700"
                  />
                )}

                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {selectedPost.title}
                </h3>

                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {selectedPost.summary}
                </p>

                {selectedPost.itemType === 'welfare' && (
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <div>Beneficiary: <strong className="text-slate-900 dark:text-white">{selectedPost.beneficiaryName}</strong></div>
                    {selectedPost.location && (
                      <div>District: <strong className="text-slate-900 dark:text-white">{selectedPost.location}</strong></div>
                    )}
                    {selectedPost.category && (
                      <div>Category: <strong className="text-slate-900 dark:text-white capitalize">{selectedPost.category.replace('_', ' ')}</strong></div>
                    )}
                  </div>
                )}

                <div className="bg-blue-50/60 dark:bg-blue-950/30 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/50">
                  <div className="flex justify-between items-baseline text-xs font-bold mb-1">
                    <span className="text-slate-600 dark:text-slate-400">Total Raised</span>
                    <span className="text-slate-900 dark:text-white text-base font-extrabold">{formatUGX(selectedPost.raisedAmount || 0)}</span>
                  </div>
                  {selectedPost.targetAmount ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
                      Target: {formatUGX(selectedPost.targetAmount)}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Action in Footer */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex gap-3">
                <button
                  onClick={() => setSelectedPost(null)}
                  className="flex-1 py-3 px-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Close
                </button>
                {selectedPost.status === 'open' || selectedPost.status === 'active' ? (
                  <Link
                    to={
                      selectedPost.itemType === 'campaign'
                        ? `/contribute?campaignId=${selectedPost.id}`
                        : `/contribute?type=welfare_support&welfareId=${selectedPost.id}`
                    }
                    onClick={() => setSelectedPost(null)}
                    className={`flex-1 py-3 px-4 rounded-2xl text-white font-bold text-xs text-center shadow-md transition-all active:scale-[0.98] ${
                      selectedPost.itemType === 'campaign' ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/25' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/25'
                    }`}
                  >
                    Contribute Now
                  </Link>
                ) : null}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
