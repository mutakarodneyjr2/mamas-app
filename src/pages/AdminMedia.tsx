import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Banner } from '../types';
import { createBanner, updateBanner, deleteBanner } from '../lib/bannerService';
import { uploadImage } from '../lib/storage';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { 
  Loader2, Image as ImageIcon, Trash2, Plus, ArrowUp, ArrowDown, 
  Eye, EyeOff, ShieldAlert, CheckCircle, AlertCircle, X, ChevronLeft, 
  ChevronRight, Play, Pause, AlertTriangle 
} from 'lucide-react';

export default function AdminMedia() {
  const { currentUser, userProfile } = useAuth();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  // Pending upload states
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Auto-slide active carousel preview states
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isAutoplay, setIsAutoplay] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [bannerToDelete, setBannerToDelete] = useState<string | null>(null);

  if (userProfile?.role !== 'super_admin') {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-[#0c1731] rounded-3xl border border-slate-200/80 dark:border-slate-800 my-6 shadow-xs">
        <ShieldAlert className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Super Admin Access Required</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
          Media banner graphics and visual advert management is strictly restricted to the Super Admin role.
        </p>
      </div>
    );
  }

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'landingBanners'), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));
      setBanners(data);
    }, (err) => {
      console.error("Error loading banners:", err);
      setError("Failed to load banners.");
    });
    return unsub;
  }, [currentUser]);

  // Autoplay slider interval
  useEffect(() => {
    const activeBanners = banners.filter(b => b.isActive);
    if (activeBanners.length <= 1 || !isAutoplay) return;

    const interval = setInterval(() => {
      setActiveSlideIndex(prev => (prev + 1) % activeBanners.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [banners, isAutoplay]);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (jpg, png, webp)');
      return;
    }

    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError('');
  };

  const cancelPendingUpload = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPendingFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmUpload = async () => {
    if (!pendingFile) return;

    setUploading(true);
    setError('');
    try {
      const path = `banners/${Date.now()}_${pendingFile.name}`;
      const url = await uploadImage(pendingFile, path);
      
      await createBanner({
        url,
        isActive: true,
        order: banners.length,
        createdAt: Date.now()
      });
      
      showMessage('Banner uploaded successfully');
      cancelPendingUpload();
    } catch (err: any) {
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await updateBanner(id, { isActive: !currentStatus });
      showMessage(`Banner successfully ${!currentStatus ? 'activated' : 'hidden'}`);
    } catch (err: any) {
      setError('Failed to update banner status');
    }
  };

  const confirmDelete = (id: string) => {
    setBannerToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!bannerToDelete) return;
    try {
      await deleteBanner(bannerToDelete);
      showMessage('Banner deleted successfully');
      // Reset active slide index in case it goes out of bounds
      setActiveSlideIndex(0);
    } catch (err: any) {
      setError('Failed to delete banner');
    } finally {
      setDeleteModalOpen(false);
      setBannerToDelete(null);
    }
  };

  const moveBanner = async (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) || 
      (direction === 'down' && index === banners.length - 1)
    ) return;

    const newBanners = [...banners];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    const temp = newBanners[index];
    newBanners[index] = newBanners[swapIndex];
    newBanners[swapIndex] = temp;

    try {
      await Promise.all(
        newBanners.map((banner, i) => updateBanner(banner.id, { order: i }))
      );
      showMessage('Banners reordered successfully');
    } catch (err) {
      setError('Failed to reorder banners');
    }
  };

  const activeBanners = banners.filter(b => b.isActive);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 px-4 font-sans">
      
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#0c1731] rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/50 dark:border-blue-900/60">
            <ImageIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 text-[10px] font-extrabold uppercase tracking-wider rounded-full px-2.5 py-0.5 border border-blue-200 dark:border-blue-900/60">
                Visual Assets
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Media & Hero Banners
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Curate homepage carousel graphics and popup advertisements ({banners.length} total)
            </p>
          </div>
        </div>

        <label className="relative cursor-pointer shrink-0">
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handleFileSelect}
            ref={fileInputRef}
            disabled={uploading}
          />
          <div className="flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-extrabold uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-xs active:scale-95 cursor-pointer">
            <Plus className="w-4 h-4" />
            <span>Select Image File</span>
          </div>
        </label>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      {message && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 shadow-xs animate-in fade-in">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Pre-upload Interactive Preview Overlay */}
      {previewUrl && pendingFile && (
        <div className="bg-amber-500/5 dark:bg-amber-500/5 rounded-3xl p-6 border-2 border-dashed border-amber-400/60 dark:border-amber-500/40 space-y-4 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Confirm New Banner Asset</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Review image layout before uploading to Cloud Storage.</p>
              </div>
            </div>
            <button 
              onClick={cancelPendingUpload}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-500 hover:text-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all cursor-pointer"
              title="Cancel Upload"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="aspect-video max-h-80 w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 relative flex items-center justify-center">
            <img 
              src={previewUrl} 
              alt="Pre-upload Visual Check" 
              className="h-full w-full object-contain"
            />
            {uploading && (
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md flex flex-col items-center justify-center gap-3 text-white">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="text-xs font-bold uppercase tracking-widest">Uploading to Cloud...</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              onClick={cancelPendingUpload}
              disabled={uploading}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmUpload}
              disabled={uploading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              <span>Upload & Publish</span>
            </button>
          </div>
        </div>
      )}

      {/* Auto-sliding Real-time Preview Slider */}
      {activeBanners.length > 0 && (
        <div className="bg-white dark:bg-[#0c1731] rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Live Carousel Simulator</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">See how they slide automatically on home & login screens.</p>
            </div>
            <button
              onClick={() => setIsAutoplay(!isAutoplay)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[10px] font-extrabold uppercase tracking-wider transition-colors cursor-pointer text-slate-700 dark:text-slate-200"
            >
              {isAutoplay ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-blue-500" />
                  <span>Autoplay ON</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-slate-400" />
                  <span>Autoplay OFF</span>
                </>
              )}
            </button>
          </div>

          <div className="relative aspect-video max-h-72 w-full bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-800 group">
            <img 
              src={activeBanners[activeSlideIndex]?.url} 
              alt="Live Carousel Preview" 
              className="h-full w-full object-contain transition-all duration-500 ease-in-out"
            />
            
            {activeBanners.length > 1 && (
              <>
                <button
                  onClick={() => setActiveSlideIndex(prev => (prev - 1 + activeBanners.length) % activeBanners.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-blue-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActiveSlideIndex(prev => (prev + 1) % activeBanners.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-blue-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Dot Indicators */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 px-2.5 py-1 bg-black/40 rounded-full backdrop-blur-xs">
                  {activeBanners.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveSlideIndex(idx)}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        idx === activeSlideIndex ? 'w-4 bg-blue-500' : 'w-1.5 bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main List */}
      <div className="bg-white dark:bg-[#0c1731] rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">All Custom Carousel Slides</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Toggle status, delete, or rearrange priority slide ordering</p>
          </div>
          <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/60 px-3 py-1 rounded-full">
            {activeBanners.length} Active / {banners.length} Total
          </span>
        </div>

        <div className="space-y-3.5">
          {banners.length === 0 ? (
            <div className="text-center py-16 text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/30">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <ImageIcon className="w-6 h-6 opacity-40" />
              </div>
              <p className="font-extrabold text-sm text-slate-900 dark:text-white">No banners uploaded yet</p>
              <p className="text-xs text-slate-400 mt-1">Select an image file above to review and upload a custom banner graphic.</p>
            </div>
          ) : (
            banners.map((banner, index) => (
              <div 
                key={banner.id} 
                className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-3xl border border-slate-200/70 dark:border-slate-800 hover:border-blue-500/30 transition-all shadow-xs animate-in fade-in"
              >
                {/* Reorder Buttons */}
                <div className="flex sm:flex-col gap-1.5 self-start sm:self-center">
                  <button 
                    onClick={() => moveBanner(index, 'up')}
                    disabled={index === 0}
                    className="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-600 disabled:opacity-30 transition-colors cursor-pointer shadow-xs"
                    title="Move slide up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => moveBanner(index, 'down')}
                    disabled={index === banners.length - 1}
                    className="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-600 disabled:opacity-30 transition-colors cursor-pointer shadow-xs"
                    title="Move slide down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Image Preview */}
                <div className="w-full sm:w-56 h-28 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 relative shrink-0">
                  <img src={banner.url} alt="Banner Preview" className="w-full h-full object-cover" />
                  {!banner.isActive && (
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center">
                      <span className="text-white text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 bg-black/60 rounded-full border border-white/20">
                        Hidden
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Meta details */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    Slide #{index + 1}
                  </p>
                  <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                    {banner.url}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                      banner.isActive 
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                    }`}>
                      {banner.isActive ? 'Active on Home' : 'Disabled'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => toggleActive(banner.id, banner.isActive)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-extrabold transition-colors cursor-pointer border ${
                      banner.isActive 
                        ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 border-emerald-200 dark:border-emerald-900/60' 
                        : 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border-slate-200 dark:border-slate-700'
                    }`}
                    title={banner.isActive ? "Hide Banner" : "Show Banner"}
                  >
                    {banner.isActive ? (
                      <>
                        <Eye className="w-4 h-4" />
                        <span>Visible</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-4 h-4" />
                        <span>Hidden</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => confirmDelete(banner.id)}
                    className="p-2.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-2xl border border-rose-200/60 dark:border-rose-900/50 transition-colors cursor-pointer"
                    title="Delete Banner"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={deleteModalOpen}
        title="Delete Banner"
        message="Are you sure you want to permanently delete this banner? This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteModalOpen(false)}
        isDanger={true}
      />
    </div>
  );
}
