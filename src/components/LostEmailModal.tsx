import React, { useState, useEffect } from 'react';
import { 
  X, Mail, Phone, User, GraduationCap, ShieldCheck, 
  CheckCircle, AlertCircle, RefreshCw, Copy, Check, 
  Search, ArrowRight, Clock, MessageSquare, Send, HelpCircle, ExternalLink
} from 'lucide-react';
import { useRegisterModal } from '../lib/nativeBack';
import { 
  submitRecoveryRequest, 
  getRecoveryStatus, 
  sendRecoveryMessage
} from '../lib/recoveryService';
import { AccountRecoveryRequest, AccountRecoveryStatus } from '../types';
import { safeFormatDate } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

interface LostEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillEmail?: string;
}

export function LostEmailModal({ isOpen, onClose, prefillEmail = '' }: LostEmailModalProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'request' | 'status'>('request');

  // Request form state
  const [fullName, setFullName] = useState('');
  const [oldEmail, setOldEmail] = useState(prefillEmail);
  const [newEmail, setNewEmail] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('Lost access to original email provider / password forgotten.');
  const [optionalProofNote, setOptionalProofNote] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Result state after submission
  const [submittedResult, setSubmittedResult] = useState<{
    referenceCode: string;
    status: AccountRecoveryStatus;
    message: string;
  } | null>(null);

  // Status lookup state
  const [lookupRef, setLookupRef] = useState('');
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [activeTicket, setActiveTicket] = useState<AccountRecoveryRequest | null>(null);

  // Reply message in status view
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [replySuccess, setReplySuccess] = useState('');

  useRegisterModal(isOpen && !loading && !lookupLoading, onClose, 'lost-email-modal');

  useEffect(() => {
    if (prefillEmail && !oldEmail) {
      setOldEmail(prefillEmail);
    }
  }, [prefillEmail]);

  if (!isOpen) return null;

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError('Please provide your registered full name.');
      return;
    }
    if (!oldEmail.trim() || !oldEmail.includes('@')) {
      setError('Please provide the previous email address registered with your account.');
      return;
    }
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setError('Please provide a valid new email address where you can receive notifications.');
      return;
    }
    if (oldEmail.trim().toLowerCase() === newEmail.trim().toLowerCase()) {
      setError('New email must be different from your lost email.');
      return;
    }

    setLoading(true);
    try {
      const res = await submitRecoveryRequest({
        fullName: fullName.trim(),
        oldEmail: oldEmail.trim().toLowerCase(),
        newEmail: newEmail.trim().toLowerCase(),
        graduationYear: graduationYear.trim() || 'Not specified',
        phone: phone.trim(),
        reason: reason.trim(),
        optionalProofNote: optionalProofNote.trim(),
      });

      setSubmittedResult({
        referenceCode: res.referenceCode || 'REC-UNKNOWN',
        status: res.status || 'submitted',
        message: res.message || 'Request submitted',
      });
    } catch (err: any) {
      console.error('Error submitting recovery ticket:', err);
      setError(err.message || 'Failed to submit recovery request. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLookupStatus = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLookupError('');
    setActiveTicket(null);

    if (!lookupRef.trim()) {
      setLookupError('Please enter your Reference Code (e.g. REC-XXXXXX).');
      return;
    }

    setLookupLoading(true);
    try {
      const res = await getRecoveryStatus(lookupRef.trim(), lookupEmail.trim());
      if (res.ticket) {
        setActiveTicket(res.ticket);
      } else {
        setLookupError('No ticket found with this reference code.');
      }
    } catch (err: any) {
      console.error('Error fetching ticket status:', err);
      setLookupError(err.message || 'Could not locate ticket. Please verify your reference code and email.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || !replyText.trim()) return;

    setReplyLoading(true);
    setReplySuccess('');
    setLookupError('');
    try {
      const res = await sendRecoveryMessage(
        activeTicket.referenceCode,
        lookupEmail.trim() || activeTicket.newEmail,
        replyText.trim()
      );
      setReplyText('');
      setReplySuccess('Your reply has been submitted to the review team.');
      setActiveTicket(prev => prev ? {
        ...prev,
        status: 'submitted',
        messages: res.messages
      } : null);
      setTimeout(() => setReplySuccess(''), 4000);
    } catch (err: any) {
      console.error('Error sending reply:', err);
      setLookupError(err.message || 'Failed to send message.');
    } finally {
      setReplyLoading(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleResetAndClose = () => {
    setSubmittedResult(null);
    setError('');
    setActiveTicket(null);
    setLookupError('');
    onClose();
  };

  const getStatusBadge = (status: AccountRecoveryStatus) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80">
            <Clock className="w-3.5 h-3.5" />
            Under Review
          </span>
        );
      case 'needs_info':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80">
            <MessageSquare className="w-3.5 h-3.5" />
            Action Required
          </span>
        );
      case 'approved_change':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
            <CheckCircle className="w-3.5 h-3.5" />
            Approved & Migrated
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80">
            <AlertCircle className="w-3.5 h-3.5" />
            Declined
          </span>
        );
      case 'not_found':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <HelpCircle className="w-3.5 h-3.5" />
            No Membership Record
          </span>
        );
      case 'closed':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Closed
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0c1731] w-full max-w-lg rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Account & Email Recovery</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Restore access without losing your membership or ledger</p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        {!submittedResult && (
          <div className="flex border-b border-slate-100 dark:border-slate-800 px-4 pt-2 bg-slate-50/50 dark:bg-slate-900/30">
            <button
              type="button"
              onClick={() => setTab('request')}
              className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition-colors cursor-pointer ${
                tab === 'request'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Submit Recovery
            </button>
            <button
              type="button"
              onClick={() => setTab('status')}
              className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition-colors cursor-pointer ${
                tab === 'status'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Track Request Status
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          
          {/* 1. Submitted Outcome View */}
          {submittedResult ? (
            <div className="py-4 space-y-4 animate-in zoom-in-95 duration-200">
              {submittedResult.status === 'not_found' ? (
                <div className="text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
                    <HelpCircle className="w-7 h-7" />
                  </div>
                  <div className="space-y-1 max-w-sm mx-auto">
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">No Registered Account Found</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                      We searched our database, but no active membership is associated with <span className="font-bold text-slate-800 dark:text-slate-100">{oldEmail}</span>.
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                      You do not need account recovery. You can register directly as a new member with your active email address.
                    </p>
                  </div>

                  <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        handleResetAndClose();
                        navigate('/register');
                      }}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                    >
                      <span>Create New Account</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubmittedResult(null)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 text-xs transition-colors"
                    >
                      Try Another Email
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                      <CheckCircle className="w-7 h-7" />
                    </div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">Recovery Request Submitted</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium max-w-sm mx-auto">
                      Your request is queued for manual verification by the association Super Admin. This is not instant access; your record will be verified against alumni records.
                    </p>
                  </div>

                  {/* Reference Code Card */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Your Reference Code
                    </span>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-lg font-mono font-extrabold text-blue-600 dark:text-blue-400 tracking-wider">
                        {submittedResult.referenceCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(submittedResult.referenceCode)}
                        className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                        title="Copy Reference Code"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Save this code to check the status of your recovery request at any time.
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setLookupRef(submittedResult.referenceCode);
                        setLookupEmail(newEmail);
                        setSubmittedResult(null);
                        setTab('status');
                        handleLookupStatus();
                      }}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Track Status Now</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetAndClose}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 text-xs transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : tab === 'request' ? (
            /* 2. Intake Form */
            <form onSubmit={handleSubmitRequest} className="space-y-3.5">
              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 rounded-2xl border border-blue-100 dark:border-blue-900/60 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed font-medium">
                  If you lost access to your registered email, fill in this form. When approved by leadership, your email is migrated safely to your new address while preserving all your contributions, statements, and roles.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="text-[11px] font-medium">{error}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                  Full Name (As registered in School) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <User className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. John Bosco Mukasa"
                    className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Previous Email (Lost) & New Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                    Previous (Lost) Email *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Mail className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="email"
                      required
                      value={oldEmail}
                      onChange={(e) => setOldEmail(e.target.value)}
                      placeholder="lost.email@example.com"
                      className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                    New Active Email *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Mail className="w-3.5 h-3.5 text-blue-500" />
                    </span>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="new.email@gmail.com"
                      className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Class Year & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                    Class Year (Left School)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <GraduationCap className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="text"
                      value={graduationYear}
                      onChange={(e) => setGraduationYear(e.target.value)}
                      placeholder="e.g. 2014"
                      className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                    Contact Phone Number
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Phone className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 0771234567"
                      className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                  Reason for Email Change *
                </label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Lost access to old SIM / forgot inbox password"
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                />
              </div>

              {/* Additional Proof / Notes */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                  Additional Proof / Verification Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={optionalProofNote}
                  onChange={(e) => setOptionalProofNote(e.target.value)}
                  placeholder="Any details to help committee identify you (e.g. House, Stream, Headmaster, Classmates, or previous contributions made)"
                  className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50 text-xs"
                >
                  {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{loading ? 'Submitting...' : 'Submit Request'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* 3. Status Lookup View */
            <div className="space-y-4">
              <form onSubmit={handleLookupStatus} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                      Reference Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={lookupRef}
                      onChange={(e) => setLookupRef(e.target.value.toUpperCase())}
                      placeholder="e.g. REC-7K2A9B"
                      className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-mono uppercase outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                      New Contact Email
                    </label>
                    <input
                      type="email"
                      value={lookupEmail}
                      onChange={(e) => setLookupEmail(e.target.value)}
                      placeholder="e.g. newemail@gmail.com"
                      className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={lookupLoading || !lookupRef.trim()}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {lookupLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    <span>Check Status</span>
                  </button>
                </div>
              </form>

              {lookupError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="text-[11px] font-medium">{lookupError}</span>
                </div>
              )}

              {/* Active Ticket Card */}
              {activeTicket && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Reference</span>
                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">{activeTicket.referenceCode}</span>
                    </div>
                    {getStatusBadge(activeTicket.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200/60 dark:border-slate-800">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Applicant:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{activeTicket.fullName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Submitted:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{safeFormatDate(activeTicket.createdAt)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Previous Email:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">{activeTicket.oldEmail}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">New Email:</span>
                      <span className="font-medium text-blue-600 dark:text-blue-400 truncate block">{activeTicket.newEmail}</span>
                    </div>
                  </div>

                  {/* Status specific notices */}
                  {activeTicket.status === 'approved_change' && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        <span>Account Recovery Approved!</span>
                      </div>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300/90 leading-relaxed">
                        Your MAMAS login email has been updated to <strong className="font-bold">{activeTicket.newEmail}</strong>. All previous contributions and membership records remain safely preserved under your account.
                      </p>
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            handleResetAndClose();
                            navigate('/login');
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow-sm flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Sign In with New Email</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTicket.status === 'rejected' && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 rounded-xl space-y-1">
                      <span className="font-bold text-rose-800 dark:text-rose-300 block text-xs">Request Declined</span>
                      <p className="text-[11px] text-rose-700 dark:text-rose-300/90 leading-relaxed">
                        {activeTicket.decisionNote || 'Identity verification could not be confirmed against school archives.'}
                      </p>
                    </div>
                  )}

                  {activeTicket.status === 'needs_info' && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 rounded-xl space-y-2">
                      <span className="font-bold text-blue-900 dark:text-blue-200 block text-xs">Admin Note: Action Required</span>
                      <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed font-medium">
                        {activeTicket.decisionNote || 'Please provide additional clarification or identification proof.'}
                      </p>
                    </div>
                  )}

                  {/* Message Thread */}
                  {activeTicket.messages && activeTicket.messages.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Communication History
                      </span>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {activeTicket.messages.map((m, idx) => (
                          <div 
                            key={idx} 
                            className={`p-2 rounded-xl text-[11px] ${
                              m.by === 'admin' 
                                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-950 dark:text-blue-200 border border-blue-100 dark:border-blue-900'
                                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 mb-0.5">
                              <span>{m.by === 'admin' ? 'Admin Team' : 'You (Applicant)'}</span>
                              <span>{safeFormatDate(m.at)}</span>
                            </div>
                            <p className="leading-snug">{m.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reply Box when needs_info or active */}
                  {activeTicket.status === 'needs_info' && (
                    <form onSubmit={handleSendReply} className="pt-2 space-y-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Reply to Review Team
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Provide the requested clarification..."
                          className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                        />
                        <button
                          type="submit"
                          disabled={replyLoading || !replyText.trim()}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                        >
                          {replyLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          <span>Reply</span>
                        </button>
                      </div>
                      {replySuccess && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">{replySuccess}</p>
                      )}
                    </form>
                  )}

                </div>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
