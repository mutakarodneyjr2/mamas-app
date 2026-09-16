import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Plus, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { formatUGX } from '../lib/utils';

export default function Welfare() {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRequests() {
      if (!currentUser) return;
      try {
        const q = query(
          collection(db, 'welfareRequests'),
          where('userId', '==', currentUser.uid),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        setRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Error fetching welfare requests", err);
      } finally {
        setLoading(false);
      }
    }
    fetchRequests();
  }, [currentUser]);

  return (
    <div className="max-w-4xl mx-auto w-full animate-in fade-in duration-300 pb-12">
      
      {/* HERO */}
      <div className="bg-gradient-to-r from-[#07132c] via-[#0f2756] to-[#1e3a8a] rounded-3xl p-6 sm:p-8 mb-8 text-white shadow-xl border border-blue-900/40 relative overflow-hidden flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center shrink-0">
          <Heart className="w-8 h-8 text-blue-200" fill="currentColor" />
        </div>
        <div className="flex-1">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-blue-200 backdrop-blur-xs border border-white/15 mb-2">
            <span>Alumni Solidarity</span>
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">Welfare Support & Relief</h1>
          <p className="text-sm text-blue-100/80 mb-6 max-w-xl leading-relaxed">
            The Matuumu Alumni Mutual Aid Association stands with members in times of milestone celebrations and critical need. Apply for financial assistance for bereavements, medical relief, or member ceremonies.
          </p>
          <Link 
            to="/welfare/apply" 
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-md shadow-blue-500/25 active:scale-[0.98] transition-all w-full sm:w-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Apply for Support
          </Link>
        </div>
      </div>

      {/* MY APPLICATIONS */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4 px-1">My Applications</h2>
        
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="w-8 h-8 border-3 border-blue-200 dark:border-blue-900 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : requests.length > 0 ? (
          <div className="space-y-4">
            {requests.map((req) => (
              <div key={req.id} className="bg-white dark:bg-[#0c1731] rounded-3xl p-6 shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <StatusBadge status={req.status} />
                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                      {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white capitalize text-lg">{req.category.replace('_', ' ')}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{req.description}</p>
                </div>
                
                <div className="text-left sm:text-right bg-slate-50 dark:bg-slate-800/50 sm:bg-transparent dark:sm:bg-transparent p-4 sm:p-0 rounded-2xl border border-slate-100 dark:border-slate-800 sm:border-0">
                  <span className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Requested</span>
                  <span className="font-extrabold text-slate-900 dark:text-white text-lg">{formatUGX(req.amountRequested)}</span>
                  {req.paidAmount && (
                    <div className="mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-xl inline-block border border-emerald-200 dark:border-emerald-800/60">
                      Paid: {formatUGX(req.paidAmount)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#0c1731] rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800">
            <EmptyState 
              icon={Heart} 
              title="No Applications Yet" 
              subtitle="When you apply for welfare support, your request history and approval status will appear here." 
              action={
                <Link to="/welfare/apply" className="inline-block px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl text-xs sm:text-sm transition-all shadow-md shadow-blue-500/25 cursor-pointer">
                  Start an Application
                </Link>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
