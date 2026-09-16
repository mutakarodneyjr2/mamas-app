import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Heart, Plus, FileText, HeartHandshake, AlertCircle, 
  CheckCircle2, Clock, XCircle, ArrowRight, ShieldAlert, Sparkles, PauseCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { formatUGX } from '../lib/utils';
import { WelfareRequest } from '../types';

export default function Welfare() {
  const { currentUser, userProfile } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [publishedAppeals, setPublishedAppeals] = useState<WelfareRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const isVerified = (userProfile?.status || '').toLowerCase() === 'approved';

  useEffect(() => {
    async function fetchWelfareData() {
      if (!currentUser) return;
      setLoading(true);
      try {
        // 1. Fetch user's personal applications
        const qUser = query(
          collection(db, 'welfareRequests'),
          where('userId', '==', currentUser.uid)
        );
        const userSnap = await getDocs(qUser);
        const userList = userSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        userList.sort((a: any, b: any) => {
          const timeA = a.createdAt?.toMillis?.() || a.createdAt || 0;
          const timeB = b.createdAt?.toMillis?.() || b.createdAt || 0;
          return timeB - timeA;
        });
        setRequests(userList);

        // 2. Fetch open published solidarity appeals
        try {
          const appealsSnap = await getDocs(collection(db, 'publishedWelfareFeed'));
          const appealsList = appealsSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as WelfareRequest))
            .sort((a, b) => (b.publishedAt || b.createdAt || 0) - (a.publishedAt || a.createdAt || 0));
          setPublishedAppeals(appealsList);
        } catch (feedErr) {
          console.warn("Could not load published appeals:", feedErr);
        }
      } catch (err) {
        console.error("Error fetching welfare data", err);
      } finally {
        setLoading(false);
      }
    }

    fetchWelfareData();
  }, [currentUser]);

  return (
    <div className="max-w-4xl mx-auto w-full animate-in fade-in duration-300 pb-20">
      
      {/* STICKY NON-SCROLLING PAGE TITLE HEADER */}
      <div className="sticky top-0 z-30 bg-mamas-bg/95 backdrop-blur-md px-4 sm:px-6 py-3.5 border-b border-slate-200/60 dark:border-slate-800/60 mb-5 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-500" fill="currentColor" />
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Welfare Support & Relief
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Emergency assistance, milestone celebration aid & solidarity appeals
          </p>
        </div>

        <Link 
          to="/welfare/apply" 
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white px-3.5 sm:px-4 py-2 rounded-2xl font-bold text-xs shadow-xs shadow-blue-500/25 transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Apply for Support</span>
        </Link>
      </div>

      {/* COMPACT INTRO CARD */}
      <div className="bg-gradient-to-r from-[#07132c] via-[#0f2756] to-[#1e3a8a] rounded-3xl p-5 text-white shadow-md border border-blue-900/40 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
            <HeartHandshake className="w-6 h-6 text-rose-300" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-white tracking-tight">Mutual Aid & Solidarity</h3>
            <p className="text-blue-100/80 text-xs mt-0.5 max-w-lg leading-relaxed">
              MAMAS stands with members in times of bereavement, illness, or emergency need. Applications are reviewed confidentially by the executive committee.
            </p>
          </div>
        </div>

        <Link
          to="/welfare/apply"
          className="bg-white hover:bg-blue-50 text-blue-950 font-bold px-4 py-2 rounded-xl text-xs shadow-xs transition-all shrink-0 active:scale-95"
        >
          New Request
        </Link>
      </div>

      {/* SECTION 1: MY APPLICATIONS */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>My Applications</span>
          </h2>
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
            {requests.length} total
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center p-8 bg-white dark:bg-[#0c1731]">
            <div className="w-7 h-7 border-3 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : requests.length > 0 ? (
          <div className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
            {requests.map((req) => {
              const statusStr = (req.status || 'pending').toLowerCase();
              const isRejected = statusStr === 'rejected';
              const isPaid = statusStr === 'paid' || statusStr === 'disbursed';
              const rejectionReason = req.rejectionReason || req.reviewNotes || req.rejection_notes;
              const dateVal = req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString() : req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'Recent';

              return (
                <div 
                  key={req.id} 
                  className="bg-white dark:bg-[#0c1731] py-4 px-2 sm:px-4 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <StatusBadge status={req.status} />
                        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                          {dateVal}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 dark:text-white capitalize text-base">
                        {(req.category || 'Welfare').replace('_', ' ')}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                        {req.description || req.reason}
                      </p>
                    </div>

                    <div className="text-left sm:text-right bg-slate-50 dark:bg-slate-800/40 sm:bg-transparent dark:sm:bg-transparent p-3 sm:p-0 rounded-2xl border border-slate-100 dark:border-slate-800 sm:border-0 shrink-0">
                      <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Requested Amount
                      </span>
                      <span className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg">
                        {formatUGX(req.amountRequested)}
                      </span>
                      {req.paidAmount && (
                        <div className="mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-lg inline-block border border-emerald-200 dark:border-emerald-800/60">
                          Disbursed: {formatUGX(req.paidAmount)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rejection Alert Box */}
                  {isRejected && (
                    <div className="mt-3 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold block">Review Notes / Rejection Reason:</strong>
                        <span className="text-rose-700 dark:text-rose-300">
                          {rejectionReason || 'The application could not be approved based on the current welfare policy limits.'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#0c1731] rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800">
            <EmptyState 
              icon={Heart} 
              title="No Applications Yet" 
              subtitle="When you apply for welfare support, your request history and approval status will appear here." 
              action={
                <Link to="/welfare/apply" className="inline-block px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl text-xs transition-all shadow-xs shadow-blue-500/25 cursor-pointer">
                  Start an Application
                </Link>
              }
            />
          </div>
        )}
      </div>

      {/* SECTION 2: OPEN SOLIDARITY APPEALS */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <HeartHandshake className="w-4 h-4 text-rose-500" />
            <span>Solidarity Welfare Appeals</span>
          </h2>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Member-to-member direct giving
          </span>
        </div>

        {publishedAppeals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {publishedAppeals.map(wCase => {
              const targetAmount = Number(wCase.supportTargetAmount) || 0;
              const raisedAmount = Number(wCase.supportRaisedAmount) || 0;
              const contributorCount = Number(wCase.supportContributorCount) || 0;
              const hasTarget = targetAmount > 0;
              const pct = hasTarget ? Math.min(100, Math.round((raisedAmount / targetAmount) * 100)) : 0;
              const isSupportOpen = (wCase.supportStatus === 'open' || (!wCase.supportStatus && wCase.supportEnabled !== false));
              const isSupportPaused = wCase.supportStatus === 'paused';
              const isSupportClosed = wCase.supportStatus === 'closed' || wCase.supportEnabled === false;

              return (
                <div 
                  key={wCase.id} 
                  className="bg-white dark:bg-[#0c1731] rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 flex flex-col justify-between hover:border-rose-300 dark:hover:border-rose-700/60 transition-all relative overflow-hidden"
                >
                  <div>
                    {/* Header Badges */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 px-2.5 py-0.5 rounded-full">
                        {wCase.category || 'Welfare Support'}
                      </span>

                      {isSupportOpen && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Appeal Active
                        </span>
                      )}
                      {isSupportPaused && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-full">
                          <PauseCircle className="w-3 h-3" />
                          Paused
                        </span>
                      )}
                      {isSupportClosed && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          Concluded
                        </span>
                      )}
                    </div>

                    <h4 className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight mb-1">
                      {wCase.publicTitle || `${wCase.category} Solidarity Support`}
                    </h4>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3 line-clamp-3">
                      {wCase.publicSummary || wCase.reason}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mb-3 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <span>Beneficiary: <strong className="text-slate-800 dark:text-slate-200">{wCase.personName || 'Alumni Member'}</strong></span>
                      {wCase.district && (
                        <>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span>Location: <strong className="text-slate-800 dark:text-slate-200">{wCase.district}</strong></span>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-baseline text-xs font-bold mb-1.5">
                      <div className="flex items-baseline gap-1">
                        <span className="text-rose-600 dark:text-rose-400 font-extrabold text-sm">{formatUGX(raisedAmount)}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">raised</span>
                      </div>
                      <div className="text-right text-[11px]">
                        {hasTarget ? (
                          <span className="text-slate-500 dark:text-slate-400">Target: {formatUGX(targetAmount)} ({pct}%)</span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">{contributorCount} supporters</span>
                        )}
                      </div>
                    </div>

                    {hasTarget && (
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
                        <div 
                          className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full transition-all duration-500" 
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    )}

                    {isSupportOpen ? (
                      <Link 
                        to={`/contribute?type=welfare_support&welfareId=${wCase.id}`}
                        className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-[0.99] text-white font-bold text-xs text-center transition-all shadow-xs shadow-rose-600/25 cursor-pointer"
                      >
                        <HeartHandshake className="w-4 h-4" />
                        Stand With Member
                      </Link>
                    ) : (
                      <button 
                        disabled 
                        className="w-full py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold text-xs text-center cursor-not-allowed border border-slate-200 dark:border-slate-700"
                      >
                        Solidarity Appeal Concluded
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#0c1731] rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 p-6 text-center">
            <HeartHandshake className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-1.5" strokeWidth={1.5} />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">No active solidarity appeals at the moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
