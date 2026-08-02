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
  orderBy,
  setDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { deleteImage } from './storage';
import { notifyAllApprovedMembers, notifyUser } from './fcmService';
import { 
  Contribution, 
  WelfareRequest, 
  SchoolCampaign, 
  Notice, 
  ActivityLog, 
  AppSettings,
  ContributionType,
  Expense,
  ExpenseCategory,
  ExpenseStatus
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
      landingBanners: data.banners || data.landingBanners || [],
      supportPhone: data.supportPhone || '+256 770 000000',
      supportWhatsApp: data.supportWhatsApp || '+256 700 000000',
      supportEmail: data.supportEmail || 'support@mamas.org'
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
    landingBanners: [],
    supportPhone: '+256 770 000000',
    supportWhatsApp: '+256 700 000000',
    supportEmail: 'support@mamas.org'
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

export const initiateMobileMoneyContribution = async (
  userId: string,
  amount: number,
  phoneNumber: string,
  network: string,
  type: ContributionType,
  campaignId: string | null = null,
) => {
  if (amount <= 0) throw new Error("Amount must be greater than 0");

  const reference = 'REF_' + Date.now() + Math.floor(Math.random() * 1000);
  
  const contributionData: Omit<Contribution, 'id'> = {
    userId,
    amount,
    currency: "UGX",
    type,
    campaignId,
    transactionReference: "MM-PENDING", // Keeps backward compatibility with manual UI fallback
    status: "pending",
    note: `Initiated via Mobile Money (${phoneNumber})`,
    createdAt: Date.now(),
    // Relworx fields
    relworxReference: reference,
    network,
    paymentMethod: "mobile_money",
    paymentStatus: "pending_payment"
  };

  const docRef = await addDoc(collection(db, 'contributions'), contributionData);
  await logActivity('INITIATE_MM_CONTRIBUTION', userId, docRef.id, `Initiated mobile money payment for UGX ${amount}`);
  
  // Call backend API
  const response = await fetch('/api/relworx/initiate-collection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount,
      phoneNumber,
      network,
      userId,
      metadata: {
        reference,
        contributionId: docRef.id,
        type,
        campaignId
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to initiate mobile money prompt.");
  }

  return docRef.id;
};

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
  let targetUserId = "";
  let contAmount = 0;
  let contType = "";

  await runTransaction(db, async (transaction) => {
    const contributionDoc = await transaction.get(contributionRef);
    if (!contributionDoc.exists()) throw new Error("Contribution not found");
    
    const contribution = contributionDoc.data() as Contribution;
    if (contribution.userId === adminId) throw new Error("Two-person rule: You cannot verify your own contribution.");
    if (contribution.status !== "pending") throw new Error("Contribution is not pending");

    targetUserId = contribution.userId;
    contAmount = contribution.amount;
    contType = contribution.type;

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

  if (targetUserId) {
    await notifyUser(targetUserId, {
      title: 'Contribution Verified',
      body: `Your ${contType === 'welfare' ? 'Welfare' : 'Campaign'} contribution of UGX ${contAmount.toLocaleString()} has been verified.`,
      type: 'contribution',
      targetId: contributionId,
      targetUrl: '/statement'
    }).catch(err => console.error("Notification error:", err));
  }
};

export const rejectContribution = async (contributionId: string, adminId: string, reason: string) => {
  const contributionRef = doc(db, 'contributions', contributionId);

  await runTransaction(db, async (transaction) => {
    const contributionDoc = await transaction.get(contributionRef);
    if (!contributionDoc.exists()) throw new Error("Contribution not found");
    
    const contribution = contributionDoc.data() as Contribution;
    if (contribution.userId === adminId) throw new Error("Two-person rule: You cannot verify your own contribution.");
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
    recipientPhoneNumber: string;
    recipientName?: string;
    recipientNetwork?: string;
  }
) => {
  if (data.amountRequested <= 0) throw new Error("Amount must be greater than 0");
  if (!data.recipientPhoneNumber || data.recipientPhoneNumber.trim() === "") {
    throw new Error("Recipient Mobile Money phone number is required");
  }

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
  if (!settings) throw new Error("Settings not found");

  const voterDoc = await getDoc(doc(db, 'users', voterId));
  const voterRole = voterDoc.exists() ? voterDoc.data().role : null;
  const isEscalatedApprover = voterRole === 'super_admin' || voterRole === 'chairperson' || voterRole === 'vice_chairperson' || voterRole === 'auditor';

  const requestRef = doc(db, 'welfareRequests', requestId);
  let applicantId = "";
  let welfareCategory = "";
  let resultingStatus: string | null = null;
  
  await runTransaction(db, async (transaction) => {
    const requestDoc = await transaction.get(requestRef);
    if (!requestDoc.exists()) throw new Error("Request not found");
    
    const requestData = requestDoc.data() as WelfareRequest;
    if (requestData.status !== "pending") throw new Error("Request is no longer pending");

    if (requestData.userId === voterId) {
      throw new Error("Conflict of Interest: You cannot vote on your own welfare request.");
    }

    applicantId = requestData.userId;
    welfareCategory = requestData.category;

    const eligibleApprovers = settings.welfareApprovers.filter(id => id !== applicantId);
    const amIEligible = eligibleApprovers.includes(voterId) || (eligibleApprovers.length < 2 && isEscalatedApprover);

    if (!amIEligible) {
      throw new Error("User is not an authorized welfare approver for this request");
    }

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

    let approveCount = 0;
    let rejectCount = 0;

    newVotes.forEach(v => {
      // Valid votes are from eligible approvers or escalated approvers if escalated
      if (eligibleApprovers.includes(v.userId) || (eligibleApprovers.length < 2 && ['super_admin', 'chairperson', 'vice_chairperson', 'auditor'].includes(voterRole || ''))) {
         if (v.vote === 'approve') approveCount++;
         if (v.vote === 'reject') rejectCount++;
      }
    });

    if (approveCount >= 2) {
      updates.status = "accepted";
      resultingStatus = "accepted";
    } else if (rejectCount >= 2) {
      updates.status = "declined";
      resultingStatus = "declined";
    }

    transaction.update(requestRef, updates);
  });

  await logActivity('CAST_WELFARE_VOTE', voterId, requestId, `Voted ${vote} on request`);

  if (resultingStatus && applicantId) {
    const statusText = resultingStatus === "accepted" ? "Accepted" : "Declined";
    await notifyUser(applicantId, {
      title: `Welfare Request ${statusText}`,
      body: `Your welfare request for ${welfareCategory} has been ${resultingStatus}.`,
      type: 'welfare',
      targetId: requestId,
      targetUrl: '/welfare'
    }).catch(err => console.error("Notification error:", err));
  }
};

export const finalizeWelfareDecision = async (requestId: string) => {
  const requestRef = doc(db, 'welfareRequests', requestId);
  const settings = await getAppSettings();
  if (!settings || settings.welfareApprovers.length < 3) return;

  let applicantId = "";
  let welfareCategory = "";
  let resultingStatus: string | null = null;

  await runTransaction(db, async (transaction) => {
    const requestDoc = await transaction.get(requestRef);
    if (!requestDoc.exists()) return;
    
    const requestData = requestDoc.data() as WelfareRequest;
    if (requestData.status !== "pending") return;

    applicantId = requestData.userId;
    welfareCategory = requestData.category;

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
      resultingStatus = "accepted";
    } else if (rejectCount >= 2) {
      transaction.update(requestRef, { status: "declined", updatedAt: Date.now() });
      resultingStatus = "declined";
    }
  });

  if (resultingStatus && applicantId) {
    const statusText = resultingStatus === "accepted" ? "Accepted" : "Declined";
    await notifyUser(applicantId, {
      title: `Welfare Request ${statusText}`,
      body: `Your welfare request for ${welfareCategory} has been ${resultingStatus}.`,
      type: 'welfare',
      targetId: requestId,
      targetUrl: '/welfare'
    }).catch(err => console.error("Notification error:", err));
  }
};

export const initiateWelfareDisbursement = async (
  requestId: string,
  treasurerId: string
) => {
  const requestRef = doc(db, 'welfareRequests', requestId);
  const requestDoc = await getDoc(requestRef);
  if (!requestDoc.exists()) throw new Error("Request not found");
  
  const requestData = requestDoc.data() as WelfareRequest;
  if (requestData.status !== "accepted") throw new Error("Request must be accepted before payment");
  if (requestData.userId === treasurerId) throw new Error("Conflict of Interest: You cannot issue a payout for your own welfare request.");
  if (!requestData.recipientPhoneNumber) throw new Error("No recipient phone number provided on this request.");

  const amount = requestData.amountRequested;
  const network = requestData.recipientNetwork || 'MTN'; // fallback
  
  // Set to processing
  await updateDoc(requestRef, {
    disbursementStatus: "processing",
    updatedAt: Date.now()
  });

  await logActivity('INITIATE_WELFARE_DISBURSEMENT', treasurerId, requestId, `Initiated mobile money disbursement of UGX ${amount}`);

  const response = await fetch('/api/relworx/initiate-disbursement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount,
      phoneNumber: requestData.recipientPhoneNumber,
      network,
      reference: requestId,
      metadata: {
        type: 'welfare',
        requestId
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    
    // Revert status on immediate failure
    await updateDoc(requestRef, {
      disbursementStatus: "failed",
      updatedAt: Date.now()
    });
    
    throw new Error(errorData.error || "Failed to initiate mobile money disbursement.");
  }
  
  return true;
};

export const markWelfareAsPaid = async (requestId: string, amount: number, transactionReference: string, treasurerId: string, accountName: string, notes: string) => {
  const requestRef = doc(db, 'welfareRequests', requestId);
  let applicantId = "";
  let welfareCategory = "";
  let beneficiaryName = "";

  await runTransaction(db, async (transaction) => {
    const requestDoc = await transaction.get(requestRef);
    if (!requestDoc.exists()) throw new Error("Request not found");
    
    const requestData = requestDoc.data() as WelfareRequest;
    if (requestData.status !== "accepted") throw new Error("Request must be accepted before payment");

    if (requestData.userId === treasurerId) {
      throw new Error("Conflict of Interest: You cannot issue a payout for your own welfare request.");
    }

    applicantId = requestData.userId;
    welfareCategory = requestData.category;
    beneficiaryName = requestData.personName || "Unknown Member";

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

    const moneyOutRef = doc(collection(db, 'moneyOut'));
    transaction.set(moneyOutRef, {
      id: moneyOutRef.id,
      type: "welfare",
      amount,
      reason: `Welfare Payout: ${welfareCategory}`,
      beneficiaryName,
      transactionReference,
      approvedBy: treasurerId,
      createdAt: Date.now()
    });
  });

  await logActivity('PAY_WELFARE_REQUEST', treasurerId, requestId, `Paid UGX ${amount}`);

  if (applicantId) {
    await notifyUser(applicantId, {
      title: 'Welfare Request Paid',
      body: `Your welfare request payout of UGX ${amount.toLocaleString()} for ${welfareCategory} has been paid.`,
      type: 'welfare',
      targetId: requestId,
      targetUrl: '/welfare'
    }).catch(err => console.error("Notification error:", err));
  }

  // Global notification for transparency
  await notifyUser("ALL_APPROVED", {
    title: 'Welfare Payout Disbursed',
    body: `UGX ${amount.toLocaleString()} was paid as welfare support to ${beneficiaryName} for ${welfareCategory}.`,
    type: 'welfare',
    targetUrl: '/money-out'
  }).catch(err => console.error("Notification error:", err));
};

// ==========================================
// EXPENSE
// ==========================================
export const recordExpense = async (amount: number, reason: string, transactionReference: string, recorderId: string, beneficiaryName?: string) => {
  const moneyOutRef = doc(collection(db, 'moneyOut'));
  await setDoc(moneyOutRef, {
    id: moneyOutRef.id,
    type: "expense",
    amount,
    reason,
    beneficiaryName: beneficiaryName || "General Expense",
    transactionReference,
    approvedBy: recorderId,
    createdAt: Date.now()
  });

  await logActivity('RECORD_EXPENSE', recorderId, moneyOutRef.id, `Recorded expense of UGX ${amount} for ${reason}`);

  await notifyUser("ALL_APPROVED", {
    title: 'Expense Recorded',
    body: `UGX ${amount.toLocaleString()} was spent on: ${reason}.`,
    type: 'welfare', // Reuse welfare type for financial transparency
    targetUrl: '/money-out'
  }).catch(err => console.error("Notification error:", err));
};

export const submitExpense = async (
  creatorId: string,
  data: {
    amount: number;
    reason: string;
    category: ExpenseCategory;
    campaignId?: string | null;
    recipientPhoneNumber: string;
    recipientName?: string;
    recipientNetwork?: string;
  }
) => {
  if (data.amount <= 0) throw new Error("Amount must be greater than 0");
  if (!data.reason) throw new Error("Reason / Description is required");
  if (!data.recipientPhoneNumber) throw new Error("Recipient Mobile Money Number is mandatory");

  const expenseData = {
    userId: creatorId,
    amount: data.amount,
    reason: data.reason,
    category: data.category || "Administrative",
    campaignId: data.campaignId || null,
    recipientPhoneNumber: data.recipientPhoneNumber,
    recipientName: data.recipientName || "N/A",
    recipientNetwork: data.recipientNetwork || "MTN",
    status: "pending" as ExpenseStatus,
    votes: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const docRef = await addDoc(collection(db, 'expenses'), expenseData);
  await logActivity('SUBMIT_EXPENSE', creatorId, docRef.id, `Submitted expense of UGX ${data.amount} for ${data.reason}`);

  await notifyUser("ALL_APPROVED", {
    title: 'New Expense Approval Needed',
    body: `An expense of UGX ${data.amount.toLocaleString()} for "${data.reason}" requires review.`,
    type: 'welfare',
    targetId: docRef.id,
    targetUrl: '/expenses'
  }).catch(err => console.error("Notification error:", err));

  return docRef.id;
};

export const voteOnExpense = async (expenseId: string, voterId: string, vote: 'approve' | 'reject') => {
  const expenseRef = doc(db, 'expenses', expenseId);
  const settings = await getAppSettings();
  if (!settings || !settings.welfareApprovers) throw new Error("App settings not found");

  const eligibleApprovers = settings.welfareApprovers;
  let creatorId = "";
  let expenseReason = "";
  let resultingStatus: string | null = null;

  await runTransaction(db, async (transaction) => {
    const expenseDoc = await transaction.get(expenseRef);
    if (!expenseDoc.exists()) throw new Error("Expense not found");

    const expenseData = expenseDoc.data() as Expense;
    if (expenseData.status !== "pending") throw new Error("Expense is no longer pending");

    creatorId = expenseData.userId;
    expenseReason = expenseData.reason;

    if (creatorId === voterId) {
      throw new Error("Conflict of Interest: You cannot vote on an expense you created.");
    }

    if (!eligibleApprovers.includes(voterId)) {
      throw new Error("Only designated Approvers can cast a vote on expenses.");
    }

    const existingVotes = expenseData.votes || [];
    const filteredVotes = existingVotes.filter(v => v.userId !== voterId);
    const newVotes = [...filteredVotes, { userId: voterId, vote, votedAt: Date.now() }];

    const updates: any = {
      votes: newVotes,
      updatedAt: Date.now()
    };

    let approveCount = 0;
    let rejectCount = 0;

    newVotes.forEach(v => {
      if (eligibleApprovers.includes(v.userId) && v.userId !== creatorId) {
        if (v.vote === 'approve') approveCount++;
        if (v.vote === 'reject') rejectCount++;
      }
    });

    if (approveCount >= 2) {
      updates.status = "approved";
      resultingStatus = "approved";
    } else if (rejectCount >= 2) {
      updates.status = "rejected";
      resultingStatus = "rejected";
    }

    transaction.update(expenseRef, updates);
  });

  await logActivity('VOTE_EXPENSE', voterId, expenseId, `Voted ${vote} on expense`);

  if (resultingStatus && creatorId) {
    const statusText = resultingStatus === "approved" ? "Approved" : "Rejected";
    await notifyUser(creatorId, {
      title: `Expense ${statusText}`,
      body: `Your expense request for "${expenseReason}" has been ${resultingStatus}.`,
      type: 'welfare',
      targetId: expenseId,
      targetUrl: '/expenses'
    }).catch(err => console.error("Notification error:", err));
  }
};

export const initiateExpenseDisbursement = async (
  expenseId: string,
  treasurerId: string
) => {
  const expenseRef = doc(db, 'expenses', expenseId);
  const expenseDoc = await getDoc(expenseRef);
  if (!expenseDoc.exists()) throw new Error("Expense not found");
  
  const expenseData = expenseDoc.data() as Expense;
  if (expenseData.status !== "approved") throw new Error("Expense must be approved before payment");
  if (expenseData.userId === treasurerId) throw new Error("Conflict of Interest: You cannot issue a payout for your own expense.");
  if (!expenseData.recipientPhoneNumber) throw new Error("No recipient phone number provided on this expense.");

  const amount = expenseData.amount;
  const network = expenseData.recipientNetwork || 'MTN'; // fallback
  
  // Set to processing
  await updateDoc(expenseRef, {
    disbursementStatus: "processing",
    updatedAt: Date.now()
  });

  await logActivity('INITIATE_EXPENSE_DISBURSEMENT', treasurerId, expenseId, `Initiated mobile money disbursement of UGX ${amount}`);

  const response = await fetch('/api/relworx/initiate-disbursement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount,
      phoneNumber: expenseData.recipientPhoneNumber,
      network,
      reference: expenseId,
      metadata: {
        type: 'expense',
        expenseId
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    
    // Revert status on immediate failure
    await updateDoc(expenseRef, {
      disbursementStatus: "failed",
      updatedAt: Date.now()
    });
    
    throw new Error(errorData.error || "Failed to initiate mobile money disbursement.");
  }
  
  return true;
};

export const payExpense = async (
  expenseId: string,
  treasurerId: string,
  transactionReference: string,
  accountName: string,
  notes: string
) => {
  const expenseRef = doc(db, 'expenses', expenseId);
  let creatorId = "";
  let expenseReason = "";
  let expenseAmount = 0;
  let beneficiaryName = "";
  let recipientPhone = "";

  await runTransaction(db, async (transaction) => {
    const expenseDoc = await transaction.get(expenseRef);
    if (!expenseDoc.exists()) throw new Error("Expense not found");

    const expenseData = expenseDoc.data() as Expense;
    if (expenseData.status !== "approved") throw new Error("Expense must be approved before payment");

    if (expenseData.userId === treasurerId) {
      throw new Error("Conflict of Interest: You cannot issue a payout for your own expense request.");
    }

    creatorId = expenseData.userId;
    expenseReason = expenseData.reason;
    expenseAmount = expenseData.amount;
    beneficiaryName = expenseData.recipientName || "Expense Beneficiary";
    recipientPhone = expenseData.recipientPhoneNumber;

    transaction.update(expenseRef, {
      status: "paid",
      paidTransactionReference: transactionReference,
      paymentAccountName: accountName,
      paymentNotes: notes,
      paidAt: Date.now(),
      finalDecisionBy: treasurerId,
      updatedAt: Date.now()
    });

    const moneyOutRef = doc(collection(db, 'moneyOut'));
    transaction.set(moneyOutRef, {
      id: moneyOutRef.id,
      type: "expense",
      amount: expenseAmount,
      reason: `Expense Payout: ${expenseReason}`,
      beneficiaryName,
      transactionReference,
      approvedBy: treasurerId,
      createdAt: Date.now()
    });
  });

  await logActivity('PAY_EXPENSE', treasurerId, expenseId, `Paid expense of UGX ${expenseAmount} to ${recipientPhone}`);

  if (creatorId) {
    await notifyUser(creatorId, {
      title: 'Expense Paid',
      body: `Your expense request for "${expenseReason}" (UGX ${expenseAmount.toLocaleString()}) has been paid.`,
      type: 'welfare',
      targetId: expenseId,
      targetUrl: '/expenses'
    }).catch(err => console.error("Notification error:", err));
  }

  await notifyUser("ALL_APPROVED", {
    title: 'Expense Disbursed',
    body: `UGX ${expenseAmount.toLocaleString()} was paid for expense: "${expenseReason}" (Beneficiary: ${beneficiaryName}).`,
    type: 'welfare',
    targetUrl: '/money-out'
  }).catch(err => console.error("Notification error:", err));
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

  await notifyAllApprovedMembers({
    title: `New School Support Campaign`,
    body: `${data.title} — Target: UGX ${data.targetAmount.toLocaleString()}`,
    type: 'campaign',
    targetId: docRef.id,
    targetUrl: '/campaigns'
  }).catch(err => console.error("Notification error:", err));

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

  await notifyAllApprovedMembers({
    title: `New Notice: ${data.title}`,
    body: data.body.length > 100 ? data.body.substring(0, 100) + '...' : data.body,
    type: 'notice',
    targetId: docRef.id,
    targetUrl: '/notices'
  }).catch(err => console.error("Notification error:", err));

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
  try {
    const docSnap = await getDoc(campaignRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const urlsToDelete: string[] = [];
      if (Array.isArray(data.imageUrls)) {
        urlsToDelete.push(...data.imageUrls);
      }
      if (typeof data.imageUrl === 'string' && data.imageUrl) {
        urlsToDelete.push(data.imageUrl);
      }

      for (const url of urlsToDelete) {
        if (typeof url === 'string' && (url.includes('firebasestorage.googleapis.com') || url.includes('campaigns/'))) {
          await deleteImage(url).catch(err => console.warn('Error deleting campaign image from storage:', err));
        }
      }
    }
  } catch (fetchErr) {
    console.warn('Could not inspect campaign image URLs prior to deletion:', fetchErr);
  }

  await deleteDoc(campaignRef);
  await logActivity('DELETE_CAMPAIGN', adminId, campaignId, `Deleted campaign`);
};

