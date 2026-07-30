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
    <div className="max-w-4xl mx-auto w-full animate-in fade-in duration-300 pb-8">
      
      {/* HERO */}
      <div className="bg-gradient-to-br from-rose-50 to-white rounded-3xl p-8 mb-8 shadow-sm border border-rose-100 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
        <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
          <Heart className="w-8 h-8 text-rose-500" fill="currentColor" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">Welfare Support & Relief</h1>
          <p className="text-sm text-gray-600 mb-6 max-w-lg leading-relaxed">
            The Matuumu Alumni Mutual Aid Association is here to support members in times of joy and sorrow. Apply for financial assistance for weddings, bereavements, or medical emergencies.
          </p>
          <Link 
            to="/welfare/apply" 
            className="inline-flex items-center justify-center gap-2 bg-mamas-primary text-white px-6 py-3 rounded-full font-bold shadow-lg hover:bg-mamas-primary-hover active:scale-[0.98] transition-all w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            Apply for Support
          </Link>
        </div>
      </div>

      {/* MY APPLICATIONS */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 tracking-tight mb-4 px-2">My Applications</h2>
        
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-mamas-accent rounded-full animate-spin"></div>
          </div>
        ) : requests.length > 0 ? (
          <div className="space-y-4">
            {requests.map((req) => (
              <div key={req.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <StatusBadge status={req.status} />
                    <span className="text-xs font-semibold text-gray-400">
                      {req.createdAt?.toDate().toLocaleDateString() || 'N/A'}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 capitalize text-lg">{req.category.replace('_', ' ')}</h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-1">{req.description}</p>
                </div>
                
                <div className="text-left sm:text-right bg-gray-50 sm:bg-transparent p-4 sm:p-0 rounded-2xl">
                  <span className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Requested</span>
                  <span className="font-bold text-gray-900">{formatUGX(req.amountRequested)}</span>
                  {req.paidAmount && (
                    <div className="mt-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg inline-block">
                      Paid: {formatUGX(req.paidAmount)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100">
            <EmptyState 
              icon={Heart} 
              title="No Applications Yet" 
              subtitle="When you apply for welfare support, it will appear here." 
              action={
                <Link to="/welfare/apply" className="inline-block px-5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold rounded-full text-sm transition-colors border border-gray-200">
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
