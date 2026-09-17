import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  X, User, Users, Trophy, Target, ShieldCheck, 
  Shield, TrendingUp, ArrowUpRight, HelpCircle, LogOut, HeartHandshake,
  FileText, Wallet, Home
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from './Logo';
import { motion, AnimatePresence } from 'motion/react';

interface LeftDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LeftDrawer({ isOpen, onClose }: LeftDrawerProps) {
  const { userProfile, logout } = useAuth();
  const location = useLocation();

  if (!isOpen) return null;

  const role = userProfile?.role || 'member';
  const isExecutive = ['super_admin', 'chairperson', 'vice_chairperson', 'treasurer', 'secretary', 'auditor', 'mobiliser'].includes(role);
  const canSeeMoneyOut = ['super_admin', 'chairperson', 'vice_chairperson', 'treasurer', 'secretary'].includes(role);
  const canSeeExpenses = ['super_admin', 'chairperson', 'vice_chairperson', 'treasurer', 'secretary', 'auditor'].includes(role);

  const handleLogout = async () => {
    onClose();
    await logout();
  };

  const navLinkClass = (path: string) => {
    const isActive = location.pathname === path || (path !== '/' && path !== '/dashboard' && location.pathname.startsWith(path));
    return `flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
      isActive 
        ? 'bg-blue-600 text-white font-semibold shadow-xs' 
        : 'text-slate-300 hover:bg-white/10 hover:text-white'
    }`;
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
          onClick={onClose}
        />

        {/* Drawer Content - Deep Navy Weight */}
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-xs sm:max-w-sm bg-[#060c1a] text-slate-100 h-full border-r border-slate-800 flex flex-col z-10 overflow-hidden"
        >
          {/* Header Zone (Navy) */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-[#0a142c]">
            <div className="flex items-center gap-2.5">
              <Logo dark />
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Mini Identity (Integrated, no border box) */}
          {userProfile && (
            <div className="p-4 bg-[#0a142c]/50 border-b border-slate-800/60">
              <Link 
                to="/profile" 
                onClick={onClose}
                className="flex items-center gap-3 group"
              >
                {userProfile.profilePictureUrl ? (
                  <img 
                    src={userProfile.profilePictureUrl} 
                    alt={userProfile.fullName} 
                    className="w-10 h-10 rounded-xl object-cover border border-slate-800 shrink-0" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-blue-900/60 text-blue-200 font-extrabold text-sm flex items-center justify-center border border-blue-800 shrink-0">
                    {userProfile.fullName ? userProfile.fullName.slice(0, 2).toUpperCase() : 'AM'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors">
                    {userProfile.fullName || 'Member'}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] font-bold bg-blue-950 text-blue-400 border border-blue-800 px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                      {userProfile.role?.replace('_', ' ') || 'Member'}
                    </span>
                    {userProfile.yearLeftSchool && (
                      <span className="text-[10px] text-slate-400 font-medium">
                        Class of {userProfile.yearLeftSchool}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* Scrollable Navigation List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {userProfile?.status === 'pending' ? (
              <>
                {/* Basic Status Indicator */}
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Shield className="w-4 h-4 text-amber-500 animate-pulse" />
                    <span className="text-xs font-extrabold uppercase tracking-wider">Account Status</span>
                  </div>
                  <p className="text-[11px] font-medium leading-relaxed">
                    Your registration is currently under review by the Executive Committee. Once verified, all alumni features will be fully unlocked.
                  </p>
                </div>

                {/* Restricted Support Link */}
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 px-3 mb-2">
                    Support
                  </div>
                  <div className="space-y-1">
                    <Link to="/help" onClick={onClose} className={navLinkClass('/help')}>
                      <HelpCircle className="w-4 h-4" />
                      <span>Help & Guide</span>
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Primary Member Navigation */}
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 px-3 mb-2">
                    Main Navigation
                  </div>
                  <div className="space-y-1">
                    <Link to="/dashboard" onClick={onClose} className={navLinkClass('/dashboard')}>
                      <Home className="w-4 h-4" />
                      <span>Home Feed</span>
                    </Link>
                    <Link to="/profile" onClick={onClose} className={navLinkClass('/profile')}>
                      <User className="w-4 h-4" />
                      <span>My Profile</span>
                    </Link>
                    <Link to="/directory" onClick={onClose} className={navLinkClass('/directory')}>
                      <Users className="w-4 h-4" />
                      <span>Alumni Directory</span>
                    </Link>
                    <Link to="/top-contributors" onClick={onClose} className={navLinkClass('/top-contributors')}>
                      <Trophy className="w-4 h-4" />
                      <span>Top Contributors</span>
                    </Link>
                    <Link to="/statement" onClick={onClose} className={navLinkClass('/statement')}>
                      <FileText className="w-4 h-4" />
                      <span>Financial Statement</span>
                    </Link>
                  </div>
                </div>

                {/* Quick Summary Links */}
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 px-3 mb-2">
                    Community & Projects
                  </div>
                  <div className="space-y-1">
                    <Link to="/campaigns" onClick={onClose} className={navLinkClass('/campaigns')}>
                      <Target className="w-4 h-4" />
                      <span>Active Projects</span>
                    </Link>
                    <Link to="/welfare" onClick={onClose} className={navLinkClass('/welfare')}>
                      <HeartHandshake className="w-4 h-4" />
                      <span>Welfare & Solidarity</span>
                    </Link>
                    <Link to="/contribute" onClick={onClose} className={navLinkClass('/contribute')}>
                      <Wallet className="w-4 h-4" />
                      <span>Pay Dues & Support</span>
                    </Link>
                  </div>
                </div>

                {/* Governance / Admin Portal Section */}
                {isExecutive && (
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-blue-400 px-3 mb-2 flex items-center gap-1.5">
                      <Shield className="w-3 h-3" />
                      <span>Executive Governance</span>
                    </div>
                    <div className="space-y-1">
                      <Link to="/admin" onClick={onClose} className={navLinkClass('/admin')}>
                        <Shield className="w-4 h-4" />
                        <span>Governance Portal</span>
                      </Link>
                      {canSeeExpenses && (
                        <Link to="/expenses" onClick={onClose} className={navLinkClass('/expenses')}>
                          <TrendingUp className="w-4 h-4" />
                          <span>Requisitions & Approvals</span>
                        </Link>
                      )}
                      {canSeeMoneyOut && (
                        <Link to="/money-out" onClick={onClose} className={navLinkClass('/money-out')}>
                          <ArrowUpRight className="w-4 h-4" />
                          <span>Money Out Disburse</span>
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                {/* Support / Help */}
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 px-3 mb-2">
                    Support
                  </div>
                  <div className="space-y-1">
                    <Link to="/help" onClick={onClose} className={navLinkClass('/help')}>
                      <HelpCircle className="w-4 h-4" />
                      <span>Help & Guide</span>
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Bottom Logout Area (Full-Width Row, Muted Border, No Inner Card) */}
          <div className="p-4 border-t border-slate-800 bg-[#040a17]">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
