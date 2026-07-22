import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getMemberStatement } from '../lib/services';
import { Contribution, WelfareRequest } from '../types';
import { formatUGX } from '../lib/utils';
import { FileText, Download, CheckCircle, Clock, XCircle, Heart, Target, Wallet } from 'lucide-react';

export default function Statement() {
  const { currentUser } = useAuth();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [welfareRequests, setWelfareRequests] = useState<WelfareRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      getMemberStatement(currentUser.uid).then(data => {
        setContributions(data.contributions);
        setWelfareRequests(data.welfareRequests);
        setLoading(false);
      });
    }
  }, [currentUser]);

  if (loading) return <div className="p-10 text-center text-mamas-text-muted font-medium">Loading statement statement...</div>;

  const welfareContributions = contributions.filter(c => c.type === 'welfare');
  const campaignContributions = contributions.filter(c => c.type === 'school_support');

  const totalVerifiedWelfare = welfareContributions
    .filter(c => c.status === 'verified')
    .reduce((sum, c) => sum + c.amount, 0);
  
  const totalVerifiedCampaigns = campaignContributions
    .filter(c => c.status === 'verified')
    .reduce((sum, c) => sum + c.amount, 0);

  const totalVerifiedAll = totalVerifiedWelfare + totalVerifiedCampaigns;

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'verified': case 'paid': return <CheckCircle className="w-4 h-4 text-teal-600" />;
      case 'pending': return <Clock className="w-4 h-4 text-amber-600" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-rose-600" />;
      default: return null;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'verified': case 'paid': return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'pending': return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'rejected': return 'bg-rose-50 text-rose-800 border-rose-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-display font-bold text-mamas-text flex items-center gap-2">
            <FileText className="w-6 h-6 text-mamas-accent" /> Financial Statement
          </h2>
          <p className="text-mamas-text-muted text-sm mt-1">Official statement of member contributions and welfare aid history.</p>
        </div>
        <button 
          onClick={() => window.print()}
          className="inline-flex items-center justify-center gap-2 bg-mamas-card hover:bg-slate-50 text-mamas-text border border-slate-200 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-sm active:scale-95"
        >
          <Download className="w-4 h-4 text-mamas-primary" /> Download / Print PDF
        </button>
      </div>

      {/* Balanced Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Total Contributions */}
        <div className="bg-gradient-to-br from-mamas-primary to-mamas-primary-hover text-white p-5 rounded-3xl shadow-sm flex flex-col justify-between border border-mamas-primary-hover">
          <div className="flex items-center justify-between text-mamas-accent mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
              Total Verified
            </span>
            <Wallet className="w-4 h-4" />
          </div>
          <p className="text-2xl font-display font-bold tracking-tight text-white mt-1">{formatUGX(totalVerifiedAll)}</p>
          <p className="text-[11px] text-slate-300 font-medium mt-1">Combined Contributions</p>
        </div>

        {/* Welfare Contributions */}
        <div className="bg-mamas-card border border-slate-200/90 p-5 rounded-3xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-500 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-mamas-text-muted">
              Welfare Fund
            </span>
            <Heart className="w-4 h-4" />
          </div>
          <p className="text-2xl font-display font-bold text-mamas-text mt-1">{formatUGX(totalVerifiedWelfare)}</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Regular Member Dues</p>
        </div>

        {/* School Campaigns */}
        <div className="bg-mamas-card border border-slate-200/90 p-5 rounded-3xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-mamas-accent mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-mamas-text-muted">
              School Campaigns
            </span>
            <Target className="w-4 h-4 text-mamas-accent" />
          </div>
          <p className="text-2xl font-display font-bold text-mamas-text mt-1">{formatUGX(totalVerifiedCampaigns)}</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Alumni Projects</p>
        </div>

      </div>

      {/* Lists Section */}
      <div className="space-y-6">
        
        {/* Welfare Contributions */}
        <div className="bg-mamas-card border border-slate-200/90 rounded-3xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-base font-bold text-mamas-text flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500" /> Welfare Dues Ledger
            </h3>
            <span className="text-xs text-slate-400 font-medium">{welfareContributions.length} item(s)</span>
          </div>

          <ul className="divide-y divide-slate-100">
            {welfareContributions.length === 0 ? (
              <li className="px-6 py-8 text-center text-xs text-mamas-text-muted italic">No welfare dues logged yet.</li>
            ) : (
              welfareContributions.map(c => (
                <li key={c.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex-1">
                    <p className="text-base font-bold text-mamas-text">{formatUGX(c.amount)}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-xs font-mono font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                        Ref: {c.transactionReference}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(c.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusClass(c.status)}`}>
                      <StatusIcon status={c.status} /> {c.status}
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Campaign Contributions */}
        <div className="bg-mamas-card border border-slate-200/90 rounded-3xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-base font-bold text-mamas-text flex items-center gap-2">
              <Target className="w-4 h-4 text-mamas-accent" /> School Campaign Ledger
            </h3>
            <span className="text-xs text-slate-400 font-medium">{campaignContributions.length} item(s)</span>
          </div>

          <ul className="divide-y divide-slate-100">
            {campaignContributions.length === 0 ? (
              <li className="px-6 py-8 text-center text-xs text-mamas-text-muted italic">No campaign contributions logged yet.</li>
            ) : (
              campaignContributions.map(c => (
                <li key={c.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex-1">
                    <p className="text-base font-bold text-mamas-text">{formatUGX(c.amount)}</p>
                    <p className="text-xs font-semibold text-mamas-primary mt-0.5">Campaign: {c.campaignTitle}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-xs font-mono font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                        Ref: {c.transactionReference}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(c.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusClass(c.status)}`}>
                      <StatusIcon status={c.status} /> {c.status}
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Welfare Requests History */}
        <div className="bg-mamas-card border border-slate-200/90 rounded-3xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-base font-bold text-mamas-text flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500" /> My Welfare Aid Requests
            </h3>
            <span className="text-xs text-slate-400 font-medium">{welfareRequests.length} item(s)</span>
          </div>

          <ul className="divide-y divide-slate-100">
            {welfareRequests.length === 0 ? (
              <li className="px-6 py-8 text-center text-xs text-mamas-text-muted italic">No welfare aid claims submitted.</li>
            ) : (
              welfareRequests.map(r => (
                <li key={r.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex-1">
                    <p className="font-bold text-mamas-text text-sm">
                      {r.category} <span className="text-slate-400 font-normal">({r.relationship})</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{r.description}</p>
                    {r.paidAmount && (
                      <p className="text-xs font-bold text-teal-700 mt-1">Disbursed: {formatUGX(r.paidAmount)}</p>
                    )}
                  </div>

                  <div className="flex flex-col sm:items-end gap-1">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusClass(r.status)}`}>
                      <StatusIcon status={r.status} /> {r.status}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(r.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

      </div>
    </div>
  );
}
