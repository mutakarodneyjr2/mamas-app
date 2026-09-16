import React, { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Contribution, User, SchoolCampaign, WelfareRequest } from '../types';
import { formatUGX, exportToCSV } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { 
  TrendingUp, Users, Heart, Target, FileText, Download, CheckCircle2, 
  Info, ArrowUpRight, Search, Filter, Shield, HeartHandshake, Banknote, 
  Clock, AlertCircle, Eye, EyeOff, CheckCircle, XCircle, ChevronDown, 
  ChevronUp, ArrowDownLeft, ArrowUpRightFromSquare, Sparkles, RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function AdminReports() {
  const { userProfile, currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'welfare'>('overview');

  // Core Data
  const [users, setUsers] = useState<User[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [campaigns, setCampaigns] = useState<SchoolCampaign[]>([]);
  const [welfareRequests, setWelfareRequests] = useState<WelfareRequest[]>([]);
  
  // Modals & View Modes
  const [showExportModal, setShowExportModal] = useState(false);
  const [isPublicSafeView, setIsPublicSafeView] = useState(false);

  // Campaign Filter State
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [campaignSearch, setCampaignSearch] = useState('');
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<'all' | 'verified' | 'pending' | 'failed'>('all');

  // Welfare Filter State
  const [selectedWelfareId, setSelectedWelfareId] = useState<string>('all');
  const [welfareSearch, setWelfareSearch] = useState('');
  const [welfareStatusFilter, setWelfareStatusFilter] = useState<'all' | 'verified' | 'pending' | 'failed'>('all');

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [uSnap, cSnap, campSnap, wSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'contributions')),
        getDocs(collection(db, 'schoolCampaigns')),
        getDocs(collection(db, 'welfareRequests'))
      ]);

      setUsers(uSnap.docs.map(d => ({ uid: d.id, ...d.data() } as User)));
      setContributions(cSnap.docs.map(d => ({ id: d.id, ...d.data() } as Contribution)));
      setCampaigns(campSnap.docs.map(d => ({ id: d.id, ...d.data() } as SchoolCampaign)));
      setWelfareRequests(wSnap.docs.map(d => ({ id: d.id, ...d.data() } as WelfareRequest)));
    } catch (err) {
      console.error("Error fetching reports data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Map users cache for quick lookups
  const userMap = useMemo(() => {
    const map: Record<string, User> = {};
    users.forEach(u => {
      map[u.uid] = u;
    });
    return map;
  }, [users]);

  // Verified & Active Members Math
  const approvedUsers = users.filter(u => u.status === 'approved');
  const activeMembers = approvedUsers.filter(u => u.contributionStatus === 'active').length;
  const inactiveMembers = approvedUsers.filter(u => u.contributionStatus === 'inactive').length;

  // General Financial Overview Math (Strictly verified for balances)
  const verifiedContribs = useMemo(() => contributions.filter(c => c.status === 'verified'), [contributions]);
  
  const totalWelfareCollected = verifiedContribs
    .filter(c => c.type === 'welfare' || c.purpose === 'welfare')
    .reduce((sum, c) => sum + (c.amount || 0), 0);

  const totalWelfarePaidOut = welfareRequests
    .filter(w => w.status === 'paid' || w.disbursementStatus === 'paid' || w.disbursementStatus === 'successful')
    .reduce((sum, w) => sum + (w.paidAmount || w.amountRequested || 0), 0);

  const netWelfareBalance = Math.max(0, totalWelfareCollected - totalWelfarePaidOut);

  const totalCampaignCollected = verifiedContribs
    .filter(c => c.type === 'school_support' || c.purpose === 'campaign')
    .reduce((sum, c) => sum + (c.amount || 0), 0);

  const totalSolidarityCollected = verifiedContribs
    .filter(c => c.type === 'welfare_support' || c.purpose === 'welfare_support')
    .reduce((sum, c) => sum + (c.amount || 0), 0);

  // 6 Months Collections Data
  const monthlyDataMap: Record<string, number> = {};
  verifiedContribs.forEach(c => {
    if (c.createdAt) {
      const date = new Date(c.createdAt);
      const monthKey = date.toLocaleString('default', { month: 'short' });
      monthlyDataMap[monthKey] = (monthlyDataMap[monthKey] || 0) + (c.amount || 0);
    }
  });

  const monthsArr: { name: string; amount: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mKey = d.toLocaleString('default', { month: 'short' });
    monthsArr.push({ name: mKey, amount: monthlyDataMap[mKey] || 0 });
  }

  const memberStatusData = [
    { name: 'Active', value: activeMembers, color: '#2563eb' },
    { name: 'Inactive', value: inactiveMembers, color: '#94a3b8' },
  ];

  // ==========================================
  // CAMPAIGN REPORTS LOGIC (E1)
  // ==========================================
  const campaignContributions = useMemo(() => {
    return contributions.filter(c => {
      const isCamp = c.type === 'school_support' || c.purpose === 'campaign';
      if (!isCamp) return false;
      if (selectedCampaignId !== 'all' && c.campaignId !== selectedCampaignId) return false;
      return true;
    });
  }, [contributions, selectedCampaignId]);

  const selectedCampaignObj = useMemo(() => {
    if (selectedCampaignId === 'all') return null;
    return campaigns.find(c => c.id === selectedCampaignId) || null;
  }, [campaigns, selectedCampaignId]);

  const campaignStats = useMemo(() => {
    const verified = campaignContributions.filter(c => c.status === 'verified');
    const pending = campaignContributions.filter(c => c.status === 'pending');
    const failed = campaignContributions.filter(c => c.status === 'rejected' || (c as any).paymentStatus === 'failed');

    const verifiedTotal = verified.reduce((sum, c) => sum + (c.amount || 0), 0);
    const pendingTotal = pending.reduce((sum, c) => sum + (c.amount || 0), 0);
    const target = selectedCampaignObj ? selectedCampaignObj.targetAmount : campaigns.reduce((s, c) => s + (c.targetAmount || 0), 0);
    const progress = target > 0 ? (verifiedTotal / target) * 100 : 0;
    const uniqueSupporters = new Set(verified.map(c => c.userId || c.userName || 'anon')).size;

    return {
      target,
      verifiedTotal,
      pendingTotal,
      progress,
      verifiedCount: verified.length,
      pendingCount: pending.length,
      failedCount: failed.length,
      uniqueSupporters
    };
  }, [campaignContributions, selectedCampaignObj, campaigns]);

  const filteredCampaignContributions = useMemo(() => {
    return campaignContributions.filter(c => {
      if (campaignStatusFilter !== 'all') {
        if (campaignStatusFilter === 'verified' && c.status !== 'verified') return false;
        if (campaignStatusFilter === 'pending' && c.status !== 'pending') return false;
        if (campaignStatusFilter === 'failed' && c.status !== 'rejected' && (c as any).paymentStatus !== 'failed') return false;
      }
      if (campaignSearch.trim()) {
        const q = campaignSearch.toLowerCase();
        const user = c.userId ? userMap[c.userId] : null;
        const name = (c.userName || user?.fullName || '').toLowerCase();
        const ref = (c.transactionReference || c.relworxReference || c.id || '').toLowerCase();
        if (!name.includes(q) && !ref.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [campaignContributions, campaignStatusFilter, campaignSearch, userMap]);

  const handleExportCampaignCSV = () => {
    const campTitle = selectedCampaignObj ? selectedCampaignObj.title : "All_School_Campaigns";
    const rows = filteredCampaignContributions.map(c => {
      const user = c.userId ? userMap[c.userId] : null;
      const donorName = isPublicSafeView 
        ? (c.isAnonymous ? "Anonymous Member" : user?.fullName || c.userName || "Alumni Member")
        : (user?.fullName || c.userName || "Unknown Member");

      return {
        "Campaign Title": selectedCampaignObj ? selectedCampaignObj.title : (campaigns.find(camp => camp.id === c.campaignId)?.title || "General Campaign"),
        "Contributor Name": donorName,
        "Amount (UGX)": c.amount || 0,
        "Status": c.status || 'unknown',
        "Payment Channel": c.network || c.paymentMethod || "Mobile Money",
        "Reference": isPublicSafeView ? "REDACTED" : (c.relworxReference || c.transactionReference || c.id),
        "Date": c.createdAt ? new Date(c.createdAt).toLocaleString('en-UG') : 'N/A'
      };
    });

    exportToCSV(`Campaign_Report_${campTitle.replace(/\s+/g, '_')}`, rows);
  };

  // ==========================================
  // WELFARE REPORTS LOGIC (E2)
  // ==========================================
  const selectedWelfareObj = useMemo(() => {
    if (selectedWelfareId === 'all') return null;
    return welfareRequests.find(w => w.id === selectedWelfareId) || null;
  }, [welfareRequests, selectedWelfareId]);

  // Section 2: Solidarity contributions for welfare appeals
  const welfareSolidarityContributions = useMemo(() => {
    return contributions.filter(c => {
      const isSolidarity = c.type === 'welfare_support' || c.purpose === 'welfare_support';
      if (!isSolidarity) return false;
      const targetWelfareId = c.welfareRequestId || c.campaignId;
      if (selectedWelfareId !== 'all' && targetWelfareId !== selectedWelfareId) return false;
      return true;
    });
  }, [contributions, selectedWelfareId]);

  const solidarityStats = useMemo(() => {
    const verified = welfareSolidarityContributions.filter(c => c.status === 'verified');
    const pending = welfareSolidarityContributions.filter(c => c.status === 'pending');
    const failed = welfareSolidarityContributions.filter(c => c.status === 'rejected' || (c as any).paymentStatus === 'failed');

    const verifiedTotal = verified.reduce((sum, c) => sum + (c.amount || 0), 0);
    const pendingTotal = pending.reduce((sum, c) => sum + (c.amount || 0), 0);
    const target = selectedWelfareObj ? (selectedWelfareObj.supportTargetAmount || selectedWelfareObj.amountRequested || 0) : 0;
    const progress = target > 0 ? (verifiedTotal / target) * 100 : 0;
    const uniqueSupporters = new Set(verified.map(c => c.userId || c.userName || 'anon')).size;

    return {
      target,
      verifiedTotal,
      pendingTotal,
      progress,
      verifiedCount: verified.length,
      pendingCount: pending.length,
      failedCount: failed.length,
      uniqueSupporters
    };
  }, [welfareSolidarityContributions, selectedWelfareObj]);

  const filteredSolidarityContributions = useMemo(() => {
    return welfareSolidarityContributions.filter(c => {
      if (welfareStatusFilter !== 'all') {
        if (welfareStatusFilter === 'verified' && c.status !== 'verified') return false;
        if (welfareStatusFilter === 'pending' && c.status !== 'pending') return false;
        if (welfareStatusFilter === 'failed' && c.status !== 'rejected' && (c as any).paymentStatus !== 'failed') return false;
      }
      if (welfareSearch.trim()) {
        const q = welfareSearch.toLowerCase();
        const user = c.userId ? userMap[c.userId] : null;
        const name = (c.userName || user?.fullName || '').toLowerCase();
        const ref = (c.transactionReference || c.relworxReference || c.id || '').toLowerCase();
        if (!name.includes(q) && !ref.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [welfareSolidarityContributions, welfareStatusFilter, welfareSearch, userMap]);

  const handleExportWelfareCSV = () => {
    const title = selectedWelfareObj ? `${selectedWelfareObj.category}_${selectedWelfareObj.personName}` : "All_Welfare_Cases";
    
    // Create combined multi-section rows
    const rows: Record<string, any>[] = [];

    // 1. Association Disbursement Details (if selected)
    if (selectedWelfareObj) {
      rows.push({
        "Record Type": "ASSOCIATION_TREASURY_DISBURSEMENT",
        "Welfare Case / Category": selectedWelfareObj.category,
        "Beneficiary / Supporter": selectedWelfareObj.personName,
        "Amount (UGX)": selectedWelfareObj.paidAmount || selectedWelfareObj.amountRequested,
        "Status": selectedWelfareObj.status === 'paid' ? 'PAID_OUT' : selectedWelfareObj.status,
        "Disbursement Ref": isPublicSafeView ? "REDACTED" : (selectedWelfareObj.relworxDisbursementId || selectedWelfareObj.paidTransactionReference || "N/A"),
        "Recipient Phone": isPublicSafeView ? "REDACTED" : selectedWelfareObj.recipientPhoneNumber,
        "Date": selectedWelfareObj.paidAt ? new Date(selectedWelfareObj.paidAt).toLocaleString('en-UG') : 'N/A',
        "Approvals Count": (selectedWelfareObj.votes || []).filter(v => v.vote === 'approve').length
      });
    }

    // 2. Member Solidarity Supports
    filteredSolidarityContributions.forEach(c => {
      const user = c.userId ? userMap[c.userId] : null;
      const donorName = isPublicSafeView 
        ? (c.isAnonymous ? "Anonymous Member" : user?.fullName || c.userName || "Alumni Member")
        : (user?.fullName || c.userName || "Unknown Member");

      rows.push({
        "Record Type": "MEMBER_SOLIDARITY_SUPPORT",
        "Welfare Case / Category": selectedWelfareObj ? selectedWelfareObj.category : "Solidarity Support",
        "Beneficiary / Supporter": donorName,
        "Amount (UGX)": c.amount || 0,
        "Status": c.status || 'unknown',
        "Disbursement Ref": isPublicSafeView ? "REDACTED" : (c.relworxReference || c.transactionReference || c.id),
        "Recipient Phone": "N/A",
        "Date": c.createdAt ? new Date(c.createdAt).toLocaleString('en-UG') : 'N/A',
        "Approvals Count": "N/A"
      });
    });

    exportToCSV(`Welfare_Report_${title.replace(/\s+/g, '_')}`, rows);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 font-medium animate-pulse max-w-lg mx-auto">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Generating Financial Ledger & Governance Reports...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 px-4 font-sans">
      
      {/* Header with View Toggle & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 text-[10px] font-extrabold uppercase tracking-wider rounded-full px-2.5 py-0.5 border border-blue-200 dark:border-blue-900/60">
              Financial Governance
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" /> Financial Reports & Ledgers
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5">
            Audit-grade reporting for Association Treasury, School Campaigns, and Solidarity Appeals
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Public-Safe View Toggle */}
          <button
            type="button"
            onClick={() => setIsPublicSafeView(!isPublicSafeView)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all border cursor-pointer ${
              isPublicSafeView 
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800' 
                : 'bg-white dark:bg-[#0c1731] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
            title="Toggle between full finance view and privacy-safe public view"
          >
            {isPublicSafeView ? <EyeOff className="w-4 h-4 text-amber-600" /> : <Eye className="w-4 h-4 text-blue-600" />}
            <span>{isPublicSafeView ? 'Public-Safe Mode' : 'Admin / Finance Mode'}</span>
          </button>

          <button
            type="button"
            onClick={fetchData}
            disabled={refreshing}
            className="p-2 rounded-2xl bg-white dark:bg-[#0c1731] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
            title="Refresh Report Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-4 text-xs font-extrabold transition-all border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Association Overview
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('campaigns')}
          className={`pb-3 px-4 text-xs font-extrabold transition-all border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeTab === 'campaigns'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Target className="w-4 h-4" /> School Campaigns ({campaigns.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('welfare')}
          className={`pb-3 px-4 text-xs font-extrabold transition-all border-b-2 whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeTab === 'welfare'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <HeartHandshake className="w-4 h-4" /> Welfare & Solidarity ({welfareRequests.length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ASSOCIATION OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Top Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            
            {/* Total Members */}
            <div className="bg-white dark:bg-[#0c1731] p-4 sm:p-5 rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Members</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/60 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{users.length}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{activeMembers} Active</span> • <span className="text-slate-400">{inactiveMembers} Inactive</span>
                </p>
              </div>
            </div>

            {/* Welfare Fund Collected */}
            <div className="bg-white dark:bg-[#0c1731] p-4 sm:p-5 rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Welfare Pool</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/60 flex items-center justify-center">
                  <Heart className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">{formatUGX(totalWelfareCollected)}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-1">Verified Member dues</p>
              </div>
            </div>

            {/* Welfare Paid Out & Net */}
            <div className="bg-white dark:bg-[#0c1731] p-4 sm:p-5 rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Welfare Disbursed</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/60 flex items-center justify-center">
                  <Banknote className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">{formatUGX(totalWelfarePaidOut)}</p>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-extrabold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg inline-block mt-1 border border-emerald-200/60 dark:border-emerald-800">
                  Net Balance: {formatUGX(netWelfareBalance)}
                </p>
              </div>
            </div>

            {/* School Campaigns + Solidarity */}
            <div className="bg-gradient-to-br from-[#0f2756] via-[#163574] to-blue-700 p-4 sm:p-5 rounded-3xl shadow-xs flex flex-col justify-between text-white relative overflow-hidden border border-blue-600/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold text-blue-200 uppercase tracking-wider">Campaigns & Solidarity</span>
                <div className="w-8 h-8 rounded-xl bg-white/15 text-white flex items-center justify-center border border-white/20">
                  <Target className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-lg sm:text-xl font-extrabold text-white tracking-tight">{formatUGX(totalCampaignCollected + totalSolidarityCollected)}</p>
                <p className="text-[11px] text-blue-200 font-medium mt-1">
                  School: {formatUGX(totalCampaignCollected)} • Solidarity: {formatUGX(totalSolidarityCollected)}
                </p>
              </div>
            </div>

          </div>

          {/* Member Activity Chart & Monthly Collections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Member Activity Breakdown */}
            <div className="bg-white dark:bg-[#0c1731] rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">Member Status Breakdown</h3>
                <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">{users.length} registered accounts</span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="w-40 h-40 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={memberStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={65}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                      >
                        {memberStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#2563eb' : '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex-1 w-full space-y-3">
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Active Contributors</span>
                    </div>
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">{activeMembers} ({approvedUsers.length > 0 ? Math.round((activeMembers / approvedUsers.length) * 100) : 0}%)</span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full bg-slate-400"></div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Inactive Members</span>
                    </div>
                    <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400">{inactiveMembers} ({approvedUsers.length > 0 ? Math.round((inactiveMembers / approvedUsers.length) * 100) : 0}%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Monthly Collections Trend */}
            <div className="bg-white dark:bg-[#0c1731] rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">Collections (Last 6 Months)</h3>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">Verified monthly inflows</p>
                </div>
                <span className="text-[10px] font-extrabold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/60 px-3 py-1 rounded-full uppercase tracking-wider">
                  UGX Trend
                </span>
              </div>

              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthsArr}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 11}} dy={5} />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#94A3B8', fontSize: 11}}
                      tickFormatter={(val) => val >= 1000 ? `${val / 1000}k` : `${val}`}
                      dx={-5}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatUGX(value), 'Amount']}
                      cursor={{fill: '#F8FAFC'}}
                      contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
                    />
                    <Bar dataKey="amount" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Detailed Statement Modal Trigger */}
          <div className="pt-2 flex justify-center">
            <button
              onClick={() => setShowExportModal(true)}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3.5 px-8 rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer active:scale-95"
            >
              <Download className="w-4 h-4 text-white" /> View Association Financial Statement
            </button>
          </div>

          {/* LOW-01: Disaster Recovery & Backup Readiness Card */}
          <div className="bg-white dark:bg-[#0c1731] p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-extrabold border border-blue-200/60 dark:border-blue-900/50">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Disaster Recovery & Backup Readiness (LOW-01)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Association data integrity and cold-storage export procedures</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-1">1. Operational CSV Exports</span>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">Administrators can export itemized contributions, campaign gifts, and welfare logs to CSV anytime via the Admin Contributions and Reports tabs for offline auditing.</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-1">2. Firestore Automated Backups</span>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">Cloud Firestore automated daily backups are configured in the Google Cloud / Firebase console to ensure point-in-time recovery for the financial ledger.</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-1">3. Immutable Ledger Integrity</span>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">All financial transactions, welfare payouts, and administrative approvals are immutable and secured with audit logging to prevent tampering or silent data loss.</p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SCHOOL CAMPAIGNS REPORTS (E1) */}
      {/* ========================================================================= */}
      {activeTab === 'campaigns' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Campaign Selector & Actions Bar */}
          <div className="bg-white dark:bg-[#0c1731] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="w-full md:w-auto flex-1">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1.5">
                Select School Campaign
              </label>
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="w-full md:max-w-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs font-extrabold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All School Campaigns (Consolidated)</option>
                {campaigns.map(camp => (
                  <option key={camp.id} value={camp.id}>
                    {camp.title} ({camp.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <button
                type="button"
                onClick={handleExportCampaignCSV}
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl text-xs font-extrabold shadow-xs transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" /> Export Campaign CSV
              </button>
            </div>
          </div>

          {/* Campaign Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white dark:bg-[#0c1731] p-4.5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Target Amount</span>
              <p className="text-lg font-extrabold text-slate-900 dark:text-white">{formatUGX(campaignStats.target)}</p>
              <p className="text-[11px] text-slate-500 mt-1 font-semibold">Goal for project</p>
            </div>

            <div className="bg-white dark:bg-[#0c1731] p-4.5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">Verified Raised</span>
              <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{formatUGX(campaignStats.verifiedTotal)}</p>
              <p className="text-[11px] text-slate-500 mt-1 font-semibold">{campaignStats.progress.toFixed(1)}% funded • {campaignStats.verifiedCount} gifts</p>
            </div>

            <div className="bg-white dark:bg-[#0c1731] p-4.5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider block mb-1">Pending Inflows</span>
              <p className="text-lg font-extrabold text-amber-600 dark:text-amber-400">{formatUGX(campaignStats.pendingTotal)}</p>
              <p className="text-[11px] text-slate-400 mt-1 italic font-medium">Awaiting PIN / webhook</p>
            </div>

            <div className="bg-white dark:bg-[#0c1731] p-4.5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-1">Contributors</span>
              <p className="text-lg font-extrabold text-slate-900 dark:text-white">{campaignStats.uniqueSupporters}</p>
              <p className="text-[11px] text-slate-500 mt-1 font-semibold">Unique supporters</p>
            </div>
          </div>

          {/* Itemized Contributions Table */}
          <div className="bg-white dark:bg-[#0c1731] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  Itemized Campaign Contributions ({filteredCampaignContributions.length})
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isPublicSafeView ? "Public-safe ledger (anonymous records respected)" : "Audit ledger with member identities and transaction references"}
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={campaignSearch}
                    onChange={(e) => setCampaignSearch(e.target.value)}
                    placeholder="Search name or ref..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-hidden"
                  />
                </div>

                <select
                  value={campaignStatusFilter}
                  onChange={(e) => setCampaignStatusFilter(e.target.value as any)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-hidden"
                >
                  <option value="all">All Status</option>
                  <option value="verified">Verified Only</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>

            {filteredCampaignContributions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs italic">
                No campaign contributions found matching the criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-400 dark:text-slate-500 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Contributor</th>
                      <th className="py-3 px-4">Amount (UGX)</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Channel / Ref</th>
                      <th className="py-3 px-4 text-right">Date & Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredCampaignContributions.map((c, idx) => {
                      const user = c.userId ? userMap[c.userId] : null;
                      const isAnon = c.isAnonymous || isPublicSafeView;
                      const displayName = isAnon 
                        ? (c.isAnonymous ? "Anonymous Member" : user?.fullName || c.userName || "Alumni Member")
                        : (user?.fullName || c.userName || "Alumni Member");

                      const isVerified = c.status === 'verified';
                      const isPending = c.status === 'pending';

                      return (
                        <tr key={c.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <span>{displayName}</span>
                              {c.isAnonymous && (
                                <span className="px-1.5 py-0.2 text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-md">Anon</span>
                              )}
                            </div>
                            {!isPublicSafeView && user?.phoneNumber && (
                              <span className="text-[10px] text-slate-400 block font-normal font-mono">{user.phoneNumber}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-extrabold font-mono text-slate-900 dark:text-white">
                            {formatUGX(c.amount)}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${
                              isVerified 
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' 
                                : isPending
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                            }`}>
                              {c.status || 'unknown'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{c.network || "Mobile Money"}</span>
                            {!isPublicSafeView && (
                              <span className="text-[10px] text-slate-400 block font-mono truncate max-w-[140px]">
                                {c.relworxReference || c.transactionReference || c.id}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-500 dark:text-slate-400 font-medium">
                            {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: WELFARE APPEAL & SOLIDARITY REPORTS (E2) */}
      {/* ========================================================================= */}
      {activeTab === 'welfare' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Welfare Case Selector & Actions Bar */}
          <div className="bg-white dark:bg-[#0c1731] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="w-full md:w-auto flex-1">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1.5">
                Select Welfare Case
              </label>
              <select
                value={selectedWelfareId}
                onChange={(e) => setSelectedWelfareId(e.target.value)}
                className="w-full md:max-w-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs font-extrabold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Welfare Cases (Consolidated)</option>
                {welfareRequests.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.category} - {w.personName} ({w.status}) {w.isPublishedToFeed ? '• Published' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <button
                type="button"
                onClick={handleExportWelfareCSV}
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl text-xs font-extrabold shadow-xs transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" /> Export Welfare CSV
              </button>
            </div>
          </div>

          {/* SPLIT SECTION 1: ASSOCIATION TREASURY DISBURSEMENT (MONEY OUT) */}
          <div className="bg-white dark:bg-[#0c1731] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="px-5 py-4 bg-amber-50/60 dark:bg-amber-950/30 border-b border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="font-extrabold text-sm sm:text-base text-amber-900 dark:text-amber-300">
                  Section 1: Association Treasury Disbursement (Money Out)
                </h3>
              </div>
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                Official Treasury
              </span>
            </div>

            <div className="p-5">
              {selectedWelfareObj ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Approved Payout</span>
                    <p className="text-xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">
                      {formatUGX(selectedWelfareObj.paidAmount || selectedWelfareObj.amountRequested)}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">Status: <strong className="uppercase">{selectedWelfareObj.status}</strong></p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Beneficiary & Recipient</span>
                    <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {selectedWelfareObj.personName} ({selectedWelfareObj.relationship})
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 font-mono">
                      {isPublicSafeView ? "REDACTED" : selectedWelfareObj.recipientPhoneNumber}
                    </p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Disbursement Ref & Approval</span>
                    <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                      {(selectedWelfareObj.votes || []).filter(v => v.vote === 'approve').length} Approving Committee Votes
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono truncate">
                      {isPublicSafeView ? "REDACTED" : (selectedWelfareObj.relworxDisbursementId || selectedWelfareObj.paidTransactionReference || "Awaiting Payout Execution")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                  <p className="font-bold">Total Disbursed Across All Cases: <span className="text-rose-600 dark:text-rose-400 font-extrabold font-mono text-sm">{formatUGX(totalWelfarePaidOut)}</span></p>
                  <p className="text-slate-400 text-[11px] mt-1">Select an individual welfare claim above to view specific payout records, approver signatures, and transaction hashes.</p>
                </div>
              )}
            </div>
          </div>

          {/* SPLIT SECTION 2: MEMBER SOLIDARITY SUPPORT (MONEY IN) */}
          <div className="bg-white dark:bg-[#0c1731] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="px-5 py-4 bg-rose-50/60 dark:bg-rose-950/30 border-b border-rose-200/60 dark:border-rose-900/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                <h3 className="font-extrabold text-sm sm:text-base text-rose-900 dark:text-rose-300">
                  Section 2: Member Solidarity Support (Money In)
                </h3>
              </div>
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300">
                Direct Alumni Giving
              </span>
            </div>

            <div className="p-5 space-y-5">
              
              {/* Solidarity Inflows Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Solidarity Goal</span>
                  <p className="text-base font-extrabold text-slate-900 dark:text-white">{formatUGX(solidarityStats.target)}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Public Appeal Target</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">Verified Raised</span>
                  <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">{formatUGX(solidarityStats.verifiedTotal)}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium">{solidarityStats.verifiedCount} verified supports</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider block mb-1">Pending Supports</span>
                  <p className="text-base font-extrabold text-amber-600 dark:text-amber-400">{formatUGX(solidarityStats.pendingTotal)}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 italic font-medium">Awaiting payment</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-wider block mb-1">Supporters</span>
                  <p className="text-base font-extrabold text-slate-900 dark:text-white">{solidarityStats.uniqueSupporters}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Alumni donors</p>
                </div>
              </div>

              {/* Itemized Solidarity Gifts Table */}
              <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                    Itemized Solidarity Contributions ({filteredSolidarityContributions.length})
                  </h4>

                  {/* Filters */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-44">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={welfareSearch}
                        onChange={(e) => setWelfareSearch(e.target.value)}
                        placeholder="Search supporter..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-hidden"
                      />
                    </div>

                    <select
                      value={welfareStatusFilter}
                      onChange={(e) => setWelfareStatusFilter(e.target.value as any)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-hidden"
                    >
                      <option value="all">All</option>
                      <option value="verified">Verified</option>
                      <option value="pending">Pending</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>
                </div>

                {filteredSolidarityContributions.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs italic">
                    No solidarity support gifts recorded for this selection.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-400 dark:text-slate-500 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                        <tr>
                          <th className="py-3 px-4">Supporter</th>
                          <th className="py-3 px-4">Amount (UGX)</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Channel / Ref</th>
                          <th className="py-3 px-4 text-right">Date & Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {filteredSolidarityContributions.map((c, idx) => {
                          const user = c.userId ? userMap[c.userId] : null;
                          const isAnon = c.isAnonymous || isPublicSafeView;
                          const displayName = isAnon 
                            ? (c.isAnonymous ? "Anonymous Member" : user?.fullName || c.userName || "Alumni Member")
                            : (user?.fullName || c.userName || "Alumni Member");

                          const isVerified = c.status === 'verified';
                          const isPending = c.status === 'pending';

                          return (
                            <tr key={c.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                              <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                                <div className="flex items-center gap-2">
                                  <span>{displayName}</span>
                                  {c.isAnonymous && (
                                    <span className="px-1.5 py-0.2 text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-md">Anon</span>
                                  )}
                                </div>
                                {!isPublicSafeView && user?.phoneNumber && (
                                  <span className="text-[10px] text-slate-400 block font-normal font-mono">{user.phoneNumber}</span>
                                )}
                              </td>
                              <td className="py-3 px-4 font-extrabold font-mono text-slate-900 dark:text-white">
                                {formatUGX(c.amount)}
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${
                                  isVerified 
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' 
                                    : isPending
                                    ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                                }`}>
                                  {c.status || 'unknown'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">{c.network || "Mobile Money"}</span>
                                {!isPublicSafeView && (
                                  <span className="text-[10px] text-slate-400 block font-mono truncate max-w-[140px]">
                                    {c.relworxReference || c.transactionReference || c.id}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right text-slate-500 dark:text-slate-400 font-medium">
                                {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>
      )}

      {/* Export Summary Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0c1731] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Association Financial Statement
              </h3>
              <button 
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <div className="py-5 space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Total Registered Members:</span>
                <span className="font-extrabold text-slate-900 dark:text-white">{users.length}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Active Contributors:</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{activeMembers}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Total Welfare Collected:</span>
                <span className="font-extrabold text-slate-900 dark:text-white">{formatUGX(totalWelfareCollected)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Total Welfare Disbursed:</span>
                <span className="font-extrabold text-rose-600 dark:text-rose-400">{formatUGX(totalWelfarePaidOut)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800 bg-blue-50/50 dark:bg-blue-950/40 p-2.5 rounded-xl">
                <span className="font-extrabold text-blue-700 dark:text-blue-300">Net Welfare Pool Balance:</span>
                <span className="font-extrabold text-blue-700 dark:text-blue-300">{formatUGX(netWelfareBalance)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Total School Support Raised:</span>
                <span className="font-extrabold text-slate-900 dark:text-white">{formatUGX(totalCampaignCollected)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Total Member Solidarity Raised:</span>
                <span className="font-extrabold text-rose-600 dark:text-rose-400">{formatUGX(totalSolidarityCollected)}</span>
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl font-extrabold text-xs shadow-xs transition-all cursor-pointer"
              >
                Print / Save PDF
              </button>
              <button
                onClick={() => setShowExportModal(false)}
                className="px-5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-xs transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
