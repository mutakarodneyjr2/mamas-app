import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Expense, User, AppSettings, SchoolCampaign } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { submitExpense, voteOnExpense, payExpense, initiateExpenseDisbursement, logActivity } from '../lib/services';
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

    const q = query(collection(db, 'expenses'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Expense[] = [];
      const userIds = new Set<string>();

      snapshot.forEach(d => {
        const exp = { id: d.id, ...d.data() } as Expense;
        data.push(exp);
        if (exp.userId) userIds.add(exp.userId);
        exp.votes?.forEach(v => {
          if (v.userId) userIds.add(v.userId);
        });
      });

      data.sort((a, b) => b.createdAt - a.createdAt);
      setExpenses(data);

      userIds.forEach(uid => {
        if (!usersCache[uid]) {
          getDoc(doc(db, 'users', uid)).then(uDoc => {
            if (uDoc.exists()) {
              setUsersCache(curr => ({ ...curr, [uid]: uDoc.data() as User }));
            }
          });
        }
      });

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

  const handleVote = async (expenseId: string, vote: 'approve' | 'reject', creatorId: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (creatorId === currentUser.uid) {
      setErrorMsg("Conflict of Interest: You cannot vote on an expense you created.");
      setTimeout(() => setErrorMsg(''), 5000);
      return;
    }
    if (!isApprover) {
      setErrorMsg("Only designated Approvers can cast a vote.");
      setTimeout(() => setErrorMsg(''), 5000);
      return;
    }

    try {
      await voteOnExpense(expenseId, currentUser.uid, vote);
      setSuccessMsg(`Successfully voted to ${vote} expense.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to cast vote.');
      setTimeout(() => setErrorMsg(''), 5000);
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mamas-accent mb-4"></div>
        <p className="text-slate-500 font-medium">Loading association expenses...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-6">
      {/* Header Banner */}
      <div className="bg-mamas-card rounded-3xl shadow-sm border border-slate-200/90 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 mb-2">
            <Receipt className="w-3.5 h-3.5 text-indigo-500" /> Financial Transparency & Control
          </div>
          <h2 className="text-2xl font-display font-bold text-mamas-text">Association Expenses</h2>
          <p className="text-mamas-text-muted text-sm mt-1">Review controlled expense requisitions, committee approvals, and secure mobile money disbursements.</p>
        </div>

        {canCreateExpense && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-mamas-primary hover:bg-mamas-primary-hover text-white px-6 py-3.5 rounded-2xl font-bold transition-all shadow-md active:scale-[0.98] flex-shrink-0"
          >
            <Plus className="w-4 h-4 text-mamas-accent" /> New Expense Request
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-sm font-medium animate-in fade-in flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="bg-teal-50 border border-teal-200 text-teal-800 p-4 rounded-2xl text-sm font-medium animate-in fade-in flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-teal-600" />
          {successMsg}
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-mamas-card rounded-2xl p-4 border border-slate-200/90 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by reason, beneficiary, phone..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-mamas-accent font-medium text-mamas-text"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-mamas-text text-xs rounded-xl px-3 py-2.5 outline-none font-bold"
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
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-mamas-text text-xs rounded-xl px-3 py-2.5 outline-none font-bold"
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
      <div className="bg-mamas-card rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-base font-bold text-mamas-text">Requisitions & Payouts</h3>
          <span className="text-xs font-semibold text-slate-400">{filteredExpenses.length} Record(s)</span>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center justify-center text-center">
            <Receipt className="w-16 h-16 text-slate-200 dark:text-slate-700 mb-4" />
            <h4 className="text-lg font-bold text-mamas-text">No Expenses Found</h4>
            <p className="text-sm text-mamas-text-muted max-w-sm mt-1">
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
                <li key={exp.id} className="p-6 sm:p-8 hover:bg-slate-50/40 transition-colors">
                  <div className="flex flex-col lg:flex-row gap-6 lg:items-start justify-between">
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          exp.status === 'paid' ? 'bg-teal-50 text-teal-800 border border-teal-200' :
                          exp.status === 'approved' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                          exp.status === 'rejected' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                          'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {exp.status === 'approved' ? 'Approved (Ready for Payout)' : exp.status}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600">
                          {exp.category}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          {new Date(exp.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </span>
                      </div>

                      <h4 className="text-xl font-bold text-mamas-text">{exp.reason}</h4>

                      <div className="text-sm text-slate-600 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount</p>
                          <p className="font-bold text-mamas-primary mt-0.5 font-display text-base">{formatUGX(exp.amount)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recipient (Mobile Money)</p>
                          <p className="font-bold text-mamas-text mt-0.5">{exp.recipientName || 'N/A'} <span className="font-mono text-xs text-slate-500">({exp.recipientPhoneNumber} - {exp.recipientNetwork || 'MTN'})</span></p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Requested By</p>
                          <p className="font-bold text-mamas-text mt-0.5">{creator?.fullName || 'Loading...'}</p>
                        </div>
                      </div>

                      {/* Approval Status Progress */}
                      <div className="flex items-center gap-4 pt-2 text-xs text-slate-500">
                        <span className="font-semibold">Committee Approvals:</span>
                        <span className="flex items-center gap-1 text-teal-700 font-bold">
                          <CheckCircle2 className="w-4 h-4" /> {approveCount} / 2 Approved
                        </span>
                        {rejectCount > 0 && (
                          <span className="flex items-center gap-1 text-rose-700 font-bold">
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
                            <div className="bg-slate-100 text-slate-500 p-3 rounded-2xl text-xs font-semibold text-center">
                              Conflict of Interest: You created this expense.
                            </div>
                          ) : isApprover ? (
                            <div className="flex flex-col gap-2">
                              <div className="text-[11px] font-bold text-slate-400 text-center uppercase">Executive Vote</div>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => handleVote(exp.id, 'approve', exp.userId)}
                                  className={`py-2 px-3 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1 ${
                                    userVote === 'approve' ? 'bg-teal-600 text-white shadow-sm' : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200'
                                  }`}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                                </button>
                                <button
                                  onClick={() => handleVote(exp.id, 'reject', exp.userId)}
                                  className={`py-2 px-3 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1 ${
                                    userVote === 'reject' ? 'bg-rose-600 text-white shadow-sm' : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
                                  }`}
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Reject
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-amber-50 text-amber-800 p-3 rounded-2xl text-xs font-bold border border-amber-200 text-center flex items-center justify-center gap-1.5">
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
                                  setTimeout(() => setErrorMsg('5000'), 5000);
                                  return;
                                }
                                setPayModalExpenseId(exp.id);
                              }}
                              className="w-full bg-mamas-accent hover:bg-mamas-accent-hover text-slate-900 font-bold py-3 px-4 rounded-2xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                            >
                              <Banknote className="w-4 h-4" /> Pay via Relworx
                            </button>
                          ) : (
                            <div className="bg-blue-50 text-blue-800 p-3 rounded-2xl text-xs font-bold border border-blue-200 text-center">
                              Approved (Awaiting Treasurer Payout)
                            </div>
                          )}
                        </>
                      )}

                      {exp.status === 'paid' && (
                        <div className="bg-teal-50 text-teal-800 p-3 rounded-2xl text-xs font-bold border border-teal-200 text-center">
                          Paid: {exp.paidTransactionReference || 'Disbursed'}
                        </div>
                      )}

                      {exp.status === 'rejected' && (
                        <div className="bg-rose-50 text-rose-800 p-3 rounded-2xl text-xs font-bold border border-rose-200 text-center">
                          Rejected
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-mamas-card rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-mamas-text mb-4 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-mamas-accent" /> New Controlled Expense Requisition
            </h3>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount (UGX) *</label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="e.g. 150000"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-mamas-text outline-none focus:ring-2 focus:ring-mamas-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category *</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-mamas-text outline-none focus:ring-2 focus:ring-mamas-accent"
                  >
                    <option value="Administrative">Administrative</option>
                    <option value="Campaign Expense">Campaign Expense</option>
                    <option value="Transport">Transport</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reason / Description *</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="e.g. Printing Association Annual General Meeting Banners"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-mamas-text outline-none focus:ring-2 focus:ring-mamas-accent"
                />
              </div>

              {category === 'Campaign Expense' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Related Campaign (Optional)</label>
                  <select
                    value={campaignId}
                    onChange={e => setCampaignId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-mamas-text outline-none focus:ring-2 focus:ring-mamas-accent"
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
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Recipient Mobile Money Number *</label>
                  <input
                    type="text"
                    required
                    value={recipientPhoneNumber}
                    onChange={e => setRecipientPhoneNumber(e.target.value)}
                    placeholder="e.g. 0772123456"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-mono font-bold text-mamas-text outline-none focus:ring-2 focus:ring-mamas-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Network</label>
                  <select
                    value={recipientNetwork}
                    onChange={e => setRecipientNetwork(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-mamas-text outline-none focus:ring-2 focus:ring-mamas-accent"
                  >
                    <option value="MTN">MTN Mobile Money</option>
                    <option value="Airtel">Airtel Money</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Recipient Name (Recommended)</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  placeholder="e.g. Kampala Printers Ltd or John Doe"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-mamas-text outline-none focus:ring-2 focus:ring-mamas-accent"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 text-sm font-bold bg-mamas-primary hover:bg-mamas-primary-hover text-white rounded-xl shadow-md disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Requisition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Payout Modal */}
      {payModalExpenseId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-mamas-card rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200">
            <h3 className="text-xl font-bold text-mamas-text mb-2 flex items-center gap-2">
              <Banknote className="w-5 h-5 text-mamas-accent" /> Process Relworx Disbursement
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Disbursing funds to the saved recipient mobile money number. Enter confirmation reference.
            </p>

            {(() => {
              const exp = expenses.find(e => e.id === payModalExpenseId);
              if (!exp) return null;
              return (
                <form onSubmit={e => handlePaySubmit(e, exp)} className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
                    <p className="font-bold text-mamas-text">Reason: {exp.reason}</p>
                    <p className="text-slate-600">Amount: <span className="font-bold text-mamas-primary">{formatUGX(exp.amount)}</span></p>
                    <p className="text-slate-600">Recipient Phone: <span className="font-mono font-bold text-mamas-text">{exp.recipientPhoneNumber} ({exp.recipientNetwork || 'MTN'})</span></p>
                    <p className="text-slate-600">Beneficiary: <span className="font-bold text-mamas-text">{exp.recipientName || 'N/A'}</span></p>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setPayModalExpenseId(null)}
                      className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isPaying}
                      className="px-6 py-2.5 text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-md disabled:opacity-50 transition-colors flex items-center gap-2"
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
