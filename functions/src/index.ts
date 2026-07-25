import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

/**
 * Helper to gather FCM tokens from approved users
 */
async function getApprovedUserTokens(): Promise<string[]> {
  const snapshot = await admin.firestore().collection("users")
    .where("status", "==", "approved")
    .get();

  const tokens: string[] = [];
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
      tokens.push(...data.fcmTokens);
    }
  });

  return Array.from(new Set(tokens)).filter(Boolean);
}

/**
 * Helper to gather FCM tokens for a specific user ID
 */
async function getUserTokens(userId: string): Promise<string[]> {
  const userDoc = await admin.firestore().collection("users").doc(userId).get();
  if (!userDoc.exists) return [];
  const data = userDoc.data();
  if (data?.fcmTokens && Array.isArray(data.fcmTokens)) {
    return Array.from(new Set(data.fcmTokens as string[])).filter(Boolean);
  }
  return [];
}

/**
 * Helper to send FCM multicast notifications
 */
async function sendPushToTokens(tokens: string[], title: string, body: string, targetUrl: string) {
  if (!tokens || tokens.length === 0) return;

  const message = {
    notification: {
      title,
      body,
    },
    data: {
      targetUrl,
      click_action: targetUrl,
    },
    tokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`Successfully sent ${response.successCount} messages; ${response.failureCount} failed.`);
    
    // Clean up stale tokens if any failed
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
        }
      });
      console.log("Stale tokens to clean up:", failedTokens);
    }
  } catch (error) {
    console.error("Error sending FCM multicast notification:", error);
  }
}

/**
 * Event 1: New Notice posted -> all approved members
 */
export const onNoticeCreated = functions.firestore
  .document("notices/{noticeId}")
  .onCreate(async (snap) => {
    const notice = snap.data();
    if (!notice) return;

    const tokens = await getApprovedUserTokens();
    const title = `New Notice: ${notice.title || "Announcement"}`;
    const body = notice.body ? (notice.body.length > 100 ? notice.body.substring(0, 100) + "..." : notice.body) : "New notice posted.";

    await sendPushToTokens(tokens, title, body, "/notices");
  });

/**
 * Event 2: Welfare request status changed (Accepted / Declined / Paid) -> applicant
 */
export const onWelfareStatusChanged = functions.firestore
  .document("welfareRequests/{requestId}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    if (!before || !after || before.status === after.status) return;

    if (["accepted", "declined", "paid"].includes(after.status)) {
      const tokens = await getUserTokens(after.userId);
      const statusLabel = after.status.charAt(0).toUpperCase() + after.status.slice(1);
      const title = `Welfare Request ${statusLabel}`;
      const body = `Your welfare request for ${after.category || "assistance"} is now ${after.status}.`;

      await sendPushToTokens(tokens, title, body, "/welfare");
    }
  });

/**
 * Event 3: New School Support Campaign created -> all approved members
 */
export const onCampaignCreated = functions.firestore
  .document("schoolCampaigns/{campaignId}")
  .onCreate(async (snap) => {
    const campaign = snap.data();
    if (!campaign) return;

    const tokens = await getApprovedUserTokens();
    const title = `New Campaign: ${campaign.title || "School Support"}`;
    const body = `Target: UGX ${(campaign.targetAmount || 0).toLocaleString()}. ${campaign.description ? campaign.description.substring(0, 80) : ""}`;

    await sendPushToTokens(tokens, title, body, "/campaigns");
  });

/**
 * Event 4: Contribution verified -> contributor
 */
export const onContributionVerified = functions.firestore
  .document("contributions/{contributionId}")
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    if (!before || !after) return;

    if (before.status !== "verified" && after.status === "verified") {
      const tokens = await getUserTokens(after.userId);
      const title = "Contribution Verified";
      const body = `Your ${after.type === "welfare" ? "Welfare" : "Campaign"} contribution of UGX ${(after.amount || 0).toLocaleString()} has been verified.`;

      await sendPushToTokens(tokens, title, body, "/statement");
    }
  });

/**
 * Event 5: New member approved -> new member
 */
export const onUserApproved = functions.firestore
  .document("users/{userId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (!before || !after) return;

    if (before.status !== "approved" && after.status === "approved") {
      const userId = context.params.userId;
      const tokens = await getUserTokens(userId);
      const title = "Account Approved!";
      const body = "Welcome to MAMAS! Your membership application has been approved.";

      await sendPushToTokens(tokens, title, body, "/dashboard");
    }
  });
