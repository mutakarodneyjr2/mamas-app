import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { User, UserRole, UserStatus } from "../types";

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
      const compressedBlob = await compressImageToBlob(profilePicFile);
      const picRef = ref(storage, `profile_pictures/${uid}_${Date.now()}.jpg`);
      await uploadBytes(picRef, compressedBlob);
      profilePictureUrl = await getDownloadURL(picRef);
    } catch (e) {
      console.error("Profile picture upload failed during registration:", e);
      // Still proceed with registration even if picture fails, or could throw. We log it for now.
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
};

export const rejectMember = async (targetUid: string) => {
  await updateDoc(doc(db, "users", targetUid), {
    status: "rejected",
    updatedAt: Date.now()
  });
  const { logActivity } = await import('./services');
  await logActivity('REJECT_MEMBER', 'admin', targetUid, 'Rejected member registration');
};

export const updateUserRole = async (targetUid: string, newRole: UserRole) => {
  await updateDoc(doc(db, "users", targetUid), {
    role: newRole,
    updatedAt: Date.now()
  });
  const { logActivity } = await import('./services');
  await logActivity('UPDATE_USER_ROLE', 'admin', targetUid, `Updated role to ${newRole}`);
};
