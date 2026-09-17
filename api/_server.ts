/**
 * REQUIRED ENVIRONMENT VARIABLES:
 * - RELWORX_API_KEY
 * - RELWORX_MERCHANT_ID
 * - RELWORX_WEBHOOK_SECRET (optional)
 * - FIREBASE_SERVICE_ACCOUNT_BASE64
 */

import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

let firebaseInitError: Error | null = null;

function ensureFirebaseInit() {
  if (getApps().length) return;
  const rawEnv = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawEnv) {
    firebaseInitError = new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is missing on Vercel');
    console.error('Firebase Admin init failed:', firebaseInitError.message);
    throw firebaseInitError;
  }
  try {
    let serviceAccountJson = rawEnv.trim();
    if (!serviceAccountJson.startsWith('{')) {
      serviceAccountJson = Buffer.from(serviceAccountJson, 'base64').toString('utf8');
    }
    const serviceAccount = JSON.parse(serviceAccountJson);
    initializeApp({ credential: cert(serviceAccount) });
    console.log(`Firebase Admin initialized successfully for: ${serviceAccount.client_email}`);
  } catch (error: any) {
    firebaseInitError = new Error(`Failed to initialize Firebase Admin: ${error.message}`);
    console.error('Firebase Admin init error:', error);
    throw firebaseInitError;
  }
}

const getDb = () => getFirestore();

// ========== RATE LIMITER (AUD-012) ==========

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

class InMemoryRateLimiter {
  private store = new Map<string, RateLimitRecord>();
  private windowMs: number;
  private maxRequests: number;
  private message: string;

  constructor(options: { windowMs: number; maxRequests: number; message?: string }) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
    this.message = options.message || "Too many requests. Please wait and try again.";

    const interval = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.store.entries()) {
        if (now > record.resetTime) {
          this.store.delete(key);
        }
      }
    }, 60000);
    if (interval && typeof (interval as any).unref === 'function') {
      (interval as any).unref();
    }
  }

  public check(key: string): { allowed: boolean; remaining: number; resetTime: number; retryAfterSec: number } {
    const now = Date.now();
    let record = this.store.get(key);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      this.store.set(key, record);
      return { allowed: true, remaining: this.maxRequests - 1, resetTime: record.resetTime, retryAfterSec: Math.ceil(this.windowMs / 1000) };
    }

    if (record.count >= this.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
      return { allowed: false, remaining: 0, resetTime: record.resetTime, retryAfterSec };
    }

    record.count += 1;
    const retryAfterSec = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
    return { allowed: true, remaining: this.maxRequests - record.count, resetTime: record.resetTime, retryAfterSec };
  }
}

function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.socket.remoteAddress || req.ip || '127.0.0.1';
}

// 20 requests per 15 minutes per IP / UID for initiate collection
const collectionRateLimiter = new InMemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
  message: "Too many requests. Please wait and try again."
});

// 10 requests per 15 minutes per UID / IP for initiate disbursement
const disbursementRateLimiter = new InMemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: "Too many requests. Please wait and try again."
});

// 150 requests per 1 minute window per IP for webhooks
const webhookRateLimiter = new InMemoryRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 150,
  message: "Too many requests. Please wait and try again."
});

// 30 requests per 15 minutes per IP / UID for reconciliation
const reconcileRateLimiter = new InMemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
  message: "Too many requests. Please wait and try again."
});

// ========== INLINE RELWORX FUNCTIONS (NO EXTERNAL IMPORTS) ==========

export function verifyWebhookSignature(signatureHeader: string, payload: string, secretKey: string): boolean {
  if (!signatureHeader || !secretKey) return false;
  try {
    let signatureToVerify = signatureHeader.trim();
    if (signatureHeader.includes('v=')) {
      const parts = signatureHeader.split(',');
      const vPart = parts.find(p => p.trim().startsWith('v='));
      if (vPart) {
        signatureToVerify = vPart.trim().substring(2);
      }
    }

    const expectedSignature = crypto.createHmac('sha256', secretKey).update(payload || '').digest('hex');
    const sigBuf = Buffer.from(signatureToVerify.toLowerCase());
    const expectedBuf = Buffer.from(expectedSignature.toLowerCase());
    if (sigBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

export async function initiateCollection(
  amount: number, phoneNumber: string, network: string, userId: string, metadata: any = {}
) {
  const apiKey = process.env.RELWORX_API_KEY;
  const merchantId = process.env.RELWORX_MERCHANT_ID;
  const url = process.env.RELWORX_COLLECTION_URL || 'https://api.relworx.com/v1/collections';
  if (!apiKey || !merchantId) {
    throw new Error('Server configuration error: RELWORX_API_KEY or RELWORX_MERCHANT_ID is missing.');
  }
  const reference = metadata?.reference || `REF_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const payload = { amount, phone_number: phoneNumber, network, reference, merchant_id: merchantId, user_id: userId, ...metadata };
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Relworx API error: HTTP ${response.status}`);
  }
  return { reference, relworxReference: reference, ...data };
}

export async function initiateDisbursement(
  amount: number, phoneNumber: string, network: string, reference: string, metadata: any = {}
) {
  const apiKey = process.env.RELWORX_API_KEY;
  const merchantId = process.env.RELWORX_MERCHANT_ID;
  const url = process.env.RELWORX_DISBURSEMENT_URL || 'https://api.relworx.com/v1/disbursements';
  if (!apiKey || !merchantId) {
    throw new Error('Server configuration error: RELWORX_API_KEY or RELWORX_MERCHANT_ID is missing.');
  }
  const payload = { amount, phone_number: phoneNumber, network, reference, merchant_id: merchantId, ...metadata };
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Relworx API error: HTTP ${response.status}`);
  }
  return data;
}

export async function handleCollectionWebhook(payload: any) {
  console.log(`[Relworx Webhook] Processing collection payload:`, payload);
  const status = payload.status;
  const reference = payload.reference;
  const transactionId = payload.transactionId || payload.transaction_id || payload.relworxTransactionId;
  const amount = payload.amount;

  // Strict routing guard: NEVER treat disbursements as collections (AUD-004)
  if (
    payload.transaction_type === 'disbursement' ||
    payload.type === 'disbursement' ||
    (typeof reference === 'string' && (reference.startsWith('DISB_') || reference.startsWith('DISB')))
  ) {
    console.warn(`[Relworx Webhook] Collection handler received disbursement reference ${reference}. Skipping collection processing.`);
    return { success: true, skipped: true };
  }

  const txDocId = transactionId || `tx_${reference || Date.now()}`;
  const txRef = getDb().collection('transactions').doc(txDocId);
  const existingTx = await txRef.get();
  if (existingTx.exists && existingTx.data()?.status === 'successful' && status === 'successful') {
    console.log(`[Relworx Webhook] Transaction ${txDocId} already processed. Skipping duplicate.`);
    return { success: true, skipped: true };
  }
  await txRef.set({
    id: txRef.id, type: 'collection', relatedId: reference, amount: amount || 0,
    reference: reference || '', internalReference: payload.internalReference || payload.internal_reference || '',
    status: status || 'unknown', gatewayResponse: payload, updatedAt: Date.now(), createdAt: Date.now()
  }, { merge: true });

  if (reference) {
    const contributionsRef = getDb().collection('contributions');
    let snapshot = await contributionsRef.where('relworxReference', '==', reference).limit(1).get();
    if (snapshot.empty) {
      const directDoc = await contributionsRef.doc(reference).get();
      if (directDoc.exists) snapshot = { empty: false, docs: [directDoc] } as any;
    }
    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      const docRef = docSnap.ref;
      try {
        await getDb().runTransaction(async (transaction) => {
          // 1. ALL READS FIRST
          const contribDoc = await transaction.get(docRef);
          if (!contribDoc.exists) return;
          const contribData = contribDoc.data();
          if (!contribData) return;
          if (contribData.status === 'verified' && status === 'successful') return;
          if (contribData.relworxTransactionId === transactionId && transactionId) return;

          let userRef: any = null;
          let userDoc: any = null;
          if (status === 'successful' && contribData.userId) {
            userRef = getDb().collection('users').doc(contribData.userId);
            userDoc = await transaction.get(userRef);
          }

          const campaignId = contribData.campaignId;
          const isCampaignType = contribData.type === 'school_support' || contribData.type === 'campaign' || contribData.purpose === 'campaign';
          let campaignRef: any = null;
          let campaignDoc: any = null;
          if (status === 'successful' && isCampaignType && campaignId) {
            campaignRef = getDb().collection('schoolCampaigns').doc(campaignId);
            campaignDoc = await transaction.get(campaignRef);
          }

          // Solidarity support for a published welfare case (AUD-014)
          const welfareReqId = contribData.welfareRequestId || (contribData.type === 'welfare_support' ? contribData.campaignId : null);
          const isWelfareSupportType = contribData.type === 'welfare_support' || contribData.purpose === 'welfare_support';
          let welfareRef: any = null;
          let pubFeedRef: any = null;
          let welfareDoc: any = null;
          let pubFeedDoc: any = null;
          if (status === 'successful' && isWelfareSupportType && welfareReqId) {
            welfareRef = getDb().collection('welfareRequests').doc(welfareReqId);
            pubFeedRef = getDb().collection('publishedWelfareFeed').doc(welfareReqId);
            welfareDoc = await transaction.get(welfareRef);
            pubFeedDoc = await transaction.get(pubFeedRef);
          }

          // 2. ALL WRITES AFTER READS
          const updateData: any = {
            paymentStatus: status === 'successful' ? 'verified' : status === 'failed' ? 'failed' : 'pending_payment',
            gatewayResponse: payload, relworxTransactionId: transactionId || null, updatedAt: Date.now()
          };
          
          if (amount !== undefined && amount !== null) {
            updateData.amount = Number(amount);
          }

          if (status === 'successful') {
            updateData.paidAt = Date.now(); updateData.status = 'verified';
            updateData.verifiedBy = 'RELWORX_WEBHOOK'; updateData.verifiedAt = Date.now();
            
            const confirmedAmount = Number(amount || contribData.amount || 0);

            if (userDoc && userDoc.exists) {
              const userData = userDoc.data();
              if (userData) {
                const isWelfare = contribData.purpose === 'welfare' || contribData.type === 'welfare';
                const isCampaign = contribData.purpose === 'campaign' || contribData.type === 'school_support' || contribData.type === 'campaign';
                const isWelfareSupport = contribData.purpose === 'welfare_support' || contribData.type === 'welfare_support';
                
                const newTotalContributed = (isWelfare || isWelfareSupport || !isCampaign)
                  ? (userData.totalContributed || 0) + confirmedAmount
                  : (userData.totalContributed || 0);
                const newCampaignContributed = isCampaign
                  ? (userData.totalCampaignContributed || 0) + confirmedAmount
                  : (userData.totalCampaignContributed || 0);
                transaction.update(userRef, {
                  totalContributed: newTotalContributed, totalCampaignContributed: newCampaignContributed,
                  lastContributionDate: Date.now(), contributionStatus: "active", updatedAt: Date.now()
                });
              }
            }

            if (campaignDoc && campaignDoc.exists) {
              const campaignData = campaignDoc.data();
              if (campaignData) {
                const newRaisedAmount = (campaignData.raisedAmount || 0) + confirmedAmount;
                const campUpdates: any = { raisedAmount: newRaisedAmount, updatedAt: Date.now() };
                if (campaignData.targetAmount > 0 && newRaisedAmount >= campaignData.targetAmount && campaignData.status === 'active') {
                  campUpdates.status = 'fully_funded';
                }
                transaction.update(campaignRef, campUpdates);
              }
            }

            if (welfareDoc && welfareDoc.exists) {
              const welfareData = welfareDoc.data();
              if (welfareData) {
                const newSupportRaised = (welfareData.supportRaisedAmount || 0) + confirmedAmount;
                const newSupportCount = (welfareData.supportContributorCount || 0) + 1;
                
                // Write to welfareRequests
                transaction.update(welfareRef, {
                  supportRaisedAmount: newSupportRaised,
                  supportContributorCount: newSupportCount,
                  updatedAt: Date.now()
                });

                // Atomic dual-write to publishedWelfareFeed ONLY if published / exists (AUD-014)
                if (pubFeedDoc && pubFeedDoc.exists) {
                  transaction.update(pubFeedRef, {
                    supportRaisedAmount: newSupportRaised,
                    supportContributorCount: newSupportCount,
                    updatedAt: Date.now()
                  });
                }
              }
            }
          } else if (status === 'failed') {
            updateData.status = 'failed';
          }
          transaction.update(docRef, updateData);
        });
        await getDb().collection('activityLogs').add({
          action: 'RELWORX_COLLECTION', adminId: 'SYSTEM', targetId: docSnap.id,
          details: `Relworx collection webhook received. Status: ${status}`, createdAt: Date.now()
        });
        if (status === 'successful') {
          const contribData = docSnap.data();
          if (contribData?.userId) {
            const isSolidarity = contribData.type === 'welfare_support' || contribData.purpose === 'welfare_support';
            const notifTitle = isSolidarity ? "Solidarity Support Received" : "Payment Received";
            const notifBody = isSolidarity
              ? `Your solidarity support of UGX ${new Intl.NumberFormat('en-UG').format(contribData.amount || 0)} was received. Thank you for standing with your fellow alumni!`
              : `Your mobile money payment of UGX ${new Intl.NumberFormat('en-UG').format(contribData.amount || 0)} was successful. Thank you!`;

            await getDb().collection('notifications').add({
              userId: contribData.userId, title: notifTitle,
              body: notifBody,
              type: "system", targetUrl: "/statement", read: false, createdAt: Date.now()
            });
          }
        }
      } catch (err) {
        console.error("Transaction failed for Relworx collection:", err);
      }
    } else {
      console.warn(`[Relworx Webhook] No matching contribution document found for reference: ${reference}`);
    }
  }
  return { success: true };
}

export async function handleDisbursementWebhook(payload: any) {
  console.log(`[Relworx Webhook] Handling disbursement webhook:`, payload);
  const status = payload.status;
  const reference = payload.reference;
  const disbursementId = payload.disbursementId || payload.disbursement_id || payload.relworxDisbursementId;
  const amount = payload.amount;
  const txRef = getDb().collection('transactions').doc(disbursementId || `disb_${reference || Date.now()}`);
  await txRef.set({
    id: txRef.id, type: 'disbursement', relatedId: reference, amount: amount || 0,
    reference: reference || '', internalReference: payload.internalReference || payload.internal_reference || '',
    status: status || 'unknown', gatewayResponse: payload, updatedAt: Date.now(), createdAt: Date.now()
  }, { merge: true });

  if (!reference) {
    console.warn('[Relworx Webhook] Disbursement webhook received without reference.');
    return { success: true };
  }

  // Determine target collection and docId from reference (AUD-004)
  let targetType: 'expense' | 'welfare' | null = null;
  let targetDocId = reference;

  if (reference.startsWith('DISB_EXPENSE_')) {
    targetType = 'expense';
    targetDocId = reference.replace('DISB_EXPENSE_', '');
  } else if (reference.startsWith('DISB_WELFARE_')) {
    targetType = 'welfare';
    targetDocId = reference.replace('DISB_WELFARE_', '');
  }

  const firestore = getDb();
  let expenseRef: FirebaseFirestore.DocumentReference | null = null;
  let welfareRef: FirebaseFirestore.DocumentReference | null = null;
  let targetDocSnap: FirebaseFirestore.DocumentSnapshot | null = null;

  if (targetType === 'expense') {
    const expDoc = await firestore.collection('expenses').doc(targetDocId).get();
    if (expDoc.exists) {
      expenseRef = expDoc.ref;
      targetDocSnap = expDoc;
    }
  } else if (targetType === 'welfare') {
    const welDoc = await firestore.collection('welfareRequests').doc(targetDocId).get();
    if (welDoc.exists) {
      welfareRef = welDoc.ref;
      targetDocSnap = welDoc;
    }
  }

  // Fallback lookup if not determined by prefix: Check by direct docId or relworxReference query
  if (!targetDocSnap) {
    const expDoc = await firestore.collection('expenses').doc(targetDocId).get();
    if (expDoc.exists) {
      targetType = 'expense';
      expenseRef = expDoc.ref;
      targetDocSnap = expDoc;
    } else {
      const welDoc = await firestore.collection('welfareRequests').doc(targetDocId).get();
      if (welDoc.exists) {
        targetType = 'welfare';
        welfareRef = welDoc.ref;
        targetDocSnap = welDoc;
      } else {
        const expQ = await firestore.collection('expenses').where('relworxReference', '==', reference).limit(1).get();
        if (!expQ.empty) {
          targetType = 'expense';
          expenseRef = expQ.docs[0].ref;
          targetDocSnap = expQ.docs[0];
          targetDocId = expQ.docs[0].id;
        } else {
          const welQ = await firestore.collection('welfareRequests').where('relworxReference', '==', reference).limit(1).get();
          if (!welQ.empty) {
            targetType = 'welfare';
            welfareRef = welQ.docs[0].ref;
            targetDocSnap = welQ.docs[0];
            targetDocId = welQ.docs[0].id;
          }
        }
      }
    }
  }

  if (!targetDocSnap || !targetType) {
    console.warn(`[Relworx Webhook] No matching disbursement document found for reference: ${reference}`);
    return { success: true };
  }

  const docData = targetDocSnap.data();
  const alreadyPaid = docData?.status === 'paid' || docData?.disbursementStatus === 'paid' || docData?.disbursementStatus === 'successful';

  // Deterministic moneyOut document ID (AUD-005): moneyOut/disb_{cleanReference}
  const cleanKey = (reference || disbursementId || targetDocId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const moneyOutId = `disb_${cleanKey}`;
  const moneyOutRef = firestore.collection('moneyOut').doc(moneyOutId);

  if (targetType === 'expense' && expenseRef) {
    if (alreadyPaid) {
      console.log(`[Relworx] Expense ${targetDocId} already paid. Skipping duplicate.`);
      return { success: true, skipped: true };
    }
    const updateData: any = {
      disbursementStatus: status === 'successful' ? 'paid' : status === 'failed' ? 'failed' : 'processing',
      gatewayResponse: payload,
      relworxDisbursementId: disbursementId || docData?.relworxDisbursementId || null,
      updatedAt: Date.now()
    };
    if (status === 'successful') {
      updateData.paidAt = Date.now();
      updateData.status = 'paid';

      // Ensure idempotent moneyOut creation: only insert and notify if not already recorded (AUD-005)
      const existingMoneyOut = await moneyOutRef.get();
      if (!existingMoneyOut.exists) {
        await moneyOutRef.set({
          id: moneyOutId,
          type: "expense",
          amount: Number(amount || docData?.amount || 0),
          reason: docData?.reason || 'Expense Payout',
          beneficiaryName: docData?.recipientName || 'General Expense',
          transactionReference: reference,
          disbursementId: disbursementId || null,
          approvedBy: 'SYSTEM_RELWORX',
          createdAt: Date.now()
        }, { merge: true });

        await firestore.collection('notifications').add({
          userId: 'ALL_APPROVED',
          title: "Association Expense Paid",
          body: `An expense for ${docData?.reason || 'Expense'} (UGX ${new Intl.NumberFormat('en-UG').format(docData?.amount || 0)}) was paid.`,
          type: "system",
          targetUrl: "/money-out",
          read: false,
          createdAt: Date.now()
        });
      } else {
        console.log(`[Relworx] moneyOut entry ${moneyOutId} already exists. Skipping duplicate ledger insertion.`);
      }
    }
    await expenseRef.update(updateData);
    await firestore.collection('activityLogs').add({
      action: 'RELWORX_DISBURSEMENT_EXPENSE',
      adminId: 'SYSTEM',
      targetId: targetDocId,
      details: `Relworx disbursement webhook received. Reference: ${reference}, Status: ${status}`,
      createdAt: Date.now()
    });
    return { success: true };
  }

  if (targetType === 'welfare' && welfareRef) {
    if (alreadyPaid) {
      console.log(`[Relworx] Welfare request ${targetDocId} already paid. Skipping duplicate.`);
      return { success: true, skipped: true };
    }
    const updateData: any = {
      disbursementStatus: status === 'successful' ? 'paid' : status === 'failed' ? 'failed' : 'processing',
      gatewayResponse: payload,
      relworxDisbursementId: disbursementId || docData?.relworxDisbursementId || null,
      updatedAt: Date.now()
    };
    if (status === 'successful') {
      updateData.paidAt = Date.now();
      updateData.status = 'paid';

      // Ensure idempotent moneyOut creation: only insert and notify if not already recorded (AUD-005)
      const existingMoneyOut = await moneyOutRef.get();
      if (!existingMoneyOut.exists) {
        await moneyOutRef.set({
          id: moneyOutId,
          type: "welfare",
          amount: Number(amount || docData?.amountRequested || 0),
          reason: `Welfare Payout: ${docData?.category || ''}`,
          beneficiaryName: docData?.personName || docData?.recipientName || 'Unknown Member',
          transactionReference: reference,
          disbursementId: disbursementId || null,
          approvedBy: 'SYSTEM_RELWORX',
          createdAt: Date.now()
        }, { merge: true });

        await firestore.collection('notifications').add({
          userId: 'ALL_APPROVED',
          title: "Welfare Payout Disbursed",
          body: `A welfare payout of UGX ${new Intl.NumberFormat('en-UG').format(docData?.amountRequested || 0)} for ${docData?.personName || 'Member'} was completed.`,
          type: "system",
          targetUrl: "/welfare",
          read: false,
          createdAt: Date.now()
        });

        if (docData?.userId) {
          await firestore.collection('notifications').add({
            userId: docData.userId,
            title: "Your Welfare Request Paid",
            body: `Your welfare request payout of UGX ${new Intl.NumberFormat('en-UG').format(docData?.amountRequested || 0)} was successfully processed.`,
            type: "welfare_update",
            targetUrl: "/apply-welfare",
            read: false,
            createdAt: Date.now()
          });
        }
      } else {
        console.log(`[Relworx] moneyOut entry ${moneyOutId} already exists. Skipping duplicate ledger insertion.`);
      }
    }
    await welfareRef.update(updateData);
    await firestore.collection('activityLogs').add({
      action: 'RELWORX_DISBURSEMENT_WELFARE',
      adminId: 'SYSTEM',
      targetId: targetDocId,
      details: `Relworx disbursement webhook received. Reference: ${reference}, Status: ${status}`,
      createdAt: Date.now()
    });
    return { success: true };
  }

  return { success: true };
}

// ========== EXPRESS APP ==========

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf; } }));
app.use(express.raw({ type: '*/*', verify: (req: any, _res, buf) => { if (buf && buf.length) req.rawBody = buf; } }));

app.get(['/api/health', '/health'], (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now(), service: 'mamas-api' });
});

const requireFirebaseAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try { ensureFirebaseInit(); next(); }
  catch (error: any) { return res.status(503).json({ success: false, message: 'Firebase Admin SDK not configured', error: error.message }); }
};

app.post(['/api/notifications/send', '/notifications/send'], requireFirebaseAdmin, async (req, res) => {
  try {
    const { userId, title, body, type, targetId, targetUrl } = req.body || {};
    if (!title || !body) return res.status(400).json({ success: false, message: 'Missing title or body' });
    const firestore = getFirestore();
    const messaging = getMessaging();
    const notifRef = await firestore.collection('notifications').add({
      userId: userId || 'ALL_APPROVED', title, body, type: type || 'notice',
      targetId: targetId || null, targetUrl: targetUrl || '/', read: false, createdAt: Date.now()
    });
    let tokens: string[] = [];
    if (userId === 'ALL_APPROVED') {
      const snap = await firestore.collection('users').where('status', '==', 'approved').get();
      snap.forEach(docSnap => { const uData = docSnap.data(); if (Array.isArray(uData.fcmTokens)) tokens.push(...uData.fcmTokens); });
    } else if (Array.isArray(userId)) {
      for (const uid of userId) {
        if (!uid) continue;
        const uDoc = await firestore.collection('users').doc(uid).get();
        if (uDoc.exists) { const uData = uDoc.data(); if (uData && Array.isArray(uData.fcmTokens)) tokens.push(...uData.fcmTokens); }
      }
    } else if (userId && typeof userId === 'string') {
      const uDoc = await firestore.collection('users').doc(userId).get();
      if (uDoc.exists) { const uData = uDoc.data(); if (uData && Array.isArray(uData.fcmTokens)) tokens.push(...uData.fcmTokens); }
    }
    tokens = Array.from(new Set(tokens.filter(t => typeof t === 'string' && t.trim().length > 0)));
    let successCount = 0, failureCount = 0;
    if (tokens.length > 0) {
      try {
        const response = await messaging.sendEachForMulticast({
          tokens, notification: { title, body },
          data: { title, body, type: type || 'notice', targetId: targetId || '', targetUrl: targetUrl || '/' }
        });
        successCount = response.successCount; failureCount = response.failureCount;
        console.log(`FCM: ${successCount} success, ${failureCount} failure out of ${tokens.length} tokens.`);
      } catch (fcmErr: any) { console.error('FCM error:', fcmErr?.message || fcmErr); }
    }
    return res.json({ success: true, notificationId: notifRef.id, tokenCount: tokens.length, successCount, failureCount });
  } catch (error: any) {
    console.error('Send notification error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Internal server error' });
  }
});

app.post(['/api/relworx/initiate-collection', '/relworx/initiate-collection'], requireFirebaseAdmin, async (req, res) => {
  try {
    const clientIp = getClientIp(req);
    const ipCheck = collectionRateLimiter.check(`ip:${clientIp}`);
    if (!ipCheck.allowed) {
      res.setHeader('Retry-After', String(ipCheck.retryAfterSec));
      return res.status(429).json({ success: false, message: "Too many requests. Please wait and try again." });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try { decodedToken = await getAuth().verifyIdToken(token); }
    catch (authErr: any) { return res.status(401).json({ success: false, message: 'Invalid token' }); }

    const uidCheck = collectionRateLimiter.check(`uid:${decodedToken.uid}`);
    if (!uidCheck.allowed) {
      res.setHeader('Retry-After', String(uidCheck.retryAfterSec));
      return res.status(429).json({ success: false, message: "Too many requests. Please wait and try again." });
    }

    const { amount, phoneNumber, network, userId, purpose, metadata } = req.body || {};
    if (!amount || !phoneNumber || !network || !userId) return res.status(400).json({ success: false, message: 'Missing required parameters' });
    if (decodedToken.uid !== userId) return res.status(403).json({ success: false, message: 'User ID mismatch' });

    // Enforce MAMAS visibility and eligibility rules:
    // Welfare contributions and Solidarity Support remain VERIFIED-ONLY. School campaigns allow unverified users.
    const isWelfare = purpose === 'welfare' || metadata?.purpose === 'welfare' || metadata?.type === 'welfare';
    const isWelfareSupport = purpose === 'welfare_support' || metadata?.purpose === 'welfare_support' || metadata?.type === 'welfare_support';
    
    if (isWelfare || isWelfareSupport) {
      const userSnap = await getFirestore().collection('users').doc(userId).get();
      if (!userSnap.exists || userSnap.data()?.status !== 'approved') {
        return res.status(403).json({ 
          success: false, 
          message: 'Welfare and solidarity contributions are reserved for verified alumni members. Please support our School Campaigns while your application is under review.' 
        });
      }
    }

    if (isWelfareSupport) {
      const welfareId = metadata?.welfareRequestId || metadata?.campaignId;
      if (!welfareId) {
        return res.status(400).json({ success: false, message: 'Welfare request ID is required for solidarity support.' });
      }
      const welfareSnap = await getFirestore().collection('welfareRequests').doc(welfareId).get();
      if (!welfareSnap.exists) {
        return res.status(404).json({ success: false, message: 'Welfare request case not found.' });
      }
      const wData = welfareSnap.data();
      if (!wData?.isPublishedToFeed) {
        return res.status(400).json({ success: false, message: 'This welfare case is not published to the public feed.' });
      }
      if (wData.supportStatus === 'paused') {
        return res.status(400).json({ success: false, message: 'Solidarity support for this case is currently paused.' });
      }
      if (wData.supportStatus === 'closed' || wData.supportEnabled === false) {
        return res.status(400).json({ success: false, message: 'Solidarity support for this case is now closed.' });
      }
    }

    const result = await initiateCollection(amount, phoneNumber, network, userId, metadata || { purpose });
    const relworxReference = result.relworxReference || result.reference || result.data?.reference;
    const contribDocId = metadata?.contributionId || metadata?.reference;
    if (contribDocId) {
      try { await getFirestore().collection('contributions').doc(contribDocId).update({ relworxReference: relworxReference || null, status: 'pending_payment', updatedAt: Date.now() }); }
      catch (dbErr: any) { console.warn(`Could not update contribution ${contribDocId}:`, dbErr?.message); }
    }
    return res.json({ success: true, relworxReference: relworxReference || null, data: result });
  } catch (error: any) {
    console.error('Initiate collection error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Internal server error' });
  }
});

const webhookPaths = ['/', '/api', '/api/', '/api/relworx/webhook', '/relworx/webhook', '/api/webhook', '/webhook'];

app.get(webhookPaths, (req, res, next) => {
  if (req.path === '/api/health' || req.path === '/health') return next();
  return res.status(200).json({ success: true, status: 'success', message: 'Webhook endpoint active.' });
});

app.post(webhookPaths, async (req, res) => {
  const clientIp = getClientIp(req);
  const webhookLimit = webhookRateLimiter.check(`webhook_ip:${clientIp}`);
  if (!webhookLimit.allowed) {
    res.setHeader('Retry-After', String(webhookLimit.retryAfterSec));
    return res.status(429).json({ success: false, message: "Too many requests. Please wait and try again." });
  }

  try { ensureFirebaseInit(); } catch (err: any) { console.warn('Firebase init warning:', err?.message); }
  try {
    let rawBody = '';
    if ((req as any).rawBody && Buffer.isBuffer((req as any).rawBody)) rawBody = (req as any).rawBody.toString('utf8');
    else if (Buffer.isBuffer(req.body)) rawBody = req.body.toString('utf8');
    else if (typeof req.body === 'string') rawBody = req.body;
    else if (req.body && typeof req.body === 'object') rawBody = JSON.stringify(req.body);

    let payload: any = {};
    try { payload = rawBody ? JSON.parse(rawBody) : (req.body || {}); }
    catch { payload = req.body || {}; }

    console.log('[Webhook] Payload:', JSON.stringify(payload));

    const isTestPing = !payload || Object.keys(payload).length === 0 || payload.test === true ||
      payload.event === 'ping' || payload.event === 'test' ||
      (!payload.reference && !payload.transaction_id && !payload.transactionId && !payload.disbursementId);

    if (isTestPing) {
      console.log('[Webhook] Test ping acknowledged.');
      return res.status(200).json({ success: true, status: 'success', message: 'Webhook endpoint active.' });
    }

    const secret = process.env.RELWORX_WEBHOOK_KEY || process.env.RELWORX_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[Webhook] RELWORX_WEBHOOK_KEY / RELWORX_WEBHOOK_SECRET not configured. Rejecting request.');
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }
    const signature = (
      req.headers['relworx-signature'] ||
      req.headers['x-relworx-signature'] ||
      req.headers['x-signature'] ||
      req.headers['signature']
    ) as string;
    if (!signature) {
      console.warn('[Webhook] Missing signature in request.');
      return res.status(401).json({ success: false, message: 'Missing signature' });
    }
    const isValid = verifyWebhookSignature(signature, rawBody, secret);
    if (!isValid) {
      console.warn('[Webhook] Invalid signature detected.');
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }

    let isDisbursement = 
      payload.transaction_type === 'disbursement' || 
      payload.type === 'disbursement' || 
      (typeof payload.reference === 'string' && (payload.reference.startsWith('DISB_') || payload.reference.startsWith('DISB')));

    if (!isDisbursement && payload.reference) {
      const firestore = getFirestore();
      const [wQuery, eQuery] = await Promise.all([
        firestore.collection('welfareRequests').where('relworxReference', '==', payload.reference).limit(1).get(),
        firestore.collection('expenses').where('relworxReference', '==', payload.reference).limit(1).get(),
      ]);
      if (!wQuery.empty || !eQuery.empty) {
        isDisbursement = true;
      } else {
        const [wDoc, eDoc] = await Promise.all([
          firestore.collection('welfareRequests').doc(payload.reference).get(),
          firestore.collection('expenses').doc(payload.reference).get(),
        ]);
        if (wDoc.exists || eDoc.exists) {
          isDisbursement = true;
        }
      }
    }

    if (isDisbursement) {
      await handleDisbursementWebhook(payload);
    } else {
      await handleCollectionWebhook(payload);
    }
    return res.status(200).json({ success: true, status: 'success', message: 'Webhook processed' });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return res.status(200).json({ success: true, status: 'acknowledged', warning: error?.message });
  }
});

app.post(['/api/relworx/initiate-disbursement', '/relworx/initiate-disbursement'], requireFirebaseAdmin, async (req, res) => {
  try {
    const clientIp = getClientIp(req);
    const ipCheck = disbursementRateLimiter.check(`ip:${clientIp}`);
    if (!ipCheck.allowed) {
      res.setHeader('Retry-After', String(ipCheck.retryAfterSec));
      return res.status(429).json({ success: false, message: "Too many requests. Please wait and try again." });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Not allowed to payout' });
    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try { decodedToken = await getAuth().verifyIdToken(token); }
    catch (authErr: any) { return res.status(401).json({ success: false, message: 'Not allowed to payout' }); }

    const uidCheck = disbursementRateLimiter.check(`uid:${decodedToken.uid}`);
    if (!uidCheck.allowed) {
      res.setHeader('Retry-After', String(uidCheck.retryAfterSec));
      return res.status(429).json({ success: false, message: "Too many requests. Please wait and try again." });
    }

    const firestore = getFirestore();
    const userDoc = await firestore.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists) return res.status(403).json({ success: false, message: 'Not allowed to payout' });
    const userData = userDoc.data();
    const allowedRoles = ['super_admin', 'treasurer', 'chairperson', 'vice_chairperson'];
    if (!userData?.role || !allowedRoles.includes(userData.role)) return res.status(403).json({ success: false, message: 'Not allowed to payout' });
    const { type, documentId, note } = req.body || {};
    if (!type || !documentId) return res.status(400).json({ success: false, message: 'Request not found' });
    if (type !== 'welfare' && type !== 'expense') return res.status(400).json({ success: false, message: 'Request not found' });

    const docRef = type === 'welfare'
      ? firestore.collection('welfareRequests').doc(documentId)
      : firestore.collection('expenses').doc(documentId);

    // Deterministic disbursement reference (AUD-004)
    const disbReference = `DISB_${type.toUpperCase()}_${documentId}`;
    let amount: number = 0;
    let phoneNum: string = '';
    let network: string = 'MTN';
    let beneficiaryName: string | undefined;

    // Atomic claim via Firestore transaction (AUD-003)
    try {
      await firestore.runTransaction(async (t) => {
        const docSnap = await t.get(docRef);
        if (!docSnap.exists) {
          const err: any = new Error('Request not found');
          err.statusCode = 404;
          throw err;
        }
        const data = docSnap.data();
        if (!data) {
          const err: any = new Error('Request data missing');
          err.statusCode = 404;
          throw err;
        }

        // Conflict of interest check
        if (data.userId === decodedToken.uid) {
          const err: any = new Error('You cannot payout your own request');
          err.statusCode = 409;
          throw err;
        }

        // Must be in approved status to be disbursed
        if (type === 'welfare') {
          if (data.status !== 'approved' && data.status !== 'accepted') {
            const err: any = new Error('Only approved requests can be paid');
            err.statusCode = 409;
            throw err;
          }
        } else {
          if (data.status !== 'approved' && data.approvalStatus !== 'approved') {
            const err: any = new Error('Only approved requests can be paid');
            err.statusCode = 409;
            throw err;
          }
        }

        // Check if already in progress or already paid
        if (
          data.disbursementStatus === 'in_progress' ||
          data.disbursementStatus === 'successful' ||
          data.disbursementStatus === 'paid' ||
          data.status === 'paid'
        ) {
          const err: any = new Error(
            data.disbursementStatus === 'in_progress'
              ? 'Payout already in progress'
              : 'Already paid'
          );
          err.statusCode = 409;
          throw err;
        }

        const reqAmount = type === 'welfare' ? data.amountRequested : data.amount;
        if (!reqAmount || !data.recipientPhoneNumber) {
          const err: any = new Error('Recipient number missing. Update request before payout');
          err.statusCode = 400;
          throw err;
        }

        amount = Number(reqAmount);
        phoneNum = String(data.recipientPhoneNumber);
        network = String(data.recipientNetwork || 'MTN');
        beneficiaryName = type === 'welfare' ? (data.recipientName || data.personName) : data.recipientName;

        const now = Date.now();
        console.log(`[Disbursement] Atomic claim acquired for ${disbReference} by admin ${decodedToken.uid}`);
        t.update(docRef, {
          disbursementStatus: 'in_progress',
          relworxReference: disbReference,
          disbursementReference: disbReference,
          claimedAt: now,
          claimedBy: decodedToken.uid,
          updatedAt: now,
          disbursementError: null
        });
      });
    } catch (claimErr: any) {
      const statusCode = claimErr.statusCode || 409;
      console.warn(`[Disbursement] Claim rejected for ${disbReference}:`, claimErr.message);
      return res.status(statusCode).json({ success: false, message: claimErr.message || 'Payout claim conflict' });
    }

    // Only AFTER transaction successfully commits, call Relworx gateway
    const metadata = { type, documentId, note, beneficiaryName, reference: disbReference };
    let result;
    try {
      result = await initiateDisbursement(amount, phoneNum, network, disbReference, metadata);
    } catch (apiError: any) {
      const errMsg = apiError.message || '';
      console.error(`[Disbursement] Relworx initiate failed for ${disbReference}, reverting in_progress:`, errMsg);
      // Revert status on failure so retry is possible and request is not permanently locked (AUD-003)
      const revertUpdate = {
        disbursementStatus: 'failed',
        disbursementError: errMsg || 'Relworx initiate failed',
        updatedAt: Date.now()
      };
      await docRef.update(revertUpdate);

      if (errMsg.toLowerCase().includes('insufficient')) {
        return res.status(503).json({ success: false, message: 'Insufficient confirmed funds' });
      } else {
        return res.status(503).json({ success: false, message: 'Payout failed. Recipient not paid. You can retry after fixing details' });
      }
    }

    const relworxDisbId = result.reference || result.data?.reference || result.disbursementId || result.disbursement_id || null;
    const updateData = {
      disbursementStatus: 'pending',
      relworxDisbursementId: relworxDisbId,
      relworxReference: disbReference,
      updatedAt: Date.now()
    };
    await docRef.update(updateData);
    return res.json({ success: true, data: result, reference: disbReference });
  } catch (error: any) {
    console.error('Initiate disbursement error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Internal server error' });
  }
});

app.post([
  '/api/relworx/reconcile-contribution', 
  '/relworx/reconcile-contribution',
  '/api/relworx/reconcile-pending',
  '/relworx/reconcile-pending'
], requireFirebaseAdmin, async (req, res) => {
  try {
    const clientIp = getClientIp(req);
    const ipCheck = reconcileRateLimiter.check(`recon_ip:${clientIp}`);
    if (!ipCheck.allowed) {
      res.setHeader('Retry-After', String(ipCheck.retryAfterSec));
      return res.status(429).json({ success: false, message: "Too many requests. Please wait and try again." });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try { decodedToken = await getAuth().verifyIdToken(token); }
    catch { return res.status(401).json({ success: false, message: 'Invalid token' }); }

    const uidCheck = reconcileRateLimiter.check(`recon_uid:${decodedToken.uid}`);
    if (!uidCheck.allowed) {
      res.setHeader('Retry-After', String(uidCheck.retryAfterSec));
      return res.status(429).json({ success: false, message: "Too many requests. Please wait and try again." });
    }

    const { contributionId } = req.body || {};
    if (!contributionId) return res.status(400).json({ success: false, message: 'Contribution ID is required' });

    const firestore = getFirestore();
    const contribRef = firestore.collection('contributions').doc(contributionId);
    const contribSnap = await contribRef.get();
    if (!contribSnap.exists) return res.status(404).json({ success: false, message: 'Contribution not found' });

    const contribData = contribSnap.data();
    if (!contribData) return res.status(404).json({ success: false, message: 'Contribution data missing' });

    const userDoc = await firestore.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    const allowedRoles = ['super_admin', 'treasurer', 'chairperson', 'auditor', 'vice_chairperson'];
    const isOwner = contribData.userId === decodedToken.uid;
    const isAdmin = userData?.role && allowedRoles.includes(userData.role);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    if (['verified', 'success', 'successful', 'failed', 'expired', 'failed_timeout'].includes(contribData.status)) {
      return res.json({ success: true, status: contribData.status, message: 'Contribution already in terminal state' });
    }

    const relworxRef = contribData.relworxReference;
    const now = Date.now();
    const createdAt = contribData.createdAt || contribData.timestamp?.toMillis?.() || now;
    const ageMinutes = (now - createdAt) / (1000 * 60);

    let providerStatus = 'unknown';

    if (relworxRef) {
      const apiKey = process.env.RELWORX_API_KEY;
      const url = `${process.env.RELWORX_COLLECTION_URL || 'https://api.relworx.com/v1/collections'}/${encodeURIComponent(relworxRef)}`;
      if (apiKey) {
        try {
          const resp = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
          });
          if (resp.ok) {
            const respData = await resp.json().catch(() => ({}));
            providerStatus = respData?.status || respData?.data?.status || 'unknown';
          }
        } catch (apiErr) {
          console.warn('Relworx status inquiry error:', apiErr);
        }
      }
    }

    const maxWithoutRefMinutes = 30;
    const maxAgeMinutes = 24 * 60;

    if (providerStatus === 'successful' || providerStatus === 'completed' || providerStatus === 'success') {
      await handleCollectionWebhook({
        status: 'successful',
        reference: relworxRef || contributionId,
        amount: contribData.amount,
        transactionId: contribData.relworxTransactionId || `recon_${contributionId}`
      });
      await firestore.collection('activityLogs').add({
        action: 'RECONCILE_CONTRIBUTION', adminId: decodedToken.uid, targetId: contributionId,
        details: `Contribution ${contributionId} successfully reconciled and verified via provider inquiry.`, createdAt: now
      });
      return res.json({ success: true, status: 'verified', message: 'Successfully reconciled and verified via provider' });
    } else if (providerStatus === 'failed' || providerStatus === 'cancelled') {
      await contribRef.update({ status: 'failed', paymentStatus: 'failed', updatedAt: now });
      await firestore.collection('activityLogs').add({
        action: 'RECONCILE_CONTRIBUTION', adminId: decodedToken.uid, targetId: contributionId,
        details: `Contribution ${contributionId} marked failed via provider inquiry.`, createdAt: now
      });
      return res.json({ success: true, status: 'failed', message: 'Provider reported transaction failed' });
    } else {
      if (!relworxRef && ageMinutes > maxWithoutRefMinutes) {
        await contribRef.update({ status: 'expired', paymentStatus: 'failed', auditNote: 'Expired: No provider reference generated within threshold', updatedAt: now });
        return res.json({ success: true, status: 'expired', message: 'Contribution expired (no provider reference)' });
      }
      if (ageMinutes > maxAgeMinutes) {
        await contribRef.update({ status: 'expired', paymentStatus: 'failed', auditNote: 'Expired: Max pending age reached', updatedAt: now });
        return res.json({ success: true, status: 'expired', message: 'Contribution expired (max pending age exceeded)' });
      }

      return res.json({ success: true, status: contribData.status, message: 'Transaction still pending payment confirmation' });
    }
  } catch (error: any) {
    console.error('Reconciliation error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Internal server error' });
  }
});

// ========== AUTH RE-APPLY ENDPOINT ==========
app.post('/api/auth/reapply', async (req, res) => {
  try {
    ensureFirebaseInit();
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    const { fullName, phoneNumber, yearOfCompletion } = req.body || {};
    
    const firestore = getDb();
    const userRef = firestore.collection('users').doc(decodedToken.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userData = userDoc.data();
    if (userData?.status !== 'rejected') {
      return res.status(400).json({ success: false, message: 'Only rejected members can re-apply' });
    }

    const updates: any = {
      status: 'pending',
      reappliedAt: Date.now(),
      updatedAt: Date.now()
    };
    if (fullName) updates.fullName = fullName;
    if (phoneNumber) updates.phoneNumber = phoneNumber;
    if (yearOfCompletion) updates.yearOfCompletion = yearOfCompletion;

    await userRef.update(updates);

    return res.json({ success: true, message: 'Re-application submitted successfully' });
  } catch (error: any) {
    console.error('Re-apply error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Internal server error' });
  }
});

app.post('/api/admin/finalize_deletions', async (req, res) => {
  try {
    ensureFirebaseInit();
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    
    const firestore = getDb();
    const adminSnap = await firestore.collection('users').doc(decodedToken.uid).get();
    if (!adminSnap.exists || adminSnap.data()?.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Permission denied: Super Admin required' });
    }

    const now = Date.now();
    const usersQuery = await firestore.collection('users')
      .where('status', '==', 'pending_deletion')
      .where('deletionEffectiveAt', '<=', now)
      .get();

    if (usersQuery.empty) {
      return res.json({ success: true, message: 'No accounts pending finalization at this time.' });
    }

    const bucket = getStorage().bucket('mama-alumin.firebasestorage.app');
    let finalizedCount = 0;

    for (const doc of usersQuery.docs) {
      const userData = doc.data();
      const userId = doc.id;
      const historicalName = userData.historicalDisplayName || userData.fullName || 'Former Member';

      // 1. Delete Profile Picture
      if (userData.profilePictureUrl) {
        try {
          // Parse the file path from the Firebase storage URL
          // Typically: https://firebasestorage.googleapis.com/v0/b/BUCKET/o/PATH?alt=media...
          const urlObj = new URL(userData.profilePictureUrl);
          const pathPrefix = `/v0/b/${bucket.name}/o/`;
          if (urlObj.pathname.includes(pathPrefix)) {
            const filePath = decodeURIComponent(urlObj.pathname.split(pathPrefix)[1]);
            await bucket.file(filePath).delete();
          }
        } catch (err) {
          console.warn(`Could not delete storage file for ${userId}:`, err);
        }
      }

      // 2. Delete directory profile
      try {
        await firestore.collection('directoryProfiles').doc(userId).delete();
      } catch (err) {
        console.warn(`Could not delete directory profile for ${userId}:`, err);
      }

      // 3. Redact user document
      await doc.ref.update({
        status: "deleted",
        historicalDisplayName: historicalName,
        fullName: historicalName,
        phoneNumber: "REDACTED",
        email: `deleted_${userId.slice(0, 8)}@anonymized.mamas`,
        profilePictureUrl: "",
        placeOfResidence: "",
        district: "",
        workplace: "",
        university: "",
        course: "",
        nextOfKinName: "",
        nextOfKinPhone: "",
        recoveryEmail: "",
        fcmTokens: [],
        anonymizedAt: now,
        updatedAt: now
      });

      // 4. Log activity
      await firestore.collection('activityLogs').add({
        action: 'FINALIZE_ACCOUNT_DELETION',
        adminId: 'SYSTEM',
        targetId: userId,
        details: `Cron/Admin Finalized account deletion and anonymized personal profile while preserving financial history for ${historicalName}`,
        createdAt: now
      });

      finalizedCount++;
    }

    return res.json({ success: true, message: `Successfully finalized ${finalizedCount} accounts.` });
  } catch (error: any) {
    console.error('Finalize deletions error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Internal server error' });
  }
});

app.all('*', (req, res) => {
  console.log(`[Fallback] ${req.method} ${req.path}`);
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'API route not found' });
  }
  return res.status(200).json({ success: true, status: 'success', message: 'API active.', path: req.path });
});

export default app;
