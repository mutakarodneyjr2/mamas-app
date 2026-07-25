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
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const uList: User[] = [];
      snapshot.forEach(doc => {
        uList.push(doc.data() as User);
      });
      uList.sort((a, b) => a.fullName.localeCompare(b.fullName));
      setUsers(uList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

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
      await updateUserRole(targetUid, newRole);
      await logActivity('ASSIGN_ROLE', currentUser.uid, targetUid, `Changed role of ${targetName} to ${newRole}`);
      setMessage(`Updated role for ${targetName} to ${newRole.replace('_', ' ')}.`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update role");
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
    <div className="space-y-6 pb-10 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-display font-bold text-mamas-text flex items-center gap-2">
          <Shield className="w-6 h-6 text-mamas-accent" /> Role & Access Management
        </h2>
        <p className="text-mamas-text-muted text-sm mt-1">Assign system permissions and executive roles to members.</p>
      </div>

      {message && (
        <div className="bg-teal-50 border border-teal-200 text-teal-800 px-4 py-3 rounded-2xl text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-teal-600 flex-shrink-0" />
          {message}
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl text-sm font-medium flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-mamas-card p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, phone, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-mamas-accent font-medium text-mamas-text dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filter Role:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-mamas-text dark:text-white text-xs rounded-xl px-3 py-2 outline-none font-bold"
          >
            <option value="all">All Roles</option>
            {ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Mobile-Friendly Card Grid (No horizontal scroll) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map(user => {
          const isMe = user.uid === currentUser.uid;
          return (
            <div key={user.uid} className="bg-mamas-card border border-slate-200/90 dark:border-slate-700 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-mamas-primary text-mamas-accent font-bold flex items-center justify-center text-sm shadow-sm flex-shrink-0">
                      {user.profilePictureUrl ? (
                        <img src={user.profilePictureUrl} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        user.fullName.charAt(0)
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-mamas-text flex items-center gap-1.5">
                        {user.fullName}
                        {isMe && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">You</span>}
                      </p>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider mt-0.5 ${
                        user.status === 'approved' ? 'bg-teal-50 text-teal-700 border border-teal-200' :
                        user.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {user.status}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{user.phoneNumber} {user.email ? `• ${user.email}` : ''}</p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Role:</span>
                <select
                  value={user.role}
                  disabled={savingUid === user.uid}
                  onChange={(e) => handleRoleUpdate(user.uid, user.fullName, e.target.value as UserRole)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-mamas-text dark:text-white text-xs rounded-xl px-2.5 py-1.5 outline-none font-bold focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-mamas-accent"
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
          <div className="col-span-full bg-mamas-card border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
            No users matching search criteria.
          </div>
        )}
      </div>
    </div>
  );
}
