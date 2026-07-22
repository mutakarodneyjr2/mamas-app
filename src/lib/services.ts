import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  runTransaction,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Contribution, 
  WelfareRequest, 
  SchoolCampaign, 
  Notice, 
  ActivityLog, 
  AppSettings,
  ContributionType
} from '../types';

// ==========================================
// UTILS
// ==========================================

export const logActivity = async (action: string, performedBy: string, targetId: string, details: string) => {
  const log: Omit<ActivityLog, 'id'> = {
    action,
    performedBy,
    targetId,
    details,
    createdAt: Date.now()
  };
  await addDoc(collection(db, 'activityLogs'), log);
};

export const getAppSettings = async (): Promise<AppSettings> => {
  const docSnap = await getDoc(doc(db, 'appSettings', 'main'));
  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      id: 'main',
      welfareCategories: data.welfareCategories || ['Medical Emergency', 'Bereavement', 'Education Support', 'Wedding / Marriage', 'General Welfare'],
      allowedRelationships: data.allowedRelationships || ['Self', 'Spouse', 'Child', 'Parent', 'Sibling'],
      maxAmounts: data.maxAmounts || { 'Medical Emergency': 1000000, 'Bereavement': 800000, 'Education Support': 500000, 'Wedding / Marriage': 500000, 'General Welfare': 300000 },
      welfareApprovers: data.welfareApprovers || [],
      showTotalBalanceToMembers: !!data.showTotalBalanceToMembers,
      showTopContributors: !!data.showTopContributors,
      minimumWeeklyContribution: data.minimumWeeklyContribution || 5000,
      banners: data.banners || data.landingBanners || [],
      landingBanners: data.banners || data.landingBanners || []
    } as AppSettings;
  }
  return {
    id: 'main',
    welfareCategories: ['Medical Emergency', 'Bereavement', 'Education Support', 'Wedding / Marriage', 'General Welfare'],
    allowedRelationships: ['Self', 'Spouse', 'Child', 'Parent', 'Sibling'],
    maxAmounts: { 'Medical Emergency': 1000000, 'Bereavement': 800000, 'Education Support': 500000, 'Wedding / Marriage': 500000, 'General Welfare': 300000 },
    welfareApprovers: [],
    showTotalBalanceToMembers: true,
    showTopContributors: true,
    minimumWeeklyContribution: 5000,
    banners: [],
    landingBanners: []
  };
};

export const updateWelfareApprovers = async (adminId: string, approverIds: string[]) => {
  if (approverIds.length !== 3) {
    throw new Error("There must be exactly 3 welfare approvers.");
  }
  
  const userDoc = await getDoc(doc(db, 'users', adminId));
  if (!userDoc.exists() || !['super_admin', 'chairperson'].includes(userDoc.data().role)) {
    throw new Error("Only Super Admin or Chairperson can update welfare approvers.");
  }

  await updateDoc(doc(db, 'appSettings', 'main'), {
    welfareApprovers: approverIds
  });
  
  await logActivity('UPDATE_APPROVERS', adminId, 'main', `Updated welfare approvers`);
};

// ==========================================
// CONTRIBUTIONS
// ==========================================

export const recordContribution = async (
  userId: string, 
  amount: number, 
  transactionReference: string, 
  type: ContributionType = "welfare", 
  campaignId: string | null = null, 
  note: string = ""
) => {
  if (amount <= 0) throw new Error("Amount must be greater than 0");

  const contributionData: Omit<Contribution, 'id'> = {
    userId,
    amount,
    currency: "UGX",
    type,
    campaignId,
    transactionReference,
    status: "pending",
    note,
    createdAt: Date.now()
  };

  const docRef = await addDoc(collection(db, 'contributions'), contributionData);
  await logActivity('RECORD_CONTRIBUTION', userId, docRef.id, `Recorded ${type} contribution of UGX ${amount}`);
  return docRef.id;
};

export const verifyContribution = async (contributionId: string, adminId: string) => {
  const contributionRef = doc(db, 'contributions', contributionId);

  await runTransaction(db, async (transaction) => {
    const contributionDoc = await transaction.get(contributionRef);
    if (!contributionDoc.exists()) throw new Error("Contribution not found");
    
    const contribution = contributionDoc.data() as Contribution;
    if (contribution.status !== "pending") throw new Error("Contribution is not pending");

    const userRef = doc(db, 'users', contribution.userId);
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) throw new Error("User not found");

    const userData = userDoc.data();
    
    // Update contribution
    transaction.update(contributionRef, {
      status: "verified",
      verifiedBy: adminId,
      verifiedAt: Date.now()
    });

    // Update user totals based on type
    const newTotalContributed = contribution.type === 'welfare' 
      ? (userData.totalContributed || 0) + contribution.amount 
      : (userData.totalContributed || 0);

    const newCampaignContributed = contribution.type === 'school_support'
      ? (userData.totalCampaignContributed || 0) + contribution.amount
      : (userData.totalCampaignContributed || 0);

    transaction.update(userRef, {
      totalContributed: newTotalContributed,
      totalCampaignContributed: newCampaignContributed,
      lastContributionDate: Date.now(),
      contributionStatus: "active",
      updatedAt: Date.now()
    });

    // If campaign, update campaign total
    if (contribution.type === 'school_support' && contribution.campaignId) {
      const campaignRef = doc(db, 'schoolCampaigns', contribution.campaignId);
      const campaignDoc = await transaction.get(campaignRef);
      if (campaignDoc.exists()) {
        const campaignData = campaignDoc.data();
        const newRaisedAmount = (campaignData.raisedAmount || 0) + contribution.amount;
        const updates: any = {
          raisedAmount: newRaisedAmount,
          updatedAt: Date.now()
        };
        
        if (campaignData.targetAmount > 0 && newRaisedAmount >= campaignData.targetAmount && campaignData.status === 'active') {
          updates.status = 'fully_funded';
        }
        
        transaction.update(campaignRef, updates);
      }
    }
  });

  await logActivity('VERIFY_CONTRIBUTION', adminId, contributionId, `Verified contribution`);
};

export const rejectContribution = async (contributionId: string, adminId: string, reason: string) => {
  const contributionRef = doc(db, 'contributions', contributionId);

  await runTransaction(db, async (transaction) => {
    const contributionDoc = await transaction.get(contributionRef);
    if (!contributionDoc.exists()) throw new Error("Contribution not found");
    
    const contribution = contributionDoc.data() as Contribution;
    if (contribution.status === "rejected") throw new Error("Contribution is already rejected");

    const userRef = doc(db, 'users', contribution.userId);
    const userDoc = await transaction.get(userRef);
    
    if (contribution.status === "verified") {
      if (!userDoc.exists()) throw new Error("User not found");
      const userData = userDoc.data();
      
      const newTotalContributed = contribution.type === 'welfare'
        ? Math.max(0, (userData.totalContributed || 0) - contribution.amount)
        : (userData.totalContributed || 0);

      const newCampaignContributed = contribution.type === 'school_support'
        ? Math.max(0, (userData.totalCampaignContributed || 0) - contribution.amount)
        : (userData.totalCampaignContributed || 0);

      transaction.update(userRef, {
        totalContributed: newTotalContributed,
        totalCampaignContributed: newCampaignContributed,
        updatedAt: Date.now()
      });

      if (contribution.type === 'school_support' && contribution.campaignId) {
        const campaignRef = doc(db, 'schoolCampaigns', contribution.campaignId);
        const campaignDoc = await transaction.get(campaignRef);
        if (campaignDoc.exists()) {
          const campaignData = campaignDoc.data();
          const newRaisedAmount = Math.max(0, (campaignData.raisedAmount || 0) - contribution.amount);
          const updates: any = {
            raisedAmount: newRaisedAmount,
            updatedAt: Date.now()
          };
          // Re-evaluate campaign status if it dropped below target
          if (campaignData.targetAmount > 0 && newRaisedAmount < campaignData.targetAmount && campaignData.status === 'fully_funded') {
            updates.status = 'active';
          }
          transaction.update(campaignRef, updates);
        }
      }
    }

    transaction.update(contributionRef, {
      status: "rejected",
      verifiedBy: adminId,
      verifiedAt: Date.now(),
      note: reason
    });
  });

  await logActivity('REJECT_CONTRIBUTION', adminId, contributionId, `Rejected contribution: ${reason}`);
};

export const contributeToCampaign = async (userId: string, campaignId: string, amount: number, transactionReference: string) => {
  return await recordContribution(userId, amount, transactionReference, "school_support", campaignId);
};

// ==========================================
// WELFARE
// ==========================================

export const submitWelfareRequest = async (
  userId: string,
  data: {
    category: string;
    relationship: string;
    personName: string;
    district: string;
    villageTown: string;
    description: string;
    evidenceUrls: string[];
    amountRequested: number;
  }
) => {
  if (data.amountRequested <= 0) throw new Error("Amount must be greater than 0");

  const requestData: Omit<WelfareRequest, 'id'> = {
    userId,
    ...data,
    status: "pending",
    votes: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const docRef = await addDoc(collection(db, 'welfareRequests'), requestData);
  await logActivity('SUBMIT_WELFARE_REQUEST', userId, docRef.id, `Submitted welfare request for ${data.category}`);
  return docRef.id;
};

export const castWelfareVote = async (requestId: string, voterId: string, vote: "approve" | "reject") => {
  const settings = await getAppSettings();
  if (!settings?.welfareApprovers.includes(voterId)) {
    throw new Error("User is not an authorized welfare approver");
  }

  const requestRef = doc(db, 'welfareRequests', requestId);
  
  await runTransaction(db, async (transaction) => {
    const requestDoc = await transaction.get(requestRef);
    if (!requestDoc.exists()) throw new Error("Request not found");
    
    const requestData = requestDoc.data() as WelfareRequest;
    if (requestData.status !== "pending") throw new Error("Request is no longer pending");

    const newVotes = requestData.votes.filter(v => v.userId !== voterId);
    newVotes.push({
      userId: voterId,
      vote,
      votedAt: Date.now()
    });

    const updates: any = {
      votes: newVotes,
      updatedAt: Date.now()
    };

    if (settings && settings.welfareApprovers.length >= 3) {
      let approveCount = 0;
      let rejectCount = 0;

      newVotes.forEach(v => {
        if (settings.welfareApprovers.includes(v.userId)) {
          if (v.vote === 'approve') approveCount++;
          if (v.vote === 'reject') rejectCount++;
        }
      });

      if (approveCount >= 2) {
        updates.status = "accepted";
      } else if (rejectCount >= 2) {
        updates.status = "declined";
      }
    }

    transaction.update(requestRef, updates);
  });

  await logActivity('CAST_WELFARE_VOTE', voterId, requestId, `Voted ${vote} on request`);
};

export const finalizeWelfareDecision = async (requestId: string) => {
  const requestRef = doc(db, 'welfareRequests', requestId);
  const settings = await getAppSettings();
  if (!settings || settings.welfareApprovers.length < 3) return;

  await runTransaction(db, async (transaction) => {
    const requestDoc = await transaction.get(requestRef);
    if (!requestDoc.exists()) return;
    
    const requestData = requestDoc.data() as WelfareRequest;
    if (requestData.status !== "pending") return;

    // Count valid votes from designated approvers
    let approveCount = 0;
    let rejectCount = 0;

    requestData.votes.forEach(vote => {
      if (settings.welfareApprovers.includes(vote.userId)) {
        if (vote.vote === 'approve') approveCount++;
        if (vote.vote === 'reject') rejectCount++;
      }
    });

    if (approveCount >= 2) {
      transaction.update(requestRef, { status: "accepted", updatedAt: Date.now() });
    } else if (rejectCount >= 2) {
      transaction.update(requestRef, { status: "declined", updatedAt: Date.now() });
    }
  });
};

export const markWelfareAsPaid = async (requestId: string, amount: number, transactionReference: string, treasurerId: string, accountName: string, notes: string) => {
  const requestRef = doc(db, 'welfareRequests', requestId);
  
  await runTransaction(db, async (transaction) => {
    const requestDoc = await transaction.get(requestRef);
    if (!requestDoc.exists()) throw new Error("Request not found");
    
    const requestData = requestDoc.data() as WelfareRequest;
    if (requestData.status !== "accepted") throw new Error("Request must be accepted before payment");

    transaction.update(requestRef, {
      status: "paid",
      paidAmount: amount,
      paidTransactionReference: transactionReference,
      paymentAccountName: accountName,
      paymentNotes: notes,
      paidAt: Date.now(),
      finalDecisionBy: treasurerId,
      updatedAt: Date.now()
    });
  });

  await logActivity('PAY_WELFARE_REQUEST', treasurerId, requestId, `Paid UGX ${amount}`);
};

// ==========================================
// CAMPAIGNS & NOTICES
// ==========================================

export const createSchoolCampaign = async (
  createdBy: string,
  data: {
    title: string;
    description: string;
    targetAmount: number;
    imageUrls: string[];
  }
) => {
  if (data.targetAmount <= 0) throw new Error("Target amount must be greater than 0");

  const campaignData: Omit<SchoolCampaign, 'id'> = {
    ...data,
    raisedAmount: 0,
    status: "active",
    createdBy,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const docRef = await addDoc(collection(db, 'schoolCampaigns'), campaignData);
  await logActivity('CREATE_CAMPAIGN', createdBy, docRef.id, `Created campaign: ${data.title}`);
  return docRef.id;
};

export const postNotice = async (
  postedBy: string,
  data: {
    title: string;
    body: string;
    isPinned: boolean;
  }
) => {
  const noticeData: Omit<Notice, 'id'> = {
    ...data,
    postedBy,
    createdAt: Date.now()
  };

  const docRef = await addDoc(collection(db, 'notices'), noticeData);
  await logActivity('POST_NOTICE', postedBy, docRef.id, `Posted notice: ${data.title}`);
  return docRef.id;
};

// ==========================================
// REPORTS & DASHBOARD
// ==========================================

export const getMemberStatement = async (userId: string) => {
  // Get all contributions
  const contributionsQ = query(
    collection(db, 'contributions'), 
    where('userId', '==', userId)
  );
  
  // Get welfare requests
  const welfareQ = query(
    collection(db, 'welfareRequests'), 
    where('userId', '==', userId)
  );

  const [contributionsSnap, welfareSnap] = await Promise.all([
    getDocs(contributionsQ),
    getDocs(welfareQ)
  ]);

  const contributions = contributionsSnap.docs
    .map(d => ({ id: d.id, ...d.data() } as Contribution))
    .sort((a, b) => b.createdAt - a.createdAt);
    
  const welfareRequests = welfareSnap.docs
    .map(d => ({ id: d.id, ...d.data() } as WelfareRequest))
    .sort((a, b) => b.createdAt - a.createdAt);

  return {
    contributions,
    welfareRequests
  };
};

export const getDashboardStats = async (role: string) => {
  const stats = {
    totalMembers: 0,
    totalContributions: 0,
    activeCampaigns: 0,
    pendingWelfare: 0
  };

  // Only admins/treasurers might need the full scope of some stats, 
  // but we can compute basic aggregations here.
  // In a real production app with large collections, you'd use a cloud function 
  // to maintain these aggregations, but we'll do simple counts for now.
  
  if (['super_admin', 'chairperson', 'secretary', 'treasurer'].includes(role)) {
    const usersSnap = await getDocs(query(collection(db, 'users'), where('status', '==', 'approved')));
    stats.totalMembers = usersSnap.size;

    const welfareSnap = await getDocs(query(collection(db, 'welfareRequests'), where('status', '==', 'pending')));
    stats.pendingWelfare = welfareSnap.size;
  }

  const campaignsSnap = await getDocs(query(collection(db, 'schoolCampaigns'), where('status', '==', 'active')));
  stats.activeCampaigns = campaignsSnap.size;

  return stats;
};

export const updateCampaignStatus = async (campaignId: string, adminId: string, status: "active" | "fully_funded" | "closed", actionNotes?: string) => {
  const campaignRef = doc(db, 'schoolCampaigns', campaignId);
  const updates: any = { 
    status,
    updatedAt: Date.now()
  };
  
  if (actionNotes) {
    updates.actionNotes = actionNotes;
  }
  
  await updateDoc(campaignRef, updates);
  await logActivity('UPDATE_CAMPAIGN_STATUS', adminId, campaignId, `Updated campaign status to ${status}`);
};

export const transferCampaignExcessFunds = async (campaignId: string, adminId: string, note: string) => {
  const campaignRef = doc(db, 'schoolCampaigns', campaignId);
  
  await runTransaction(db, async (transaction) => {
    const campaignDoc = await transaction.get(campaignRef);
    if (!campaignDoc.exists()) throw new Error("Campaign not found");
    
    const campaignData = campaignDoc.data() as SchoolCampaign;
    if (campaignData.status === 'closed') throw new Error("Campaign is already closed");
    
    const excessAmount = Math.max(0, (campaignData.raisedAmount || 0) - campaignData.targetAmount);
    
    if (excessAmount <= 0) {
      // Just close it if there is no excess
      transaction.update(campaignRef, {
        status: "closed",
        actionNotes: note,
        updatedAt: Date.now()
      });
      return;
    }

    // Create a special contribution record to track the transferred funds
    const transferRef = doc(collection(db, 'contributions'));
    transaction.set(transferRef, {
      id: transferRef.id,
      userId: adminId, // The admin performing the transfer
      amount: excessAmount,
      currency: "UGX",
      type: "welfare",
      campaignId: null,
      transactionReference: `TRANSFER-${Date.now()}`,
      status: "verified",
      verifiedBy: adminId,
      verifiedAt: Date.now(),
      note: `Excess funds transferred from campaign: ${campaignData.title}. Note: ${note}`,
      createdAt: Date.now()
    });

    // Update campaign to show funds were transferred
    transaction.update(campaignRef, {
      status: "closed",
      actionNotes: `Transferred ${excessAmount} UGX excess to Welfare. Note: ${note}`,
      updatedAt: Date.now()
    });
  });

  await logActivity('TRANSFER_CAMPAIGN_EXCESS', adminId, campaignId, `Transferred excess funds to welfare pool`);
};

export const deleteSchoolCampaign = async (campaignId: string, adminId: string) => {
  const campaignRef = doc(db, 'schoolCampaigns', campaignId);
  await deleteDoc(campaignRef);
  await logActivity('DELETE_CAMPAIGN', adminId, campaignId, `Deleted campaign`);
};

