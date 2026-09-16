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
    iconBg: string;
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
            iconBg: 'bg-amber-50 dark:bg-amber-950/50',
            iconColor: 'text-amber-600 dark:text-amber-400',
            badge: pendingContributions > 0 ? pendingContributions.toString() : undefined,
            path: '/admin/contributions'
          },
          {
            id: 'welfare-bal',
            title: 'Welfare Fund',
            value: formatUGX(netWelfareBalance),
            icon: Wallet,
            iconBg: 'bg-emerald-50 dark:bg-emerald-950/50',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            path: '/admin/reports'
          },
          {
            id: 'pending-payouts',
            title: 'Pending Payouts',
            value: pendingPayouts,
            icon: ShieldAlert,
            iconBg: 'bg-rose-50 dark:bg-rose-950/50',
            iconColor: 'text-rose-600 dark:text-rose-400',
            badge: pendingPayouts > 0 ? pendingPayouts.toString() : undefined,
            path: '/admin/welfare'
          },
          {
            id: 'active-campaigns',
            title: 'Active Campaigns',
            value: activeCampaigns,
            icon: Target,
            iconBg: 'bg-blue-50 dark:bg-blue-950/50',
            iconColor: 'text-blue-600 dark:text-blue-400',
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
            iconBg: 'bg-amber-50 dark:bg-amber-950/50',
            iconColor: 'text-amber-600 dark:text-amber-400',
            badge: pendingApprovals > 0 ? pendingApprovals.toString() : undefined,
            path: '/admin/users'
          },
          {
            id: 'total-members',
            title: 'Total Members',
            value: totalMembers,
            icon: Users,
            iconBg: 'bg-blue-50 dark:bg-blue-950/50',
            iconColor: 'text-blue-600 dark:text-blue-400',
            path: '/admin/users'
          },
          {
            id: 'recent-notices',
            title: 'Notices Broadcast',
            value: recentNoticesCount,
            icon: Megaphone,
            iconBg: 'bg-indigo-50 dark:bg-indigo-950/50',
            iconColor: 'text-indigo-600 dark:text-indigo-400',
            path: '/admin/notices'
          },
          {
            id: 'active-campaigns',
            title: 'Active Campaigns',
            value: activeCampaigns,
            icon: Target,
            iconBg: 'bg-purple-50 dark:bg-purple-950/50',
            iconColor: 'text-purple-600 dark:text-purple-400',
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
            iconBg: 'bg-emerald-50 dark:bg-emerald-950/50',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            path: '/admin/reports'
          },
          {
            id: 'total-paid-out',
            title: 'Total Paid Out',
            value: formatUGX(totalPaidOut),
            icon: FileText,
            iconBg: 'bg-amber-50 dark:bg-amber-950/50',
            iconColor: 'text-amber-600 dark:text-amber-400',
            path: '/admin/reports'
          },
          {
            id: 'total-members',
            title: 'Total Members',
            value: totalMembers,
            icon: Users,
            iconBg: 'bg-blue-50 dark:bg-blue-950/50',
            iconColor: 'text-blue-600 dark:text-blue-400',
            path: '/admin/users'
          },
          {
            id: 'active-campaigns',
            title: 'Active Campaigns',
            value: activeCampaigns,
            icon: Target,
            iconBg: 'bg-purple-50 dark:bg-purple-950/50',
            iconColor: 'text-purple-600 dark:text-purple-400',
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
            iconBg: 'bg-blue-50 dark:bg-blue-950/50',
            iconColor: 'text-blue-600 dark:text-blue-400',
            path: '/admin/users'
          },
          {
            id: 'pending-approvals',
            title: 'Pending Approvals',
            value: pendingApprovals,
            icon: CheckCircle2,
            iconBg: 'bg-amber-50 dark:bg-amber-950/50',
            iconColor: 'text-amber-600 dark:text-amber-400',
            badge: pendingApprovals > 0 ? pendingApprovals.toString() : undefined,
            path: '/admin/users'
          },
          {
            id: 'welfare-bal',
            title: 'Welfare Fund',
            value: formatUGX(netWelfareBalance),
            icon: Wallet,
            iconBg: 'bg-emerald-50 dark:bg-emerald-950/50',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            path: '/admin/reports'
          },
          {
            id: 'pending-welfare',
            title: 'Welfare Requests',
            value: pendingWelfareRequests,
            icon: ShieldAlert,
            iconBg: 'bg-rose-50 dark:bg-rose-950/50',
            iconColor: 'text-rose-600 dark:text-rose-400',
            badge: pendingWelfareRequests > 0 ? pendingWelfareRequests.toString() : undefined,
            path: '/admin/welfare'
          },
          {
            id: 'active-campaigns',
            title: 'Active Campaigns',
            value: activeCampaigns,
            icon: Target,
            iconBg: 'bg-purple-50 dark:bg-purple-950/50',
            iconColor: 'text-purple-600 dark:text-purple-400',
            path: '/admin/campaigns'
          },
          {
            id: 'pending-contribs',
            title: 'Pending Verifications',
            value: pendingContributions,
            icon: FileText,
            iconBg: 'bg-amber-50 dark:bg-amber-950/50',
            iconColor: 'text-amber-600 dark:text-amber-400',
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
    <div className="space-y-6 max-w-full overflow-x-hidden mx-auto pb-16 font-sans">
      
      {/* Header Banner - School Royal Blue Gradient */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 shadow-xl bg-gradient-to-br from-[#0a1936] via-[#0f2756] to-[#1e3a8a] text-white border border-blue-400/20">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-amber-400 text-slate-900 text-[10px] font-extrabold uppercase tracking-wider rounded-full px-3 py-1 shadow-xs">
                {roleLabel}
              </span>
              <span className="text-xs text-blue-200 font-semibold">MAMAS Executive Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome, {userProfile?.fullName?.split(' ')[0] || 'Executive'}
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/70 mt-1 max-w-xl">
              High-level administrative oversight, financial governance, approvals, and member operations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/10 backdrop-blur-md text-xs font-semibold text-blue-100 border border-white/10">
              <Shield className="w-3.5 h-3.5 text-amber-400" /> Authorized Role
            </span>
          </div>
        </div>
      </div>

      {/* 1. SUMMARY CARDS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Key Metrics & Governance
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-full">
          {cards.map(card => {
            const IconComponent = card.icon;
            return (
              <div
                key={card.id}
                onClick={() => navigate(card.path)}
                className="bg-white dark:bg-[#0c1731] rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-blue-500/40 dark:hover:border-blue-500/40 flex flex-col justify-between min-w-0 cursor-pointer transition-all active:scale-[0.98] group"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${card.iconBg} ${card.iconColor} border border-slate-200/40 dark:border-slate-700/40 group-hover:scale-105 transition-transform`}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                  {card.badge && (
                    <span className="bg-amber-500 text-white rounded-full px-2 py-0.5 text-[10px] font-extrabold shrink-0 shadow-xs">
                      {card.badge} Action
                    </span>
                  )}
                </div>
                
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 truncate">
                    {card.title}
                  </p>
                  <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-1 truncate tracking-tight">
                    {loading ? '...' : card.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. COMPACT QUICK ACTIONS */}
      <div>
        <h2 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <PlusCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Quick Actions
        </h2>

        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
          {['super_admin', 'chairperson', 'secretary'].includes(role) && (
            <button
              onClick={() => navigate('/admin/notices')}
              className="flex items-center gap-2 bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 rounded-2xl px-4 py-2.5 shadow-xs hover:border-blue-500/40 whitespace-nowrap transition-all active:scale-[0.97] shrink-0 cursor-pointer"
            >
              <div className="w-6 h-6 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Megaphone className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Post Notice</span>
            </button>
          )}

          {['super_admin', 'chairperson'].includes(role) && (
            <button
              onClick={() => navigate('/admin/campaigns')}
              className="flex items-center gap-2 bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 rounded-2xl px-4 py-2.5 shadow-xs hover:border-blue-500/40 whitespace-nowrap transition-all active:scale-[0.97] shrink-0 cursor-pointer"
            >
              <div className="w-6 h-6 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Target className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Add Campaign</span>
            </button>
          )}

          {['super_admin', 'chairperson', 'treasurer', 'auditor'].includes(role) && (
            <button
              onClick={() => navigate('/admin/reports')}
              className="flex items-center gap-2 bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 rounded-2xl px-4 py-2.5 shadow-xs hover:border-blue-500/40 whitespace-nowrap transition-all active:scale-[0.97] shrink-0 cursor-pointer"
            >
              <div className="w-6 h-6 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <BarChart3 className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Financial Reports</span>
            </button>
          )}

          {['super_admin', 'chairperson'].includes(role) && (
            <button
              onClick={() => navigate('/admin/settings')}
              className="flex items-center gap-2 bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 rounded-2xl px-4 py-2.5 shadow-xs hover:border-blue-500/40 whitespace-nowrap transition-all active:scale-[0.97] shrink-0 cursor-pointer"
            >
              <div className="w-6 h-6 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0">
                <Settings className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">System Settings</span>
            </button>
          )}

          {role === 'super_admin' && (
            <button
              onClick={() => navigate('/admin/roles')}
              className="flex items-center gap-2 bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 rounded-2xl px-4 py-2.5 shadow-xs hover:border-blue-500/40 whitespace-nowrap transition-all active:scale-[0.97] shrink-0 cursor-pointer"
            >
              <div className="w-6 h-6 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Manage Roles</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. CHARTS / TRENDS SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Collections Trend Mini-Chart */}
        <div className="md:col-span-2 bg-white dark:bg-[#0c1731] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-none">Collections Velocity</h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Verified inflows over last 6 months</p>
              </div>
            </div>
            <span className="bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Verified
            </span>
          </div>

          <div className="h-36 flex items-end justify-between gap-2.5 pt-4">
            {collectionsLast6Months.length === 0 ? (
               <div className="w-full h-full flex items-center justify-center">
                 <span className="text-xs text-slate-400">No collections data recorded</span>
               </div>
            ) : collectionsLast6Months.map((item, idx) => {
              const heightPercent = maxCollection > 0 ? (item.amount / maxCollection) * 100 : 0;
              const isHighest = item.amount === maxCollection && item.amount > 0;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end relative">
                  <div className="w-full h-full bg-slate-100 dark:bg-slate-800/60 rounded-t-xl relative overflow-hidden">
                    <div 
                      className={`absolute bottom-0 w-full rounded-t-xl transition-all ${isHighest ? 'bg-amber-400' : 'bg-blue-600 dark:bg-blue-500'}`}
                      style={{ height: `${Math.max(8, heightPercent)}%` }}
                    />
                  </div>
                  {item.amount > 0 && (
                    <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-300 absolute -top-5">
                      {Math.round(item.amount / 1000)}k
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">{item.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Member Activity Mini Breakdown */}
        <div className="bg-white dark:bg-[#0c1731] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-none">Member Health</h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Contribution status spread</p>
              </div>
            </div>

            <div className="space-y-3.5 pt-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 w-20 truncate">Active</span>
                <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="bg-teal-500 h-full rounded-full transition-all" style={{ width: `${totalMembers > 0 ? (memberActivityStats.active / totalMembers) * 100 : 0}%` }} />
                </div>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white shrink-0 w-8 text-right">{memberActivityStats.active}</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 w-20 truncate">Inactive</span>
                <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="bg-slate-300 dark:bg-slate-600 h-full rounded-full transition-all" style={{ width: `${totalMembers > 0 ? (memberActivityStats.inactive / totalMembers) * 100 : 0}%` }} />
                </div>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white shrink-0 w-8 text-right">{memberActivityStats.inactive}</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 w-20 truncate">Pending</span>
                <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full transition-all" style={{ width: `${(memberActivityStats.pending / Math.max(1, totalMembers + memberActivityStats.pending)) * 100}%` }} />
                </div>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white shrink-0 w-8 text-right">{memberActivityStats.pending}</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center pt-4 border-t border-slate-100 dark:border-slate-800 font-medium">
            {totalMembers + memberActivityStats.pending} total alumni accounts
          </p>
        </div>

      </div>

      {/* 4. LATEST ACTIVITY FEED */}
      <div className="bg-white dark:bg-[#0c1731] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Audit & Activity Feed</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Real-time executive actions</p>
            </div>
          </div>
          <button onClick={() => navigate('/admin/logs')} className="text-xs font-extrabold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer">
            View All <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-800/80">
          {recentActivities.length === 0 ? (
            <div className="bg-slate-50 dark:bg-slate-800/30 rounded-2xl py-8 text-center flex flex-col items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
                <Clock className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">No recent activity logged</p>
            </div>
          ) : (
            recentActivities.slice(0, 4).map((log) => (
              <div key={log.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{log.details || log.action}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5 truncate">{log.action}</p>
                </div>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0 font-medium">
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
      </div>

    </div>
  );
}
