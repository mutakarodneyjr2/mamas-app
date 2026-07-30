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
  
  const totalWelfare = transactions.filter(t => t.purpose === 'welfare' && t.status === 'successful').reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalCampaigns = transactions.filter(t => t.purpose === 'campaign' && t.status === 'successful').reduce((acc, curr) => acc + (curr.amount || 0), 0);
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
    <div className="max-w-4xl mx-auto w-full animate-in fade-in duration-300 pb-8">
      
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Financial Statement</h1>
        <button 
          onClick={handleDownload}
          className="flex items-center gap-2 border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 px-4 py-2 rounded-full text-sm font-bold shadow-sm transition-all active:scale-95"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Download CSV</span>
        </button>
      </div>

      {/* SUMMARY CARD */}
      <div className="bg-gradient-to-br from-mamas-primary to-slate-800 rounded-3xl p-6 sm:p-8 mb-8 shadow-xl shadow-mamas-primary/10 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/5 blur-3xl"></div>
        
        <p className="text-white/70 text-sm font-medium mb-1 uppercase tracking-widest">Total Verified Contributions</p>
        <h2 className="text-4xl font-bold mb-8 tracking-tight">{formatUGX(totalAll)}</h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2 text-white/70">
              <Heart className="w-4 h-4 text-rose-300" />
              <span className="text-xs font-semibold uppercase tracking-widest">Welfare Fund</span>
            </div>
            <p className="font-bold text-lg">{formatUGX(totalWelfare)}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2 text-white/70">
              <Target className="w-4 h-4 text-mamas-accent" />
              <span className="text-xs font-semibold uppercase tracking-widest">Campaigns</span>
            </div>
            <p className="font-bold text-lg">{formatUGX(totalCampaigns)}</p>
          </div>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto no-scrollbar pb-2">
        {(['all', 'welfare', 'campaign'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-5 py-2.5 rounded-full text-sm font-bold tracking-wide capitalize transition-all whitespace-nowrap ${
              filter === f 
                ? 'bg-gray-900 text-white shadow-md' 
                : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-100'
            }`}
          >
            {f === 'all' ? 'All Transactions' : f === 'campaign' ? 'School Campaigns' : 'Welfare Fund'}
          </button>
        ))}
      </div>

      {/* TRANSACTION LIST */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-mamas-accent rounded-full animate-spin"></div>
          </div>
        ) : filteredData.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {filteredData.map(t => (
              <div key={t.id} className="p-5 sm:px-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                    t.purpose === 'welfare' ? 'bg-rose-50' : 'bg-amber-50'
                  }`}>
                    {t.purpose === 'welfare' ? (
                      <Heart className="w-5 h-5 text-rose-500" />
                    ) : (
                      <Target className="w-5 h-5 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm sm:text-base capitalize">
                      {t.purpose === 'welfare' ? 'Welfare Contribution' : 'Campaign Support'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t.timestamp ? t.timestamp.toDate().toLocaleDateString() : 'Pending Date'} • Ref: {t.transactionReference || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1.5">
                  <span className="font-bold text-gray-900">{formatUGX(t.amount)}</span>
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
