import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { formatUGX } from '../lib/utils';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { AppSettings, SchoolCampaign, Notice, User, WelfareRequest, Banner } from '../types';
import { getActiveBanners } from '../lib/bannerService';
import { 
  Wallet, 
  Heart, 
  ArrowRight, 
  Bell, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  User as UserIcon,
  Users,
  Target,
  ShieldCheck,
  X,
  Calendar,
  Sparkles,
  Banknote,
  Receipt
} from 'lucide-react';

export default function Dashboard() {
  const { userProfile, currentUser } = useAuth();
  const navigate = useNavigate();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [campaigns, setCampaigns] = useState<SchoolCampaign[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [pendingWelfare, setPendingWelfare] = useState<WelfareRequest | null>(null);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [totalMembers, setTotalMembers] = useState<number>(0);
  const [needsWeeklyContribution, setNeedsWeeklyContribution] = useState<boolean>(false);
  const [recentWeeklyPaid, setRecentWeeklyPaid] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentBannerIdx, setCurrentBannerIdx] = useState(0);

  // Selected notice for modal view
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const activeBanners = await getActiveBanners();
        setBanners(activeBanners);
      } catch (e) {
        console.error(e);
      }
    };
    fetchBanners();
  }, []);

  useEffect(() => {
    if (banners.length > 1) {
      const interval = setInterval(() => {
        setCurrentBannerIdx(prev => (prev + 1) % banners.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [banners.length]);

  useEffect(() => {
    // 1. Real-time App Settings
    const unsubSettings = onSnapshot(collection(db, 'appSettings'), (snap) => {
      snap.forEach(docSnap => {
        if (docSnap.id === 'main') {
          setSettings({ id: 'main', ...docSnap.data() } as AppSettings);
        }
      });
    });

    // 2. Real-time Active School Campaigns (limit 2 for dashboard)
    const qCampaigns = query(
      collection(db, 'schoolCampaigns'), 
      where('status', '==', 'active')
    );
    const unsubCampaigns = onSnapshot(qCampaigns, (snap) => {
      const activeList = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as SchoolCampaign));
      activeList.sort((a, b) => b.createdAt - a.createdAt);
      setCampaigns(activeList);
    });

    // 3. Real-time Latest Notices (limit 3 for dashboard)
    const qNotices = query(collection(db, 'notices'), orderBy('createdAt', 'desc'), limit(3));
    const unsubNotices = onSnapshot(qNotices, (snap) => {
      setNotices(snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Notice)));
    });

    // 4. Real-time Approved Users Count
    const qUsers = query(collection(db, 'users'), where('status', '==', 'approved'));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      setTotalMembers(snap.size);
    });

    return () => {
      unsubSettings();
      unsubCampaigns();
      unsubNotices();
      unsubUsers();
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    // 5. Real-time Pending Welfare Requests for current user
    const qWelfare = query(
      collection(db, 'welfareRequests'),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'pending')
    );
    const unsubWelfare = onSnapshot(qWelfare, (snap) => {
      if (!snap.empty) {
        setPendingWelfare({ id: snap.docs[0].id, ...snap.docs[0].data() } as WelfareRequest);
      } else {
        setPendingWelfare(null);
      }
    });

    // 6. Real-time User Contributions to calculate weekly status & total verified
    const qContribs = query(
      collection(db, 'contributions'),
      where('userId', '==', currentUser.uid)
    );
    const unsubContribs = onSnapshot(qContribs, (snap) => {
      const minContrib = settings?.minimumWeeklyContribution || 5000;
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      
      let sumLast7Days = 0;
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.status === 'verified' && data.type === 'welfare' && data.createdAt >= sevenDaysAgo) {
          sumLast7Days += data.amount || 0;
        }
      });

      setRecentWeeklyPaid(sumLast7Days);
      setNeedsWeeklyContribution(sumLast7Days < minContrib);
      setLoading(false);
    });

    return () => {
      unsubWelfare();
      unsubContribs();
    };
  }, [currentUser, settings?.minimumWeeklyContribution]);

  // 7. Calculate Total Fund Balance if enabled
  useEffect(() => {
    if (settings?.showTotalBalanceToMembers) {
      const qAllVerified = query(
        collection(db, 'contributions'),
        where('status', '==', 'verified'),
        where('type', '==', 'welfare')
      );
      const unsubTotal = onSnapshot(qAllVerified, (snap) => {
        let sum = 0;
        snap.forEach(d => { sum += d.data().amount || 0; });
        setTotalBalance(sum);
      });
      return () => unsubTotal();
    }
  }, [settings?.showTotalBalanceToMembers]);

  if (!userProfile) return null;

  const firstName = userProfile.fullName ? userProfile.fullName.split(' ')[0] : 'Member';
  const roleDisplay = userProfile.role ? userProfile.role.replace('_', ' ') : 'Member';
  const minWeeklyGoal = settings?.minimumWeeklyContribution || 5000;

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      
      {/* A. Header */}
      <div className="flex items-center justify-between bg-mamas-card p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/profile')}
            className="relative group transition-transform active:scale-95"
            title="Go to Profile"
          >
            <div className="h-14 w-14 rounded-full overflow-hidden bg-mamas-primary border-2 border-mamas-accent flex items-center justify-center text-mamas-accent font-bold text-xl shadow-md">
              {userProfile.profilePictureUrl ? (
                <img src={userProfile.profilePictureUrl} alt={userProfile.fullName} className="h-full w-full object-cover" />
              ) : (
                firstName.charAt(0)
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-teal-500 w-4 h-4 rounded-full border-2 border-white"></div>
          </button>

          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-mamas-text flex items-center gap-2">
              Hello, {firstName} <Sparkles className="w-5 h-5 text-mamas-accent animate-pulse hidden sm:inline-block" />
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-mamas-primary/10 text-mamas-primary border border-mamas-primary/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                {roleDisplay}
              </span>
              <span className="text-xs text-slate-400 hidden sm:inline">• Matuumu Alumni</span>
            </div>
          </div>
        </div>

        <Link 
          to="/profile"
          className="hidden sm:flex items-center gap-2 text-xs font-bold text-mamas-primary hover:text-mamas-primary-hover bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3.5 py-2 rounded-xl transition-colors"
        >
          My Profile <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Banners Carousel */}
      {banners.length > 0 && (
        <div className="relative w-full aspect-[21/9] sm:aspect-[3/1] bg-slate-200 rounded-3xl overflow-hidden shadow-sm border border-slate-200/80">
          {banners.map((banner, idx) => (
            <img 
              key={banner.id}
              src={banner.url} 
              alt="Community Highlight" 
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${idx === currentBannerIdx ? 'opacity-100' : 'opacity-0'}`}
            />
          ))}
          {banners.length > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 z-10">
              {banners.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentBannerIdx(idx)}
                  className={`w-2 h-2 rounded-full transition-all ${idx === currentBannerIdx ? 'bg-white w-4' : 'bg-white/50'}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* B. Status / Alert Banner (Dynamic) */}
      <div className="space-y-3">
        {/* Weekly Minimum Warning Banner */}
        {needsWeeklyContribution && (
          <div className="bg-amber-50 border border-amber-200 p-4 sm:p-5 rounded-2xl shadow-sm flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-xl text-amber-800 flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-900">Weekly Contribution Due</h4>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                  You have contributed <span className="font-bold">{formatUGX(recentWeeklyPaid)}</span> in the past 7 days. The weekly minimum is <span className="font-bold">{formatUGX(minWeeklyGoal)}</span>.
                </p>
              </div>
            </div>
            <Link 
              to="/contribute" 
              className="flex-shrink-0 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition-colors self-center whitespace-nowrap"
            >
              Pay Now
            </Link>
          </div>
        )}

        {/* Pending Welfare Request Status Banner */}
        {pendingWelfare && (
          <div className="bg-blue-50 border border-blue-200 p-4 sm:p-5 rounded-2xl shadow-sm flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-xl text-blue-700 flex-shrink-0 mt-0.5">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-blue-900">Welfare Request Under Review</h4>
                <p className="text-xs text-blue-800 mt-0.5 leading-relaxed">
                  Your request for <span className="font-bold">{pendingWelfare.category}</span> ({formatUGX(pendingWelfare.amountRequested)}) is currently under evaluation by the Welfare Committee.
                </p>
              </div>
            </div>
            <Link 
              to="/welfare" 
              className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition-colors self-center whitespace-nowrap"
            >
              View Request
            </Link>
          </div>
        )}

        {/* Fully Active Member Banner (shown when no warnings and no pending welfare) */}
        {!needsWeeklyContribution && !pendingWelfare && (
          <div className="bg-teal-50/80 border border-teal-200 p-4 sm:p-5 rounded-2xl shadow-sm flex items-center gap-3">
            <div className="p-2 bg-teal-100 rounded-xl text-teal-700 flex-shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-teal-950">You are an Active Member</h4>
              <p className="text-xs text-teal-800 mt-0.5">
                Your contributions are up to date! Thank you for standing together with the MAMAS fraternity.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* C. Main Contribution Card (Large & Prominent) */}
      <div className="bg-gradient-to-br from-mamas-primary via-mamas-primary to-mamas-primary-hover rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-mamas-primary/20 relative overflow-hidden border border-mamas-primary-hover">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-mamas-accent/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className="text-xs font-bold text-mamas-accent uppercase tracking-widest bg-mamas-accent/10 px-3 py-1 rounded-full border border-mamas-accent/20">
                Member Standing
              </span>
              <p className="text-sm font-medium text-slate-300 mt-3">My Total Contributions</p>
              <h2 className="text-3xl sm:text-5xl font-display font-bold mt-1 tracking-tight text-white">
                {formatUGX(userProfile.totalContributed || 0)}
              </h2>
            </div>

            <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
              userProfile.contributionStatus === 'active' 
                ? 'bg-teal-500/20 text-teal-300 border border-teal-400/30' 
                : 'bg-slate-500/20 text-slate-300 border border-slate-400/30'
            }`}>
              <span className={`w-2 h-2 rounded-full ${userProfile.contributionStatus === 'active' ? 'bg-teal-400 animate-ping' : 'bg-slate-400'}`}></span>
              {userProfile.contributionStatus || 'Active'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-white/10">
            <Link 
              to="/contribute" 
              className="bg-mamas-accent hover:bg-mamas-accent-hover text-mamas-primary text-center py-3.5 px-6 rounded-2xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Wallet className="w-4 h-4" /> Pay Dues
            </Link>
            <Link 
              to="/welfare/apply" 
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 text-center py-3.5 px-6 rounded-2xl font-bold backdrop-blur-md transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Heart className="w-4 h-4 text-rose-300" /> Request Aid
            </Link>
          </div>
        </div>
      </div>

      {/* Admin Quick Access Bar for Committee */}
      {['super_admin', 'secretary', 'chairperson', 'vice_chairperson', 'treasurer', 'auditor'].includes(userProfile.role) && (
        <Link 
          to="/admin" 
          className="bg-mamas-card border border-slate-200/90 hover:border-mamas-primary/40 rounded-2xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-mamas-primary/10 text-mamas-primary flex items-center justify-center group-hover:bg-mamas-primary group-hover:text-white transition-colors">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-mamas-text flex items-center gap-2">
                Executive Admin Portal
                <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-semibold uppercase">Management</span>
              </p>
              <p className="text-xs text-mamas-text-muted">Review contributions, welfare requests & association settings</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-mamas-primary group-hover:translate-x-1 transition-all" />
        </Link>
      )}

      {/* F. Quick Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-mamas-card border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-mamas-text-muted">Total Members</span>
            <Users className="w-4 h-4 text-mamas-primary" />
          </div>
          <p className="text-2xl font-display font-bold text-mamas-text">{totalMembers}</p>
          <p className="text-[11px] text-teal-600 font-semibold mt-1">Verified Alumni</p>
        </div>

        <div className="bg-mamas-card border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-mamas-text-muted">Active Campaigns</span>
            <Target className="w-4 h-4 text-mamas-accent" />
          </div>
          <p className="text-2xl font-display font-bold text-mamas-text">{campaigns.length}</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">School Projects</p>
        </div>

        {settings?.showTotalBalanceToMembers ? (
          <div className="bg-mamas-card border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-mamas-text-muted">Total Fund</span>
              <Wallet className="w-4 h-4 text-teal-600" />
            </div>
            <p className="text-xl font-display font-bold text-mamas-primary truncate">{formatUGX(totalBalance)}</p>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Welfare Treasury</p>
          </div>
        ) : (
          <div className="bg-mamas-card border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-mamas-text-muted">Weekly Minimum</span>
              <Calendar className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xl font-display font-bold text-mamas-text">{formatUGX(minWeeklyGoal)}</p>
            <p className="text-[11px] text-amber-700 font-semibold mt-1">
              {needsWeeklyContribution ? 'Payment Due' : 'Paid This Week'}
            </p>
          </div>
        )}
      </div>

      {/* Money Out & Expenses Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <Link 
          to="/money-out" 
          className="bg-rose-50 border border-rose-100 hover:border-rose-200 hover:bg-rose-100/80 rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-200/50 text-rose-700 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-rose-900 flex items-center gap-2">
                Money Out
                <span className="text-[10px] bg-white text-rose-600 px-2 py-0.5 rounded-md font-bold uppercase border border-rose-200">Public</span>
              </p>
              <p className="text-xs text-rose-700/80">View all association payouts</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-rose-400 group-hover:text-rose-600 group-hover:translate-x-1 transition-all" />
        </Link>

        <Link 
          to="/expenses" 
          className="bg-indigo-50 border border-indigo-100 hover:border-indigo-200 hover:bg-indigo-100/80 rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-200/50 text-indigo-700 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-indigo-900 flex items-center gap-2">
                Association Expenses
                <span className="text-[10px] bg-white text-indigo-600 px-2 py-0.5 rounded-md font-bold uppercase border border-indigo-200">Controlled</span>
              </p>
              <p className="text-xs text-indigo-700/80">Requisitions, votes & payouts</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-indigo-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
        </Link>
      </div>

      {/* D. Active School Campaigns Section */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-lg font-bold text-mamas-text flex items-center gap-2">
            <Target className="w-5 h-5 text-mamas-accent" /> Active School Campaigns
          </h3>
          <Link 
            to="/campaigns" 
            className="text-xs font-bold text-mamas-primary hover:text-mamas-primary-hover flex items-center gap-1 transition-colors"
          >
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="bg-mamas-card border border-slate-200/80 rounded-2xl p-8 text-center">
            <Target className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-mamas-text">No active school campaigns at the moment.</p>
            <p className="text-xs text-mamas-text-muted mt-1">Check back soon for new school developments and projects.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.slice(0, 2).map(campaign => {
              const progress = campaign.targetAmount > 0 
                ? Math.min(100, Math.round((campaign.raisedAmount / campaign.targetAmount) * 100)) 
                : 0;

              return (
                <div key={campaign.id} className="bg-mamas-card border border-slate-200/90 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    {campaign.imageUrls && campaign.imageUrls.length > 0 && (
                      <div className="w-full h-24 rounded-xl overflow-hidden mb-3 bg-slate-100 border border-slate-200">
                        <img src={campaign.imageUrls[0]} alt={campaign.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-bold text-mamas-text text-base line-clamp-1">{campaign.title}</h4>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-700 px-2.5 py-0.5 rounded-full border border-teal-200 flex-shrink-0">
                        {progress}% Raised
                      </span>
                    </div>
                    <p className="text-xs text-mamas-text-muted line-clamp-2 leading-relaxed mb-4">{campaign.description}</p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1.5">
                        <span className="text-mamas-primary">{formatUGX(campaign.raisedAmount)}</span>
                        <span className="text-slate-400">Target: {formatUGX(campaign.targetAmount)}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-mamas-accent h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                      </div>
                    </div>

                    <Link 
                      to={`/contribute?campaignId=${campaign.id}`} 
                      className="block w-full bg-slate-50 hover:bg-mamas-primary hover:text-white border border-slate-200 text-mamas-primary text-center py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
                    >
                      Support Campaign
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* E. Latest Notices Section */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-lg font-bold text-mamas-text flex items-center gap-2">
            <Bell className="w-5 h-5 text-mamas-primary" /> Latest Notices
          </h3>
        </div>

        {notices.length === 0 ? (
          <div className="bg-mamas-card border border-slate-200/80 rounded-2xl p-8 text-center">
            <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-mamas-text">No announcements yet.</p>
            <p className="text-xs text-mamas-text-muted mt-1">Official association notices will appear here.</p>
          </div>
        ) : (
          <div className="bg-mamas-card border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm">
            <ul className="divide-y divide-slate-100">
              {notices.map(notice => (
                <li key={notice.id} className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        {notice.isPinned && (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md uppercase">
                            Important
                          </span>
                        )}
                        <h4 className="text-sm font-bold text-mamas-text leading-snug">{notice.title}</h4>
                      </div>
                      <p className="text-xs text-mamas-text-muted line-clamp-2 leading-relaxed">{notice.body}</p>
                      <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400 font-medium">
                        <span>{new Date(notice.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                        <span>•</span>
                        <span>Posted by Secretary</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedNotice(notice)}
                      className="text-xs font-bold text-mamas-primary hover:underline flex-shrink-0 self-center"
                    >
                      Read
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Notice Detail Modal */}
      {selectedNotice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button 
              onClick={() => setSelectedNotice(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-2">
              {selectedNotice.isPinned && (
                <span className="inline-block text-[10px] font-bold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                  Pinned Notice
                </span>
              )}
              <h3 className="text-xl font-bold text-mamas-text">{selectedNotice.title}</h3>
              <p className="text-xs text-slate-400 font-medium">
                Published on {new Date(selectedNotice.createdAt).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}
              </p>
            </div>

            <div className="py-2 border-t border-b border-slate-100 max-h-60 overflow-y-auto">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedNotice.body}</p>
            </div>

            <div className="pt-2 flex justify-end">
              <button 
                onClick={() => setSelectedNotice(null)}
                className="bg-mamas-primary hover:bg-mamas-primary-hover text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-colors"
              >
                Close Notice
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
