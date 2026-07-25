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
    const q = query(collection(db, 'moneyOut'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: MoneyOutRecord[] = [];
      const userIds = new Set<string>();

      snapshot.forEach(d => {
        const r = { id: d.id, ...d.data() } as MoneyOutRecord;
        data.push(r);
        if (r.approvedBy) userIds.add(r.approvedBy);
      });

      setRecords(data);

      // Fetch users safely
      setUsersCache(prevCache => {
        const newCache = { ...prevCache };
        userIds.forEach(uid => {
          if (!newCache[uid]) {
            getDoc(doc(db, 'users', uid)).then(uDoc => {
              if (uDoc.exists()) {
                setUsersCache(curr => ({ ...curr, [uid]: uDoc.data() as User }));
              }
            });
          }
        });
        return newCache;
      });

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mamas-accent mb-4"></div>
        <p className="text-slate-500 font-medium">Loading transactions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="bg-rose-100 p-2.5 rounded-2xl border border-rose-200">
            <ArrowRightLeft className="w-6 h-6 text-rose-700" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-mamas-text">Money Out</h2>
            <p className="text-slate-500 text-sm">Transparent record of all association payouts and expenses.</p>
          </div>
        </div>
        {canAddExpense && (
          <button 
            onClick={() => setShowAddExpense(!showAddExpense)}
            className="flex items-center gap-2 bg-mamas-primary hover:bg-mamas-primary-hover text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Record Expense
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-sm font-medium animate-in fade-in">
          {errorMsg}
        </div>
      )}
      
      {successMsg && (
        <div className="bg-teal-50 border border-teal-200 text-teal-800 p-4 rounded-2xl text-sm font-medium animate-in fade-in">
          {successMsg}
        </div>
      )}

      {showAddExpense && (
        <form onSubmit={handleAddExpense} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-4">
          <h3 className="font-bold text-mamas-text flex items-center gap-2 border-b border-slate-100 pb-3">
            <Receipt className="w-5 h-5 text-mamas-accent" /> Record New Expense
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount (UGX)</label>
              <input type="number" required value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-mamas-primary/20 focus:border-mamas-primary outline-none text-sm font-bold text-mamas-text" placeholder="e.g. 50000" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reference No.</label>
              <input type="text" required value={expenseRef} onChange={e => setExpenseRef(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-mamas-primary/20 focus:border-mamas-primary outline-none text-sm font-mono text-mamas-text uppercase" placeholder="e.g. MM-12345" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reason / Description</label>
              <input type="text" required value={expenseReason} onChange={e => setExpenseReason(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-mamas-primary/20 focus:border-mamas-primary outline-none text-sm font-medium text-mamas-text" placeholder="e.g. Printing meeting banners" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Beneficiary Name (Optional)</label>
              <input type="text" value={expenseBeneficiary} onChange={e => setExpenseBeneficiary(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-mamas-primary/20 focus:border-mamas-primary outline-none text-sm font-medium text-mamas-text" placeholder="e.g. Kampala Printers Ltd" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowAddExpense(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 text-sm font-bold bg-mamas-primary hover:bg-mamas-primary-hover text-white rounded-xl shadow-sm disabled:opacity-50 transition-colors">
              {isSubmitting ? 'Recording...' : 'Record Expense'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        {records.length === 0 ? (
           <div className="flex flex-col items-center justify-center text-center p-16">
             <Receipt className="w-16 h-16 text-slate-200 dark:text-slate-700 mb-6" />
             <h3 className="text-xl font-bold text-mamas-text dark:text-white mb-2">No Transactions Yet</h3>
             <p className="text-slate-500 max-w-md mx-auto text-sm">
               There are currently no recorded payouts or expenses in the system. When funds are disbursed, they will appear here publicly.
             </p>
           </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {records.map(record => (
              <li key={record.id} className="p-5 sm:p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-4">
                  <div className="bg-rose-50 dark:bg-rose-900/20 p-3 rounded-2xl h-fit border border-rose-100 dark:border-rose-900/50">
                    <Banknote className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-mamas-text dark:text-white">{record.reason}</h4>
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1.5"><UserIcon className="w-3.5 h-3.5" /> Beneficiary: {record.beneficiaryName || 'N/A'}</span>
                      <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
                      <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {new Date(record.createdAt).toLocaleDateString()}</span>
                    </p>
                    <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                      <span>Approved by: {usersCache[record.approvedBy]?.fullName || 'Loading...'}</span>
                    </div>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-lg font-bold text-rose-600 dark:text-rose-400 font-display">
                    -{formatUGX(record.amount)}
                  </p>
                  {record.transactionReference && (
                    <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mt-1">
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
