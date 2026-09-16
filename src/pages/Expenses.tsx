import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Expense, User, AppSettings, SchoolCampaign } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { submitExpense, voteOnExpense, payExpense, initiateExpenseDisbursement, logActivity, reverseExpenseDecision } from '../lib/services';
import { formatUGX } from '../lib/utils';
import { Receipt, Plus, CheckCircle2, XCircle, Clock, Banknote, Shield, Search, Filter, Calendar, User as UserIcon, Phone, Building2, AlertCircle } from 'lucide-react';

export default function Expenses() {
  const { currentUser, userProfile } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [usersCache, setUsersCache] = useState<Record<string, User>>({});
  const [campaigns, setCampaigns] = useState<SchoolCampaign[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState<'Campaign Expense' | 'Administrative' | 'Transport' | 'Other'>('Administrative');
  const [campaignId, setCampaignId] = useState('');
  const [recipientPhoneNumber, setRecipientPhoneNumber] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientNetwork, setRecipientNetwork] = useState('MTN');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pay modal state
  const [payModalExpenseId, setPayModalExpenseId] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  // Voting modal state
  const [votingModal, setVotingModal] = useState<{
    expenseId: string;
    vote: 'approve' | 'reject';
    creatorId: string;
    reason: string;
    amount: number;
  } | null>(null);
  const [voteReason, setVoteReason] = useState('');
  const [votingLoading, setVotingLoading] = useState(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'paid' | 'rejected'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const canCreateExpense = userProfile && ['super_admin', 'chairperson', 'vice_chairperson', 'treasurer', 'secretary'].includes(userProfile.role);

  useEffect(() => {
    if (!currentUser) return;
    const fetchSettingsAndCampaigns = async () => {
      try {
        const sDoc = await getDoc(doc(db, 'appSettings', 'main'));
        if (sDoc.exists()) {
          const sData = sDoc.data();
          setSettings({ id: 'main', welfareCategories: [], allowedRelationships: [], maxAmounts: {}, ...sData, welfareApprovers: sData.welfareApprovers || [] } as AppSettings);
        }
        const campSnap = await getDocs(collection(db, 'schoolCampaigns'));
        const camps = campSnap.docs.map(d => ({ id: d.id, ...d.data() } as SchoolCampaign));
        setCampaigns(camps);
      } catch (err) {
        console.error("Error loading settings/campaigns:", err);
      }
    };
    fetchSettingsAndCampaigns();

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

    const q = query(collection(db, 'expenses'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Expense[] = [];

      snapshot.forEach(d => {
        const exp = { id: d.id, ...d.data() } as Expense;
        data.push(exp);
      });

      data.sort((a, b) => b.createdAt - a.createdAt);
      setExpenses(data);
      setLoading(false);
    }, (error) => {
      console.error("Error loading expenses:", error);
      setErrorMsg("Failed to load expenses. Please check your permissions or try again.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  if (!currentUser || !userProfile) return null;

  const activeSettings = settings || { welfareApprovers: [] };
  const isApprover = (activeSettings.welfareApprovers || []).includes(currentUser.uid);
  const isTreasurer = userProfile.role === 'treasurer' || userProfile.role === 'super_admin';

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg("Please enter a valid amount greater than 0.");
      return;
    }
    if (!reason.trim()) {
      setErrorMsg("Please provide a reason / description.");
      return;
    }
    if (!recipientPhoneNumber.trim()) {
      setErrorMsg("Recipient Mobile Money Number is mandatory.");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitExpense(currentUser.uid, {
        amount: parsedAmount,
        reason: reason.trim(),
        category,
        campaignId: campaignId || null,
        recipientPhoneNumber: recipientPhoneNumber.trim(),
        recipientName: recipientName.trim() || undefined,
        recipientNetwork
      });

      setShowCreateModal(false);
      setAmount('');
      setReason('');
      setCategory('Administrative');
      setCampaignId('');
      setRecipientPhoneNumber('');
      setRecipientName('');
      setRecipientNetwork('MTN');
      setSuccessMsg("Expense submitted successfully for executive approval.");
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit expense.');
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = (expenseId: string, vote: 'approve' | 'reject', creatorId: string, reason: string, amount: number) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (creatorId === currentUser.uid) {
      setErrorMsg("Conflict of Interest: You cannot act on your own request.");
      setTimeout(() => setErrorMsg(''), 5000);
      return;
    }
    if (!isApprover) {
      setErrorMsg("Only designated Approvers can cast a vote.");
      setTimeout(() => setErrorMsg(''), 5000);
      return;
    }
    setVoteReason('');
    setVotingModal({ expenseId, vote, creatorId, reason, amount });
  };

  // Reverse Decision Modal state
  const [reverseModalId, setReverseModalId] = useState<string | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [reverseLoading, setReverseLoading] = useState(false);

  const openReverseModal = (expenseId: string) => {
    if (userProfile?.role !== 'super_admin') {
      setErrorMsg("Only a Super Admin can reverse decisions.");
      setTimeout(() => setErrorMsg(''), 5000);
      return;
    }
    setReverseReason('');
    setReverseModalId(expenseId);
  };

  const submitReverseDecision = async () => {
    if (!reverseModalId || !reverseReason.trim()) return;
    setReverseLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await reverseExpenseDecision(reverseModalId, currentUser.uid, reverseReason);
      setSuccessMsg('Decision reversed. Expense is now pending.');
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

  const submitVote = async () => {
    if (!votingModal) return;
    setVotingLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await voteOnExpense(votingModal.expenseId, currentUser.uid, votingModal.vote, voteReason);
      setSuccessMsg(`Successfully voted to ${votingModal.vote} expense.`);
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

  const handlePaySubmit = async (e: React.FormEvent, expense: Expense) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!isTreasurer) {
      setErrorMsg("Only the Treasurer or Super Admin can issue expense payouts.");
      setTimeout(() => setErrorMsg(''), 5000);
      return;
    }

    if (expense.userId === currentUser.uid) {
      setErrorMsg("Conflict of Interest: You cannot issue a payout for your own expense request.");
      setTimeout(() => setErrorMsg(''), 5000);
      return;
    }

    setIsPaying(true);
    try {
      await initiateExpenseDisbursement(expense.id, currentUser.uid);
      setPayModalExpenseId(null);
      setSuccessMsg(`Mobile money disbursement of ${formatUGX(expense.amount)} initiated for ${expense.recipientPhoneNumber}.`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initiate disbursement.');
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setIsPaying(false);
    }
  };

  const filteredExpenses = expenses.filter(exp => {
    const creator = usersCache[exp.userId];
    const creatorName = String(creator?.fullName || '').toLowerCase();
    const reasonText = String(exp.reason || '').toLowerCase();
    const beneficiary = String(exp.recipientName || '').toLowerCase();
    const phone = String(exp.recipientPhoneNumber || '');
    const search = searchTerm.toLowerCase();

    const matchesSearch = creatorName.includes(search) || reasonText.includes(search) || beneficiary.includes(search) || phone.includes(search);
    const matchesStatus = statusFilter === 'all' || exp.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || exp.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-slate-500 dark:text-slate-400 font-medium">Loading association expenses...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#0c1731] rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 mb-2">
            <Receipt className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Financial Transparency & Control
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Association Expenses</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">Review controlled expense requisitions, committee approvals, and secure mobile money disbursements.</p>
        </div>

        {canCreateExpense && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3.5 rounded-2xl font-extrabold text-xs sm:text-sm transition-all shadow-md shadow-blue-500/25 active:scale-[0.98] flex-shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New Expense Request
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 p-4 rounded-2xl text-sm font-medium animate-in fade-in flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 dark:text-rose-400" />
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/60 text-teal-800 dark:text-teal-300 p-4 rounded-2xl text-sm font-medium animate-in fade-in flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-teal-600 dark:text-teal-400" />
          {successMsg}
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white dark:bg-[#0c1731] rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by reason, beneficiary, phone..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 text-xs rounded-2xl px-3.5 py-2.5 outline-none font-bold"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Approval</option>
            <option value="approved">Approved (Pending Payout)</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 text-xs rounded-2xl px-3.5 py-2.5 outline-none font-bold"
          >
            <option value="all">All Categories</option>
            <option value="Campaign Expense">Campaign Expense</option>
            <option value="Administrative">Administrative</option>
            <option value="Transport">Transport</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {/* Expenses List */}
      <div className="bg-white dark:bg-[#0c1731] rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Requisitions & Payouts</h3>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{filteredExpenses.length} Record(s)</span>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center justify-center text-center">
            <Receipt className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-4" />
            <h4 className="text-lg font-bold text-slate-900 dark:text-white">No Expenses Found</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mt-1">
              There are no expense records matching your search criteria.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredExpenses.map(exp => {
              const creator = usersCache[exp.userId];
              const approverVotes = exp.votes || [];
              const approveCount = approverVotes.filter(v => v.vote === 'approve' && v.userId !== exp.userId).length;
              const rejectCount = approverVotes.filter(v => v.vote === 'reject' && v.userId !== exp.userId).length;
              const userVote = approverVotes.find(v => v.userId === currentUser.uid)?.vote;
              const isCreator = exp.userId === currentUser.uid;

              return (
                <li key={exp.id} className="p-6 sm:p-8 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="flex flex-col lg:flex-row gap-6 lg:items-start justify-between">
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                          exp.status === 'paid' ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-900/60' :
                          exp.status === 'approved' ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60' :
                          exp.status === 'rejected' ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60' :
                          'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60'
                        }`}>
                          {exp.status === 'approved' ? 'Approved (Ready for Payout)' : exp.status}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                          {exp.category}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          {new Date(exp.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </span>
                      </div>

                      <h4 className="text-xl font-extrabold text-slate-900 dark:text-white">{exp.reason}</h4>

                      <div className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount</p>
                          <p className="font-extrabold text-blue-600 dark:text-blue-400 mt-0.5 text-base tracking-tight">{formatUGX(exp.amount)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recipient (Mobile Money)</p>
                          <p className="font-bold text-slate-900 dark:text-white mt-0.5">{exp.recipientName || 'N/A'} <span className="font-mono text-xs text-slate-500">({exp.recipientPhoneNumber} - {exp.recipientNetwork || 'MTN'})</span></p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested By</p>
                          <p className="font-bold text-slate-900 dark:text-white mt-0.5">{creator?.fullName || 'Loading...'}</p>
                        </div>
                      </div>

                      {/* Approval Status Progress */}
                      <div className="flex items-center gap-4 pt-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold">Committee Approvals:</span>
                        <span className="flex items-center gap-1 text-teal-600 dark:text-teal-400 font-bold">
                          <CheckCircle2 className="w-4 h-4" /> {approveCount} / 2 Approved
                        </span>
                        {rejectCount > 0 && (
                          <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                            <XCircle className="w-4 h-4" /> {rejectCount} Rejected
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions Column */}
                    <div className="flex flex-col gap-2.5 flex-shrink-0 self-start w-full lg:w-48">
                      {exp.status === 'pending' && (
                        <>
                          {isCreator ? (
                            <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 p-3 rounded-2xl text-xs font-semibold text-center">
                              Conflict of Interest: You created this expense.
                            </div>
                          ) : isApprover ? (
                            <div className="flex flex-col gap-2">
                              <div className="text-[11px] font-bold text-slate-400 text-center uppercase">Executive Vote</div>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => handleVote(exp.id!, 'approve', exp.userId, exp.reason, exp.amount)}
                                  className={`py-2 px-3 rounded-2xl font-bold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                                    userVote === 'approve' ? 'bg-teal-600 text-white shadow-sm' : 'bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                                  }`}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                                </button>
                                <button
                                  onClick={() => handleVote(exp.id!, 'reject', exp.userId, exp.reason, exp.amount)}
                                  className={`py-2 px-3 rounded-2xl font-bold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                                    userVote === 'reject' ? 'bg-rose-600 text-white shadow-sm' : 'bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                  }`}
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Reject
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 p-3 rounded-2xl text-xs font-bold border border-amber-200 dark:border-amber-900/60 text-center flex items-center justify-center gap-1.5">
                              <Clock className="w-4 h-4" /> Awaiting Approvers
                            </div>
                          )}
                        </>
                      )}

                      {exp.status === 'approved' && (
                        <>
                          {isTreasurer ? (
                            <button
                              onClick={() => {
                                if (exp.userId === currentUser.uid) {
                                  setErrorMsg("Conflict of Interest: You cannot issue a payout for your own expense request.");
                                  setTimeout(() => setErrorMsg(''), 5000);
                                  return;
                                }
                                setPayModalExpenseId(exp.id);
                              }}
                              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold py-3 px-4 rounded-2xl text-xs shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                            >
                              <Banknote className="w-4 h-4" /> Pay via Relworx
                            </button>
                          ) : (
                            <div className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 p-3 rounded-2xl text-xs font-bold border border-blue-200 dark:border-blue-900/60 text-center">
                              Approved (Awaiting Treasurer Payout)
                            </div>
                          )}
                        </>
                      )}

                      {exp.status === 'paid' && (
                        <div className="bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 p-3 rounded-2xl text-xs font-bold border border-teal-200 dark:border-teal-900/60 text-center">
                          Paid: {exp.paidTransactionReference || 'Disbursed'}
                        </div>
                      )}

                      {exp.status === 'rejected' && (
                        <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 p-3 rounded-2xl text-xs font-bold border border-rose-200 dark:border-rose-900/60 text-center">
                          Rejected
                        </div>
                      )}

                      {/* Reverse Decision Trigger */}
                      {exp.status !== 'pending' && exp.status !== 'paid' && exp.disbursementStatus !== 'successful' && exp.disbursementStatus !== 'in_progress' && userProfile?.role === 'super_admin' && (
                        <div className="text-center mt-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); openReverseModal(exp.id!); }}
                            className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline transition-colors cursor-pointer"
                          >
                            Reverse Decision
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Create Expense Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0c1731] rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200/80 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-600 dark:text-blue-400" /> New Controlled Expense Requisition
            </h3>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Amount (UGX) *</label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="e.g. 150000"
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Category *</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="Administrative">Administrative</option>
                    <option value="Campaign Expense">Campaign Expense</option>
                    <option value="Transport">Transport</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Reason / Description *</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="e.g. Printing Association Annual General Meeting Banners"
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {category === 'Campaign Expense' && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Related Campaign (Optional)</label>
                  <select
                    value={campaignId}
                    onChange={e => setCampaignId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="">-- None / General --</option>
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Recipient Mobile Money Number *</label>
                  <input
                    type="text"
                    required
                    value={recipientPhoneNumber}
                    onChange={e => setRecipientPhoneNumber(e.target.value)}
                    placeholder="e.g. 0772123456"
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl px-4 py-3 text-sm font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Network</label>
                  <select
                    value={recipientNetwork}
                    onChange={e => setRecipientNetwork(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="MTN">MTN Mobile Money</option>
                    <option value="Airtel">Airtel Money</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Recipient Name (Recommended)</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  placeholder="e.g. Kampala Printers Ltd or John Doe"
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 text-xs sm:text-sm font-extrabold bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-md shadow-blue-500/25 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Requisition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* Voting Modal */}
      {votingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200" onClick={() => !votingLoading && setVotingModal(null)}>
          <div 
            className="bg-white dark:bg-[#0c1731] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3.5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                votingModal.vote === 'approve' 
                  ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800' 
                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
              }`}>
                {votingModal.vote === 'approve' ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg">
                  {votingModal.vote === 'approve' ? 'Approve Expense' : 'Reject Expense'}
                </h3>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  <span className="font-mono text-slate-900 dark:text-white">{formatUGX(votingModal.amount)}</span>
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
              Reason: <span className="font-bold text-slate-900 dark:text-white">{votingModal.reason}</span>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                Committee Reason & Feedback {votingModal.vote === 'reject' ? '(Required)' : '(Optional)'}
              </label>
              <textarea
                value={voteReason}
                onChange={(e) => setVoteReason(e.target.value)}
                placeholder={votingModal.vote === 'approve' ? "Add approval notes..." : "Provide clear justification for rejection..."}
                rows={3}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 text-xs text-slate-900 dark:text-white outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition-all resize-none font-medium placeholder:text-slate-400"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setVotingModal(null)}
                disabled={votingLoading}
                className="flex-1 py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={submitVote}
                disabled={votingLoading || (votingModal.vote === 'reject' && !voteReason.trim())}
                className={`flex-1 py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm text-white shadow-md transition-all disabled:opacity-50 cursor-pointer ${
                  votingModal.vote === 'approve' 
                    ? 'bg-teal-600 hover:bg-teal-500 shadow-teal-500/25' 
                    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/25'
                }`}
              >
                {votingLoading ? 'Submitting...' : `Confirm ${votingModal.vote === 'approve' ? 'Approval' : 'Rejection'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Payout Modal */}
      {payModalExpenseId && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0c1731] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200/80 dark:border-slate-800">
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Banknote className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Process Relworx Disbursement
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Disbursing funds to the saved recipient mobile money number. Enter confirmation reference.
            </p>

            {(() => {
              const exp = expenses.find(e => e.id === payModalExpenseId);
              if (!exp) return null;
              return (
                <form onSubmit={e => handlePaySubmit(e, exp)} className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 space-y-1.5 text-xs">
                    <p className="font-bold text-slate-900 dark:text-white">Reason: {exp.reason}</p>
                    <p className="text-slate-600 dark:text-slate-300">Amount: <span className="font-bold text-blue-600 dark:text-blue-400">{formatUGX(exp.amount)}</span></p>
                    <p className="text-slate-600 dark:text-slate-300">Recipient Phone: <span className="font-mono font-bold text-slate-900 dark:text-white">{exp.recipientPhoneNumber} ({exp.recipientNetwork || 'MTN'})</span></p>
                    <p className="text-slate-600 dark:text-slate-300">Beneficiary: <span className="font-bold text-slate-900 dark:text-white">{exp.recipientName || 'N/A'}</span></p>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setPayModalExpenseId(null)}
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
    </div>
  );
}
