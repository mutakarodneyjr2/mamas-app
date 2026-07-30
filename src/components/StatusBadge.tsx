import React from 'react';

export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  
  if (s === 'pending') {
    return <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">Pending</span>;
  }
  if (s === 'approved' || s === 'accepted') {
    return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">Approved</span>;
  }
  if (s === 'rejected' || s === 'declined') {
    return <span className="bg-rose-50 text-rose-700 border border-rose-200 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">Rejected</span>;
  }
  if (s === 'paid') {
    return <span className="bg-slate-50 text-mamas-primary border border-slate-200 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">Paid</span>;
  }
  
  return <span className="bg-slate-50 text-slate-700 border border-slate-200 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">{status}</span>;
}
