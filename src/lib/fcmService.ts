import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { doc, updateDoc, arrayUnion, addDoc, collection, getDocs, query, where, writeBatch } from "firebase/firestore";
import { app, db } from "../firebase";
import { NotificationItem, NotificationType } from "../types";

export interface NotificationPayload {
  userId: string; // Target user UID or "ALL_APPROVED"
  title: string;
  body: string;
  type: NotificationType;
  targetId?: string;
  targetUrl: string;
}

/**
 * Register FCM Service Worker and save FCM Token to User's fcmTokens array in Firestore
 */
export const registerFCMToken = async (userId: string): Promise<string | null> => {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.log("FCM Messaging is not supported in this environment");
      return null;
    }

    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      console.log("Notifications or Service Worker not supported by browser");
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("Notification permission denied by user");
      return null;
    }

    // Register service worker
    const swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/"
    });

    const messaging = getMessaging(app);

    // Get FCM Token
    const currentToken = await getToken(messaging, {
      serviceWorkerRegistration: swRegistration
    });

    if (currentToken) {
      // Save token to user document
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        fcmTokens: arrayUnion(currentToken),
        updatedAt: Date.now()
      });

      console.log("FCM Token successfully registered and saved:", currentToken);

      // Listen for foreground messages
      onMessage(messaging, (payload) => {
        console.log("Foreground message received:", payload);
        const title = payload.notification?.title || payload.data?.title || "MAMAS Notification";
        const body = payload.notification?.body || payload.data?.body || "";
        
        if (Notification.permission === "granted") {
          new Notification(title, {
            body,
            icon: "/logo.png"
          });
        }
      });

      return currentToken;
    } else {
      console.warn("No registration token available. Request permission to generate one.");
      return null;
    }
  } catch (err) {
    console.error("An error occurred while registering FCM token:", err);
    return null;
  }
};

/**
 * Core notification dispatcher that logs to Firestore and displays browser notification
 */
export const sendNotification = async (payload: NotificationPayload): Promise<string> => {
  try {
    const notificationData: Omit<NotificationItem, "id"> = {
      userId: payload.userId,
      title: payload.title,
      body: payload.body,
      type: payload.type,
      targetId: payload.targetId || undefined,
      targetUrl: payload.targetUrl,
      read: false,
      createdAt: Date.now()
    };

    const docRef = await addDoc(collection(db, "notifications"), notificationData);

    // If permission is granted, display a local notification immediately
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification(payload.title, {
        body: payload.body,
        icon: "/logo.png",
        data: { url: payload.targetUrl }
      });
    }

    return docRef.id;
  } catch (err) {
    console.error("Error sending notification:", err);
    throw err;
  }
};

/**
 * Dispatch a broadcast notification to all approved members
 */
export const notifyAllApprovedMembers = async (
  payload: Omit<NotificationPayload, "userId">
): Promise<string> => {
  return sendNotification({
    ...payload,
    userId: "ALL_APPROVED"
  });
};

/**
 * Dispatch a targeted notification to a specific member
 */
export const notifyUser = async (
  userId: string,
  payload: Omit<NotificationPayload, "userId">
): Promise<string> => {
  return sendNotification({
    ...payload,
    userId
  });
};

/**
 * Mark a single notification as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    const notifRef = doc(db, "notifications", notificationId);
    await updateDoc(notifRef, { read: true });
  } catch (err) {
    console.error("Error marking notification as read:", err);
  }
};

/**
 * Mark all notifications for a given user (including broadcast) as read
 */
export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  try {
    const q1 = query(collection(db, "notifications"), where("userId", "==", userId), where("read", "==", false));
    const q2 = query(collection(db, "notifications"), where("userId", "==", "ALL_APPROVED"), where("read", "==", false));

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

    const batch = writeBatch(db);
    snap1.forEach((d) => batch.update(d.ref, { read: true }));
    snap2.forEach((d) => batch.update(d.ref, { read: true }));

    await batch.commit();
  } catch (err) {
    console.error("Error marking all notifications as read:", err);
  }
};
