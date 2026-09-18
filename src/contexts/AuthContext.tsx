import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  signOut, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  signInWithCredential, 
  UserCredential 
} from "firebase/auth";
import { auth, db } from "../firebase";
import { User as UserProfile, AccessTier } from "../types";
import { doc, onSnapshot, getDoc } from "firebase/firestore";

/**
 * Safely checks if the app is currently running within a native WebView shell (e.g. Capacitor/Android/iOS).
 */
export function isNativeWebView(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Capacitor global check
  const cap = (window as any).Capacitor;
  if (cap?.isNativePlatform?.() === true || (typeof cap?.getPlatform === 'function' && cap.getPlatform() !== 'web')) {
    return true;
  }

  // 2. User-Agent heuristics for embedded WebViews
  const ua = navigator.userAgent || '';
  if (/\bwv\b|Android.*Version\/[0-9.]+\s+Chrome\/|;\s*wv\)/i.test(ua)) {
    return true;
  }
  if (/iPhone|iPad|iPod/i.test(ua) && !/Safari/i.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/i.test(ua)) {
    return true;
  }

  return false;
}

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  googleSignIn: () => Promise<UserCredential>;
  checkUserExists: (uid: string) => Promise<boolean>;
  isVisitor: boolean;
  isUnverified: boolean;
  isVerified: boolean;
  isAdminOrCommittee: boolean;
  isPendingDeletion: boolean;
  isSuspended: boolean;
  isDeleted: boolean;
  accessTier: AccessTier;
  reloadProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const reloadProfile = useCallback(async () => {
    if (!currentUser) return;
    try {
      const snap = await getDoc(doc(db, "users", currentUser.uid));
      if (snap.exists()) {
        setUserProfile(snap.data() as UserProfile);
      }
    } catch (err) {
      console.warn("Failed to reload profile manually:", err);
    }
  }, [currentUser]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Listen to profile changes
        const unsubscribeProfile = onSnapshot(doc(db, "users", user.uid), async (document) => {
          if (document.exists()) {
            const data = document.data() as UserProfile;
            
            // Check if 30-day grace period has expired for pending deletion
            if (data.status === "pending_deletion" && data.deletionEffectiveAt && Date.now() >= data.deletionEffectiveAt) {
              try {
                const { finalizeAccountDeletion } = await import("../lib/auth");
                await finalizeAccountDeletion(user.uid);
                data.status = "deleted";
              } catch (e) {
                console.error("Error auto-finalizing account deletion:", e);
              }
            }

            setUserProfile(data);
            setLoading(false);
          } else {
            setUserProfile(null);
            setLoading(false);
          }
        }, (snapErr) => {
          console.warn("User profile onSnapshot error:", snapErr);
          setLoading(false);
        });
        
        return () => unsubscribeProfile();
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    // Check for redirect result if returning from a web signInWithRedirect
    getRedirectResult(auth).catch((err) => {
      console.warn("getRedirectResult info/error:", err);
    });

    return () => unsubscribeAuth();
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const googleSignIn = useCallback(async (): Promise<UserCredential> => {
    // 1. Native WebView path
    if (isNativeWebView()) {
      let nativeAuthPlugin: any = 
        (window as any).FirebaseAuthentication || 
        (window as any).Capacitor?.Plugins?.FirebaseAuthentication;

      if (!nativeAuthPlugin) {
        try {
          // Attempt dynamic import if plugin package is installed
          const mod = await (Function('return import("@capacitor-firebase/authentication")')() as Promise<any>);
          nativeAuthPlugin = mod?.FirebaseAuthentication;
        } catch {
          // Not available
        }
      }

      if (nativeAuthPlugin && typeof nativeAuthPlugin.signInWithGoogle === 'function') {
        const res = await nativeAuthPlugin.signInWithGoogle();
        const idToken = res?.credential?.idToken;
        if (!idToken) {
          throw new Error("Could not retrieve Google ID token from native authenticator.");
        }
        const credential = GoogleAuthProvider.credential(idToken);
        return await signInWithCredential(auth, credential);
      }

      // Native detected but native plugin is not yet bundled into the build
      throw new Error("Google sign-in requires the mobile app build. Use email and password, or open mamas in Chrome.");
    }

    // 2. Standard Web browser path
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    try {
      return await signInWithPopup(auth, provider);
    } catch (popupErr: any) {
      if (
        popupErr?.code === 'auth/popup-blocked' ||
        popupErr?.code === 'auth/cancelled-popup-request'
      ) {
        console.info("Popup blocked or cancelled, falling back to signInWithRedirect...");
        await signInWithRedirect(auth, provider);
        // Will not resolve in current window session as redirect triggers
        return await new Promise<never>(() => {});
      }
      throw popupErr;
    }
  }, []);

  const checkUserExists = useCallback(async (uid: string) => {
    const userDoc = await getDoc(doc(db, "users", uid));
    return userDoc.exists();
  }, []);

  const isVisitor = !currentUser;
  const isPendingDeletion = Boolean(currentUser && userProfile?.status === 'pending_deletion');
  const isSuspended = Boolean(currentUser && userProfile?.status === 'suspended');
  const isDeleted = Boolean(currentUser && userProfile?.status === 'deleted');
  const isVerified = Boolean(currentUser && userProfile?.status === 'approved');
  const isUnverified = Boolean(
    currentUser && (!userProfile || ['pending', 'unverified', 'awaiting_approval', 'rejected', 'pending_deletion', 'suspended', 'deleted'].includes(userProfile.status))
  );
  const isAdminOrCommittee = Boolean(
    currentUser &&
    userProfile?.status === 'approved' &&
    ['super_admin', 'chairperson', 'vice_chairperson', 'treasurer', 'secretary', 'auditor', 'mobiliser'].includes(userProfile.role)
  );

  let accessTier: AccessTier = 'visitor';
  if (currentUser) {
    if (isAdminOrCommittee) accessTier = 'admin';
    else if (isVerified) accessTier = 'verified';
    else accessTier = 'unverified';
  }

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      userProfile, 
      loading, 
      logout, 
      googleSignIn, 
      checkUserExists,
      isVisitor,
      isUnverified,
      isVerified,
      isAdminOrCommittee,
      isPendingDeletion,
      isSuspended,
      isDeleted,
      accessTier,
      reloadProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

