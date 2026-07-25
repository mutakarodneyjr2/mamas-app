import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogoLarge } from '../components/Logo';
import { Banner } from '../types';
import { getActiveBanners } from '../lib/bannerService';

export default function Landing() {
  const { currentUser } = useAuth();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentBannerIdx, setCurrentBannerIdx] = useState(0);

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

  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-mamas-bg flex flex-col">
      <header className="px-6 py-6 sm:px-12 flex justify-between items-center z-10 relative">
        <LogoLarge className="scale-75 origin-left" />
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-sm font-medium text-mamas-primary hover:text-mamas-primary-hover">Log In</Link>
          <Link to="/register" className="text-sm font-medium bg-mamas-accent text-mamas-primary px-5 py-2.5 rounded-full shadow hover:bg-mamas-accent-hover transition-colors">Join Us</Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full px-6 sm:px-12 items-center justify-between pb-12 gap-12">
        <div className="flex-1 max-w-xl text-center lg:text-left pt-12 lg:pt-0">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-mamas-primary leading-tight">
            Unity, Support,<br/>
            <span className="text-mamas-accent">Mutual Progress.</span>
          </h1>
          <p className="mt-6 text-lg text-mamas-text-muted leading-relaxed max-w-lg mx-auto lg:mx-0">
            Matuumu Alumni Mutual Aid Association brings together past students to support each other in times of joy and need, and to uplift our alma mater.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <Link to="/register" className="inline-flex justify-center items-center px-8 py-3 border border-transparent text-base font-medium rounded-full shadow-md text-white bg-mamas-primary hover:bg-mamas-primary-hover transition-colors">
              Become a Member
            </Link>
            <Link to="/login" className="inline-flex justify-center items-center px-8 py-3 border-2 border-mamas-primary text-base font-medium rounded-full text-mamas-primary hover:bg-slate-50 transition-colors">
              Member Login
            </Link>
          </div>
        </div>

        <div className="flex-1 w-full relative">
          <div className="aspect-w-4 aspect-h-3 sm:aspect-w-16 sm:aspect-h-9 lg:aspect-w-4 lg:aspect-h-5 rounded-2xl overflow-hidden shadow-2xl relative bg-slate-200">
            {banners.length > 0 ? (
              banners.map((banner, idx) => (
                <img 
                  key={banner.id}
                  src={banner.url} 
                  alt="MAMAS Community" 
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${idx === currentBannerIdx ? 'opacity-100' : 'opacity-0'}`}
                />
              ))
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-mamas-primary/10">
                <p className="text-mamas-primary/40 font-medium">Community Images</p>
              </div>
            )}
          </div>
        </div>
      </main>
      
      <footer className="w-full text-center py-6 text-sm text-mamas-text-muted mt-auto">
        <div className="flex items-center justify-center gap-4">
          <Link to="/terms" className="hover:text-mamas-primary transition-colors">Terms of Service</Link>
          <span>&middot;</span>
          <Link to="/privacy" className="hover:text-mamas-primary transition-colors">Privacy Policy</Link>
        </div>
        <p className="mt-2 text-xs">&copy; {new Date().getFullYear()} Matuumu Alumni Mutual Aid Association.</p>
      </footer>
    </div>
  );
}
