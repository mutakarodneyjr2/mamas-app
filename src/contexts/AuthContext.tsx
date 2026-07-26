import React, { createContext, useContext, useEffect, useState } from "react";
import { User as FirebaseUser, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult, signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { User as UserProfile } from "../types";
import { doc, onSnapshot } from "firebase/firestore";
import { registerFCMToken } from "../lib/fcmService";

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  setupRecaptcha: (containerId: string) => void;
  sendOtp: (phoneNumber: string) => Promise<void>;
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

  const setupRecaptcha = (containerId: string) => {
    if (!recaptchaVerifier) {
      const verifier = new RecaptchaVerifier(auth, containerId, {
        size: "invisible",
      });
      setRecaptchaVerifier(verifier);
    }
  };

  const sendOtp = async (phoneNumber: string) => {
    if (!recaptchaVerifier) throw new Error("Recaptcha not initialized");
    try {
      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
      setConfirmationResult(confirmation);
    } catch (error) {
      console.error("Error sending OTP:", error);
      throw error;
    }
  };

  const verifyOtp = async (otp: string) => {
    if (!confirmationResult) throw new Error("No OTP confirmation result");
    try {
      const cred = await confirmationResult.confirm(otp);
      return cred;
    } catch (error) {
      console.error("Error verifying OTP:", error);
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

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
