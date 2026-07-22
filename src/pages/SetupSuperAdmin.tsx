import React, { useState } from 'react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export default function SetupSuperAdmin() {
  const { currentUser, userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleClaim = async () => {
    if (!currentUser || !userProfile) return;
    setLoading(true);
    setMessage('');

    try {
      // Check if any super admin exists
      const q = query(collection(db, 'users'), where('role', '==', 'super_admin'));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        setMessage('A super admin already exists. You cannot claim this role.');
        setLoading(false);
        return;
      }

      // Claim super admin
      await updateDoc(doc(db, 'users', currentUser.uid), {
        role: 'super_admin',
        status: 'approved' // auto-approve as well
      });

      setMessage('Successfully claimed Super Admin role! Please refresh the page.');
    } catch (err: any) {
      console.error(err);
      setMessage(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-md mx-auto bg-mamas-card rounded-lg shadow-sm border border-slate-200 mt-12 text-center">
      <h2 className="text-xl font-bold mb-4">Developer Setup</h2>
      <p className="text-mamas-text-muted mb-6 text-sm">
        Use this one-time action to claim the Super Admin role for the first registered user. 
        Once a Super Admin exists, this action will be disabled.
      </p>
      <button
        onClick={handleClaim}
        disabled={loading}
        className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-mamas-primary hover:bg-mamas-primary-hover disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Claim Super Admin'}
      </button>
      {message && (
        <p className={`mt-4 text-sm ${message.includes('Success') ? 'text-mamas-success' : 'text-mamas-danger'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
