import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { ActivityLog, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { exportToCSV } from '../lib/utils';
import { FileText, Search, Calendar, Activity, Download, ArrowUpDown, Filter, UserCheck, ShieldCheck, CreditCard, RotateCcw } from 'lucide-react';

export default function AdminLogs() {
  const { currentUser, userProfile } = useAuth();
  const canExport = ["super_admin", "chairperson", "vice_chairperson", "treasurer", "auditor", "secretary"].includes(userProfile?.role || "");
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, 'users'));
        const snap = await getDocs(q);
        const userMap: Record<string, User> = {};
        snap.forEach(doc => {
          userMap[doc.id] = doc.data() as User;
        });
        setUsers(userMap);
      } catch (err) {
        console.error("Error loading users in AdminLogs:", err);
      }
    };
    fetchUsers();

    const qLogs = query(collection(db, 'activityLogs'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(qLogs, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
      setLogs(data);
      setLoading(false);
    }, (error) => {
      console.error("Error loading logs:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser]);

  const filteredLogs = (Array.isArray(logs) ? logs : []).filter(log => {
    if (!log) return false;
    const s = String(searchTerm || '').toLowerCase();
    const userName = String(users?.[log.performedBy]?.fullName || log.performedBy || 'Unknown').toLowerCase();
    const action = String(log.action || '').toLowerCase();
    const details = String(log.details || '').toLowerCase();

    const actionMatch = action.includes(s);
    const detailMatch = details.includes(s);
    const nameMatch = userName.includes(s);
    
    const matchesSearch = actionMatch || detailMatch || nameMatch;
    const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;
    
    let matchesDate = true;
    const logDate = typeof log.createdAt === 'number' ? log.createdAt : 0;
    if (startDate) {
      matchesDate = matchesDate && logDate >= new Date(startDate).getTime();
    }
    if (endDate) {
      matchesDate = matchesDate && logDate <= new Date(endDate).getTime() + 86400000;
    }

    return matchesSearch && matchesAction && matchesDate;
  });

  const handleExportCSV = () => {
    const exportData = filteredLogs.map(log => ({
      Timestamp: new Date(log.createdAt).toLocaleString(),
      Action: log.action,
      PerformedBy: users[log.performedBy]?.fullName || log.performedBy || 'Unknown',
      Details: log.details
    }));
    exportToCSV('mamas_activity_logs', exportData);
  };

  const getActionBadge = (action: string) => {
    if (action.includes('APPROVE') || action.includes('VERIFY')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60">
          <UserCheck className="w-3 h-3" />
          {action.replace(/_/g, ' ')}
        </span>
      );
    }
    if (action.includes('REJECT') || action.includes('DELETE')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
          {action.replace(/_/g, ' ')}
        </span>
      );
    }
    if (action.includes('ROLE') || action.includes('SETTINGS') || action.includes('CONFIG')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60">
          <ShieldCheck className="w-3 h-3" />
          {action.replace(/_/g, ' ')}
        </span>
      );
    }
    if (action.includes('WELFARE') || action.includes('PAY')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-900/60">
          <CreditCard className="w-3 h-3" />
          {action.replace(/_/g, ' ')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        {action.replace(/_/g, ' ')}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-12 h-12 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Loading audit trail...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#0c1731] rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/50 dark:border-blue-900/60">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              System Audit Trail & Logs
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Comprehensive immutable audit ledger of administrative actions ({filteredLogs.length} events logged)
            </p>
          </div>
        </div>
        {canExport && (
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl text-xs font-extrabold uppercase tracking-wider transition-all shadow-xs active:scale-95 cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        )}
      </div>

      {/* Filters Card */}
      <div className="bg-white dark:bg-[#0c1731] p-4 sm:p-5 rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by action, details, or actor name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Dropdowns and Dates */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs rounded-2xl px-3.5 py-2.5 outline-none font-bold focus:border-blue-500 transition-all cursor-pointer"
            >
              <option value="ALL">All Actions</option>
              <option value="APPROVE_MEMBER">Approve Member</option>
              <option value="REJECT_MEMBER">Reject Member</option>
              <option value="UPDATE_USER_ROLE">Update User Role</option>
              <option value="VERIFY_CONTRIBUTION">Verify Contribution</option>
              <option value="REJECT_CONTRIBUTION">Reject Contribution</option>
              <option value="VOTE_WELFARE_REQUEST">Vote Welfare</option>
              <option value="PAY_WELFARE_REQUEST">Pay Welfare</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-white text-xs font-semibold outline-none w-28"
            />
            <span className="text-slate-400 text-xs font-bold">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-white text-xs font-semibold outline-none w-28"
            />
          </div>

          {(searchTerm || actionFilter !== 'ALL' || startDate || endDate) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setActionFilter('ALL');
                setStartDate('');
                setEndDate('');
              }}
              className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
              title="Reset Filters"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile Feed Layout */}
      <div className="md:hidden space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white dark:bg-[#0c1731] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <Activity className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="font-extrabold text-sm text-slate-900 dark:text-white">No logs match criteria</p>
            <p className="text-xs text-slate-500 mt-1">Adjust filters or search keywords.</p>
          </div>
        ) : (
          filteredLogs.map(log => {
            const userName = users[log.performedBy]?.fullName || log.performedBy || 'System';
            const initials = userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'SY';

            return (
              <div key={log.id} className="bg-white dark:bg-[#0c1731] p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {getActionBadge(log.action)}
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 shrink-0">
                    {new Date(log.createdAt).toLocaleString(undefined, {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                  {log.details}
                </p>

                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 flex items-center justify-center text-[10px] font-extrabold shrink-0 border border-blue-200 dark:border-blue-900/60">
                    {initials}
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {userName}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden md:block bg-white dark:bg-[#0c1731] rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Performed By</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Details & Parameters</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-3 border border-blue-200/60 dark:border-blue-900/60">
                        <Activity className="w-6 h-6" />
                      </div>
                      <p className="text-base font-extrabold text-slate-900 dark:text-white">No Activity Logs Found</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">No logs match your current filter parameters. Try clearing your search.</p>
                      <button 
                        onClick={() => { setSearchTerm(''); setActionFilter('ALL'); setStartDate(''); setEndDate(''); }}
                        className="mt-4 text-xs font-extrabold uppercase tracking-wider bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white px-4 py-2.5 rounded-2xl transition-all cursor-pointer"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const userName = users[log.performedBy]?.fullName || log.performedBy || 'System';
                  const initials = userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'SY';

                  return (
                    <tr key={log.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-500 dark:text-slate-400">
                        {new Date(log.createdAt).toLocaleString(undefined, {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit'
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center text-[10px] font-extrabold shrink-0 border border-blue-200 dark:border-blue-900/60">
                            {initials}
                          </div>
                          <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                            {userName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-700 dark:text-slate-300 max-w-lg truncate" title={log.details}>
                        {log.details}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
