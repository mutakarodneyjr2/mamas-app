import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  writeBatch 
} from "firebase/firestore";
import { db } from "../firebase";
import { HelpArticle, SupportTicket, TicketStatus } from "../types";

// Default seed articles for Matuumu SS Alumni (MAMAS)
const DEFAULT_HELP_ARTICLES: Omit<HelpArticle, "id" | "createdAt" | "updatedAt">[] = [
  {
    title: "Who is eligible to join MAMAS?",
    category: "Membership & Registration",
    content: "MAMAS is strictly for Old Boys and Old Girls (OBs & OGs) who studied at Matuumu Secondary School, Kamuli. During registration, you must provide your year of completion, house/class details, and current contact information for executive verification.",
    order: 1,
    isPublished: true
  },
  {
    title: "How does the registration approval process work?",
    category: "Membership & Registration",
    content: "After submitting your registration form, your profile is routed to the Executive Committee for verification. Once an executive member confirms your alumni status, your account will be approved and you will receive a push notification / SMS letting you log in and access all features.",
    order: 2,
    isPublished: true
  },
  {
    title: "What are the weekly contribution requirements?",
    category: "Contributions & Statement",
    content: "All approved members are required to make a minimum weekly welfare contribution (default UGX 5,000). You can pay via Mobile Money (MTN / Airtel) or Bank to the official association account and log the transaction reference on your dashboard.",
    order: 3,
    isPublished: true
  },
  {
    title: "How do I log a manual contribution?",
    category: "Contributions & Statement",
    content: "Navigate to your Dashboard or Statement screen, click 'Log Contribution', select the contribution type (Welfare or School Support Campaign), enter the amount paid and your transaction ID/reference code. The Treasurer will verify and approve your record.",
    order: 4,
    isPublished: true
  },
  {
    title: "How do I apply for Welfare Support?",
    category: "Welfare Assistance",
    content: "Go to the Welfare section and click 'Apply for Welfare'. Choose the applicable category (e.g., Medical Emergency, Bereavement, Marriage, Education Support), select the relationship, state the details, and upload evidence (e.g. medical bill or certificate).",
    order: 5,
    isPublished: true
  },
  {
    title: "How are welfare requests voted on and disbursed?",
    category: "Welfare Assistance",
    content: "Every welfare request is reviewed by the 3 designated Welfare Approvers on the committee. When at least 2 approvers vote 'Approve', the request status changes to Accepted and the Treasurer is authorized to disburse funds to your registered account.",
    order: 6,
    isPublished: true
  },
  {
    title: "What are School Support Campaigns?",
    category: "School Campaigns",
    content: "School Campaigns are targeted fundraising efforts initiated by the association to support infrastructure, academic excellence, or student welfare at Matuumu Secondary School in Kamuli. All members are encouraged to contribute toward campaign targets.",
    order: 7,
    isPublished: true
  },
  {
    title: "How do I recover my account if I lose my phone number?",
    category: "Account & Security",
    content: "On the Login screen, click 'Lost your phone? Recover account'. Enter your registered email address to receive a secure 6-digit recovery code. Verify the code, enter your new phone number, and verify it via SMS OTP to migrate your account safely.",
    order: 8,
    isPublished: true
  }
];

/**
 * Fetch all published help articles, automatically seeding default articles if collection is empty
 */
export const getHelpArticles = async (): Promise<HelpArticle[]> => {
  try {
    const q = query(
      collection(db, "helpArticles"),
      where("isPublished", "==", true)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      console.log("No help articles found. Seeding default MAMAS articles...");
      const batch = writeBatch(db);
      const now = Date.now();
      
      const seededArticles: HelpArticle[] = [];

      for (const item of DEFAULT_HELP_ARTICLES) {
        const docRef = doc(collection(db, "helpArticles"));
        const newArt: HelpArticle = {
          ...item,
          id: docRef.id,
          createdAt: now,
          updatedAt: now
        };
        batch.set(docRef, newArt);
        seededArticles.push(newArt);
      }

      await batch.commit();
      return seededArticles.sort((a, b) => a.order - b.order);
    }

    const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpArticle));
    return list.sort((a, b) => a.order - b.order);
  } catch (err) {
    console.error("Error fetching help articles:", err);
    throw err;
  }
};

/**
 * Fetch all articles (published & drafts) for Admin management
 */
export const getAllHelpArticlesAdmin = async (): Promise<HelpArticle[]> => {
  try {
    const snap = await getDocs(collection(db, "helpArticles"));
    const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpArticle));
    return list.sort((a, b) => a.order - b.order);
  } catch (err) {
    console.error("Error fetching all help articles for admin:", err);
    throw err;
  }
};

/**
 * Fetch a single help article by ID
 */
export const getHelpArticleById = async (id: string): Promise<HelpArticle | null> => {
  try {
    const docRef = doc(db, "helpArticles", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as HelpArticle;
  } catch (err) {
    console.error("Error fetching help article by ID:", err);
    return null;
  }
};

/**
 * Create a new help article
 */
export const createHelpArticle = async (
  data: Omit<HelpArticle, "id" | "createdAt" | "updatedAt">
): Promise<string> => {
  try {
    const now = Date.now();
    const docRef = await addDoc(collection(db, "helpArticles"), {
      ...data,
      createdAt: now,
      updatedAt: now
    });
    return docRef.id;
  } catch (err) {
    console.error("Error creating help article:", err);
    throw err;
  }
};

/**
 * Update an existing help article
 */
export const updateHelpArticle = async (
  id: string,
  data: Partial<Omit<HelpArticle, "id" | "createdAt">>
): Promise<void> => {
  try {
    const docRef = doc(db, "helpArticles", id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Date.now()
    });
  } catch (err) {
    console.error("Error updating help article:", err);
    throw err;
  }
};

/**
 * Delete a help article
 */
export const deleteHelpArticle = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, "helpArticles", id));
  } catch (err) {
    console.error("Error deleting help article:", err);
    throw err;
  }
};

/**
 * Submit a support message / ticket to executives
 */
export const submitSupportMessage = async (data: {
  userId?: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  subject: string;
  message: string;
}): Promise<string> => {
  try {
    const now = Date.now();
    const ticketData: Omit<SupportTicket, "id"> = {
      userId: data.userId || "anonymous",
      userName: data.userName,
      userEmail: data.userEmail || "",
      userPhone: data.userPhone || "",
      subject: data.subject,
      message: data.message,
      status: "open",
      createdAt: now,
      updatedAt: now
    };

    const docRef = await addDoc(collection(db, "supportTickets"), ticketData);
    return docRef.id;
  } catch (err) {
    console.error("Error submitting support message:", err);
    throw err;
  }
};

/**
 * Fetch all support tickets for Admin review
 */
export const getSupportTickets = async (): Promise<SupportTicket[]> => {
  try {
    const snap = await getDocs(collection(db, "supportTickets"));
    const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportTicket));
    return list.sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.error("Error fetching support tickets:", err);
    throw err;
  }
};

/**
 * Update support ticket status / add admin notes
 */
export const updateSupportTicket = async (
  ticketId: string,
  status: TicketStatus,
  adminNotes?: string
): Promise<void> => {
  try {
    const docRef = doc(db, "supportTickets", ticketId);
    await updateDoc(docRef, {
      status,
      ...(adminNotes !== undefined ? { adminNotes } : {}),
      updatedAt: Date.now()
    });
  } catch (err) {
    console.error("Error updating support ticket:", err);
    throw err;
  }
};
