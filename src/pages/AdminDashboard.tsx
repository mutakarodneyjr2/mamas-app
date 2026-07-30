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
    subtext: string;
    icon: React.ElementType;
    color: string;
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
            subtext: 'Awaiting bank verification',
            icon: FileText,
            color: 'bg-blue-50 text-blue-600 border-blue-200',
            badge: pendingContributions > 0 ? `${pendingContributions} Pending` : undefined,
            path: '/admin/contributions'
          },
          {
            id: 'welfare-bal',
            title: 'Welfare Fund Balance',
            value: formatUGX(netWelfareBalance),
            subtext: 'Net available for payouts',
            icon: Wallet,
            color: 'bg-teal-50 text-teal-600 border-teal-200',
            path: '/admin/reports'
          },
          {
            id: 'pending-payouts',
            title: 'Pending Payouts',
            value: pendingPayouts,
            subtext: 'Approved welfare awaiting transfer',
            icon: ShieldAlert,
            color: 'bg-amber-50 text-amber-600 border-amber-200',
            badge: pendingPayouts > 0 ? `${pendingPayouts} Action` : undefined,
            path: '/admin/welfare'
          },
          {
            id: 'active-campaigns',
            title: 'Active Campaigns',
            value: activeCampaigns,
            subtext: 'Fundraising initiatives',
            icon: Target,
            color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
            path: '/admin/campaigns'
          }
        ];

      case 'secretary':
        return [
          {
            id: 'pending-approvals',
            title: 'Pending Approvals',
            value: pendingApprovals,
            subtext: 'New registration requests',
            icon: CheckCircle2,
            color: 'bg-amber-50 text-amber-600 border-amber-200',
            badge: pendingApprovals > 0 ? `${pendingApprovals} Pending` : undefined,
            path: '/admin/users'
          },
          {
            id: 'total-members',
            title: 'Total Members',
            value: totalMembers,
            subtext: 'Approved active alumni',
            icon: Users,
            color: 'bg-teal-50 text-teal-600 border-teal-200',
            path: '/admin/users'
          },
          {
            id: 'recent-notices',
            title: 'Notices Broadcast',
            value: recentNoticesCount,
            subtext: 'Published announcements',
            icon: Megaphone,
            color: 'bg-blue-50 text-blue-600 border-blue-200',
            path: '/admin/notices'
          },
          {
            id: 'active-campaigns',
            title: 'Active Campaigns',
            value: activeCampaigns,
            subtext: 'Ongoing school support',
            icon: Target,
            color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
            path: '/admin/campaigns'
          }
        ];

      case 'auditor':
        return [
          {
            id: 'welfare-bal',
            title: 'Welfare Fund Balance',
            value: formatUGX(netWelfareBalance),
            subtext: 'Audit view (Read-only)',
            icon: Wallet,
            color: 'bg-teal-50 text-teal-600 border-teal-200',
            path: '/admin/reports'
          },
          {
            id: 'total-paid-out',
            title: 'Total Paid Out',
            value: formatUGX(totalPaidOut),
            subtext: 'Disbursed welfare aid',
            icon: FileText,
            color: 'bg-amber-50 text-amber-600 border-amber-200',
            path: '/admin/reports'
          },
          {
            id: 'total-members',
            title: 'Total Members',
            value: totalMembers,
            subtext: 'Registered alumni count',
            icon: Users,
            color: 'bg-blue-50 text-blue-600 border-blue-200',
            path: '/admin/users'
          },
          {
            id: 'active-campaigns',
            title: 'Active Campaigns',
            value: activeCampaigns,
            subtext: 'Current campaigns',
            icon: Target,
            color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
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
            subtext: 'Approved active alumni',
            icon: Users,
            color: 'bg-blue-50 text-blue-600 border-blue-200',
            path: '/admin/users'
          },
          {
            id: 'pending-approvals',
            title: 'Pending Approvals',
            value: pendingApprovals,
            subtext: 'Registrations awaiting review',
            icon: CheckCircle2,
            color: 'bg-amber-50 text-amber-600 border-amber-200',
            badge: pendingApprovals > 0 ? `${pendingApprovals} Pending` : undefined,
            path: '/admin/users'
          },
          {
            id: 'welfare-bal',
            title: 'Welfare Fund Balance',
            value: formatUGX(netWelfareBalance),
            subtext: 'Available welfare funds',
            icon: Wallet,
            color: 'bg-teal-50 text-teal-600 border-teal-200',
            path: '/admin/reports'
          },
          {
            id: 'pending-welfare',
            title: 'Welfare Requests',
            value: pendingWelfareRequests,
            subtext: 'Awaiting committee vote',
            icon: ShieldAlert,
            color: 'bg-rose-50 text-rose-600 border-rose-200',
            badge: pendingWelfareRequests > 0 ? `${pendingWelfareRequests} Pending` : undefined,
            path: '/admin/welfare'
          },
          {
            id: 'active-campaigns',
            title: 'Active Campaigns',
            value: activeCampaigns,
            subtext: 'School support projects',
            icon: Target,
            color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
            path: '/admin/campaigns'
          },
          {
            id: 'pending-contribs',
            title: 'Pending Contributions',
            value: pendingContributions,
            subtext: 'Unverified payment logs',
            icon: FileText,
            color: 'bg-amber-50 text-amber-600 border-amber-200',
            badge: pendingContributions > 0 ? `${pendingContributions} Verification` : undefined,
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
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-mamas-primary to-slate-900 rounded-3xl p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-mamas-primary/20">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-mamas-accent text-mamas-primary px-3 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider">
              {roleLabel}
            </span>
            <span className="text-slate-300 text-xs">MAMAS Admin Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">
            Welcome, {userProfile.fullName.split(' ')[0]}
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-xl">
            Streamlined management dashboard optimized for mobile and quick executive actions.
          </p>
        </div>
      </div>

      {/* 1. SUMMARY CARDS (2-Column Grid) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-mamas-text flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-mamas-accent" /> Key Metrics & Overview
          </h2>
          <span className="text-xs text-slate-400">Click card to open page</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {cards.map(card => {
            const IconComponent = card.icon;
            return (
              <div
                key={card.id}
                onClick={() => navigate(card.path)}
                className="bg-mamas-card border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-mamas-accent/50 transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border ${card.color}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    {card.badge && (
                      <span className="bg-amber-100 text-amber-800 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full border border-amber-200 animate-pulse">
                        {card.badge}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider line-clamp-1">{card.title}</p>
                  <p className="text-xl sm:text-2xl font-display font-extrabold text-mamas-text mt-1">
                    {loading ? '...' : card.value}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 line-clamp-1 font-medium">{card.subtext}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-mamas-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. COMPACT QUICK ACTIONS (2 per row) */}
      <div>
        <h2 className="text-base font-bold text-mamas-text mb-3 flex items-center gap-2">
          <PlusCircle className="w-4 h-4 text-mamas-primary" /> Quick Administrative Actions
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {['super_admin', 'chairperson', 'secretary'].includes(role) && (
            <button
              onClick={() => navigate('/admin/notices')}
              className="p-3.5 bg-mamas-card border border-slate-200 rounded-2xl text-left hover:border-mamas-primary transition-all flex items-center gap-3 shadow-sm"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                <Megaphone className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-mamas-text truncate">Post Notice</p>
                <p className="text-[10px] text-slate-400 truncate">Broadcast to members</p>
              </div>
            </button>
          )}

          {['super_admin', 'chairperson'].includes(role) && (
            <button
              onClick={() => navigate('/admin/campaigns')}
              className="p-3.5 bg-mamas-card border border-slate-200 rounded-2xl text-left hover:border-mamas-primary transition-all flex items-center gap-3 shadow-sm"
            >
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
                <Target className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-mamas-text truncate">Add Campaign</p>
                <p className="text-[10px] text-slate-400 truncate">Launch school project</p>
              </div>
            </button>
          )}

          {['super_admin', 'chairperson', 'treasurer', 'auditor'].includes(role) && (
            <button
              onClick={() => navigate('/admin/reports')}
              className="p-3.5 bg-mamas-card border border-slate-200 rounded-2xl text-left hover:border-mamas-primary transition-all flex items-center gap-3 shadow-sm"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-mamas-text truncate">Financial Reports</p>
                <p className="text-[10px] text-slate-400 truncate">View statements & charts</p>
              </div>
            </button>
          )}

          {['super_admin', 'chairperson', 'treasurer'].includes(role) && (
            <button
              onClick={() => navigate('/admin/settings')}
              className="p-3.5 bg-mamas-card border border-slate-200 rounded-2xl text-left hover:border-mamas-primary transition-all flex items-center gap-3 shadow-sm"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
                <Settings className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-mamas-text truncate">System Settings</p>
                <p className="text-[10px] text-slate-400 truncate">Limits & welfare approvers</p>
              </div>
            </button>
          )}

          {role === 'super_admin' && (
            <button
              onClick={() => navigate('/admin/roles')}
              className="p-3.5 bg-mamas-card border border-slate-200 rounded-2xl text-left hover:border-mamas-primary transition-all flex items-center gap-3 shadow-sm col-span-2 sm:col-span-1"
            >
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-mamas-text truncate">Manage Roles</p>
                <p className="text-[10px] text-slate-400 truncate">Assign committee roles</p>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* 3. CHARTS / TRENDS SECTION (Fits mobile without scroll) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Collections Trend Mini-Chart */}
        <div className="md:col-span-2 bg-mamas-card rounded-3xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-mamas-text">Collections (Last 6 Months)</h3>
              <p className="text-xs text-slate-400">Verified contributions trends</p>
            </div>
            <span className="text-xs font-bold text-mamas-primary bg-mamas-primary/10 px-2.5 py-1 rounded-full">
              Verified
            </span>
          </div>

          <div className="h-40 flex items-end justify-between gap-2 pt-4 px-2">
            {collectionsLast6Months.map((item, idx) => {
              const heightPercent = maxCollection > 0 ? (item.amount / maxCollection) * 100 : 0;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  <span className="text-[10px] font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {item.amount > 0 ? `${Math.round(item.amount / 1000)}k` : '0'}
                  </span>
                  <div className="w-full max-w-[36px] bg-slate-100 rounded-t-lg h-full flex items-end overflow-hidden">
                    <div 
                      className="w-full bg-mamas-primary group-hover:bg-mamas-accent transition-all rounded-t-lg"
                      style={{ height: `${Math.max(8, heightPercent)}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">{item.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Member Activity Mini Breakdown */}
        <div className="bg-mamas-card rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-mamas-text mb-1">Member Activity</h3>
            <p className="text-xs text-slate-400 mb-4">Registration & status spread</p>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-teal-700">Active Contributors</span>
                  <span className="text-slate-700">{memberActivityStats.active}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-teal-500 h-full rounded-full"
                    style={{ width: `${totalMembers > 0 ? (memberActivityStats.active / totalMembers) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-600">Inactive Members</span>
                  <span className="text-slate-700">{memberActivityStats.inactive}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-slate-300 h-full rounded-full"
                    style={{ width: `${totalMembers > 0 ? (memberActivityStats.inactive / totalMembers) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-amber-700">Pending Approval</span>
                  <span className="text-slate-700">{memberActivityStats.pending}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-amber-400 h-full rounded-full"
                    style={{ width: `${(memberActivityStats.pending / Math.max(1, totalMembers + memberActivityStats.pending)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-semibold">
            <span>Total Registered:</span>
            <span className="text-mamas-text font-bold">{totalMembers + memberActivityStats.pending}</span>
          </div>
        </div>

      </div>

      {/* 4. LATEST ACTIVITY FEED */}
      <div className="bg-mamas-card rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-bold text-sm text-mamas-text flex items-center gap-2">
            <Activity className="w-4 h-4 text-mamas-accent" /> Recent Activity Feed
          </h3>
          <span className="text-xs text-slate-400 font-medium">Last 6 actions</span>
        </div>

        <div className="divide-y divide-slate-100">
          {recentActivities.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 italic">No activity logged yet.</div>
          ) : (
            recentActivities.map(log => (
              <div key={log.id} className="p-4 hover:bg-slate-50/60 transition-colors flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-bold text-mamas-text truncate">{log.details || log.action}</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      Action: <span className="font-mono text-slate-600">{log.action}</span>
                    </p>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 whitespace-nowrap font-medium flex-shrink-0">
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
