import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { approveMember, rejectMember, updateUserRole } from '../lib/auth';
import { logActivity } from '../lib/services';
import { exportToCSV } from '../lib/utils';
import { Users, CheckCircle, XCircle, Shield, Search, Filter, Phone, Mail, GraduationCap, MapPin, Download, ChevronDown, ChevronUp, Clock, ArrowRight } from 'lucide-react';
import { SelectDropdown } from '../components/SelectDropdown';

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
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [rejectingUser, setRejectingUser] = useState<{uid: string, name: string} | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

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
    <div className="space-y-6 pb-12 max-w-5xl mx-auto px-4">
      
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-900" /> Member Management
        </h2>
        <p className="text-xs text-gray-500 mt-1">Review registrations, manage roles, and view alumni profiles.</p>
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
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-bold text-amber-900">Pending Approvals</span>
            <span className="bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 text-xs font-bold">{pendingUsers.length}</span>
          </div>
          <button 
            onClick={() => { setStatusFilter('pending'); setExpandedUser(pendingUsers[0]?.uid || null); }}
            className="text-amber-700 font-semibold text-xs flex items-center gap-1 hover:text-amber-800 transition-colors"
          >
            Review <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="sticky top-16 z-30 bg-white/80 backdrop-blur-sm py-2">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search member name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-xl bg-gray-50 border border-gray-200 py-2.5 pl-10 pr-4 text-sm w-full outline-none focus:bg-white focus:ring-2 focus:ring-slate-900 transition-all"
          />
        </div>
        
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 uppercase font-semibold">Status:</span>
            <SelectDropdown
              options={[
                { label: `All Status (${users.length})`, value: 'all' },
                { label: 'Approved', value: 'approved' },
                { label: 'Pending', value: 'pending' },
                { label: 'Rejected', value: 'rejected' }
              ]}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1 ${
                showAdvancedFilters ? 'bg-gray-200 text-gray-800 border-gray-300' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Filters <ChevronDown className={`w-3 h-3 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
            </button>
            {canExport && (
              <button
                onClick={handleExportCSV}
                className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-3 py-1.5 text-xs font-bold transition-colors shadow-sm"
              >
                Export CSV
              </button>
            )}
          </div>
        </div>

        {/* Advanced Filters Drawer */}
        {showAdvancedFilters && (
          <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-200">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Role</label>
              <SelectDropdown
                options={[
                  { label: 'All Roles', value: 'all' },
                  { label: 'Super Admin', value: 'super_admin' },
                  { label: 'Chairperson', value: 'chairperson' },
                  { label: 'Vice Chairperson', value: 'vice_chairperson' },
                  { label: 'Treasurer', value: 'treasurer' },
                  { label: 'Auditor', value: 'auditor' },
                  { label: 'Secretary', value: 'secretary' },
                  { label: 'Member', value: 'member' }
                ]}
                value={roleFilter}
                onChange={setRoleFilter}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">District</label>
              <input
                type="text"
                placeholder="e.g. Kampala, Wakiso"
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-900 outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Year Left School</label>
              <input
                type="text"
                placeholder="e.g. 2010"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-900 outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>
        )}
      </div>

      {/* Mobile-Friendly Card Grid for Directory */}
      <div className="space-y-3">
        {filteredUsers.length > 0 && pendingUsers.length === 0 && statusFilter !== 'pending' && (
          <p className="text-xs text-gray-400 italic">No pending approvals</p>
        )}
        {filteredUsers.map(user => {
          const isMe = user.uid === currentUser?.uid;
          const isExpanded = expandedUser === user.uid;

          return (
            <div 
              key={user.uid} 
              className={`bg-white rounded-2xl border ${user.status === 'pending' ? 'border-l-4 border-l-amber-400 border-y-gray-100 border-r-gray-100' : 'border-gray-100'} shadow-sm flex flex-col transition-all duration-200 ${isExpanded ? 'ring-1 ring-gray-200' : 'hover:border-gray-200'} active:scale-[0.99]`}
            >
              {/* Row Header */}
              <div 
                className="p-3 flex items-center gap-3 cursor-pointer select-none"
                onClick={() => setExpandedUser(isExpanded ? null : user.uid)}
              >
                <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-sm flex-shrink-0 shadow-sm">
                  {user.profilePictureUrl ? (
                    <img src={user.profilePictureUrl} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    user.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-900 truncate">
                    {user.fullName.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                    {isMe && <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">You</span>}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      user.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      user.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {user.status}
                    </span>
                    <span className="bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize">
                      {user.role.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0 flex items-center justify-center p-1 text-gray-400">
                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50/50 p-4 rounded-b-2xl animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-700 truncate">{user.phoneNumber || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-700 truncate">{user.email || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-700 truncate">{user.district || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-700 truncate">Class of {user.yearLeftSchool || 'N/A'}</span>
                    </div>
                  </div>

                  {user.status === 'pending' && canApprove ? (
                    <div className="flex gap-3 mt-4 pt-3 border-t border-gray-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleApprove(user.uid, user.fullName); }}
                        disabled={actionLoading === user.uid}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full py-2.5 text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1"
                      >
                        {actionLoading === user.uid ? 'Processing...' : 'Approve'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReject(user.uid, user.fullName); }}
                        disabled={actionLoading === user.uid}
                        className="flex-1 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-full py-2.5 text-xs font-bold transition-colors flex items-center justify-center gap-1"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Role:</span>
                        {canManageRoles ? (
                          <select
                            value={user.role}
                            disabled={actionLoading === user.uid}
                            onChange={(e) => handleRoleChange(user.uid, user.fullName, e.target.value as UserRole)}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-700 outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
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
                          <span className="bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-700 capitalize">
                            {user.role.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      
                      {userProfile?.role === 'super_admin' && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">
                            {user.hasCompletedOnboarding ? 'Onboarded' : 'Pending Onboarding'}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleResetOnboarding(user.uid, user.fullName); }}
                            className="text-xs text-slate-700 font-semibold hover:underline focus:outline-none"
                          >
                            Reset Tour
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filteredUsers.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl py-12 flex flex-col items-center justify-center text-center shadow-sm">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
              <Users className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-sm font-bold text-gray-900">No members found</h3>
            <p className="text-xs text-gray-500 mt-1">Try adjusting your search or filters.</p>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {rejectingUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-xl animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-mamas-text">Reject Member</h3>
              <button
                onClick={() => { setRejectingUser(null); setRejectionReason(''); }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                You are about to reject the registration for <span className="font-bold text-mamas-text">{rejectingUser.name}</span>. 
                Please provide a reason for this rejection. The user will be notified.
              </p>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reason for Rejection *</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-mamas-accent h-24 resize-none font-medium"
                  placeholder="e.g., Verification failed, invalid alumni details..."
                />
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 flex items-center gap-3 bg-slate-50/50">
              <button
                onClick={() => { setRejectingUser(null); setRejectionReason(''); }}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmReject}
                disabled={!rejectionReason.trim() || actionLoading === rejectingUser.uid}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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

    </div>
  );
}
