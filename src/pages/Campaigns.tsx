import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { SchoolCampaign } from '../types';
import { Link } from 'react-router-dom';
import { formatUGX, DEFAULT_CAMPAIGN_PLACEHOLDER } from '../lib/utils';
import { Target } from 'lucide-react';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<SchoolCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'schoolCampaigns'),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolCampaign));
      list.sort((a, b) => b.createdAt - a.createdAt);
      setCampaigns(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <div className="text-center py-12 text-mamas-text-muted">Loading campaigns...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-mamas-card rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-2xl font-bold text-mamas-text">School Support Campaigns</h2>
        <p className="text-mamas-text-muted text-sm mt-1">
          Support specific initiatives and infrastructure projects for our alma mater.
        </p>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-mamas-card rounded-3xl shadow-sm border border-slate-100 p-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-mamas-primary/10 text-mamas-primary rounded-full flex items-center justify-center mb-4">
            <Target className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-mamas-text mb-2">No Active Campaigns</h3>
          <p className="text-slate-500 max-w-md mx-auto text-sm">
            There are no ongoing school support campaigns at this time. Check back later for new initiatives to support our alma mater.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {campaigns.map(campaign => {
            const progress = campaign.targetAmount > 0 
              ? Math.min(100, (campaign.raisedAmount / campaign.targetAmount) * 100) 
              : 0;

            return (
              <div key={campaign.id} className="bg-mamas-card rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="w-full h-48 bg-slate-100 relative">
                  <img 
                    src={(campaign.imageUrls && campaign.imageUrls[0]) || campaign.imageUrl || DEFAULT_CAMPAIGN_PLACEHOLDER} 
                    alt={campaign.title} 
                    className="w-full h-full object-cover" 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_CAMPAIGN_PLACEHOLDER;
                    }}
                  />
                </div>
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold text-mamas-text">{campaign.title}</h3>
                    <span className="px-2 py-1 bg-teal-50 text-mamas-success text-xs font-semibold rounded-full uppercase">
                      Active
                    </span>
                  </div>
                  <p className="text-sm text-mamas-text-muted mb-6">{campaign.description}</p>
                  
                  <div className="mt-auto space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-mamas-text">{formatUGX(campaign.raisedAmount)} Raised</span>
                      <span className="text-mamas-text-muted">Goal: {formatUGX(campaign.targetAmount)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div className="bg-mamas-primary h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                    </div>
                    <p className="text-xs text-right text-mamas-text-muted">{progress.toFixed(1)}% Funded</p>
                  </div>
                </div>
                
                <div className="bg-mamas-bg px-6 py-4 border-t border-slate-200">
                  <Link 
                    to={`/contribute?campaignId=${campaign.id}`}
                    className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-mamas-primary hover:bg-mamas-primary-hover focus:outline-none"
                  >
                    Contribute to this Campaign
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
