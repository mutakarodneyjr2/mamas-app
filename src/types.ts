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
  nextOfKinName: string;
  nextOfKinPhone: string;
  role: UserRole;
  status: UserStatus;
  privacySettings: {
    showPhone: boolean;
    showEmail: boolean;
  };
  contributionStatus: ContributionStatus;
  createdAt: number;
  updatedAt: number;
  lastContributionDate?: number;
  totalContributed: number;
  totalCampaignContributed?: number;
}

export type ContributionType = "welfare" | "school_support";
export type ContributionTxStatus = "pending" | "verified" | "rejected";

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
}

export type WelfareRequestStatus = "pending" | "accepted" | "declined" | "paid";
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

export interface AppSettings {
  id: "main";
  welfareCategories: string[];
  allowedRelationships: string[];
  maxAmounts: Record<string, number>;
  welfareApprovers: string[];
  showTotalBalanceToMembers: boolean;
  showTopContributors: boolean;
  minimumWeeklyContribution: number;
  banners?: string[];
  landingBanners?: string[];
}
