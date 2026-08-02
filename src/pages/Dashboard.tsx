import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Wallet, Users, Target, Shield, ArrowRight, Bell, BellOff, ArrowUpRight, TrendingUp, ShieldCheck, Trophy 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { formatUGX, DEFAULT_CAMPAIGN_PLACEHOLDER } from '../lib/utils';

export default function Dashboard() {
  const { currentUser, userProfile } = useAuth();
  
  const [appSettings, setAppSettings] = useState<any>(null);
  const [topContributors, setTopContributors] = useState<any[]>([]);

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
  const isExecutive = ['super_admin', 'chairperson', 'vice_chairperson', 'treasurer', 'secretary', 'auditor', 'mobiliser'].includes(userProfile?.role || '');

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

      // 5. Fetch Top Contributors (for leaderboard)
      let topContributorsList: any[] = [];
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const approved = usersSnap.docs
          .map(doc => ({ uid: doc.id, ...doc.data() } as any))
          .filter(u => ['approved', 'active'].includes((u.status || '').toLowerCase()))
          .sort((a, b) => (b.totalContributed || 0) - (a.totalContributed || 0))
          .slice(0, 5); // top 5 contributors
        topContributorsList = approved;
      } catch (err) {
        console.warn("Could not load top contributors for leaderboard:", err);
      }

      if (isSubscribed) {
        setStats({
          totalFund: calculatedTotal,
          members: memberCountStr,
          campaigns: campaignsCountStr,
        });
        setActiveCampaigns(campsList);
        setNotices(noticeList);
        setTopContributors(topContributorsList);
        setLoading(false);
      }
    }

    fetchDashboardData();

    // Real-time appSettings listener
    const unsubSettings = onSnapshot(doc(db, 'appSettings', 'main'), (snap) => {
      if (!isSubscribed) return;
      if (snap.exists()) {
        const data = snap.data();
        setAppSettings({
          showTotalBalanceToMembers: data.showTotalBalanceToMembers !== undefined ? !!data.showTotalBalanceToMembers : true,
          showTopContributors: data.showTopContributors !== undefined ? !!data.showTopContributors : true,
          ...data
        });
      } else {
        setAppSettings({
          showTotalBalanceToMembers: true,
          showTopContributors: true,
        });
      }
    }, (err) => {
      console.warn("Could not load real-time app settings:", err);
      if (isSubscribed) {
        setAppSettings({
          showTotalBalanceToMembers: true,
          showTopContributors: true,
        });
      }
    });

    return () => {
      isSubscribed = false;
      unsubSettings();
    };
  }, [currentUser]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const showBalance = isExecutive || (appSettings ? appSettings.showTotalBalanceToMembers !== false : false);
  const showLeaderboard = isExecutive || (appSettings ? appSettings.showTopContributors !== false : false);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[40vh]">
        <div className="w-9 h-9 border-3 border-slate-200 border-t-amber-500 rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-slate-500 mt-2.5">Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-28 animate-in fade-in duration-300">
      
      {/* COMPACT HERO GREETING BANNER */}
      <section className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-md border border-slate-700/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 rounded-full bg-amber-500/10 blur-2xl pointer-events-none"></div>
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider mb-1">
              <Shield className="w-3 h-3" />
              {userProfile?.role?.replace('_', ' ') || 'Alumni Member'}
            </div>
            <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight text-white leading-tight">
              {getGreeting()}, {userProfile?.fullName?.split(' ')[0] || 'Alumnus'} 👋
            </h1>
            <p className="text-slate-300 text-xs mt-0.5">
              Matuumu Alumni Mutual Aid Association Portal
            </p>
          </div>
          
          <Link 
            to="/contribute"
            className="hidden sm:inline-flex bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-md transition-all shrink-0"
          >
            Pay Dues
          </Link>
        </div>
      </section>

      {/* STATS ROW - 2 COLUMNS ON MOBILE, 4 ON DESKTOP */}
      <section className={`grid gap-3 ${showBalance ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {/* Card 1: Welfare Treasury */}
        {showBalance && (
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-3.5 sm:p-4 text-white shadow-sm border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-amber-400" />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-300 px-1.5 py-0.5 rounded bg-amber-500/10">
                Verified
              </span>
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight leading-none mb-1">
                {stats.totalFund !== null ? stats.totalFund : '--'}
              </h3>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Welfare Treasury</p>
            </div>
          </div>
        )}

        {/* Card 2: Verified Alumni */}
        <div className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 rounded-2xl p-3.5 sm:p-4 text-white shadow-sm border border-emerald-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
              <Users className="w-4 h-4 text-emerald-300" />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-300 px-1.5 py-0.5 rounded bg-emerald-500/10">
              Active
            </span>
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight leading-none mb-1">
              {stats.members !== null ? stats.members : '--'}
            </h3>
            <p className="text-[11px] font-semibold text-emerald-200/80 uppercase tracking-wide">Verified Alumni</p>
          </div>
        </div>

        {/* Card 3: Active Campaigns */}
        <div className="bg-gradient-to-br from-amber-600 via-amber-700 to-amber-800 rounded-2xl p-3.5 sm:p-4 text-white shadow-sm border border-amber-500/40 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center">
              <Target className="w-4 h-4 text-amber-100" />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-100 px-1.5 py-0.5 rounded bg-black/20">
              Ongoing
            </span>
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight leading-none mb-1">
              {stats.campaigns !== null ? stats.campaigns : '--'}
            </h3>
            <p className="text-[11px] font-semibold text-amber-100/90 uppercase tracking-wide">Active Campaigns</p>
          </div>
        </div>

        {/* Card 4: Member Status */}
        <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 rounded-2xl p-3.5 sm:p-4 text-white shadow-sm border border-indigo-900/50 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-indigo-300" />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-300 px-1.5 py-0.5 rounded bg-indigo-500/10">
              Status
            </span>
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-emerald-400 tracking-tight leading-none mb-1">
              Good Standing
            </h3>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Membership</p>
          </div>
        </div>
      </section>

      {/* COMPACT QUICK ACTION CARD */}
      <section>
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-700/60 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Mutual Aid & Dues</h2>
            <p className="text-slate-300 text-xs mt-0.5 leading-snug">
              Pay monthly welfare dues or request financial emergency relief.
            </p>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <Link 
              to="/contribute" 
              className="flex-1 sm:flex-none bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl text-xs shadow-md active:scale-95 transition-all text-center"
            >
              Pay Dues / Support
            </Link>
            <Link 
              to="/welfare/apply" 
              className="flex-1 sm:flex-none bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 px-4 rounded-xl text-xs border border-white/10 active:scale-95 transition-all text-center"
            >
              Request Aid
            </Link>
          </div>
        </div>
      </section>

      {/* ADMIN PORTAL LINK */}
      {isAdmin && (
        <section>
          <Link 
            to="/admin" 
            className="block bg-gradient-to-r from-purple-950 via-slate-900 to-purple-950 rounded-2xl p-3.5 shadow-sm border border-purple-800/40 hover:border-purple-500/50 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-purple-300" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-xs group-hover:text-purple-200 transition-colors">Executive Admin Portal</h3>
                  <p className="text-[11px] text-purple-200/70">Member approvals, payouts & requisitions</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-purple-300 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </section>
      )}

      {/* ACTIVE SCHOOL CAMPAIGNS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Active Campaigns</h3>
            <p className="text-[11px] text-slate-500">Infrastructure projects for Matuumu</p>
          </div>
          <Link to="/campaigns" className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1">
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        
        {activeCampaigns.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeCampaigns.map(camp => {
              const raised = Number(camp.raisedAmount) || 0;
              const target = Number(camp.targetAmount) || 1;
              const pct = Math.min(100, Math.round((raised / target) * 100));
              const imgUrl = (camp.imageUrls && camp.imageUrls[0]) || camp.imageUrl;

              return (
                <div key={camp.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col justify-between hover:border-slate-300 transition-all">
                  <div className="flex gap-3 items-start mb-3">
                    <img 
                      src={imgUrl || DEFAULT_CAMPAIGN_PLACEHOLDER} 
                      alt={camp.title} 
                      className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-100 border border-slate-200" 
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = DEFAULT_CAMPAIGN_PLACEHOLDER;
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="font-bold text-slate-900 text-sm truncate">{camp.title}</h4>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                          {pct}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-0.5 leading-snug">{camp.description}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-bold mb-1">
                      <span className="text-slate-900">{formatUGX(raised)}</span>
                      <span className="text-slate-400">Target: {formatUGX(target)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }}></div>
                    </div>

                    <Link 
                      to={`/contribute?campaignId=${camp.id}`} 
                      className="block w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs text-center transition-colors"
                    >
                      Support Campaign
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center flex flex-col items-center">
            <Target className="w-7 h-7 text-slate-300 mb-1" strokeWidth={1.5} />
            <p className="text-xs font-bold text-slate-700">No Active Campaigns Right Now</p>
          </div>
        )}
      </section>

      {/* ANNOUNCEMENTS & LEADERBOARD GROUP */}
      <section className={`grid grid-cols-1 ${showLeaderboard ? 'lg:grid-cols-12' : ''} gap-5`}>
        {/* LATEST ANNOUNCEMENTS */}
        <div className={`space-y-3 ${showLeaderboard ? 'lg:col-span-7' : ''}`}>
          <div className="flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-amber-500" />
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Announcements</h3>
          </div>
          
          {notices.length > 0 ? (
            <div className="space-y-2.5">
              {notices.map(notice => (
                <div key={notice.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 border-l-4 border-l-amber-500 p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-bold text-slate-900 text-sm">{notice.title}</h4>
                    {notice.isPinned && (
                      <span className="bg-amber-50 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-200 shrink-0 uppercase">
                        Pinned
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 mb-2 leading-snug">
                    {notice.body || notice.content || 'No description provided.'}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                    <span>By: <strong className="text-slate-600">{notice.postedBy || 'Executive'}</strong></span>
                    <span>{notice.createdAt ? new Date(notice.createdAt).toLocaleDateString() : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center flex flex-col items-center justify-center min-h-[140px]">
              <BellOff className="w-6 h-6 text-slate-300 mb-1.5" />
              <p className="text-xs font-semibold text-slate-500">No announcements posted yet.</p>
            </div>
          )}
        </div>

        {/* TOP CONTRIBUTORS LEADERBOARD */}
        {showLeaderboard && (
          <div className="space-y-3 lg:col-span-5">
            <div className="flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-500" />
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Top Contributors</h3>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 min-h-[140px] flex flex-col justify-between">
              {topContributors.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {topContributors.map((member, index) => {
                    const isTopThree = index < 3;
                    const rankColors = [
                      'bg-amber-50 text-amber-600 border-amber-200', // Gold
                      'bg-slate-50 text-slate-500 border-slate-200',  // Silver
                      'bg-amber-50 text-amber-700/80 border-amber-200/50' // Bronze
                    ];
                    const rankLabel = ['1st', '2nd', '3rd', '4th', '5th'][index] || `${index + 1}th`;
                    const initials = member.fullName ? member.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'AM';
                    
                    return (
                      <div key={member.uid} className={`flex items-center justify-between py-2.5 ${index === 0 ? 'pt-0' : ''} ${index === topContributors.length - 1 ? 'pb-0' : ''}`}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Rank badge */}
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border shrink-0 text-center w-8 ${isTopThree ? rankColors[index] : 'bg-slate-50 text-slate-500 border-slate-250'}`}>
                            {rankLabel}
                          </span>
                          
                          {/* Avatar */}
                          {member.profilePictureUrl ? (
                            <img src={member.profilePictureUrl} alt={member.fullName} className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-extrabold text-[10px] flex items-center justify-center border border-slate-200 shrink-0 uppercase">
                              {initials}
                            </div>
                          )}
                          
                          {/* Name & Class info */}
                          <div className="truncate">
                            <h4 className="font-bold text-slate-900 text-xs truncate leading-none mb-1">{member.fullName}</h4>
                            <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Class of {member.yearLeftSchool || '—'}</p>
                          </div>
                        </div>
                        
                        {/* Contribution Total */}
                        <div className="text-right shrink-0 pl-2">
                          <span className="font-extrabold text-slate-900 text-xs leading-none block">
                            {formatUGX(member.totalContributed || 0)}
                          </span>
                          <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wider leading-none mt-0.5">Total Dues</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 flex flex-col items-center justify-center flex-1">
                  <Trophy className="w-7 h-7 text-slate-300 mb-1.5" strokeWidth={1.5} />
                  <p className="text-xs font-semibold text-slate-500">No contributors yet.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* QUICK EXPENSES LINKS (Admin only) */}
      {isAdmin && (
        <section className="grid grid-cols-2 gap-3">
          <Link to="/money-out" className="bg-white rounded-2xl p-3.5 border border-slate-200 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-4 h-4 text-rose-500" />
              </div>
              <div className="truncate">
                <h4 className="font-bold text-slate-900 text-xs truncate">Money Out</h4>
                <p className="text-[10px] text-slate-400 truncate">Mobile Money transfers</p>
              </div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </Link>
          
          <Link to="/expenses" className="bg-white rounded-2xl p-3.5 border border-slate-200 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="truncate">
                <h4 className="font-bold text-slate-900 text-xs truncate">Requisitions</h4>
                <p className="text-[10px] text-slate-400 truncate">Executive vote approvals</p>
              </div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </Link>
        </section>
      )}

    </div>
  );
}
