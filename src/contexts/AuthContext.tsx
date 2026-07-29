import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User as FirebaseUser, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, UserCredential } from "firebase/auth";
import { auth, db } from "../firebase";
import { User as UserProfile } from "../types";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { registerFCMToken } from "../lib/fcmService";

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  googleSignIn: () => Promise<UserCredential>;
  checkUserExists: (uid: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Register FCM token for user
        registerFCMToken(user.uid).catch((err) =>
          console.error("Failed to register FCM token:", err)
        );

        // Listen to profile changes
        const unsubscribeProfile = onSnapshot(doc(db, "users", user.uid), async (document) => {
          if (document.exists()) {
            setUserProfile(document.data() as UserProfile);
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

    return () => unsubscribeAuth();
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const googleSignIn = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    return await signInWithPopup(auth, provider);
  }, []);

  const checkUserExists = useCallback(async (uid: string) => {
    const userDoc = await getDoc(doc(db, "users", uid));
    return userDoc.exists();
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, logout, googleSignIn, checkUserExists }}>
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

