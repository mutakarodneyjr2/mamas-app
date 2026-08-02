import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { formatUGX } from '../lib/utils';
import { 
  Users, 
  CheckCircle2, 
  Wallet, 
  ShieldAlert, 
  Target, 
  FileText, 
  Megaphone, 
  Settings, 
  Shield, 
  Clock, 
  ArrowRight,
  PlusCircle,
  BarChart3,
  Activity
} from 'lucide-react';

interface ActivityLog {
  id: string;
  action: string;
  performedBy: string;
  targetId: string;
  details: string;
  timestamp: number;
}

export default function AdminDashboard() {
  const { userProfile, currentUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  // Key Stats
  const [totalMembers, setTotalMembers] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [welfareBalance, setWelfareBalance] = useState(0);
  const [pendingWelfareRequests, setPendingWelfareRequests] = useState(0);
  const [pendingPayouts, setPendingPayouts] = useState(0);
  const [activeCampaigns, setActiveCampaigns] = useState(0);
  const [pendingContributions, setPendingContributions] = useState(0);
  const [recentNoticesCount, setRecentNoticesCount] = useState(0);
  const [totalPaidOut, setTotalPaidOut] = useState(0);

  // Chart Data
  const [collectionsLast6Months, setCollectionsLast6Months] = useState<{ month: string; amount: number }[]>([]);
  const [memberActivityStats, setMemberActivityStats] = useState({ active: 0, inactive: 0, pending: 0 });

  // Activity Feed
  const [recentActivities, setRecentActivities] = useState<ActivityLog[]>([]);

  useEffect(() => {
    if (!userProfile) return;

    // 1. Users count & status breakdown
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      let approvedCount = 0;
      let pendingCount = 0;
      let activeContrib = 0;
      let inactiveContrib = 0;

      snap.forEach(doc => {
        const u = doc.data();
        if (u.status === 'approved') {
          approvedCount++;
          if (u.contributionStatus === 'active') activeContrib++;
          else inactiveContrib++;
        } else if (u.status === 'pending') {
          pendingCount++;
        }
      });

      setTotalMembers(approvedCount);
      setPendingApprovals(pendingCount);
      setMemberActivityStats({ active: activeContrib, inactive: inactiveContrib, pending: pendingCount });
    }, (err) => {
      console.error("Error loading users stats:", err);
      setLoading(false);
    });

    // 2. Welfare Requests stats
    const unsubWelfare = onSnapshot(collection(db, 'welfareRequests'), (snap) => {
      let pendingReq = 0;
      let pendingPay = 0;
      let paidSum = 0;

      snap.forEach(doc => {
        const w = doc.data();
        if (w.status === 'pending') pendingReq++;
        if (w.status === 'accepted') pendingPay++;
        if (w.status === 'paid' && w.paidAmount) paidSum += w.paidAmount;
      });

      setPendingWelfareRequests(pendingReq);
      setPendingPayouts(pendingPay);
      setTotalPaidOut(paidSum);
    }, (err) => {
      console.error("Error loading welfare stats:", err);
      setLoading(false);
    });

    // 3. Contributions stats & 6-month trend
    const unsubContribs = onSnapshot(collection(db, 'contributions'), (snap) => {
      let pendingCount = 0;
      let welfareCollected = 0;
      const monthMap: Record<string, number> = {};

      snap.forEach(doc => {
        const c = doc.data();
        if (c.status === 'pending') {
          pendingCount++;
        } else if (c.status === 'verified') {
          if (c.type === 'welfare') {
            welfareCollected += (c.amount || 0);
          }
          // Monthly calculation
          if (c.createdAt) {
            const date = new Date(c.createdAt);
            const key = `${date.toLocaleString('default', { month: 'short' })}`;
            monthMap[key] = (monthMap[key] || 0) + (c.amount || 0);
          }
        }
      });

      setPendingContributions(pendingCount);

      // Generate last 6 months trend
      const monthsArr: { month: string; amount: number }[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mKey = d.toLocaleString('default', { month: 'short' });
        monthsArr.push({ month: mKey, amount: monthMap[mKey] || 0 });
      }
      setCollectionsLast6Months(monthsArr);

      // We'll calculate net welfare balance dynamically as welfareCollected - totalPaidOut
      setWelfareBalance(welfareCollected);
    }, (err) => {
      console.error("Error loading contribution stats:", err);
      setLoading(false);
    });

    // 4. Active Campaigns count
    const qCampaigns = query(collection(db, 'schoolCampaigns'), where('status', '==', 'active'));
    const unsubCampaigns = onSnapshot(qCampaigns, (snap) => {
      setActiveCampaigns(snap.size);
    }, (err) => {
      console.error("Error loading campaigns stats:", err);
    });

    // 5. Notices count
    const unsubNotices = onSnapshot(collection(db, 'notices'), (snap) => {
      setRecentNoticesCount(snap.size);
    }, (err) => {
      console.error("Error loading notices count:", err);
    });

    // 6. Recent Activity Logs
    const qLogs = query(collection(db, 'activityLogs'), orderBy('createdAt', 'desc'), limit(6));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      const logs: ActivityLog[] = [];
      snap.forEach(d => {
        logs.push({ id: d.id, ...d.data() } as ActivityLog);
      });
      setRecentActivities(logs);
      setLoading(false);
    }, (err) => {
      console.error("Error loading activity logs:", err);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubWelfare();
      unsubContribs();
      unsubCampaigns();
      unsubNotices();
      unsubLogs();
    };
  }, [userProfile]);

  if (!userProfile) return null;

  const role = userProfile.role;
  const netWelfareBalance = Math.max(0, welfareBalance - totalPaidOut);

  // Build Summary Cards based on Role
  interface SummaryCardConfig {
    id: string;
    title: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
    iconColor: string;
    badge?: string;
    path: string;
  }

  const getRoleSummaryCards = (): SummaryCardConfig[] => {
    switch (role) {
      case 'treasurer':
        return [
          {
            id: 'pending-contribs',
            title: 'Pending Contributions',
            value: pendingContributions,
            icon: FileText,
            color: 'bg-orange-50/60 border-orange-100 border-l-4 border-l-orange-400',
            iconColor: 'bg-orange-100 text-orange-600',
            badge: pendingContributions > 0 ? pendingContributions.toString() : undefined,
            path: '/admin/contributions'
          },
          {
            id: 'welfare-bal',
            title: 'Welfare Fund',
            value: formatUGX(netWelfareBalance),
            icon: Wallet,
            color: 'bg-emerald-50/60 border-emerald-100 border-l-4 border-l-emerald-400',
            iconColor: 'bg-emerald-100 text-emerald-600',
            path: '/admin/reports'
          },
          {
            id: 'pending-payouts',
            title: 'Pending Payouts',
            value: pendingPayouts,
            icon: ShieldAlert,
            color: 'bg-rose-50/60 border-rose-100 border-l-4 border-l-rose-400',
            iconColor: 'bg-rose-100 text-rose-600',
            badge: pendingPayouts > 0 ? pendingPayouts.toString() : undefined,
            path: '/admin/welfare'
          },
          {
            id: 'active-campaigns',
            title: 'Active Campaigns',
            value: activeCampaigns,
            icon: Target,
            color: 'bg-purple-50/60 border-purple-100 border-l-4 border-l-purple-400',
            iconColor: 'bg-purple-100 text-purple-600',
            path: '/admin/campaigns'
          }
        ];

      case 'secretary':
        return [
          {
            id: 'pending-approvals',
            title: 'Pending Approvals',
            value: pendingApprovals,
            icon: CheckCircle2,
            color: 'bg-amber-50/60 border-amber-100 border-l-4 border-l-amber-400',
            iconColor: 'bg-amber-100 text-amber-600',
            badge: pendingApprovals > 0 ? pendingApprovals.toString() : undefined,
            path: '/admin/users'
          },
          {
            id: 'total-members',
            title: 'Total Members',
            value: totalMembers,
            icon: Users,
            color: 'bg-blue-50/60 border-blue-100 border-l-4 border-l-blue-400',
            iconColor: 'bg-blue-100 text-blue-600',
            path: '/admin/users'
          },
          {
            id: 'recent-notices',
            title: 'Notices Broadcast',
            value: recentNoticesCount,
            icon: Megaphone,
            color: 'bg-cyan-50/60 border-cyan-100 border-l-4 border-l-cyan-400',
            iconColor: 'bg-cyan-100 text-cyan-600',
            path: '/admin/notices'
          },
          {
            id: 'active-campaigns',
            title: 'Active Campaigns',
            value: activeCampaigns,
            icon: Target,
            color: 'bg-purple-50/60 border-purple-100 border-l-4 border-l-purple-400',
            iconColor: 'bg-purple-100 text-purple-600',
            path: '/admin/campaigns'
          }
        ];

      case 'auditor':
        return [
          {
            id: 'welfare-bal',
            title: 'Welfare Fund',
            value: formatUGX(netWelfareBalance),
            icon: Wallet,
            color: 'bg-emerald-50/60 border-emerald-100 border-l-4 border-l-emerald-400',
            iconColor: 'bg-emerald-100 text-emerald-600',
            path: '/admin/reports'
          },
          {
            id: 'total-paid-out',
            title: 'Total Paid Out',
            value: formatUGX(totalPaidOut),
            icon: FileText,
            color: 'bg-amber-50/60 border-amber-100 border-l-4 border-l-amber-400',
            iconColor: 'bg-amber-100 text-amber-600',
            path: '/admin/reports'
          },
          {
            id: 'total-members',
            title: 'Total Members',
            value: totalMembers,
            icon: Users,
            color: 'bg-blue-50/60 border-blue-100 border-l-4 border-l-blue-400',
            iconColor: 'bg-blue-100 text-blue-600',
            path: '/admin/users'
          },
          {
            id: 'active-campaigns',
            title: 'Active Campaigns',
            value: activeCampaigns,
            icon: Target,
            color: 'bg-purple-50/60 border-purple-100 border-l-4 border-l-purple-400',
            iconColor: 'bg-purple-100 text-purple-600',
            path: '/admin/campaigns'
          }
        ];

      // Default for Super Admin, Chairperson, Vice Chairperson
      default:
        return [
          {
            id: 'total-members',
            title: 'Total Members',
            value: totalMembers,
            icon: Users,
            color: 'bg-blue-50/60 border-blue-100 border-l-4 border-l-blue-400',
            iconColor: 'bg-blue-100 text-blue-600',
            path: '/admin/users'
          },
          {
            id: 'pending-approvals',
            title: 'Pending Approvals',
            value: pendingApprovals,
            icon: CheckCircle2,
            color: 'bg-amber-50/60 border-amber-100 border-l-4 border-l-amber-400',
            iconColor: 'bg-amber-100 text-amber-600',
            badge: pendingApprovals > 0 ? pendingApprovals.toString() : undefined,
            path: '/admin/users'
          },
          {
            id: 'welfare-bal',
            title: 'Welfare Fund',
            value: formatUGX(netWelfareBalance),
            icon: Wallet,
            color: 'bg-emerald-50/60 border-emerald-100 border-l-4 border-l-emerald-400',
            iconColor: 'bg-emerald-100 text-emerald-600',
            path: '/admin/reports'
          },
          {
            id: 'pending-welfare',
            title: 'Welfare Requests',
            value: pendingWelfareRequests,
            icon: ShieldAlert,
            color: 'bg-rose-50/60 border-rose-100 border-l-4 border-l-rose-400',
            iconColor: 'bg-rose-100 text-rose-600',
            badge: pendingWelfareRequests > 0 ? pendingWelfareRequests.toString() : undefined,
            path: '/admin/welfare'
          },
          {
            id: 'active-campaigns',
            title: 'Active Campaigns',
            value: activeCampaigns,
            icon: Target,
            color: 'bg-purple-50/60 border-purple-100 border-l-4 border-l-purple-400',
            iconColor: 'bg-purple-100 text-purple-600',
            path: '/admin/campaigns'
          },
          {
            id: 'pending-contribs',
            title: 'Pending Verifications',
            value: pendingContributions,
            icon: FileText,
            color: 'bg-orange-50/60 border-orange-100 border-l-4 border-l-orange-400',
            iconColor: 'bg-orange-100 text-orange-600',
            badge: pendingContributions > 0 ? pendingContributions.toString() : undefined,
            path: '/admin/contributions'
          }
        ];
    }
  };

  const cards = getRoleSummaryCards();

  // Role display label helper
  const roleLabel = role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  // Highest monthly collection for chart scaling
  const maxCollection = Math.max(...collectionsLast6Months.map(c => c.amount), 1);

  return (
    <div className="space-y-5 max-w-full overflow-x-hidden mx-auto pb-10">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-5 shadow-sm max-w-full">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="bg-amber-400 text-slate-900 text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1">
            {roleLabel}
          </span>
          <span className="text-xs text-white/60 font-medium">MAMAS Admin Portal</span>
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">
          Welcome, {userProfile.fullName.split(' ')[0]}
        </h1>
        <p className="text-xs text-white/50 leading-relaxed truncate mt-1">
          Management dashboard for quick executive actions.
        </p>
      </div>

      {/* 1. SUMMARY CARDS (2-Column Grid) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-500" /> Key Metrics & Overview
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 max-w-full">
          {cards.map(card => {
            const IconComponent = card.icon;
            return (
              <div
                key={card.id}
                onClick={() => navigate(card.path)}
                className={`rounded-2xl p-4 border shadow-sm flex flex-col justify-between min-w-0 cursor-pointer transition-all active:scale-[0.98] ${card.color}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${card.iconColor}`}>
                    <IconComponent className="w-4 h-4" />
                  </div>
                  {card.badge && (
                    <span className="bg-amber-500 text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold shrink-0">
                      {card.badge}
                    </span>
                  )}
                </div>
                
                <p className="text-[10px] uppercase tracking-widest font-bold mt-2 truncate text-current opacity-70">
                  {card.title}
                </p>
                <p className="text-xl font-bold text-gray-900 mt-1 truncate">
                  {loading ? '...' : card.value}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. COMPACT QUICK ACTIONS */}
      <div className="mt-5">
        <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <PlusCircle className="w-4 h-4 text-emerald-500" /> Quick Actions
        </h2>

        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
          {['super_admin', 'chairperson', 'secretary'].includes(role) && (
            <button
              onClick={() => navigate('/admin/notices')}
              className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2.5 shadow-sm whitespace-nowrap transition-all active:scale-[0.97] shrink-0"
            >
              <div className="w-5 h-5 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Megaphone className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-gray-800">Post Notice</span>
            </button>
          )}

          {['super_admin', 'chairperson'].includes(role) && (
            <button
              onClick={() => navigate('/admin/campaigns')}
              className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2.5 shadow-sm whitespace-nowrap transition-all active:scale-[0.97] shrink-0"
            >
              <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Target className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-gray-800">Add Campaign</span>
            </button>
          )}

          {['super_admin', 'chairperson', 'treasurer', 'auditor'].includes(role) && (
            <button
              onClick={() => navigate('/admin/reports')}
              className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2.5 shadow-sm whitespace-nowrap transition-all active:scale-[0.97] shrink-0"
            >
              <div className="w-5 h-5 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <BarChart3 className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-gray-800">Financial Reports</span>
            </button>
          )}

          {['super_admin', 'chairperson'].includes(role) && (
            <button
              onClick={() => navigate('/admin/settings')}
              className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2.5 shadow-sm whitespace-nowrap transition-all active:scale-[0.97] shrink-0"
            >
              <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                <Settings className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-gray-800">System Settings</span>
            </button>
          )}

          {role === 'super_admin' && (
            <button
              onClick={() => navigate('/admin/roles')}
              className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2.5 shadow-sm whitespace-nowrap transition-all active:scale-[0.97] shrink-0"
            >
              <div className="w-5 h-5 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-gray-800">Manage Roles</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. CHARTS / TRENDS SECTION (Fits mobile without scroll) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Collections Trend Mini-Chart */}
        <div className="md:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mt-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center">
                <BarChart3 className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 leading-none">Collections</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Last 6 months</p>
              </div>
            </div>
            <span className="bg-gray-100 text-gray-600 rounded-full px-2 py-1 text-[10px] font-semibold">
              Verified
            </span>
          </div>

          <div className="h-28 flex items-end justify-between gap-2">
            {collectionsLast6Months.length === 0 ? (
               <div className="w-full h-full flex items-center justify-center">
                 <div className="w-full h-[10%] bg-gray-100 rounded-t-xl" />
                 <span className="absolute text-xs text-gray-400">No data</span>
               </div>
            ) : collectionsLast6Months.map((item, idx) => {
              const heightPercent = maxCollection > 0 ? (item.amount / maxCollection) * 100 : 0;
              const isHighest = item.amount === maxCollection && item.amount > 0;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end relative">
                  <div className="w-full h-full bg-gray-100 rounded-t-xl relative overflow-hidden">
                    <div 
                      className={`absolute bottom-0 w-full rounded-t-xl transition-all ${isHighest ? 'bg-amber-500' : 'bg-slate-900'}`}
                      style={{ height: `${Math.max(8, heightPercent)}%` }}
                    />
                  </div>
                  {item.amount > 0 && (
                    <span className="text-[10px] font-bold text-gray-700 absolute -top-4">
                      {Math.round(item.amount / 1000)}k
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400 font-medium">{item.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Member Activity Mini Breakdown */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mt-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 leading-none">Member Activity</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Registration spread</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-700 w-24 truncate">Active</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${totalMembers > 0 ? (memberActivityStats.active / totalMembers) * 100 : 0}%` }} />
              </div>
              <span className="text-xs font-bold text-gray-900 shrink-0 w-6 text-right">{memberActivityStats.active}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-700 w-24 truncate">Inactive</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="bg-gray-300 h-full rounded-full" style={{ width: `${totalMembers > 0 ? (memberActivityStats.inactive / totalMembers) * 100 : 0}%` }} />
              </div>
              <span className="text-xs font-bold text-gray-900 shrink-0 w-6 text-right">{memberActivityStats.inactive}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-700 w-24 truncate">Pending</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="bg-amber-400 h-full rounded-full" style={{ width: `${(memberActivityStats.pending / Math.max(1, totalMembers + memberActivityStats.pending)) * 100}%` }} />
              </div>
              <span className="text-xs font-bold text-gray-900 shrink-0 w-6 text-right">{memberActivityStats.pending}</span>
            </div>
          </div>

          <p className="text-[10px] text-gray-400 text-center mt-4 pt-3 border-t border-gray-100">
            {totalMembers + memberActivityStats.pending} total registered
          </p>
        </div>

      </div>

      {/* 4. LATEST ACTIVITY FEED */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mt-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">Recent Activity</h3>
          </div>
          <button onClick={() => navigate('/admin/logs')} className="text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors">
            View All →
          </button>
        </div>

        <div className="space-y-0">
          {recentActivities.length === 0 ? (
            <div className="bg-gray-50 rounded-2xl py-8 text-center flex flex-col items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                <Clock className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-xs text-gray-500">No recent activity</p>
            </div>
          ) : (
            recentActivities.slice(0, 3).map((log, idx) => (
              <div key={log.id} className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="w-3 h-3 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">{log.details || log.action}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5 truncate">{log.action}</p>
                </div>
                <span className="text-[10px] text-gray-400 shrink-0 w-12 text-right">
                  {(() => {
                    const ts = (log as any).createdAt || (log as any).timestamp;
                    if (!ts) return '';
                    try {
                      const dateObj = typeof ts === 'number' ? new Date(ts) : (ts?.toDate ? ts.toDate() : new Date(ts));
                      return isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    } catch {
                      return '';
                    }
                  })()}
                </span>
              </div>
            ))
          )}
        </div>
        {recentActivities.length > 0 && (
          <div className="flex justify-center mt-3 pt-2">
            <button 
              onClick={() => navigate('/admin/logs')}
              className="text-xs font-semibold text-slate-900 bg-gray-50 rounded-full px-4 py-2 hover:bg-gray-100 transition-colors"
            >
              View All Activity
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
