import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { approveMember, rejectMember, updateUserRole, suspendUser, unsuspendUser } from '../lib/auth';
import { logActivity } from '../lib/services';
import { exportToCSV } from '../lib/utils';
import { Users, CheckCircle, XCircle, Shield, Search, Filter, Phone, Mail, GraduationCap, MapPin, Download, ChevronDown, ChevronUp, Clock, ArrowRight, Ban, Check, AlertTriangle, UserX, KeyRound } from 'lucide-react';
import { SelectDropdown } from '../components/SelectDropdown';
import { AdminAccountRecoveryQueue } from '../components/AdminAccountRecoveryQueue';

export default function AdminUsers() {
  const { currentUser, userProfile } = useAuth();
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const canApprove = ["super_admin", "chairperson", "vice_chairperson", "secretary"].includes(userProfile?.role || "");
  const canExport = ["super_admin", "chairperson", "vice_chairperson", "treasurer", "auditor", "secretary"].includes(userProfile?.role || "");
  const [adminTab, setAdminTab] = useState<'members' | 'recovery'>('members');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected' | 'suspended' | 'pending_deletion' | 'deleted'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [districtFilter, setDistrictFilter] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [rejectingUser, setRejectingUser] = useState<{uid: string, name: string} | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [suspendingUser, setSuspendingUser] = useState<{uid: string, name: string} | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [approvingUnverifiedUser, setApprovingUnverifiedUser] = useState<{ uid: string; name: string; email: string } | null>(null);

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
    }, (error) => {
      console.error("Error loading users:", error);
      setErrorMsg("Failed to load users. Please check your permissions or try again.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const executeApprove = async (uid: string, name: string) => {
    if (!canApprove) return;
    setErrorMsg(''); setSuccessMsg('');
    setActionLoading(uid);
    try {
      await approveMember(uid, currentUser?.uid);
      setSuccessMsg(`Approved member ${name}.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error: any) {
      setErrorMsg("Failed to approve member: " + error.message);
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setActionLoading(null);
      setApprovingUnverifiedUser(null);
    }
  };

  const handleApprove = (user: User) => {
    if (!canApprove) return;
    if (!user.emailVerified && user.authProvider === 'email') {
      setApprovingUnverifiedUser({ uid: user.uid, name: user.fullName, email: user.email });
      return;
    }
    executeApprove(user.uid, user.fullName);
  };

  const handleReject = (uid: string, name: string) => {
    if (!canApprove) return;
    setRejectingUser({ uid, name });
    setRejectionReason('');
  };

  const confirmReject = async () => {
    if (!rejectingUser || !rejectionReason.trim()) return;
    const { uid, name } = rejectingUser;
    
    setErrorMsg(''); setSuccessMsg('');
    setActionLoading(uid);
    setRejectingUser(null);
    
    try {
      await rejectMember(uid, rejectionReason.trim(), currentUser?.uid);
      setSuccessMsg(`Rejected member ${name}.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error: any) {
      setErrorMsg("Failed to reject member: " + error.message);
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async (uid: string, name: string, newRole: UserRole) => {
    setErrorMsg(''); setSuccessMsg('');
    setActionLoading(uid);
    try {
      await updateUserRole(uid, newRole, currentUser?.uid);
      setSuccessMsg(`Changed role to ${newRole.replace('_', ' ')}.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error: any) {
      setErrorMsg("Failed to update role: " + error.message);
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = (uid: string, name: string) => {
    if (!isSuperAdmin) return;
    setSuspendingUser({ uid, name });
    setSuspendReason('');
  };

  const confirmSuspend = async () => {
    if (!suspendingUser || !suspendReason.trim() || !currentUser) return;
    const { uid, name } = suspendingUser;

    setErrorMsg(''); setSuccessMsg('');
    setActionLoading(uid);
    setSuspendingUser(null);

    try {
      await suspendUser(uid, suspendReason.trim(), currentUser.uid);
      setSuccessMsg(`Suspended user ${name}.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (error: any) {
      setErrorMsg("Failed to suspend user: " + error.message);
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnsuspend = async (uid: string, name: string) => {
    if (!isSuperAdmin || !currentUser) return;
    setErrorMsg(''); setSuccessMsg('');
    setActionLoading(uid);

    try {
      await unsuspendUser(uid, currentUser.uid);
      setSuccessMsg(`Restored and unsuspended ${name}.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (error: any) {
      setErrorMsg("Failed to unsuspend user: " + error.message);
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
    <div className="space-y-6 pb-16 max-w-5xl mx-auto px-4 font-sans">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 text-[10px] font-extrabold uppercase tracking-wider rounded-full px-2.5 py-0.5 border border-blue-200 dark:border-blue-900/60">
              Admin Governance
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" /> Member Directory & Roles
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Review registrations, approve new alumni, assign roles, and audit member profiles.</p>
        </div>
        {canExport && adminTab === 'members' && (
          <button
            onClick={handleExportCSV}
            className="self-start sm:self-auto inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-4 py-2.5 text-xs font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        )}
      </div>

      {/* Admin Tab Switcher */}
      {isSuperAdmin && (
        <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl max-w-md border border-slate-200/80 dark:border-slate-700/80">
          <button
            type="button"
            onClick={() => setAdminTab('members')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              adminTab === 'members'
                ? 'bg-white dark:bg-[#0c1731] text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Members Directory</span>
          </button>
          <button
            type="button"
            onClick={() => setAdminTab('recovery')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              adminTab === 'recovery'
                ? 'bg-white dark:bg-[#0c1731] text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Account Recovery</span>
          </button>
        </div>
      )}

      {adminTab === 'recovery' ? (
        <AdminAccountRecoveryQueue />
      ) : (
        <>
      {errorMsg && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 p-4 rounded-2xl text-sm font-semibold animate-in fade-in">
          {errorMsg}
        </div>
      )}
      
      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 p-4 rounded-2xl text-sm font-semibold animate-in fade-in">
          {successMsg}
        </div>
      )}

      {/* Pending Approvals Callout (If any exist) */}
      {canApprove && pendingUsers.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-3xl p-4 sm:p-5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-amber-900 dark:text-amber-300">Pending Approvals</span>
                <span className="bg-amber-500 text-white rounded-full px-2 py-0.5 text-[10px] font-extrabold">{pendingUsers.length}</span>
              </div>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">Alumni applications awaiting executive approval.</p>
            </div>
          </div>
          <button 
            onClick={() => { setStatusFilter('pending'); setExpandedUser(pendingUsers[0]?.uid || null); }}
            className="text-amber-800 dark:text-amber-300 font-extrabold text-xs flex items-center gap-1.5 hover:underline bg-white/60 dark:bg-amber-900/40 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
          >
            Review Now <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-[#0c1731] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search member name, phone, email, or district..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 py-3 pl-11 pr-4 text-xs sm:text-sm w-full outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white transition-all placeholder:text-slate-400"
          />
        </div>
        
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">Status:</span>
            <SelectDropdown
              options={[
                { label: `All Status (${users.length})`, value: 'all' },
                { label: 'Approved', value: 'approved' },
                { label: 'Pending', value: 'pending' },
                { label: 'Suspended', value: 'suspended' },
                { label: 'Pending Deletion', value: 'pending_deletion' },
                { label: 'Rejected', value: 'rejected' },
                { label: 'Deleted', value: 'deleted' }
              ]}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                showAdvancedFilters 
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' 
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Advanced Filters Drawer */}
        {showAdvancedFilters && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in fade-in duration-200">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Role</label>
              <SelectDropdown
                options={[
                  { label: 'All Roles', value: 'all' },
                  { label: 'Super Admin', value: 'super_admin' },
                  { label: 'Chairperson', value: 'chairperson' },
                  { label: 'Vice Chairperson', value: 'vice_chairperson' },
                  { label: 'Treasurer', value: 'treasurer' },
                  { label: 'Auditor', value: 'auditor' },
                  { label: 'Secretary', value: 'secretary' },
                  { label: 'Mobiliser', value: 'mobiliser' },
                  { label: 'Member', value: 'member' }
                ]}
                value={roleFilter}
                onChange={setRoleFilter}
              />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">District</label>
              <input
                type="text"
                placeholder="e.g. Kampala, Wakiso"
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Class Year Left</label>
              <input
                type="text"
                placeholder="e.g. 2010"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Member Cards Grid */}
      <div className="space-y-3">
        {filteredUsers.length > 0 && pendingUsers.length === 0 && statusFilter !== 'pending' && (
          <p className="text-xs text-slate-400 dark:text-slate-500 italic">Showing {filteredUsers.length} members. All pending registrations approved.</p>
        )}
        {filteredUsers.map(user => {
          const isMe = user.uid === currentUser?.uid;
          const isExpanded = expandedUser === user.uid;

          return (
            <div 
              key={user.uid} 
              className={`bg-white dark:bg-[#0c1731] rounded-3xl border ${
                user.status === 'pending' 
                  ? 'border-amber-300 dark:border-amber-800/70' 
                  : 'border-slate-200/80 dark:border-slate-800'
              } shadow-xs flex flex-col transition-all duration-200 ${isExpanded ? 'ring-2 ring-blue-500/30' : 'hover:border-blue-500/30'}`}
            >
              {/* Row Header */}
              <div 
                className="p-4 sm:p-5 flex items-center gap-3.5 cursor-pointer select-none"
                onClick={() => setExpandedUser(isExpanded ? null : user.uid)}
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0f2756] to-blue-600 text-white font-extrabold flex items-center justify-center text-sm shrink-0 shadow-xs">
                  {user.profilePictureUrl ? (
                    <img src={user.profilePictureUrl} alt="" className="w-full h-full rounded-2xl object-cover" />
                  ) : (
                    (user.fullName || 'User').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                      {(user.fullName || 'User').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                    </p>
                    {isMe && (
                      <span className="text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-extrabold shrink-0">
                        You
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      user.status === 'approved' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' :
                      user.status === 'pending' ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800' :
                      user.status === 'suspended' ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800' :
                      user.status === 'pending_deletion' ? 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800' :
                      user.status === 'deleted' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700' :
                      'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                    }`}>
                      {user.status === 'pending_deletion' ? 'Pending Deletion' : user.status}
                    </span>
                    {user.status === 'pending' && (
                      user.emailVerified ? (
                        <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full px-2 py-0.5 text-[10px] font-bold">
                          Email Verified
                        </span>
                      ) : (
                        <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-full px-2 py-0.5 text-[10px] font-bold">
                          Email Unverified
                        </span>
                      )
                    )}
                    {user.reappliedAt && (
                      <span className="bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800 rounded-full px-2 py-0.5 text-[10px] font-bold">
                        Re-applied
                      </span>
                    )}
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize">
                      {user?.role?.replace('_', ' ') || 'member'}
                    </span>
                    {user.district && (
                      <span className="text-slate-400 dark:text-slate-500 text-[11px] font-medium hidden sm:inline">
                        • {user.district}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex items-center justify-center p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 p-4 sm:p-5 rounded-b-3xl animate-in slide-in-from-top-2 duration-200 space-y-4">
                  
                  {/* Status Alerts if Suspended or Pending Deletion */}
                  {user.status === 'suspended' && (
                    <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl flex items-start gap-2.5 text-xs">
                      <Ban className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-bold text-rose-900 dark:text-rose-200">Account is Suspended</p>
                        <p className="text-rose-700 dark:text-rose-300">
                          {user.suspendReason ? `Reason: ${user.suspendReason}` : 'Suspended by Super Administrator.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {user.status === 'pending_deletion' && (
                    <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl flex items-start gap-2.5 text-xs">
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-bold text-amber-900 dark:text-amber-200">Pending Self-Deletion (Grace Period)</p>
                        <p className="text-amber-700 dark:text-amber-300">
                          Effective deletion date: {user.deletionEffectiveAt ? new Date(user.deletionEffectiveAt).toLocaleDateString() : 'in 30 days'}.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <div className="flex items-center gap-2.5 bg-white dark:bg-[#0c1731] p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                      <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{user.phoneNumber || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2.5 bg-white dark:bg-[#0c1731] p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                      <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{user.email || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2.5 bg-white dark:bg-[#0c1731] p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                      <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{user.district || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2.5 bg-white dark:bg-[#0c1731] p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                      <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">Class of {user.yearLeftSchool || 'N/A'}</span>
                    </div>
                  </div>

                  {user.status === 'pending' && canApprove ? (
                    <div className="flex gap-3 pt-3 border-t border-slate-200/60 dark:border-slate-800">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleApprove(user); }}
                        disabled={actionLoading === user.uid}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-3 text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {actionLoading === user.uid ? 'Processing...' : 'Approve Member'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReject(user.uid, user.fullName); }}
                        disabled={actionLoading === user.uid}
                        className="flex-1 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-2xl py-3 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject Application
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200/60 dark:border-slate-800">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Role Access:</span>
                        {canManageRoles && user.status !== 'deleted' ? (
                          <select
                            value={user.role}
                            disabled={actionLoading === user.uid}
                            onChange={(e) => handleRoleChange(user.uid, user.fullName, e.target.value as UserRole)}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
                          <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 capitalize">
                            {user?.role?.replace('_', ' ') || 'Member'}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3">
                        {/* SuperAdmin Suspend/Unsuspend Button */}
                        {isSuperAdmin && !isMe && user.status !== 'deleted' && (
                          user.status === 'suspended' ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleUnsuspend(user.uid, user.fullName); }}
                              disabled={actionLoading === user.uid}
                              className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Unsuspend User</span>
                            </button>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSuspend(user.uid, user.fullName); }}
                              disabled={actionLoading === user.uid}
                              className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Suspend User</span>
                            </button>
                          )
                        )}

                        {isSuperAdmin && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              {user.hasCompletedOnboarding ? 'Onboarded' : 'Pending Onboarding'}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleResetOnboarding(user.uid, user.fullName); }}
                              className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                            >
                              Reset Tour
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredUsers.length === 0 && (
          <div className="bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 rounded-3xl py-16 flex flex-col items-center justify-center text-center shadow-xs">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-3">
              <Users className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">No members found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Try adjusting your search terms or filter selections.</p>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {rejectingUser && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0c1731] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Reject Member</h3>
              <button
                onClick={() => { setRejectingUser(null); setRejectionReason(''); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                You are rejecting the registration application for <span className="font-extrabold text-slate-900 dark:text-white">{rejectingUser.name}</span>. 
                Please provide an explanatory reason for rejection.
              </p>
              
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Reason for Rejection *</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 text-xs sm:text-sm outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white h-24 resize-none font-medium placeholder:text-slate-400"
                  placeholder="e.g., Unverified graduation record, incorrect contact phone..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-900/50">
              <button
                onClick={() => { setRejectingUser(null); setRejectionReason(''); }}
                className="flex-1 px-4 py-3 rounded-2xl font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={!rejectionReason.trim() || actionLoading === rejectingUser.uid}
                className="flex-1 px-4 py-3 rounded-2xl font-bold text-xs sm:text-sm text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                {actionLoading === rejectingUser.uid ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : null}
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Super Admin Suspend User Modal */}
      {suspendingUser && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0c1731] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-100 dark:bg-rose-950/80 rounded-xl text-rose-600 dark:text-rose-400">
                  <Ban className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Suspend Account</h3>
              </div>
              <button
                onClick={() => { setSuspendingUser(null); setSuspendReason(''); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                You are suspending access for <span className="font-extrabold text-slate-900 dark:text-white">{suspendingUser.name}</span>. 
                They will be blocked from logging into member areas until unsuspended by a Super Administrator.
              </p>
              
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Reason for Suspension *</label>
                <textarea
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 text-xs sm:text-sm outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white h-24 resize-none font-medium placeholder:text-slate-400"
                  placeholder="e.g., Conduct violation, pending governance investigation, duplicate account..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-900/50">
              <button
                onClick={() => { setSuspendingUser(null); setSuspendReason(''); }}
                className="flex-1 px-4 py-3 rounded-2xl font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmSuspend}
                disabled={!suspendReason.trim() || actionLoading === suspendingUser.uid}
                className="flex-1 px-4 py-3 rounded-2xl font-bold text-xs sm:text-sm text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                {actionLoading === suspendingUser.uid ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : null}
                Confirm Suspend
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approving Unverified User Modal */}
      {approvingUnverifiedUser && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0c1731] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 dark:bg-amber-950/80 rounded-xl text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Email Unverified Warning</h3>
              </div>
              <button
                onClick={() => setApprovingUnverifiedUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-3.5">
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                <span className="font-extrabold text-slate-900 dark:text-white">{approvingUnverifiedUser.name}</span> ({approvingUnverifiedUser.email}) registered with email/password but has not yet confirmed their email address.
              </p>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-amber-800 dark:text-amber-300 text-xs">
                Approving unverified accounts is only recommended if you have independently verified this alumnus via phone, school registry, or personal contact.
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-900/50">
              <button
                onClick={() => setApprovingUnverifiedUser(null)}
                className="flex-1 px-4 py-3 rounded-2xl font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => executeApprove(approvingUnverifiedUser.uid, approvingUnverifiedUser.name)}
                disabled={actionLoading === approvingUnverifiedUser.uid}
                className="flex-1 px-4 py-3 rounded-2xl font-bold text-xs sm:text-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {actionLoading === approvingUnverifiedUser.uid ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : <CheckCircle className="w-4 h-4" />}
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}

        </>
      )}

    </div>
  );
}
