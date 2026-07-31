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
      console.warn("Notification permission denied by user");
      return null;
    }

    // Register service worker
    const swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/"
    });

    const messaging = getMessaging(app);

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn("VITE_FIREBASE_VAPID_KEY is not set in environment. FCM token generation might fail or require default key.");
    }

    // Get FCM Token
    const currentToken = await getToken(messaging, {
      serviceWorkerRegistration: swRegistration,
      ...(vapidKey ? { vapidKey } : {})
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
      console.warn("No registration token available. Check FCM setup or VAPID key configuration.");
      return null;
    }
  } catch (err) {
    console.error("An error occurred while registering FCM token:", err);
    return null;
  }
};

/**
 * Core notification dispatcher that dispatches real server push via /api/notifications/send
 * and logs in-app notification to Firestore.
 */
export const sendNotification = async (payload: NotificationPayload): Promise<string> => {
  try {
    // Attempt real server-side push notification + in-app notification write via API endpoint
    const response = await fetch('/api/notifications/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const data = await response.json();
      
      // If display is granted and user is in active browser session, trigger foreground fallback
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification(payload.title, {
          body: payload.body,
          icon: "/logo.png",
          data: { url: payload.targetUrl }
        });
      }

      return data.notificationId || "success";
    } else {
      const errData = await response.json().catch(() => ({}));
      console.warn("Server push endpoint error, falling back to direct Firestore write:", errData.message);
    }
  } catch (apiErr) {
    console.warn("Server push endpoint unreachable, falling back to direct Firestore write:", apiErr);
  }

  // Fallback: direct client-side Firestore doc creation
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

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification(payload.title, {
        body: payload.body,
        icon: "/logo.png",
        data: { url: payload.targetUrl }
      });
    }

    return docRef.id;
  } catch (err) {
    console.error("Error creating fallback notification:", err);
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
