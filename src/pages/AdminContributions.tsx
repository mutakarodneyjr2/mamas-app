import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Contribution, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { verifyContribution, rejectContribution, logActivity } from '../lib/services';
import { formatUGX } from '../lib/utils';
import { Check, X, FileText } from 'lucide-react';

export default function AdminContributions() {
  const { currentUser } = useAuth();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [usersCache, setUsersCache] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'contributions'),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data: Contribution[] = [];
      const userIds = new Set<string>();

      snapshot.forEach(d => {
        const c = { id: d.id, ...d.data() } as Contribution;
        data.push(c);
        userIds.add(c.userId);
      });

      data.sort((a, b) => b.createdAt - a.createdAt);

      const newCache = { ...usersCache };
      let updatedCache = false;
      for (const uid of userIds) {
        if (!newCache[uid]) {
          const uDoc = await getDoc(doc(db, 'users', uid));
          if (uDoc.exists()) {
            newCache[uid] = uDoc.data() as User;
            updatedCache = true;
          }
        }
      }

      if (updatedCache) {
        setUsersCache(newCache);
      }
      setContributions(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [usersCache]);

  const handleVerify = async (contributionId: string) => {
    if (!currentUser) return;
    try {
      await verifyContribution(contributionId, currentUser.uid);
      await logActivity('VERIFY_CONTRIBUTION', currentUser.uid, contributionId, 'Verified member payment contribution');
    } catch (err: any) {
      alert("Failed to verify: " + err.message);
    }
  };

  const handleReject = async (contributionId: string) => {
    if (!currentUser) return;
    const reason = window.prompt("Reason for rejection:");
    if (reason === null) return;
    if (reason.trim() === "") {
      alert("A reason is required to reject a payment.");
      return;
    }

    try {
      await rejectContribution(contributionId, currentUser.uid, reason);
      await logActivity('REJECT_CONTRIBUTION', currentUser.uid, contributionId, `Rejected payment contribution: ${reason}`);
    } catch (err: any) {
      alert("Failed to reject: " + err.message);
    }
  };

  if (loading) return <div className="p-8 text-center text-mamas-text-muted">Loading pending contributions...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-mamas-card rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 bg-mamas-bg">
          <h3 className="text-xl font-display font-bold text-mamas-text">Pending Contributions</h3>
          <p className="mt-1 text-sm text-mamas-text-muted">Verify member payments by checking your bank statements against these references.</p>
        </div>
        
        <ul className="divide-y divide-gray-100">
          {contributions.length === 0 ? (
            <li className="px-6 py-12 flex flex-col items-center justify-center text-center">
              <FileText className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-mamas-text font-medium">All caught up!</p>
              <p className="text-sm text-mamas-text-muted mt-1">No pending contributions to verify.</p>
            </li>
          ) : (
            contributions.map(contribution => {
              const member = usersCache[contribution.userId];
              return (
                <li key={contribution.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          contribution.type === 'welfare' ? 'bg-mamas-accent/10 text-mamas-accent-hover' : 'bg-blue-50 text-blue-600'
                        }`}>
                          {contribution.type === 'welfare' ? 'Welfare Fund' : 'Campaign'}
                        </span>
                        <span className="text-xs text-mamas-text-muted font-medium">{new Date(contribution.createdAt).toLocaleString()}</span>
                      </div>
                      
                      <div className="mt-2">
                        <p className="text-sm text-mamas-text-muted">Member</p>
                        <p className="font-semibold text-mamas-text text-lg">{member?.fullName || 'Unknown'}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mt-4 bg-white p-3 rounded-xl border border-slate-100">
                        <div>
                          <p className="text-xs text-mamas-text-muted uppercase tracking-wider mb-1">Amount</p>
                          <p className="font-bold text-mamas-primary text-lg">{formatUGX(contribution.amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-mamas-text-muted uppercase tracking-wider mb-1">Reference</p>
                          <p className="font-mono text-sm text-slate-700 font-medium bg-slate-50 px-2 py-1 rounded inline-block">{contribution.transactionReference}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-row md:flex-col gap-3 md:w-40 flex-shrink-0">
                      <button onClick={() => handleVerify(contribution.id)} className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors">
                        <Check className="w-4 h-4" /> Verify
                      </button>
                      <button onClick={() => handleReject(contribution.id)} className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors">
                        <X className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
