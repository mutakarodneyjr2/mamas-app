import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { ActivityLog, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { exportToCSV } from '../lib/utils';
import { FileText, Search, Calendar, Filter, Activity, Download } from 'lucide-react';

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

  if (loading) return <div className="text-center py-12 text-slate-500 font-medium">Loading logs...</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="bg-mamas-card rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-mamas-text flex items-center gap-2">
            <FileText className="w-6 h-6 text-mamas-accent" /> Activity Log Viewer
          </h2>
          <p className="text-mamas-text-muted text-sm mt-1">
            System-wide trail of administrative actions ({filteredLogs.length} logs)
          </p>
        </div>
        {canExport && (
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by action, details, or user..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-mamas-accent outline-none font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-mamas-text text-xs rounded-xl px-3 py-2.5 outline-none font-bold"
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

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-mamas-accent outline-none"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-mamas-accent outline-none"
            />
          </div>
        </div>
      </div>

      {/* Mobile Card Layout */}
      <div className="md:hidden space-y-4">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-slate-500 bg-white rounded-2xl border border-slate-200">
            No logs found matching your filters.
          </div>
        ) : (
          filteredLogs.map(log => (
            <div key={log.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex justify-between items-start gap-2">
                <span className="font-bold text-sm text-mamas-text break-all">{log.action}</span>
                <span className="text-xs text-slate-400 whitespace-nowrap bg-slate-50 px-2 py-1 rounded">
                  {new Date(log.createdAt).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>
              <p className="text-xs text-slate-600 line-clamp-2">{log.details}</p>
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                  {(users[log.performedBy]?.fullName || '?')[0].toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-slate-600">
                  {users[log.performedBy]?.fullName || log.performedBy}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-4 font-bold">Date & Time</th>
                <th className="px-6 py-4 font-bold">User</th>
                <th className="px-6 py-4 font-bold">Action</th>
                <th className="px-6 py-4 font-bold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mb-3">
                        <Activity className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-mamas-text">No Activity Found</p>
                      <p className="text-xs text-slate-500 mt-1">No logs match your current filters. Try adjusting them.</p>
                      <button 
                        onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); }}
                        className="mt-4 text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-mamas-text px-4 py-2 rounded-xl transition-colors"
                      >
                        Clear Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-medium">
                      {new Date(log.createdAt).toLocaleString(undefined, {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                          {(users[log.performedBy]?.fullName || '?')[0].toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-700">
                          {users[log.performedBy]?.fullName || log.performedBy}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-bold text-slate-700">{log.action}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 max-w-md truncate" title={log.details}>
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
