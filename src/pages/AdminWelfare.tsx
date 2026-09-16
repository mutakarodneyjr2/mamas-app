import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { WelfareRequest, User, AppSettings } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { castWelfareVote, markWelfareAsPaid, logActivity, initiateWelfareDisbursement } from '../lib/services';
import { formatUGX, exportToCSV } from '../lib/utils';
import { Heart, FileText, CheckCircle, XCircle, Clock, Banknote, Shield, Search, Filter, Download, ChevronDown, ChevronUp, Calendar, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';

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
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'declined' | 'paid'>('all');

  // Vote Confirmation Modal state
  const [votingModal, setVotingModal] = useState<{
    requestId: string;
    vote: 'approve' | 'reject';
    requestUserId: string;
    category: string;
    personName: string;
    amountRequested: number;
  } | null>(null);
  const [voteReason, setVoteReason] = useState('');
  const [votingLoading, setVotingLoading] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const fetchSettings = async () => {
      const docSnap = await getDoc(doc(db, 'appSettings', 'main'));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings({ id: 'main', welfareCategories: [], allowedRelationships: [], maxAmounts: {}, ...data, welfareApprovers: data.welfareApprovers || [] } as AppSettings);
      }
    };
    fetchSettings();

    const fetchUsers = async () => {
      try {
        const uSnap = await getDocs(collection(db, 'users'));
        const uMap: Record<string, User> = {};
        uSnap.forEach(d => {
          uMap[d.id] = d.data() as User;
        });
        setUsersCache(uMap);
      } catch (err) {
        console.error("Error loading users:", err);
      }
    };
    fetchUsers();

    const q = query(collection(db, 'welfareRequests'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: WelfareRequest[] = [];
      snapshot.forEach(d => {
        data.push({ id: d.id, ...d.data() } as WelfareRequest);
      });
      data.sort((a, b) => b.createdAt - a.createdAt);
      setRequests(data);
      setLoading(false);
    }, (error) => {
      console.error("Error loading welfare requests:", error);
      setErrorMsg("Failed to load welfare requests. Please check your permissions or try again.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  if (!currentUser || !userProfile) return null;
  if (loading && !settings) return <div className="p-8 text-center text-slate-400 font-medium">Loading welfare claims...</div>;
  const activeSettings = settings || { welfareApprovers: [], allowedRelationships: [], welfareCategories: [] };

  const isApprover = (activeSettings.welfareApprovers || []).includes(currentUser.uid) && !isAuditor;
  const isSuperAdmin = userProfile.role === 'super_admin';
  const isTreasurer = userProfile.role === 'treasurer';
  const isChairperson = userProfile.role === 'chairperson';
  const isViceChairperson = userProfile.role === 'vice_chairperson';
  const isSecretary = userProfile.role === 'secretary';

  if (!isApprover && !isSuperAdmin && !isTreasurer && !isAuditor && !isChairperson && !isViceChairperson && !isSecretary) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center max-w-md mx-auto my-12 bg-white dark:bg-[#0c1731] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <Shield className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Access Denied</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">You are not authorized to view the welfare administration panel.</p>
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

    return matchesSearch && matchesStatus;
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
        BeneficiaryName: r.personName || ''
      };
    });
    exportToCSV('mamas_welfare_requests', exportData);
  };

  const openVoteModal = (requestId: string, vote: 'approve' | 'reject', requestUserId: string, category: string, personName: string, amountRequested: number) => {
    setErrorMsg('');
    setSuccessMsg('');
    const eligibleApprovers = activeSettings.welfareApprovers.filter(id => id !== requestUserId);
    const isEscalatedEligible = eligibleApprovers.length < 2 && (isSuperAdmin || isChairperson || isViceChairperson);
    
    if (!isApprover && !isEscalatedEligible) {
      setErrorMsg("Only designated Welfare Approvers can cast a vote.");
      setTimeout(() => setErrorMsg(''), 5000);
      return;
    }

    setVoteReason('');
    setVotingModal({ requestId, vote, requestUserId, category, personName, amountRequested });
  };

  const submitVote = async () => {
    if (!votingModal) return;
    setVotingLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await castWelfareVote(votingModal.requestId, currentUser.uid, votingModal.vote, voteReason);
      setSuccessMsg(`Successfully voted to ${votingModal.vote}.`);
      setVotingModal(null);
      setVoteReason('');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to cast vote.');
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setVotingLoading(false);
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

  const toggleExpand = (id: string) => {
    setExpandedRow(prev => prev === id ? null : id);
  };

  const renderRequestCard = (request: WelfareRequest) => {
    const member = usersCache[request.userId];
    const votes = request.votes || [];
    const myVote = votes.find(v => v.userId === currentUser.uid);
    const approveCount = votes.filter(v => v.vote === 'approve').length;
    const rejectCount = votes.filter(v => v.vote === 'reject').length;
    const isAccepted = request.status === 'accepted';
    const isPaid = request.status === 'paid';
    const isDeclined = request.status === 'declined';

    return (
      <div 
        key={request.id} 
        className="bg-white dark:bg-[#0c1731] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 flex flex-col transition-all hover:border-blue-500/40"
      >
        <div 
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
          onClick={() => toggleExpand(request.id!)}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
              isPaid 
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/60' 
                : isAccepted 
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60' 
                : isDeclined 
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60' 
                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/60'
            }`}>
              {isPaid ? <Banknote className="w-5 h-5" /> : isAccepted ? <CheckCircle className="w-5 h-5" /> : isDeclined ? <XCircle className="w-5 h-5" /> : <Heart className="w-5 h-5" />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">{request.category}</p>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                  isPaid 
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/60' 
                    : isAccepted 
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60' 
                    : isDeclined 
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/60' 
                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/60'
                }`}>
                  {request.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium">
                {member?.fullName || 'Unknown Member'} • {new Date(typeof request.createdAt === 'number' ? request.createdAt : Date.now()).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-center">
            <div className="text-right">
              <p className="text-base font-extrabold text-slate-900 dark:text-white font-mono">{formatUGX(request.amountRequested)}</p>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                {approveCount + rejectCount}/3 votes recorded
              </p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 flex items-center justify-center text-slate-400">
              {expandedRow === request.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </div>

        {/* Expanded Detail Accordion */}
        {expandedRow === request.id && (
          <div className="border-t border-slate-100 dark:border-slate-800 mt-4 pt-4 animate-in slide-in-from-top-2 duration-200 space-y-4">
            <div className="bg-slate-50/70 dark:bg-slate-900/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/80">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">Beneficiary & Relation</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white capitalize">{request.personName} ({request.relationship})</span>
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">Member Phone Contact</span>
                  <span className="text-xs font-bold font-mono text-slate-900 dark:text-white">{member?.phoneNumber || 'N/A'}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">Claim Justification</span>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-white dark:bg-[#0c1731] p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800">
                  {request.description}
                </p>
              </div>

              {/* Progress of Votes */}
              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3">
                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                  {(approveCount > 0 || rejectCount > 0) ? `${approveCount + rejectCount} of 3 Required Approvals` : 'Awaiting Committee Votes'}
                </span>
                <div className="flex-1 mx-3 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (approveCount / 3) * 100)}%` }} />
                </div>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {approveCount} Appr • {rejectCount} Rej
                </span>
              </div>

              {/* Committee notes */}
              {votes.some(v => v.reason) && (
                <div className="mt-4 space-y-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">Approver Notes</span>
                  {votes.filter(v => v.reason).map((v, idx) => {
                    const voterObj = usersCache[v.userId];
                    return (
                      <div key={idx} className="bg-white dark:bg-[#0c1731] rounded-xl border border-slate-200/60 dark:border-slate-800 p-3 text-xs text-slate-700 dark:text-slate-300 shadow-2xs">
                        <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                          <span className="text-slate-900 dark:text-white">{voterObj?.fullName || 'Approver'}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-extrabold border ${
                            v.vote === 'approve' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {v.vote}
                          </span>
                        </div>
                        <p className="italic text-slate-600 dark:text-slate-400">"{v.reason}"</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Action Buttons */}
              {request.status === 'pending' && !isAuditor && (
                <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800">
                  {request.userId === currentUser.uid ? (
                    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-3 text-xs font-bold text-amber-800 dark:text-amber-300 text-center">
                      Conflict of Interest: You cannot vote on your own welfare request.
                    </div>
                  ) : myVote ? (
                    <div className={`rounded-2xl p-3 text-xs font-extrabold text-center border ${
                      myVote.vote === 'approve' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' 
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                    }`}>
                      You have voted to {myVote.vote} this claim.
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); openVoteModal(request.id!, 'approve', request.userId, request.category, request.personName, request.amountRequested); }}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-3 text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        Approve Claim
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); openVoteModal(request.id!, 'reject', request.userId, request.category, request.personName, request.amountRequested); }}
                        className="flex-1 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-2xl py-3 text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                      >
                        Reject Claim
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Payout Trigger for Treasurer */}
              {isAccepted && (isTreasurer || isSuperAdmin) && (
                <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800">
                  {request.userId === currentUser.uid ? (
                    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-3 text-xs font-bold text-amber-800 dark:text-amber-300 text-center">
                      Conflict of Interest: Another authorized executive must disburse this payout.
                    </div>
                  ) : (
                    <div>
                      {request.disbursementStatus === 'processing' ? (
                        <div className="text-center py-2">
                          <div className="w-5 h-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-1.5" />
                          <p className="text-xs font-extrabold text-blue-700 dark:text-blue-400">Processing Mobile Money Payout...</p>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePay(request.id!); }}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-3 text-xs font-extrabold uppercase tracking-wider shadow-xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Banknote className="w-4 h-4" /> Issue Mobile Money Payout ({formatUGX(request.amountRequested)})
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    );
  };

  const activeRequests = statusFilter === 'all' ? filteredRequests.filter(r => r.status !== 'paid') : filteredRequests;
  const historyRequests = statusFilter === 'all' ? filteredRequests.filter(r => r.status === 'paid') : [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 px-4 font-sans">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/50 dark:border-blue-900/60">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 text-[10px] font-extrabold uppercase tracking-wider rounded-full px-2.5 py-0.5 border border-blue-200 dark:border-blue-900/60">
                Welfare Governance
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Welfare Claims & Approvals
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Review bereavement and marriage support requests, vote, and disburse payouts
            </p>
          </div>
        </div>

        {canExport && (
          <button
            onClick={handleExportCSV}
            className="self-start sm:self-auto inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-4 py-2.5 text-xs font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white dark:bg-[#0c1731] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide no-scrollbar w-full">
          {[
            { id: 'all', label: 'All Requests' },
            { id: 'pending', label: 'Pending Review' },
            { id: 'accepted', label: 'Approved (Pending Payout)' },
            { id: 'paid', label: 'Paid Out' },
            { id: 'declined', label: 'Declined' }
          ].map(tab => {
            const isActive = statusFilter === tab.id;
            const count = (requests || []).filter(r => tab.id === 'all' ? true : r.status === tab.id).length;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={`flex items-center shrink-0 rounded-2xl px-4 py-2 text-xs whitespace-nowrap transition-all font-extrabold cursor-pointer ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700'
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by member name, category, beneficiary, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 pl-11 pr-4 text-xs sm:text-sm outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 font-medium"
          />
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-3.5">
        {filteredRequests.length === 0 ? (
          <div className="bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 rounded-3xl py-16 px-4 flex flex-col items-center justify-center text-center shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 border border-blue-200/60 dark:border-blue-900/60">
              <Heart className="w-7 h-7" />
            </div>
            <p className="text-base font-extrabold text-slate-900 dark:text-white">
              {searchTerm || statusFilter !== 'all' ? "No requests match your filter" : "No welfare requests submitted"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              {searchTerm || statusFilter !== 'all' ? "Try adjusting your search query or switching tabs." : "Submitted welfare claims will appear here for executive audit."}
            </p>
          </div>
        ) : (
          <>
            {activeRequests.map(request => renderRequestCard(request))}
            
            {historyRequests.length > 0 && (
              <div className="mt-8 pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 text-[10px] font-extrabold uppercase tracking-wider rounded-full px-2.5 py-0.5 border border-blue-200 dark:border-blue-900/60">
                    Disbursed Payouts
                  </span>
                  <span className="text-xs font-mono text-slate-400">({historyRequests.length})</span>
                </div>
                <div className="space-y-3.5">
                  {historyRequests.map(request => renderRequestCard(request))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Vote Confirmation Modal */}
      {votingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200" onClick={() => !votingLoading && setVotingModal(null)}>
          <div 
            className="bg-white dark:bg-[#0c1731] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3.5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                votingModal.vote === 'approve' 
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' 
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
              }`}>
                {votingModal.vote === 'approve' ? <CheckCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg">
                  {votingModal.vote === 'approve' ? 'Approve Welfare Claim' : 'Reject Welfare Claim'}
                </h3>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {votingModal.category} • <span className="font-mono text-slate-900 dark:text-white">{formatUGX(votingModal.amountRequested)}</span>
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
              Beneficiary: <span className="font-bold text-slate-900 dark:text-white">{votingModal.personName}</span>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                Committee Reason & Feedback {votingModal.vote === 'reject' ? '(Required)' : '(Optional)'}
              </label>
              <textarea
                value={voteReason}
                onChange={(e) => setVoteReason(e.target.value)}
                placeholder={votingModal.vote === 'approve' ? "Add feedback or condolences/congratulations..." : "Provide clear justification for claim rejection..."}
                rows={3}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 text-xs text-slate-900 dark:text-white outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition-all resize-none font-medium placeholder:text-slate-400"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setVotingModal(null)}
                disabled={votingLoading}
                className="flex-1 py-3 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitVote}
                disabled={votingLoading || (votingModal.vote === 'reject' && !voteReason.trim())}
                className={`flex-1 py-3 px-4 rounded-2xl text-xs font-extrabold uppercase tracking-wider text-white shadow-xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                  votingModal.vote === 'approve' 
                    ? 'bg-emerald-600 hover:bg-emerald-700' 
                    : 'bg-rose-600 hover:bg-rose-700'
                } disabled:opacity-50`}
              >
                {votingLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  `Confirm ${votingModal.vote === 'approve' ? 'Approval' : 'Rejection'}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
