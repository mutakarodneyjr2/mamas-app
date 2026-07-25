import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Wallet, Heart, FileText, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-mamas-card border-t border-slate-200 dark:border-slate-800 px-4 py-2 flex justify-between items-center z-20 pb-safe shadow-lg">
      {links.map(({ to, icon: Icon, label }) => {
        const isActive = location.pathname.startsWith(to) && (to !== '/dashboard' || location.pathname === '/dashboard');
        return (
          <Link 
            key={to} 
            to={to} 
            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${isActive ? 'text-mamas-primary dark:text-mamas-accent font-bold' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            <Icon className={`w-6 h-6 mb-1 ${isActive ? 'stroke-2' : 'stroke-[1.5]'}`} />
            <span className="text-[10px] font-medium tracking-wide">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
