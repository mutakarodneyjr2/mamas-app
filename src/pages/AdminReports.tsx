import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Contribution, User, SchoolCampaign, WelfareRequest } from '../types';
import { formatUGX } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, Heart, Target, FileText, Download, CheckCircle2, Info, ArrowUpRight } from 'lucide-react';

export default function AdminReports() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [campaigns, setCampaigns] = useState<SchoolCampaign[]>([]);
  const [welfareRequests, setWelfareRequests] = useState<WelfareRequest[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [uSnap, cSnap, campSnap, wSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(query(collection(db, 'contributions'), where('status', '==', 'verified'))),
          getDocs(collection(db, 'schoolCampaigns')),
          getDocs(collection(db, 'welfareRequests'))
        ]);

        setUsers(uSnap.docs.map(d => d.data() as User));
        setContributions(cSnap.docs.map(d => d.data() as Contribution));
        setCampaigns(campSnap.docs.map(d => d.data() as SchoolCampaign));
        setWelfareRequests(wSnap.docs.map(d => d.data() as WelfareRequest));
      } catch (err) {
        console.error("Error fetching reports data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center text-mamas-text-muted font-medium animate-pulse">
        Generating financial and performance analytics...
      </div>
    );
  }

  const approvedUsers = users.filter(u => u.status === 'approved');
  const activeMembers = approvedUsers.filter(u => u.contributionStatus === 'active').length;
  const inactiveMembers = approvedUsers.filter(u => u.contributionStatus === 'inactive').length;

  const totalWelfareCollected = contributions.filter(c => c.type === 'welfare').reduce((sum, c) => sum + (c.amount || 0), 0);
  const totalWelfarePaidOut = welfareRequests.filter(w => w.status === 'paid').reduce((sum, w) => sum + (w.paidAmount || 0), 0);
  const netWelfareBalance = Math.max(0, totalWelfareCollected - totalWelfarePaidOut);
  const totalCampaignCollected = contributions.filter(c => c.type === 'school_support').reduce((sum, c) => sum + (c.amount || 0), 0);

  // 6 Months Collections Data
  const monthlyDataMap: Record<string, number> = {};
  contributions.forEach(c => {
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
    { name: 'Active', value: activeMembers, color: '#0d9488' }, // teal-600
    { name: 'Inactive', value: inactiveMembers, color: '#94a3b8' }, // slate-400
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 px-4 font-sans">
      
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 text-[10px] font-extrabold uppercase tracking-wider rounded-full px-2.5 py-0.5 border border-blue-200 dark:border-blue-900/60">
            Analytics Suite
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" /> Analytics & Reports
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5">Comprehensive financial and member activity summary.</p>
      </div>

      {/* 1. TOP SUMMARY CARDS (2-Column Grid for Compact Mobile View) */}
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
            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Welfare Collected</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/60 flex items-center justify-center">
              <Heart className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">{formatUGX(totalWelfareCollected)}</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-1">Member contributions</p>
          </div>
        </div>

        {/* Welfare Paid Out & Balance */}
        <div className="bg-white dark:bg-[#0c1731] p-4 sm:p-5 rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Welfare Paid Out</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/60 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">{formatUGX(totalWelfarePaidOut)}</p>
            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-extrabold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg inline-block mt-1 border border-emerald-200/60 dark:border-emerald-800">
              Net: {formatUGX(netWelfareBalance)}
            </p>
          </div>
        </div>

        {/* Total Campaigns Funded */}
        <div className="bg-gradient-to-br from-[#0f2756] via-[#163574] to-blue-700 p-4 sm:p-5 rounded-3xl shadow-xs flex flex-col justify-between text-white relative overflow-hidden border border-blue-600/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold text-blue-200 uppercase tracking-wider">Campaigns Funded</span>
            <div className="w-8 h-8 rounded-xl bg-white/15 text-white flex items-center justify-center border border-white/20">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-lg sm:text-xl font-extrabold text-white tracking-tight">{formatUGX(totalCampaignCollected)}</p>
            <p className="text-[11px] text-blue-200 font-medium mt-1">Raised for school projects</p>
          </div>
        </div>

      </div>

      {/* 2. COMPACT MEMBER ACTIVITY CHART */}
      <div className="bg-white dark:bg-[#0c1731] rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">Member Activity Breakdown</h3>
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

      {/* 3. CAMPAIGN PERFORMANCE (VERTICAL CARDS - NO HORIZONTAL SCROLL) */}
      <div className="bg-white dark:bg-[#0c1731] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between">
          <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Campaign Performance
          </h3>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">{campaigns.length} campaigns</span>
        </div>

        <div className="p-5">
          {campaigns.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-6">No campaigns found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {campaigns.map((camp, index) => {
                const progress = camp.targetAmount > 0 ? (camp.raisedAmount / camp.targetAmount) * 100 : 0;
                return (
                  <div key={camp.id || index} className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className={`px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded-md border ${
                          camp.status === 'active' ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' :
                          camp.status === 'fully_funded' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' :
                          'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                        }`}>
                          {camp.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400">
                          {progress.toFixed(1)}%
                        </span>
                      </div>

                      <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-1">{camp.title}</h4>
                    </div>

                    <div className="space-y-1.5">
                      <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${camp.status === 'fully_funded' || progress >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                          style={{ width: `${Math.min(100, progress)}%` }}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 pt-0.5">
                        <span>Raised: <strong className="text-slate-900 dark:text-white">{formatUGX(camp.raisedAmount)}</strong></span>
                        <span>Target: <strong>{formatUGX(camp.targetAmount)}</strong></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. COLLECTIONS CHART (LAST 6 MONTHS) */}
      <div className="bg-white dark:bg-[#0c1731] rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">Collections (Last 6 Months)</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Monthly verified contributions</p>
          </div>
          <span className="text-[10px] font-extrabold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/60 px-3 py-1 rounded-full uppercase tracking-wider">
            UGX Trend
          </span>
        </div>

        <div className="h-48 w-full">
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

      {/* 5. VIEW DETAILED REPORT BUTTON */}
      <div className="pt-2 flex justify-center">
        <button
          onClick={() => setShowExportModal(true)}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3.5 px-8 rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer active:scale-95"
        >
          <Download className="w-4 h-4 text-white" /> View Detailed Summary Report
        </button>
      </div>

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
                <span className="font-extrabold text-blue-700 dark:text-blue-300">Net Welfare Balance:</span>
                <span className="font-extrabold text-blue-700 dark:text-blue-300">{formatUGX(netWelfareBalance)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Total School Support Raised:</span>
                <span className="font-extrabold text-slate-900 dark:text-white">{formatUGX(totalCampaignCollected)}</span>
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
