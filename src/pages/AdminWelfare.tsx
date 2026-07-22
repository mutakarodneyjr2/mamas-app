import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { WelfareRequest, User, AppSettings } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { castWelfareVote, markWelfareAsPaid, logActivity } from '../lib/services';
import { formatUGX } from '../lib/utils';
import { Heart, FileText, CheckCircle, XCircle, Clock, Banknote, Shield } from 'lucide-react';

export default function AdminWelfare() {
  const { currentUser, userProfile } = useAuth();
  const [requests, setRequests] = useState<WelfareRequest[]>([]);
  const [usersCache, setUsersCache] = useState<Record<string, User>>({});
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Treasurer specific state
  const [payAmount, setPayAmount] = useState<Record<string, string>>({});
  const [payRef, setPayRef] = useState<Record<string, string>>({});
  const [payAccountName, setPayAccountName] = useState<Record<string, string>>({});
  const [payNotes, setPayNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchSettings = async () => {
      const docSnap = await getDoc(doc(db, 'appSettings', 'main'));
      if (docSnap.exists()) {
        setSettings({ id: 'main', ...docSnap.data() } as AppSettings);
      }
    };
    fetchSettings();

    const q = query(
      collection(db, 'welfareRequests'),
      where('status', 'in', ['pending', 'accepted'])
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data: WelfareRequest[] = [];
      const userIds = new Set<string>();

      snapshot.forEach(d => {
        const r = { id: d.id, ...d.data() } as WelfareRequest;
        data.push(r);
        userIds.add(r.userId);
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
      setRequests(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [usersCache]);

  if (!currentUser || !userProfile || !settings) return null;

  const isApprover = settings.welfareApprovers.includes(currentUser.uid);
  const isSuperAdmin = userProfile.role === 'super_admin';
  const isTreasurer = userProfile.role === 'treasurer';

  if (!isApprover && !isSuperAdmin && !isTreasurer) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Shield className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-mamas-text">Access Denied</h2>
        <p className="text-mamas-text-muted mt-2">You are not authorized to view this page.</p>
      </div>
    );
  }

  const handleVote = async (requestId: string, vote: 'approve' | 'reject') => {
    if (!isApprover) {
      alert("Only designated Welfare Approvers can cast a vote.");
      return;
    }
    try {
      await castWelfareVote(requestId, currentUser.uid, vote);
      await logActivity('VOTE_WELFARE_REQUEST', currentUser.uid, requestId, `Voted ${vote} on welfare request`);
    } catch (err: any) {
      alert(err.message || 'Failed to cast vote.');
    }
  };

  const handlePay = async (requestId: string, requestedAmount: number) => {
    if (!isTreasurer && !isSuperAdmin) {
      alert("Only the Treasurer can issue payments.");
      return;
    }
    const amountStr = payAmount[requestId] || requestedAmount.toString();
    const refStr = payRef[requestId];
    const accountNameStr = payAccountName[requestId];
    const notesStr = payNotes[requestId];
    
    if (!amountStr || !refStr || !accountNameStr || !notesStr) {
      alert("Please fill in Amount, Reference, Account Name, and Notes.");
      return;
    }

    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount <= 0) {
      alert("Invalid amount.");
      return;
    }

    try {
      await markWelfareAsPaid(requestId, amount, refStr, currentUser.uid, accountNameStr, notesStr);
      await logActivity('PAY_WELFARE_REQUEST', currentUser.uid, requestId, `Issued welfare payout of UGX ${amount}`);
      alert("Payment recorded successfully.");
    } catch (err: any) {
      alert(err.message || 'Failed to record payment.');
    }
  };

  if (loading) return <div className="p-8 text-center text-mamas-text-muted">Loading requests...</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h2 className="text-2xl font-display font-bold text-mamas-text flex items-center gap-2">
            <Heart className="w-6 h-6 text-mamas-accent" /> Welfare Review
          </h2>
          <p className="text-mamas-text-muted text-sm mt-1">
            {isApprover ? "You are a designated Approver (2-out-of-3 required)." : "Viewing pending requests and payouts."}
          </p>
        </div>
      </div>

      <div className="bg-mamas-card rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        
        <ul className="divide-y divide-slate-100">
          {requests.length === 0 ? (
            <li className="px-6 py-12 flex flex-col items-center justify-center text-center">
              <FileText className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-mamas-text font-medium">No pending requests</p>
              <p className="text-sm text-slate-500 mt-1">All welfare requests have been processed.</p>
            </li>
          ) : (
            requests.map(request => {
              const member = usersCache[request.userId];
              const myVote = request.votes.find(v => v.userId === currentUser.uid);
              const approveCount = request.votes.filter(v => v.vote === 'approve').length;
              const rejectCount = request.votes.filter(v => v.vote === 'reject').length;
              const isAccepted = request.status === 'accepted';

              return (
                <li key={request.id} className="p-6 md:p-8 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-col lg:flex-row gap-8">
                    
                    {/* Details */}
                    <div className="flex-1 space-y-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isAccepted ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {request.status}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">{new Date(request.createdAt).toLocaleString()}</span>
                          </div>
                          <h4 className="text-xl font-display font-bold text-mamas-text mt-2">{request.category}</h4>
                          <p className="text-sm font-semibold text-slate-500 mt-1">
                            Applied by: <span className="text-mamas-text">{member?.fullName || 'Unknown'}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Requested</p>
                          <p className="text-2xl font-bold text-mamas-text">{formatUGX(request.amountRequested)}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm bg-white p-5 rounded-2xl border border-slate-100">
                        <div>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Beneficiary</p>
                          <p className="font-bold text-mamas-text">{request.personName}</p>
                          <p className="text-xs text-slate-500">{request.relationship}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Location</p>
                          <p className="font-bold text-mamas-text">{request.villageTown}</p>
                          <p className="text-xs text-slate-500">{request.district}</p>
                        </div>
                      </div>

                      <div>
                        <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Description</h5>
                        <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                          {request.description}
                        </p>
                      </div>

                      {request.evidenceUrls && request.evidenceUrls.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Supporting Evidence</h5>
                          <div className="flex flex-wrap gap-2">
                            {request.evidenceUrls.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors">
                                <FileText className="w-3.5 h-3.5" /> View Attachment {i + 1}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions Panel */}
                    <div className="lg:w-80 flex flex-col gap-4">
                      
                      {/* Voting Box */}
                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                        <h5 className="text-sm font-bold text-mamas-text mb-4 border-b border-slate-200 pb-2">Committee Approval</h5>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-semibold text-slate-500">Approvals (Needs 2)</span>
                          <span className="text-sm font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded">{approveCount}/2</span>
                        </div>
                        <div className="flex justify-between items-center mb-6">
                          <span className="text-xs font-semibold text-slate-500">Rejections</span>
                          <span className="text-sm font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">{rejectCount}/2</span>
                        </div>

                        {request.status === 'pending' && isApprover && (
                          <div className="space-y-3">
                            {myVote ? (
                              <div className={`text-sm font-bold text-center p-3 rounded-xl border ${myVote.vote === 'approve' ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                You voted to {myVote.vote}
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => handleVote(request.id!, 'approve')} className="flex items-center justify-center gap-1 bg-teal-500 hover:bg-teal-600 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                                  <CheckCircle className="w-4 h-4" /> Approve
                                </button>
                                <button onClick={() => handleVote(request.id!, 'reject')} className="flex items-center justify-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                                  <XCircle className="w-4 h-4" /> Reject
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Treasurer Payout Box */}
                      {isAccepted && (isTreasurer || isSuperAdmin) && (
                        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 shadow-sm mt-auto">
                          <h5 className="text-sm font-bold text-amber-900 mb-4 flex items-center gap-2 border-b border-amber-200/50 pb-2">
                            <Banknote className="w-4 h-4" /> Issue Payout
                          </h5>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Paid Amount (UGX)</label>
                              <input
                                type="number"
                                className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 outline-none font-bold text-slate-800"
                                value={payAmount[request.id!] || request.amountRequested.toString()}
                                onChange={(e) => setPayAmount(prev => ({ ...prev, [request.id!]: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Bank / MM Reference No.</label>
                              <input
                                type="text"
                                className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 outline-none font-mono text-slate-800 uppercase"
                                placeholder="Ref Number"
                                value={payRef[request.id!] || ''}
                                onChange={(e) => setPayRef(prev => ({ ...prev, [request.id!]: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Sent to Account Name</label>
                              <input
                                type="text"
                                className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 outline-none font-medium text-slate-800"
                                placeholder="Name on account"
                                value={payAccountName[request.id!] || ''}
                                onChange={(e) => setPayAccountName(prev => ({ ...prev, [request.id!]: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Treasurer Notes</label>
                              <textarea
                                className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 outline-none font-medium text-slate-800 resize-y"
                                placeholder="Any details about the transfer"
                                rows={2}
                                value={payNotes[request.id!] || ''}
                                onChange={(e) => setPayNotes(prev => ({ ...prev, [request.id!]: e.target.value }))}
                              />
                            </div>
                            <button
                              onClick={() => handlePay(request.id!, request.amountRequested)}
                              className="w-full mt-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-4 rounded-xl shadow-sm transition-colors text-sm"
                            >
                              Mark as Paid
                            </button>
                          </div>
                        </div>
                      )}

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
