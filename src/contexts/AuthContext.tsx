import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { User as FirebaseUser, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult, signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { User as UserProfile } from "../types";
import { doc, onSnapshot } from "firebase/firestore";
import { registerFCMToken } from "../lib/fcmService";

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  setupRecaptcha: (containerId?: string) => void;
  sendOtp: (phoneNumber: string, containerId?: string) => Promise<void>;
  verifyOtp: (otp: string) => Promise<void>;
  logout: () => Promise<void>;
  recaptchaVerifier: RecaptchaVerifier | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Register FCM token for user
        registerFCMToken(user.uid).catch((err) =>
          console.error("Failed to register FCM token:", err)
        );

        // Listen to profile changes
        let unsubscribeProfile = () => {};
        
        const setupProfileListener = (targetUid: string) => {
          unsubscribeProfile = onSnapshot(doc(db, "users", targetUid), async (document) => {
            if (document.exists()) {
              setUserProfile(document.data() as UserProfile);
              setLoading(false);
            } else {
              // If not found by UID, check if they are a migrated user (logged in via SMS)
              if (user.phoneNumber && targetUid === user.uid) {
                const { collection, query, where, getDocs } = await import("firebase/firestore");
                const q = query(collection(db, "users"), where("phoneNumber", "==", user.phoneNumber));
                const snap = await getDocs(q);
                if (!snap.empty && snap.docs[0].id !== user.uid) {
                  // Found a migrated profile! Listen to it instead.
                  unsubscribeProfile();
                  setupProfileListener(snap.docs[0].id);
                  return;
                }
              }
              setUserProfile(null);
              setLoading(false);
            }
          });
        };

        setupProfileListener(user.uid);
        
        return () => unsubscribeProfile();
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const setupRecaptcha = useCallback((containerId: string = "recaptcha-container") => {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch (e) {
        // ignore clear error
      }
      recaptchaVerifierRef.current = null;
    }
    const element = document.getElementById(containerId);
    if (!element) return;
    try {
      const verifier = new RecaptchaVerifier(auth, containerId, {
        size: "invisible",
        callback: () => {},
        "expired-callback": () => {}
      });
      recaptchaVerifierRef.current = verifier;
      setRecaptchaVerifier(verifier);
    } catch (e) {
      console.error("Error setting up RecaptchaVerifier:", e);
    }
  }, []);

  const sendOtp = useCallback(async (phoneNumber: string, containerId: string = "recaptcha-container") => {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch (e) {
        // ignore
      }
      recaptchaVerifierRef.current = null;
    }

    const targetContainer = document.getElementById(containerId) ? containerId : "recaptcha-container";
    
    let verifier: RecaptchaVerifier;
    try {
      verifier = new RecaptchaVerifier(auth, targetContainer, {
        size: "invisible",
        callback: () => {},
        "expired-callback": () => {}
      });
      recaptchaVerifierRef.current = verifier;
      setRecaptchaVerifier(verifier);
    } catch (e) {
      console.error("Failed to construct RecaptchaVerifier:", e);
      throw e;
    }

    try {
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, verifier);
      setConfirmationResult(confirmation);
    } catch (error) {
      console.error("Error sending OTP:", error);
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch (e) {}
        recaptchaVerifierRef.current = null;
      }
      setRecaptchaVerifier(null);
      throw error;
    }
  }, []);

  const verifyOtp = useCallback(async (otp: string) => {
    if (!confirmationResult) throw new Error("No OTP confirmation result");
    try {
      const cred = await confirmationResult.confirm(otp);
      return cred;
    } catch (error) {
      console.error("Error verifying OTP:", error);
      throw error;
    }
  }, [confirmationResult]);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, setupRecaptcha, sendOtp, verifyOtp, logout, recaptchaVerifier }}>
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
