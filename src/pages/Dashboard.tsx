import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Wallet, Users, Target, Shield, ArrowRight, Bell, BellOff, ArrowUpRight, TrendingUp 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { formatUGX } from '../lib/utils';

export default function Dashboard() {
  const { currentUser, userProfile } = useAuth();
  
  const [stats, setStats] = useState<{
    totalFund: string | null;
    members: string | null;
    campaigns: string | null;
  }>({
    totalFund: null,
    members: null,
    campaigns: null,
  });

  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = ['super_admin', 'chairperson', 'vice_chairperson', 'treasurer', 'secretary'].includes(userProfile?.role || '');

  useEffect(() => {
    let isSubscribed = true;

    async function fetchDashboardData() {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      setLoading(true);

      // 1. Fetch Welfare Treasury (Contributions)
      let calculatedTotal: string | null = null;
      try {
        const contribsSnap = await getDocs(collection(db, 'contributions'));
        let sum = 0;
        contribsSnap.docs.forEach(doc => {
          const data = doc.data();
          const st = (data.status || '').toLowerCase();
          if (['verified', 'completed', 'successful', 'active'].includes(st)) {
            sum += Number(data.amount) || 0;
          }
        });
        calculatedTotal = formatUGX(sum);
      } catch (err) {
        console.warn("Could not load total contributions treasury:", err);
        calculatedTotal = null; // Shows '--'
      }

      // 2. Fetch Verified Alumni (Users)
      let memberCountStr: string | null = null;
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        let approvedCount = 0;
        usersSnap.docs.forEach(doc => {
          const st = (doc.data().status || '').toLowerCase();
          if (['approved', 'active'].includes(st)) {
            approvedCount++;
          }
        });
        memberCountStr = approvedCount.toString();
      } catch (err) {
        console.warn("Could not load users count:", err);
        memberCountStr = null;
      }

      // 3. Fetch Active Campaigns (schoolCampaigns)
      let campaignsCountStr: string | null = null;
      let campsList: any[] = [];
      try {
        const qCamp = query(collection(db, 'schoolCampaigns'), where('status', '==', 'active'));
        const campSnap = await getDocs(qCamp);
        campsList = campSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        campaignsCountStr = campSnap.size.toString();
      } catch (err) {
        console.warn("Could not load active schoolCampaigns query:", err);
        // Fallback: try fetching all schoolCampaigns without query filter if index or status mismatch
        try {
          const campSnapAll = await getDocs(collection(db, 'schoolCampaigns'));
          campsList = campSnapAll.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter((c: any) => (c.status || '').toLowerCase() === 'active');
          campaignsCountStr = campsList.length.toString();
        } catch (err2) {
          console.warn("Fallback schoolCampaigns read failed:", err2);
          campaignsCountStr = null;
        }
      }

      // 4. Fetch Latest Notices (notices)
      let noticeList: any[] = [];
      try {
        const noticesSnap = await getDocs(collection(db, 'notices'));
        noticeList = noticesSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
          .slice(0, 3);
      } catch (err) {
        console.warn("Could not load notices:", err);
      }

      if (isSubscribed) {
        setStats({
          totalFund: calculatedTotal,
          members: memberCountStr,
          campaigns: campaignsCountStr,
        });
        setActiveCampaigns(campsList);
        setNotices(noticeList);
        setLoading(false);
      }
    }

    fetchDashboardData();

    return () => {
      isSubscribed = false;
    };
  }, [currentUser]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-amber-500 rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-slate-500 mt-3">Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-12 animate-in fade-in duration-300">
      
      {/* EXECUTIVE TOP BANNER */}
      <section className="bg-gradient-to-r from-slate-900 via-slate-800 to-mamas-primary rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-slate-900/10 border border-slate-700/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold uppercase tracking-widest mb-3">
              <Shield className="w-3.5 h-3.5" />
              {userProfile?.role?.replace('_', ' ') || 'Alumni Member'}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {getGreeting()}, {userProfile?.fullName?.split(' ')[0] || 'Alumnus'} <span className="inline-block animate-bounce">👋</span>
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-lg">
              Matuumu Alumni Mutual Aid Association • Official Portal
            </p>
          </div>
        </div>
      </section>

      {/* STATS ROW - RICH NAVY CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard 
          icon={Wallet} 
          amount={stats.totalFund !== null ? stats.totalFund : '--'} 
          label="Welfare Treasury" 
          badge="Verified" 
          accentColor="gold"
        />
        <StatCard 
          icon={Users} 
          amount={stats.members !== null ? stats.members : '--'} 
          label="Verified Alumni" 
          badge="Active" 
          accentColor="emerald"
        />
        <StatCard 
          icon={Target} 
          amount={stats.campaigns !== null ? stats.campaigns : '--'} 
          label="Active Campaigns" 
          badge="Ongoing" 
          accentColor="cyan"
        />
      </section>

      {/* PRIMARY ACTION CARD */}
      <section>
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl border border-slate-700/60 text-white relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Mutual Aid Quick Actions</p>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Support Our Alma Mater & Members</h2>
              <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-md leading-relaxed">
                Contribute monthly welfare dues or back ongoing school infrastructure projects directly via Mobile Money.
              </p>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              <Link 
                to="/contribute" 
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 px-6 rounded-full text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-all text-center"
              >
                Pay Dues / Support
              </Link>
              <Link 
                to="/welfare/apply" 
                className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-5 rounded-full text-sm border border-white/10 active:scale-95 transition-all text-center backdrop-blur-sm"
              >
                Request Aid
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* EXECUTIVE ADMIN PORTAL BANNER (If Admin) */}
      {isAdmin && (
        <section>
          <Link 
            to="/admin" 
            className="block bg-gradient-to-r from-purple-900/90 to-slate-900 rounded-3xl p-5 shadow-sm border border-purple-800/40 hover:border-purple-500/50 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center shrink-0">
                  <Shield className="w-6 h-6 text-purple-300" />
                </div>
                <div>
                  <h3 className="font-bold text-white group-hover:text-purple-200 transition-colors">Executive Admin Portal</h3>
                  <p className="text-xs text-purple-200/70 mt-0.5">Manage member approvals, welfare payouts & financial requisitions</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-purple-300 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </section>
      )}

      {/* ACTIVE SCHOOL CAMPAIGNS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Active School Campaigns</h3>
            <p className="text-xs text-slate-500">Infrastructure & educational development for Matuumu</p>
          </div>
          <Link to="/campaigns" className="text-xs font-bold text-amber-600 hover:text-amber-700 transition-colors flex items-center gap-1">
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        
        {activeCampaigns.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeCampaigns.map(camp => {
              const raised = Number(camp.raisedAmount) || 0;
              const target = Number(camp.targetAmount) || 1;
              const pct = Math.min(100, Math.round((raised / target) * 100));
              const imgUrl = (camp.imageUrls && camp.imageUrls[0]) || camp.imageUrl;

              return (
                <div key={camp.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:border-slate-300 transition-all">
                  {imgUrl && (
                    <div className="h-36 bg-slate-100 relative overflow-hidden">
                      <img src={imgUrl} alt={camp.title} className="w-full h-full object-cover" />
                      <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-sm text-amber-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                        {pct}% Funded
                      </div>
                    </div>
                  )}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-base mb-1">{camp.title}</h4>
                      <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">{camp.description}</p>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1.5">
                        <span className="text-slate-900">{formatUGX(raised)} Raised</span>
                        <span className="text-slate-400">Target: {formatUGX(target)}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
                        <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
                      </div>

                      <Link 
                        to={`/contribute?campaignId=${camp.id}`} 
                        className="block w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs text-center transition-colors"
                      >
                        Support Campaign
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <Target className="w-6 h-6 text-slate-400" strokeWidth={1.5} />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">No Active Campaigns Right Now</h4>
            <p className="text-xs text-slate-500 mt-1">Check back soon for new school projects.</p>
          </div>
        )}
      </section>

      {/* LATEST ANNOUNCEMENTS & NOTICES */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-500" />
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">Latest Announcements</h3>
        </div>
        
        {notices.length > 0 ? (
          <div className="space-y-3">
            {notices.map(notice => (
              <div key={notice.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-amber-500 p-5">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="font-bold text-slate-900 text-base">{notice.title}</h4>
                  {notice.isPinned && (
                    <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200/60 uppercase shrink-0">
                      Pinned
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 line-clamp-3 mb-3 leading-relaxed">
                  {notice.body || notice.content || 'No description provided.'}
                </p>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span>Posted by: <strong className="text-slate-600">{notice.postedBy || 'Association Executive'}</strong></span>
                  <span>{notice.createdAt ? new Date(notice.createdAt).toLocaleDateString() : ''}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 text-center flex flex-col items-center">
            <BellOff className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-xs text-slate-500">No announcements posted yet.</p>
          </div>
        )}
      </section>

      {/* QUICK EXPENSES & FINANCIALS LINKS (Admin only) */}
      {isAdmin && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link to="/money-out" className="bg-white rounded-2xl p-4 border border-slate-200 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Money Out Disburshments</h4>
                <p className="text-[11px] text-slate-500">Audit all outward Mobile Money transfers</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </Link>
          
          <Link to="/expenses" className="bg-white rounded-2xl p-4 border border-slate-200 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Budget & Requisitions</h4>
                <p className="text-[11px] text-slate-500">Executive vote approvals and expenses</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </Link>
        </section>
      )}

    </div>
  );
}

function StatCard({ 
  icon: Icon, 
  amount, 
  label, 
  badge,
  accentColor 
}: { 
  icon: any, 
  amount: string, 
  label: string, 
  badge: string,
  accentColor: 'gold' | 'emerald' | 'cyan' 
}) {
  const accentStyles = {
    gold: {
      bg: 'bg-amber-500/10 border-amber-500/20',
      icon: 'text-amber-400',
      text: 'text-amber-400',
    },
    emerald: {
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      icon: 'text-emerald-400',
      text: 'text-emerald-400',
    },
    cyan: {
      bg: 'bg-cyan-500/10 border-cyan-500/20',
      icon: 'text-cyan-400',
      text: 'text-cyan-400',
    }
  }[accentColor];

  return (
    <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 text-white flex flex-col justify-between shadow-md relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${accentStyles.bg}`}>
          <Icon className={`w-5 h-5 ${accentStyles.icon}`} strokeWidth={2} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700">
          {badge}
        </span>
      </div>
      <div>
        <h3 className="text-2xl font-extrabold text-white tracking-tight mb-1">{amount}</h3>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}
