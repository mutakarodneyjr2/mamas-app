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
    <div className="space-y-5 max-w-5xl mx-auto pb-12">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-display font-bold text-mamas-text flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-mamas-accent" /> Analytics & Reports
        </h2>
        <p className="text-mamas-text-muted text-xs sm:text-sm mt-0.5">Comprehensive financial and member activity summary.</p>
      </div>

      {/* 1. TOP SUMMARY CARDS (2-Column Grid for Compact Mobile View) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        
        {/* Total Members */}
        <div className="bg-mamas-card p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200/90 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Members</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-display font-extrabold text-mamas-text">{users.length}</p>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              <span className="text-teal-600 font-bold">{activeMembers} Active</span> • <span className="text-slate-500">{inactiveMembers} Inactive</span>
            </p>
          </div>
        </div>

        {/* Welfare Fund Collected */}
        <div className="bg-mamas-card p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200/90 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Welfare Collected</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Heart className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-lg sm:text-2xl font-display font-extrabold text-mamas-text">{formatUGX(totalWelfareCollected)}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Member contributions</p>
          </div>
        </div>

        {/* Welfare Paid Out & Balance */}
        <div className="bg-mamas-card p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200/90 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Welfare Paid Out</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-lg sm:text-2xl font-display font-extrabold text-mamas-text">{formatUGX(totalWelfarePaidOut)}</p>
            <p className="text-[11px] text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-md inline-block mt-1 border border-teal-200/60">
              Bal: {formatUGX(netWelfareBalance)}
            </p>
          </div>
        </div>

        {/* Total Campaigns Funded */}
        <div className="bg-mamas-primary p-4 sm:p-5 rounded-2xl shadow-md flex flex-col justify-between text-white relative overflow-hidden border border-mamas-primary/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-blue-200 uppercase tracking-wider">Campaigns Funded</span>
            <div className="w-8 h-8 rounded-xl bg-white/10 text-mamas-accent flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-lg sm:text-2xl font-display font-extrabold text-white">{formatUGX(totalCampaignCollected)}</p>
            <p className="text-[11px] text-blue-200 font-medium mt-1">Raised for school projects</p>
          </div>
        </div>

      </div>

      {/* 2. COMPACT MEMBER ACTIVITY CHART */}
      <div className="bg-mamas-card rounded-2xl p-5 border border-slate-200/90 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm text-mamas-text">Member Activity Breakdown</h3>
          <span className="text-xs text-slate-400 font-medium">{users.length} total registered</span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-36 h-36 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={memberStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={58}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {memberStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1 w-full space-y-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-teal-600"></div>
                <span className="text-xs font-bold text-slate-700">Active Contributors</span>
              </div>
              <span className="text-xs font-extrabold text-mamas-text">{activeMembers} ({approvedUsers.length > 0 ? Math.round((activeMembers / approvedUsers.length) * 100) : 0}%)</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-400"></div>
                <span className="text-xs font-bold text-slate-700">Inactive Members</span>
              </div>
              <span className="text-xs font-extrabold text-slate-600">{inactiveMembers} ({approvedUsers.length > 0 ? Math.round((inactiveMembers / approvedUsers.length) * 100) : 0}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CAMPAIGN PERFORMANCE (VERTICAL CARDS - NO HORIZONTAL SCROLL) */}
      <div className="bg-mamas-card rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-bold text-sm text-mamas-text flex items-center gap-2">
            <Target className="w-4 h-4 text-mamas-accent" /> Campaign Performance
          </h3>
          <span className="text-xs text-slate-400 font-medium">{campaigns.length} campaigns</span>
        </div>

        <div className="p-4">
          {campaigns.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-6">No campaigns found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {campaigns.map((camp, index) => {
                const progress = camp.targetAmount > 0 ? (camp.raisedAmount / camp.targetAmount) * 100 : 0;
                return (
                  <div key={camp.id || index} className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded-md border ${
                          camp.status === 'active' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          camp.status === 'fully_funded' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                          'bg-slate-200/80 text-slate-700 border-slate-300'
                        }`}>
                          {camp.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs font-extrabold text-mamas-primary">
                          {progress.toFixed(1)}%
                        </span>
                      </div>

                      <h4 className="font-bold text-xs sm:text-sm text-mamas-text line-clamp-1">{camp.title}</h4>
                    </div>

                    <div className="space-y-1.5">
                      <div className="w-full bg-slate-200/90 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${camp.status === 'fully_funded' || progress >= 100 ? 'bg-teal-500' : 'bg-mamas-accent'}`}
                          style={{ width: `${Math.min(100, progress)}%` }}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 pt-0.5">
                        <span>Raised: <strong className="text-mamas-text">{formatUGX(camp.raisedAmount)}</strong></span>
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
      <div className="bg-mamas-card rounded-2xl p-5 border border-slate-200/90 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-sm text-mamas-text">Collections (Last 6 Months)</h3>
            <p className="text-[11px] text-slate-400">Monthly verified contributions</p>
          </div>
          <span className="text-[11px] font-bold text-mamas-primary bg-mamas-primary/10 px-2.5 py-0.5 rounded-full">
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
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="amount" fill="#0A2540" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. VIEW DETAILED REPORT BUTTON */}
      <div className="pt-2 flex justify-center">
        <button
          onClick={() => setShowExportModal(true)}
          className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-8 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
        >
          <Download className="w-4 h-4 text-mamas-accent" /> View Detailed Summary Report
        </button>
      </div>

      {/* Export Summary Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-mamas-text flex items-center gap-2">
                <FileText className="w-5 h-5 text-mamas-primary" /> Association Financial Statement
              </h3>
              <button 
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="py-5 space-y-3 text-xs text-slate-600">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="font-semibold text-slate-500">Total Registered Members:</span>
                <span className="font-bold text-mamas-text">{users.length}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="font-semibold text-slate-500">Active Contributors:</span>
                <span className="font-bold text-teal-700">{activeMembers}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="font-semibold text-slate-500">Total Welfare Collected:</span>
                <span className="font-bold text-mamas-text">{formatUGX(totalWelfareCollected)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="font-semibold text-slate-500">Total Welfare Disbursed:</span>
                <span className="font-bold text-rose-700">{formatUGX(totalWelfarePaidOut)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 bg-slate-50 p-2.5 rounded-xl">
                <span className="font-bold text-mamas-primary">Net Welfare Balance:</span>
                <span className="font-bold text-mamas-primary">{formatUGX(netWelfareBalance)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="font-semibold text-slate-500">Total School Support Raised:</span>
                <span className="font-bold text-mamas-text">{formatUGX(totalCampaignCollected)}</span>
              </div>
            </div>

            <div className="pt-3 flex gap-3">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 bg-mamas-primary hover:bg-mamas-primary-hover text-white py-3 rounded-2xl font-bold text-xs shadow transition-all"
              >
                Print / Save PDF
              </button>
              <button
                onClick={() => setShowExportModal(false)}
                className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs transition-all"
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
