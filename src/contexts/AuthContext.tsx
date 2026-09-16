import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User as FirebaseUser, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, UserCredential } from "firebase/auth";
import { auth, db } from "../firebase";
import { User as UserProfile, AccessTier } from "../types";
import { doc, onSnapshot, getDoc } from "firebase/firestore";

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

    return () => unsubscribeAuth();
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const googleSignIn = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    return await signInWithPopup(auth, provider);
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
      accessTier
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

