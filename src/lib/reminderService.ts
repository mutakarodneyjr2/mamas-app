import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User, Contribution, AppSettings } from '../types';
import { sendNotification } from './fcmService';
import { logActivity } from './activity';

export interface ReminderCheckResult {
  checkedCount: number;
  remindedCount: number;
  remindedUsers: { uid: string; fullName: string; totalContributedLast7Days: number }[];
}

/**
 * Automatically or manually check members who:
 * 1. Have not contributed in the last 7 days, OR
 * 2. Have contributed less than the minimum weekly contribution (default 5,000 UGX) in the last 7 days.
 * And send them a push/in-app notification reminder.
 */
export async function triggerContributionReminders(performedBy: string, targetUserId?: string): Promise<ReminderCheckResult> {
  // 1. Fetch app settings for minimum weekly contribution
  let minContribution = 5000;
  try {
    const settingsDoc = await getDoc(doc(db, 'appSettings', 'main'));
    if (settingsDoc.exists()) {
      const data = settingsDoc.data() as AppSettings;
      if (data.minimumWeeklyContribution) {
        minContribution = data.minimumWeeklyContribution;
      }
    }
  } catch (err) {
    console.error("Error fetching settings for minimum contribution:", err);
  }

  // 2. Fetch approved users
  const usersQuery = targetUserId 
    ? query(collection(db, 'users'), where('uid', '==', targetUserId))
    : query(collection(db, 'users'), where('status', '==', 'approved'));
  
  const userSnapshot = await getDocs(usersQuery);
  const users: User[] = [];
  userSnapshot.forEach(d => {
    users.push(d.data() as User);
  });

  // 3. Fetch verified contributions from the last 7 days
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const contribQuery = query(
    collection(db, 'contributions'),
    where('status', '==', 'verified'),
    where('createdAt', '>=', sevenDaysAgo)
  );
  const contribSnapshot = await getDocs(contribQuery);
  
  const contributionsByUser: Record<string, number> = {};
  contribSnapshot.forEach(d => {
    const c = d.data() as Contribution;
    if (c.userId) {
      contributionsByUser[c.userId] = (contributionsByUser[c.userId] || 0) + c.amount;
    }
  });

  let remindedCount = 0;
  const remindedUsers: { uid: string; fullName: string; totalContributedLast7Days: number }[] = [];

  for (const user of users) {
    const contributed = contributionsByUser[user.uid] || 0;
    
    // If targeted manually, or if they meet the criteria (< minContribution)
    const shouldRemind = targetUserId ? true : contributed < minContribution;

    if (shouldRemind) {
      const messageBody = contributed === 0
        ? `Dear ${user.fullName}, you have not made any welfare or campaign contributions in the last 7 days. Please support our alma mater by contributing at least UGX ${minContribution.toLocaleString()} this week.`
        : `Dear ${user.fullName}, your contributions in the last 7 days total UGX ${contributed.toLocaleString()}, which is below the weekly recommended UGX ${minContribution.toLocaleString()}. Kindly top up your support.`;

      try {
        await sendNotification({
          userId: user.uid,
          title: "Weekly Contribution Reminder",
          body: messageBody,
          type: "contribution",
          targetUrl: "/contribute"
        });

        remindedCount++;
        remindedUsers.push({
          uid: user.uid,
          fullName: user.fullName,
          totalContributedLast7Days: contributed
        });

        await logActivity(
          'CONTRIBUTION_REMINDER',
          performedBy,
          user.uid,
          `Sent automated/manual contribution reminder. Last 7 days contributed: UGX ${contributed}`
        );
      } catch (notifErr) {
        console.error(`Failed to send reminder to user ${user.uid}:`, notifErr);
      }
    }
  }

  return {
    checkedCount: users.length,
    remindedCount,
    remindedUsers
  };
}
