/**
 * REQUIRED ENVIRONMENT VARIABLES:
 * - RELWORX_API_KEY: Your Relworx API key
 * - RELWORX_MERCHANT_ID: Your Relworx Merchant ID
 * - RELWORX_WEBHOOK_SECRET: Your Relworx Webhook Secret for HMAC validation
 * - RELWORX_COLLECTION_URL: (Optional) Defaults to https://api.relworx.com/v1/collections
 * - RELWORX_DISBURSEMENT_URL: (Optional) Defaults to https://api.relworx.com/v1/disbursements
 * - FIREBASE_SERVICE_ACCOUNT_BASE64: Base64-encoded Firebase Service Account JSON
 */

import express from 'express';
import cors from 'cors';
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

// CHANGED: import from './relworxService' instead of '../src/server/relworxService'
import {
  initiateCollection,
  initiateDisbursement,
  handleCollectionWebhook,
  handleDisbursementWebhook,
  verifyWebhookSignature,
} from './relworxService';

const app = express();

app.use(cors({ origin: true, credentials: true }));

app.use(express.json({
  verify: (req: any, _res, buf) => { req.rawBody = buf; }
}));

app.get(['/api/health', '/health'], (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now(), service: 'mamas-api' });
});

const requireFirebaseAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    ensureFirebaseInit();
    next();
  } catch (error: any) {
    return res.status(503).json({ 
      success: false, 
      message: 'Service unavailable: Firebase Admin SDK not properly configured',
      error: error.message 
    });
  }
};

app.post(['/api/notifications/send', '/notifications/send'], requireFirebaseAdmin, async (req, res) => {
  try {
    const { userId, title, body, type, targetId, targetUrl } = req.body || {};
    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'Missing title or body' });
    }
    const firestore = getFirestore();
    const messaging = getMessaging();
    const notifRef = await firestore.collection('notifications').add({
      userId: userId || 'ALL_APPROVED',
      title,
      body,
      type: type || 'notice',
      targetId: targetId || null,
      targetUrl: targetUrl || '/',
      read: false,
      createdAt: Date.now()
    });
    let tokens: string[] = [];
    if (userId === 'ALL_APPROVED') {
      const snap = await firestore.collection('users').where('status', '==', 'approved').get();
      snap.forEach(docSnap => {
        const uData = docSnap.data();
        if (Array.isArray(uData.fcmTokens)) tokens.push(...uData.fcmTokens);
      });
    } else if (Array.isArray(userId)) {
      for (const uid of userId) {
        if (!uid) continue;
        const uDoc = await firestore.collection('users').doc(uid).get();
        if (uDoc.exists) {
          const uData = uDoc.data();
          if (uData && Array.isArray(uData.fcmTokens)) tokens.push(...uData.fcmTokens);
        }
      }
    } else if (userId && typeof userId === 'string') {
      const uDoc = await firestore.collection('users').doc(userId).get();
      if (uDoc.exists) {
        const uData = uDoc.get();
        if (uData && Array.isArray(uData.fcmTokens)) tokens.push(...uData.fcmTokens);
      }
    }
    tokens = Array.from(new Set(tokens.filter(t => typeof t === 'string' && t.trim().length > 0)));
    let successCount = 0;
    let failureCount = 0;
    if (tokens.length > 0) {
      try {
        const response = await messaging.sendEachForMulticast({
          tokens,
          notification: { title, body },
          data: { title, body, type: type || 'notice', targetId: targetId || '', targetUrl: targetUrl || '/' }
        });
        successCount = response.successCount;
        failureCount = response.failureCount;
        console.log(`FCM push multicast sent: ${successCount} success, ${failureCount} failure out of ${tokens.length} token(s).`);
      } catch (fcmErr: any) {
        console.error('FCM messaging send error:', fcmErr?.message || fcmErr);
      }
    } else {
      console.log('No FCM tokens registered for target recipient(s). In-app notification created.');
    }
    return res.json({
      success: true,
      notificationId: notifRef.id,
      tokenCount: tokens.length,
      successCount,
      failureCount
    });
  } catch (error: any) {
    console.error('Send notification endpoint error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Internal server error' });
  }
});

app.post(['/api/relworx/initiate-collection', '/relworx/initiate-collection'], requireFirebaseAdmin, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Missing or invalid token' });
    }
    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch (authErr: any) {
      console.error('ID token verification failed:', authErr?.message || authErr);
      return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token' });
    }
    const { amount, phoneNumber, network, userId, purpose, metadata } = req.body || {};
    if (!amount || !phoneNumber || !network || !userId) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }
    if (decodedToken.uid !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden: User ID mismatch' });
    }
    const result = await initiateCollection(amount, phoneNumber, network, userId, metadata || { purpose });
    const relworxReference = result.relworxReference || result.reference || result.data?.reference;
    const contribDocId = metadata?.contributionId || metadata?.reference;
    if (contribDocId) {
      try {
        const firestore = getFirestore();
        await firestore.collection('contributions').doc(contribDocId).update({
          relworxReference: relworxReference || null,
          status: 'pending_payment',
          updatedAt: Date.now()
        });
      } catch (dbErr: any) {
        console.warn(`Could not update contribution document ${contribDocId} with reference:`, dbErr?.message || dbErr);
      }
    }
    return res.json({ success: true, relworxReference: relworxReference || null, data: result });
  } catch (error: any) {
    console.error('Initiate collection error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Internal server error' });
  }
});

const webhookPaths = [
  '/',
  '/api',
  '/api/',
  '/api/relworx/webhook',
  '/relworx/webhook',
  '/api/webhook',
  '/webhook',
  '/api/webhook.js',
  '/webhook.js',
  '/api/index.ts'
];

app.get(webhookPaths, (req, res, next) => {
  if (req.path === '/api/health' || req.path === '/health') return next();
  return res.status(200).json({
    success: true,
    status: 'success',
    message: 'Relworx webhook endpoint is active, healthy, and operational.'
  });
});

app.post(webhookPaths, async (req, res) => {
  try {
    ensureFirebaseInit();
  } catch (err: any) {
    console.warn('Firebase Admin init warning during webhook:', err?.message);
  }
  try {
    let rawBody = '';
    if ((req as any).rawBody && Buffer.isBuffer((req as any).rawBody)) {
      rawBody = (req as any).rawBody.toString('utf8');
    } else if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString('utf8');
    } else if (typeof req.body === 'string') {
      rawBody = req.body;
    } else if (req.body && typeof req.body === 'object') {
      rawBody = JSON.stringify(req.body);
    }
    let payload: any = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : (req.body || {});
    } catch {
      payload = req.body || {};
    }
    console.log('[Relworx Webhook] Incoming payload:', JSON.stringify(payload));
    const isTestPing = !payload || 
      Object.keys(payload).length === 0 || 
      payload.test === true || 
      payload.event === 'ping' || 
      payload.event === 'test' || 
      payload.action === 'test' || 
      payload.type === 'test' ||
      (!payload.reference && !payload.transaction_id && !payload.transactionId && !payload.relworxTransactionId && !payload.disbursementId);
    if (isTestPing) {
      console.log('[Relworx Webhook] Test webhook or health check ping acknowledged.');
      return res.status(200).json({
        success: true,
        status: 'success',
        message: 'Relworx webhook endpoint is active, healthy, and operational.'
      });
    }
    const secret = process.env.RELWORX_WEBHOOK_SECRET || '';
    const signature = (req.headers['x-signature'] || req.headers['signature']) as string;
    if (secret && signature) {
      const isValid = verifyWebhookSignature(signature, rawBody, secret);
      if (!isValid) {
        console.warn('[Relworx Webhook] Invalid HMAC signature received.');
        return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
      }
    } else if (secret && !signature) {
      console.warn('[Relworx Webhook] RELWORX_WEBHOOK_SECRET configured but x-signature header missing.');
    }
    if (payload.transaction_type === 'disbursement' || payload.type === 'disbursement' || (payload.reference && payload.reference.startsWith('DISB'))) {
      await handleDisbursementWebhook(payload);
    } else {
      await handleCollectionWebhook(payload);
    }
    return res.status(200).json({ success: true, status: 'success', message: 'Webhook processed successfully' });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return res.status(200).json({ success: true, status: 'acknowledged', warning: error?.message || 'Processing completed with warnings' });
  }
});

app.post(['/api/relworx/initiate-disbursement', '/relworx/initiate-disbursement'], requireFirebaseAdmin, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Missing or invalid token' });
    }
    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch (authErr: any) {
      console.error('ID token verification failed for disbursement:', authErr?.message || authErr);
      return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token' });
    }
    const firestore = getFirestore();
    const userDoc = await firestore.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      return res.status(403).json({ success: false, message: 'Forbidden: User profile not found' });
    }
    const userData = userDoc.data();
    const userRole = userData?.role;
    const allowedRoles = ['super_admin', 'treasurer', 'chairperson', 'vice_chairperson'];
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions for disbursement' });
    }
    const { type, documentId, note } = req.body || {};
    if (!type || !documentId) {
      return res.status(400).json({ success: false, message: 'Missing required parameters: type or documentId' });
    }
    if (type !== 'welfare' && type !== 'expense') {
      return res.status(400).json({ success: false, message: 'Invalid type. Must be "welfare" or "expense"' });
    }
    let amount: number;
    let phoneNum: string;
    let network: string;
    let beneficiaryName: string | undefined;
    if (type === 'welfare') {
      const docRef = firestore.collection('welfareRequests').doc(documentId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        return res.status(400).json({ success: false, message: 'Welfare request not found' });
      }
      const data = docSnap.data();
      if (data?.status !== 'approved' && data?.status !== 'accepted') {
        return res.status(409).json({ success: false, message: 'Welfare request is not approved/accepted' });
      }
      if (data?.disbursementStatus === 'pending' || data?.disbursementStatus === 'successful' || data?.status === 'paid') {
         return res.status(409).json({ success: false, message: 'Disbursement already processing, successful or paid' });
      }
      if (!data?.amountRequested || !data?.recipientPhoneNumber) {
        return res.status(400).json({ success: false, message: 'Welfare request missing amount or recipient phone' });
      }
      amount = data.amountRequested;
      phoneNum = data.recipientPhoneNumber;
      network = data.recipientNetwork || 'MTN';
      beneficiaryName = data.recipientName || data.personName;
    } else {
      const docRef = firestore.collection('expenses').doc(documentId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        return res.status(400).json({ success: false, message: 'Expense request not found' });
      }
      const data = docSnap.data();
      if (data?.status !== 'approved' && data?.approvalStatus !== 'approved') {
         return res.status(409).json({ success: false, message: 'Expense request is not approved' });
      }
      if (data?.disbursementStatus === 'pending' || data?.disbursementStatus === 'successful' || data?.status === 'paid') {
         return res.status(409).json({ success: false, message: 'Disbursement already processing, successful or paid' });
      }
      if (!data?.amount || !data?.recipientPhoneNumber) {
        return res.status(400).json({ success: false, message: 'Expense missing amount or recipient phone' });
      }
      amount = data.amount;
      phoneNum = data.recipientPhoneNumber;
      network = data.recipientNetwork || 'MTN';
      beneficiaryName = data.recipientName;
    }
    const metadata = { type, documentId, note, beneficiaryName };
    const reference = documentId;
    const result = await initiateDisbursement(amount, phoneNum, network, reference, metadata);
    const updateData = {
      disbursementStatus: "pending",
      relworxDisbursementId: result.reference || result.data?.reference || null,
      updatedAt: Date.now()
    };
    if (type === 'welfare') {
       await firestore.collection('welfareRequests').doc(documentId).update(updateData);
    } else {
       await firestore.collection('expenses').doc(documentId).update(updateData);
    }
    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Initiate disbursement error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Internal server error' });
  }
});

app.all('*', (req, res) => {
  console.log(`[API Fallback] Handled request: ${req.method} ${req.path}`);
  return res.status(200).json({
    success: true,
    status: 'success',
    message: 'API server active and healthy.',
    path: req.path
  });
});

export default app;
