import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { WelfareRequest, User, AppSettings } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { castWelfareVote, markWelfareAsPaid, logActivity, initiateWelfareDisbursement } from '../lib/services';
import { formatUGX, exportToCSV } from '../lib/utils';
import { Heart, FileText, CheckCircle, XCircle, Clock, Banknote, Shield, Search, Filter, Download, ChevronDown, ChevronUp, Calendar, DollarSign } from 'lucide-react';

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
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Treasurer specific state
  const [payAmount, setPayAmount] = useState<Record<string, string>>({});

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
        const r = { id: d.id, ...d.data() } as WelfareRequest;
        data.push(r);
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
  if (loading && !settings) return <div className="p-8 text-center text-mamas-text-muted">Loading welfare review...</div>;
  const activeSettings = settings || { welfareApprovers: [], allowedRelationships: [], welfareCategories: [] };

  const isApprover = (activeSettings.welfareApprovers || []).includes(currentUser.uid) && !isAuditor;
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

    return (
      <div key={request.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 flex flex-col transition-all duration-200">
        <div 
          className={`flex items-center gap-3 cursor-pointer select-none border-l-4 pl-3 -ml-3.5 rounded-l-md transition-all active:scale-[0.98] ${
            isPaid ? 'border-l-navy-900' : isAccepted ? 'border-l-emerald-400' : request.status === 'declined' ? 'border-l-rose-400' : 'border-l-amber-400'
          }`}
          onClick={() => toggleExpand(request.id!)}
        >
          {/* Icon */}
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
            isPaid ? 'bg-navy-50 text-navy-600' : isAccepted ? 'bg-emerald-50 text-emerald-600' : request.status === 'declined' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
          }`}>
            {isPaid ? <Banknote className="w-4 h-4" /> : isAccepted ? <CheckCircle className="w-4 h-4" /> : request.status === 'declined' ? <XCircle className="w-4 h-4" /> : <Heart className="w-4 h-4" />}
          </div>

          {/* Text Block */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{request.category}</p>
            <p className="text-[10px] text-gray-500 truncate">
              {member?.fullName || 'Unknown'} • {new Date(typeof request.createdAt === 'number' ? request.createdAt : Date.now()).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {/* Right Block */}
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold text-gray-900">{formatUGX(request.amountRequested)}</p>
            <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase border ${
              isPaid ? 'bg-navy-50 text-navy-700 border-navy-200' : isAccepted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : request.status === 'declined' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {request.status}
            </span>
          </div>

          {/* Chevron */}
          <div className="shrink-0 ml-1">
            {expandedRow === request.id ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>

        {/* Expanded Detail (Accordion) */}
        {expandedRow === request.id && (
          <div className="border-t border-gray-100 mt-3 pt-3 animate-in slide-in-from-top-2 duration-200">
            <div className="bg-gray-50/50 rounded-xl p-4">
              
              {/* Detail Grid */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block mb-0.5">Relationship</span>
                  <span className="text-xs font-semibold text-gray-900 capitalize">{request.relationship}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block mb-0.5">Beneficiary Name</span>
                  <span className="text-xs font-semibold text-gray-900">{request.personName}</span>
                </div>
              </div>

              {/* Description */}
              <div className="mb-4">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block mb-0.5">Reason / Description</span>
                <div className="bg-white rounded-xl border border-gray-100 p-3 text-xs text-gray-700 leading-relaxed">
                  {request.description}
                </div>
              </div>

              {/* Vote Tracking - Compact Bar */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-gray-700 shrink-0">
                  {(approveCount > 0 || rejectCount > 0) ? `${approveCount + rejectCount}/3 votes` : 'Awaiting votes'}
                </span>
                <div className="flex-1 mx-3 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, (approveCount / 3) * 100)}%` }} />
                </div>
                <span className="text-[10px] text-gray-500 shrink-0">
                  {approveCount} approve • {rejectCount} reject
                </span>
              </div>

              {/* Approver Feedback / Notes */}
              {votes.some(v => v.reason) && (
                <div className="mb-4">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block mb-1.5">Approver Feedback & Notes</span>
                  <div className="space-y-2">
                    {votes.filter(v => v.reason).map((v, idx) => {
                      const voterObj = usersCache[v.userId];
                      return (
                        <div key={idx} className="bg-white rounded-xl border border-gray-100 p-3 text-xs text-gray-700 flex flex-col gap-1 shadow-2xs">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-gray-900">{voterObj?.fullName || 'Approver'}</span>
                            <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] border ${
                              v.vote === 'approve' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              {v.vote}
                            </span>
                          </div>
                          <p className="text-gray-600 italic">"{v.reason}"</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {request.status === 'pending' && !isAuditor && (
                request.userId === currentUser.uid ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5 text-xs font-semibold text-amber-700 text-center shadow-sm">
                    Conflict of Interest: You cannot vote on your own request.
                  </div>
                ) : myVote ? (
                  <div className={`rounded-full px-3 py-1.5 text-xs font-bold text-center shadow-sm ${
                    myVote.vote === 'approve' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    You voted to {myVote.vote}
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); openVoteModal(request.id!, 'approve', request.userId, request.category, request.personName, request.amountRequested); }}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full py-2.5 text-xs font-bold shadow-sm transition-colors active:scale-[0.97]"
                    >
                      Approve
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openVoteModal(request.id!, 'reject', request.userId, request.category, request.personName, request.amountRequested); }}
                      className="flex-1 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-full py-2.5 text-xs font-bold transition-colors active:scale-[0.97]"
                    >
                      Reject
                    </button>
                  </div>
                )
              )}

              {/* Payout Button */}
              {isAccepted && (isTreasurer || isSuperAdmin) && (
                request.userId === currentUser.uid ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5 text-xs font-semibold text-amber-700 text-center mt-3">
                    Conflict: Another authorized member must issue payout.
                  </div>
                ) : (
                  <div className="mt-3">
                    {request.disbursementStatus === 'processing' ? (
                      <div className="text-center py-2">
                        <div className="w-5 h-5 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin mx-auto mb-1"></div>
                        <p className="text-[10px] font-bold text-amber-800">Processing Payment...</p>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePay(request.id!); }}
                          className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-full py-2.5 text-xs font-bold shadow-sm transition-colors active:scale-[0.97] flex items-center justify-center gap-2"
                        >
                          <Banknote className="w-4 h-4" /> Process Payout
                        </button>
                        {request.disbursementStatus === 'failed' && (
                          <p className="text-[10px] font-bold text-rose-600 text-center mt-2">
                            Previous attempt failed. Try again.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )
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
    <div className="space-y-4 max-w-full overflow-x-hidden mx-auto pb-10 px-4">
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
          <Heart className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Welfare Review</h2>
          <p className="text-xs text-gray-500">
            Review requests, cast votes, and manage payouts.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-medium">
          {errorMsg}
        </div>
      )}
      
      {successMsg && (
        <div className="bg-teal-50 border border-teal-200 text-teal-800 p-3 rounded-xl text-xs font-medium">
          {successMsg}
        </div>
      )}

      {/* Filter Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar w-full">
            {[
              { id: 'all', label: 'All' },
              { id: 'pending', label: 'Pending' },
              { id: 'accepted', label: 'Approved' },
              { id: 'declined', label: 'Rejected' },
              { id: 'paid', label: 'Paid' }
            ].map(tab => {
              const isActive = statusFilter === tab.id;
              const count = (requests || []).filter(r => tab.id === 'all' ? true : r.status === tab.id).length;
              return (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id as any)}
                  className={`flex items-center shrink-0 rounded-full px-3.5 py-1.5 text-xs whitespace-nowrap transition-colors ${
                    isActive 
                      ? 'bg-slate-900 text-white font-semibold shadow-sm' 
                      : 'bg-gray-100 text-gray-500 font-medium hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {canExport && (
            <button
              onClick={handleExportCSV}
              className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full p-2 shadow-sm shrink-0 mb-2"
              title="Export CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="relative w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search requests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all"
          />
        </div>
      </div>

      <div className="space-y-3 mt-5">
          {filteredRequests.length === 0 ? (
            <div className="bg-gray-50 rounded-2xl py-10 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mb-3">
                {searchTerm || statusFilter !== 'all' ? (
                  <Search className="w-6 h-6 text-gray-400" />
                ) : (
                  <Heart className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <p className="text-sm font-semibold text-gray-700">
                {searchTerm || statusFilter !== 'all' ? "No requests match your search." : "No welfare requests"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {searchTerm || statusFilter !== 'all' ? "Try adjusting your search or filters." : "New applications will appear here for review."}
              </p>
            </div>
          ) : (
            <>
              {activeRequests.map(request => renderRequestCard(request))}
              
              {historyRequests.length > 0 && (
                <div className="mt-8 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-4 bg-navy-900 rounded-full"></div>
                    <h3 className="text-sm font-bold text-gray-900">Payout History</h3>
                    <span className="ml-2 bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{historyRequests.length}</span>
                  </div>
                  <div className="space-y-3">
                    {historyRequests.map(request => renderRequestCard(request))}
                  </div>
                </div>
              )}
            </>
          )}
      </div>

      {/* Vote Confirmation Modal */}
      {votingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => !votingLoading && setVotingModal(null)}>
          <div 
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 flex flex-col gap-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                votingModal.vote === 'approve' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}>
                {votingModal.vote === 'approve' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base sm:text-lg">
                  {votingModal.vote === 'approve' ? 'Approve Welfare Request' : 'Reject Welfare Request'}
                </h3>
                <p className="text-xs text-gray-500">
                  {votingModal.category} • {formatUGX(votingModal.amountRequested)}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 text-xs text-gray-600">
              Beneficiary: <span className="font-bold text-gray-900">{votingModal.personName}</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Reason / Feedback Note {votingModal.vote === 'reject' ? '(Recommended)' : '(Optional)'}
              </label>
              <textarea
                value={voteReason}
                onChange={(e) => setVoteReason(e.target.value)}
                placeholder={votingModal.vote === 'approve' ? "Add feedback or encouraging notes for this member..." : "Provide a reason or explanation for rejecting this request..."}
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-gray-800 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setVotingModal(null)}
                disabled={votingLoading}
                className="flex-1 py-2.5 px-4 rounded-full border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitVote}
                disabled={votingLoading}
                className={`flex-1 py-2.5 px-4 rounded-full text-xs font-bold text-white shadow-sm transition-all active:scale-[0.97] flex items-center justify-center gap-2 ${
                  votingModal.vote === 'approve' 
                    ? 'bg-emerald-500 hover:bg-emerald-600' 
                    : 'bg-rose-500 hover:bg-rose-600'
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
