import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from '../components/Logo';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { 
  HeartHandshake, 
  GraduationCap, 
  TrendingUp, 
  Users, 
  UserPlus, 
  Wallet, 
  Sparkles, 
  ArrowRight,
  ShieldCheck,
  Building2,
  Heart
} from 'lucide-react';

export default function Landing() {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({
    totalContributions: '15.4M+',
    membersCount: '350+',
    grantsCount: '48+'
  });

  useEffect(() => {
    let isMounted = true;
    async function fetchImpactStats() {
      try {
        // Members count
        const usersSnap = await getDocs(collection(db, 'users'));
        const activeMembers = usersSnap.docs.filter(d => ['active', 'approved'].includes(d.data().status)).length;

        // Contributions
        const contribsSnap = await getDocs(query(collection(db, 'contributions'), where('status', '==', 'completed')));
        let totalSum = 0;
        contribsSnap.docs.forEach(d => {
          totalSum += (d.data().amount || 0);
        });

        // Welfare grants
        const welfareSnap = await getDocs(query(collection(db, 'welfareRequests'), where('status', '==', 'approved')));
        const grants = welfareSnap.docs.length;

        if (isMounted) {
          setStats({
            totalContributions: totalSum > 0 ? `${(totalSum / 1000000).toFixed(1)}M+` : '15.4M+',
            membersCount: activeMembers > 0 ? `${activeMembers}+` : '350+',
            grantsCount: grants > 0 ? `${grants}+` : '48+'
          });
        }
      } catch (err) {
        console.warn('Using default impact stats:', err);
      }
    }

    fetchImpactStats();
    return () => { isMounted = false; };
  }, []);

  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 flex flex-col selection:bg-mamas-accent selection:text-mamas-primary transition-colors duration-200">
      
      {/* Top Navigation Header */}
      <header className="w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 sm:px-12 py-4 flex items-center justify-between sticky top-0 z-50">
        <Logo />
        <div className="flex items-center gap-3 sm:gap-4">
          <Link 
            to="/login" 
            className="text-xs sm:text-sm font-semibold text-slate-200 hover:text-white px-3 sm:px-4 py-2 rounded-full hover:bg-white/10 transition-all"
          >
            Member Login
          </Link>
          <Link 
            to="/register" 
            className="text-xs sm:text-sm font-bold bg-mamas-accent text-mamas-primary px-5 py-2.5 rounded-full shadow-lg hover:bg-mamas-accent-hover active:scale-95 transition-all"
          >
            Join MAMAS
          </Link>
        </div>
      </header>

      {/* 1. HERO SECTION */}
      <section className="relative bg-gradient-to-br from-slate-950 via-mamas-primary to-slate-900 text-white overflow-hidden py-16 sm:py-24 lg:py-32 px-6 sm:px-12">
        {/* Glowing Background Orbs */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-mamas-accent/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 -right-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center relative z-10">
          
          {/* Left Text Column */}
          <div className="lg:col-span-7 text-center lg:text-left space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-mamas-accent text-xs font-bold tracking-wide uppercase">
              <ShieldCheck className="w-4 h-4 text-mamas-accent" />
              <span>Official Matuumu Alumni Association</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15] text-white">
              Together for Each Other. <br className="hidden sm:inline"/>
              <span className="text-mamas-accent">Together for Matuumu.</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              The Matuumu Alumni Mutual Aid Association — where alumni support one another in times of need, and give back to the school that made us.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Link 
                to="/register" 
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full bg-mamas-accent text-mamas-primary font-extrabold text-base shadow-xl hover:bg-mamas-accent-hover hover:scale-105 active:scale-95 transition-all"
              >
                <span>Join MAMAS</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link 
                to="/login" 
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full border-2 border-white/30 hover:border-white text-white font-bold text-base hover:bg-white/10 transition-all"
              >
                Member Login
              </Link>
            </div>
          </div>

          {/* Right Icon Illustration Cluster */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md aspect-square rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md p-8 flex items-center justify-center shadow-2xl">
              
              {/* Outer Pulsing Rings */}
              <div className="absolute inset-4 border border-mamas-accent/20 rounded-2xl animate-pulse" />
              <div className="absolute inset-8 border border-white/10 rounded-2xl" />

              {/* Central Pillar Icons Grid */}
              <div className="grid grid-cols-2 gap-4 w-full relative z-10">
                {/* Heart / Mutual Aid */}
                <div className="bg-slate-900/90 border border-rose-500/30 p-5 rounded-2xl flex flex-col items-center text-center shadow-lg hover:border-rose-500/60 transition-all group">
                  <div className="w-12 h-12 rounded-xl bg-rose-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Heart className="w-6 h-6 text-rose-400 fill-rose-400/30" />
                  </div>
                  <span className="text-xs font-bold text-slate-200">Mutual Aid</span>
                  <span className="text-[10px] text-slate-400">Welfare Grants</span>
                </div>

                {/* School */}
                <div className="bg-slate-900/90 border border-amber-500/30 p-5 rounded-2xl flex flex-col items-center text-center shadow-lg hover:border-amber-500/60 transition-all group">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Building2 className="w-6 h-6 text-amber-400" />
                  </div>
                  <span className="text-xs font-bold text-slate-200">Matuumu Alma Mater</span>
                  <span className="text-[10px] text-slate-400">Development</span>
                </div>

                {/* Community */}
                <div className="bg-slate-900/90 border border-blue-500/30 p-5 rounded-2xl flex flex-col items-center text-center shadow-lg hover:border-blue-500/60 transition-all group">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Users className="w-6 h-6 text-blue-400" />
                  </div>
                  <span className="text-xs font-bold text-slate-200">Alumni Family</span>
                  <span className="text-[10px] text-slate-400">Strong Network</span>
                </div>

                {/* Legacy */}
                <div className="bg-slate-900/90 border border-emerald-500/30 p-5 rounded-2xl flex flex-col items-center text-center shadow-lg hover:border-emerald-500/60 transition-all group">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <GraduationCap className="w-6 h-6 text-emerald-400" />
                  </div>
                  <span className="text-xs font-bold text-slate-200">Future Legacy</span>
                  <span className="text-[10px] text-slate-400">Next Generation</span>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* 4. IMPACT BAR */}
      <section className="bg-slate-900 border-y border-slate-800 text-white py-10 px-6 sm:px-12">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-slate-800">
          
          <div className="pt-4 md:pt-0">
            <div className="text-3xl sm:text-4xl font-extrabold text-mamas-accent tracking-tight">
              UGX {stats.totalContributions}
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider mt-1">
              Contributed
            </p>
          </div>

          <div className="pt-4 md:pt-0">
            <div className="text-3xl sm:text-4xl font-extrabold text-mamas-accent tracking-tight">
              {stats.membersCount}
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider mt-1">
              Active Members
            </p>
          </div>

          <div className="pt-4 md:pt-0">
            <div className="text-3xl sm:text-4xl font-extrabold text-mamas-accent tracking-tight">
              {stats.grantsCount}
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider mt-1">
              Welfare Grants Given
            </p>
          </div>

        </div>
      </section>

      {/* 2. THREE PILLARS SECTION */}
      <section className="py-16 sm:py-24 px-6 sm:px-12 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <span className="text-xs font-extrabold uppercase tracking-widest text-mamas-primary dark:text-mamas-accent bg-amber-500/10 dark:bg-amber-500/20 px-3.5 py-1.5 rounded-full border border-mamas-accent/30 inline-block mb-3">
            Our Core Pillars
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            What We Do
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base mt-2">
            MAMAS is built on three unwavering commitments to our members and our alma mater.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Card 1: Support Each Other */}
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-mamas-accent/40 flex items-center justify-center text-mamas-accent mb-6 group-hover:scale-110 transition-transform">
                <HeartHandshake className="w-7 h-7 text-mamas-accent" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                Support Each Other
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                Life is unpredictable. When a fellow alumnus faces hardship, we rally together. Apply for welfare grants or contribute to help a brother or sister in need.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-mamas-primary dark:text-mamas-accent flex items-center gap-1">
              <span>Welfare & Emergency Relief</span>
            </div>
          </div>

          {/* Card 2: Support Our School */}
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-mamas-accent/40 flex items-center justify-center text-mamas-accent mb-6 group-hover:scale-110 transition-transform">
                <GraduationCap className="w-7 h-7 text-mamas-accent" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                Support Our School
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                Matuumu shaped us. Now we shape its future. Fund school development campaigns — classrooms, libraries, and facilities for the next generation.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-mamas-primary dark:text-mamas-accent flex items-center gap-1">
              <span>School Development Projects</span>
            </div>
          </div>

          {/* Card 3: Grow Together */}
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-mamas-accent/40 flex items-center justify-center text-mamas-accent mb-6 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-7 h-7 text-mamas-accent" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                Grow Together
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                Every contribution builds our collective strength. The more we give, the more we can do — for each other, for our school, and for our legacy.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-mamas-primary dark:text-mamas-accent flex items-center gap-1">
              <span>Sustainable Alumni Endowment</span>
            </div>
          </div>

        </div>
      </section>

      {/* 3. HOW IT WORKS */}
      <section className="py-16 bg-slate-100/70 dark:bg-slate-900/50 border-y border-slate-200/60 dark:border-slate-800 px-6 sm:px-12">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-10">
            How It Works
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            
            {/* Step 1 */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-md flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-mamas-primary text-mamas-accent font-black text-lg flex items-center justify-center mb-4 shadow-md">
                1
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-mamas-accent" />
                <span>Join</span>
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Create your account and get verified as an authentic Matuumu alumnus by our admin team.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-md flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-mamas-primary text-mamas-accent font-black text-lg flex items-center justify-center mb-4 shadow-md">
                2
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-mamas-accent" />
                <span>Contribute</span>
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Send weekly welfare dues or back active school development projects using Mobile Money seamlessly.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-md flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-mamas-primary text-mamas-accent font-black text-lg flex items-center justify-center mb-4 shadow-md">
                3
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-mamas-accent" />
                <span>Impact</span>
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Receive urgent welfare support when in need and watch our school transform for generations to come.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* CALL TO ACTION */}
      <section className="py-16 sm:py-20 px-6 sm:px-12 bg-gradient-to-r from-mamas-primary via-slate-900 to-mamas-primary text-white text-center relative overflow-hidden">
        <div className="max-w-3xl mx-auto space-y-6 relative z-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Ready to Stand With Your Fellow Alumni?
          </h2>
          <p className="text-slate-300 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            Join hundreds of Matuumu alumni already building a safety net for each other and transforming our school.
          </p>
          <div className="pt-2">
            <Link 
              to="/register" 
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-mamas-accent text-mamas-primary font-extrabold text-base shadow-2xl hover:bg-mamas-accent-hover active:scale-95 transition-all"
            >
              <span>Create Your Member Account</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* 5. FOOTER */}
      <footer className="w-full bg-slate-950 text-slate-400 py-10 px-6 sm:px-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Logo />
          </div>

          <div className="flex items-center gap-6 text-xs sm:text-sm font-semibold">
            <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <span>&middot;</span>
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
          </div>

          <div className="text-xs text-slate-500 text-center sm:text-right">
            &copy; {new Date().getFullYear()} Matuumu Alumni Mutual Aid Association. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  );
}

