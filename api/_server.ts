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
          if (status === 'successful') {
            updateData.paidAt = Date.now(); updateData.status = 'verified';
            updateData.verifiedBy = 'RELWORX_WEBHOOK'; updateData.verifiedAt = Date.now();
            if (contribData.userId) {
              const userRef = getDb().collection('users').doc(contribData.userId);
              const userDoc = await transaction.get(userRef);
              if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData) {
                  const isWelfare = contribData.purpose === 'welfare' || contribData.type === 'welfare';
                  const isCampaign = contribData.purpose === 'campaign' || contribData.type === 'school_support' || contribData.type === 'campaign';
                  const newTotalContributed = isWelfare || !isCampaign
                    ? (userData.totalContributed || 0) + (contribData.amount || 0)
                    : (userData.totalContributed || 0);
                  const newCampaignContributed = isCampaign
                    ? (userData.totalCampaignContributed || 0) + (contribData.amount || 0)
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
                  const newRaisedAmount = (campaignData.raisedAmount || 0) + (contribData.amount || 0);
                  const campUpdates: any = { raisedAmount: newRaisedAmount, updatedAt: Date.now() };
                  if (campaignData.targetAmount > 0 && newRaisedAmount >= campaignData.targetAmount && campaignData.status === 'active') {
                    campUpdates.status = 'fully_funded';
                  }
                  transaction.update(campaignRef, campUpdates);
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
            await getDb().collection('notifications').add({
              userId: contribData.userId, title: "Payment Received",
              body: `Your mobile money payment of UGX ${new Intl.NumberFormat('en-UG').format(contribData.amount || 0)} was successful. Thank you!`,
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

    const secret = process.env.RELWORX_WEBHOOK_SECRET || '';
    const signature = (req.headers['x-signature'] || req.headers['signature']) as string;
    if (secret && signature) {
      const isValid = verifyWebhookSignature(signature, rawBody, secret);
      if (!isValid) return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
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
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try { decodedToken = await getAuth().verifyIdToken(token); }
    catch (authErr: any) { return res.status(401).json({ success: false, message: 'Invalid token' }); }
    const firestore = getFirestore();
    const userDoc = await firestore.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists) return res.status(403).json({ success: false, message: 'User profile not found' });
    const userData = userDoc.data();
    const allowedRoles = ['super_admin', 'treasurer', 'chairperson', 'vice_chairperson'];
    if (!userData?.role || !allowedRoles.includes(userData.role)) return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    const { type, documentId, note } = req.body || {};
    if (!type || !documentId) return res.status(400).json({ success: false, message: 'Missing type or documentId' });
    if (type !== 'welfare' && type !== 'expense') return res.status(400).json({ success: false, message: 'Invalid type' });

    let amount: number, phoneNum: string, network: string, beneficiaryName: string | undefined;
    if (type === 'welfare') {
      const docSnap = await firestore.collection('welfareRequests').doc(documentId).get();
      if (!docSnap.exists) return res.status(400).json({ success: false, message: 'Welfare request not found' });
      const data = docSnap.data();
      if (data?.status !== 'approved' && data?.status !== 'accepted') return res.status(409).json({ success: false, message: 'Not approved' });
      if (data?.disbursementStatus === 'pending' || data?.disbursementStatus === 'successful' || data?.status === 'paid') return res.status(409).json({ success: false, message: 'Already processing/paid' });
      if (!data?.amountRequested || !data?.recipientPhoneNumber) return res.status(400).json({ success: false, message: 'Missing amount or phone' });
      amount = data.amountRequested; phoneNum = data.recipientPhoneNumber; network = data.recipientNetwork || 'MTN'; beneficiaryName = data.recipientName || data.personName;
    } else {
      const docSnap = await firestore.collection('expenses').doc(documentId).get();
      if (!docSnap.exists) return res.status(400).json({ success: false, message: 'Expense not found' });
      const data = docSnap.data();
      if (data?.status !== 'approved' && data?.approvalStatus !== 'approved') return res.status(409).json({ success: false, message: 'Not approved' });
      if (data?.disbursementStatus === 'pending' || data?.disbursementStatus === 'successful' || data?.status === 'paid') return res.status(409).json({ success: false, message: 'Already processing/paid' });
      if (!data?.amount || !data?.recipientPhoneNumber) return res.status(400).json({ success: false, message: 'Missing amount or phone' });
      amount = data.amount; phoneNum = data.recipientPhoneNumber; network = data.recipientNetwork || 'MTN'; beneficiaryName = data.recipientName;
    }
    const metadata = { type, documentId, note, beneficiaryName };
    const result = await initiateDisbursement(amount, phoneNum, network, documentId, metadata);
    const updateData = { disbursementStatus: "pending", relworxDisbursementId: result.reference || result.data?.reference || null, updatedAt: Date.now() };
    if (type === 'welfare') await firestore.collection('welfareRequests').doc(documentId).update(updateData);
    else await firestore.collection('expenses').doc(documentId).update(updateData);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Initiate disbursement error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Internal server error' });
  }
});

app.all('*', (req, res) => {
  console.log(`[Fallback] ${req.method} ${req.path}`);
  return res.status(200).json({ success: true, status: 'success', message: 'API active.', path: req.path });
});

export default app;
