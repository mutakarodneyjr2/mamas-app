import React from 'react';

export function StatusBadge({ status, className = '' }: { status?: string; className?: string }) {
  const s = (status || '').toLowerCase().trim();
  
  if (s === 'pending' || s === 'awaiting_approval') {
    return (
      <span className={`inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
        Pending
      </span>
    );
  }
  
  if (s === 'approved' || s === 'accepted' || s === 'verified' || s === 'completed') {
    return (
      <span className={`inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
        {s === 'verified' ? 'Verified' : s === 'completed' ? 'Completed' : 'Approved'}
      </span>
    );
  }
  
  if (s === 'active') {
    return (
      <span className={`inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
        Active
      </span>
    );
  }
  
  if (s === 'rejected' || s === 'declined' || s === 'failed') {
    return (
      <span className={`inline-flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
        {s === 'failed' ? 'Failed' : s === 'declined' ? 'Declined' : 'Rejected'}
      </span>
    );
  }
  
  if (s === 'paid') {
    return (
      <span className={`inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
        Paid
      </span>
    );
  }
  
  return (
    <span className={`inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
      {status || 'Unknown'}
    </span>
  );
}
