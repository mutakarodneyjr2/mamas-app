import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from '../components/Logo';
import { ThemeIconButton } from '../components/ThemeToggle';
import { db } from '../firebase';
import { collection, getDocs, getDoc, doc, query, where } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
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
  Heart,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  CheckCircle2,
  Layers,
  HelpCircle
} from 'lucide-react';

export default function Landing() {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({
    totalContributions: '15.4M+',
    membersCount: '350+',
    grantsCount: '48+'
  });

  const [banners, setBanners] = useState<string[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideDirection, setSlideDirection] = useState(1);
  const [isHovered, setIsHovered] = useState(false);
  
  // Interactive Showcase Active Tab state ('pillars' | 'how' | 'banners')
  const [activeTab, setActiveTab] = useState<'pillars' | 'how' | 'banners'>('pillars');

  useEffect(() => {
    let isMounted = true;
    async function fetchImpactStatsAndSettings() {
      try {
        const settingsSnap = await getDoc(doc(db, 'appSettings', 'main'));
        if (settingsSnap.exists() && isMounted) {
          const data = settingsSnap.data();
          const list = data.banners || data.landingBanners || [];
          if (Array.isArray(list) && list.length > 0) {
            setBanners(list.filter(Boolean));
          }
        }

        const usersSnap = await getDocs(collection(db, 'users'));
        const activeMembers = usersSnap.docs.filter(d => ['active', 'approved'].includes(d.data().status)).length;

        const contribsSnap = await getDocs(query(collection(db, 'contributions'), where('status', '==', 'completed')));
        let totalSum = 0;
        contribsSnap.docs.forEach(d => {
          totalSum += (d.data().amount || 0);
        });

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
        console.warn('Using default impact stats or banners:', err);
      }
    }

    fetchImpactStatsAndSettings();
    return () => { isMounted = false; };
  }, []);

  // Auto-switch tabs periodically if not hovered
  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setActiveTab(prev => (prev === 'pillars' ? 'how' : prev === 'how' ? 'banners' : 'pillars'));
    }, 8000);
    return () => clearInterval(interval);
  }, [isHovered]);

  // Auto advance banner slider if banners present
  useEffect(() => {
    if (banners.length <= 1 || isHovered) return;
    const timer = setInterval(() => {
      setSlideDirection(1);
      setCurrentSlide(prev => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length, isHovered]);

  const handlePrev = () => {
    setSlideDirection(-1);
    setCurrentSlide(prev => (prev - 1 + banners.length) % banners.length);
  };

  const handleNext = () => {
    setSlideDirection(1);
    setCurrentSlide(prev => (prev + 1) % banners.length);
  };

  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="h-screen overflow-hidden bg-mamas-bg font-sans text-slate-900 dark:text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white transition-colors duration-200">
      
      {/* 1. VIBRANT LIGHT BLUE TOP SYSTEM HEADER */}
      <header className="w-full bg-blue-600 dark:bg-blue-700 text-white border-b border-blue-500/40 px-4 sm:px-8 py-3.5 flex items-center justify-between shrink-0 shadow-md z-50">
        <div className="flex items-center gap-3">
          <Logo dark />
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeIconButton className="text-white hover:bg-white/15" />
          <Link 
            to="/login" 
            className="text-xs sm:text-sm font-bold text-white hover:bg-white/15 px-3 sm:px-4 py-2 rounded-full transition-all cursor-pointer"
          >
            Member Login
          </Link>
          <Link 
            to="/register" 
            className="text-xs sm:text-sm font-extrabold bg-white text-blue-900 hover:bg-blue-50 px-4 sm:px-5 py-2 rounded-full shadow-md active:scale-95 transition-all cursor-pointer"
          >
            Join MAMAS
          </Link>
        </div>
      </header>

      {/* MAIN VIEWPORT WRAPPER (No Long Scroll Marathon, Edge-to-Edge) */}
      <div 
        className="flex-1 overflow-y-auto flex flex-col justify-between"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        
        {/* HERO TITLE & STATS STRIP (EDGE-TO-EDGE) */}
        <div className="bg-gradient-to-r from-[#07132c] via-[#0f2756] to-[#1e3a8a] text-white pt-6 pb-4 px-4 sm:px-8 border-b border-blue-900/40">
          <div className="max-w-5xl mx-auto text-center space-y-3">
            
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-blue-200 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
              <span>Official Matuumu Alumni Mutual Aid Association</span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Together for Each Other. <span className="text-blue-300">Together for Matuumu.</span>
            </h1>

            <p className="text-xs sm:text-sm text-blue-100/90 max-w-2xl mx-auto leading-relaxed">
              Where alumni support one another in times of need and fund school development projects via Mobile Money.
            </p>

            {/* IMPACT METRICS EDGE-TO-EDGE BAR */}
            <div className="pt-2 grid grid-cols-3 gap-2 max-w-xl mx-auto text-center divide-x divide-blue-800/60">
              <div>
                <span className="text-base sm:text-2xl font-extrabold text-blue-300 block">UGX {stats.totalContributions}</span>
                <span className="text-[10px] sm:text-xs font-bold text-blue-200/80 uppercase">Contributed</span>
              </div>
              <div>
                <span className="text-base sm:text-2xl font-extrabold text-blue-300 block">{stats.membersCount}</span>
                <span className="text-[10px] sm:text-xs font-bold text-blue-200/80 uppercase">Members</span>
              </div>
              <div>
                <span className="text-base sm:text-2xl font-extrabold text-blue-300 block">{stats.grantsCount}</span>
                <span className="text-[10px] sm:text-xs font-bold text-blue-200/80 uppercase">Relief Grants</span>
              </div>
            </div>

          </div>
        </div>

        {/* INTERACTIVE ANIMATED FEATURE SHOWCASE (EDGE-TO-EDGE, NO CARDS) */}
        <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-8 py-6 flex flex-col justify-center">
          
          {/* TAB CHIPS SELECTOR */}
          <div className="flex items-center justify-center gap-2 mb-6 border-b border-slate-200/60 dark:border-slate-800/60 pb-3">
            <button
              onClick={() => setActiveTab('pillars')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'pillars'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              <span>Core Pillars</span>
            </button>

            <button
              onClick={() => setActiveTab('how')}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'how'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>How It Works</span>
            </button>

            {banners.length > 0 && (
              <button
                onClick={() => setActiveTab('banners')}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'banners'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Featured Gallery ({banners.length})</span>
              </button>
            )}
          </div>

          {/* ANIMATED CONTENT PANEL */}
          <AnimatePresence mode="wait">
            
            {/* 1. CORE PILLARS PANEL */}
            {activeTab === 'pillars' && (
              <motion.div
                key="pillars"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-200/60 dark:divide-slate-800/60"
              >
                <div className="pt-4 md:pt-0 md:px-4 space-y-2 text-center md:text-left">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto md:mx-0 font-bold">
                    <HeartHandshake className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Mutual Aid & Relief</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    When a fellow alumnus faces bereavement, medical emergencies, or hardship, we rally together with direct financial grants.
                  </p>
                </div>

                <div className="pt-4 md:pt-0 md:px-4 space-y-2 text-center md:text-left">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto md:mx-0 font-bold">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">School Infrastructure</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Fund school development projects — building classrooms, laboratories, and upgrading facilities for Matuumu students.
                  </p>
                </div>

                <div className="pt-4 md:pt-0 md:px-4 space-y-2 text-center md:text-left">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto md:mx-0 font-bold">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Alumni Endowment</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Every member contribution builds a sustainable, transparent endowment pool governed democratically by vote.
                  </p>
                </div>
              </motion.div>
            )}

            {/* 2. HOW IT WORKS PANEL */}
            {activeTab === 'how' && (
              <motion.div
                key="how"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-200/60 dark:divide-slate-800/60"
              >
                <div className="pt-4 md:pt-0 md:px-4 space-y-2 text-center md:text-left">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center mx-auto md:mx-0">
                    1
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-center md:justify-start gap-1.5">
                    <UserPlus className="w-4 h-4 text-blue-600" /> Register & Verify
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Create your member account and get verified as an authentic Matuumu alumnus by our executive team.
                  </p>
                </div>

                <div className="pt-4 md:pt-0 md:px-4 space-y-2 text-center md:text-left">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center mx-auto md:mx-0">
                    2
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-center md:justify-start gap-1.5">
                    <Wallet className="w-4 h-4 text-blue-600" /> Pay Mobile Dues
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Pay weekly welfare dues or back active school infrastructure campaigns seamlessly using MTN/Airtel Mobile Money.
                  </p>
                </div>

                <div className="pt-4 md:pt-0 md:px-4 space-y-2 text-center md:text-left">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center mx-auto md:mx-0">
                    3
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-center md:justify-start gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" /> Impact & Relief
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Access emergency welfare grants in times of need and vote on solidarity resolutions transparently.
                  </p>
                </div>
              </motion.div>
            )}

            {/* 3. FEATURED BANNERS GALLERY PANEL */}
            {activeTab === 'banners' && banners.length > 0 && (
              <motion.div
                key="banners"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="relative w-full max-w-2xl mx-auto aspect-[16/9] rounded-2xl overflow-hidden bg-slate-900 border border-slate-700/60 shadow-lg"
              >
                <img
                  src={banners[currentSlide]}
                  alt={`Banner ${currentSlide + 1}`}
                  className="w-full h-full object-cover"
                />
                {banners.length > 1 && (
                  <>
                    <button
                      onClick={handlePrev}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-950/70 text-white flex items-center justify-center hover:bg-blue-600 transition-all cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleNext}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-950/70 text-white flex items-center justify-center hover:bg-blue-600 transition-all cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* BOTTOM ACTION BAR (STICKY/FOOTER AT BOTTOM OF VIEWPORT) */}
        <div className="border-t border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-[#0c1731] px-4 sm:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center sm:text-left">
            Stand with fellow alumni today. Join the Matuumu family.
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              to="/login"
              className="flex-1 sm:flex-initial text-center py-2.5 px-5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-full border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
            >
              Log In
            </Link>

            <Link
              to="/register"
              className="flex-1 sm:flex-initial text-center py-2.5 px-6 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-full shadow-md shadow-blue-500/25 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Create Account</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

      </div>

    </div>
  );
}
