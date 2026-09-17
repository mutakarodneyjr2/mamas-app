import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Heart, Plus, FileText, HeartHandshake, AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { StatusBadge } from '../components/StatusBadge';
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

  const [expandedReqId, setExpandedReqId] = useState<string | null>(null);

  return (
    <div className="w-full pb-20 animate-in fade-in duration-300">
      
      {/* STICKY PAGE TITLE BAR (Light Grey Highlighted) */}
      <div className="sticky top-0 z-30 bg-slate-100/95 dark:bg-slate-850/95 backdrop-blur-md px-4 sm:px-6 py-3.5 border-b border-slate-200/90 dark:border-slate-700/80 flex items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-500" fill="currentColor" />
            <h1 className="text-lg sm:text-xl font-bold text-blue-950 dark:text-blue-100 tracking-tight">
              Welfare Support
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Emergency relief, member aid & solidarity appeals
          </p>
        </div>

        <Link 
          to="/welfare/apply" 
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-xs transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Apply for Support</span>
        </Link>
      </div>

      {/* SECTION 1: MY APPLICATIONS */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2 px-4 sm:px-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>My Applications</span>
          </h2>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            {requests.length} {requests.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center p-8 bg-white dark:bg-[#0c1731] border-y border-slate-200/60 dark:border-slate-800">
            <div className="w-6 h-6 border-2 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : requests.length > 0 ? (
          <div className="bg-white dark:bg-[#0c1731] border-y border-slate-200/60 dark:border-slate-800/80 divide-y divide-slate-100 dark:divide-slate-800/80">
            {requests.map((req) => {
              const statusStr = (req.status || 'pending').toLowerCase();
              const isRejected = statusStr === 'rejected';
              const rejectionReason = req.rejectionReason || req.reviewNotes || req.rejection_notes;
              const dateVal = req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString() : req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'Recent';
              const isExpanded = expandedReqId === req.id;

              return (
                <div 
                  key={req.id} 
                  className="p-4 sm:px-6 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  onClick={() => setExpandedReqId(isExpanded ? null : req.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-slate-900 dark:text-white capitalize text-xs sm:text-sm">
                          {(req.category || 'Welfare').replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          • {dateVal}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {req.description || req.reason || 'Support application'}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                          {formatUGX(req.amountRequested)}
                        </div>
                        {req.paidAmount && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                            Disbursed: {formatUGX(req.paidAmount)}
                          </div>
                        )}
                      </div>
                      <StatusBadge status={req.status} />
                    </div>
                  </div>

                  {/* Expanded Detail View */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs space-y-2 animate-in fade-in duration-150">
                      <div className="text-slate-600 dark:text-slate-300">
                        <strong className="text-slate-700 dark:text-slate-200">Application Reason:</strong> {req.description || req.reason}
                      </div>
                      {req.beneficiaryName && (
                        <div className="text-slate-500 dark:text-slate-400">
                          Beneficiary: {req.beneficiaryName}
                        </div>
                      )}
                      {isRejected && (
                        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2 text-rose-800 dark:text-rose-300">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <strong className="font-bold block text-[11px]">Review Notes / Decision:</strong>
                            <span className="text-[11px]">
                              {rejectionReason || 'Application was not approved based on current welfare criteria.'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#0c1731] border-y border-slate-200/60 dark:border-slate-800/80 p-8 text-center">
            <Heart className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" strokeWidth={1.5} />
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">No applications on record</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 max-w-sm mx-auto">
              When you submit a welfare or milestone celebration request, you can track verification and disbursement status here.
            </p>
          </div>
        )}
      </div>

      {/* SECTION 2: OPEN SOLIDARITY APPEALS */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-2 px-4 sm:px-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <HeartHandshake className="w-4 h-4 text-rose-500" />
            <span>Active Solidarity Appeals</span>
          </h2>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
            Member-to-member direct support
          </span>
        </div>

        {publishedAppeals.length > 0 ? (
          <div className="bg-white dark:bg-[#0c1731] border-y border-slate-200/60 dark:border-slate-800/80 divide-y divide-slate-100 dark:divide-slate-800/80">
            {publishedAppeals.map(wCase => {
              const targetAmount = Number(wCase.supportTargetAmount) || 0;
              const raisedAmount = Number(wCase.supportRaisedAmount) || 0;
              const contributorCount = Number(wCase.supportContributorCount) || 0;
              const hasTarget = targetAmount > 0;
              const pct = hasTarget ? Math.min(100, Math.round((raisedAmount / targetAmount) * 100)) : 0;
              const isSupportOpen = (wCase.supportStatus === 'open' || (!wCase.supportStatus && wCase.supportEnabled !== false));

              return (
                <div 
                  key={wCase.id} 
                  className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/60">
                        {wCase.category || 'Welfare Support'}
                      </span>
                      {isSupportOpen ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Appeal Active
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/60">
                          Concluded
                        </span>
                      )}
                    </div>

                    <h4 className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm tracking-tight mb-1">
                      {wCase.publicTitle || `${wCase.category} Solidarity Support`}
                    </h4>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2 mb-2">
                      {wCase.publicSummary || wCase.reason}
                    </p>

                    <div className="text-[11px] text-slate-400">
                      Beneficiary: <strong className="text-slate-700 dark:text-slate-200 font-semibold">{wCase.personName || 'Alumni Member'}</strong>
                      {wCase.district && ` • ${wCase.district}`}
                    </div>
                  </div>

                  <div className="sm:w-56 shrink-0 sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 dark:border-slate-800">
                    <div className="flex sm:justify-end items-baseline gap-1 text-xs mb-1">
                      <span className="text-slate-900 dark:text-white font-bold text-sm">{formatUGX(raisedAmount)}</span>
                      <span className="text-slate-400 text-[11px]">raised</span>
                      {hasTarget && (
                        <span className="text-slate-400 text-[11px]">/ {formatUGX(targetAmount)}</span>
                      )}
                    </div>

                    {hasTarget && (
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-2.5">
                        <div 
                          className="h-full bg-blue-600 rounded-full" 
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    )}

                    {isSupportOpen ? (
                      <Link 
                        to={`/contribute?type=welfare_support&welfareId=${wCase.id}`}
                        className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors shadow-xs"
                      >
                        <HeartHandshake className="w-3.5 h-3.5" />
                        <span>Support Appeal</span>
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400 font-semibold">Concluded</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#0c1731] border-y border-slate-200/60 dark:border-slate-800/80 p-6 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">No active solidarity appeals at the moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}
