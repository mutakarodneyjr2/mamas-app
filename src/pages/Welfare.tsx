import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { WelfareRequest } from '../types';
import { Link } from 'react-router-dom';
import { formatUGX } from '../lib/utils';
import { Heart, Plus, FileText, CheckCircle, Clock, XCircle, Shield, ArrowRight } from 'lucide-react';

export default function Welfare() {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState<WelfareRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    
    const q = query(
      collection(db, 'welfareRequests'),
      where('userId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WelfareRequest));
      list.sort((a, b) => b.createdAt - a.createdAt);
      setRequests(list);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  if (loading) return <div className="p-8 text-center text-mamas-text-muted">Loading welfare records...</div>;

  return (
    <div className="max-w-4xl mx-auto pb-12 space-y-6">
      {/* Header Banner */}
      <div className="bg-mamas-card rounded-3xl shadow-sm border border-slate-200/90 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 mb-2">
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> Member Aid Program
          </div>
          <h2 className="text-2xl font-display font-bold text-mamas-text">Welfare Support & Relief</h2>
          <p className="text-mamas-text-muted text-sm mt-1">Submit assistance requests or track the status of your existing welfare applications.</p>
        </div>

        <Link 
          to="/welfare/apply" 
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-mamas-primary hover:bg-mamas-primary-hover text-white px-6 py-3.5 rounded-2xl font-bold transition-all shadow-md active:scale-[0.98] flex-shrink-0"
        >
          <Plus className="w-4 h-4 text-mamas-accent" /> Apply for Support
        </Link>
      </div>

      {/* Applications List */}
      <div className="bg-mamas-card rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
        <div className="px-6 sm:px-8 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-lg font-bold text-mamas-text">My Applications</h3>
          <span className="text-xs font-semibold text-slate-400">{requests.length} Record(s)</span>
        </div>
        
        <ul className="divide-y divide-slate-100">
          {requests.length === 0 ? (
            <li className="px-6 py-16 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-400 flex items-center justify-center mb-4 border border-rose-100">
                <Heart className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-mamas-text">No Welfare Applications Yet</h4>
              <p className="text-sm text-mamas-text-muted max-w-sm mt-1.5 leading-relaxed">
                Need financial assistance for medical emergencies, bereavement, or family support? Submit a welfare claim to the committee.
              </p>
              <Link
                to="/welfare/apply"
                className="mt-6 inline-flex items-center gap-2 bg-mamas-primary hover:bg-mamas-primary-hover text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-colors shadow-sm"
              >
                Apply for Aid <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </li>
          ) : (
            requests.map(req => (
              <li key={req.id} className="p-6 sm:p-8 hover:bg-slate-50/50 transition-colors">
                <div className="flex flex-col md:flex-row gap-6 md:items-start justify-between">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        req.status === 'paid' ? 'bg-teal-50 text-teal-800 border border-teal-200' :
                        req.status === 'accepted' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                        req.status === 'rejected' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                        'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        {req.status === 'accepted' ? 'Approved (Pending Payout)' : req.status}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        {new Date(req.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      </span>
                    </div>

                    <h4 className="text-xl font-bold text-mamas-text">{req.category}</h4>

                    <div className="text-sm text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Beneficiary</p>
                        <p className="font-bold text-mamas-text mt-0.5">{req.personName} <span className="text-xs text-slate-400 font-normal">({req.relationship})</span></p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount Requested</p>
                        <p className="font-bold text-mamas-text mt-0.5">{formatUGX(req.amountRequested)}</p>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location</p>
                        <p className="font-bold text-mamas-text mt-0.5">{req.district}, {req.villageTown}</p>
                      </div>
                    </div>

                    {req.description && (
                      <p className="text-xs text-slate-500 leading-relaxed italic bg-white p-3 rounded-xl border border-slate-100">
                        "{req.description}"
                      </p>
                    )}
                  </div>

                  <div className="flex-shrink-0 self-start">
                    {req.status === 'pending' && (
                      <div className="flex items-center gap-2 bg-amber-50 text-amber-800 px-4 py-3 rounded-2xl text-xs font-bold border border-amber-200">
                        <Clock className="w-4 h-4 text-amber-600" />
                        Under Review
                      </div>
                    )}
                    {req.status === 'accepted' && (
                      <div className="flex items-center gap-2 bg-teal-50 text-teal-800 px-4 py-3 rounded-2xl text-xs font-bold border border-teal-200">
                        <CheckCircle className="w-4 h-4 text-teal-600" />
                        Approved
                      </div>
                    )}
                    {req.status === 'paid' && (
                      <div className="flex items-center gap-2 bg-teal-50 text-teal-800 px-4 py-3 rounded-2xl text-xs font-bold border border-teal-200">
                        <CheckCircle className="w-4 h-4 text-teal-600" />
                        Paid {req.paidAmount ? `(${formatUGX(req.paidAmount)})` : ''}
                      </div>
                    )}
                    {req.status === 'rejected' && (
                      <div className="flex items-center gap-2 bg-rose-50 text-rose-800 px-4 py-3 rounded-2xl text-xs font-bold border border-rose-200">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        Declined
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
