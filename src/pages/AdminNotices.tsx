import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Notice } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { Megaphone, Pin, Trash2, Shield } from 'lucide-react';

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
      const noticeId = uuidv4();
      const newNotice: Notice = {
        id: noticeId,
        title: title.trim(),
        body: body.trim(),
        postedBy: userProfile.fullName || currentUser.uid,
        isPinned,
        createdAt: Date.now()
      };
      
      await setDoc(doc(db, 'notices', noticeId), newNotice);
      
      setTitle('');
      setBody('');
      setIsPinned(false);
      setSuccessMsg("Notice posted successfully.");
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to post notice.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this notice?")) {
      setError(''); setSuccessMsg('');
      try {
        await deleteDoc(doc(db, 'notices', id));
        setSuccessMsg("Notice deleted.");
        setTimeout(() => setSuccessMsg(''), 3000);
      } catch (err) {
        setError('Failed to delete notice.');
        setTimeout(() => setError(''), 5000);
      }
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
    <div className="space-y-8 max-w-4xl mx-auto pb-10">
      <div>
        <h2 className="text-2xl font-display font-bold text-mamas-text flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-mamas-accent" /> Announcements
        </h2>
        <p className="text-mamas-text-muted text-sm mt-1">Broadcast messages to all association members.</p>
      </div>

      {successMsg && (
        <div className="bg-teal-50 border border-teal-200 text-teal-800 p-4 rounded-2xl text-sm font-medium animate-in fade-in">
          {successMsg}
        </div>
      )}

      <div className="bg-mamas-card rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 md:px-8 py-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-bold text-mamas-text">Post a New Notice</h3>
        </div>
        
        <div className="p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="bg-rose-50 text-rose-700 p-4 rounded-xl text-sm font-medium border border-rose-100">{error}</div>}
            
            <div>
              <label htmlFor="title" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Notice Title</label>
              <input
                type="text"
                id="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-mamas-accent focus:border-transparent transition-all outline-none font-medium"
                placeholder="e.g. End of Year General Meeting"
              />
            </div>

            <div>
              <label htmlFor="body" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Message Content</label>
              <textarea
                id="body"
                rows={4}
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-mamas-accent focus:border-transparent transition-all outline-none font-medium resize-y"
                placeholder="Details of the announcement..."
              />
            </div>
            
            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <label htmlFor="isPinned" className="font-semibold text-sm text-mamas-text cursor-pointer">Pin to top of Dashboard</label>
                <p className="text-xs text-slate-500 mt-0.5">Pinned notices remain visible at the top until unpinned.</p>
              </div>
              <div className="relative">
                <input type="checkbox" id="isPinned" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-mamas-accent"></div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto bg-mamas-primary hover:bg-mamas-primary-hover text-white font-semibold py-3 px-8 rounded-xl shadow-md transition-all focus:ring-2 focus:ring-offset-2 focus:ring-mamas-primary disabled:opacity-50"
              >
                {isSubmitting ? 'Posting...' : 'Post Notice'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-mamas-text">Recent Notices</h3>
        
        {loading ? (
          <div className="p-8 text-center text-slate-400 font-medium">Loading notices...</div>
        ) : notices.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 flex flex-col items-center justify-center text-center">
            <Megaphone className="w-12 h-12 text-slate-300 mb-4" />
            <p className="text-mamas-text font-bold">No announcements yet</p>
            <p className="text-sm text-slate-500 mt-1">Posted notices will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notices.map(notice => (
              <div key={notice.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                {notice.isPinned && (
                  <div className="absolute top-0 right-0">
                    <div className="w-16 h-16 bg-amber-500/10 rounded-bl-full flex items-start justify-end p-3">
                      <Pin className="w-4 h-4 text-amber-500" />
                    </div>
                  </div>
                )}
                
                <div className="pr-12">
                  <h4 className="text-lg font-bold text-mamas-text mb-1">{notice.title}</h4>
                  <p className="text-xs font-semibold text-mamas-accent tracking-wider uppercase mb-3">
                    By {notice.postedBy} <span className="text-slate-300 mx-1">|</span> <span className="text-slate-500">{new Date(notice.createdAt).toLocaleString()}</span>
                  </p>
                  <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">{notice.body}</p>
                </div>
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-end gap-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => togglePin(notice)}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-amber-600 bg-slate-50 hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Pin className="w-3.5 h-3.5" /> {notice.isPinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button 
                    onClick={() => handleDelete(notice.id)}
                    className="flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
