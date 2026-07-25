import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { WelfareRequest, User, AppSettings } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { castWelfareVote, markWelfareAsPaid, logActivity, initiateWelfareDisbursement } from '../lib/services';
import { formatUGX, exportToCSV } from '../lib/utils';
import { Heart, FileText, CheckCircle, XCircle, Clock, Banknote, Shield, Search, Filter, Download, ChevronDown, Calendar, DollarSign } from 'lucide-react';

export default function AdminWelfare() {
  const { currentUser, userProfile } = useAuth();
  const isAuditor = userProfile?.role === 'auditor';
  const canExport = ["super_admin", "chairperson", "vice_chairperson", "treasurer", "auditor", "secretary"].includes(userProfile?.role || "");
  const [requests, setRequests] = useState<WelfareRequest[]>([]);
  const [usersCache, setUsersCache] = useState<Record<string, User>>({});
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected' | 'paid'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Treasurer specific state
  const [payAmount, setPayAmount] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchSettings = async () => {
      const docSnap = await getDoc(doc(db, 'appSettings', 'main'));
      if (docSnap.exists()) {
        setSettings({ id: 'main', ...docSnap.data() } as AppSettings);
      }
    };
    fetchSettings();

    const q = query(collection(db, 'welfareRequests'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data: WelfareRequest[] = [];
      const userIds = new Set<string>();

      snapshot.forEach(d => {
        const r = { id: d.id, ...d.data() } as WelfareRequest;
        data.push(r);
        userIds.add(r.userId);
      });

      data.sort((a, b) => b.createdAt - a.createdAt);

      userIds.forEach(uid => {
        if (!usersCache[uid]) {
          getDoc(doc(db, 'users', uid)).then(uDoc => {
            if (uDoc.exists()) {
              setUsersCache(curr => ({ ...curr, [uid]: uDoc.data() as User }));
            }
          });
        }
      });

      setRequests(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (!currentUser || !userProfile) return null;
  if (loading && !settings) return <div className="p-8 text-center text-mamas-text-muted">Loading welfare review...</div>;
  const activeSettings = settings || { welfareApprovers: [], allowedRelationships: [], welfareCategories: [] };

  const isApprover = activeSettings.welfareApprovers.includes(currentUser.uid) && !isAuditor;
  const isSuperAdmin = userProfile.role === 'super_admin';
  const isTreasurer = userProfile.role === 'treasurer';
  const isChairperson = userProfile.role === 'chairperson';
  const isViceChairperson = userProfile.role === 'vice_chairperson';
  const isSecretary = userProfile.role === 'secretary';

  if (!isApprover && !isSuperAdmin && !isTreasurer && !isAuditor && !isChairperson && !isViceChairperson && !isSecretary) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Shield className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-mamas-text">Access Denied</h2>
        <p className="text-mamas-text-muted mt-2">You are not authorized to view this page.</p>
      </div>
    );
  }

  const filteredRequests = (Array.isArray(requests) ? requests : []).filter(r => {
    if (!r) return false;
    const member = usersCache?.[r.userId];
    const memberName = String(member?.fullName || '').toLowerCase();
    const cat = String(r.category || '').toLowerCase();
    const desc = String(r.description || '').toLowerCase();
    const search = String(searchTerm || '').toLowerCase();
    const phone = String(member?.phoneNumber || '');

    const matchesSearch = memberName.includes(search) || cat.includes(search) || desc.includes(search) || phone.includes(search);
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter;

    const rDate = typeof r.createdAt === 'number' ? r.createdAt : 0;
    const matchesStartDate = !startDate || rDate >= new Date(startDate).getTime();
    const matchesEndDate = !endDate || rDate <= new Date(endDate).setHours(23, 59, 59, 999);

    const matchesMinAmount = !minAmount || (r.amountRequested || 0) >= Number(minAmount);
    const matchesMaxAmount = !maxAmount || (r.amountRequested || 0) <= Number(maxAmount);

    return matchesSearch && matchesStatus && matchesCategory && matchesStartDate && matchesEndDate && matchesMinAmount && matchesMaxAmount;
  });

  const handleExportCSV = () => {
    const exportData = filteredRequests.map(r => {
      const member = usersCache[r.userId];
      return {
        Date: new Date(typeof r.createdAt === 'number' ? r.createdAt : Date.now()).toLocaleString(),
        MemberName: member?.fullName || 'Unknown',
        PhoneNumber: member?.phoneNumber || '',
        Category: r.category,
        AmountRequested: r.amountRequested,
        Status: r.status,
        Relationship: r.relationship || '',
        BeneficiaryName: r.beneficiaryName || ''
      };
    });
    exportToCSV('mamas_welfare_requests', exportData);
  };

  const handleVote = async (requestId: string, vote: 'approve' | 'reject', requestUserId: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    const eligibleApprovers = activeSettings.welfareApprovers.filter(id => id !== requestUserId);
    const isEscalatedEligible = eligibleApprovers.length < 2 && (isSuperAdmin || isChairperson || isViceChairperson || isAuditor);
    
    if (!isApprover && !isEscalatedEligible) {
      setErrorMsg("Only designated Welfare Approvers can cast a vote.");
      setTimeout(() => setErrorMsg(''), 5000);
      return;
    }
    try {
      await castWelfareVote(requestId, currentUser.uid, vote);
      await logActivity('VOTE_WELFARE_REQUEST', currentUser.uid, requestId, `Voted ${vote} on welfare request`);
      setSuccessMsg(`Successfully voted to ${vote}.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to cast vote.');
      setTimeout(() => setErrorMsg(''), 5000);
    }
  };

  const handlePay = async (requestId: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!isTreasurer && !isSuperAdmin) {
      setErrorMsg("Only the Treasurer can issue payments.");
      setTimeout(() => setErrorMsg(''), 5000);
      return;
    }
    
    try {
      await initiateWelfareDisbursement(requestId, currentUser.uid);
      setSuccessMsg("Disbursement initiated via Mobile Money.");
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initiate disbursement.');
      setTimeout(() => setErrorMsg(''), 5000);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h2 className="text-2xl font-display font-bold text-mamas-text flex items-center gap-2">
            <Heart className="w-6 h-6 text-mamas-accent" /> Welfare Review & Payouts
          </h2>
          <p className="text-mamas-text-muted text-sm mt-1">
            {isApprover ? "You are a designated Approver (2-out-of-3 required)." : "Viewing welfare requests and payout history."}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-sm font-medium animate-in fade-in">
          {errorMsg}
        </div>
      )}
      
      {successMsg && (
        <div className="bg-teal-50 border border-teal-200 text-teal-800 p-4 rounded-2xl text-sm font-medium animate-in fade-in">
          {successMsg}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-mamas-card p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search member, category, description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-mamas-accent font-medium"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 text-mamas-text text-xs rounded-xl px-3 py-2 outline-none font-bold"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                showAdvancedFilters ? 'bg-mamas-primary text-white border-mamas-primary' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Filter className="w-3.5 h-3.5" /> Filters <ChevronDown className={`w-3 h-3 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
            </button>

            {canExport && (
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-colors shadow-sm"
                title="Export filtered welfare requests as CSV"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            )}
          </div>
        </div>

        {/* Advanced Filters Drawer */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-3 animate-in fade-in duration-200">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-mamas-text outline-none"
              >
                <option value="all">All Categories</option>
                {activeSettings.welfareCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-mamas-text outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-mamas-text outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Min (UGX)</label>
                <input
                  type="number"
                  placeholder="Min"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs font-semibold text-mamas-text outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Max (UGX)</label>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs font-semibold text-mamas-text outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-mamas-card rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-base font-bold text-mamas-text">Welfare Requests ({filteredRequests.length})</h3>
        </div>
        
        <ul className="divide-y divide-slate-100">
          {filteredRequests.length === 0 ? (
            <li className="px-6 py-12 flex flex-col items-center justify-center text-center">
              <FileText className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-mamas-text font-medium">No welfare requests found</p>
              <p className="text-sm text-slate-500 mt-1">Try adjusting your search or filters.</p>
            </li>
          ) : (
            filteredRequests.map(request => {
              const member = usersCache[request.userId];
              const votes = request.votes || [];
              const myVote = votes.find(v => v.userId === currentUser.uid);
              const approveCount = votes.filter(v => v.vote === 'approve').length;
              const rejectCount = votes.filter(v => v.vote === 'reject').length;
              const isAccepted = request.status === 'accepted';
              const isPaid = request.status === 'paid';

              return (
                <li key={request.id} className="p-6 md:p-8 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-col lg:flex-row gap-8">
                    
                    {/* Details */}
                    <div className="flex-1 space-y-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isPaid ? 'bg-blue-50 text-blue-700' : isAccepted ? 'bg-teal-50 text-teal-700' : request.status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {request.status}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">{new Date(typeof request.createdAt === 'number' ? request.createdAt : Date.now()).toLocaleString()}</span>
                          </div>
                          <h4 className="text-xl font-display font-bold text-mamas-text mt-2">{request.category}</h4>
                          <p className="text-sm font-semibold text-slate-500 mt-1">
                            Applied by: <span className="text-mamas-text">{member?.fullName || 'Unknown'}</span> ({member?.phoneNumber || ''})
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Requested Amount</p>
                          <p className="text-2xl font-bold text-mamas-primary">{formatUGX(request.amountRequested)}</p>
                        </div>
                      </div>

                      {/* Relationship & Beneficiary info */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Relationship</span>
                          <span className="font-semibold text-mamas-text capitalize">{request.relationship}</span>
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Beneficiary Name</span>
                          <span className="font-semibold text-mamas-text">{request.beneficiaryName}</span>
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Reason / Description</h5>
                        <p className="text-sm text-slate-700 bg-white p-4 rounded-2xl border border-slate-200/60 leading-relaxed">
                          {request.description}
                        </p>
                      </div>

                      {/* Voting progress */}
                      <div className="bg-white p-4 rounded-2xl border border-slate-200/60 space-y-3">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-600 uppercase tracking-wider">Approver Votes (2 out of 3 Required)</span>
                          <span className="text-mamas-primary">{approveCount} / 3 Approvals</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div className="bg-teal-600 h-full transition-all" style={{ width: `${Math.min(100, (approveCount / 3) * 100)}%` }} />
                        </div>
                        <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                          <span className="text-teal-700 font-bold">Approve: {approveCount}</span>
                          <span className="text-rose-700 font-bold">Reject: {rejectCount}</span>
                        </div>
                      </div>

                    </div>

                    {/* Action Column */}
                    <div className="lg:w-80 flex flex-col gap-4 border-t lg:border-t-0 lg:border-l border-slate-100 pt-6 lg:pt-0 lg:pl-8 justify-between">
                      
                      {/* Voting section */}
                      {request.status === 'pending' && !isAuditor && (
                        request.userId === currentUser.uid ? (
                          <div className="text-xs font-bold text-center p-3 rounded-xl border bg-amber-50 text-amber-700 border-amber-200">
                            Conflict of Interest:<br/>You cannot vote on your own request.
                          </div>
                        ) : myVote ? (
                          <div className={`text-sm font-bold text-center p-3 rounded-xl border ${myVote.vote === 'approve' ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                            You voted to {myVote.vote}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cast Your Vote</h5>
                            <button
                              onClick={() => handleVote(request.id!, 'approve', request.userId)}
                              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors shadow-sm"
                            >
                              Approve Request
                            </button>
                            <button
                              onClick={() => handleVote(request.id!, 'reject', request.userId)}
                              className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors"
                            >
                              Reject Request
                            </button>
                          </div>
                        )
                      )}

                      {/* Treasurer Payout Box */}
                      {isAccepted && (isTreasurer || isSuperAdmin) && (
                        request.userId === currentUser.uid ? (
                          <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 shadow-sm mt-auto text-center">
                            <h5 className="text-sm font-bold text-amber-900 mb-1">Conflict of Interest</h5>
                            <p className="text-xs font-semibold text-amber-700">You cannot issue payout for your own request. Another authorized member must do it.</p>
                          </div>
                        ) : (
                          <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 shadow-sm mt-auto">
                            <h5 className="text-sm font-bold text-amber-900 mb-4 flex items-center gap-2 border-b border-amber-200/50 pb-2">
                              <Banknote className="w-4 h-4" /> Issue Payout
                            </h5>
                            
                            {request.disbursementStatus === 'processing' ? (
                              <div className="text-center py-4">
                                <div className="w-8 h-8 border-4 border-amber-300 border-t-amber-600 rounded-full animate-spin mx-auto mb-2"></div>
                                <p className="text-sm font-bold text-amber-800">Processing Payment...</p>
                                <p className="text-xs text-amber-600 mt-1">Waiting for mobile money confirmation</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="bg-white p-3 rounded-xl border border-amber-100 flex justify-between items-center">
                                  <div className="text-xs text-slate-500">Pay to</div>
                                  <div className="font-bold text-slate-800">{request.recipientPhoneNumber}</div>
                                </div>
                                <div className="bg-white p-3 rounded-xl border border-amber-100 flex justify-between items-center mb-4">
                                  <div className="text-xs text-slate-500">Amount</div>
                                  <div className="font-bold text-mamas-primary">UGX {new Intl.NumberFormat('en-UG').format(request.amountRequested)}</div>
                                </div>
                                <button
                                  onClick={() => handlePay(request.id!)}
                                  className="w-full mt-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-4 rounded-xl shadow-sm transition-colors text-sm flex items-center justify-center gap-2"
                                >
                                  <Banknote className="w-4 h-4" /> Pay with Mobile Money
                                </button>
                                {request.disbursementStatus === 'failed' && (
                                  <p className="text-xs font-bold text-rose-600 text-center mt-2">
                                    Previous attempt failed. You can try again.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )
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
