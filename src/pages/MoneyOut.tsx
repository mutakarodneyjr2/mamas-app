import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MoneyOutRecord, User } from '../types';
import { formatUGX } from '../lib/utils';
import { recordExpense } from '../lib/services';
import { Banknote, Receipt, User as UserIcon, Calendar, Filter, ArrowRightLeft, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function MoneyOut() {
  const { userProfile, currentUser } = useAuth();
  const [records, setRecords] = useState<MoneyOutRecord[]>([]);
  const [usersCache, setUsersCache] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseReason, setExpenseReason] = useState('');
  const [expenseRef, setExpenseRef] = useState('');
  const [expenseBeneficiary, setExpenseBeneficiary] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const canAddExpense = userProfile && ['super_admin', 'treasurer', 'chairperson', 'vice_chairperson'].includes(userProfile.role);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setErrorMsg(''); setSuccessMsg('');
    const amount = parseInt(expenseAmount, 10);
    if (isNaN(amount) || amount <= 0 || !expenseReason || !expenseRef) {
      setErrorMsg("Please enter a valid amount, reason, and reference.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await recordExpense(amount, expenseReason, expenseRef, currentUser.uid, expenseBeneficiary);
      setShowAddExpense(false);
      setExpenseAmount('');
      setExpenseReason('');
      setExpenseRef('');
      setExpenseBeneficiary('');
      setSuccessMsg("Expense recorded successfully.");
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record expense.');
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    const fetchUsers = async () => {
      try {
        const uSnap = await getDocs(collection(db, 'users'));
        const uMap: Record<string, User> = {};
        uSnap.forEach(d => {
          uMap[d.id] = d.data() as User;
        });
        setUsersCache(uMap);
      } catch (err) {
        console.error("Error loading users:", err);
      }
    };
    fetchUsers();

    const q = query(collection(db, 'moneyOut'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: MoneyOutRecord[] = [];

      snapshot.forEach(d => {
        const r = { id: d.id, ...d.data() } as MoneyOutRecord;
        data.push(r);
      });

      setRecords(data);
      setLoading(false);
    }, (error) => {
      console.error("Error loading money out records:", error);
      setErrorMsg("Failed to load transactions. Please check your permissions or try again.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-slate-500 dark:text-slate-400 font-medium">Loading transactions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20 font-sans">
      {/* Header section */}
      <div className="bg-white dark:bg-[#0c1731] rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400 flex-shrink-0">
            <ArrowRightLeft className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 mb-1">
              Public Ledger
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Money Out</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">Transparent ledger of all association disbursements, welfare aid, and operational expenditures.</p>
          </div>
        </div>
        {canAddExpense && (
          <button 
            onClick={() => setShowAddExpense(!showAddExpense)}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-blue-500/25 active:scale-95 cursor-pointer flex-shrink-0"
          >
            <Plus className="w-4 h-4" /> Record Expense
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 p-4 rounded-2xl text-sm font-medium animate-in fade-in">
          {errorMsg}
        </div>
      )}
      
      {successMsg && (
        <div className="bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/60 text-teal-800 dark:text-teal-300 p-4 rounded-2xl text-sm font-medium animate-in fade-in">
          {successMsg}
        </div>
      )}

      {showAddExpense && (
        <form onSubmit={handleAddExpense} className="bg-white dark:bg-[#0c1731] p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-4">
          <h3 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Receipt className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Record New Expense
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Amount (UGX)</label>
              <input 
                type="number" 
                required 
                value={expenseAmount} 
                onChange={e => setExpenseAmount(e.target.value)} 
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-bold text-slate-900 dark:text-white" 
                placeholder="e.g. 50000" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Reference No.</label>
              <input 
                type="text" 
                required 
                value={expenseRef} 
                onChange={e => setExpenseRef(e.target.value)} 
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-mono text-slate-900 dark:text-white uppercase" 
                placeholder="e.g. MM-12345" 
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Reason / Description</label>
              <input 
                type="text" 
                required 
                value={expenseReason} 
                onChange={e => setExpenseReason(e.target.value)} 
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-medium text-slate-900 dark:text-white" 
                placeholder="e.g. Printing meeting banners" 
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Beneficiary Name (Optional)</label>
              <input 
                type="text" 
                value={expenseBeneficiary} 
                onChange={e => setExpenseBeneficiary(e.target.value)} 
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-medium text-slate-900 dark:text-white" 
                placeholder="e.g. Kampala Printers Ltd" 
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button 
              type="button" 
              onClick={() => setShowAddExpense(false)} 
              className="px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="px-6 py-2.5 text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-md shadow-blue-500/25 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isSubmitting ? 'Recording...' : 'Record Expense'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-[#0c1731] border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
        {records.length === 0 ? (
           <div className="flex flex-col items-center justify-center text-center p-16">
             <Receipt className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-4" />
             <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Transactions Yet</h3>
             <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto text-sm">
               There are currently no recorded payouts or expenses in the system. When funds are disbursed, they will appear here in the transparent ledger.
             </p>
           </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {records.map(record => (
              <li key={record.id} className="p-5 sm:p-6 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-4">
                  <div className="bg-rose-50 dark:bg-rose-950/40 p-3 rounded-2xl h-fit border border-rose-200 dark:border-rose-900/60 flex-shrink-0">
                    <Banknote className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 dark:text-white text-base">{record.reason}</h4>
                    <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1.5"><UserIcon className="w-3.5 h-3.5 text-slate-400" /> Beneficiary: {record.beneficiaryName || 'N/A'}</span>
                      <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
                      <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" /> {new Date(record.createdAt).toLocaleDateString()}</span>
                    </p>
                    <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      <span>Approved by: {usersCache[record.approvedBy]?.fullName || 'Authorized Executive'}</span>
                    </div>
                  </div>
                </div>
                <div className="text-left sm:text-right flex-shrink-0">
                  <p className="text-lg font-extrabold text-rose-600 dark:text-rose-400 tracking-tight">
                    -{formatUGX(record.amount)}
                  </p>
                  {record.transactionReference && (
                    <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mt-1">
                      Ref: {record.transactionReference}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
