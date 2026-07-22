import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { approveMember, rejectMember, updateUserRole } from '../lib/auth';
import { logActivity } from '../lib/services';
import { Users, CheckCircle, XCircle, Shield, Search, Filter, Phone, Mail, GraduationCap, MapPin } from 'lucide-react';

export default function AdminUsers() {
  const { currentUser, userProfile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData: User[] = [];
      snapshot.forEach((doc) => {
        usersData.push(doc.data() as User);
      });
      usersData.sort((a, b) => a.fullName.localeCompare(b.fullName));
      setUsers(usersData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleApprove = async (uid: string, name: string) => {
    setActionLoading(uid);
    try {
      await approveMember(uid);
      if (currentUser) {
        await logActivity('APPROVE_MEMBER', currentUser.uid, uid, `Approved member registration for ${name}`);
      }
    } catch (error: any) {
      alert("Failed to approve member: " + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (uid: string, name: string) => {
    if (window.confirm(`Are you sure you want to reject registration for ${name}?`)) {
      setActionLoading(uid);
      try {
        await rejectMember(uid);
        if (currentUser) {
          await logActivity('REJECT_MEMBER', currentUser.uid, uid, `Rejected member registration for ${name}`);
        }
      } catch (error: any) {
        alert("Failed to reject member: " + error.message);
      } finally {
        setActionLoading(null);
      }
    }
  };

  const handleRoleChange = async (uid: string, name: string, newRole: UserRole) => {
    setActionLoading(uid);
    try {
      await updateUserRole(uid, newRole);
      if (currentUser) {
        await logActivity('UPDATE_USER_ROLE', currentUser.uid, uid, `Changed role of ${name} to ${newRole}`);
      }
    } catch (error: any) {
      alert("Failed to update role: " + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const canManageRoles = userProfile?.role === 'super_admin';
  const canApprove = ['super_admin', 'chairperson', 'secretary'].includes(userProfile?.role || '');

  if (loading) return <div className="p-8 text-center text-mamas-text-muted font-medium">Loading members directory...</div>;

  const pendingUsers = users.filter(u => u.status === 'pending');
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          u.phoneNumber.includes(searchTerm) ||
                          (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (u.district && u.district.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-display font-bold text-mamas-text flex items-center gap-2">
          <Users className="w-6 h-6 text-mamas-primary" /> Member Management & Directory
        </h2>
        <p className="text-mamas-text-muted text-sm mt-1">Review registration approvals and view member profiles.</p>
      </div>

      {/* Pending Approvals Callout (If any exist) */}
      {canApprove && pendingUsers.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200/90 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-amber-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-amber-600" /> Pending Registrations ({pendingUsers.length})
            </h3>
            <span className="text-xs bg-amber-200/80 text-amber-900 px-2.5 py-0.5 rounded-full font-bold">
              Action Required
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {pendingUsers.map(user => (
              <div key={user.uid} className="bg-white border border-amber-200/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 font-bold text-slate-500 flex items-center justify-center text-sm border border-slate-200 flex-shrink-0">
                    {user.fullName.charAt(0)}
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-bold text-mamas-text text-sm truncate">{user.fullName}</p>
                    <p className="text-xs text-slate-500">{user.phoneNumber}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Class of {user.yearLeftSchool || 'N/A'} • {user.district || 'Uganda'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleApprove(user.uid, user.fullName)}
                    disabled={actionLoading === user.uid}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(user.uid, user.fullName)}
                    disabled={actionLoading === user.uid}
                    className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 py-2 rounded-xl text-xs font-bold transition-all border border-rose-200 flex items-center justify-center gap-1"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-mamas-card p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, phone, district..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-mamas-accent font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 text-mamas-text text-xs rounded-xl px-3 py-2 outline-none font-bold"
          >
            <option value="all">All Members ({users.length})</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Mobile-Friendly Card Grid for Directory */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map(user => {
          const isMe = user.uid === currentUser?.uid;
          return (
            <div key={user.uid} className="bg-mamas-card border border-slate-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-3">
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

                <div className="space-y-1.5 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold">{user.phoneNumber}</span>
                  </div>
                  {user.email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{user.email}</span>
                    </div>
                  )}
                  {user.district && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{user.district}</span>
                    </div>
                  )}
                  {user.yearLeftSchool && (
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                      <span>Class of {user.yearLeftSchool}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Role & Actions Footer */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Role:</span>
                {canManageRoles ? (
                  <select
                    value={user.role}
                    disabled={actionLoading === user.uid}
                    onChange={(e) => handleRoleChange(user.uid, user.fullName, e.target.value as UserRole)}
                    className="bg-slate-50 border border-slate-200 text-mamas-text text-xs rounded-xl px-2.5 py-1 outline-none font-bold focus:bg-white"
                  >
                    <option value="member">Member</option>
                    <option value="mobiliser">Mobiliser</option>
                    <option value="auditor">Auditor</option>
                    <option value="secretary">Secretary</option>
                    <option value="treasurer">Treasurer</option>
                    <option value="vice_chairperson">Vice Chairperson</option>
                    <option value="chairperson">Chairperson</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-bold capitalize">
                    {user.role.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {filteredUsers.length === 0 && (
          <div className="col-span-full bg-mamas-card border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
            No members found matching the search criteria.
          </div>
        )}
      </div>

    </div>
  );
}
