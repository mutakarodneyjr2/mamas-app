import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, getDoc, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Contribution, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { verifyContribution, rejectContribution, logActivity } from '../lib/services';
import { triggerContributionReminders } from '../lib/reminderService';
import { formatUGX, exportToCSV } from '../lib/utils';
import { Check, X, FileText, Search, Filter, Download, ChevronDown, Calendar, DollarSign, Bell, Send, Users, Sparkles } from 'lucide-react';
import { SelectDropdown } from '../components/SelectDropdown';

export default function AdminContributions() {
  const { currentUser, userProfile } = useAuth();
  const isAuditor = userProfile?.role === 'auditor';
  const canExport = ["super_admin", "chairperson", "vice_chairperson", "treasurer", "auditor", "secretary"].includes(userProfile?.role || "");
  const [activeTab, setActiveTab] = useState<'verify' | 'reminders'>('verify');
  
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [usersCache, setUsersCache] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [indexErrorLink, setIndexErrorLink] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Reminders tab state
  const [approvedMembers, setApprovedMembers] = useState<User[]>([]);
  const [sevenDayContributions, setSevenDayContributions] = useState<Record<string, number>>({});
  const [reminderLoading, setReminderLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('pending');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
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

    const q = query(collection(db, 'contributions'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Contribution[] = [];

      snapshot.forEach(d => {
        const c = { id: d.id, ...d.data() } as Contribution;
        data.push(c);
      });

      data.sort((a, b) => b.createdAt - a.createdAt);

      setContributions(data);
      setLoading(false);
    }, (error) => {
      console.error("Error loading contributions:", error);
      setErrorMsg("Failed to load contributions. Please check your permissions or try again.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    if (activeTab === 'reminders') {
      const fetchApprovedAndContribs = async () => {
        try {
          const uSnap = await getDocs(query(collection(db, 'users'), where('status', '==', 'approved')));
          const members: User[] = [];
          uSnap.forEach(d => members.push(d.data() as User));
          setApprovedMembers(members);

          const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
          const cSnap = await getDocs(query(collection(db, 'contributions'), where('status', '==', 'verified'), where('createdAt', '>=', sevenDaysAgo)));
          const cMap: Record<string, number> = {};
          cSnap.forEach(d => {
            const c = d.data() as Contribution;
            if (c.userId) {
              cMap[c.userId] = (cMap[c.userId] || 0) + c.amount;
            }
          });
          setSevenDayContributions(cMap);
        } catch (err) {
          console.error("Error fetching data for reminders:", err);
        }
      };
      fetchApprovedAndContribs();
    }
  }, [activeTab]);

  const handleRunAutomatedReminders = async () => {
    if (!currentUser) return;
    setReminderLoading(true);
    setErrorMsg('');
    setIndexErrorLink('');
    setSuccessMsg('');
    try {
      const result = await triggerContributionReminders(currentUser.uid);
      setSuccessMsg(`Automated reminder check completed. Sent ${result.remindedCount} push notifications to members who haven't contributed UGX 5,000 in the last 7 days.`);
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('requires an index') || msg.includes('failed-precondition')) {
        const urlMatch = msg.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
        setIndexErrorLink(urlMatch ? urlMatch[0] : '');
        setErrorMsg('Database Index Required');
      } else {
        setErrorMsg("Failed to run reminders: " + msg);
        setTimeout(() => setErrorMsg(''), 5000);
      }
    } finally {
      setReminderLoading(false);
    }
  };

  const handleSendSingleReminder = async (userId: string, memberName: string) => {
    if (!currentUser) return;
    setReminderLoading(true);
    setErrorMsg('');
    setIndexErrorLink('');
    setSuccessMsg('');
    try {
      await triggerContributionReminders(currentUser.uid, userId);
      setSuccessMsg(`Contribution reminder push notification successfully sent to ${memberName}.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('requires an index') || msg.includes('failed-precondition')) {
        const urlMatch = msg.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
        setIndexErrorLink(urlMatch ? urlMatch[0] : '');
        setErrorMsg('Database Index Required');
      } else {
        setErrorMsg("Failed to send reminder: " + msg);
        setTimeout(() => setErrorMsg(''), 5000);
      }
    } finally {
      setReminderLoading(false);
    }
  };

  const filteredContributions = (Array.isArray(contributions) ? contributions : []).filter(c => {
    if (!c) return false;
    const member = usersCache?.[c.userId];
    const memberName = String(member?.fullName || '').toLowerCase();
    const ref = String(c.transactionReference || '').toLowerCase();
    const search = String(searchTerm || '').toLowerCase();
    const phone = String(member?.phoneNumber || '');

    const matchesSearch = memberName.includes(search) || ref.includes(search) || phone.includes(search);
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || c.type === categoryFilter;

    const cDate = typeof c.createdAt === 'number' ? c.createdAt : 0;
    const matchesStartDate = !startDate || cDate >= new Date(startDate).getTime();
    const matchesEndDate = !endDate || cDate <= new Date(endDate).setHours(23, 59, 59, 999);

    const matchesMinAmount = !minAmount || (c.amount || 0) >= Number(minAmount);
    const matchesMaxAmount = !maxAmount || (c.amount || 0) <= Number(maxAmount);

    return matchesSearch && matchesStatus && matchesCategory && matchesStartDate && matchesEndDate && matchesMinAmount && matchesMaxAmount;
  });

  const handleExportCSV = () => {
    const exportData = filteredContributions.map(c => {
      const member = usersCache[c.userId];
      return {
        Date: new Date(c.createdAt).toLocaleString(),
        MemberName: member?.fullName || 'Unknown',
        PhoneNumber: member?.phoneNumber || '',
        Type: c.type,
        Amount: c.amount,
        Reference: c.transactionReference,
        Status: c.status,
        VerifiedBy: c.verifiedBy || ''
      };
    });
    exportToCSV('mamas_contributions', exportData);
  };

  const handleVerify = async (contributionId: string) => {
    if (!currentUser) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await verifyContribution(contributionId, currentUser.uid);
      await logActivity('VERIFY_CONTRIBUTION', currentUser.uid, contributionId, 'Verified member payment contribution');
      setSuccessMsg('Contribution successfully verified.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg("Failed to verify: " + err.message);
      setTimeout(() => setErrorMsg(''), 5000);
    }
  };

  const handleReject = async (contributionId: string) => {
    if (!currentUser) return;
    setErrorMsg('');
    setSuccessMsg('');
    const reason = window.prompt("Reason for rejection:");
    if (reason === null) return;
    if (reason.trim() === "") {
      setErrorMsg("A reason is required to reject a payment.");
      setTimeout(() => setErrorMsg(''), 5000);
      return;
    }

    try {
      await rejectContribution(contributionId, currentUser.uid, reason);
      await logActivity('REJECT_CONTRIBUTION', currentUser.uid, contributionId, `Rejected payment contribution: ${reason}`);
      setSuccessMsg('Contribution successfully rejected.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg("Failed to reject: " + err.message);
      setTimeout(() => setErrorMsg(''), 5000);
    }
  };

  if (loading) return <div className="p-8 text-center text-mamas-text-muted">Loading contributions...</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 px-4 font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 text-[10px] font-extrabold uppercase tracking-wider rounded-full px-2.5 py-0.5 border border-blue-200 dark:border-blue-900/60">
              Financial Treasury
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" /> Contributions & Ledger
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">Review, verify, filter, export member payments, and send push notification reminders.</p>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={() => setActiveTab('verify')}
            className={`rounded-2xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'verify' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Verify Payments
          </button>
          <button
            onClick={() => setActiveTab('reminders')}
            className={`rounded-2xl px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'reminders' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Bell className="w-3.5 h-3.5" /> Push Reminders
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className={`relative p-4 rounded-2xl text-xs sm:text-sm font-semibold border animate-in fade-in flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs ${
          indexErrorLink 
            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300' 
            : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300'
        }`}>
          <div className="flex-1">
            {indexErrorLink && <strong className="block font-bold mb-0.5">Database Index Required</strong>}
            <span className="line-clamp-3">{indexErrorLink ? 'This feature needs a Firestore composite index to run. Click the button below to create it automatically.' : errorMsg}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {indexErrorLink && (
              <a href={indexErrorLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-xl font-bold transition-colors text-xs">
                Create Index in Firebase
              </a>
            )}
            <button onClick={() => { setErrorMsg(''); setIndexErrorLink(''); }} className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full text-current cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      
      {successMsg && (
        <div className="relative p-4 rounded-2xl text-xs sm:text-sm font-semibold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 animate-in fade-in flex items-start sm:items-center justify-between gap-3 shadow-xs">
          <span className="line-clamp-3 flex-1">{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-full text-current shrink-0 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeTab === 'reminders' ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Automated Scheduler Runner Card */}
          <div className="bg-gradient-to-br from-[#0f2756] via-[#163574] to-blue-700 text-white p-6 rounded-3xl shadow-sm relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-blue-600/30">
            <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-xs text-white flex items-center justify-center shrink-0 border border-white/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Automated Dues Reminders</h3>
                <p className="text-xs text-blue-100/80 mt-0.5">Scans approved members and delivers notification pushes to accounts with pending balances.</p>
              </div>
            </div>
            <button
              disabled={reminderLoading}
              onClick={handleRunAutomatedReminders}
              className="relative z-10 flex items-center gap-2 bg-white hover:bg-slate-50 text-blue-900 font-extrabold px-5 py-3 rounded-2xl text-xs shadow-xs transition-all disabled:opacity-50 shrink-0 cursor-pointer active:scale-95"
            >
              <Bell className={`w-3.5 h-3.5 text-blue-600 ${reminderLoading ? 'animate-bounce' : ''}`} />
              {reminderLoading ? 'Dispatching...' : 'Dispatch Reminder Sweep'}
            </button>
          </div>

          {/* Member List & Individual Reminders */}
          <div className="bg-white dark:bg-[#0c1731] rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col sm:flex-row items-center justify-between gap-4">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Approved Members 7-Day Standing ({approvedMembers.length})
              </h3>
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search member name or phone..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl pl-10 pr-4 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
                />
              </div>
            </div>

            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {approvedMembers.length === 0 ? (
                <li className="p-12 text-center text-slate-400 font-medium">Loading approved members...</li>
              ) : (
                approvedMembers
                  .filter(m => {
                    const s = String(memberSearch || '').toLowerCase();
                    const name = String(m.fullName || '').toLowerCase();
                    const phone = String(m.phoneNumber || '');
                    return name.includes(s) || phone.includes(s);
                  })
                  .map(member => {
                    const contrib7 = sevenDayContributions[member.uid] || 0;
                    const isDue = contrib7 < 5000;
                    return (
                      <li key={member.uid} className="p-5 sm:p-6 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                            <span className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">{member.fullName}</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                              isDue 
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' 
                                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                            }`}>
                              {isDue ? 'Due for Reminder (< 5k)' : 'Up to Date (>= 5k)'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{member.phoneNumber} • Joined {new Date(member.createdAt).toLocaleDateString()}</p>
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-2">
                            Past 7 days contributed: <span className="text-blue-600 dark:text-blue-400 font-extrabold">{formatUGX(contrib7)}</span>
                          </p>
                        </div>

                        {!isAuditor && (
                          <button
                            disabled={reminderLoading}
                            onClick={() => handleSendSingleReminder(member.uid, member.fullName)}
                            className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" /> Send Reminder Push
                          </button>
                        )}
                      </li>
                    );
                  })
              )}
            </ul>
          </div>
        </div>
      ) : (
        <>
          {/* Filter & Search Bar */}
          <div className="bg-white dark:bg-[#0c1731] p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row gap-3.5 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search member, phone, reference..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl pl-11 pr-4 py-2.5 text-xs sm:text-sm outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
                <div className="flex items-center gap-2 min-w-[140px]">
                  <span className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Status:</span>
                  <SelectDropdown
                    options={[
                      { label: 'All Status', value: 'all' },
                      { label: 'Pending', value: 'pending' },
                      { label: 'Verified', value: 'verified' },
                      { label: 'Rejected', value: 'rejected' }
                    ]}
                    value={statusFilter}
                    onChange={(val) => setStatusFilter(val as any)}
                  />
                </div>

                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    showAdvancedFilters 
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' 
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" /> <span>Filters</span> <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
                </button>

                {canExport && (
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs cursor-pointer active:scale-95"
                    title="Export filtered contributions as CSV"
                  >
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </button>
                )}
              </div>
            </div>

            {/* Advanced Filters Drawer */}
            {showAdvancedFilters && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3 animate-in fade-in duration-200">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Category / Type</label>
                  <SelectDropdown
                    options={[
                      { label: 'All Categories', value: 'all' },
                      { label: 'Welfare Fund', value: 'welfare' },
                      { label: 'Campaign', value: 'campaign' }
                    ]}
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Min (UGX)</label>
                    <input
                      type="number"
                      placeholder="Min"
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Max (UGX)</label>
                    <input
                      type="number"
                      placeholder="Max"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-[#0c1731] rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">Contributions Log ({filteredContributions.length})</h3>
            </div>
            
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredContributions.length === 0 ? (
                <li className="px-6 py-16 flex flex-col items-center justify-center text-center">
                  <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-slate-900 dark:text-white font-extrabold text-sm">No contributions found</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Try adjusting your search filters or date range.</p>
                </li>
              ) : (
                filteredContributions.map(contribution => {
                  const member = usersCache[contribution.userId];
                  const isPending = contribution.status === 'pending';
                  const isVerified = contribution.status === 'verified';
                  return (
                    <li key={contribution.id} className="p-5 sm:p-6 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                        <div className="flex-1">
                          <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                              contribution.type === 'welfare' 
                                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/60' 
                                : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-900/60'
                            }`}>
                              {contribution.type === 'welfare' ? 'Welfare Fund' : 'Campaign'}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                              isVerified 
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' 
                                : isPending 
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' 
                                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                            }`}>
                              {contribution.status}
                            </span>
                            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">{new Date(contribution.createdAt).toLocaleString()}</span>
                          </div>
                          
                          <div className="mt-2">
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider">Payer Member</p>
                            <p className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">{member?.fullName || 'Unknown'}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{member?.phoneNumber || ''}</p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3.5 mt-3.5 bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800 max-w-lg">
                            <div>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider mb-0.5">Amount</p>
                              <p className="font-extrabold text-blue-600 dark:text-blue-400 text-base sm:text-lg">{formatUGX(contribution.amount)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider mb-0.5">Reference Code</p>
                              <p className="font-mono text-xs text-slate-700 dark:text-slate-300 font-semibold bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700 inline-block truncate max-w-full">{contribution.transactionReference}</p>
                            </div>
                          </div>
                        </div>
                        
                        {!isAuditor && isPending && (
                          <div className="flex flex-row md:flex-col gap-2.5 md:w-36 shrink-0">
                            <button onClick={() => handleVerify(contribution.id)} className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer">
                              <Check className="w-4 h-4" /> Verify
                            </button>
                            <button onClick={() => handleReject(contribution.id)} className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer">
                              <X className="w-4 h-4" /> Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

