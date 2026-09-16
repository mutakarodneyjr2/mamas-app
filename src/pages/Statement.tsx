import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Contribution } from '../types';
import { 
  FileText, Download, Heart, Target, RefreshCw, 
  HeartHandshake, ShieldCheck
} from 'lucide-react';
import { formatUGX } from '../lib/utils';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';

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

      // CRIT-03: Sort by timestamp consistently
      list.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : a.timestamp?.toMillis ? a.timestamp.toMillis() : (typeof a.createdAt === 'number' ? a.createdAt : (typeof a.timestamp === 'number' ? a.timestamp : 0));
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : b.timestamp?.toMillis ? b.timestamp.toMillis() : (typeof b.createdAt === 'number' ? b.createdAt : (typeof b.timestamp === 'number' ? b.timestamp : 0));
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
      const res = await fetch('/api/relworx/reconcile-pending', {
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
          text: `Status updated: ${data.outcome || 'Reconciliation checked.'}`,
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
      let dateStr = 'N/A';
      if (c.createdAt?.toDate) dateStr = c.createdAt.toDate().toLocaleDateString();
      else if (c.timestamp?.toDate) dateStr = c.timestamp.toDate().toLocaleDateString();
      else if (typeof c.createdAt === 'number') dateStr = new Date(c.createdAt).toLocaleDateString();

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
      <div className="sticky top-16 z-30 bg-mamas-bg/95 backdrop-blur-md py-3.5 border-b border-slate-200/60 dark:border-slate-800/60 mb-5 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Financial Statement
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Complete record of your verified contributions & support
          </p>
        </div>

        <button 
          onClick={exportCSV}
          disabled={filteredContributions.length === 0}
          className="flex items-center gap-1.5 bg-white dark:bg-[#0c1731] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-3.5 py-2 rounded-2xl font-bold text-xs border border-slate-200 dark:border-slate-700 shadow-xs transition-all disabled:opacity-50 cursor-pointer active:scale-95 shrink-0"
        >
          <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="hidden sm:inline">Export CSV</span>
          <span className="sm:hidden">Export</span>
        </button>
      </div>

      {/* COMPACT SUMMARY HEADER (3 CATEGORIES IN ONE ROW) */}
      <div className="bg-white dark:bg-[#0c1731] py-4 px-2 sm:px-4 border-b border-slate-200/60 dark:border-slate-800/60 mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
              Total Verified Contributions
            </span>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {formatUGX(totalVerified)}
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/80 w-fit">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Audited & Immutable</span>
          </div>
        </div>

        {/* 3 Categories in 1 Compact Row */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {/* Welfare Relief */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-3 sm:p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 mb-1">
              <Heart className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[10px] sm:text-xs font-bold truncate">Welfare Dues</span>
            </div>
            <span className="font-extrabold text-xs sm:text-base text-slate-900 dark:text-white">
              {formatUGX(welfareTotal)}
            </span>
          </div>

          {/* School Campaigns */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-3 sm:p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 mb-1">
              <Target className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[10px] sm:text-xs font-bold truncate">Campaigns</span>
            </div>
            <span className="font-extrabold text-xs sm:text-base text-slate-900 dark:text-white">
              {formatUGX(campaignTotal)}
            </span>
          </div>

          {/* Solidarity Support */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-3 sm:p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 mb-1">
              <HeartHandshake className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[10px] sm:text-xs font-bold truncate">Solidarity</span>
            </div>
            <span className="font-extrabold text-xs sm:text-base text-slate-900 dark:text-white">
              {formatUGX(solidarityTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* FILTER BUTTONS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 no-scrollbar">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            filter === 'all'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-[#0c1731] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          All Activity ({contributions.length})
        </button>
        <button
          onClick={() => setFilter('welfare')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
            filter === 'welfare'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-[#0c1731] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Heart className="w-3 h-3 text-blue-500" />
          <span>Welfare Dues</span>
        </button>
        <button
          onClick={() => setFilter('school_support')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
            filter === 'school_support'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-[#0c1731] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Target className="w-3 h-3 text-indigo-500" />
          <span>School Campaigns</span>
        </button>
        <button
          onClick={() => setFilter('welfare_support')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
            filter === 'welfare_support'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white dark:bg-[#0c1731] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <HeartHandshake className="w-3 h-3 text-rose-500" />
          <span>Solidarity Support</span>
        </button>
      </div>

      {/* TRANSACTION LIST */}
      <div>
        {loading ? (
          <div className="flex justify-center py-16 bg-white dark:bg-[#0c1731]">
            <div className="w-7 h-7 border-3 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : filteredContributions.length > 0 ? (
          <div className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
            {filteredContributions.map((item: any) => {
              const isVerified = item.status === 'verified';
              const isPending = item.status === 'pending';
              const isSolidarity = item.type === 'welfare_support' || item.purpose === 'welfare_support';
              const isCampaign = item.type === 'school_support' || item.purpose === 'campaign';

              let dateStr = 'Recent';
              if (item.createdAt?.toDate) {
                dateStr = item.createdAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
              } else if (item.timestamp?.toDate) {
                dateStr = item.timestamp.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
              } else if (typeof item.createdAt === 'number') {
                dateStr = new Date(item.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
              }

              return (
                <div 
                  key={item.id} 
                  className="bg-white dark:bg-[#0c1731] py-4 px-2 sm:px-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                      isSolidarity 
                        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900' 
                        : isCampaign 
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900' 
                        : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900'
                    }`}>
                      {isSolidarity ? (
                        <HeartHandshake className="w-5 h-5" />
                      ) : isCampaign ? (
                        <Target className="w-5 h-5" />
                      ) : (
                        <Heart className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                          {isSolidarity 
                            ? 'Solidarity Welfare Support' 
                            : isCampaign 
                            ? 'School Infrastructure Campaign' 
                            : 'Welfare Relief Pool'}
                        </span>
                        <StatusBadge status={item.status} />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                        <span>{dateStr}</span>
                        {item.network && (
                          <>
                            <span className="opacity-40">•</span>
                            <span>{item.network}</span>
                          </>
                        )}
                        {item.phoneNumber && (
                          <>
                            <span className="opacity-40">•</span>
                            <span>{item.phoneNumber}</span>
                          </>
                        )}
                      </div>

                      {/* Recheck outcome notification */}
                      {recheckMessage && recheckMessage.id === item.id && (
                        <div className={`mt-2 text-xs p-2 rounded-xl font-bold flex items-center gap-1.5 ${
                          recheckMessage.success 
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}>
                          <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                          <span>{recheckMessage.text}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right side: Amount & Recheck action */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-slate-800">
                    <div className="text-left sm:text-right">
                      <span className={`block font-extrabold text-base sm:text-lg ${
                        isVerified 
                          ? 'text-slate-900 dark:text-white' 
                          : isPending 
                          ? 'text-amber-600 dark:text-amber-400' 
                          : 'text-slate-400 line-through'
                      }`}>
                        {formatUGX(item.amount)}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                        {item.id.slice(0, 10)}...
                      </span>
                    </div>

                    {isPending && (
                      <button
                        type="button"
                        onClick={() => handleRecheckStatus(item.id)}
                        disabled={recheckingId === item.id}
                        className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        title="Recheck pending payment with Mobile Money provider"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${recheckingId === item.id ? 'animate-spin' : ''}`} />
                        <span>{recheckingId === item.id ? 'Checking' : 'Recheck'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#0c1731] rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800">
            <EmptyState
              icon={FileText}
              title="No Transactions Found"
              subtitle="When you make contributions through Mobile Money, your verified statement and timestamps will be visible here."
            />
          </div>
        )}
      </div>
    </div>
  );
}
