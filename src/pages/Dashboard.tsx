import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Wallet, Users, Target, Shield, ArrowRight, Heart, Bell, BellOff, ArrowUpRight, TrendingUp, CreditCard 
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { formatUGX } from '../lib/utils';

export default function Dashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  
  const [stats, setStats] = useState({
    totalFund: 0,
    members: 0,
    campaigns: 0,
  });
  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = ['super_admin', 'chairperson', 'vice_chairperson', 'treasurer', 'secretary'].includes(userProfile?.role || '');

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // Fetch stats (Mocked logic for speed, replace with real if needed)
        // In reality, this would query users, campaigns, and total funds
        const usersSnap = await getDocs(query(collection(db, 'users'), where('status', '==', 'approved')));
        const campaignsSnap = await getDocs(query(collection(db, 'campaigns'), where('status', '==', 'active')));
        const contributionsSnap = await getDocs(query(collection(db, 'contributions'), where('status', '==', 'successful')));
        
        const total = contributionsSnap.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0);
        
        setStats({
          totalFund: total,
          members: usersSnap.size,
          campaigns: campaignsSnap.size
        });

        // Fetch Campaigns
        const camps = campaignsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).slice(0, 5);
        setActiveCampaigns(camps);

        // Fetch Notices
        const noticesSnap = await getDocs(query(collection(db, 'notices'), orderBy('createdAt', 'desc'), limit(3)));
        setNotices(noticesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-mamas-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-8 animate-in fade-in duration-300">
      {/* SECTION A — HERO GREETING */}
      <section className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            {getGreeting()}, {userProfile?.fullName?.split(' ')[0] || 'User'} <span className="text-xl">👋</span>
          </h1>
          <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full border border-mamas-accent/30 bg-amber-50 text-mamas-accent text-xs font-bold uppercase tracking-widest">
            {userProfile?.role?.replace('_', ' ') || 'Member'}
          </div>
        </div>
      </section>

      {/* SECTION B — QUICK STATS ROW */}
      <section className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar">
        <StatCard icon={Wallet} color="navy" amount={formatUGX(stats.totalFund)} label="Welfare Treasury" />
        <StatCard icon={Users} color="emerald" amount={stats.members.toString()} label="Verified Alumni" />
        <StatCard icon={Target} color="gold" amount={stats.campaigns.toString()} label="Active Now" />
      </section>

      {/* SECTION C — PRIMARY ACTION CARD */}
      <section>
        <div className="bg-gradient-to-br from-mamas-primary to-slate-800 rounded-3xl p-6 shadow-xl shadow-mamas-primary/20 relative overflow-hidden">
          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-white/5 blur-2xl"></div>
          
          <p className="text-white/70 text-sm font-medium mb-1">My Total Contributions</p>
          <h2 className="text-3xl font-bold text-white mb-6">{formatUGX(0)}</h2> {/* Fetch actual user contribution total if needed */}
          
          <div className="w-full h-1 bg-white/10 rounded-full mb-8 overflow-hidden">
            <div className="h-full bg-mamas-accent w-1/3 rounded-full"></div>
          </div>
          
          <div className="flex items-center gap-3">
            <Link to="/contribute" className="flex-1 bg-mamas-accent text-mamas-primary font-bold py-3 px-4 rounded-full text-center text-sm hover:bg-mamas-accent-hover active:scale-95 transition-all">
              Pay Dues
            </Link>
            <Link to="/welfare/apply" className="flex-1 bg-white/10 text-white font-bold py-3 px-4 rounded-full text-center text-sm hover:bg-white/20 active:scale-95 transition-all backdrop-blur-sm">
              Request Aid
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION D — ADMIN PORTAL */}
      {isAdmin && (
        <section>
          <Link to="/admin" className="block bg-white rounded-3xl p-5 shadow-sm border border-gray-100 hover:scale-[1.01] transition-transform">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Executive Admin Portal</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Manage approvals & payouts</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-300" />
            </div>
          </Link>
        </section>
      )}

      {/* SECTION E — ACTIVE CAMPAIGNS */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 tracking-tight">Active School Campaigns</h3>
          <Link to="/campaigns" className="text-sm font-semibold text-mamas-accent hover:text-mamas-accent-hover transition-colors">View All →</Link>
        </div>
        
        {activeCampaigns.length > 0 ? (
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar">
            {activeCampaigns.map(camp => (
              <div key={camp.id} className="min-w-[280px] w-72 bg-white rounded-3xl shadow-sm border border-gray-100 snap-center overflow-hidden flex flex-col">
                <div className="h-32 bg-gradient-to-br from-gray-100 to-gray-200 relative">
                  {camp.imageUrl && <img src={camp.imageUrl} alt={camp.title} className="w-full h-full object-cover" />}
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-[10px] font-bold text-emerald-700">Active</div>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h4 className="font-bold text-gray-900 mb-3 truncate">{camp.title}</h4>
                  
                  <div className="mt-auto">
                    <div className="w-full h-1.5 bg-gray-100 rounded-full mb-2 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, ((camp.raisedAmount || 0) / (camp.targetAmount || 1)) * 100)}%` }}></div>
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium mb-4">
                      {formatUGX(camp.raisedAmount || 0)} of {formatUGX(camp.targetAmount)}
                    </p>
                    
                    <Link to={`/contribute?campaignId=${camp.id}`} className="block w-full py-2.5 rounded-full border border-mamas-primary text-mamas-primary font-bold text-xs text-center hover:bg-slate-50 transition-colors">
                      Support
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-3">
              <Target className="w-8 h-8 text-gray-400" strokeWidth={1.5} />
            </div>
            <h4 className="font-bold text-gray-900">No Active Campaigns</h4>
            <p className="text-sm text-gray-500 mt-1">Check back later for new school projects.</p>
          </div>
        )}
      </section>

      {/* SECTION F — LATEST NOTICES */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="font-bold text-gray-900 tracking-tight">Latest Notices</h3>
          <Bell className="w-4 h-4 text-gray-400" />
        </div>
        
        {notices.length > 0 ? (
          <div className="space-y-3">
            {notices.map(notice => (
              <div key={notice.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-mamas-accent p-4">
                <h4 className="font-bold text-gray-900 mb-1">{notice.title}</h4>
                <p className="text-sm text-gray-500 line-clamp-2 mb-2 leading-relaxed">{notice.content}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{new Date(notice.createdAt?.toDate()).toLocaleDateString()}</span>
                  <button className="text-xs font-bold text-mamas-accent">Read →</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center flex flex-col items-center">
            <BellOff className="w-8 h-8 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">No notices yet.</p>
          </div>
        )}
      </section>

      {/* SECTION G — MONEY OUT & EXPENSES (Admin only) */}
      {isAdmin && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link to="/money-out" className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex items-center justify-between hover:scale-[1.02] transition-transform">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h4 className="font-bold text-gray-900">Money Out</h4>
                <p className="text-xs text-gray-500">View all payouts</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300" />
          </Link>
          
          <Link to="/expenses" className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex items-center justify-between hover:scale-[1.02] transition-transform">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h4 className="font-bold text-gray-900">Expenses</h4>
                <p className="text-xs text-gray-500">Requisitions & votes</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300" />
          </Link>
        </section>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, color, amount, label }: { icon: any, color: 'navy'|'emerald'|'gold', amount: string, label: string }) {
  const colorMap = {
    navy: { bg: 'bg-slate-100', icon: 'text-slate-600', text: 'text-gray-900' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', text: 'text-gray-900' },
    gold: { bg: 'bg-amber-50', icon: 'text-amber-600', text: 'text-gray-900' },
  };
  const theme = colorMap[color];
  
  return (
    <div className="min-w-[140px] flex-1 bg-gray-50 rounded-2xl p-4 flex flex-col snap-center">
      <div className={`w-8 h-8 rounded-full ${theme.bg} flex items-center justify-center mb-3`}>
        <Icon className={`w-4 h-4 ${theme.icon}`} strokeWidth={2} />
      </div>
      <h3 className={`text-lg font-bold ${theme.text} mb-0.5 tracking-tight`}>{amount}</h3>
      <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">{label}</p>
    </div>
  );
}
