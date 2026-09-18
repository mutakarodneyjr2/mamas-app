import React, { useState, useEffect } from 'react';
import { getActiveBanners } from '../lib/bannerService';
import { X, ChevronLeft, ChevronRight, Megaphone } from 'lucide-react';
import { useRegisterModal } from '../lib/nativeBack';

export function AdBannerModal() {
  const [bannerUrls, setBannerUrls] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if user already closed ad during this session
    const isDismissed = sessionStorage.getItem('mamas_ad_modal_dismissed');
    if (isDismissed) return;

    let isMounted = true;
    getActiveBanners()
      .then(banners => {
        if (!isMounted) return;
        const urls = banners.map(b => b.url).filter(Boolean);
        if (urls.length > 0) {
          setBannerUrls(urls);
          setIsOpen(true);
        }
      })
      .catch(err => {
        console.warn('Could not load ad banners:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleClose = () => {
    sessionStorage.setItem('mamas_ad_modal_dismissed', 'true');
    setIsOpen(false);
  };

  useRegisterModal(isOpen, handleClose, 'ad-banner-modal');

  if (!isOpen || bannerUrls.length === 0) return null;

  const currentUrl = bannerUrls[currentIndex];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev - 1 + bannerUrls.length) % bannerUrls.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev + 1) % bannerUrls.length);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-white dark:bg-[#0c1731] rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 dark:border-slate-800 animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200/60 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <Megaphone className="w-4 h-4" />
            </span>
            <span className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Official Announcement
            </span>
          </div>

          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-600 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer"
            title="Close Ad (X)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Banner Display Area */}
        <div className="relative bg-slate-950 aspect-video flex items-center justify-center overflow-hidden group">
          <img
            src={currentUrl}
            alt="Official Banner Announcement"
            className="w-full h-full object-contain"
            referrerPolicy="no-referrer"
          />

          {/* Controls if multiple banners */}
          {bannerUrls.length > 1 && (
            <>
              <button
                onClick={handlePrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-900/70 hover:bg-blue-600 text-white flex items-center justify-center transition-all cursor-pointer opacity-90 hover:scale-110"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-900/70 hover:bg-blue-600 text-white flex items-center justify-center transition-all cursor-pointer opacity-90 hover:scale-110"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Slide Indicators */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-slate-900/60 backdrop-blur-md px-3 py-1 rounded-full">
                {bannerUrls.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      idx === currentIndex ? 'w-5 bg-blue-500' : 'w-1.5 bg-white/40'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer Bar */}
        <div className="px-5 py-3.5 flex items-center justify-between bg-slate-50 dark:bg-[#0c1731] border-t border-slate-200/60 dark:border-slate-800">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Matuumu Alumni Association Official Broadcast
          </span>
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" /> Close
          </button>
        </div>
      </div>
    </div>
  );
}
