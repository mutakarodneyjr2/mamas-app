import React, { useState, useEffect } from 'react';
import { 
  fetchAdminRecoveryList, 
  adminRecoveryAction, 
  adminApproveRecovery 
} from '../lib/recoveryService';
import { AccountRecoveryRequest, AccountRecoveryStatus } from '../types';
import { safeFormatDate } from '../lib/utils';
import { 
  ShieldCheck, Search, Filter, RefreshCw, CheckCircle, 
  AlertCircle, MessageSquare, Clock, ArrowRight, X, 
  HelpCircle, UserCheck, Send, Check, AlertTriangle
} from 'lucide-react';

export function AdminAccountRecoveryQueue() {
  const [requests, setRequests] = useState<AccountRecoveryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modal / Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [approvingTicket, setApprovingTicket] = useState<AccountRecoveryRequest | null>(null);
  const [approveNote, setApproveNote] = useState('');

  const [requestingInfoTicket, setRequestingInfoTicket] = useState<AccountRecoveryRequest | null>(null);
  const [infoMessage, setInfoMessage] = useState('');

  const [rejectingTicket, setRejectingTicket] = useState<AccountRecoveryRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadRequests = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await fetchAdminRecoveryList();
      setRequests(data);
    } catch (err: any) {
      console.error('Failed to load recovery requests:', err);
      setErrorMsg(err.message || 'Could not load account recovery queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const filteredRequests = requests.filter(req => {
    if (statusFilter !== 'all' && req.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchRef = req.referenceCode?.toLowerCase().includes(term);
      const matchName = req.fullName?.toLowerCase().includes(term);
      const matchOld = req.oldEmail?.toLowerCase().includes(term);
      const matchNew = req.newEmail?.toLowerCase().includes(term);
      const matchPhone = req.phone?.toLowerCase().includes(term);
      return matchRef || matchName || matchOld || matchNew || matchPhone;
    }
    return true;
  });

  const handleApproveSubmit = async () => {
    if (!approvingTicket) return;
    setActionLoading(approvingTicket.id);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await adminApproveRecovery(approvingTicket.id, approveNote.trim());
      setSuccessMsg(res.message || `Account recovery approved for ${approvingTicket.fullName}. Email updated to ${approvingTicket.newEmail}.`);
      setApprovingTicket(null);
      setApproveNote('');
      await loadRequests();
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err: any) {
      console.error('Approval failed:', err);
      setErrorMsg(err.message || 'Approval failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestInfoSubmit = async () => {
    if (!requestingInfoTicket || !infoMessage.trim()) return;
    setActionLoading(requestingInfoTicket.id);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await adminRecoveryAction(
        requestingInfoTicket.id,
        'request_info',
        infoMessage.trim(),
        infoMessage.trim()
      );
      setSuccessMsg(`Information request sent to ${requestingInfoTicket.fullName}.`);
      setRequestingInfoTicket(null);
      setInfoMessage('');
      await loadRequests();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Action failed:', err);
      setErrorMsg(err.message || 'Failed to update request.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectingTicket || !rejectReason.trim()) return;
    setActionLoading(rejectingTicket.id);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await adminRecoveryAction(
        rejectingTicket.id,
        'reject',
        rejectReason.trim()
      );
      setSuccessMsg(`Recovery ticket for ${rejectingTicket.fullName} marked as declined.`);
      setRejectingTicket(null);
      setRejectReason('');
      await loadRequests();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Action failed:', err);
      setErrorMsg(err.message || 'Failed to decline request.');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: AccountRecoveryStatus) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80">
            <Clock className="w-3 h-3" />
            Under Review
          </span>
        );
      case 'needs_info':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80">
            <MessageSquare className="w-3 h-3" />
            Needs Info
          </span>
        );
      case 'approved_change':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80">
            <AlertCircle className="w-3 h-3" />
            Declined
          </span>
        );
      case 'not_found':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <HelpCircle className="w-3 h-3" />
            No Match
          </span>
        );
      case 'closed':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Closed
          </span>
        );
    }
  };

  const pendingCount = requests.filter(r => r.status === 'submitted' || r.status === 'needs_info').length;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      
      {/* Overview Banner */}
      <div className="bg-white dark:bg-[#0c1731] p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Account Recovery Requests</h3>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-extrabold">
                  {pendingCount} Pending
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verify lost email recovery requests against alumni archives. Approving updates Auth email while preserving the member's UID, contributions, and financial ledger.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadRequests}
          disabled={loading}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#0c1731] rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs space-y-3">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Reference Code, name, old email, or new email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 py-2.5 pl-11 pr-4 text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {[
            { label: `All (${requests.length})`, value: 'all' },
            { label: 'Under Review', value: 'submitted' },
            { label: 'Needs Info', value: 'needs_info' },
            { label: 'Approved', value: 'approved_change' },
            { label: 'Declined', value: 'rejected' },
            { label: 'No Match', value: 'not_found' },
            { label: 'Closed', value: 'closed' },
          ].map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => setStatusFilter(p.value)}
              className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-colors cursor-pointer ${
                statusFilter === p.value
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* List of Requests */}
      {loading ? (
        <div className="p-8 text-center bg-white dark:bg-[#0c1731] rounded-3xl border border-slate-200/80 dark:border-slate-800">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading recovery queue...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-[#0c1731] rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-2">
          <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Recovery Requests Found</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'all' 
              ? 'No requests match your current search and status filter.'
              : 'There are currently no active account recovery requests in the queue.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map(req => {
            const isExpanded = expandedId === req.id;
            const canAct = req.status === 'submitted' || req.status === 'needs_info';

            return (
              <div 
                key={req.id} 
                className={`bg-white dark:bg-[#0c1731] rounded-3xl border transition-all overflow-hidden ${
                  isExpanded 
                    ? 'border-blue-400 dark:border-blue-700 shadow-md ring-1 ring-blue-500/20' 
                    : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                }`}
              >
                {/* Header Row */}
                <div 
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      {req.graduationYear ? req.graduationYear : 'ALUM'}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {req.fullName}
                        </span>
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400">
                          {req.referenceCode}
                        </span>
                        {getStatusBadge(req.status)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
                        <span className="line-through opacity-80">{req.oldEmail}</span>
                        <ArrowRight className="w-3 h-3 text-blue-500" />
                        <span className="font-semibold text-blue-600 dark:text-blue-400">{req.newEmail}</span>
                        {req.phone && <span>• Phone: {req.phone}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {safeFormatDate(req.createdAt)}
                    </span>
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold"
                    >
                      {isExpanded ? 'Hide' : 'Details'}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-5 pt-1 sm:px-5 border-t border-slate-100 dark:border-slate-800 space-y-4 text-xs">
                    
                    {/* Database Match Status */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Matched Membership Record
                        </span>
                        {req.targetUid ? (
                          <div className="mt-1 space-y-0.5">
                            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>UID: {req.targetUid}</span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                              Status: <strong className="font-semibold">{req.matchedUserStatus || 'Active'}</strong> | Role: <strong className="font-semibold">{req.matchedUserRole || 'Member'}</strong>
                            </p>
                          </div>
                        ) : (
                          <div className="mt-1 flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>No existing account matched the previous email.</span>
                          </div>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Reason for Request
                        </span>
                        <p className="mt-1 text-slate-700 dark:text-slate-300 font-medium">
                          {req.reason}
                        </p>
                        {req.optionalProofNote && (
                          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 italic">
                            Proof notes: "{req.optionalProofNote}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Messages / Communication Thread */}
                    {req.messages && req.messages.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Ticket Message History
                        </span>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {req.messages.map((m, idx) => (
                            <div 
                              key={idx} 
                              className={`p-2.5 rounded-xl ${
                                m.by === 'admin'
                                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 border border-blue-100 dark:border-blue-900'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-0.5">
                                <span>{m.by === 'admin' ? 'Admin Note' : 'Applicant Response'}</span>
                                <span>{safeFormatDate(m.at)}</span>
                              </div>
                              <p className="leading-relaxed">{m.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Decision Note if already decided */}
                    {req.decisionNote && (
                      <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-slate-700 dark:text-slate-300">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                          Admin Decision Log:
                        </span>
                        <p className="leading-snug">{req.decisionNote}</p>
                      </div>
                    )}

                    {/* Admin Action Bar */}
                    {canAct && (
                      <div className="pt-2 flex flex-wrap items-center justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setRequestingInfoTicket(req);
                            setInfoMessage('');
                          }}
                          className="px-3.5 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Request Info</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setRejectingTicket(req);
                            setRejectReason('Identity verification could not be confirmed against alumni records.');
                          }}
                          className="px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 font-bold hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Decline Request</span>
                        </button>

                        {req.targetUid ? (
                          <button
                            type="button"
                            onClick={() => {
                              setApprovingTicket(req);
                              setApproveNote(`Approved by Super Admin. Email address migrated from ${req.oldEmail} to ${req.newEmail}.`);
                            }}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve & Migrate Email</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400 italic">
                            Cannot approve: no matching UID located.
                          </span>
                        )}
                      </div>
                    )}

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Approve & Migrate Confirmation */}
      {approvingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#0c1731] w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Approve Email Migration
                </h3>
              </div>
              <button 
                onClick={() => setApprovingTicket(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Applicant:</span>
                <span className="font-bold text-slate-900 dark:text-white">{approvingTicket.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Target UID:</span>
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{approvingTicket.targetUid}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Old Email:</span>
                <span className="line-through text-slate-500">{approvingTicket.oldEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">New Email:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{approvingTicket.newEmail}</span>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed font-medium">
              This action will securely update the Firebase Auth login email to <strong>{approvingTicket.newEmail}</strong>. All financial records, ledger rows, and welfare history attached to UID <strong>{approvingTicket.targetUid}</strong> will remain intact.
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Admin Audit Note (Optional)
              </label>
              <input
                type="text"
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                placeholder="Reason or reference for approval"
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setApprovingTicket(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading === approvingTicket.id}
                onClick={handleApproveSubmit}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {actionLoading === approvingTicket.id && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm & Migrate</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Request Info Modal */}
      {requestingInfoTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#0c1731] w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Request Clarification
                </h3>
              </div>
              <button 
                onClick={() => setRequestingInfoTicket(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Send a request to <strong className="font-bold text-slate-800 dark:text-slate-200">{requestingInfoTicket.fullName}</strong>. They will see this message when checking their ticket status.
            </p>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Question / Required Proof *
              </label>
              <textarea
                rows={3}
                required
                value={infoMessage}
                onChange={(e) => setInfoMessage(e.target.value)}
                placeholder="e.g. Please state which house you were in or your stream in S.4 to verify identity."
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRequestingInfoTicket(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading === requestingInfoTicket.id || !infoMessage.trim()}
                onClick={handleRequestInfoSubmit}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {actionLoading === requestingInfoTicket.id && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Send Request</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Decline Request Modal */}
      {rejectingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#0c1731] w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Decline Recovery Request
                </h3>
              </div>
              <button 
                onClick={() => setRejectingTicket(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Decline the recovery request for <strong className="font-bold text-slate-800 dark:text-slate-200">{rejectingTicket.fullName}</strong>. Provide a reason that will be visible to the user.
            </p>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Reason for Declining *
              </label>
              <textarea
                rows={3}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Identity could not be validated against alumni archives."
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectingTicket(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading === rejectingTicket.id || !rejectReason.trim()}
                onClick={handleRejectSubmit}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {actionLoading === rejectingTicket.id && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Decline</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
