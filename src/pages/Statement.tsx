import React, { useState, useEffect } from 'react';
import { Download, FileText, Wallet, Heart, Target } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { formatUGX } from '../lib/utils';

export default function Statement() {
  const { currentUser } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'welfare' | 'campaign'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTransactions() {
      if (!currentUser) return;
      try {
        const q = query(
          collection(db, 'contributions'),
          where('userId', '==', currentUser.uid),
          orderBy('timestamp', 'desc')
        );
        const snap = await getDocs(q);
        setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Error fetching transactions", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTransactions();
  }, [currentUser]);

  const filteredData = transactions.filter(t => filter === 'all' || t.purpose === filter);
  
  const isApproved = (st: string) => st === 'verified' || st === 'successful';
  const totalWelfare = transactions.filter(t => t.purpose === 'welfare' && isApproved(t.status)).reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalCampaigns = transactions.filter(t => t.purpose === 'campaign' && isApproved(t.status)).reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalAll = totalWelfare + totalCampaigns;

  const handleDownload = () => {
    // Basic CSV download
    const csvRows = ['Date,Purpose,Amount,Status,Reference'];
    filteredData.forEach(t => {
      const date = t.timestamp ? t.timestamp.toDate().toLocaleDateString() : 'N/A';
      csvRows.push(`${date},${t.purpose},${t.amount},${t.status},${t.transactionReference || 'N/A'}`);
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
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
        {(['all', 'welfare', 'campaign'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold tracking-wide capitalize transition-all whitespace-nowrap cursor-pointer ${
              filter === f 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25' 
                : 'bg-white dark:bg-[#0c1731] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800'
            }`}
          >
            {f === 'all' ? 'All Transactions' : f === 'campaign' ? 'School Campaigns' : 'Welfare Fund'}
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
            {filteredData.map(t => (
              <div key={t.id} className="p-5 sm:px-6 flex items-center justify-between hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    t.purpose === 'welfare' ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400' : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                  }`}>
                    {t.purpose === 'welfare' ? (
                      <Heart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Target className="w-5 h-5 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base capitalize">
                      {t.purpose === 'welfare' ? 'Welfare Contribution' : 'Campaign Support'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {t.timestamp ? t.timestamp.toDate().toLocaleDateString() : 'Pending Date'} • Ref: <span className="font-mono">{t.transactionReference || 'N/A'}</span>
                    </p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1.5">
                  <span className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">{formatUGX(t.amount)}</span>
                  <StatusBadge status={t.status} />
                </div>
              </div>
            ))}
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
