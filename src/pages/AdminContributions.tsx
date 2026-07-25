import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, getDoc, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Contribution, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { verifyContribution, rejectContribution, logActivity } from '../lib/services';
import { triggerContributionReminders } from '../lib/reminderService';
import { formatUGX, exportToCSV } from '../lib/utils';
import { Check, X, FileText, Search, Filter, Download, ChevronDown, Calendar, DollarSign, Bell, Send, Users, Sparkles } from 'lucide-react';

export default function AdminContributions() {
  const { currentUser, userProfile } = useAuth();
  const isAuditor = userProfile?.role === 'auditor';
  const canExport = ["super_admin", "chairperson", "vice_chairperson", "treasurer", "auditor", "secretary"].includes(userProfile?.role || "");
  const [activeTab, setActiveTab] = useState<'verify' | 'reminders'>('verify');
  
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [usersCache, setUsersCache] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
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
    const q = query(collection(db, 'contributions'));

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
    }, (error) => {
      console.error("Error loading contributions:", error);
      setErrorMsg("Failed to load contributions. Please check your permissions or try again.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [usersCache]);

  useEffect(() => {
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
    setSuccessMsg('');
    try {
      const result = await triggerContributionReminders(currentUser.uid);
      setSuccessMsg(`Automated reminder check completed. Sent ${result.remindedCount} push notifications to members who haven't contributed UGX 5,000 in the last 7 days.`);
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err: any) {
      setErrorMsg("Failed to run reminders: " + err.message);
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setReminderLoading(false);
    }
  };

  const handleSendSingleReminder = async (userId: string, memberName: string) => {
    if (!currentUser) return;
    setReminderLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await triggerContributionReminders(currentUser.uid, userId);
      setSuccessMsg(`Contribution reminder push notification successfully sent to ${memberName}.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg("Failed to send reminder: " + err.message);
      setTimeout(() => setErrorMsg(''), 5000);
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
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-mamas-text">Contributions Management</h2>
          <p className="mt-1 text-sm text-mamas-text-muted">Review, verify, filter, export member payments, and send push notification reminders.</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('verify')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'verify' ? 'bg-white text-mamas-primary shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Verify Payments
          </button>
          <button
            onClick={() => setActiveTab('reminders')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'reminders' ? 'bg-white text-mamas-primary shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Bell className="w-3.5 h-3.5" /> Push Reminders
          </button>
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

      {activeTab === 'reminders' ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Automated Scheduler Runner Card */}
          <div className="bg-gradient-to-br from-teal-900 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-lg relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-xl">
                <div className="inline-flex items-center gap-2 bg-teal-500/20 text-teal-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" /> Automated & Manual Push Reminders
                </div>
                <h3 className="text-xl font-display font-bold">Weekly Contribution Reminder Engine</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Checks all approved members. Automatically targets members who have not contributed or have contributed less than <span className="text-teal-300 font-bold">UGX 5,000</span> in the last 7 days, sending gentle push notifications respecting user permissions and logging all activity.
                </p>
              </div>

              <button
                disabled={reminderLoading}
                onClick={handleRunAutomatedReminders}
                className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-6 py-3.5 rounded-2xl text-sm shadow-md transition-all disabled:opacity-50 flex-shrink-0"
              >
                <Bell className={`w-4 h-4 ${reminderLoading ? 'animate-bounce' : ''}`} />
                {reminderLoading ? 'Processing...' : 'Run Automated Reminder Check'}
              </button>
            </div>
          </div>

          {/* Member List & Individual Reminders */}
          <div className="bg-mamas-card rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <h3 className="text-base font-bold text-mamas-text flex items-center gap-2">
                <Users className="w-4 h-4 text-mamas-primary" /> Approved Members & 7-Day Contribution Status ({approvedMembers.length})
              </h3>
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search member name or phone..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-mamas-accent"
                />
              </div>
            </div>

            <ul className="divide-y divide-slate-100">
              {approvedMembers.length === 0 ? (
                <li className="p-12 text-center text-slate-500">Loading approved members...</li>
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
                      <li key={member.uid} className="p-6 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-bold text-mamas-text text-base">{member.fullName}</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isDue ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-700'
                            }`}>
                              {isDue ? 'Due for Reminder (< 5k)' : 'Up to Date (>= 5k)'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">{member.phoneNumber} • Joined {new Date(member.createdAt).toLocaleDateString()}</p>
                          <p className="text-xs font-semibold text-slate-700 mt-2">
                            Last 7 days contributed: <span className="text-mamas-primary font-bold">{formatUGX(contrib7)}</span>
                          </p>
                        </div>

                        {!isAuditor && (
                          <button
                            disabled={reminderLoading}
                            onClick={() => handleSendSingleReminder(member.uid, member.fullName)}
                            className="flex items-center gap-1.5 bg-mamas-primary/10 hover:bg-mamas-primary/20 text-mamas-primary px-4 py-2 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
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
          <div className="bg-mamas-card p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search member, phone, reference..."
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
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
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
                    title="Export filtered contributions as CSV"
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
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Category / Type</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-mamas-text outline-none"
                  >
                    <option value="all">All Categories</option>
                    <option value="welfare">Welfare Fund</option>
                    <option value="campaign">Campaign</option>
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

          <div className="bg-mamas-card rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-base font-bold text-mamas-text">Contributions List ({filteredContributions.length})</h3>
            </div>
            
            <ul className="divide-y divide-gray-100">
              {filteredContributions.length === 0 ? (
                <li className="px-6 py-12 flex flex-col items-center justify-center text-center">
                  <FileText className="w-12 h-12 text-slate-300 mb-4" />
                  <p className="text-mamas-text font-medium">No contributions found</p>
                  <p className="text-sm text-mamas-text-muted mt-1">Try adjusting your search filters or date range.</p>
                </li>
              ) : (
                filteredContributions.map(contribution => {
                  const member = usersCache[contribution.userId];
                  const isPending = contribution.status === 'pending';
                  const isVerified = contribution.status === 'verified';
                  return (
                    <li key={contribution.id} className="p-6 hover:bg-slate-50 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              contribution.type === 'welfare' ? 'bg-mamas-accent/10 text-mamas-accent-hover' : 'bg-blue-50 text-blue-600'
                            }`}>
                              {contribution.type === 'welfare' ? 'Welfare Fund' : 'Campaign'}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isVerified ? 'bg-teal-50 text-teal-700' : isPending ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                            }`}>
                              {contribution.status}
                            </span>
                            <span className="text-xs text-mamas-text-muted font-medium">{new Date(contribution.createdAt).toLocaleString()}</span>
                          </div>
                          
                          <div className="mt-2">
                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Member</p>
                            <p className="font-semibold text-mamas-text text-base">{member?.fullName || 'Unknown'}</p>
                            <p className="text-xs text-slate-500">{member?.phoneNumber || ''}</p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mt-4 bg-white p-3 rounded-xl border border-slate-100 max-w-lg">
                            <div>
                              <p className="text-xs text-mamas-text-muted uppercase tracking-wider mb-1">Amount</p>
                              <p className="font-bold text-mamas-primary text-lg">{formatUGX(contribution.amount)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-mamas-text-muted uppercase tracking-wider mb-1">Reference</p>
                              <p className="font-mono text-xs text-slate-700 font-medium bg-slate-50 px-2 py-1 rounded inline-block truncate max-w-full">{contribution.transactionReference}</p>
                            </div>
                          </div>
                        </div>
                        
                        {!isAuditor && isPending && (
                          <div className="flex flex-row md:flex-col gap-3 md:w-40 flex-shrink-0">
                            <button onClick={() => handleVerify(contribution.id)} className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors">
                              <Check className="w-4 h-4" /> Verify
                            </button>
                            <button onClick={() => handleReject(contribution.id)} className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors">
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

