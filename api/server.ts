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
  if (getApps().length) return; // already initialized

  const base64ServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!base64ServiceAccount) {
    firebaseInitError = new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is required');
    console.error('Firebase Admin init failed:', firebaseInitError.message);
    throw firebaseInitError;
  }

  try {
    const serviceAccountJson = Buffer.from(base64ServiceAccount, 'base64').toString('utf8');
    const serviceAccount = JSON.parse(serviceAccountJson);

    initializeApp({
      credential: cert(serviceAccount),
    });

    console.log(`Firebase Admin initialized successfully for: ${serviceAccount.client_email}`);
  } catch (error: any) {
    firebaseInitError = new Error(`Failed to initialize Firebase Admin: ${error.message}`);
    console.error('Firebase Admin init error:', error);
    throw firebaseInitError;
  }
}

// Import handlers from relworxService
import {
  initiateCollection,
  initiateDisbursement,
  handleCollectionWebhook,
  handleDisbursementWebhook,
  verifyWebhookSignature,
} from '../src/server/relworxService';

const app = express();

app.use(cors({ origin: true, credentials: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now(), service: 'mamas-api' });
});

// Middleware to ensure Firebase Admin is initialized
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

// Middleware for JSON parsing on standard endpoint routes
app.use('/api/relworx/initiate-collection', express.json());
app.use('/api/relworx/initiate-disbursement', express.json());
app.use('/api/notifications/send', express.json());

// Webhook route MUST use express.raw({type: 'application/json'}) middleware to preserve raw body for HMAC verification
app.use('/api/relworx/webhook', express.raw({ type: 'application/json' }));

// 0. POST /api/notifications/send - Send real FCM push notifications & write in-app notification doc
app.post('/api/notifications/send', requireFirebaseAdmin, async (req, res) => {
  try {
    const { userId, title, body, type, targetId, targetUrl } = req.body || {};

    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'Missing title or body' });
    }

    const firestore = getFirestore();
    const messaging = getMessaging();

    // 1. Save in-app notification doc in Firestore
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

    // 2. Fetch recipient FCM tokens
    let tokens: string[] = [];

    if (userId === 'ALL_APPROVED') {
      const snap = await firestore.collection('users').where('status', '==', 'approved').get();
      snap.forEach(docSnap => {
        const uData = docSnap.data();
        if (Array.isArray(uData.fcmTokens)) {
          tokens.push(...uData.fcmTokens);
        }
      });
    } else if (Array.isArray(userId)) {
      for (const uid of userId) {
        if (!uid) continue;
        const uDoc = await firestore.collection('users').doc(uid).get();
        if (uDoc.exists) {
          const uData = uDoc.data();
          if (uData && Array.isArray(uData.fcmTokens)) {
            tokens.push(...uData.fcmTokens);
          }
        }
      }
    } else if (userId && typeof userId === 'string') {
      const uDoc = await firestore.collection('users').doc(userId).get();
      if (uDoc.exists) {
        const uData = uDoc.data();
        if (uData && Array.isArray(uData.fcmTokens)) {
          tokens.push(...uData.fcmTokens);
        }
      }
    }

    // Deduplicate valid tokens
    tokens = Array.from(new Set(tokens.filter(t => typeof t === 'string' && t.trim().length > 0)));

    let successCount = 0;
    let failureCount = 0;

    if (tokens.length > 0) {
      try {
        const response = await messaging.sendEachForMulticast({
          tokens,
          notification: {
            title,
            body
          },
          data: {
            title,
            body,
            type: type || 'notice',
            targetId: targetId || '',
            targetUrl: targetUrl || '/'
          }
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

// 1. POST /api/relworx/initiate-collection
app.post('/api/relworx/initiate-collection', requireFirebaseAdmin, async (req, res) => {
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

    // Update Firestore contribution document with relworxReference if contributionId exists
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

    return res.json({
      success: true,
      relworxReference: relworxReference || null,
      data: result
    });
  } catch (error: any) {
    console.error('Initiate collection error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Internal server error' });
  }
});

// 2. POST /api/relworx/webhook
// INSTRUCTION: After deploying to Vercel, the Relworx webhook URL must be set to:
// https://YOUR-VERCEL-DOMAIN.vercel.app/api/relworx/webhook
app.post('/api/relworx/webhook', requireFirebaseAdmin, async (req, res) => {
  try {
    const signature = req.headers['x-signature'] as string;
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body);

    if (!signature) {
      return res.status(401).json({ success: false, message: 'Missing signature header' });
    }

    const secret = process.env.RELWORX_WEBHOOK_SECRET || '';
    if (!secret) {
      console.warn('RELWORX_WEBHOOK_SECRET is not configured');
    }

    const isValid = verifyWebhookSignature(signature, rawBody, secret);
    if (!isValid && secret) {
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }

    const payload = typeof req.body === 'string' || Buffer.isBuffer(req.body)
      ? JSON.parse(rawBody)
      : req.body;

    if (payload.transaction_type === 'collection' || payload.type === 'collection') {
      await handleCollectionWebhook(payload);
    } else if (payload.transaction_type === 'disbursement' || payload.type === 'disbursement') {
      await handleDisbursementWebhook(payload);
    } else {
      if (payload.reference && payload.reference.startsWith('DISB')) {
        await handleDisbursementWebhook(payload);
      } else {
        await handleCollectionWebhook(payload);
      }
    }

    return res.json({ success: true, message: 'Webhook processed successfully' });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Internal server error' });
  }
});

// 3. POST /api/relworx/initiate-disbursement
app.post('/api/relworx/initiate-disbursement', requireFirebaseAdmin, async (req, res) => {
  try {
    const { amount, phoneNumber, network, reference, metadata } = req.body || {};

    if (!amount || !phoneNumber || !network || !reference) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    const result = await initiateDisbursement(amount, phoneNumber, network, reference, metadata || {});
    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Initiate disbursement error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Internal server error' });
  }
});

export default app;
// Vercel deployment configurations applied.
