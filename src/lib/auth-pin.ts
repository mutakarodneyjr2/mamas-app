import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updateEmail, updatePassword, signInWithEmailAndPassword } from 'firebase/auth';
import { normalizePhoneNumber } from './utils';

const PIN_SALT = "MAMAS_SECURE_SALT_2026";

/**
 * securely hash the PIN using SHA-256 before storing (though we don't strictly need it for auth, it's for audit/verification)
 */
export async function hashPin(pin: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(pin + PIN_SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getSyntheticEmail(phoneNumber: string): string {
  const normPhone = normalizePhoneNumber(phoneNumber);
  const cleanPhone = normPhone.replace(/[^a-zA-Z0-9+]/g, '');
  const timestamp = Date.now();
  return `${cleanPhone}_${timestamp}@mama-alumin.local`;
}

function getSyntheticPassword(pin: string): string {
  return `MAMAS-PIN-${pin}`;
}

export async function setPin(uid: string, phoneNumber: string, pin: string) {
  if (pin.length < 4 || pin.length > 6) {
    throw new Error("PIN must be 4 to 6 digits");
  }

  const normPhone = normalizePhoneNumber(phoneNumber);
  if (!normPhone) {
    throw new Error("Valid phone number is required to set PIN");
  }

  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Must be logged in to set PIN");

  const syntheticEmail = getSyntheticEmail(normPhone);
  const syntheticPassword = getSyntheticPassword(pin);

  const { createUserWithEmailAndPassword } = await import('firebase/auth');

  let newCred;
  try {
    newCred = await createUserWithEmailAndPassword(auth, syntheticEmail, syntheticPassword);
  } catch (e: any) {
    console.error("Failed to create synthetic email user:", e);
    throw new Error("Failed to configure PIN authentication: " + (e.message || e.code));
  }

  try {
    const newIdToken = await newCred.user.getIdToken();

    const res = await fetch('/api/pin-setup-migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newIdToken })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to finalize PIN setup on server.");
    }
  } catch (err: any) {
    // Client-side safety: if migration fails, sign out the temporary user and throw error
    try {
      await auth.signOut();
    } catch (signOutErr) {
      console.error("Error signing out after failed migration:", signOutErr);
    }
    throw err;
  }
}

export async function verifyPin(phoneNumber: string, pin: string) {
  const normPhone = normalizePhoneNumber(phoneNumber);
  const cleanPhone = normPhone.replace(/[^a-zA-Z0-9+]/g, '');
  
  let pinEmailDoc = await getDoc(doc(db, 'pinEmails', cleanPhone));
  if (!pinEmailDoc.exists()) {
    pinEmailDoc = await getDoc(doc(db, 'pinEmails', normPhone));
  }
  
  if (!pinEmailDoc.exists()) {
    throw new Error("No PIN set for this number. Please log in with SMS or register.");
  }

  const syntheticEmail = pinEmailDoc.data()?.email;
  if (!syntheticEmail) {
    throw new Error("Invalid PIN configuration for this number.");
  }

  const syntheticPassword = getSyntheticPassword(pin);

  try {
    const credential = await signInWithEmailAndPassword(auth, syntheticEmail, syntheticPassword);
    
    const userDoc = await getDoc(doc(db, 'users', credential.user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      if (data.pinLockedUntil && data.pinLockedUntil > Date.now()) {
        await auth.signOut();
        const minutesLeft = Math.ceil((data.pinLockedUntil - Date.now()) / 60000);
        throw new Error(`Account locked. Try again in ${minutesLeft} minutes.`);
      }
    }
    
    return credential.user;
  } catch (e: any) {
    if (e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
      throw new Error("Invalid phone number or PIN.");
    }
    throw e;
  }
}

export async function resetPin(uid: string, phoneNumber: string, newPin: string) {
  return setPin(uid, phoneNumber, newPin);
}
