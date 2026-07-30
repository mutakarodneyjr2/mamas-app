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
    <div className="md:hidden fixed bottom-4 left-4 right-4 z-40 pb-safe">
      <div className="bg-white/95 backdrop-blur-lg shadow-xl shadow-slate-900/10 rounded-3xl border border-slate-100 h-16 px-2 flex justify-around items-center">
        {links.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname.startsWith(to) && (to !== '/dashboard' || location.pathname === '/dashboard');
          
          return (
            <Link 
              key={to} 
              to={to} 
              className="relative flex flex-col items-center justify-center flex-1 h-full py-1"
            >
              {isActive && (
                <motion.div 
                  layoutId="activeGoldDot"
                  className="absolute top-1.5 w-1 h-1 bg-amber-500 rounded-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              
              <Icon 
                className={`w-6 h-6 transition-colors ${
                  isActive ? 'text-slate-900' : 'text-slate-400'
                }`} 
                strokeWidth={1.5} 
              />
              
              <span 
                className={`text-[10px] font-medium tracking-tight mt-0.5 transition-colors ${
                  isActive ? 'text-slate-900 font-bold' : 'text-slate-400'
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
