import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Banner } from '../types';
import { createBanner, updateBanner, deleteBanner } from '../lib/bannerService';
import { uploadImage, deleteImage } from '../lib/storage';
import { Loader2, Image as ImageIcon, Trash2, Plus, ArrowUp, ArrowDown, Eye, EyeOff, ShieldAlert, CheckCircle, AlertCircle } from 'lucide-react';

export default function AdminMedia() {
  const { currentUser, userProfile } = useAuth();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (jpg, png, webp)');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const path = `banners/${Date.now()}_${file.name}`;
      const url = await uploadImage(file, path);
      
      await createBanner({
        url,
        isActive: true,
        order: banners.length,
        createdAt: Date.now()
      });
      showMessage('Banner uploaded successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await updateBanner(id, { isActive: !currentStatus });
    } catch (err: any) {
      setError('Failed to update banner status');
    }
  };

  const handleDelete = async (id: string, url: string) => {
    if (!window.confirm('Are you sure you want to delete this banner?')) return;
    try {
      await deleteBanner(id);
      showMessage('Banner deleted successfully');
    } catch (err: any) {
      setError('Failed to delete banner');
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
    } catch (err) {
      setError('Failed to reorder banners');
    }
  };

  const canManageMedia = ['super_admin', 'chairperson', 'vice_chairperson', 'publicity_secretary'].includes(userProfile?.role || '');

  if (!canManageMedia) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white dark:bg-[#0c1731] rounded-3xl border border-slate-200/80 dark:border-slate-800 text-center shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3 border border-rose-200 dark:border-rose-900/60">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">Access Restricted</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Media and homepage banner management requires administrative permissions.</p>
      </div>
    );
  }

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
              Curate homepage carousel graphics and visual banners ({banners.length} total)
            </p>
          </div>
        </div>

        <label className="relative cursor-pointer shrink-0">
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handleFileChange}
            disabled={uploading}
          />
          <div className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-extrabold uppercase tracking-wider text-white transition-all shadow-xs active:scale-95 cursor-pointer ${
            uploading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {uploading ? 'Uploading...' : 'Upload Banner'}
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

      {/* Main List */}
      <div className="bg-white dark:bg-[#0c1731] rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Active Carousel Sliders</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Drag or use controls to adjust slide ordering</p>
          </div>
          <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/60 px-3 py-1 rounded-full">
            {banners.filter(b => b.isActive).length} Active
          </span>
        </div>

        <div className="space-y-3.5">
          {banners.length === 0 ? (
            <div className="text-center py-16 text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/30">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <ImageIcon className="w-6 h-6 opacity-40" />
              </div>
              <p className="font-extrabold text-sm text-slate-900 dark:text-white">No banners uploaded yet</p>
              <p className="text-xs text-slate-400 mt-1">Click "Upload Banner" to select a high-resolution hero photo.</p>
            </div>
          ) : (
            banners.map((banner, index) => (
              <div 
                key={banner.id} 
                className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-3xl border border-slate-200/70 dark:border-slate-800 hover:border-blue-500/30 transition-all shadow-xs"
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
                    onClick={() => handleDelete(banner.id, banner.url)}
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
    </div>
  );
}
