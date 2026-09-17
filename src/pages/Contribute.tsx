import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Heart, Target, Lock, Loader2, Check, Smartphone, RefreshCw, AlertCircle, CheckCircle2, HeartHandshake, PauseCircle, Wallet } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, doc, onSnapshot, getDoc, serverTimestamp } from 'firebase/firestore';
import { SelectDropdown } from '../components/SelectDropdown';
import { normalizePhoneNumber, formatUGX } from '../lib/utils';

export default function Contribute() {
  const { currentUser, userProfile, isUnverified } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const initialCampaignId = searchParams.get('campaignId') || '';
  const initialType = searchParams.get('type') || '';
  const initialWelfareId = searchParams.get('welfareId') || '';

  const [purpose, setPurpose] = useState<'welfare' | 'campaign' | 'welfare_support'>(
    initialType === 'welfare_support' && initialWelfareId
      ? 'welfare_support'
      : initialCampaignId || isUnverified 
      ? 'campaign' 
      : 'welfare'
  );

  const [welfareRequestId, setWelfareRequestId] = useState(initialWelfareId);
  const [welfareCaseData, setWelfareCaseData] = useState<any>(null);
  const [fetchingWelfareCase, setFetchingWelfareCase] = useState(false);

  const [isAnonymous, setIsAnonymous] = useState(false);
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
    async function fetchWelfareCase() {
      if (!welfareRequestId) return;
      setFetchingWelfareCase(true);
      try {
        const docSnap = await getDoc(doc(db, 'welfareRequests', welfareRequestId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setWelfareCaseData(data);
          if (data.supportStatus === 'paused') {
            setError('Solidarity support for this welfare case is currently paused by the committee.');
          } else if (data.supportStatus === 'closed' || data.supportEnabled === false) {
            setError('Solidarity support for this welfare case has ended.');
          }
        } else {
          setError('Welfare appeal case not found.');
        }
      } catch (err: any) {
        console.error("Error fetching welfare case details:", err);
      } finally {
        setFetchingWelfareCase(false);
      }
    }

    if (purpose === 'welfare_support' && welfareRequestId) {
      fetchWelfareCase();
    }
  }, [purpose, welfareRequestId]);

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

  const [confirmedAmount, setConfirmedAmount] = useState<number | null>(null);

  // Realtime listener for pending payment status
  useEffect(() => {
    if (!promptSent || !pendingDocId) return;

    const unsubscribe = onSnapshot(doc(db, 'contributions', pendingDocId), (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();

      if (data?.status === 'verified') {
        setConfirmedAmount(data.amount || parseInt(amount, 10));
        setSuccess(true);
        setPromptSent(false);
        setTimeout(() => {
          navigate('/statement');
        }, 3000); // Wait 3s so user sees the verified state
      } else if (data?.status === 'failed') {
        setError('Payment cancelled or failed. No money was taken.');
        setPromptSent(false);
      }
    }, (err) => {
      console.error("Error listening to contribution status:", err);
    });

    // Fallback polling timer (stop after 60s)
    const timeoutTimer = setTimeout(() => {
      setPollingMessage('Still confirming payment. You will be updated. You may close this screen if you entered your PIN.');
    }, 30000);

    return () => {
      unsubscribe();
      clearTimeout(timeoutTimer);
    };
  }, [promptSent, pendingDocId, navigate, amount]);

  const handleManualRefresh = async () => {
    if (!pendingDocId) return;
    setCheckingStatus(true);
    try {
      const docSnap = await getDoc(doc(db, 'contributions', pendingDocId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data?.status === 'verified') {
          setConfirmedAmount(data.amount || parseInt(amount, 10));
          setSuccess(true);
          setPromptSent(false);
          setTimeout(() => {
            navigate('/statement');
          }, 3000);
        } else if (data?.status === 'failed') {
          setError('Payment cancelled or failed. No money was taken.');
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
    
    if (!navigator.onLine) {
      setError('No connection. Check internet and try again.');
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

    if (purpose === 'welfare_support') {
      if (!welfareRequestId) {
        setError('Please select a welfare solidarity appeal to support.');
        return;
      }
      if (welfareCaseData?.supportStatus === 'paused') {
        setError('Solidarity support for this welfare case is currently paused.');
        return;
      }
      if (welfareCaseData?.supportStatus === 'closed' || welfareCaseData?.supportEnabled === false) {
        setError('Solidarity support for this welfare case is closed.');
        return;
      }
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
      const contribType = purpose === 'campaign' 
        ? 'school_support' 
        : purpose === 'welfare_support' 
        ? 'welfare_support' 
        : 'welfare';

      const actualUserName = userProfile?.fullName || 'Anonymous User';
      const displayName = isAnonymous ? 'Anonymous' : actualUserName;

      // 1. Create Firestore contribution doc
      const docRef = await addDoc(collection(db, 'contributions'), {
        userId: currentUser.uid,
        userName: actualUserName,
        displayName: displayName,
        isAnonymous: isAnonymous,
        amount: numericAmount,
        purpose: purpose,
        type: contribType,
        campaignId: purpose === 'campaign' ? campaignId : null,
        welfareRequestId: purpose === 'welfare_support' ? welfareRequestId : null,
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
            userName: actualUserName,
            displayName: displayName,
            isAnonymous: String(isAnonymous),
            type: contribType,
            campaignId: purpose === 'campaign' ? campaignId : null,
            welfareRequestId: purpose === 'welfare_support' ? welfareRequestId : null
          }
        })
      });

      clearTimeout(timeoutId);

      const resData = await response.json().catch(() => ({}));

      if (!response.ok || !resData.success) {
        const errorMsg = resData.message || resData.error || '';
        if (errorMsg.includes('Server configuration error')) {
          throw new Error('Payment service temporarily unavailable.');
        } else {
          throw new Error('Payment could not be started. Try again.');
        }
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
        setError(err.message || 'Payment could not be started. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const presetAmounts = [1000, 2000, 5000, 10000, 20000, 50000, 100000];

  return (
    <div className="w-full pb-36 sm:pb-24 animate-in fade-in duration-300">
      
      {/* STICKY PAGE TITLE BAR (Light Grey Highlighted) */}
      <div className="sticky top-0 z-30 bg-slate-100/95 dark:bg-slate-850/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-700/80 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h1 className="text-lg sm:text-xl font-bold text-blue-950 dark:text-blue-100 tracking-tight">
              Pay Dues & Support
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Verified alumni welfare dues, school campaigns & solidarity aid
          </p>
        </div>
      </div>

      <div className="max-w-xl mx-auto w-full px-4 sm:px-6 mt-6 space-y-6">
        
        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 p-3.5 rounded-xl text-xs font-semibold border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 p-4 rounded-xl text-xs font-semibold border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-3 shadow-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <div className="text-sm font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                Payment Verified 
                {confirmedAmount !== null && (
                  <span className="bg-emerald-200/50 dark:bg-emerald-800/50 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-full text-xs">
                    {formatUGX(confirmedAmount)}
                  </span>
                )}
              </div>
              <div className="text-emerald-700 dark:text-emerald-400 text-xs mt-0.5 font-normal">Your contribution was successfully recorded. Redirecting to your statement...</div>
            </div>
          </div>
        )}

        {/* MOBILE MONEY PROMPT SENT CARD */}
        {promptSent ? (
          <div className="bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 p-5 rounded-xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 rounded-xl flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-full text-[10px] font-bold uppercase tracking-wider border border-blue-200 dark:border-blue-900">
                  Prompt Sent
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">Check Your Phone</h2>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1.5">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                A Mobile Money payment prompt of <span className="font-bold text-slate-900 dark:text-white">UGX {parseInt(amount || '0', 10).toLocaleString()}</span> has been sent to:
              </p>
              <div className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{normalizedPhoneUsed}</span>
                <span className="text-[10px] px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded font-medium">{network}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-normal pt-1">
                Please enter your Mobile Money PIN on your handset to approve the transaction.
              </p>
            </div>

            <div className="flex items-center gap-2.5 p-3 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40 text-blue-900 dark:text-blue-200 text-xs font-semibold">
              <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
              <span>{pollingMessage}</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={checkingStatus}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 px-4 rounded-xl font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin' : ''}`} />
                <span>{checkingStatus ? 'Checking...' : 'Refresh Status'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPromptSent(false);
                  setError('');
                }}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2.5 px-4 rounded-xl font-semibold text-xs transition-colors border border-slate-200 dark:border-slate-700 text-center cursor-pointer"
              >
                Cancel / Try Again
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handlePay} className="space-y-6">
            
            {/* PURPOSE SELECTION (SEGMENTED CONTROL) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Contribution Purpose
              </label>
              <div className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl flex gap-1 border border-slate-200/80 dark:border-slate-700/60">
                {!isUnverified && (
                  <button
                    type="button"
                    onClick={() => setPurpose('welfare')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                      purpose === 'welfare' 
                        ? 'bg-blue-600 text-white shadow-xs' 
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Welfare Dues
                  </button>
                )}
                
                <button
                  type="button"
                  onClick={() => setPurpose('campaign')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                    purpose === 'campaign' 
                      ? 'bg-blue-600 text-white shadow-xs' 
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  School Campaign
                </button>

                {(welfareRequestId || purpose === 'welfare_support') && !isUnverified && (
                  <button
                    type="button"
                    onClick={() => setPurpose('welfare_support')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                      purpose === 'welfare_support' 
                        ? 'bg-blue-600 text-white shadow-xs' 
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Solidarity Appeal
                  </button>
                )}
              </div>
            </div>

            {/* SOLIDARITY APPEAL INFO BANNER */}
            {purpose === 'welfare_support' && welfareCaseData && (
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 px-2.5 py-0.5 rounded-full">
                    {welfareCaseData.category || 'Welfare Solidarity'}
                  </span>

                  {welfareCaseData.supportStatus === 'open' && (
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 px-2 py-0.5 rounded-full">
                      Appeal Active
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    {welfareCaseData.publicTitle || `Solidarity Support for ${welfareCaseData.personName}`}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    {welfareCaseData.publicSummary || welfareCaseData.reason}
                  </p>
                </div>

                <div className="flex justify-between items-center text-xs bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">
                    Beneficiary: <strong className="text-slate-800 dark:text-slate-200 font-bold">{welfareCaseData.personName}</strong>
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    Raised: {formatUGX(welfareCaseData.supportRaisedAmount || 0)}
                  </span>
                </div>
              </div>
            )}

            {/* CAMPAIGN SELECTION */}
            {purpose === 'campaign' && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Select Active Campaign
                </label>
                {fetchingCampaigns ? (
                  <div className="p-3 text-center text-xs text-slate-400 font-medium">Loading campaigns...</div>
                ) : campaigns.length > 0 ? (
                  <SelectDropdown
                    options={campaigns.map(c => ({ label: c.title, value: c.id }))}
                    value={campaignId}
                    onChange={setCampaignId}
                    placeholder="Choose a campaign to support"
                  />
                ) : (
                  <p className="text-xs text-rose-500 font-semibold">No active campaigns available right now.</p>
                )}
              </div>
            )}

            {/* AMOUNT INPUT */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Amount (UGX)
              </label>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-slate-400 dark:text-slate-500 font-extrabold text-base">UGX</span>
                </div>
                <input
                  type="number"
                  required
                  min="1000"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full pl-16 pr-4 py-3 bg-white dark:bg-[#0c1731] border border-slate-200 dark:border-slate-800 rounded-xl text-xl sm:text-2xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all text-right"
                  placeholder="0"
                />
              </div>
              
              <div className="flex flex-wrap gap-1.5 pt-1">
                {presetAmounts.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(preset.toString())}
                    className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold border border-slate-200/80 dark:border-slate-800/80 cursor-pointer"
                  >
                    {preset.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* NETWORK & PHONE */}
            <div className="space-y-3">
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Select Network Operator
              </label>
              
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setNetwork('MTN')}
                  className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                    network === 'MTN'
                      ? 'border-amber-400 bg-amber-50/70 dark:bg-amber-950/30 text-amber-950 dark:text-amber-200 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1731] text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0 shadow-xs" />
                    <div className="text-left">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">MTN MoMo</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">077, 078, 076</div>
                    </div>
                  </div>
                  {network === 'MTN' && <Check className="w-4 h-4 text-amber-600 dark:text-amber-400 stroke-[3]" />}
                </button>

                <button
                  type="button"
                  onClick={() => setNetwork('Airtel')}
                  className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                    network === 'Airtel'
                      ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/30 text-rose-950 dark:text-rose-200 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1731] text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0 shadow-xs" />
                    <div className="text-left">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Airtel Money</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">070, 074, 075</div>
                    </div>
                  </div>
                  {network === 'Airtel' && <Check className="w-4 h-4 text-rose-600 dark:text-rose-400 stroke-[3]" />}
                </button>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Mobile Money Phone Number
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-[#0c1731] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                  placeholder="e.g. 0771234567 or 0701234567"
                />
              </div>

              {purpose === 'campaign' && (
                <label className="flex items-center gap-2.5 mt-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" 
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Keep my contribution anonymous publicly</span>
                </label>
              )}
            </div>

            {/* PAY BUTTON */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || success}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3.5 text-sm font-bold shadow-md flex items-center justify-center gap-2 transition-colors disabled:opacity-70 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" /> Sending Mobile Money Prompt...
                  </>
                ) : (
                  `Pay ${amount ? `UGX ${parseInt(amount, 10).toLocaleString()}` : ''} with ${network}`
                )}
              </button>
              <div className="mt-2.5 flex items-center justify-center gap-1.5 text-slate-400 dark:text-slate-500">
                <Lock className="w-3 h-3" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Secured by Relworx Mobile Money Gateway</span>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
