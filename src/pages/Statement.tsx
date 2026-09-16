import React, { useState, useEffect } from 'react';
import { Download, FileText, Wallet, Heart, Target, Sparkles, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { reconcileContribution } from '../lib/services';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { formatUGX } from '../lib/utils';

export default function Statement() {
  const { currentUser } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'welfare' | 'campaign' | 'welfare_support'>('all');
  const [loading, setLoading] = useState(true);
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);

  const fetchTransactions = async () => {
    if (!currentUser) return;
    try {
      const q = query(
        collection(db, 'contributions'),
        where('userId', '==', currentUser.uid)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      list.sort((a, b) => {
        const timeA = a.createdAt || a.timestamp?.toMillis?.() || 0;
        const timeB = b.createdAt || b.timestamp?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setTransactions(list);
    } catch (err) {
      console.error("Error fetching transactions", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [currentUser]);

  const handleRecheck = async (id: string) => {
    setReconcilingId(id);
    try {
      await reconcileContribution(id);
      await fetchTransactions();
    } catch (err: any) {
      console.error("Recheck error:", err);
    } finally {
      setReconcilingId(null);
    }
  };

  const filteredData = transactions.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'welfare') return t.purpose === 'welfare' || t.type === 'welfare';
    if (filter === 'campaign') return t.purpose === 'campaign' || t.type === 'school_support';
    if (filter === 'welfare_support') return t.purpose === 'welfare_support' || t.type === 'welfare_support';
    return true;
  });
  
  const isApproved = (st: string) => st === 'verified' || st === 'successful' || st === 'completed';
  const totalWelfare = transactions.filter(t => (t.purpose === 'welfare' || t.type === 'welfare') && isApproved(t.status)).reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalCampaigns = transactions.filter(t => (t.purpose === 'campaign' || t.type === 'school_support') && isApproved(t.status)).reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalWelfareSupport = transactions.filter(t => (t.purpose === 'welfare_support' || t.type === 'welfare_support') && isApproved(t.status)).reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalAll = totalWelfare + totalCampaigns + totalWelfareSupport;

  const handleDownload = () => {
    const csvRows = ['Date,Purpose,Amount,Status,Reference'];
    filteredData.forEach(t => {
      const timeVal = t.createdAt || t.timestamp?.toMillis?.();
      const date = timeVal ? new Date(timeVal).toLocaleDateString() : 'N/A';
      csvRows.push(`${date},${t.purpose || t.type},${t.amount},${t.status},${t.transactionReference || 'N/A'}`);
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mamas_statement.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto w-full animate-in fade-in duration-300 pb-12">
      
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Financial Statement</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">Your official contribution history and receipts</p>
        </div>
        <button 
          onClick={handleDownload}
          className="flex items-center gap-2 border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-[#0c1731] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
        >
          <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="hidden sm:inline">Download CSV</span>
        </button>
      </div>

      {/* SUMMARY CARD */}
      <div className="bg-gradient-to-r from-[#07132c] via-[#0f2756] to-[#1e3a8a] rounded-3xl p-6 sm:p-8 mb-8 shadow-xl border border-blue-900/40 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        
        <p className="text-blue-200 text-xs font-bold mb-1 uppercase tracking-widest">Total Verified Contributions</p>
        <h2 className="text-3xl sm:text-4xl font-extrabold mb-8 tracking-tight">{formatUGX(totalAll)}</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/15">
            <div className="flex items-center gap-2 mb-1.5 text-blue-200">
              <Heart className="w-4 h-4 text-rose-300" />
              <span className="text-xs font-semibold uppercase tracking-wider">Welfare Relief Fund</span>
            </div>
            <p className="font-extrabold text-xl">{formatUGX(totalWelfare)}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/15">
            <div className="flex items-center gap-2 mb-1.5 text-blue-200">
              <Target className="w-4 h-4 text-amber-300" />
              <span className="text-xs font-semibold uppercase tracking-wider">School Campaigns</span>
            </div>
            <p className="font-extrabold text-xl">{formatUGX(totalCampaigns)}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-xs rounded-2xl p-4 border border-white/15 sm:col-span-1">
            <div className="flex items-center gap-2 mb-1.5 text-blue-200">
              <Sparkles className="w-4 h-4 text-purple-300" />
              <span className="text-xs font-semibold uppercase tracking-wider">Solidarity Support</span>
            </div>
            <p className="font-extrabold text-xl">{formatUGX(totalWelfareSupport)}</p>
          </div>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
        {(['all', 'welfare', 'campaign', 'welfare_support'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold tracking-wide capitalize transition-all whitespace-nowrap cursor-pointer ${
              filter === f 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25' 
                : 'bg-white dark:bg-[#0c1731] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800'
            }`}
          >
            {f === 'all' ? 'All Transactions' : f === 'campaign' ? 'School Campaigns' : f === 'welfare_support' ? 'Solidarity Support' : 'Welfare Fund'}
          </button>
        ))}
      </div>

      {/* TRANSACTION LIST */}
      <div className="bg-white dark:bg-[#0c1731] rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="w-8 h-8 border-3 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : filteredData.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredData.map(t => {
              const isWelfareSup = t.purpose === 'welfare_support' || t.type === 'welfare_support';
              const isCamp = t.purpose === 'campaign' || t.type === 'school_support';
              const timeVal = t.createdAt || t.timestamp?.toMillis?.();
              const dateStr = timeVal ? new Date(timeVal).toLocaleDateString() : 'Pending Date';

              return (
                <div key={t.id} className="p-5 sm:px-6 flex items-center justify-between hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                      isWelfareSup ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400' : isCamp ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400' : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                    }`}>
                      {isWelfareSup ? (
                        <Sparkles className="w-5 h-5 text-purple-500" />
                      ) : isCamp ? (
                        <Target className="w-5 h-5 text-amber-500" />
                      ) : (
                        <Heart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base capitalize">
                        {isWelfareSup ? 'Solidarity Support' : isCamp ? 'Campaign Support' : 'Welfare Contribution'}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {dateStr} • Ref: <span className="font-mono">{t.transactionReference || 'N/A'}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1.5">
                    <span className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">{formatUGX(t.amount)}</span>
                    <StatusBadge status={t.status} />
                    {['pending', 'pending_payment', 'initiated'].includes(t.status) && (
                      <button
                        disabled={reconcilingId === t.id}
                        onClick={() => handleRecheck(t.id)}
                        className="mt-1 flex items-center gap-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all disabled:opacity-50 cursor-pointer"
                        title="Recheck payment confirmation status with mobile network"
                      >
                        <RefreshCw className={`w-3 h-3 ${reconcilingId === t.id ? 'animate-spin' : ''}`} />
                        {reconcilingId === t.id ? 'Checking...' : 'Recheck Status'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState 
            icon={FileText} 
            title="No Transactions" 
            subtitle="You haven't made any contributions in this category yet."
          />
        )}
      </div>
    </div>
  );
}
