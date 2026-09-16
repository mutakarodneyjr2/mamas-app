import { doc, getDoc, setDoc, updateDoc, serverTimestamp, runTransaction, getDocs, collection, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { User, UserRole, UserStatus } from "../types";
import { uploadImage } from "./storage";

const compressImageToBlob = async (file: File, maxWidth = 500, maxHeight = 500, quality = 0.8): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas toBlob failed'));
          }
        }, 'image/jpeg', quality);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export const getUserProfile = async (uid: string): Promise<User | null> => {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as User;
  }
  return null;
};

export const completeProfile = async (
  uid: string,
  phoneNumber: string,
  data: Omit<User, "uid" | "phoneNumber" | "role" | "status" | "contributionStatus" | "createdAt" | "updatedAt" | "totalContributed" | "profilePictureUrl">,
  profilePicFile?: File
) => {
  let profilePictureUrl = "";
  if (profilePicFile) {
    try {
      profilePictureUrl = await uploadImage(profilePicFile, `profile_pictures/${uid}_${Date.now()}.jpg`, {
        timeoutMs: 8000,
        allowDataUrlFallback: true
      });
    } catch (e) {
      console.error("Profile picture upload failed during registration:", e);
    }
  }

  const userDoc: Partial<User> = {
    ...data,
    uid,
    phoneNumber,
    role: "member",
    status: "pending",
    contributionStatus: "inactive",
    totalContributed: 0,
    profilePictureUrl,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await setDoc(doc(db, "users", uid), userDoc);
};

export const approveMember = async (targetUid: string, adminUid?: string) => {
  if (adminUid && adminUid === targetUid) {
    throw new Error("You cannot approve your own membership request.");
  }
  await runTransaction(db, async (transaction) => {
    const userRef = doc(db, "users", targetUid);
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) throw new Error("User not found.");
    if (userDoc.data().status !== "pending") {
      throw new Error(`User is already ${userDoc.data().status}. No further action needed.`);
    }
    transaction.update(userRef, {
      status: "approved",
      updatedAt: Date.now()
    });
  });
  
  const { logActivity } = await import('./services');
  await logActivity('APPROVE_MEMBER', adminUid || 'admin', targetUid, 'Approved member registration');

  const { notifyUser } = await import('./fcmService');
  await notifyUser(targetUid, {
    title: 'Account Approved!',
    body: 'Welcome to MAMAS! Your membership registration has been approved.',
    type: 'approval',
    targetId: targetUid,
    targetUrl: '/dashboard'
  }).catch(err => console.error("Notification error:", err));
};

export const rejectMember = async (targetUid: string, reason: string, adminUid?: string) => {
  if (adminUid && adminUid === targetUid) {
    throw new Error("You cannot reject your own membership request.");
  }
  const trimmedReason = reason?.trim();
  if (!trimmedReason) {
    throw new Error("A reason is required when rejecting a member.");
  }
  
  await runTransaction(db, async (transaction) => {
    const userRef = doc(db, "users", targetUid);
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) throw new Error("User not found.");
    if (userDoc.data().status !== "pending") {
      throw new Error(`User is already ${userDoc.data().status}. No further action needed.`);
    }
    const updateData: any = {
      status: "rejected",
      rejectionReason: trimmedReason,
      rejectedAt: Date.now(),
      updatedAt: Date.now()
    };
    if (adminUid) {
      updateData.rejectedBy = adminUid;
    }
    transaction.update(userRef, updateData);
  });
  
  const { logActivity } = await import('./services');
  await logActivity('REJECT_MEMBER', adminUid || 'admin', targetUid, `Rejected member registration. Reason: ${trimmedReason}`);

  const { notifyUser } = await import('./fcmService');
  await notifyUser(targetUid, {
    title: 'Registration Update',
    body: `Your membership registration was declined. Reason: ${trimmedReason}`,
    type: 'approval',
    targetId: targetUid,
    targetUrl: '/'
  }).catch(err => console.error("Notification error:", err));
};

export const updateUserRole = async (targetUid: string, newRole: UserRole, adminUid?: string) => {
  if (adminUid && adminUid === targetUid) {
     throw new Error("You cannot change your own role.");
  }
  
  const targetRef = doc(db, "users", targetUid);
  const targetSnap = await getDoc(targetRef);
  if (!targetSnap.exists()) throw new Error("User not found.");
  
  const currentRole = targetSnap.data().role;
  if (currentRole === newRole) return;
  
  if (targetSnap.data().status !== "approved" && newRole !== "member") {
    throw new Error("Privileged roles can only be assigned to approved members.");
  }
  
  if (currentRole === "super_admin") {
    const allAdminsQuery = query(collection(db, "users"), where("role", "==", "super_admin"));
    const allAdmins = await getDocs(allAdminsQuery);
    if (allAdmins.size <= 1) {
      throw new Error("Cannot remove the last Super Admin. Please grant Super Admin to another user first.");
    }
  }

  await updateDoc(targetRef, {
    role: newRole,
    updatedAt: Date.now()
  });
  
  const { logActivity } = await import('./services');
  await logActivity('UPDATE_USER_ROLE', adminUid || 'admin', targetUid, `Updated role from ${currentRole} to ${newRole}`);
  
  // Notify user
  const { notifyUser } = await import('./fcmService');
  let roleName = newRole.replace('_', ' ');
  roleName = roleName.charAt(0).toUpperCase() + roleName.slice(1);
  await notifyUser(targetUid, {
    title: 'Role Updated',
    body: `Your account role has been updated to ${roleName}.`,
    type: 'approval',
    targetId: targetUid,
    targetUrl: '/dashboard'
  }).catch(err => console.error("Notification error:", err));
};

// ==========================================
// MEMBER SELF-SERVICE ACCOUNT DELETION
// ==========================================

export const scheduleAccountDeletion = async (userId: string, reason?: string, _currentUser?: any) => {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error("User account not found.");
  
  const userData = userSnap.data() as User;

  if (userData.status === "pending_deletion") {
    const effectiveDate = userData.deletionEffectiveAt 
      ? new Date(userData.deletionEffectiveAt).toLocaleDateString()
      : 'in 30 days';
    throw new Error(`Deletion already scheduled. Effective date: ${effectiveDate}`);
  }

  if (userData.status === "deleted") {
    throw new Error("This account is already deleted.");
  }

  // BLOCKER 1: Last SuperAdmin Check
  if (userData.role === "super_admin") {
    const superAdminsSnap = await getDocs(query(collection(db, "users"), where("role", "==", "super_admin")));
    const activeSuperAdmins = superAdminsSnap.docs.filter(d => {
      const u = d.data() as User;
      return d.id !== userId && u.status !== "deleted" && u.status !== "suspended" && u.status !== "pending_deletion";
    });
    if (activeSuperAdmins.length === 0) {
      throw new Error("Transfer SuperAdmin authority to another administrator before deleting your account.");
    }
  }

  // BLOCKER 2: Unsettled / In-Progress Payouts Check
  try {
    const welfareSnap = await getDocs(query(collection(db, "welfareRequests"), where("userId", "==", userId)));
    const hasUnsettledPayout = welfareSnap.docs.some(d => {
      const w = d.data();
      return w.disbursementStatus === "in_progress" || w.disbursementStatus === "processing" || (w.status === "accepted" && w.disbursementStatus === "pending");
    });
    if (hasUnsettledPayout) {
      throw new Error("Finish or resolve in-progress payouts before deleting your account.");
    }
  } catch (err: any) {
    if (err.message && err.message.includes("payouts")) throw err;
    console.warn("Could not check welfare payouts during deletion schedule:", err);
  }

  // BLOCKER 3: Pending Contributions Check
  try {
    const contribsSnap = await getDocs(query(collection(db, "contributions"), where("userId", "==", userId)));
    const hasPendingContrib = contribsSnap.docs.some(d => {
      const c = d.data();
      return c.status === "pending" || c.status === "pending_payment" || (c as any).paymentStatus === "pending_payment";
    });
    if (hasPendingContrib) {
      throw new Error("You have pending mobile-money contributions awaiting settlement. Please wait for them to settle or expire before deleting your account.");
    }
  } catch (err: any) {
    if (err.message && err.message.includes("contributions")) throw err;
    console.warn("Could not check pending contributions during deletion schedule:", err);
  }

  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const deletionEffectiveAt = now + thirtyDaysMs;
  const historicalName = userData.fullName || "Former Member";

  await updateDoc(userRef, {
    status: "pending_deletion",
    statusPrevious: userData.status || "approved",
    deletionScheduledAt: now,
    deletionEffectiveAt: deletionEffectiveAt,
    deletionType: "self",
    deletionReason: reason || null,
    historicalDisplayName: historicalName,
    updatedAt: now
  });

  const { logActivity } = await import('./services');
  await logActivity('SCHEDULE_ACCOUNT_DELETION', userId, userId, `Scheduled account deletion with 30-day grace period (Effective: ${new Date(deletionEffectiveAt).toLocaleDateString()})${reason ? ` - Reason: ${reason}` : ''}`);

  const { notifyUser } = await import('./fcmService');
  await notifyUser(userId, {
    title: 'Account Deletion Scheduled',
    body: `Your account is scheduled for deletion on ${new Date(deletionEffectiveAt).toLocaleDateString()}. You can cancel this anytime before the date by logging in.`,
    type: 'approval',
    targetId: userId,
    targetUrl: '/profile'
  }).catch(err => console.error("Notification error:", err));

  return { deletionEffectiveAt };
};

export const cancelAccountDeletion = async (userId: string, _currentUser?: any) => {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error("User account not found.");
  
  const userData = userSnap.data() as User;

  if (userData.status !== "pending_deletion") {
    throw new Error("Account is not currently scheduled for deletion.");
  }

  const now = Date.now();
  if (userData.deletionEffectiveAt && now >= userData.deletionEffectiveAt) {
    throw new Error("The 30-day grace period has expired. Account deletion has finalized.");
  }

  const restoredStatus = userData.statusPrevious && userData.statusPrevious !== "pending_deletion" && userData.statusPrevious !== "deleted"
    ? userData.statusPrevious
    : "approved";

  await updateDoc(userRef, {
    status: restoredStatus,
    deletionScheduledAt: null as any,
    deletionEffectiveAt: null as any,
    deletionType: null as any,
    deletionCancelledAt: now,
    updatedAt: now
  });

  const { logActivity } = await import('./services');
  await logActivity('CANCEL_ACCOUNT_DELETION', userId, userId, 'Cancelled scheduled account deletion and restored member access');

  const { notifyUser } = await import('./fcmService');
  await notifyUser(userId, {
    title: 'Account Deletion Cancelled',
    body: 'Your account deletion request has been cancelled. Your full member access has been restored.',
    type: 'approval',
    targetId: userId,
    targetUrl: '/profile'
  }).catch(err => console.error("Notification error:", err));
};

export const finalizeAccountDeletion = async (userId: string) => {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return;
  
  const userData = userSnap.data() as User;
  if (userData.status === "deleted") return; // Safe no-op

  const now = Date.now();
  const historicalName = userData.historicalDisplayName || userData.fullName || "Former Member";

  await updateDoc(userRef, {
    status: "deleted",
    historicalDisplayName: historicalName,
    fullName: historicalName,
    phoneNumber: "REDACTED",
    email: `deleted_${userId.slice(0, 8)}@anonymized.mamas`,
    profilePictureUrl: "",
    placeOfResidence: "",
    district: "",
    workplace: "",
    university: "",
    course: "",
    nextOfKinName: "",
    nextOfKinPhone: "",
    recoveryEmail: "",
    fcmTokens: [],
    anonymizedAt: now,
    updatedAt: now
  });

  const { logActivity } = await import('./services');
  await logActivity('FINALIZE_ACCOUNT_DELETION', 'system', userId, `Finalized account deletion and anonymized personal profile while preserving financial history for ${historicalName}`);
};

// ==========================================
// SUPER ADMIN-ONLY SUSPEND / UNSUSPEND
// ==========================================

export const suspendUser = async (targetUid: string, adminUid: string, reason: string) => {
  if (!adminUid) throw new Error("Admin ID required.");
  
  const adminSnap = await getDoc(doc(db, "users", adminUid));
  if (!adminSnap.exists()) throw new Error("Administrator account not found.");
  const adminRole = adminSnap.data().role;
  if (adminRole !== "super_admin") {
    throw new Error("Only Super Admin can suspend accounts.");
  }

  const trimmedReason = reason?.trim();
  if (!trimmedReason || trimmedReason.length < 5) {
    throw new Error("A specific suspension reason (minimum 5 characters) is required.");
  }

  const targetRef = doc(db, "users", targetUid);
  const targetSnap = await getDoc(targetRef);
  if (!targetSnap.exists()) throw new Error("Target user account not found.");
  const targetData = targetSnap.data() as User;

  if (targetData.status === "suspended") {
    throw new Error("User account is already suspended.");
  }

  // Check last SuperAdmin protection
  if (targetData.role === "super_admin") {
    const superAdminsSnap = await getDocs(query(collection(db, "users"), where("role", "==", "super_admin")));
    const activeSuperAdmins = superAdminsSnap.docs.filter(d => {
      const u = d.data() as User;
      return d.id !== targetUid && u.status !== "deleted" && u.status !== "suspended";
    });
    if (activeSuperAdmins.length === 0) {
      throw new Error("Cannot suspend the last Super Admin. The association requires at least one active Super Admin.");
    }
  }

  const now = Date.now();
  await updateDoc(targetRef, {
    status: "suspended",
    statusPrevious: targetData.status || "approved",
    suspendedAt: now,
    suspendedBy: adminUid,
    suspendReason: trimmedReason,
    updatedAt: now
  });

  const { logActivity } = await import('./services');
  await logActivity('SUSPEND_USER', adminUid, targetUid, `Suspended member account (${targetData.fullName}). Reason: ${trimmedReason}`);

  const { notifyUser } = await import('./fcmService');
  await notifyUser(targetUid, {
    title: 'Account Suspended',
    body: `Your MAMAS account has been suspended by the Super Administrator. Reason: ${trimmedReason}`,
    type: 'approval',
    targetId: targetUid,
    targetUrl: '/'
  }).catch(err => console.error("Notification error:", err));
};

export const unsuspendUser = async (targetUid: string, adminUid: string) => {
  if (!adminUid) throw new Error("Admin ID required.");
  
  const adminSnap = await getDoc(doc(db, "users", adminUid));
  if (!adminSnap.exists()) throw new Error("Administrator account not found.");
  const adminRole = adminSnap.data().role;
  if (adminRole !== "super_admin") {
    throw new Error("Only Super Admin can unsuspend accounts.");
  }

  const targetRef = doc(db, "users", targetUid);
  const targetSnap = await getDoc(targetRef);
  if (!targetSnap.exists()) throw new Error("Target user account not found.");
  const targetData = targetSnap.data() as User;

  if (targetData.status !== "suspended") {
    throw new Error("User account is not currently suspended.");
  }

  const restoredStatus = targetData.statusPrevious && targetData.statusPrevious !== "suspended" && targetData.statusPrevious !== "deleted"
    ? targetData.statusPrevious
    : "approved";

  const now = Date.now();
  await updateDoc(targetRef, {
    status: restoredStatus,
    suspendedAt: null as any,
    suspendedBy: null as any,
    suspendReason: null as any,
    updatedAt: now
  });

  const { logActivity } = await import('./services');
  await logActivity('UNSUSPEND_USER', adminUid, targetUid, `Unsuspended member account (${targetData.fullName}) and restored access`);

  const { notifyUser } = await import('./fcmService');
  await notifyUser(targetUid, {
    title: 'Account Restored',
    body: 'Your account suspension has been lifted by the Super Administrator.',
    type: 'approval',
    targetId: targetUid,
    targetUrl: '/dashboard'
  }).catch(err => console.error("Notification error:", err));
};

