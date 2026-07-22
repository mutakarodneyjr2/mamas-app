import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';

export async function logActivity(userId: string, userName: string, action: string, details: string) {
  try {
    await addDoc(collection(db, 'activityLogs'), {
      userId,
      userName,
      action,
      details,
      createdAt: Date.now()
    });
  } catch (err) {
    console.error('Failed to log activity', err);
  }
}
