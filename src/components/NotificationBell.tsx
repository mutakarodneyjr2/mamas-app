import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { NotificationItem } from '../types';
import { markNotificationAsRead, markAllNotificationsAsRead } from '../lib/fcmService';
import { 
  Bell, 
  CheckCircle2, 
  Heart, 
  Megaphone, 
  Target, 
  UserCheck, 
  X, 
  CheckCheck
} from 'lucide-react';

export const NotificationBell: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUser) return;

    // Listen to personal notifications and broadcast notifications
    const qPersonal = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid)
    );

    const qBroadcast = query(
      collection(db, 'notifications'),
      where('userId', '==', 'ALL_APPROVED')
    );

    let personalItems: NotificationItem[] = [];
    let broadcastItems: NotificationItem[] = [];

    const updateCombined = () => {
      const combined = [...personalItems, ...broadcastItems];
      // Deduplicate by ID
      const map = new Map<string, NotificationItem>();
      combined.forEach(item => map.set(item.id, item));
      const sorted = Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
      setNotifications(sorted);
    };

    const unsubPersonal = onSnapshot(qPersonal, (snapshot) => {
      personalItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NotificationItem));
      updateCombined();
    }, (err) => { if (err.code !== 'permission-denied') console.error("Error listening to personal notifications:", err); });

    const unsubBroadcast = onSnapshot(qBroadcast, (snapshot) => {
      broadcastItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NotificationItem));
      updateCombined();
    }, (err) => { if (err.code !== 'permission-denied') console.error("Error listening to broadcast notifications:", err); });

    return () => {
      unsubPersonal();
      unsubBroadcast();
    };
  }, [currentUser]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!currentUser || !userProfile) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'notice':
        return <Megaphone className="w-4 h-4 text-amber-500" />;
      case 'welfare':
        return <Heart className="w-4 h-4 text-rose-500" />;
      case 'campaign':
        return <Target className="w-4 h-4 text-indigo-500" />;
      case 'contribution':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'approval':
        return <UserCheck className="w-4 h-4 text-blue-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  const formatTime = (timestamp: number) => {
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  const handleNotificationClick = async (notification: NotificationItem) => {
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
    }
    setIsOpen(false);
    if (notification.targetUrl) {
      navigate(notification.targetUrl);
    }
  };

  const handleMarkAllRead = async () => {
    if (currentUser) {
      await markAllNotificationsAsRead(currentUser.uid);
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-slate-300 hover:text-white hover:bg-mamas-primary-hover transition-colors focus:outline-none"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-mamas-accent text-[10px] font-bold text-mamas-primary animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-mamas-card border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden text-mamas-text animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-mamas-text">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-mamas-accent/20 text-mamas-primary text-xs font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-mamas-primary font-medium hover:underline flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-300" />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors hover:bg-slate-50 ${
                    !item.read ? 'bg-amber-50/40 border-l-4 border-l-mamas-accent' : ''
                  }`}
                >
                  <div className="p-2 rounded-xl bg-slate-100/80 shrink-0 mt-0.5">
                    {getIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs font-semibold truncate ${!item.read ? 'text-mamas-text font-bold' : 'text-slate-700'}`}>
                        {item.title}
                      </p>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                        {formatTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-snug">
                      {item.body}
                    </p>
                  </div>
                  {!item.read && (
                    <span className="w-2 h-2 rounded-full bg-mamas-accent shrink-0 mt-2" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
