import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { User, UserRole } from '../types';
import { updateUserRole } from '../lib/auth';
import { logActivity } from '../lib/services';
import { Shield, Search, CheckCircle2, AlertCircle, UserCheck } from 'lucide-react';

const ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: 'member', label: 'Member', description: 'Standard approved association member' },
  { value: 'mobiliser', label: 'Mobiliser', description: 'Can post notices and mobilize members' },
  { value: 'auditor', label: 'Auditor', description: 'Read-only access to all financial reports' },
  { value: 'secretary', label: 'Secretary', description: 'Approves members, posts notices' },
  { value: 'treasurer', label: 'Treasurer', description: 'Verifies contributions & pays welfare' },
  { value: 'vice_chairperson', label: 'Vice Chairperson', description: 'Executive oversight & approvals' },
  { value: 'chairperson', label: 'Chairperson', description: 'Full executive administration' },
  { value: 'super_admin', label: 'Super Admin', description: 'Complete system authority & role assignment' },
];

export default function AdminRoles() {
  const { currentUser, userProfile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const uList: User[] = [];
      snapshot.forEach(doc => {
        uList.push(doc.data() as User);
      });
      uList.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
      setUsers(uList);
      setLoading(false);
    }, (error) => {
      console.error("Error loading users:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  if (!userProfile || !currentUser) return null;

  if (userProfile.role !== 'super_admin') {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl text-center">
        <Shield className="w-8 h-8 text-rose-600 mx-auto mb-2" />
        <h3 className="font-bold text-base">Access Restricted</h3>
        <p className="text-xs text-rose-600 mt-1">Only the Super Admin can modify system user roles.</p>
      </div>
    );
  }

  const handleRoleUpdate = async (targetUid: string, targetName: string, newRole: UserRole) => {
    setSavingUid(targetUid);
    setMessage('');
    setError('');

    try {
      await updateUserRole(targetUid, newRole, currentUser.uid);
      setMessage(`Updated role for ${targetName} to ${newRole.replace('_', ' ')}.`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update role");
      setTimeout(() => setError(''), 5000);
    } finally {
      setSavingUid(null);
    }
  };

  const filteredUsers = (Array.isArray(users) ? users : []).filter(user => {
    if (!user) return false;
    const s = String(searchTerm || '').toLowerCase();
    const fullName = String(user.fullName || '').toLowerCase();
    const phone = String(user.phoneNumber || '');
    const email = String(user.email || '').toLowerCase();

    const matchesSearch = fullName.includes(s) ||
                          phone.includes(s) ||
                          email.includes(s);
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) return <div className="p-8 text-center text-mamas-text-muted font-medium">Loading user roles...</div>;

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto px-4 font-sans">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 text-[10px] font-extrabold uppercase tracking-wider rounded-full px-2.5 py-0.5 border border-blue-200 dark:border-blue-900/60">
            Executive Privileges
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" /> Role & Access Governance
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Assign system permissions, financial authority, and executive officer appointments.</p>
      </div>

      {message && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 px-4 py-3.5 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          {message}
        </div>
      )}

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 px-4 py-3.5 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-[#0c1731] p-4 sm:p-5 rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row gap-3.5 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search member by name, phone, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl pl-11 pr-4 py-2.5 text-xs sm:text-sm outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 font-medium text-slate-900 dark:text-white placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <span className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Role Filter:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-xl px-3 py-2 outline-none font-bold cursor-pointer focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Roles</option>
            {ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Modern Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map(user => {
          const isMe = user.uid === currentUser.uid;
          return (
            <div key={user.uid} className="bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs hover:border-blue-500/40 transition-all flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-start gap-3.5 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0f2756] to-blue-600 text-white font-extrabold flex items-center justify-center text-sm shadow-xs shrink-0">
                    {user.profilePictureUrl ? (
                      <img src={user.profilePictureUrl} alt="" className="w-full h-full rounded-2xl object-cover" />
                    ) : (
                      user.fullName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                      {user.fullName}
                      {isMe && <span className="text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-extrabold shrink-0">You</span>}
                    </p>
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider mt-1 ${
                      user.status === 'approved' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' :
                      user.status === 'pending' ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800' :
                      'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                    }`}>
                      {user.status}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">{user.phoneNumber} {user.email ? `• ${user.email}` : ''}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Role Access:</span>
                <select
                  value={user.role}
                  disabled={savingUid === user.uid}
                  onChange={(e) => handleRoleUpdate(user.uid, user.fullName, e.target.value as UserRole)}
                  className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-xl px-3 py-1.5 outline-none font-bold focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}

        {filteredUsers.length === 0 && (
          <div className="col-span-full bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 rounded-3xl p-16 text-center shadow-xs">
            <Shield className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No members matching search criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}
