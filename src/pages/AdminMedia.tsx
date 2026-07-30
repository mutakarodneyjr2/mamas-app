import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Banner } from '../types';
import { createBanner, updateBanner, deleteBanner } from '../lib/bannerService';
import { uploadImage, deleteImage } from '../lib/storage';
import { Loader2, Image as ImageIcon, Trash2, Plus, ArrowUp, ArrowDown, Eye, EyeOff } from 'lucide-react';

export default function AdminMedia() {
  const { currentUser, userProfile } = useAuth();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'banners'), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));
      setBanners(data);
    }, (error) => {
      console.error("Error loading banners:", error);
      setError("Failed to load banners.");
    });
    return unsub;
  }, []);

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
      setError(err.message);
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
      // Extract path from download URL or just try to delete document
      // Let's rely on standard document deletion for now, to not break if storage URL format changes
      await deleteBanner(id);
      // Optional: Delete from storage if possible
      showMessage('Banner deleted');
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
    
    // Swap items
    const temp = newBanners[index];
    newBanners[index] = newBanners[swapIndex];
    newBanners[swapIndex] = temp;

    // Update orders
    try {
      await Promise.all(
        newBanners.map((banner, i) => updateBanner(banner.id, { order: i }))
      );
    } catch (err) {
      setError('Failed to reorder banners');
    }
  };

  if (userProfile?.role !== 'super_admin') {
    return <div className="p-8 text-center">Access Denied</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600">
          <ImageIcon className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-mamas-text">Media Manager</h1>
          <p className="text-mamas-text-muted mt-1">Manage homepage and landing page banners</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-sm font-medium">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-sm font-medium">
          {message}
        </div>
      )}

      <div className="bg-mamas-card rounded-3xl shadow-sm border border-slate-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-mamas-text">Banners</h2>
          
          <label className="relative cursor-pointer">
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileChange}
              disabled={uploading}
            />
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all ${uploading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {uploading ? 'Uploading...' : 'Upload Banner'}
            </div>
          </label>
        </div>

        <div className="space-y-4">
          {banners.length === 0 ? (
            <div className="text-center py-12 text-slate-500 border-2 border-dashed border-slate-200 rounded-2xl">
              <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No banners uploaded yet</p>
            </div>
          ) : (
            banners.map((banner, index) => (
              <div key={banner.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex flex-col gap-1">
                  <button 
                    onClick={() => moveBanner(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30 transition-colors"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => moveBanner(index, 'down')}
                    disabled={index === banners.length - 1}
                    className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30 transition-colors"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="w-48 h-24 rounded-xl overflow-hidden bg-slate-200 border border-slate-300 relative">
                  <img src={banner.url} alt="Banner" className="w-full h-full object-cover" />
                  {!banner.isActive && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white text-xs font-bold px-2 py-1 bg-black/50 rounded-md">Disabled</span>
                    </div>
                  )}
                </div>
                
                <div className="flex-1"></div>

                <div className="flex items-center gap-2 pr-2">
                  <button
                    onClick={() => toggleActive(banner.id, banner.isActive)}
                    className={`p-2 rounded-xl transition-colors ${banner.isActive ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-500 bg-slate-100 hover:bg-slate-200'}`}
                    title={banner.isActive ? "Disable Banner" : "Enable Banner"}
                  >
                    {banner.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleDelete(banner.id, banner.url)}
                    className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
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
