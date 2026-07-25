import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { collection, query, where, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { SchoolCampaign } from '../types';
import { recordContribution, initiateMobileMoneyContribution } from '../lib/services';
import { Wallet, Info, Heart, Target, CheckCircle2, XCircle, ArrowRight, Smartphone, Loader2 } from 'lucide-react';

export default function Contribute() {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const initialCampaignId = searchParams.get('campaignId') || '';
  
  const [displayAmount, setDisplayAmount] = useState('');
  const [amount, setAmount] = useState(0);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove non-digits
    const val = e.target.value.replace(/\D/g, '');
    if (!val) {
      setDisplayAmount('');
      setAmount(0);
      return;
    }
    const num = parseInt(val, 10);
    setAmount(num);
    setDisplayAmount(new Intl.NumberFormat('en-UG').format(num));
  };

  const [transactionReference, setTransactionReference] = useState('');
  const [note, setNote] = useState('');
  const [type, setType] = useState<'welfare' | 'school_support'>(initialCampaignId ? 'school_support' : 'welfare');
  const [campaignId, setCampaignId] = useState(initialCampaignId);
  
  // New state for Mobile Money UI
  const [paymentMode, setPaymentMode] = useState<'mobile_money' | 'manual'>('mobile_money');
  const [mobileNumber, setMobileNumber] = useState('');
  const [network, setNetwork] = useState<'MTN' | 'AIRTEL'>('MTN');
  const [pendingTransactionId, setPendingTransactionId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  
  const [activeCampaigns, setActiveCampaigns] = useState<SchoolCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (currentUser?.phoneNumber) {
      setMobileNumber(currentUser.phoneNumber);
    }
  }, [currentUser]);

  useEffect(() => {
    const fetchCampaigns = async () => {
      const q = query(collection(db, 'schoolCampaigns'), where('status', '==', 'active'));
      const snap = await getDocs(q);
      setActiveCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() } as SchoolCampaign)));
    };
    fetchCampaigns();
  }, []);

  useEffect(() => {
    if (!pendingTransactionId) return;

    setPaymentStatus('pending');
    
    const unsub = onSnapshot(doc(db, 'contributions', pendingTransactionId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.paymentStatus === 'verified') {
          setPaymentStatus('success');
          setLoading(false);
          setSuccess(true);
        } else if (data.paymentStatus === 'failed') {
          setPaymentStatus('failed');
          setLoading(false);
          setError('Mobile money payment failed or was cancelled. Please try again.');
        }
      }
    });

    return () => unsub();
  }, [pendingTransactionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    if (amount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    if (type === 'school_support' && !campaignId) {
      setError("Please select a campaign.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (paymentMode === 'mobile_money') {
        if (!mobileNumber.trim()) {
          throw new Error("Mobile money number is required.");
        }
        const contributionId = await initiateMobileMoneyContribution(
          currentUser.uid,
          amount,
          mobileNumber.trim(),
          network,
          type,
          type === 'school_support' ? campaignId : null
        );
        setPendingTransactionId(contributionId);
      } else {
        if (!transactionReference.trim()) {
          throw new Error("Transaction reference is required.");
        }
        await recordContribution(
          currentUser.uid,
          amount,
          transactionReference.trim(),
          type,
          type === 'school_support' ? campaignId : null,
          note.trim()
        );
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || "Failed to process payment");
      setLoading(false);
    }
  };

  if (paymentStatus === 'pending') {
    return (
      <div className="max-w-md mx-auto pt-8 pb-16 animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-mamas-card rounded-3xl shadow-sm border border-slate-200/90 p-8 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-5 border border-blue-200 relative">
            <Loader2 className="w-8 h-8 animate-spin" />
            <Smartphone className="w-4 h-4 absolute" />
          </div>
          <h2 className="text-2xl font-display font-bold text-mamas-text mb-2">Check Your Phone</h2>
          <p className="text-mamas-text-muted text-sm leading-relaxed mb-6">
            A payment prompt has been sent to <strong>{mobileNumber}</strong>. Please enter your Mobile Money PIN to complete the transaction.
          </p>
          <div className="text-xs text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100">
            Waiting for payment confirmation...
          </div>
          <button
            onClick={() => {
              setPaymentStatus('idle');
              setPendingTransactionId(null);
              setLoading(false);
            }}
            className="mt-6 text-sm font-medium text-slate-500 hover:text-slate-700 underline"
          >
            Cancel or Try Again
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto pt-8 pb-16 animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-mamas-card rounded-3xl shadow-sm border border-slate-200/90 p-8 text-center flex flex-col items-center relative overflow-hidden">
          {/* Decorative background circle */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl"></div>
          
          <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mb-5 border border-teal-200 z-10">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-display font-bold text-mamas-text mb-2 z-10">
            {paymentMode === 'mobile_money' ? "Payment Successful!" : "Contribution Logged!"}
          </h2>
          <p className="text-mamas-text-muted text-sm leading-relaxed mb-6 z-10">
            {paymentMode === 'mobile_money' 
              ? "Thank you! Your mobile money payment was received and your statement has been automatically updated." 
              : "Your contribution reference has been logged and is pending verification by the Treasurer. Thank you for supporting MAMAS!"}
          </p>

          <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-6 text-left space-y-4 z-10">
            <div className="text-center pb-3 border-b border-slate-200 border-dashed mb-2">
              <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Receipt</span>
              <span className="font-display font-bold text-3xl text-mamas-text">UGX {new Intl.NumberFormat('en-UG').format(amount)}</span>
            </div>
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-medium">Date</span>
              <span className="font-bold text-mamas-text">{new Date().toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-medium">Purpose</span>
              <span className="font-bold text-mamas-text capitalize">{type.replace('_', ' ')}</span>
            </div>
            {paymentMode === 'mobile_money' && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Mobile Number</span>
                <span className="font-bold text-mamas-text">{mobileNumber}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-200 border-dashed">
              <span className="text-slate-500 font-medium">Status</span>
              <span className={`font-bold ${paymentMode === 'mobile_money' ? 'text-teal-600' : 'text-amber-500'}`}>
                {paymentMode === 'mobile_money' ? 'Verified' : 'Pending'}
              </span>
            </div>
          </div>

          <div className="flex flex-col w-full gap-3 z-10">
            <button
              onClick={() => navigate('/statement')}
              className="w-full bg-mamas-primary hover:bg-mamas-primary-hover text-white font-bold py-3.5 px-6 rounded-2xl transition-colors shadow-md flex items-center justify-center gap-2"
            >
              View My Statement <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setSuccess(false);
                setPaymentStatus('idle');
                setAmount(0);
                setDisplayAmount('');
                setTransactionReference('');
                setNote('');
              }}
              className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold py-3 px-6 rounded-2xl transition-colors text-xs border border-slate-200"
            >
              Make Another Payment
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getPaymentTargetName = () => {
    if (type === 'welfare') return 'General Welfare Fund';
    if (campaignId) {
      const camp = activeCampaigns.find(c => c.id === campaignId);
      return camp ? `Campaign: ${camp.title}` : 'School Support Campaign';
    }
    return 'School Support Campaign';
  };

  return (
    <div className="max-w-xl mx-auto pb-12 space-y-5">
      <div>
        <h2 className="text-2xl font-display font-bold text-mamas-text flex items-center gap-2">
          <Wallet className="w-6 h-6 text-mamas-accent" /> Make a Contribution
        </h2>
        <p className="text-mamas-text-muted text-sm mt-1">Support the Matuumu Alumni Mutual Aid Association.</p>
      </div>

      <div className="bg-mamas-card rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
        <div className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="bg-rose-50 text-rose-800 p-4 rounded-xl text-xs font-medium border border-rose-200">{error}</div>}

            {/* Fund Selection */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Select Purpose</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setType('welfare'); setCampaignId(''); }}
                  className={`flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl border-2 transition-all ${
                    type === 'welfare' ? 'border-mamas-accent bg-amber-50/40 text-mamas-text shadow-sm' : 'border-slate-200/80 bg-white hover:bg-slate-50 text-slate-500'
                  }`}
                >
                  <Heart className={`w-6 h-6 ${type === 'welfare' ? 'text-mamas-accent fill-mamas-accent' : 'text-slate-400'}`} />
                  <span className="text-sm font-bold">Welfare Fund</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType('school_support')}
                  className={`flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl border-2 transition-all ${
                    type === 'school_support' ? 'border-mamas-primary bg-mamas-primary/5 text-mamas-text shadow-sm' : 'border-slate-200/80 bg-white hover:bg-slate-50 text-slate-500'
                  }`}
                >
                  <Target className={`w-6 h-6 ${type === 'school_support' ? 'text-mamas-primary' : 'text-slate-400'}`} />
                  <span className="text-sm font-bold">Campaign</span>
                </button>
              </div>
            </div>
            {type === 'school_support' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="campaignId" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Campaign</label>
                  <select
                    id="campaignId"
                    required
                    value={campaignId}
                    onChange={(e) => setCampaignId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3.5 text-sm focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-mamas-accent outline-none font-semibold text-mamas-text dark:text-white"
                  >
                    <option value="" disabled>-- Choose a campaign --</option>
                    {activeCampaigns.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                  {activeCampaigns.length === 0 && (
                    <p className="text-xs text-rose-500 mt-1.5 font-semibold">No active campaigns available at the moment.</p>
                  )}
                </div>
                {campaignId && activeCampaigns.find(c => c.id === campaignId)?.imageUrls?.[0] && (
                  <div className="w-full h-32 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mt-3">
                    <img src={activeCampaigns.find(c => c.id === campaignId)?.imageUrls?.[0]} alt="Campaign Cover" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            )}
            {/* Large Amount Input */}
            <div className="bg-slate-50/50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
              <label htmlFor="amount" className="block text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Amount to Pay</label>
              <div className="relative max-w-xs mx-auto">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 dark:text-slate-500 text-lg">UGX</span>
                <input
                  type="text"
                  inputMode="numeric"
                  id="amount"
                  required
                  value={displayAmount}
                  onChange={handleAmountChange}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl pl-16 pr-4 py-4 text-2xl sm:text-3xl focus:ring-2 focus:ring-mamas-accent outline-none font-bold text-mamas-primary dark:text-amber-400 text-center shadow-inner"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Payment Method Toggle & Fields */}
            {paymentMode === 'mobile_money' ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <label htmlFor="network" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Network</label>
                    <select
                      id="network"
                      value={network}
                      onChange={(e) => setNetwork(e.target.value as 'MTN' | 'AIRTEL')}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-3.5 text-base focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-mamas-accent outline-none font-bold text-mamas-text dark:text-white text-center"
                    >
                      <option value="MTN">MTN</option>
                      <option value="AIRTEL">AIRTEL</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label htmlFor="mobileNumber" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Mobile Number</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><Smartphone className="w-5 h-5" /></span>
                      <input
                        type="tel"
                        id="mobileNumber"
                        required
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3.5 text-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-mamas-accent outline-none font-semibold text-mamas-text dark:text-white tracking-wide"
                        placeholder="+256..."
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading || (type === 'school_support' && !campaignId)}
                    className="w-full bg-[#1C1F26] dark:bg-slate-800 hover:bg-black dark:hover:bg-slate-700 text-white font-bold py-4 px-6 rounded-2xl shadow-lg transition-all disabled:opacity-50 text-lg flex items-center justify-center gap-3"
                  >
                    {loading ? 'Processing...' : 'Pay with Mobile Money'}
                  </button>
                </div>
                
                {currentUser?.role === 'admin' && (
                  <div className="text-center">
                    <button 
                      type="button" 
                      onClick={() => setPaymentMode('manual')}
                      className="text-sm font-medium text-mamas-text-muted hover:text-mamas-primary transition-colors py-2"
                    >
                      I already paid (Admin Fallback)
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-2 text-mamas-text">
                  <Info className="w-4 h-4 text-mamas-accent" />
                  <span className="text-sm font-bold">Manual Payment Log</span>
                </div>
                <div>
                  <label htmlFor="transactionReference" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Bank / Mobile Money Ref No.</label>
                  <input
                    type="text"
                    id="transactionReference"
                    required
                    value={transactionReference}
                    onChange={(e) => setTransactionReference(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-mamas-accent outline-none font-mono text-mamas-text dark:text-white uppercase shadow-sm"
                    placeholder="e.g. MM2407211020"
                  />
                </div>
                <div>
                  <label htmlFor="note" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Note (Optional)</label>
                  <textarea
                    id="note"
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-mamas-accent outline-none font-medium text-mamas-text dark:text-white resize-none shadow-sm"
                    placeholder="Any payment remarks..."
                  />
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading || (type === 'school_support' && !campaignId)}
                    className="w-full bg-mamas-primary hover:bg-mamas-primary-hover text-white font-bold py-3.5 px-6 rounded-2xl shadow-md transition-all disabled:opacity-50 text-base"
                  >
                    {loading ? 'Submitting Log...' : 'Submit Payment Log'}
                  </button>
                </div>
                <div className="text-center pt-2">
                  <button 
                    type="button" 
                    onClick={() => setPaymentMode('mobile_money')}
                    className="text-sm font-medium text-mamas-primary hover:text-mamas-primary-hover transition-colors"
                  >
                    &larr; Back to Mobile Money
                  </button>
                </div>
              </div>
            )}

            {/* Legal / Transparency Note */}
            <div className="mt-6 border-t border-slate-100 pt-5 text-center">
              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto font-medium">
                  Your contribution goes to the <strong className="text-slate-700">Matuumu Alumni Mutual Aid Association - {getPaymentTargetName()}</strong>. All contributions are voluntary and non-refundable.
                </p>
              </div>
              <div className="flex justify-center gap-3 text-xs font-semibold text-slate-500">
                <Link to="/terms" className="hover:text-mamas-primary transition-colors">Terms of Service</Link>
                <span>&middot;</span>
                <Link to="/privacy" className="hover:text-mamas-primary transition-colors">Privacy Policy</Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
