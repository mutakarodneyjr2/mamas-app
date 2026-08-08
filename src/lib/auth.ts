import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
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

export const approveMember = async (targetUid: string) => {
  await updateDoc(doc(db, "users", targetUid), {
    status: "approved",
    updatedAt: Date.now()
  });
  const { logActivity } = await import('./services');
  await logActivity('APPROVE_MEMBER', 'admin', targetUid, 'Approved member registration');

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
  const updateData: any = {
    status: "rejected",
    rejectionReason: reason,
    rejectedAt: Date.now(),
    updatedAt: Date.now()
  };
  if (adminUid) {
    updateData.rejectedBy = adminUid;
  }
  await updateDoc(doc(db, "users", targetUid), updateData);
  const { logActivity } = await import('./services');
  await logActivity('REJECT_MEMBER', adminUid || 'admin', targetUid, `Rejected member registration. Reason: ${reason}`);

  const { notifyUser } = await import('./fcmService');
  await notifyUser(targetUid, {
    title: 'Registration Update',
    body: `Your membership registration was declined. Reason: ${reason}`,
    type: 'approval',
    targetId: targetUid,
    targetUrl: '/'
  }).catch(err => console.error("Notification error:", err));
};

export const updateUserRole = async (targetUid: string, newRole: UserRole) => {
  await updateDoc(doc(db, "users", targetUid), {
    role: newRole,
    updatedAt: Date.now()
  });
  const { logActivity } = await import('./services');
  await logActivity('UPDATE_USER_ROLE', 'admin', targetUid, `Updated role to ${newRole}`);
};
