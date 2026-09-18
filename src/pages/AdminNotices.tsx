import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Notice } from '../types';
import { Megaphone, Pin, Trash2, Shield, Check } from 'lucide-react';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { postNotice } from '../lib/services';

export default function AdminNotices() {
  const { currentUser, userProfile } = useAuth();
  const canPost = ["super_admin", "chairperson", "vice_chairperson", "secretary"].includes(userProfile?.role || "");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [noticeToDelete, setNoticeToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotices(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notice)));
      setLoading(false);
    }, (error) => {
      console.error("Error loading notices:", error);
      setError("Failed to load notices.");
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) return;
    if (!title.trim() || !body.trim()) {
      setError("Title and body are required.");
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      await postNotice(currentUser.uid, {
        title: title.trim(),
        body: body.trim(),
        isPinned,
        authorName: userProfile.fullName || 'Executive Committee'
      });
      
      setTitle('');
      setBody('');
      setIsPinned(false);
      setSuccessMsg("Notice published and broadcast notification sent to all approved members.");
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to post notice.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = (id: string) => {
    setNoticeToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!noticeToDelete) return;
    setError(''); setSuccessMsg('');
    try {
      await deleteDoc(doc(db, 'notices', noticeToDelete));
      setSuccessMsg("Notice deleted.");
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError('Failed to delete notice.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setDeleteModalOpen(false);
      setNoticeToDelete(null);
    }
  };

  const togglePin = async (notice: Notice) => {
    setError(''); setSuccessMsg('');
    try {
      await setDoc(doc(db, 'notices', notice.id), { ...notice, isPinned: !notice.isPinned });
      setSuccessMsg(notice.isPinned ? "Notice unpinned." : "Notice pinned.");
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError('Failed to update notice.');
      setTimeout(() => setError(''), 5000);
    }
  };

  if (!currentUser || !userProfile) return null;

  const allowedRoles = ['super_admin', 'chairperson', 'vice_chairperson', 'secretary'];
  if (!allowedRoles.includes(userProfile.role)) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Shield className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-mamas-text">Access Denied</h2>
        <p className="text-mamas-text-muted mt-2">Only authorized executive roles can post notices.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16 px-4 font-sans">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 text-[10px] font-extrabold uppercase tracking-wider rounded-full px-2.5 py-0.5 border border-blue-200 dark:border-blue-900/60">
            Official Communications
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-blue-600 dark:text-blue-400" /> Announcements & Bulletins
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5">Broadcast formal messages to all association members.</p>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 p-4 rounded-2xl text-xs sm:text-sm font-semibold animate-in fade-in shadow-xs">
          {successMsg}
        </div>
      )}

      <div className="bg-white dark:bg-[#0c1731] rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        <div className="px-6 md:px-8 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Compose Official Notice</h3>
        </div>
        
        <div className="p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 p-4 rounded-2xl text-xs sm:text-sm font-semibold border border-rose-200 dark:border-rose-900/50">{error}</div>}
            
            <div>
              <label htmlFor="title" className="block text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Notice Title</label>
              <input
                type="text"
                id="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition-all outline-none font-medium placeholder:text-slate-400"
                placeholder="e.g. End of Year General Meeting"
              />
            </div>

            <div>
              <label htmlFor="body" className="block text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Message Content</label>
              <textarea
                id="body"
                rows={4}
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition-all outline-none font-medium resize-y placeholder:text-slate-400"
                placeholder="Details of the announcement..."
              />
            </div>
            
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div>
                <label htmlFor="isPinned" className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white cursor-pointer">Pin to top of Dashboard</label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Pinned notices remain prominent at the top until unpinned.</p>
              </div>
              <div className="relative">
                <input type="checkbox" id="isPinned" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} className="sr-only peer cursor-pointer" />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 cursor-pointer"></div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3.5 px-8 rounded-2xl shadow-xs transition-all focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-xs uppercase tracking-wider cursor-pointer active:scale-95"
              >
                {isSubmitting ? 'Posting...' : 'Publish Announcement'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Recent Notices ({notices.length})</h3>
        
        {loading ? (
          <div className="p-8 text-center text-slate-400 font-medium">Loading notices...</div>
        ) : notices.length === 0 ? (
          <div className="bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-12 flex flex-col items-center justify-center text-center">
            <Megaphone className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-slate-900 dark:text-white font-extrabold text-sm">No announcements yet</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Published bulletins will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notices.map(notice => (
              <div key={notice.id} className="bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs hover:border-blue-500/40 transition-all relative overflow-hidden group">
                {notice.isPinned && (
                  <div className="absolute top-0 right-0">
                    <div className="w-14 h-14 bg-amber-500/10 dark:bg-amber-500/20 rounded-bl-3xl flex items-start justify-end p-2.5">
                      <Pin className="w-4 h-4 text-amber-500" />
                    </div>
                  </div>
                )}
                
                <div className="pr-10">
                  <h4 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white mb-1.5">{notice.title}</h4>
                  <p className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 tracking-wider uppercase mb-3 flex items-center gap-1.5 flex-wrap">
                    <span>By {notice.postedBy}</span>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <span className="text-slate-500 dark:text-slate-400">{new Date(notice.createdAt).toLocaleString()}</span>
                  </p>
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap text-xs sm:text-sm leading-relaxed">{notice.body}</p>
                </div>
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                  <button 
                    onClick={() => togglePin(notice)}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 bg-slate-50 dark:bg-slate-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-slate-200/60 dark:border-slate-700 px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
                  >
                    <Pin className="w-3.5 h-3.5" /> {notice.isPinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button 
                    onClick={() => confirmDelete(notice.id)}
                    className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200/60 dark:border-rose-900/50 px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={deleteModalOpen}
        title="Delete Notice"
        message="Are you sure you want to delete this notice? This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteModalOpen(false)}
        isDanger={true}
      />
    </div>
  );
}
