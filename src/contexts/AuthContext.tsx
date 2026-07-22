import React, { createContext, useContext, useEffect, useState } from "react";
import { User as FirebaseUser, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult, signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { User as UserProfile } from "../types";
import { doc, onSnapshot } from "firebase/firestore";

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
        // Listen to profile changes
        const unsubscribeProfile = onSnapshot(doc(db, "users", user.uid), (doc) => {
          if (doc.exists()) {
            setUserProfile(doc.data() as UserProfile);
          } else {
            setUserProfile(null);
          }
          setLoading(false);
        });
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
