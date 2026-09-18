import React, { useState, useEffect, useRef } from 'react';
import { getActiveBanners } from '../lib/bannerService';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRegisterModal } from '../lib/nativeBack';
import { motion, AnimatePresence } from 'motion/react';

const AD_TIMEOUT_SECONDS = 15;

export function AdBannerModal() {
  const [bannerUrls, setBannerUrls] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(AD_TIMEOUT_SECONDS);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if user already closed ad during this browser session
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
          setTimeLeft(AD_TIMEOUT_SECONDS);
        }
      })
      .catch(err => {
        console.warn('Could not load ad banners:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 15-second countdown timer
  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setTimeLeft(AD_TIMEOUT_SECONDS);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen]);

  const handleClose = () => {
    if (timerRef.current) clearInterval(timerRef.current);
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
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md cursor-pointer select-none"
          onClick={handleClose}
        >
          {/* Frameless Floating Image Container (NO Card, NO Frame, NO Enclosure, Plain Image with X button & 15s Timer) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.2 }}
            className="relative max-w-2xl max-h-[85vh] flex items-center justify-center cursor-default"
            onClick={e => e.stopPropagation()}
          >
            {/* Floating Top-Right Dismissal Button with 15s Countdown */}
            <button
              type="button"
              onClick={handleClose}
              className="absolute -top-3.5 -right-3.5 sm:-top-4 sm:-right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/85 hover:bg-rose-600 text-white border border-white/30 backdrop-blur-md shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer group"
              title="Close Ad"
            >
              {/* Countdown badge */}
              <span className="text-xs font-mono font-bold text-amber-400 group-hover:text-white transition-colors">
                {timeLeft}s
              </span>
              <span className="w-px h-3 bg-white/30" />
              {/* X icon */}
              <X className="w-4 h-4 text-white" />
            </button>

            {/* Plain Banner Image (Zero card wrapping / zero border frames) */}
            <div className="relative overflow-hidden rounded-2xl shadow-2xl">
              <img
                src={currentUrl}
                alt="Ad Announcement Banner"
                className="max-w-full max-h-[80vh] sm:max-h-[85vh] w-auto h-auto object-contain block"
                referrerPolicy="no-referrer"
              />

              {/* Multi-banner Navigation Controls (subtle overlay on image only if multiple) */}
              {bannerUrls.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs border border-white/20 hover:scale-110 active:scale-95"
                    aria-label="Previous banner"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs border border-white/20 hover:scale-110 active:scale-95"
                    aria-label="Next banner"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>

                  {/* Dot Indicators */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                    {bannerUrls.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentIndex(idx)}
                        className={`h-1.5 rounded-full transition-all cursor-pointer ${
                          idx === currentIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/40'
                        }`}
                        aria-label={`Go to slide ${idx + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
