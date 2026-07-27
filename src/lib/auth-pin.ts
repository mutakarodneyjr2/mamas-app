import { auth, db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { signInWithCustomToken, signInWithEmailAndPassword } from 'firebase/auth';
import { normalizePhoneNumber } from './utils';

const PIN_SALT = "MAMAS_SECURE_SALT_2026";

async function hashPinClient(pin: string): Promise<string> {
  const cleanPin = String(pin).trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(cleanPin + PIN_SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function setPin(uid: string, phoneNumber: string, pin: string) {
  const cleanPin = String(pin || '').trim();
  if (cleanPin.length < 4 || cleanPin.length > 6) {
    throw new Error("PIN must be 4 to 6 digits");
  }

  const normPhone = normalizePhoneNumber(phoneNumber);
  if (!normPhone) {
    throw new Error("Valid phone number is required to set PIN");
  }

  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Must be logged in to set PIN");

  try {
    const idToken = await currentUser.getIdToken();
    const res = await fetch('/api/pin/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, phoneNumber: normPhone, pin: cleanPin })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return;
    }
  } catch (apiErr) {
    console.warn("Server PIN setup endpoint unavailable, attempting client fallback:", apiErr);
  }

  // Fallback: update directly via client SDK using updated firestore rules
  const pinHash = await hashPinClient(cleanPin);
  const cleanPhone = normPhone.replace(/[^0-9]/g, '');
  let localWithZero = "";
  let localNoZero = "";
  if (cleanPhone.startsWith('256') && cleanPhone.length === 12) {
    localWithZero = '0' + cleanPhone.slice(3);
    localNoZero = cleanPhone.slice(3);
  }
  const rawDigits = String(phoneNumber || '').replace(/[^0-9]/g, '');
  const syntheticEmail = `${cleanPhone}@mama-alumin.local`;

  await setDoc(doc(db, "users", uid), {
    phoneNumber: normPhone,
    pinHash,
    hasPin: true,
    pinUpdatedAt: Date.now(),
    failedPinAttempts: 0,
    pinLockedUntil: null
  }, { merge: true });

  const keysToSave = Array.from(new Set([
    normPhone,
    cleanPhone,
    localWithZero,
    localNoZero,
    rawDigits
  ])).filter(Boolean);

  for (const key of keysToSave) {
    await setDoc(doc(db, "pinEmails", key), {
      uid,
      pinHash,
      hasPin: true,
      email: syntheticEmail,
      failedPinAttempts: 0,
      pinLockedUntil: null,
      updatedAt: Date.now()
    }, { merge: true });
  }
}

export async function verifyPin(phoneNumber: string, pin: string) {
  const normPhone = normalizePhoneNumber(phoneNumber);
  if (!normPhone) {
    throw new Error("Valid phone number is required");
  }

  const cleanPin = String(pin).trim();

  try {
    const res = await fetch('/api/pin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: normPhone, pin: cleanPin })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Invalid phone number or PIN.");
    }

    if (data.customToken) {
      try {
        const credential = await signInWithCustomToken(auth, data.customToken);
        return credential.user;
      } catch (customErr) {
        console.warn("signInWithCustomToken failed, falling back to email/password:", customErr);
      }
    }

    if (data.email && data.password) {
      const credential = await signInWithEmailAndPassword(auth, data.email, data.password);
      return credential.user;
    }

    throw new Error("Authentication token not received from server.");
  } catch (err: any) {
    throw err;
  }
}

export async function resetPin(uid: string, phoneNumber: string, newPin: string) {
  return setPin(uid, phoneNumber, newPin);
}
