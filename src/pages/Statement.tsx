import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Contribution } from '../types';
import { 
  FileText, Download, Heart, Target, RefreshCw, 
  HeartHandshake, ShieldCheck
} from 'lucide-react';
import { formatUGX, safeGetDate, safeFormatDate } from '../lib/utils';
import { StatusBadge } from '../components/StatusBadge';

export default function Statement() {
  const { currentUser, userProfile } = useAuth();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'welfare' | 'school_support' | 'welfare_support'>('all');
  const [recheckingId, setRecheckingId] = useState<string | null>(null);
  const [recheckMessage, setRecheckMessage] = useState<{ id: string; text: string; success: boolean } | null>(null);

  const fetchStatement = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'contributions'),
        where('userId', '==', currentUser.uid)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      // Sort by timestamp consistently using safeGetDate helper
      list.sort((a, b) => {
        const timeA = safeGetDate(a.createdAt || a.timestamp || a.paidAt || 0).getTime();
        const timeB = safeGetDate(b.createdAt || b.timestamp || b.paidAt || 0).getTime();
        return timeB - timeA;
      });

      setContributions(list as Contribution[]);
    } catch (err) {
      console.error("Error fetching statement:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatement();
  }, [currentUser]);

  const handleRecheckStatus = async (contribId: string) => {
    if (!currentUser) return;
    setRecheckingId(contribId);
    setRecheckMessage(null);
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/relworx/reconcile-contribution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ contributionId: contribId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRecheckMessage({
          id: contribId,
          text: `Status updated: ${data.outcome || data.status || 'Reconciliation checked.'}`,
          success: true
        });
        await fetchStatement();
      } else {
        setRecheckMessage({
          id: contribId,
          text: data.message || 'Could not verify status with provider yet.',
          success: false
        });
      }
    } catch (err: any) {
      console.error("Recheck error:", err);
      setRecheckMessage({
        id: contribId,
        text: 'Network check failed. Try again shortly.',
        success: false
      });
    } finally {
      setRecheckingId(null);
    }
  };

  const verifiedItems = contributions.filter(c => c.status === 'verified');

  // Breakdown across 3 categories
  const welfareTotal = verifiedItems
    .filter(c => c.type === 'welfare' || c.purpose === 'welfare')
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  const campaignTotal = verifiedItems
    .filter(c => c.type === 'school_support' || c.purpose === 'campaign')
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  const solidarityTotal = verifiedItems
    .filter(c => c.type === 'welfare_support' || c.purpose === 'welfare_support')
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  const totalVerified = welfareTotal + campaignTotal + solidarityTotal;

  const filteredContributions = contributions.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'welfare') return item.type === 'welfare' || item.purpose === 'welfare';
    if (filter === 'school_support') return item.type === 'school_support' || item.purpose === 'campaign';
    if (filter === 'welfare_support') return item.type === 'welfare_support' || item.purpose === 'welfare_support';
    return true;
  });

  const exportCSV = () => {
    const headers = ['Date', 'Transaction ID', 'Purpose / Type', 'Amount (UGX)', 'Status', 'Phone / Network'];
    const rows = filteredContributions.map((c: any) => {
      const dateStr = safeFormatDate(c.createdAt || c.timestamp || c.paidAt || 0);

      const purposeStr = c.type === 'welfare_support' ? 'Solidarity Welfare Support' : c.type === 'school_support' ? 'School Campaign' : 'Welfare Relief Pool';
      return [
        `"${dateStr}"`,
        `"${c.id}"`,
        `"${purposeStr}"`,
        `"${c.amount}"`,
        `"${c.status}"`,
        `"${c.phoneNumber || ''} (${c.network || ''})"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MAMAS_Statement_${userProfile?.fullName?.replace(/\s+/g, '_') || 'Member'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-4xl mx-auto w-full animate-in fade-in duration-300 pb-20">
      
      {/* STICKY TITLE HEADER */}
      <div className="sticky top-0 z-30 bg-mamas-bg/95 backdrop-blur-md px-4 sm:px-6 py-3.5 border-b border-slate-200/60 dark:border-slate-800/60 mb-5 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">
              Financial Statement
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Verified records of dues, campaign support & solidarity giving
          </p>
        </div>

        <button 
          onClick={exportCSV}
          disabled={filteredContributions.length === 0}
          className="flex items-center gap-1.5 bg-white dark:bg-[#0c1731] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-xl font-medium text-xs border border-slate-200 dark:border-slate-700 shadow-xs transition-all disabled:opacity-50 cursor-pointer active:scale-95 shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span className="hidden sm:inline">Export CSV</span>
          <span className="sm:hidden">Export</span>
        </button>
      </div>

      {/* COMPACT SUMMARY HEADER */}
      <div className="bg-white dark:bg-[#0c1731] rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 mb-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
              Total Verified Contributions
            </span>
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {formatUGX(totalVerified)}
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60 w-fit">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Audited & Verified</span>
          </div>
        </div>

        {/* 3 Categories in 1 Compact Row */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-3.5">
          {/* Welfare Relief */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 sm:p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 mb-1">
              <Heart className="w-3 h-3 text-blue-500 shrink-0" />
              <span className="text-[10px] sm:text-xs font-medium truncate">Welfare Dues</span>
            </div>
            <span className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white">
              {formatUGX(welfareTotal)}
            </span>
          </div>

          {/* School Campaigns */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 sm:p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 mb-1">
              <Target className="w-3 h-3 text-indigo-500 shrink-0" />
              <span className="text-[10px] sm:text-xs font-medium truncate">Campaigns</span>
            </div>
            <span className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white">
              {formatUGX(campaignTotal)}
            </span>
          </div>

          {/* Solidarity Support */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 sm:p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 mb-1">
              <HeartHandshake className="w-3 h-3 text-rose-500 shrink-0" />
              <span className="text-[10px] sm:text-xs font-medium truncate">Solidarity</span>
            </div>
            <span className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white">
              {formatUGX(solidarityTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* FILTER SEGMENTED CONTROL */}
      <div className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl flex gap-1 border border-slate-200/80 dark:border-slate-700/60 mb-4 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 min-w-[70px] py-1.5 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer text-center ${
            filter === 'all'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          All ({contributions.length})
        </button>
        <button
          onClick={() => setFilter('welfare')}
          className={`flex-1 min-w-[90px] py-1.5 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer text-center ${
            filter === 'welfare'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Welfare Dues
        </button>
        <button
          onClick={() => setFilter('school_support')}
          className={`flex-1 min-w-[90px] py-1.5 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer text-center ${
            filter === 'school_support'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Campaigns
        </button>
        <button
          onClick={() => setFilter('welfare_support')}
          className={`flex-1 min-w-[90px] py-1.5 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer text-center ${
            filter === 'welfare_support'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Solidarity
        </button>
      </div>

      {/* TRANSACTION LIST */}
      <div>
        {loading ? (
          <div className="flex justify-center py-16 bg-white dark:bg-[#0c1731] rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="w-6 h-6 border-2 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : filteredContributions.length > 0 ? (
          <div className="bg-white dark:bg-[#0c1731] rounded-2xl border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden shadow-xs">
            {filteredContributions.map((item: any) => {
              const isVerified = item.status === 'verified';
              const isPending = item.status === 'pending';
              const isSolidarity = item.type === 'welfare_support' || item.purpose === 'welfare_support';
              const isCampaign = item.type === 'school_support' || item.purpose === 'campaign';

              const dateStr = safeFormatDate(item.createdAt || item.timestamp || item.paidAt, { day: 'numeric', month: 'short', year: 'numeric' }) || 'Recent';

              return (
                <div 
                  key={item.id} 
                  className="p-3.5 sm:p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isSolidarity 
                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400' 
                        : isCampaign 
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400' 
                        : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                    }`}>
                      {isSolidarity ? (
                        <HeartHandshake className="w-4 h-4" />
                      ) : isCampaign ? (
                        <Target className="w-4 h-4" />
                      ) : (
                        <Heart className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-white text-xs sm:text-sm truncate">
                        {isSolidarity 
                          ? 'Solidarity Welfare Support' 
                          : isCampaign 
                          ? 'School Infrastructure Campaign' 
                          : 'Welfare Relief Pool'}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        <span>{dateStr}</span>
                        {item.network && (
                          <>
                            <span>•</span>
                            <span>{item.network}</span>
                          </>
                        )}
                        {item.phoneNumber && (
                          <>
                            <span>•</span>
                            <span className="font-mono">{item.phoneNumber}</span>
                          </>
                        )}
                      </div>

                      {/* Recheck outcome notification */}
                      {recheckMessage && recheckMessage.id === item.id && (
                        <div className={`mt-1.5 text-[11px] p-1.5 rounded-lg font-medium flex items-center gap-1 ${
                          recheckMessage.success 
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' 
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        }`}>
                          <RefreshCw className="w-3 h-3 shrink-0" />
                          <span>{recheckMessage.text}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right side: Amount, status, recheck */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className={`block font-semibold text-xs sm:text-sm ${
                        isVerified 
                          ? 'text-slate-900 dark:text-white' 
                          : isPending 
                          ? 'text-amber-600 dark:text-amber-400' 
                          : 'text-slate-400 line-through'
                      }`}>
                        {formatUGX(item.amount)}
                      </span>
                      <div className="mt-0.5">
                        <StatusBadge status={item.status} />
                      </div>
                    </div>

                    {isPending && (
                      <button
                        type="button"
                        onClick={() => handleRecheckStatus(item.id)}
                        disabled={recheckingId === item.id}
                        className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                        title="Recheck pending payment"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${recheckingId === item.id ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#0c1731] rounded-2xl p-8 text-center border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" strokeWidth={1.5} />
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">No transactions found</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              Contributions made via Mobile Money will appear here after verification.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
