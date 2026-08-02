import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Heart, Target, Lock, Loader2, Check, Smartphone, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, doc, onSnapshot, getDoc, serverTimestamp } from 'firebase/firestore';
import { SelectDropdown } from '../components/SelectDropdown';
import { normalizePhoneNumber } from '../lib/utils';

export default function Contribute() {
  const { currentUser, userProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const initialCampaignId = searchParams.get('campaignId') || '';
  const [purpose, setPurpose] = useState<'welfare' | 'campaign'>(initialCampaignId ? 'campaign' : 'welfare');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState(userProfile?.phoneNumber || '');
  const [network, setNetwork] = useState('MTN');
  const [campaignId, setCampaignId] = useState(initialCampaignId);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingCampaigns, setFetchingCampaigns] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Payment prompt state
  const [promptSent, setPromptSent] = useState(false);
  const [pendingDocId, setPendingDocId] = useState<string | null>(null);
  const [normalizedPhoneUsed, setNormalizedPhoneUsed] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [pollingMessage, setPollingMessage] = useState('Waiting for mobile money PIN confirmation...');

  useEffect(() => {
    async function fetchCampaigns() {
      if (!currentUser) return;
      setFetchingCampaigns(true);
      try {
        const q = query(collection(db, 'schoolCampaigns'), where('status', '==', 'active'));
        const snap = await getDocs(q);
        setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.warn("Could not query active schoolCampaigns:", err);
        try {
          const snapAll = await getDocs(collection(db, 'schoolCampaigns'));
          setCampaigns(
            snapAll.docs
              .map(d => ({ id: d.id, ...d.data() }))
              .filter((c: any) => (c.status || '').toLowerCase() === 'active')
          );
        } catch (e) {
          console.error("Failed to load schoolCampaigns:", e);
        }
      } finally {
        setFetchingCampaigns(false);
      }
    }

    if (purpose === 'campaign') {
      fetchCampaigns();
    }
  }, [currentUser, purpose]);

  // Realtime listener for pending payment status
  useEffect(() => {
    if (!promptSent || !pendingDocId) return;

    const unsubscribe = onSnapshot(doc(db, 'contributions', pendingDocId), (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();

      if (data?.status === 'verified') {
        setSuccess(true);
        setPromptSent(false);
        setTimeout(() => {
          navigate('/statement');
        }, 1500);
      } else if (data?.status === 'failed') {
        setError('Payment not completed or was declined on your phone. Please try again.');
        setPromptSent(false);
      }
    }, (err) => {
      console.error("Error listening to contribution status:", err);
    });

    // Fallback polling timer (stop after 60s)
    const timeoutTimer = setTimeout(() => {
      setPollingMessage('Payment is taking longer than usual. If you entered your PIN, click Refresh Status below.');
    }, 30000);

    return () => {
      unsubscribe();
      clearTimeout(timeoutTimer);
    };
  }, [promptSent, pendingDocId, navigate]);

  const handleManualRefresh = async () => {
    if (!pendingDocId) return;
    setCheckingStatus(true);
    try {
      const docSnap = await getDoc(doc(db, 'contributions', pendingDocId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data?.status === 'verified') {
          setSuccess(true);
          setPromptSent(false);
          setTimeout(() => {
            navigate('/statement');
          }, 1500);
        } else if (data?.status === 'failed') {
          setError('Payment not completed or was declined on Mobile Money. Please try again.');
          setPromptSent(false);
        } else {
          setPollingMessage('Still waiting for payment verification. Ensure you have entered your PIN.');
        }
      }
    } catch (err: any) {
      console.error("Error checking document status:", err);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setError('You must be logged in to contribute.');
      return;
    }

    const numericAmount = parseInt(amount, 10);
    if (isNaN(numericAmount) || numericAmount < 1000) {
      setError('Minimum contribution amount is UGX 1,000');
      return;
    }

    if (purpose === 'campaign' && !campaignId) {
      setError('Please select a campaign to support');
      return;
    }

    // Phone number normalization and validation
    const normPhone = normalizePhoneNumber(phone);
    const digitsOnly = normPhone.replace(/[^0-9]/g, '');
    if (!normPhone.startsWith('+256') || digitsOnly.length < 12 || digitsOnly.length > 13) {
      setError('Please enter a valid Ugandan phone number (e.g. 0771234567 or +256771234567).');
      return;
    }

    // Set loading state immediately (synchronous)
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const contribType = purpose === 'campaign' ? 'school_support' : 'welfare';

      // 1. Create Firestore contribution doc
      const docRef = await addDoc(collection(db, 'contributions'), {
        userId: currentUser.uid,
        userName: userProfile?.fullName || 'Anonymous',
        amount: numericAmount,
        purpose: purpose,
        type: contribType,
        campaignId: purpose === 'campaign' ? campaignId : null,
        phoneNumber: normPhone,
        network: network,
        status: 'pending',
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      // 2. Obtain ID Token for API Authorization
      const idToken = await currentUser.getIdToken();

      // 3. Call Backend Relworx Initiate Collection API with 30s timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch('/api/relworx/initiate-collection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          amount: numericAmount,
          phoneNumber: normPhone,
          network: network,
          userId: currentUser.uid,
          purpose: purpose,
          metadata: {
            contributionId: docRef.id,
            reference: docRef.id,
            userName: userProfile?.fullName || 'Anonymous',
            campaignId: purpose === 'campaign' ? campaignId : null
          }
        })
      });

      clearTimeout(timeoutId);

      const resData = await response.json().catch(() => ({}));

      if (!response.ok || !resData.success) {
        throw new Error(resData.message || 'Failed to initiate Mobile Money prompt. Please try again.');
      }

      // 4. Success initiating prompt - Show Mobile Money check phone card
      setNormalizedPhoneUsed(normPhone);
      setPendingDocId(docRef.id);
      setPromptSent(true);

    } catch (err: any) {
      console.error("Payment submission failed:", err);
      if (err.name === 'AbortError') {
        setError('Payment request timed out after 30 seconds. Please try again.');
      } else {
        setError(err.message || 'Contribution failed to process. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const presetAmounts = [1000, 2000, 5000, 10000, 20000, 50000, 100000];

  return (
    <div className="max-w-2xl mx-auto w-full pb-12 animate-in fade-in duration-300">
      
      {/* HEADER BANNER */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800 mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight">Make a Contribution</h1>
        <p className="text-slate-300 text-sm mt-1">
          Support the Welfare Relief Fund or back active school infrastructure campaigns via Mobile Money.
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-700 p-4 rounded-2xl text-sm font-bold border border-rose-200 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 text-emerald-800 p-6 rounded-3xl text-sm font-bold border border-emerald-200 flex items-center gap-3 mb-6 shadow-sm">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          <div>
            <div className="text-base font-extrabold text-emerald-900">Payment Verified!</div>
            <div className="text-emerald-700 text-xs mt-0.5">Your contribution was successfully recorded. Redirecting to your statement...</div>
          </div>
        </div>
      )}

      {/* MOBILE MONEY PROMPT SENT CARD */}
      {promptSent ? (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-amber-200 space-y-6 animate-in zoom-in-95 duration-200">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center shrink-0">
              <Smartphone className="w-7 h-7 text-amber-600 animate-bounce" />
            </div>
            <div>
              <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-extrabold uppercase tracking-wide">
                Prompt Sent
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 mt-1">Check Your Phone</h2>
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2">
            <p className="text-sm font-semibold text-slate-700">
              A Mobile Money payment prompt of <span className="font-extrabold text-slate-900">UGX {parseInt(amount || '0', 10).toLocaleString()}</span> has been sent to:
            </p>
            <div className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <span>{normalizedPhoneUsed}</span>
              <span className="text-xs px-2.5 py-0.5 bg-slate-200 text-slate-700 rounded-lg">{network}</span>
            </div>
            <p className="text-xs text-slate-500 font-medium pt-1">
              Please enter your Mobile Money PIN on your handset to approve the transaction.
            </p>
          </div>

          <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-900 text-xs font-semibold">
            <Loader2 className="w-5 h-5 text-amber-600 animate-spin shrink-0" />
            <span>{pollingMessage}</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={checkingStatus}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-3.5 px-5 rounded-2xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${checkingStatus ? 'animate-spin' : ''}`} />
              {checkingStatus ? 'Checking...' : 'Refresh Status'}
            </button>

            <button
              type="button"
              onClick={() => {
                setPromptSent(false);
                setError('');
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 px-5 rounded-2xl font-bold text-sm transition-all border border-slate-200 text-center"
            >
              Cancel / Try Again
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handlePay} className="space-y-6">
          {/* PURPOSE SELECTION */}
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setPurpose('welfare')}
              className={`p-5 rounded-3xl flex flex-col items-center justify-center text-center transition-all ${
                purpose === 'welfare' 
                  ? 'bg-rose-500/10 border-2 border-rose-500 shadow-md text-rose-900' 
                  : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${purpose === 'welfare' ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-500'}`}>
                <Heart className="w-6 h-6" fill={purpose === 'welfare' ? 'currentColor' : 'none'} />
              </div>
              <span className="font-bold text-sm">Welfare Relief Fund</span>
            </button>
            
            <button
              type="button"
              onClick={() => setPurpose('campaign')}
              className={`p-5 rounded-3xl flex flex-col items-center justify-center text-center transition-all ${
                purpose === 'campaign' 
                  ? 'bg-amber-500/10 border-2 border-amber-500 shadow-md text-amber-900' 
                  : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${purpose === 'campaign' ? 'bg-amber-500 text-slate-950' : 'bg-amber-50 text-amber-600'}`}>
                <Target className="w-6 h-6" />
              </div>
              <span className="font-bold text-sm">School Campaign</span>
            </button>
          </div>

          {/* CAMPAIGN SELECTION */}
          {purpose === 'campaign' && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                Select Active Campaign
              </label>
              {fetchingCampaigns ? (
                <div className="p-4 text-center text-xs text-slate-400 font-medium">Loading campaigns...</div>
              ) : campaigns.length > 0 ? (
                <SelectDropdown
                  options={campaigns.map(c => ({ label: c.title, value: c.id }))}
                  value={campaignId}
                  onChange={setCampaignId}
                  placeholder="Choose a campaign to support"
                />
              ) : (
                <p className="text-xs text-rose-500 font-medium">No active campaigns available right now.</p>
              )}
            </div>
          )}

          {/* AMOUNT INPUT */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
              Amount (UGX)
            </label>
            
            <div className="relative mb-6">
              <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                <span className="text-slate-400 font-extrabold text-xl">UGX</span>
              </div>
              <input
                type="number"
                required
                min="1000"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full pl-20 pr-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-3xl font-extrabold text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white transition-all text-right"
                placeholder="0"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              {presetAmounts.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(preset.toString())}
                  className="px-4 py-2 bg-slate-100 hover:bg-amber-500 hover:text-slate-950 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                >
                  {preset.toLocaleString()} UGX
                </button>
              ))}
            </div>
          </div>

          {/* NETWORK & PHONE */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
              Mobile Money Details
            </label>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-1/3">
                <SelectDropdown
                  options={[
                    { label: 'MTN MoMo', value: 'MTN' },
                    { label: 'Airtel Money', value: 'Airtel' }
                  ]}
                  value={network}
                  onChange={setNetwork}
                />
              </div>
              <div className="w-full sm:w-2/3 relative">
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold focus:outline-none focus:border-amber-500 focus:bg-white transition-all text-sm"
                  placeholder="Phone e.g. 0771234567"
                />
              </div>
            </div>
          </div>

          {/* PAY BUTTON */}
          <div>
            <button
              type="submit"
              disabled={loading || success}
              className="w-full bg-slate-900 text-white rounded-full py-4 text-base font-bold shadow-xl hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-amber-400" /> Sending Payment Prompt...
                </>
              ) : (
                `Pay ${amount ? `UGX ${parseInt(amount, 10).toLocaleString()}` : ''} Now`
              )}
            </button>
            <div className="mt-4 flex items-center justify-center gap-2 text-slate-400">
              <Lock className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">Secured by Relworx Mobile Money Gateway</span>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

