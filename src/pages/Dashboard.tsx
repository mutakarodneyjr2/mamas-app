import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  HeartHandshake, Target, Megaphone, Pin, ChevronRight, 
  Calendar, CheckCircle2, PauseCircle, AlertCircle, ArrowRight,
  Shield, Filter, Layers, X, Info, Clock, ArrowUpDown, SlidersHorizontal, User
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { formatUGX, DEFAULT_CAMPAIGN_PLACEHOLDER } from '../lib/utils';
import { WelfareRequest, Notice } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export type FeedItem = {
  id: string;
  itemType: 'notice' | 'campaign' | 'welfare';
  title: string;
  summary: string;
  category?: string;
  beneficiaryName?: string;
  location?: string;
  imageUrl?: string;
  targetAmount?: number;
  raisedAmount?: number;
  supporterCount?: number;
  status: string; // 'active' | 'open' | 'paused' | 'closed'
  date: number;
  postedBy?: string;
  isPinned?: boolean;
  raw: any;
};

type DateFilterOption = 'all' | '24h' | '7d' | '30d' | '90d';
type SortOrderOption = 'newest' | 'oldest';

export default function Dashboard() {
  const { userProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'notice' | 'campaign' | 'welfare'>('all');
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('all');
  const [sortOrder, setSortOrder] = useState<SortOrderOption>('newest');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  
  const [selectedPost, setSelectedPost] = useState<FeedItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Read initial filter from URL params if present (e.g. ?filter=notice from notification click)
  useEffect(() => {
    const urlFilter = searchParams.get('filter') || searchParams.get('type') || searchParams.get('tab');
    if (urlFilter) {
      if (urlFilter === 'notice' || urlFilter === 'announcement' || urlFilter === 'notices') {
        setFilterType('notice');
      } else if (urlFilter === 'campaign' || urlFilter === 'campaigns') {
        setFilterType('campaign');
      } else if (urlFilter === 'welfare') {
        setFilterType('welfare');
      }
    }
  }, [searchParams]);

  // Fetch campaigns, welfare solidarity appeals, and notices
  useEffect(() => {
    let isSubscribed = true;

    async function fetchHomeFeed() {
      setLoading(true);
      try {
        // 1. Fetch Official Notices
        let noticesList: Notice[] = [];
        try {
          const noticesQ = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
          const noticeSnap = await getDocs(noticesQ);
          noticesList = noticeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notice));
        } catch (noticeErr) {
          console.warn("Falling back notices query:", noticeErr);
          const noticeSnapAll = await getDocs(collection(db, 'notices'));
          noticesList = noticeSnapAll.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notice));
        }

        // 2. Fetch Active School Campaigns
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

        // 3. Fetch Published Welfare Appeals (CRIT-02 safe feed)
        let welfareList: WelfareRequest[] = [];
        try {
          const wSnap = await getDocs(collection(db, 'publishedWelfareFeed'));
          welfareList = wSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as WelfareRequest));
        } catch (wErr) {
          console.warn("Could not load published welfare feed:", wErr);
        }

        // Map Notices into unified FeedItems
        const noticeFeedItems: FeedItem[] = noticesList.map(n => {
          const createdAtVal = (n.createdAt as any)?.toMillis?.() || n.createdAt || Date.now();
          return {
            id: n.id,
            itemType: 'notice',
            title: n.title || 'Official Announcement',
            summary: n.body || '',
            category: 'Official Notice',
            postedBy: n.postedBy || 'Executive Committee',
            isPinned: Boolean(n.isPinned),
            status: 'active',
            date: typeof createdAtVal === 'number' ? createdAtVal : Date.now(),
            raw: n
          };
        });

        // Map Campaigns into unified FeedItems
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

        // Map Welfare Appeals into unified FeedItems
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

        // Combined items
        const combined = [...noticeFeedItems, ...campaignFeedItems, ...welfareFeedItems];

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

  // Filter & Sort Logic
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  const filteredFeed = feedItems.filter(item => {
    // 1. Type filter
    if (filterType === 'notice' && item.itemType !== 'notice') return false;
    if (filterType === 'campaign' && item.itemType !== 'campaign') return false;
    if (filterType === 'welfare' && item.itemType !== 'welfare') return false;

    // 2. Date filter
    if (dateFilter === '24h' && now - item.date > oneDayMs) return false;
    if (dateFilter === '7d' && now - item.date > 7 * oneDayMs) return false;
    if (dateFilter === '30d' && now - item.date > 30 * oneDayMs) return false;
    if (dateFilter === '90d' && now - item.date > 90 * oneDayMs) return false;

    return true;
  }).sort((a, b) => {
    // If pinned notice and sorting newest, prioritize pinned notices at the top
    if (sortOrder === 'newest') {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.date - a.date;
    } else {
      return a.date - b.date;
    }
  });

  const noticeCount = feedItems.filter(i => i.itemType === 'notice').length;
  const campaignCount = feedItems.filter(i => i.itemType === 'campaign').length;
  const welfareCount = feedItems.filter(i => i.itemType === 'welfare').length;

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatRelativeTime = (timestamp: number) => {
    if (!timestamp) return '';
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 7 * 86400) return `${Math.floor(diffSec / 86400)}d ago`;
    return formatDate(timestamp);
  };

  return (
    <div className="max-w-2xl mx-auto w-full pb-20 animate-in fade-in duration-300">
      
      {/* STICKY FEED CONTROLS & HEADER */}
      <div className="sticky top-0 z-30 bg-slate-100/95 dark:bg-slate-850/95 backdrop-blur-md pt-3.5 pb-3 px-4 sm:px-6 border-b border-slate-200/90 dark:border-slate-700/80 flex flex-col gap-3 shadow-xs">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-blue-950 dark:text-blue-100 tracking-tight truncate">
              Community Feed
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium">
              Official notices, school campaigns & welfare solidarity appeals
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowFilterDrawer(!showFilterDrawer)}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                dateFilter !== 'all' || sortOrder !== 'newest'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white dark:bg-[#0c1731] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              title="Filter by date & sort"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filter Date</span>
            </button>
            <Link
              to="/contribute"
              className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 px-3.5 py-2 rounded-xl transition-all active:scale-95 shadow-xs"
            >
              Pay Dues
            </Link>
          </div>
        </div>

        {/* Primary Type Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          <button
            type="button"
            onClick={() => {
              setFilterType('all');
              setSearchParams({});
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#0c1731] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            All Updates ({feedItems.length})
          </button>
          
          <button
            type="button"
            onClick={() => {
              setFilterType('notice');
              setSearchParams({ filter: 'notice' });
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              filterType === 'notice'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#0c1731] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5 opacity-90 text-amber-500" />
            <span>Notices ({noticeCount})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFilterType('campaign');
              setSearchParams({ filter: 'campaign' });
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              filterType === 'campaign'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#0c1731] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Target className="w-3.5 h-3.5 opacity-90 text-indigo-500" />
            <span>Campaigns ({campaignCount})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFilterType('welfare');
              setSearchParams({ filter: 'welfare' });
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              filterType === 'welfare'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#0c1731] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <HeartHandshake className="w-3.5 h-3.5 opacity-90 text-rose-500" />
            <span>Welfare ({welfareCount})</span>
          </button>
        </div>

        {/* Collapsible Date & Sorting Bar */}
        <AnimatePresence>
          {showFilterDrawer && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden pt-1 pb-1 border-t border-slate-200/80 dark:border-slate-700/80"
            >
              <div className="bg-white dark:bg-[#0c1731] p-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-xs space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Filter Date Posted:</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
                      className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowUpDown className="w-3 h-3" />
                      <span>{sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}</span>
                    </button>
                  </div>
                </div>

                {/* Date range chips */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'all', label: 'All Time' },
                    { id: '24h', label: 'Past 24 Hours' },
                    { id: '7d', label: 'Past 7 Days' },
                    { id: '30d', label: 'Past 30 Days' },
                    { id: '90d', label: 'Past 90 Days' }
                  ].map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDateFilter(d.id as DateFilterOption)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                        dateFilter === d.id
                          ? 'bg-blue-600 text-white font-bold'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* FEED CONTENT STREAM */}
      <div className="p-3 sm:p-4 space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white dark:bg-[#0c1731] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse space-y-3 shadow-xs">
                <div className="flex justify-between items-center">
                  <div className="w-24 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="w-16 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
                <div className="w-3/4 h-5 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full" />
              </div>
            ))}
          </div>
        ) : filteredFeed.length === 0 ? (
          <div className="py-16 text-center px-4 bg-white dark:bg-[#0c1731] rounded-2xl border border-slate-200 dark:border-slate-800">
            <Layers className="w-9 h-9 text-slate-300 dark:text-slate-600 mx-auto mb-2" strokeWidth={1.5} />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No Posts Matching Filters</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
              {filterType === 'notice'
                ? 'There are currently no notices posted within this timeframe.'
                : filterType === 'campaign' 
                ? 'There are currently no active infrastructure campaigns within this timeframe.'
                : filterType === 'welfare'
                ? 'There are currently no published welfare solidarity appeals within this timeframe.'
                : 'Stay tuned for new notices, campaigns, and welfare solidarity appeals.'}
            </p>
            {(dateFilter !== 'all' || filterType !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setFilterType('all');
                  setDateFilter('all');
                  setSearchParams({});
                }}
                className="mt-3 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors cursor-pointer"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          filteredFeed.map(item => {
            // ==========================================
            // 1. OFFICIAL NOTICE CARD
            // ==========================================
            if (item.itemType === 'notice') {
              return (
                <article
                  key={`notice-${item.id}`}
                  className={`bg-white dark:bg-[#0c1731] rounded-2xl border shadow-xs hover:shadow-md transition-all p-4 sm:p-5 flex flex-col justify-between ${
                    item.isPinned 
                      ? 'border-amber-300 dark:border-amber-700/80 ring-1 ring-amber-400/20' 
                      : 'border-slate-200 dark:border-slate-800/90'
                  }`}
                >
                  <div>
                    {/* Top Badge Row */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2.5 py-0.5 rounded-full">
                          <Megaphone className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          Official Notice
                        </span>

                        {item.isPinned && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-900/40 px-2 py-0.5 rounded-md">
                            <Pin className="w-2.5 h-2.5" />
                            Pinned
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                        <Clock className="w-3 h-3" />
                        <span>{formatRelativeTime(item.date)}</span>
                      </div>
                    </div>

                    {/* Notice Title & Body Preview */}
                    <div className="mb-3">
                      <h2 
                        onClick={() => setSelectedPost(item)}
                        className="font-bold text-blue-950 dark:text-blue-100 text-base sm:text-lg tracking-tight hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer leading-snug mb-1.5"
                      >
                        {item.title}
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                        {item.summary}
                      </p>
                    </div>

                    {/* Author & Date Footer */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Posted by: <strong className="text-slate-800 dark:text-slate-200">{item.postedBy}</strong></span>
                      </div>
                      <span className="text-slate-400 whitespace-nowrap shrink-0">{formatDate(item.date)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setSelectedPost(item)}
                      className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span>Read Full Notice</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
              );
            }

            // ==========================================
            // 2. CAMPAIGN & WELFARE CARDS
            // ==========================================
            const isCampaign = item.itemType === 'campaign';
            const target = item.targetAmount || 0;
            const raised = item.raisedAmount || 0;
            const hasTarget = target > 0;
            const pct = hasTarget ? Math.min(100, Math.round((raised / target) * 100)) : 0;
            const isSupportOpen = item.status === 'open' || item.status === 'active';
            const isSupportPaused = item.status === 'paused';

            return (
              <article 
                key={`${item.itemType}-${item.id}`}
                className="bg-white dark:bg-[#0c1731] rounded-2xl border border-slate-200 dark:border-slate-800/90 shadow-xs hover:shadow-md transition-all p-4 sm:p-5 flex flex-col justify-between"
              >
                <div>
                  {/* Top Badge Row */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                        isCampaign 
                          ? 'text-indigo-900 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800'
                          : 'text-rose-900 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-800'
                      }`}>
                        {isCampaign ? 'School Campaign' : 'Welfare Solidarity'}
                      </span>

                      {item.category && !isCampaign && (
                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 capitalize hidden sm:inline">
                          • {item.category.replace('_', ' ')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden xs:inline">
                        {formatRelativeTime(item.date)}
                      </span>
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
                  </div>

                  {/* Body Content */}
                  <div className="flex flex-col sm:flex-row gap-3.5 mb-3">
                    {isCampaign && item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full sm:w-28 h-32 sm:h-26 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 shadow-xs"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = DEFAULT_CAMPAIGN_PLACEHOLDER;
                        }}
                      />
                    )}

                    <div className="flex-1 min-w-0">
                      <h2 
                        onClick={() => setSelectedPost(item)}
                        className="font-bold text-blue-950 dark:text-blue-100 text-base sm:text-lg tracking-tight hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer leading-snug mb-1.5"
                      >
                        {item.title}
                      </h2>
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                        {item.summary}
                      </p>

                      {!isCampaign && (
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-2 bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                          <span>Beneficiary: <strong className="text-blue-950 dark:text-blue-200 font-bold">{item.beneficiaryName}</strong></span>
                          {item.location && (
                            <>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              <span>District: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{item.location}</strong></span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress & Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex justify-between items-baseline text-xs mb-2">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-bold text-sm sm:text-base text-blue-950 dark:text-blue-100">
                        {formatUGX(raised)}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">raised</span>
                    </div>

                    <div className="text-right text-[11px]">
                      {hasTarget ? (
                        <span className="text-blue-900 dark:text-blue-300 font-bold">
                          Goal: {formatUGX(target)} ({pct}%)
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400 font-medium">
                          {item.supporterCount || 0} {item.supporterCount === 1 ? 'supporter' : 'supporters'}
                        </span>
                      )}
                    </div>
                  </div>

                  {hasTarget && (
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-3.5">
                      <div 
                        className="h-full rounded-full transition-all duration-500 bg-blue-600 shadow-xs"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-2">
                    {isSupportOpen ? (
                      isCampaign ? (
                        <Link 
                          to={`/contribute?campaignId=${item.id}`}
                          className="flex-1 py-2.5 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold text-xs text-center transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>Support Campaign</span>
                        </Link>
                      ) : (
                        <Link 
                          to={`/contribute?type=welfare_support&welfareId=${item.id}`}
                          className="flex-1 py-2.5 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold text-xs text-center transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>Support Appeal</span>
                        </Link>
                      )
                    ) : (
                      <button 
                        disabled 
                        className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-semibold text-xs text-center cursor-not-allowed border border-slate-200 dark:border-slate-700"
                      >
                        {isSupportPaused ? 'Support Paused' : 'Concluded'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedPost(item)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Details
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Detail Modal for Notices, Campaigns, Welfare Appeals */}
      <AnimatePresence>
        {selectedPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs cursor-pointer"
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
                  {selectedPost.itemType === 'notice' ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2.5 py-0.5 rounded-full">
                      <Megaphone className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      OFFICIAL NOTICE
                    </span>
                  ) : selectedPost.itemType === 'campaign' ? (
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 rounded-full">
                      SCHOOL CAMPAIGN
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-2.5 py-0.5 rounded-full">
                      WELFARE SOLIDARITY
                    </span>
                  )}
                  {selectedPost.isPinned && (
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-900/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Pin className="w-2.5 h-2.5" /> Pinned
                    </span>
                  )}
                </div>
                <button
                  type="button"
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

                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {selectedPost.title}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 mt-1">
                    <span>{formatDate(selectedPost.date)}</span>
                    {selectedPost.postedBy && (
                      <>
                        <span>•</span>
                        <span>By {selectedPost.postedBy}</span>
                      </>
                    )}
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
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

                {selectedPost.itemType !== 'notice' && (
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
                )}
              </div>

              {/* Action in Footer */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPost(null)}
                  className="flex-1 py-3 px-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Close
                </button>
                {selectedPost.itemType !== 'notice' && (selectedPost.status === 'open' || selectedPost.status === 'active') ? (
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
