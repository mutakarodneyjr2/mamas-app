import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initializeApp as initAdmin, getApps, cert } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { Resend } from "resend";
import crypto from "crypto";
import {
  initiateCollection,
  initiateDisbursement,
  verifyWebhookSignature,
  handleCollectionWebhook,
  handleDisbursementWebhook
} from "./src/server/relworxService";

if (!getApps().length) {
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountEnv) {
    try {
      let serviceAccount = JSON.parse(serviceAccountEnv);
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      initAdmin({
        credential: cert(serviceAccount)
      });
      console.log("Firebase Admin initialized successfully with FIREBASE_SERVICE_ACCOUNT.");
    } catch (err) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:", err);
      try {
        initAdmin();
      } catch (defaultErr) {
        console.error("Failed to initialize Firebase Admin with default credentials:", defaultErr);
      }
    }
  } else {
    console.warn("FIREBASE_SERVICE_ACCOUNT is not set. Initializing Firebase Admin with default credentials.");
    try {
      initAdmin();
    } catch (defaultErr) {
      console.error("Failed to initialize Firebase Admin with default credentials:", defaultErr);
    }
  }
}

const db = getAdminFirestore();

let resendClient: Resend | null = null;
function getResend() {
  if (!resendClient) {
    const key = process.env.RESEND_API_KEY;
    if (key) {
      resendClient = new Resend(key);
    } else {
      console.warn("RESEND_API_KEY is not set. Emails will not be sent.");
    }
  }
  return resendClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Account Recovery: Request Code
  app.post("/api/recovery/request", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });

      const emailLower = email.toLowerCase();

      // Rate limiting: max 3 requests per hour
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const rateSnap = await db.collection("recoveryRequests")
        .where("email", "==", emailLower)
        .get();
      
      const recentRequests = rateSnap.docs.filter(d => d.data().createdAt >= oneHourAgo);
      if (recentRequests.length >= 3) {
        return res.status(429).json({ error: "Too many recovery requests. Please try again later." });
      }

      const snap = await db.collection("users").where("email", "==", emailLower).get();
      const snap2 = await db.collection("users").where("recoveryEmail", "==", emailLower).get();
      
      let userDoc: any = null;
      if (!snap.empty) userDoc = snap.docs[0];
      else if (!snap2.empty) userDoc = snap2.docs[0];

      if (!userDoc) {
        // Return success even if not found to prevent email enumeration
        return res.json({ success: true, message: "If this email is registered, a recovery code was sent." });
      }

      const userData = userDoc.data();
      
      // Generate 6 digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const requestId = crypto.randomUUID();
      
      await db.collection("recoveryRequests").doc(requestId).set({
        id: requestId,
        email: email.toLowerCase(),
        userId: userDoc.id,
        code: code,
        expiresAt: Date.now() + 15 * 60 * 1000, // 15 mins
        used: false,
        createdAt: Date.now()
      });

      const resend = getResend();
      if (!resend) {
        throw new Error("Email service is not configured.");
      }

      const { data, error } = await resend.emails.send({
        from: 'MAMAS <noreply@resend.dev>',
        to: email,
        subject: "MAMAS Account Recovery Code",
        text: `Hello ${userData.fullName},\n\nYou requested to recover your Matuumu Alumni Mutual Aid Association (MAMAS) account.\n\nYour recovery code is:\n\n${code}\n\nThis code will expire in 15 minutes.\n\nIf you did not request this, please ignore this email.\n\n— The MAMAS Team`,
      });

      if (error) {
        console.error("Resend error:", error);
        return res.status(500).json({ error: "Failed to send recovery email. Please try again later." });
      }

      console.log(`Recovery code sent to ${email}. ID: ${data?.id}`);
      res.json({ success: true, message: "Recovery code sent!" });
    } catch (err: any) {
      console.error("Recovery request error:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  // Profile: Request Email Verification
  app.post("/api/profile/email/request", async (req, res) => {
    try {
      const { email, uid } = req.body;
      if (!email || !uid) return res.status(400).json({ error: "Email and uid required" });

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const requestId = crypto.randomUUID();
      
      await db.collection("emailVerifications").doc(requestId).set({
        id: requestId,
        email: email.toLowerCase(),
        uid: uid,
        code: code,
        expiresAt: Date.now() + 15 * 60 * 1000,
        used: false
      });

      const resend = getResend();
      if (!resend) throw new Error("Email service not configured.");

      const { error } = await resend.emails.send({
        from: 'MAMAS <noreply@resend.dev>',
        to: email,
        subject: "Verify your email",
        text: `Your MAMAS email verification code is: ${code}\n\nIt expires in 15 minutes.`
      });

      if (error) {
         return res.status(500).json({ error: "Failed to send email" });
      }

      res.json({ success: true, requestId });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  // Profile: Verify Email Code
  app.post("/api/profile/email/verify", async (req, res) => {
    try {
      const { requestId, code, uid } = req.body;
      const reqDoc = await db.collection("emailVerifications").doc(requestId).get();
      
      if (!reqDoc.exists) return res.status(400).json({ error: "Invalid request" });
      const reqData = reqDoc.data()!;
      
      if (reqData.used || reqData.expiresAt < Date.now() || reqData.code !== code || reqData.uid !== uid) {
         return res.status(400).json({ error: "Invalid or expired code" });
      }

      await db.collection("emailVerifications").doc(requestId).update({ used: true });
      
      await db.collection("users").doc(uid).update({ 
        recoveryEmail: reqData.email,
        recoveryEmailVerified: true 
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Account Recovery: Verify Code
  app.post("/api/recovery/verify", async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) return res.status(400).json({ error: "Email and code required" });

      const snap = await db.collection("recoveryRequests")
        .where("email", "==", email.toLowerCase())
        .where("code", "==", code)
        .where("used", "==", false)
        .get();
            
      const validReq = snap.docs.find(d => d.data().expiresAt > Date.now());
      if (!validReq) {
        return res.status(400).json({ error: "Invalid or expired recovery code" });
      }

      // Generate a temporary recovery token
      const recoveryToken = crypto.randomUUID();
      await db.collection("recoveryRequests").doc(validReq.id).update({
        recoveryToken: recoveryToken
      });

      const userDoc = await db.collection("users").doc(validReq.data().userId).get();
      const phoneNumber = userDoc.exists ? userDoc.data()?.phoneNumber : '';

      res.json({ success: true, recoveryToken, requestId: validReq.id, phoneNumber });
    } catch (err: any) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Account Recovery: Complete Data Migration
  app.post("/api/recovery/complete", async (req, res) => {
    try {
      const { requestId, recoveryToken, newIdToken } = req.body;
      if (!newIdToken) return res.status(400).json({ error: "Missing token" });

      const reqDoc = await db.collection("recoveryRequests").doc(requestId).get();
      if (!reqDoc.exists) return res.status(400).json({ error: "Invalid request" });
      
      const reqData = reqDoc.data()!;
      if (reqData.used || reqData.recoveryToken !== recoveryToken) {
        return res.status(400).json({ error: "Invalid or used recovery token" });
      }

      const adminAuth = getAdminAuth();
      const newDecoded = await adminAuth.verifyIdToken(newIdToken);
      const newUid = newDecoded.uid;
      
      let newPhoneNumber = newDecoded.phone_number;
      let email = newDecoded.email || "";
      let hasPin = false;

      if (email.endsWith("@mama-alumin.local")) {
         const emailLocalPart = email.split('@')[0];
         newPhoneNumber = "+" + emailLocalPart.split('_')[0].replace(/[^0-9]/g, ''); 
         hasPin = true;
      }

      const oldUid = reqData.userId;
      if (oldUid === newUid) {
         return res.json({ success: true });
      }

      const oldUserDoc = await db.collection("users").doc(oldUid).get();
      if (!oldUserDoc.exists) return res.status(404).json({ error: "User not found" });
      
      const oldUserData = oldUserDoc.data()!;
      const finalPhoneNumber = hasPin ? oldUserData.phoneNumber : (newPhoneNumber || oldUserData.phoneNumber);
      
      const batch = db.batch();

      // Create new user doc
      batch.set(db.collection("users").doc(newUid), {
        ...oldUserData,
        uid: newUid,
        phoneNumber: finalPhoneNumber,
        hasPin: hasPin ? true : oldUserData.hasPin,
        updatedAt: Date.now()
      });

      if (hasPin) {
        batch.set(db.collection("pinEmails").doc(finalPhoneNumber.replace(/[^a-zA-Z0-9+]/g, '')), {
          email: email
        });
      }

      const contribSnap = await db.collection("contributions").where("userId", "==", oldUid).get();
      contribSnap.forEach(d => {
        batch.update(db.collection("contributions").doc(d.id), { userId: newUid });
      });

      const welfareSnap = await db.collection("welfareRequests").where("userId", "==", oldUid).get();
      welfareSnap.forEach(d => {
        batch.update(db.collection("welfareRequests").doc(d.id), { userId: newUid });
      });

      const expenseSnap = await db.collection("expenses").where("userId", "==", oldUid).get();
      expenseSnap.forEach(d => {
        batch.update(db.collection("expenses").doc(d.id), { userId: newUid });
      });

      await batch.commit();

      // Delete old user doc
      await db.collection("users").doc(oldUid).delete();

      // Mark request as used
      await db.collection("recoveryRequests").doc(requestId).update({ used: true });

      // Create activity log
      await db.collection("activityLogs").doc().set({
        action: "ACCOUNT_RECOVERED",
        adminId: "SYSTEM",
        targetId: newUid,
        details: `Account recovered. Phone number updated to ${finalPhoneNumber}`,
        createdAt: Date.now()
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  function normalizePhoneServer(phone: string): string {
    if (!phone) return '';
    let cleaned = String(phone).trim();
    if (cleaned.startsWith('0')) {
      cleaned = '+256' + cleaned.substring(1);
    } else if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    const hasPlus = cleaned.startsWith('+');
    const digitsOnly = cleaned.replace(/[^0-9]/g, '');
    return hasPlus ? '+' + digitsOnly : digitsOnly;
  }

  const PIN_SALT = "MAMAS_SECURE_SALT_2026";
  function hashPinServer(pin: string): string {
    return crypto.createHash('sha256').update(pin + PIN_SALT).digest('hex');
  }

  // Secure Backend PIN Setup / Reset
  async function handlePinSetup(req: any, res: any) {
    try {
      const { idToken, newIdToken, phoneNumber, pin } = req.body;
      const tokenToVerify = idToken || newIdToken;
      if (!tokenToVerify) {
        return res.status(400).json({ error: "Missing authentication token" });
      }

      if (!pin || pin.length < 4 || pin.length > 6) {
        return res.status(400).json({ error: "PIN must be between 4 and 6 digits" });
      }

      const adminAuth = getAdminAuth();
      let decodedToken;
      try {
        decodedToken = await adminAuth.verifyIdToken(tokenToVerify);
      } catch (tokenErr: any) {
        console.error("Token verification error in PIN setup:", tokenErr);
        return res.status(401).json({ error: "Authentication token verification failed: " + tokenErr.message });
      }

      const uid = decodedToken.uid;
      const email = decodedToken.email || "";

      let normalizedPhone = "";
      if (phoneNumber) {
        normalizedPhone = normalizePhoneServer(phoneNumber);
      } else if (email.endsWith("@mama-alumin.local")) {
        const emailLocalPart = email.split('@')[0];
        const rawPhone = emailLocalPart.split('_')[0];
        normalizedPhone = normalizePhoneServer(rawPhone);
      }

      if (!normalizedPhone) {
        try {
          const userDoc = await db.collection("users").doc(uid).get();
          if (userDoc.exists && userDoc.data()?.phoneNumber) {
            normalizedPhone = normalizePhoneServer(userDoc.data()?.phoneNumber);
          }
        } catch (getErr) {
          console.warn("Server cannot read user document directly:", getErr);
        }
      }

      if (!normalizedPhone) {
        return res.status(400).json({ error: "Phone number is required for PIN setup." });
      }

      const pinHash = hashPinServer(pin);

      try {
        // Update user doc in Firestore using Admin SDK
        await db.collection("users").doc(uid).set({
          phoneNumber: normalizedPhone,
          pinHash,
          hasPin: true,
          pinUpdatedAt: Date.now(),
          failedPinAttempts: 0,
          pinLockedUntil: null
        }, { merge: true });

        // Update pinEmails mapping to point to uid
        await db.collection("pinEmails").doc(normalizedPhone).set({
          uid,
          updatedAt: Date.now()
        }, { merge: true });

        return res.json({ success: true });
      } catch (dbErr: any) {
        console.warn("Firebase Admin SDK Firestore write unavailable on server:", dbErr.message);
        // Indicate to client that server write failed due to permissions, so client fallback should run
        return res.status(200).json({ 
          success: false, 
          fallbackClient: true, 
          error: dbErr.message 
        });
      }
    } catch (err: any) {
      console.error("PIN Setup / Reset internal error:", err);
      res.status(500).json({ error: err.message || "Internal server error during PIN setup." });
    }
  }

  // Secure Backend PIN Verify & Login
  app.post("/api/pin/verify", async (req, res) => {
    try {
      const { phoneNumber, pin } = req.body;
      if (!phoneNumber || !pin) {
        return res.status(400).json({ error: "Phone number and PIN are required" });
      }

      const normalizedPhone = normalizePhoneServer(phoneNumber);
      const cleanPhone = normalizedPhone.replace(/[^a-zA-Z0-9+]/g, '');

      // Look up uid from pinEmails or users collection
      let uid = "";
      let pinEmailDoc = await db.collection("pinEmails").doc(normalizedPhone).get();
      if (!pinEmailDoc.exists) {
        pinEmailDoc = await db.collection("pinEmails").doc(cleanPhone).get();
      }

      if (pinEmailDoc.exists && pinEmailDoc.data()?.uid) {
        uid = pinEmailDoc.data()?.uid;
      } else {
        // Fallback: search users by phoneNumber
        let usersSnap = await db.collection("users").where("phoneNumber", "==", normalizedPhone).get();
        if (usersSnap.empty) {
          usersSnap = await db.collection("users").where("phoneNumber", "==", phoneNumber).get();
        }
        if (!usersSnap.empty) {
          uid = usersSnap.docs[0].id;
        }
      }

      if (!uid) {
        return res.status(401).json({ error: "Invalid phone number or PIN." });
      }

      const userDoc = await db.collection("users").doc(uid).get();
      if (!userDoc.exists) {
        return res.status(401).json({ error: "Invalid phone number or PIN." });
      }

      const userData = userDoc.data() || {};
      
      // Check lockout
      if (userData.pinLockedUntil && userData.pinLockedUntil > Date.now()) {
        const minutesLeft = Math.ceil((userData.pinLockedUntil - Date.now()) / 60000);
        return res.status(401).json({ error: `Account locked. Try again in ${minutesLeft} minutes.` });
      }

      const storedHash = userData.pinHash;
      if (!storedHash) {
        return res.status(401).json({ error: "No PIN set for this number. Please register or log in with SMS." });
      }

      const incomingHash = hashPinServer(pin);
      if (incomingHash !== storedHash) {
        const attempts = (userData.failedPinAttempts || 0) + 1;
        const updates: any = { failedPinAttempts: attempts };
        if (attempts >= 5) {
          updates.pinLockedUntil = Date.now() + 15 * 60 * 1000; // 15 mins lock
        }
        await db.collection("users").doc(uid).update(updates);
        return res.status(401).json({ error: "Invalid phone number or PIN." });
      }

      // Success: reset attempts, issue custom token
      await db.collection("users").doc(uid).update({
        failedPinAttempts: 0,
        pinLockedUntil: null
      });

      const adminAuth = getAdminAuth();
      const customToken = await adminAuth.createCustomToken(uid);

      res.json({ success: true, customToken });
    } catch (err: any) {
      console.error("PIN verification internal error:", err);
      res.status(500).json({ error: err.message || "Internal server error during PIN verification." });
    }
  });

  app.post("/api/pin/setup", handlePinSetup);
  app.post("/api/pin/reset", handlePinSetup);
  app.post("/api/pin-setup-migrate", handlePinSetup);

  // Secure Directory Endpoint
  app.get("/api/directory", async (req, res) => {
    try {
      const snap = await db.collection('users').where('status', '==', 'approved').get();
      
      const publicMembers = snap.docs.map(doc => {
        const data = doc.data();
        
        // Base public fields
        const publicData: any = {
          uid: data.uid || doc.id,
          fullName: data.fullName || '',
          profilePictureUrl: data.profilePictureUrl || '',
          yearLeftSchool: data.yearLeftSchool || '',
          district: data.district || '',
          occupation: data.occupation || '',
          placeOfResidence: data.placeOfResidence || '',
          privacySettings: data.privacySettings || { showPhone: false, showEmail: false }
        };

        // Conditionally include private fields based on privacySettings
        if (data.privacySettings?.showPhone && data.phoneNumber) {
          publicData.phoneNumber = data.phoneNumber;
        }
        if (data.privacySettings?.showEmail && data.email) {
          publicData.email = data.email;
        }
        return publicData;
      });
      res.json(publicMembers);
    } catch (error) {
      console.error("Error fetching directory:", error);
      res.status(500).json({ error: "Failed to fetch directory" });
    }
  });

  // =========================================
  // RELWORX WEBHOOKS & API
  // =========================================

  app.post("/api/relworx/initiate-collection", async (req, res) => {
    try {
      const { amount, phoneNumber, network, userId, metadata } = req.body;
      
      if (!amount || !phoneNumber || !userId) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const result = await initiateCollection(amount, phoneNumber, network, userId, metadata);
      res.json(result);
    } catch (error: any) {
      console.error("Error initiating collection:", error);
      res.status(500).json({ error: error.message || "Failed to initiate collection" });
    }
  });

  app.post("/api/relworx/initiate-disbursement", async (req, res) => {
    try {
      const { amount, phoneNumber, network, reference, metadata } = req.body;
      
      if (!amount || !phoneNumber || !reference) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const result = await initiateDisbursement(amount, phoneNumber, network, reference, metadata);
      res.json(result);
    } catch (error: any) {
      console.error("Error initiating disbursement:", error);
      res.status(500).json({ error: error.message || "Failed to initiate disbursement" });
    }
  });

  app.post("/api/relworx/collection-webhook", async (req, res) => {
    try {
      const signature = req.headers['x-signature'] as string;
      const payloadString = JSON.stringify(req.body);
      const secret = process.env.RELWORX_WEBHOOK_SECRET || '';
      if (secret && !verifyWebhookSignature(signature, payloadString, secret)) {
        console.warn("Invalid webhook signature for collection");
        return res.status(401).json({ error: "Invalid signature" });
      }
      await handleCollectionWebhook(req.body);
      res.status(200).send("OK");
    } catch (error: any) {
      console.error("Error handling collection webhook:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  app.post("/api/relworx/disbursement-webhook", async (req, res) => {
    try {
      const signature = req.headers['x-signature'] as string;
      const payloadString = JSON.stringify(req.body);
      const secret = process.env.RELWORX_WEBHOOK_SECRET || '';
      if (secret && !verifyWebhookSignature(signature, payloadString, secret)) {
        console.warn("Invalid webhook signature for disbursement");
        return res.status(401).json({ error: "Invalid signature" });
      }
      await handleDisbursementWebhook(req.body);
      res.status(200).send("OK");
    } catch (error: any) {
      console.error("Error handling disbursement webhook:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  // 404 handler for unknown API routes
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: "API endpoint not found" });
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    // Fallback for SPA routing in development
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const templatePath = path.resolve(process.cwd(), 'index.html');
        let template = fs.readFileSync(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
