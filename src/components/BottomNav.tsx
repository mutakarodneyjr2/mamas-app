import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Wallet, Heart, FileText, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';

export function BottomNav() {
  const location = useLocation();
  const { userProfile } = useAuth();
  
  if (!userProfile || userProfile.status !== 'approved') return null;

  const links = [
    { to: '/dashboard', icon: Home, label: 'Home' },
    { to: '/contribute', icon: Wallet, label: 'Pay' },
    { to: '/welfare', icon: Heart, label: 'Welfare' },
    { to: '/statement', icon: FileText, label: 'Statement' },
    { to: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="md:hidden fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-4 right-4 z-40">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-blue-950/15 dark:shadow-black/50 rounded-3xl border border-slate-200/80 dark:border-slate-800 h-16 px-2 flex justify-around items-center">
        {links.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname.startsWith(to) && (to !== '/dashboard' || location.pathname === '/dashboard');
          
          return (
            <Link 
              key={to} 
              to={to} 
              className="relative flex flex-col items-center justify-center flex-1 h-full py-1 group"
            >
              {isActive && (
                <motion.div 
                  layoutId="activeNavDot"
                  className="absolute top-1.5 w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full shadow-sm shadow-blue-500/50"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              
              <Icon 
                className={`w-5 h-5 transition-colors ${
                  isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                }`} 
                strokeWidth={isActive ? 2.2 : 1.75} 
              />
              
              <span 
                className={`text-[10px] font-semibold tracking-tight mt-1 transition-colors ${
                  isActive ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
