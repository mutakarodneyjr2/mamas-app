import { auth, db } from '../firebase';
import { 
  fetchSignInMethodsForEmail, 
  sendPasswordResetEmail, 
  sendEmailVerification, 
  signInWithEmailAndPassword, 
  linkWithCredential, 
  EmailAuthProvider,
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { User } from '../types';
import { getAuthActionSettings } from './authActionSettings';

/**
 * Normalizes email address by trimming whitespace and lowercasing.
 */
export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

/**
 * Detects existing sign-in methods for an email address.
 * Returns array like ['password'], ['google.com'], or [] if not found / unknown.
 */
export async function detectSignInMethods(email: string): Promise<string[]> {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail || !cleanEmail.includes('@')) return [];
  try {
    const methods = await fetchSignInMethodsForEmail(auth, cleanEmail);
    return methods || [];
  } catch (err: any) {
    console.warn("detectSignInMethods error:", err);
    return [];
  }
}

/**
 * Maps a member's profile status and auth state to their destination route.
 */
export function resolveUserStatusRoute(profile: User | null | undefined, currentUser: FirebaseUser | null): string {
  if (!currentUser) return '/login';
  if (!profile) return '/register/details';

  switch (profile.status) {
    case 'approved':
      return '/dashboard';
    case 'pending':
    case 'unverified':
    case 'awaiting_approval':
    case 'rejected':
    case 'suspended':
    case 'pending_deletion':
    case 'deleted':
    default:
      return '/pending-approval';
  }
}

/**
 * Sends a password reset email (works for both password accounts and Google-only accounts to create/set a password).
 */
export async function sendPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) {
    throw new Error("Please provide a valid email address.");
  }
  try {
    const actionCodeSettings = getAuthActionSettings('/login?mode=resetPassword');
    await sendPasswordResetEmail(auth, cleanEmail, actionCodeSettings);
    return {
      success: true,
      message: "Password reset / setup instructions have been sent to your email. Check your inbox and spam folder."
    };
  } catch (err: any) {
    if (err.code === 'auth/user-not-found') {
      // For security, don't expose if user doesn't exist, but report clearly
      return {
        success: true,
        message: "If an account exists with this email, password reset instructions have been sent."
      };
    }
    throw err;
  }
}

/**
 * Resends email verification to the authenticated user.
 */
export async function resendVerificationEmail(user: FirebaseUser): Promise<{ success: boolean; message: string }> {
  if (!user) throw new Error("No authenticated user found.");
  const actionCodeSettings = getAuthActionSettings('/pending-approval?mode=verifyEmail');
  await sendEmailVerification(user, actionCodeSettings);
  return {
    success: true,
    message: "Verification email sent. Please check your inbox and spam folder."
  };
}

/**
 * Links a pending Google credential with an existing email/password account.
 * Maintains one email = one Auth UID = one Firestore user document.
 */
export async function linkGoogleWithPasswordAccount(
  email: string,
  password: string,
  pendingCredential: any
): Promise<FirebaseUser> {
  const cleanEmail = normalizeEmail(email);
  const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
  const user = userCredential.user;

  if (pendingCredential) {
    await linkWithCredential(user, pendingCredential);
  }

  // Update Firestore user doc to record multi-provider
  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      const currentProvider = data.authProvider || 'password';
      if (!currentProvider.includes('google')) {
        await updateDoc(userRef, {
          authProvider: 'email,google',
          updatedAt: Date.now()
        });
      }
    }
  } catch (docErr) {
    console.warn("Could not update authProvider in user doc:", docErr);
  }

  return user;
}
