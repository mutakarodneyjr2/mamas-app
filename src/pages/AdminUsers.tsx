import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { approveMember, rejectMember, updateUserRole } from '../lib/auth';
import { logActivity } from '../lib/services';
import { exportToCSV } from '../lib/utils';
import { Users, CheckCircle, XCircle, Shield, Search, Filter, Phone, Mail, GraduationCap, MapPin, Download, ChevronDown } from 'lucide-react';

export default function AdminUsers() {
  const { currentUser, userProfile } = useAuth();
  const canApprove = ["super_admin", "chairperson", "vice_chairperson", "secretary"].includes(userProfile?.role || "");
  const canExport = ["super_admin", "chairperson", "vice_chairperson", "treasurer", "auditor", "secretary"].includes(userProfile?.role || "");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [districtFilter, setDistrictFilter] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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
    if (!canApprove) return;
    setErrorMsg(''); setSuccessMsg('');
    setActionLoading(uid);
    try {
      await approveMember(uid);
      if (currentUser) {
        await logActivity('APPROVE_MEMBER', currentUser.uid, uid, `Approved member registration for ${name}`);
      }
      setSuccessMsg(`Approved member ${name}.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error: any) {
      setErrorMsg("Failed to approve member: " + error.message);
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (uid: string, name: string) => {
    if (!canApprove) return;
    if (window.confirm(`Are you sure you want to reject registration for ${name}?`)) {
      setErrorMsg(''); setSuccessMsg('');
      setActionLoading(uid);
      try {
        await rejectMember(uid);
        if (currentUser) {
          await logActivity('REJECT_MEMBER', currentUser.uid, uid, `Rejected member registration for ${name}`);
        }
        setSuccessMsg(`Rejected member ${name}.`);
        setTimeout(() => setSuccessMsg(''), 3000);
      } catch (error: any) {
        setErrorMsg("Failed to reject member: " + error.message);
        setTimeout(() => setErrorMsg(''), 5000);
      } finally {
        setActionLoading(null);
      }
    }
  };

  const handleRoleChange = async (uid: string, name: string, newRole: UserRole) => {
    setErrorMsg(''); setSuccessMsg('');
    setActionLoading(uid);
    try {
      await updateUserRole(uid, newRole);
      if (currentUser) {
        await logActivity('UPDATE_USER_ROLE', currentUser.uid, uid, `Changed role of ${name} to ${newRole}`);
      }
      setSuccessMsg(`Changed role to ${newRole.replace('_', ' ')}.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error: any) {
      setErrorMsg("Failed to update role: " + error.message);
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetOnboarding = async (uid: string, name: string) => {
    if (userProfile?.role !== 'super_admin') return;
    setErrorMsg(''); setSuccessMsg('');
    try {
      await updateDoc(doc(db, 'users', uid), {
        hasCompletedOnboarding: false,
        updatedAt: Date.now()
      });
      if (currentUser) {
        await logActivity('RESET_ONBOARDING', currentUser.uid, uid, `Reset onboarding tour for member ${name}`);
      }
      setSuccessMsg(`Onboarding tour reset for ${name}.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (error: any) {
      setErrorMsg("Failed to reset onboarding: " + error.message);
      setTimeout(() => setErrorMsg(''), 5000);
    }
  };

  const canManageRoles = userProfile?.role === 'super_admin';

  if (loading) return <div className="p-8 text-center text-mamas-text-muted font-medium">Loading members directory...</div>;

  const pendingUsers = (Array.isArray(users) ? users : []).filter(u => u && u.status === 'pending');
  const filteredUsers = (Array.isArray(users) ? users : []).filter(u => {
    if (!u) return false;
    const s = String(searchTerm || '').toLowerCase();
    const fullName = String(u.fullName || '').toLowerCase();
    const phone = String(u.phoneNumber || '');
    const email = String(u.email || '').toLowerCase();
    const district = String(u.district || '').toLowerCase();
    const districtFilterStr = String(districtFilter || '').toLowerCase();

    const matchesSearch = fullName.includes(s) ||
                          phone.includes(s) ||
                          email.includes(s) ||
                          district.includes(s);
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesDistrict = !districtFilter || district.includes(districtFilterStr);
    const matchesYear = !yearFilter || (u.yearLeftSchool && u.yearLeftSchool.toString() === yearFilter);
    return matchesSearch && matchesStatus && matchesRole && matchesDistrict && matchesYear;
  });

  const handleExportCSV = () => {
    const exportData = filteredUsers.map(u => ({
      FullName: u.fullName,
      PhoneNumber: u.phoneNumber,
      Email: u.email || '',
      Role: u.role,
      Status: u.status,
      District: u.district || '',
      YearLeftSchool: u.yearLeftSchool || '',
      Occupation: u.occupation || ''
    }));
    exportToCSV('mamas_members_directory', exportData);
  };

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-display font-bold text-mamas-text flex items-center gap-2">
          <Users className="w-6 h-6 text-mamas-primary" /> Member Management & Directory
        </h2>
        <p className="text-mamas-text-muted text-sm mt-1">Review registration approvals and view member profiles.</p>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-sm font-medium animate-in fade-in">
          {errorMsg}
        </div>
      )}
      
      {successMsg && (
        <div className="bg-teal-50 border border-teal-200 text-teal-800 p-4 rounded-2xl text-sm font-medium animate-in fade-in">
          {successMsg}
        </div>
      )}

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

                {canApprove && (
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
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-mamas-card p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
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

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 text-mamas-text text-xs rounded-xl px-3 py-2 outline-none font-bold"
              >
                <option value="all">All Status ({users.length})</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                showAdvancedFilters ? 'bg-mamas-primary text-white border-mamas-primary' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Filter className="w-3.5 h-3.5" /> Filters <ChevronDown className={`w-3 h-3 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
            </button>

            {canExport && (
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-colors shadow-sm"
                title="Export filtered directory as CSV"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            )}
          </div>
        </div>

        {/* Advanced Filters Drawer */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-200">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Role</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-mamas-text outline-none"
              >
                <option value="all">All Roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="chairperson">Chairperson</option>
                <option value="vice_chairperson">Vice Chairperson</option>
                <option value="treasurer">Treasurer</option>
                <option value="auditor">Auditor</option>
                <option value="secretary">Secretary</option>
                <option value="member">Member</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">District</label>
              <input
                type="text"
                placeholder="e.g. Kampala, Wakiso"
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-mamas-text outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Year Left School</label>
              <input
                type="text"
                placeholder="e.g. 2010"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-mamas-text outline-none"
              />
            </div>
          </div>
        )}
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
              </div>               {/* Role & Actions Footer */}
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

              {userProfile?.role === 'super_admin' && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Onboarding: {user.hasCompletedOnboarding ? 'Completed' : 'Pending'}</span>
                  <button
                    onClick={() => handleResetOnboarding(user.uid, user.fullName)}
                    className="text-mamas-primary hover:underline font-bold"
                  >
                    Reset Tour
                  </button>
                </div>
              )}
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
