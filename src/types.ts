export type UserRole = "super_admin" | "chairperson" | "vice_chairperson" | "treasurer" | "secretary" | "auditor" | "mobiliser" | "member";
export type UserStatus = "pending" | "approved" | "rejected" | "suspended";
export type ContributionStatus = "active" | "inactive";

export interface User {
  uid: string;
  phoneNumber: string;
  email: string;
  fullName: string;
  profilePictureUrl?: string;
  yearLeftSchool: string;
  district: string;
  placeOfResidence: string;
  occupation: string;
  otherOccupation?: string;
  university?: string;
  course?: string;
  nextOfKinName: string;
  nextOfKinPhone: string;
  role: UserRole;
  status: UserStatus;
  privacySettings: {
    showPhone: boolean;
    showEmail: boolean;
  };
  contributionStatus: ContributionStatus;
  hasCompletedOnboarding?: boolean;
  recoveryEmail?: string;
  recoveryEmailVerified?: boolean;
  authProvider?: string;
  createdAt: number | string;
  updatedAt: number | string;
  lastContributionDate?: number;
  totalContributed: number;
  totalCampaignContributed?: number;
  fcmTokens?: string[];
  themePreference?: 'light' | 'dark' | 'system';
  rejectionReason?: string;
  rejectedAt?: number;
  rejectedBy?: string;
}

export type NotificationType = "notice" | "welfare" | "campaign" | "contribution" | "approval";

export interface NotificationItem {
  id: string;
  userId: string; // target user ID or "ALL_APPROVED"
  title: string;
  body: string;
  type: NotificationType;
  targetId?: string;
  targetUrl: string;
  read: boolean;
  createdAt: number;
}

export type ContributionType = "welfare" | "school_support";
export type ContributionTxStatus = "pending" | "verified" | "rejected";
export type RelworxPaymentStatus = "pending_payment" | "processing" | "verified" | "failed" | "expired";

export interface Contribution {
  id: string;
  userId: string;
  amount: number;
  currency: "UGX";
  type: ContributionType;
  campaignId: string | null;
  transactionReference: string;
  status: ContributionTxStatus;
  verifiedBy?: string;
  verifiedAt?: number;
  note?: string;
  createdAt: number;
  // Relworx specific fields
  relworxTransactionId?: string;
  relworxReference?: string;
  network?: string;
  paymentMethod?: string;
  gatewayResponse?: any;
  paymentStatus?: RelworxPaymentStatus;
  paidAt?: number;
}

export type WelfareRequestStatus = "pending" | "accepted" | "declined" | "paid";
export type DisbursementStatus = "pending" | "processing" | "paid" | "failed";
export type VoteType = "approve" | "reject";

export interface WelfareVote {
  userId: string;
  vote: VoteType;
  votedAt: number;
}

export interface WelfareRequest {
  id: string;
  userId: string;
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
  recipientNetwork?: 'MTN' | 'Airtel' | string;
  status: WelfareRequestStatus;
  votes: WelfareVote[];
  finalDecisionBy?: string;
  paidAmount?: number;
  paidTransactionReference?: string;
  paymentAccountName?: string;
  paymentNotes?: string;
  paidAt?: number;
  createdAt: number;
  updatedAt: number;
  // Relworx specific fields
  relworxDisbursementId?: string;
  disbursementStatus?: DisbursementStatus;
  gatewayResponse?: any;
}

export type CampaignStatus = "active" | "completed" | "cancelled" | "fully_funded" | "closed";

export interface SchoolCampaign {
  id: string;
  title: string;
  description: string;
  targetAmount: number;
  raisedAmount: number;
  imageUrls: string[];
  status: CampaignStatus;
  actionNotes?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  postedBy: string;
  isPinned: boolean;
  createdAt: number;
}

export interface ActivityLog {
  id: string;
  action: string;
  performedBy: string;
  targetId: string;
  details: string;
  createdAt: number;
}

export interface Banner {
  id: string;
  url: string;
  isActive: boolean;
  order: number;
  createdAt: number;
}

export interface AppSettings {
  id: "main";
  welfareCategories: string[];
  allowedRelationships: string[];
  maxAmounts: Record<string, number>;
  welfareApprovers: string[];
  showTotalBalanceToMembers: boolean;
  showTopContributors: boolean;
  minimumWeeklyContribution: number;
  banners?: any[];
  landingBanners?: any[];
  supportPhone?: string;
  supportWhatsApp?: string;
  supportEmail?: string;
}

export interface HelpArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  order: number;
  isPublished: boolean;
  createdAt: number;
  updatedAt: number;
}

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type ExpenseStatus = "pending" | "approved" | "rejected" | "paid";
export type ExpenseCategory = "Campaign Expense" | "Administrative" | "Transport" | "Other";

export interface ExpenseVote {
  userId: string;
  vote: VoteType;
  votedAt: number;
}

export interface Expense {
  id: string;
  userId: string; // creator
  amount: number;
  reason: string;
  category: ExpenseCategory;
  campaignId?: string | null;
  recipientPhoneNumber: string;
  recipientName?: string;
  recipientNetwork?: 'MTN' | 'Airtel' | string;
  status: ExpenseStatus;
  votes: ExpenseVote[];
  finalDecisionBy?: string;
  paidTransactionReference?: string;
  paymentAccountName?: string;
  paymentNotes?: string;
  paidAt?: number;
  createdAt: number;
  updatedAt: number;
  // Relworx specific fields
  approvalStatus?: "pending" | "approved" | "rejected";
  disbursementStatus?: DisbursementStatus;
  relworxDisbursementId?: string;
  gatewayResponse?: any;
}

export interface MoneyOutRecord {
  id: string;
  type: "welfare" | "expense";
  amount: number;
  reason: string;
  beneficiaryName?: string;
  campaignId?: string;
  transactionReference?: string;
  approvedBy: string; // The ID of the user who recorded/approved it
  createdAt: number;
}

export type RelworxTransactionType = "collection" | "disbursement";
export type RelworxTransactionStatus = "pending" | "processing" | "successful" | "failed" | "expired";

export interface RelworxTransaction {
  id: string;
  type: RelworxTransactionType;
  relatedId: string;
  amount: number;
  network?: string;
  phoneNumber?: string;
  reference: string;
  internalReference: string;
  status: RelworxTransactionStatus;
  gatewayResponse?: any;
  createdAt: number;
  updatedAt: number;
}

export interface SupportTicket {
  id: string;
  userId?: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  subject: string;
  message: string;
  status: TicketStatus;
  adminNotes?: string;
  createdAt: number;
  updatedAt: number;
}

