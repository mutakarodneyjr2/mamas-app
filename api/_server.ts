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

// ========== INLINE RELWORX FUNCTIONS (NO EXTERNAL IMPORTS) ==========

export function verifyWebhookSignature(signature: string, payload: string, secret: string): boolean {
  if (!signature || !payload || !secret) return false;
  try {
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);
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
          const contribDoc = await transaction.get(docRef);
          if (!contribDoc.exists) return;
          const contribData = contribDoc.data();
          if (!contribData) return;
          if (contribData.status === 'verified' && status === 'successful') return;
          if (contribData.relworxTransactionId === transactionId && transactionId) return;
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

            if (contribData.userId) {
              const userRef = getDb().collection('users').doc(contribData.userId);
              const userDoc = await transaction.get(userRef);
              if (userDoc.exists) {
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
            }
            const campaignId = contribData.campaignId;
            const isCampaignType = contribData.type === 'school_support' || contribData.type === 'campaign' || contribData.purpose === 'campaign';
            if (isCampaignType && campaignId) {
              const campaignRef = getDb().collection('schoolCampaigns').doc(campaignId);
              const campaignDoc = await transaction.get(campaignRef);
              if (campaignDoc.exists) {
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
            }

            // If solidarity support for a published welfare case
            const welfareReqId = contribData.welfareRequestId || (contribData.type === 'welfare_support' ? contribData.campaignId : null);
            const isWelfareSupportType = contribData.type === 'welfare_support' || contribData.purpose === 'welfare_support';
            if (isWelfareSupportType && welfareReqId) {
              const welfareRef = getDb().collection('welfareRequests').doc(welfareReqId);
              const welfareDoc = await transaction.get(welfareRef);
              if (welfareDoc.exists) {
                const welfareData = welfareDoc.data();
                if (welfareData) {
                  const newSupportRaised = (welfareData.supportRaisedAmount || 0) + confirmedAmount;
                  const newSupportCount = (welfareData.supportContributorCount || 0) + 1;
                  transaction.update(welfareRef, {
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
  const disbursementId = payload.disbursementId;
  const amount = payload.amount;
  const txRef = getDb().collection('transactions').doc(disbursementId || `disb_${Date.now()}`);
  await txRef.set({
    id: txRef.id, type: 'disbursement', relatedId: reference, amount: amount || 0,
    reference: reference || '', internalReference: payload.internalReference || '',
    status: status || 'unknown', gatewayResponse: payload, updatedAt: Date.now(), createdAt: Date.now()
  }, { merge: true });

  if (reference) {
    const expenseRef = getDb().collection('expenses').doc(reference);
    const expenseDoc = await expenseRef.get();
    if (expenseDoc.exists) {
      const expenseData = expenseDoc.data();
      if (expenseData?.status === 'paid' || expenseData?.relworxDisbursementId === disbursementId) {
        console.log(`[Relworx] Expense ${reference} already paid. Skipping duplicate.`);
        return { success: true, skipped: true };
      }
      const updateData: any = {
        disbursementStatus: status === 'successful' ? 'paid' : status === 'failed' ? 'failed' : 'processing',
        gatewayResponse: payload, relworxDisbursementId: disbursementId
      };
      if (status === 'successful') {
        updateData.paidAt = Date.now(); updateData.status = 'paid';
        const expenseData = expenseDoc.data();
        if (expenseData) {
          const moneyOutRef = getDb().collection('moneyOut').doc();
          await moneyOutRef.set({
            id: moneyOutRef.id, type: "expense", amount: expenseData.amount || 0,
            reason: expenseData.reason || 'Expense Payout', beneficiaryName: expenseData.recipientName || 'General Expense',
            transactionReference: reference, approvedBy: 'SYSTEM_RELWORX', createdAt: Date.now()
          });
          await getDb().collection('notifications').add({
            userId: 'ALL_APPROVED', title: "Association Expense Paid",
            body: `An expense for ${expenseData.reason} (UGX ${new Intl.NumberFormat('en-UG').format(expenseData.amount || 0)}) was paid.`,
            type: "system", targetUrl: "/money-out", read: false, createdAt: Date.now()
          });
        }
      }
      await expenseRef.update(updateData);
      await getDb().collection('activityLogs').add({
        action: 'RELWORX_DISBURSEMENT_EXPENSE', adminId: 'SYSTEM', targetId: reference,
        details: `Relworx disbursement webhook received. Status: ${status}`, createdAt: Date.now()
      });
      return { success: true };
    }

    const welfareRef = getDb().collection('welfareRequests').doc(reference);
    const welfareDoc = await welfareRef.get();
    if (welfareDoc.exists) {
      const welfareData = welfareDoc.data();
      if (welfareData?.status === 'paid' || welfareData?.relworxDisbursementId === disbursementId) {
        console.log(`[Relworx] Welfare request ${reference} already paid. Skipping duplicate.`);
        return { success: true, skipped: true };
      }
      const updateData: any = {
        disbursementStatus: status === 'successful' ? 'paid' : status === 'failed' ? 'failed' : 'processing',
        gatewayResponse: payload, relworxDisbursementId: disbursementId
      };
      if (status === 'successful') {
        updateData.paidAt = Date.now(); updateData.status = 'paid';
        const welfareData = welfareDoc.data();
        if (welfareData) {
          const moneyOutRef = getDb().collection('moneyOut').doc();
          await moneyOutRef.set({
            id: moneyOutRef.id, type: "welfare", amount: welfareData.amountRequested || 0,
            reason: `Welfare Payout: ${welfareData.category || ''}`, beneficiaryName: welfareData.personName || 'Unknown Member',
            transactionReference: reference, approvedBy: 'SYSTEM_RELWORX', createdAt: Date.now()
          });
          await getDb().collection('notifications').add({
            userId: 'ALL_APPROVED', title: "Welfare Payout Disbursed",
            body: `A welfare payout of UGX ${new Intl.NumberFormat('en-UG').format(welfareData.amountRequested || 0)} for ${welfareData.personName} was completed.`,
            type: "system", targetUrl: "/welfare", read: false, createdAt: Date.now()
          });
          if (welfareData.userId) {
            await getDb().collection('notifications').add({
              userId: welfareData.userId, title: "Your Welfare Request Paid",
              body: `Your welfare request payout of UGX ${new Intl.NumberFormat('en-UG').format(welfareData.amountRequested || 0)} was successfully processed.`,
              type: "welfare_update", targetUrl: "/apply-welfare", read: false, createdAt: Date.now()
            });
          }
        }
      }
      await welfareRef.update(updateData);
      await getDb().collection('activityLogs').add({
        action: 'RELWORX_DISBURSEMENT_WELFARE', adminId: 'SYSTEM', targetId: reference,
        details: `Relworx disbursement webhook received. Status: ${status}`, createdAt: Date.now()
      });
    }
  }
  return { success: true };
}

// ========== EXPRESS APP ==========

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf; } }));

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
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try { decodedToken = await getAuth().verifyIdToken(token); }
    catch (authErr: any) { return res.status(401).json({ success: false, message: 'Invalid token' }); }
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

    const secret = process.env.RELWORX_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[Webhook] RELWORX_WEBHOOK_SECRET not configured. Rejecting request.');
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }
    const signature = (req.headers['x-signature'] || req.headers['signature']) as string;
    if (!signature) {
      console.warn('[Webhook] Missing signature in request.');
      return res.status(401).json({ success: false, message: 'Missing signature' });
    }
    const isValid = verifyWebhookSignature(signature, rawBody, secret);
    if (!isValid) {
      console.warn('[Webhook] Invalid signature detected.');
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }

    if (payload.transaction_type === 'disbursement' || payload.type === 'disbursement' || (payload.reference && payload.reference.startsWith('DISB'))) {
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
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Not allowed to payout' });
    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try { decodedToken = await getAuth().verifyIdToken(token); }
    catch (authErr: any) { return res.status(401).json({ success: false, message: 'Not allowed to payout' }); }
    const firestore = getFirestore();
    const userDoc = await firestore.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists) return res.status(403).json({ success: false, message: 'Not allowed to payout' });
    const userData = userDoc.data();
    const allowedRoles = ['super_admin', 'treasurer', 'chairperson', 'vice_chairperson'];
    if (!userData?.role || !allowedRoles.includes(userData.role)) return res.status(403).json({ success: false, message: 'Not allowed to payout' });
    const { type, documentId, note } = req.body || {};
    if (!type || !documentId) return res.status(400).json({ success: false, message: 'Request not found' });
    if (type !== 'welfare' && type !== 'expense') return res.status(400).json({ success: false, message: 'Request not found' });

    let amount: number, phoneNum: string, network: string, beneficiaryName: string | undefined;
    if (type === 'welfare') {
      const docSnap = await firestore.collection('welfareRequests').doc(documentId).get();
      if (!docSnap.exists) return res.status(404).json({ success: false, message: 'Request not found' });
      const data = docSnap.data();
      if (data?.userId === decodedToken.uid) return res.status(409).json({ success: false, message: 'You cannot payout your own request' });
      if (data?.status !== 'approved' && data?.status !== 'accepted') return res.status(409).json({ success: false, message: 'Only approved requests can be paid' });
      if (data?.disbursementStatus === 'in_progress') return res.status(409).json({ success: false, message: 'Payout already in progress' });
      if (data?.disbursementStatus === 'successful' || data?.status === 'paid') return res.status(409).json({ success: false, message: 'Already paid' });
      if (!data?.amountRequested || !data?.recipientPhoneNumber) return res.status(400).json({ success: false, message: 'Recipient number missing. Update request before payout' });
      amount = data.amountRequested; phoneNum = data.recipientPhoneNumber; network = data.recipientNetwork || 'MTN'; beneficiaryName = data.recipientName || data.personName;
    } else {
      const docSnap = await firestore.collection('expenses').doc(documentId).get();
      if (!docSnap.exists) return res.status(404).json({ success: false, message: 'Request not found' });
      const data = docSnap.data();
      if (data?.userId === decodedToken.uid) return res.status(409).json({ success: false, message: 'You cannot payout your own request' });
      if (data?.status !== 'approved' && data?.approvalStatus !== 'approved') return res.status(409).json({ success: false, message: 'Only approved requests can be paid' });
      if (data?.disbursementStatus === 'in_progress') return res.status(409).json({ success: false, message: 'Payout already in progress' });
      if (data?.disbursementStatus === 'successful' || data?.status === 'paid') return res.status(409).json({ success: false, message: 'Already paid' });
      if (!data?.amount || !data?.recipientPhoneNumber) return res.status(400).json({ success: false, message: 'Recipient number missing. Update request before payout' });
      amount = data.amount; phoneNum = data.recipientPhoneNumber; network = data.recipientNetwork || 'MTN'; beneficiaryName = data.recipientName;
    }
    
    // Mark as in_progress to prevent double-clicks
    const inProgressUpdate = { disbursementStatus: "in_progress", updatedAt: Date.now() };
    if (type === 'welfare') await firestore.collection('welfareRequests').doc(documentId).update(inProgressUpdate);
    else await firestore.collection('expenses').doc(documentId).update(inProgressUpdate);

    const metadata = { type, documentId, note, beneficiaryName };
    let result;
    try {
      result = await initiateDisbursement(amount, phoneNum, network, documentId, metadata);
    } catch (apiError: any) {
      const errMsg = apiError.message || '';
      // Revert status on failure
      const revertUpdate = { disbursementStatus: "failed", updatedAt: Date.now() };
      if (type === 'welfare') await firestore.collection('welfareRequests').doc(documentId).update(revertUpdate);
      else await firestore.collection('expenses').doc(documentId).update(revertUpdate);
      
      if (errMsg.toLowerCase().includes('insufficient')) {
        return res.status(503).json({ success: false, message: 'Insufficient confirmed funds' });
      } else {
        return res.status(503).json({ success: false, message: 'Payout failed. Recipient not paid. You can retry after fixing details' });
      }
    }

    const updateData = { disbursementStatus: "pending", relworxDisbursementId: result.reference || result.data?.reference || null, updatedAt: Date.now() };
    if (type === 'welfare') await firestore.collection('welfareRequests').doc(documentId).update(updateData);
    else await firestore.collection('expenses').doc(documentId).update(updateData);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Initiate disbursement error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Internal server error' });
  }
});

app.post(['/api/relworx/reconcile-contribution', '/relworx/reconcile-contribution'], requireFirebaseAdmin, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try { decodedToken = await getAuth().verifyIdToken(token); }
    catch { return res.status(401).json({ success: false, message: 'Invalid token' }); }

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

app.all('*', (req, res) => {
  console.log(`[Fallback] ${req.method} ${req.path}`);
  return res.status(200).json({ success: true, status: 'success', message: 'API active.', path: req.path });
});

export default app;
