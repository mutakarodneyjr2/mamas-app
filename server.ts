import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, getDoc, query, where, doc, updateDoc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { Resend } from "resend";
import crypto from "crypto";
import {
  initiateCollection,
  initiateDisbursement,
  verifyWebhookSignature,
  handleCollectionWebhook,
  handleDisbursementWebhook
} from "./src/server/relworxService";


const firebaseConfig = {
  apiKey: "AIzaSyDkZQ-sp3W8qwCXfadZRsGbEnUezQlInFs",
  authDomain: "mama-alumin.firebaseapp.com",
  projectId: "mama-alumin",
  storageBucket: "mama-alumin.firebasestorage.app",
  messagingSenderId: "396635962310",
  appId: "1:396635962310:web:ae5ba06ec3c60f6ade90c7"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

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

  // Authenticate the backend as System Admin
  try {
    await signInWithEmailAndPassword(auth, 'system@mamas.local', 'SuperSecretSystem123!');
    console.log("Backend authenticated as System Admin");
  } catch (error) {
    console.error("Failed to authenticate backend:", error);
  }

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
      const rateQ = query(
        collection(db, "recoveryRequests"), 
        where("email", "==", emailLower)
      );
      const rateSnap = await getDocs(rateQ);
      const recentRequests = rateSnap.docs.filter(d => d.data().createdAt >= oneHourAgo);
      if (recentRequests.length >= 3) {
        return res.status(429).json({ error: "Too many recovery requests. Please try again later." });
      }

      const q = query(collection(db, "users"), where("email", "==", emailLower));
      const snap = await getDocs(q);
      
      const q2 = query(collection(db, "users"), where("recoveryEmail", "==", emailLower));
      const snap2 = await getDocs(q2);
      
      let userDoc = null;
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
      
      await setDoc(doc(db, "recoveryRequests", requestId), {
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
        from: 'MAMAS <noreply@resend.dev>', // Default resend testing email
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
      
      await setDoc(doc(db, "emailVerifications", requestId), {
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
      const reqDoc = await getDoc(doc(db, "emailVerifications", requestId));
      
      if (!reqDoc.exists()) return res.status(400).json({ error: "Invalid request" });
      const reqData = reqDoc.data();
      
      if (reqData.used || reqData.expiresAt < Date.now() || reqData.code !== code || reqData.uid !== uid) {
         return res.status(400).json({ error: "Invalid or expired code" });
      }

      await updateDoc(doc(db, "emailVerifications", requestId), { used: true });
      
      await updateDoc(doc(db, "users", uid), { 
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

      const q = query(collection(db, "recoveryRequests"), 
        where("email", "==", email.toLowerCase()),
        where("code", "==", code),
        where("used", "==", false)
      );
      
      const snap = await getDocs(q);
      const validReq = snap.docs.find(d => d.data().expiresAt > Date.now());

      if (!validReq) {
        return res.status(400).json({ error: "Invalid or expired recovery code" });
      }

      // Generate a temporary recovery token
      const recoveryToken = crypto.randomUUID();
      await updateDoc(doc(db, "recoveryRequests", validReq.id), {
        recoveryToken: recoveryToken
      });

      const userDoc = await getDoc(doc(db, "users", validReq.data().userId));
      const phoneNumber = userDoc.exists() ? userDoc.data().phoneNumber : '';

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

      const reqDoc = await getDoc(doc(db, "recoveryRequests", requestId));
      if (!reqDoc.exists()) return res.status(400).json({ error: "Invalid request" });
      
      const reqData = reqDoc.data();
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
         // It's a synthetic PIN account
         const emailLocalPart = email.split('@')[0];
         newPhoneNumber = "+" + emailLocalPart.split('_')[0].replace(/[^0-9]/g, ''); 
         // Assuming original phone was E.164, cleanPhone removes + but wait, it might be +256...
         // Let's just use the old user's phone number!
         hasPin = true;
      }

      const oldUid = reqData.userId;
      
      if (oldUid === newUid) {
         return res.json({ success: true });
      }

      const oldUserDoc = await getDoc(doc(db, "users", oldUid));
      if (!oldUserDoc.exists()) return res.status(404).json({ error: "User not found" });
      
      const oldUserData = oldUserDoc.data();
      // If setting a new PIN, keep the old phone number. If linking new phone, use newPhoneNumber.
      const finalPhoneNumber = hasPin ? oldUserData.phoneNumber : (newPhoneNumber || oldUserData.phoneNumber);
      
      const batch = writeBatch(db);

      // Create new user doc
      batch.set(doc(db, "users", newUid), {
        ...oldUserData,
        uid: newUid,
        phoneNumber: finalPhoneNumber,
        hasPin: hasPin ? true : oldUserData.hasPin,
        updatedAt: Date.now()
      });

      if (hasPin) {
        batch.set(doc(db, "pinEmails", finalPhoneNumber.replace(/[^a-zA-Z0-9+]/g, '')), {
          email: email
        });
      }

      // We cannot easily update all contributions/welfare in a batch without reading all first,
      // but we are super_admin so we can query and update.
      
      const contribQ = query(collection(db, "contributions"), where("userId", "==", oldUid));
      const contribSnap = await getDocs(contribQ);
      contribSnap.forEach(d => {
        batch.update(doc(db, "contributions", d.id), { userId: newUid });
      });

      const welfareQ = query(collection(db, "welfareRequests"), where("userId", "==", oldUid));
      const welfareSnap = await getDocs(welfareQ);
      welfareSnap.forEach(d => {
        batch.update(doc(db, "welfareRequests", d.id), { userId: newUid });
      });

      const expenseQ = query(collection(db, "expenses"), where("userId", "==", oldUid));
      const expenseSnap = await getDocs(expenseQ);
      expenseSnap.forEach(d => {
        batch.update(doc(db, "expenses", d.id), { userId: newUid });
      });

      await batch.commit();

      // Delete old user doc
      await deleteDoc(doc(db, "users", oldUid));

      // Mark request as used
      await updateDoc(doc(db, "recoveryRequests", requestId), { used: true });

      // Create activity log
      await setDoc(doc(collection(db, "activityLogs")), {
        action: "ACCOUNT_RECOVERED",
        adminId: "SYSTEM",
        targetId: newUid,
        details: `Account recovered. Phone number updated to ${newPhoneNumber}`,
        createdAt: Date.now()
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PIN Setup & Reset: Migrate data to new Email UID
  app.post("/api/pin-setup-migrate", async (req, res) => {
    try {
      const { newIdToken } = req.body;
      if (!newIdToken) {
        return res.status(400).json({ error: "Missing token" });
      }

      // Verify token using admin SDK
      const adminAuth = getAdminAuth();
      const newDecoded = await adminAuth.verifyIdToken(newIdToken);
      const newUid = newDecoded.uid;
      const email = newDecoded.email || "";

      if (!email.endsWith("@mama-alumin.local")) {
         return res.status(400).json({ error: "Invalid synthetic email." });
      }

      // Extract phone number from synthetic email
      const emailLocalPart = email.split('@')[0];
      const phoneNumber = emailLocalPart.split('_')[0]; // handles the _timestamp part

      // Find the current user document by phone number
      const usersQ = query(collection(db, "users"), where("phoneNumber", "==", phoneNumber));
      const usersSnap = await getDocs(usersQ);
      
      if (usersSnap.empty) {
         return res.status(404).json({ error: "User not found for this phone number." });
      }

      const oldUserDoc = usersSnap.docs[0];
      const oldUid = oldUserDoc.id;

      if (oldUid === newUid) {
         return res.json({ success: true });
      }

      const userData = oldUserDoc.data();
      const batch = writeBatch(db);

      // Create new user doc
      batch.set(doc(db, "users", newUid), {
        ...userData,
        uid: newUid,
        hasPin: true,
        updatedAt: Date.now()
      });

      // Write to pinEmails
      batch.set(doc(db, "pinEmails", phoneNumber), {
        email: email
      });

      // Update related records
      const contribQ = query(collection(db, "contributions"), where("userId", "==", oldUid));
      const contribSnap = await getDocs(contribQ);
      contribSnap.forEach(d => {
        batch.update(doc(db, "contributions", d.id), { userId: newUid });
      });

      const welfareQ = query(collection(db, "welfareRequests"), where("userId", "==", oldUid));
      const welfareSnap = await getDocs(welfareQ);
      welfareSnap.forEach(d => {
        batch.update(doc(db, "welfareRequests", d.id), { userId: newUid });
      });

      const expenseQ = query(collection(db, "expenses"), where("userId", "==", oldUid));
      const expenseSnap = await getDocs(expenseQ);
      expenseSnap.forEach(d => {
        batch.update(doc(db, "expenses", d.id), { userId: newUid });
      });

      await batch.commit();
      
      // Delete old user doc
      await deleteDoc(doc(db, "users", oldUid));

      res.json({ success: true });
    } catch (err: any) {
      console.error("PIN Migration error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Secure Directory Endpoint
  app.get("/api/directory", async (req, res) => {
    try {
      const q = query(collection(db, 'users'), where('status', '==', 'approved'));
      const snap = await getDocs(q);
      
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
      // In a real app, you would also verify the user's authentication token here
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
      // In a real app, verify authentication token and admin roles here
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
