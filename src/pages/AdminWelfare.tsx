import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { WelfareRequest, User, AppSettings } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { 
  castWelfareVote, 
  logActivity, 
  initiateWelfareDisbursement, 
  reverseWelfareDecision,
  publishWelfareRequest,
  updateWelfarePublication,
  setWelfareSupportStatus,
  unpublishWelfareRequest
} from '../lib/services';
import { formatUGX, exportToCSV } from '../lib/utils';
import { 
  Heart, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Banknote, 
  Shield, 
  Search, 
  Filter, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  DollarSign, 
  AlertCircle, 
  CheckCircle2,
  HeartHandshake,
  Globe,
  PauseCircle,
  PlayCircle,
  EyeOff,
  Edit3
} from 'lucide-react';

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
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'paid' | 'published' | 'declined'>('all');

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
  // Pay Confirmation Modal state
  const [payModalWelfareId, setPayModalWelfareId] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  // Publish to Feed Modal
  const [publishModal, setPublishModal] = useState<WelfareRequest | null>(null);
  const [pubTitle, setPubTitle] = useState('');
  const [pubSummary, setPubSummary] = useState('');
  const [pubSupportEnabled, setPubSupportEnabled] = useState(true);
  const [pubTargetAmount, setPubTargetAmount] = useState('');
  const [pubLoading, setPubLoading] = useState(false);

  // Edit Publication Modal
  const [editPubModal, setEditPubModal] = useState<WelfareRequest | null>(null);
  const [editPubTitle, setEditPubTitle] = useState('');
  const [editPubSummary, setEditPubSummary] = useState('');
  const [editPubSupportEnabled, setEditPubSupportEnabled] = useState(true);
  const [editPubTargetAmount, setEditPubTargetAmount] = useState('');
  const [editPubLoading, setEditPubLoading] = useState(false);

  // Reversal Modal
  const [reverseModalId, setReverseModalId] = useState<string | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [reverseLoading, setReverseLoading] = useState(false);

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

  const isExecutive = isSuperAdmin || isChairperson || isViceChairperson || isSecretary || isTreasurer;

  const filteredRequests = (Array.isArray(requests) ? requests : []).filter(r => {
    if (!r) return false;
    const member = usersCache?.[r.userId];
    const memberName = String(member?.fullName || '').toLowerCase();
    const cat = String(r.category || '').toLowerCase();
    const desc = String(r.description || '').toLowerCase();
    const search = String(searchTerm || '').toLowerCase();
    const phone = String(member?.phoneNumber || '');

    const matchesSearch = memberName.includes(search) || cat.includes(search) || desc.includes(search) || phone.includes(search);
    const matchesStatus = 
      statusFilter === 'all' 
        ? true 
        : statusFilter === 'published' 
        ? r.isPublishedToFeed === true 
        : r.status === statusFilter;

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
        IsPublishedToFeed: r.isPublishedToFeed ? 'Yes' : 'No',
        SupportRaisedAmount: r.supportRaisedAmount || 0,
        SupportStatus: r.supportStatus || 'N/A',
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

  const openReverseModal = (requestId: string) => {
    if (!isSuperAdmin) {
      setErrorMsg("Only a Super Admin can reverse decisions.");
      setTimeout(() => setErrorMsg(''), 5000);
      return;
    }
    setReverseReason('');
    setReverseModalId(requestId);
  };

  const submitReverseDecision = async () => {
    if (!reverseModalId || !reverseReason.trim()) return;
    setReverseLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await reverseWelfareDecision(reverseModalId, currentUser.uid, reverseReason);
      setSuccessMsg('Decision reversed. Request is now pending.');
      setReverseModalId(null);
      setReverseReason('');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reverse decision.');
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setReverseLoading(false);
    }
  };

  const handleOpenPublish = (request: WelfareRequest) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!isExecutive) {
      setErrorMsg("Only executive committee members can publish welfare cases.");
      return;
    }
    if (request.userId === currentUser.uid) {
      setErrorMsg("Conflict of Interest: You cannot publish your own welfare request.");
      return;
    }
    setPubTitle(`${request.category} Solidarity Support`);
    setPubSummary(request.reason || `${request.category} emergency relief for member.`);
    setPubSupportEnabled(true);
    setPubTargetAmount(String(request.amountRequested || ''));
    setPublishModal(request);
  };

  const submitPublish = async () => {
    if (!publishModal) return;
    if (!pubTitle.trim() || !pubSummary.trim()) {
      setErrorMsg("Public Title and Privacy-safe Summary are required.");
      return;
    }
    setPubLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await publishWelfareRequest(publishModal.id!, currentUser.uid, {
        publicTitle: pubTitle.trim(),
        publicSummary: pubSummary.trim(),
        supportEnabled: pubSupportEnabled,
        supportTargetAmount: Number(pubTargetAmount) || 0,
      });
      setSuccessMsg("Welfare case published to Member Feed.");
      setPublishModal(null);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to publish welfare case.");
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setPubLoading(false);
    }
  };

  const handleOpenEditPublish = (request: WelfareRequest) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!isExecutive) {
      setErrorMsg("Only executive committee members can edit published appeals.");
      return;
    }
    if (request.userId === currentUser.uid) {
      setErrorMsg("Conflict of Interest: You cannot moderate your own published case.");
      return;
    }
    setEditPubTitle(request.publicTitle || '');
    setEditPubSummary(request.publicSummary || '');
    setEditPubSupportEnabled(request.supportEnabled !== false);
    setEditPubTargetAmount(String(request.supportTargetAmount || ''));
    setEditPubModal(request);
  };

  const submitEditPublish = async () => {
    if (!editPubModal) return;
    if (!editPubTitle.trim() || !editPubSummary.trim()) {
      setErrorMsg("Public Title and Privacy-safe Summary are required.");
      return;
    }
    setEditPubLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await updateWelfarePublication(editPubModal.id!, currentUser.uid, {
        publicTitle: editPubTitle.trim(),
        publicSummary: editPubSummary.trim(),
        supportEnabled: editPubSupportEnabled,
        supportTargetAmount: Number(editPubTargetAmount) || 0,
      });
      setSuccessMsg("Public appeal details updated.");
      setEditPubModal(null);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update public appeal.");
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setEditPubLoading(false);
    }
  };

  const handleSetStatus = async (request: WelfareRequest, status: 'open' | 'paused' | 'closed') => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!isExecutive) {
      setErrorMsg("Only executive committee members can change solidarity support status.");
      return;
    }
    if (request.userId === currentUser.uid) {
      setErrorMsg("Conflict of Interest: You cannot change status for your own case.");
      return;
    }
    try {
      await setWelfareSupportStatus(request.id!, currentUser.uid, status);
      setSuccessMsg(`Solidarity support status set to ${status}.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update support status.");
      setTimeout(() => setErrorMsg(''), 5000);
    }
  };

  const handleUnpublish = async (request: WelfareRequest) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!isExecutive) {
      setErrorMsg("Only executive committee members can unpublish appeals.");
      return;
    }
    if (request.userId === currentUser.uid) {
      setErrorMsg("Conflict of Interest: You cannot unpublish your own case.");
      return;
    }
    try {
      await unpublishWelfareRequest(request.id!, currentUser.uid);
      setSuccessMsg("Case unpublished from Member Feed.");
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to unpublish case.");
      setTimeout(() => setErrorMsg(''), 5000);
    }
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

  const openPayModal = (requestId: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!isTreasurer && !isSuperAdmin) {
      setErrorMsg("Only the Treasurer can issue payments.");
      setTimeout(() => setErrorMsg(''), 5000);
      return;
    }
    setPayModalWelfareId(requestId);
  };

  const handlePaySubmit = async (e: React.FormEvent, request: WelfareRequest) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (request.userId === currentUser.uid) {
      setErrorMsg("Conflict of Interest: You cannot issue a payout for your own request.");
      setTimeout(() => setErrorMsg(''), 5000);
      return;
    }

    setIsPaying(true);
    try {
      await initiateWelfareDisbursement(request.id!, currentUser.uid);
      setPayModalWelfareId(null);
      setSuccessMsg(`Mobile money disbursement of ${formatUGX(request.amountRequested)} initiated for ${request.recipientPhoneNumber}.`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initiate disbursement.');
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setIsPaying(false);
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
                          onClick={(e) => { e.stopPropagation(); openPayModal(request.id!); }}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-3 text-xs font-extrabold uppercase tracking-wider shadow-xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Banknote className="w-4 h-4" /> Issue Mobile Money Payout ({formatUGX(request.amountRequested)})
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* PUBLIC WELFARE FEED & SOLIDARITY SUPPORT MODERATION */}
              {(isAccepted || isPaid) && isExecutive && (
                <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-200">
                      <HeartHandshake className="w-4 h-4 text-rose-500" />
                      <span>Public Member Feed & Solidarity Support</span>
                    </div>

                    {request.isPublishedToFeed ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
                        <Globe className="w-3 h-3" />
                        Live on Feed
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                        Not Published
                      </span>
                    )}
                  </div>

                  {request.isPublishedToFeed ? (
                    <div className="bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl p-4 border border-rose-100 dark:border-rose-900/30 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            {request.publicTitle || `${request.category} Solidarity Support`}
                          </p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5">
                            {request.publicSummary || request.reason}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-extrabold text-rose-600 dark:text-rose-400">
                            {formatUGX(request.supportRaisedAmount || 0)} raised
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {request.supportContributorCount || 0} supporters • Status: <strong className="uppercase">{request.supportStatus || 'open'}</strong>
                          </p>
                        </div>
                      </div>

                      {request.userId === currentUser.uid ? (
                        <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-200 dark:border-amber-900">
                          Conflict of Interest: You cannot moderate or edit the public feed for your own request.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2 pt-1 border-t border-rose-200/50 dark:border-rose-900/40">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleOpenEditPublish(request); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit Details
                          </button>

                          {request.supportStatus === 'paused' ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleSetStatus(request, 'open'); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer"
                            >
                              <PlayCircle className="w-3.5 h-3.5" />
                              Resume Support
                            </button>
                          ) : request.supportStatus !== 'closed' ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleSetStatus(request, 'paused'); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all cursor-pointer"
                            >
                              <PauseCircle className="w-3.5 h-3.5" />
                              Pause Support
                            </button>
                          ) : null}

                          {request.supportStatus !== 'closed' && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleSetStatus(request, 'closed'); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Close Appeal
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleUnpublish(request); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-xs font-bold transition-all cursor-pointer"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                            Unpublish
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      {request.userId === currentUser.uid ? (
                        <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-2xl border border-amber-200 dark:border-amber-900 text-center">
                          Conflict of Interest: Another executive member must publish this case to the public feed.
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleOpenPublish(request); }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-extrabold text-xs transition-all shadow-xs cursor-pointer"
                        >
                          <HeartHandshake className="w-4 h-4" />
                          Publish to Member Feed (Open Solidarity Support)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Reverse Decision Trigger */}
              {request.status !== 'pending' && request.status !== 'paid' && request.disbursementStatus !== 'successful' && request.disbursementStatus !== 'in_progress' && isSuperAdmin && (
                <div className="mt-2 text-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); openReverseModal(request.id!); }}
                    className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline transition-colors cursor-pointer"
                  >
                    Reverse Decision
                  </button>
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
            { id: 'published', label: 'Published to Feed' },
            { id: 'pending', label: 'Pending Review' },
            { id: 'accepted', label: 'Approved (Pending Payout)' },
            { id: 'paid', label: 'Paid Out' },
            { id: 'declined', label: 'Declined' }
          ].map(tab => {
            const isActive = statusFilter === tab.id;
            const count = (requests || []).filter(r => {
              if (tab.id === 'all') return true;
              if (tab.id === 'published') return r.isPublishedToFeed === true;
              return r.status === tab.id;
            }).length;
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

      {/* Reverse Decision Modal */}
      {reverseModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200" onClick={() => !reverseLoading && setReverseModalId(null)}>
          <div 
            className="bg-white dark:bg-[#0c1731] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border bg-amber-50 text-amber-600 border-amber-200">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg">
                  Reverse Decision
                </h3>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                Reason for Reversal (Required)
              </label>
              <textarea
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                placeholder="Provide clear justification for reversing this decision..."
                rows={3}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 text-xs text-slate-900 dark:text-white outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition-all resize-none font-medium placeholder:text-slate-400"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setReverseModalId(null)}
                disabled={reverseLoading}
                className="flex-1 py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={submitReverseDecision}
                disabled={reverseLoading || !reverseReason.trim()}
                className="flex-1 py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm text-white bg-amber-600 hover:bg-amber-500 shadow-md shadow-amber-500/25 transition-all disabled:opacity-50 cursor-pointer"
              >
                {reverseLoading ? 'Submitting...' : 'Confirm Reversal'}
              </button>
            </div>
          </div>
        </div>
      )}

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
      {/* Pay Confirmation Modal */}
      {payModalWelfareId && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0c1731] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200/80 dark:border-slate-800">
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Banknote className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Process Relworx Disbursement
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Disbursing funds to the saved recipient mobile money number.
            </p>

            {(() => {
              const req = requests.find(r => r.id === payModalWelfareId);
              if (!req) return null;
              return (
                <form onSubmit={e => handlePaySubmit(e, req)} className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 space-y-1.5 text-xs">
                    <p className="font-bold text-slate-900 dark:text-white">Category: {req.category}</p>
                    <p className="text-slate-600 dark:text-slate-300">Amount: <span className="font-bold text-blue-600 dark:text-blue-400">{formatUGX(req.amountRequested)}</span></p>
                    <p className="text-slate-600 dark:text-slate-300">Recipient Phone: <span className="font-mono font-bold text-slate-900 dark:text-white">{req.recipientPhoneNumber} ({req.recipientNetwork || 'MTN'})</span></p>
                    <p className="text-slate-600 dark:text-slate-300">Beneficiary: <span className="font-bold text-slate-900 dark:text-white">{req.personName || 'N/A'}</span></p>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setPayModalWelfareId(null)}
                      className="px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isPaying}
                      className="px-6 py-2.5 text-xs sm:text-sm font-extrabold bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-md shadow-blue-500/25 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Banknote className="w-4 h-4" />
                      {isPaying ? 'Processing...' : 'Pay via Mobile Money'}
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}
      {/* Publish to Member Feed Modal */}
      {publishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200" onClick={() => !pubLoading && setPublishModal(null)}>
          <div 
            className="bg-white dark:bg-[#0c1731] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-900">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg">
                  Publish Appeal to Member Feed
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {publishModal.category} • Beneficiary: {publishModal.personName}
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-900/60 text-[11px] text-amber-800 dark:text-amber-300">
              <strong>Privacy Standard:</strong> Member phone number, evidence documents, and internal vote notes will NOT be exposed on the public card.
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                  Public Title (Required)
                </label>
                <input
                  type="text"
                  value={pubTitle}
                  onChange={(e) => setPubTitle(e.target.value)}
                  placeholder="e.g. Bereavement Solidarity Support for Member"
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                  Public Summary & Call to Support (Required)
                </label>
                <textarea
                  value={pubSummary}
                  onChange={(e) => setPubSummary(e.target.value)}
                  placeholder="Write a clear, dignified summary for alumni members to read..."
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                    Support Target (UGX)
                  </label>
                  <input
                    type="number"
                    value={pubTargetAmount}
                    onChange={(e) => setPubTargetAmount(e.target.value)}
                    placeholder="Optional target"
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500 font-mono"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pubSupportEnabled}
                      onChange={(e) => setPubSupportEnabled(e.target.checked)}
                      className="w-4 h-4 text-rose-600 rounded"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Enable Member Support</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPublishModal(null)}
                disabled={pubLoading}
                className="flex-1 py-3 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitPublish}
                disabled={pubLoading || !pubTitle.trim() || !pubSummary.trim()}
                className="flex-1 py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold uppercase tracking-wider shadow-md shadow-rose-600/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {pubLoading ? 'Publishing...' : 'Confirm & Publish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Public Details Modal */}
      {editPubModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200" onClick={() => !editPubLoading && setEditPubModal(null)}>
          <div 
            className="bg-white dark:bg-[#0c1731] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/60 dark:text-blue-400 dark:border-blue-900">
                <Edit3 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg">
                  Edit Public Feed Appeal
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {editPubModal.category} • Beneficiary: {editPubModal.personName}
                </p>
              </div>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                  Public Title (Required)
                </label>
                <input
                  type="text"
                  value={editPubTitle}
                  onChange={(e) => setEditPubTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                  Public Summary (Required)
                </label>
                <textarea
                  value={editPubSummary}
                  onChange={(e) => setEditPubSummary(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                    Support Target (UGX)
                  </label>
                  <input
                    type="number"
                    value={editPubTargetAmount}
                    onChange={(e) => setEditPubTargetAmount(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editPubSupportEnabled}
                      onChange={(e) => setEditPubSupportEnabled(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Enable Member Support</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditPubModal(null)}
                disabled={editPubLoading}
                className="flex-1 py-3 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitEditPublish}
                disabled={editPubLoading || !editPubTitle.trim() || !editPubSummary.trim()}
                className="flex-1 py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold uppercase tracking-wider shadow-md shadow-blue-600/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {editPubLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
