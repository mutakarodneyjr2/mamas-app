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
    <div className="md:hidden fixed bottom-6 left-4 right-4 z-50 pb-safe">
      <div className="bg-white/90 backdrop-blur-xl shadow-2xl shadow-gray-200/50 rounded-full border border-white/50 h-16 px-4 flex justify-between items-center">
        {links.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname.startsWith(to) && (to !== '/dashboard' || location.pathname === '/dashboard');
          
          return (
            <Link 
              key={to} 
              to={to} 
              className="relative flex flex-col items-center justify-center w-14 h-full"
            >
              <motion.div
                whileTap={{ scale: 0.9 }}
                animate={{ scale: isActive ? 1 : 1 }}
                className={`flex flex-col items-center justify-center transition-colors ${
                  isActive ? 'text-mamas-primary' : 'text-gray-400'
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="navIndicator"
                    className="absolute -top-1 w-1 h-1 bg-mamas-accent rounded-full"
                  />
                )}
                
                <Icon className="w-5 h-5 mb-1" strokeWidth={1.5} />
                
                {isActive && (
                  <motion.span 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[10px] font-semibold tracking-wide"
                  >
                    {label}
                  </motion.span>
                )}
              </motion.div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
