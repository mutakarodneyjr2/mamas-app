import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Heart, Target, Lock, Loader2, Info } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { SelectDropdown } from '../components/SelectDropdown';

export default function Contribute() {
  const { currentUser, userProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [purpose, setPurpose] = useState<'welfare' | 'campaign'>(searchParams.get('campaignId') ? 'campaign' : 'welfare');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState(userProfile?.phoneNumber || '');
  const [network, setNetwork] = useState('MTN');
  const [campaignId, setCampaignId] = useState(searchParams.get('campaignId') || '');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchCampaigns() {
      const snap = await getDocs(query(collection(db, 'campaigns'), where('status', '==', 'active')));
      setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    fetchCampaigns();
  }, []);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseInt(amount) < 1000) {
      setError('Minimum contribution is UGX 1,000');
      return;
    }
    if (purpose === 'campaign' && !campaignId) {
      setError('Please select a campaign');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Create contribution record (status pending)
      const contributionRef = await addDoc(collection(db, 'contributions'), {
        userId: currentUser?.uid,
        userName: userProfile?.fullName,
        amount: parseInt(amount),
        purpose: purpose,
        campaignId: purpose === 'campaign' ? campaignId : null,
        phone: phone,
        network: network,
        status: 'pending',
        timestamp: serverTimestamp(),
      });
      
      // Simulate Relworx Payment Flow / redirect
      setTimeout(() => {
        setLoading(false);
        navigate('/statement');
      }, 2000);
      
    } catch (err: any) {
      setError(err.message || 'Payment failed to initiate');
      setLoading(false);
    }
  };

  const presetAmounts = [5000, 10000, 20000, 50000, 100000];

  return (
    <div className="max-w-2xl mx-auto w-full pb-8 animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Make a Contribution</h1>
        <p className="text-gray-500 mt-1 text-sm">Support welfare or school campaigns instantly.</p>
      </div>

      <form onSubmit={handlePay} className="space-y-8">
        {error && (
          <div className="bg-rose-50 text-rose-700 p-4 rounded-2xl text-sm font-medium border border-rose-100">
            {error}
          </div>
        )}

        {/* PURPOSE SELECTION */}
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setPurpose('welfare')}
            className={`p-5 rounded-3xl flex flex-col items-center justify-center text-center transition-all ${
              purpose === 'welfare' 
                ? 'bg-rose-50 border-2 border-rose-200 shadow-sm' 
                : 'bg-white border border-gray-100 hover:bg-gray-50'
            }`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${purpose === 'welfare' ? 'bg-white' : 'bg-rose-50'}`}>
              <Heart className={`w-6 h-6 ${purpose === 'welfare' ? 'text-rose-500' : 'text-rose-400'}`} />
            </div>
            <span className={`font-bold ${purpose === 'welfare' ? 'text-rose-700' : 'text-gray-700'}`}>Welfare Fund</span>
          </button>
          
          <button
            type="button"
            onClick={() => setPurpose('campaign')}
            className={`p-5 rounded-3xl flex flex-col items-center justify-center text-center transition-all ${
              purpose === 'campaign' 
                ? 'bg-amber-50 border-2 border-mamas-accent shadow-sm' 
                : 'bg-white border border-gray-100 hover:bg-gray-50'
            }`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${purpose === 'campaign' ? 'bg-white' : 'bg-amber-50'}`}>
              <Target className={`w-6 h-6 ${purpose === 'campaign' ? 'text-mamas-accent' : 'text-amber-500'}`} />
            </div>
            <span className={`font-bold ${purpose === 'campaign' ? 'text-amber-700' : 'text-gray-700'}`}>School Campaign</span>
          </button>
        </div>

        {purpose === 'campaign' && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 animate-in slide-in-from-top-4">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              Select Campaign
            </label>
            <SelectDropdown
              options={campaigns.map(c => ({ label: c.title, value: c.id }))}
              value={campaignId}
              onChange={setCampaignId}
              placeholder="Choose a campaign to support"
            />
          </div>
        )}

        {/* AMOUNT INPUT */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Amount (UGX)
          </label>
          
          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
              <span className="text-gray-400 font-bold text-xl">UGX</span>
            </div>
            <input
              type="number"
              required
              min="1000"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full pl-20 pr-6 py-5 bg-gray-50 border-2 border-gray-100 rounded-2xl text-3xl font-bold text-gray-900 focus:outline-none focus:border-mamas-accent focus:bg-white transition-all text-right"
              placeholder="0"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            {presetAmounts.map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset.toString())}
                className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-full text-sm font-semibold border border-gray-200 transition-colors"
              >
                {preset.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* NETWORK & PHONE */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Payment Method
          </label>
          <div className="flex gap-4">
            <div className="w-1/3">
              <SelectDropdown
                options={[
                  { label: 'MTN MoMo', value: 'MTN' },
                  { label: 'Airtel Money', value: 'Airtel' }
                ]}
                value={network}
                onChange={setNetwork}
              />
            </div>
            <div className="w-2/3 relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-gray-400 font-medium">+256</span>
              </div>
              <input
                type="tel"
                required
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full pl-16 pr-4 py-3 h-full bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-medium focus:outline-none focus:border-mamas-accent focus:bg-white transition-all"
                placeholder="7XX XXX XXX"
              />
            </div>
          </div>
        </div>

        {/* PAY BUTTON */}
        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-mamas-primary text-white rounded-full py-4 text-lg font-bold shadow-xl shadow-mamas-primary/20 hover:bg-mamas-primary-hover active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Processing...
              </>
            ) : (
              `Pay ${amount ? `UGX ${parseInt(amount).toLocaleString()}` : ''}`
            )}
          </button>
          <div className="mt-4 flex items-center justify-center gap-2 text-gray-400">
            <Lock className="w-3.5 h-3.5" />
            <span className="text-xs">Secured by Relworx Mobile Money</span>
          </div>
        </div>
      </form>
    </div>
  );
}
