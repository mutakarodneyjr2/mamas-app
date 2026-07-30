import crypto from 'crypto';
import { getFirestore } from 'firebase-admin/firestore';

const getDb = () => getFirestore();

/**
 * Validates the Relworx webhook signature.
 * @param signature - The signature from the X-Signature header
 * @param payload - The raw request body as a string
 * @param secret - The Relworx webhook secret
 */
export function verifyWebhookSignature(signature: string, payload: string, secret: string): boolean {
  if (!signature || !payload || !secret) return false;
  
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
      
    return signature === expectedSignature;
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

/**
 * Initiates a collection (Money In) via Relworx API.
 */
export async function initiateCollection(
  amount: number,
  phoneNumber: string,
  network: string,
  userId: string,
  metadata: any = {}
) {
  const apiKey = process.env.RELWORX_API_KEY;
  const merchantId = process.env.RELWORX_MERCHANT_ID;
  const url = process.env.RELWORX_COLLECTION_URL || 'https://api.relworx.com/v1/collections';

  if (!apiKey || !merchantId) {
    console.warn('RELWORX_API_KEY or RELWORX_MERCHANT_ID missing. API call may fail if required.');
  }

  const reference = metadata?.reference || `REF_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const payload = {
    amount,
    phone_number: phoneNumber,
    network,
    reference,
    merchant_id: merchantId,
    user_id: userId,
    ...metadata,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('Relworx initiateCollection API error:', response.status, data);
      throw new Error(data?.message || data?.error || `Relworx API error: HTTP ${response.status}`);
    }

    return data;
  } catch (error: any) {
    console.error('Failed to initiate collection with Relworx:', error);
    throw error;
  }
}

/**
 * Initiates a disbursement (Money Out) via Relworx API.
 */
export async function initiateDisbursement(
  amount: number,
  phoneNumber: string,
  network: string,
  reference: string,
  metadata: any = {}
) {
  const apiKey = process.env.RELWORX_API_KEY;
  const merchantId = process.env.RELWORX_MERCHANT_ID;
  const url = process.env.RELWORX_DISBURSEMENT_URL || 'https://api.relworx.com/v1/disbursements';

  if (!apiKey || !merchantId) {
    console.warn('RELWORX_API_KEY or RELWORX_MERCHANT_ID missing. API call may fail if required.');
  }

  const payload = {
    amount,
    phone_number: phoneNumber,
    network,
    reference,
    merchant_id: merchantId,
    ...metadata,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('Relworx initiateDisbursement API error:', response.status, data);
      throw new Error(data?.message || data?.error || `Relworx API error: HTTP ${response.status}`);
    }

    return data;
  } catch (error: any) {
    console.error('Failed to initiate disbursement with Relworx:', error);
    throw error;
  }
}

/**
 * Processes a collection webhook payload from Relworx.
 */
export async function handleCollectionWebhook(payload: any) {
  console.log(`[Relworx Placeholder] Handling collection webhook:`, payload);
  
  const status = payload.status; // e.g., 'successful', 'failed'
  const reference = payload.reference; 
  const transactionId = payload.transactionId;
  const amount = payload.amount;
  
  // 1. Log the transaction in the 'transactions' collection for full audit
  const txRef = getDb().collection('transactions').doc(transactionId || `tx_${Date.now()}`);
  await txRef.set({
    id: txRef.id,
    type: 'collection',
    relatedId: reference,
    amount: amount || 0,
    reference: reference || '',
    internalReference: payload.internalReference || '',
    status: status || 'unknown',
    gatewayResponse: payload,
    updatedAt: Date.now(),
    createdAt: Date.now() // Ideally use actual timestamp from payload
  }, { merge: true });

  // 2. Query Firestore for the corresponding contribution
  if (reference) {
    const contributionsRef = getDb().collection('contributions');
    const q = contributionsRef.where('relworxReference', '==', reference).limit(1);
    const snapshot = await q.get();
    
    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      const docRef = docSnap.ref;
      
      try {
        await getDb().runTransaction(async (transaction) => {
          const contribDoc = await transaction.get(docRef);
          if (!contribDoc.exists) return;
          
          const contribData = contribDoc.data();
          if (!contribData) return;
          
          // Only process if it's not already verified
          if (contribData.status === 'verified') return;
          
          const updateData: any = {
            paymentStatus: status === 'successful' ? 'verified' : status === 'failed' ? 'failed' : 'pending_payment',
            gatewayResponse: payload,
            relworxTransactionId: transactionId,
            updatedAt: Date.now()
          };
          
          if (status === 'successful') {
            updateData.paidAt = Date.now();
            updateData.status = 'verified';
            updateData.verifiedBy = 'RELWORX_WEBHOOK';
            updateData.verifiedAt = Date.now();

            // Update user stats
            if (contribData.userId) {
              const userRef = getDb().collection('users').doc(contribData.userId);
              const userDoc = await transaction.get(userRef);
              
              if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData) {
                  const newTotalContributed = contribData.type === 'welfare' 
                    ? (userData.totalContributed || 0) + (contribData.amount || 0)
                    : (userData.totalContributed || 0);

                  const newCampaignContributed = contribData.type === 'school_support'
                    ? (userData.totalCampaignContributed || 0) + (contribData.amount || 0)
                    : (userData.totalCampaignContributed || 0);

                  transaction.update(userRef, {
                    totalContributed: newTotalContributed,
                    totalCampaignContributed: newCampaignContributed,
                    lastContributionDate: Date.now(),
                    contributionStatus: "active",
                    updatedAt: Date.now()
                  });
                }
              }
            }
            
            // Update campaign stats if applicable
            if (contribData.type === 'school_support' && contribData.campaignId) {
              const campaignRef = getDb().collection('schoolCampaigns').doc(contribData.campaignId);
              const campaignDoc = await transaction.get(campaignRef);
              
              if (campaignDoc.exists) {
                const campaignData = campaignDoc.data();
                if (campaignData) {
                  const newRaisedAmount = (campaignData.raisedAmount || 0) + (contribData.amount || 0);
                  const campUpdates: any = {
                    raisedAmount: newRaisedAmount,
                    updatedAt: Date.now()
                  };
                  
                  if (campaignData.targetAmount > 0 && newRaisedAmount >= campaignData.targetAmount && campaignData.status === 'active') {
                    campUpdates.status = 'fully_funded';
                  }
                  
                  transaction.update(campaignRef, campUpdates);
                }
              }
            }
          }
          
          transaction.update(docRef, updateData);
        });
        
        // 3. Trigger activity log outside the transaction
        await getDb().collection('activityLogs').add({
          action: 'RELWORX_COLLECTION',
          adminId: 'SYSTEM',
          targetId: docSnap.id,
          details: `Relworx collection webhook received. Status: ${status}`,
          createdAt: Date.now()
        });

        if (status === 'successful') {
          const contribData = docSnap.data();
          if (contribData?.userId) {
            await getDb().collection('notifications').add({
              userId: contribData.userId,
              title: "Payment Received",
              body: `Your mobile money payment of UGX ${new Intl.NumberFormat('en-UG').format(contribData.amount || 0)} was successful. Thank you!`,
              type: "system",
              targetUrl: "/statement",
              read: false,
              createdAt: Date.now()
            });
          }
        }
      } catch (err) {
        console.error("Transaction failed for Relworx collection:", err);
      }
    }
  }

  return { success: true };
}

/**
 * Processes a disbursement webhook payload from Relworx.
 */
export async function handleDisbursementWebhook(payload: any) {
  console.log(`[Relworx Placeholder] Handling disbursement webhook:`, payload);
  
  const status = payload.status; // e.g., 'successful', 'failed'
  const reference = payload.reference; // Usually tied to expense/welfare request ID
  const disbursementId = payload.disbursementId;
  const amount = payload.amount;
  
  // 1. Log the transaction in 'transactions' collection
  const txRef = getDb().collection('transactions').doc(disbursementId || `disb_${Date.now()}`);
  await txRef.set({
    id: txRef.id,
    type: 'disbursement',
    relatedId: reference,
    amount: amount || 0,
    reference: reference || '',
    internalReference: payload.internalReference || '',
    status: status || 'unknown',
    gatewayResponse: payload,
    updatedAt: Date.now(),
    createdAt: Date.now()
  }, { merge: true });

  // 2. Query Firestore to update the corresponding Expense or Welfare Request
  if (reference) {
    // Check Expenses first
    const expenseRef = getDb().collection('expenses').doc(reference);
    const expenseDoc = await expenseRef.get();
    
    if (expenseDoc.exists) {
      const updateData: any = {
        disbursementStatus: status === 'successful' ? 'paid' : status === 'failed' ? 'failed' : 'processing',
        gatewayResponse: payload,
        relworxDisbursementId: disbursementId
      };
      
      if (status === 'successful') {
        updateData.paidAt = Date.now();
        updateData.status = 'paid'; // Update main status too
        
        const expenseData = expenseDoc.data();
        if (expenseData) {
          // Record public money-out
          const moneyOutRef = getDb().collection('moneyOut').doc();
          await moneyOutRef.set({
            id: moneyOutRef.id,
            type: "expense",
            amount: expenseData.amount || 0,
            reason: expenseData.reason || 'Expense Payout',
            beneficiaryName: expenseData.recipientName || 'General Expense',
            transactionReference: reference,
            approvedBy: 'SYSTEM_RELWORX',
            createdAt: Date.now()
          });

          await getDb().collection('notifications').add({
            userId: 'ALL_APPROVED',
            title: "Association Expense Paid",
            body: `An expense for ${expenseData.reason} (UGX ${new Intl.NumberFormat('en-UG').format(expenseData.amount || 0)}) was paid.`,
            type: "system",
            targetUrl: "/money-out",
            read: false,
            createdAt: Date.now()
          });
        }
      }
      
      await expenseRef.update(updateData);
      
      // 3. Trigger activity log
      await getDb().collection('activityLogs').add({
        action: 'RELWORX_DISBURSEMENT_EXPENSE',
        adminId: 'SYSTEM',
        targetId: reference,
        details: `Relworx disbursement webhook received. Status: ${status}`,
        createdAt: Date.now()
      });
      
      return { success: true };
    }
    
    // Check Welfare Requests
    const welfareRef = getDb().collection('welfareRequests').doc(reference);
    const welfareDoc = await welfareRef.get();
    
    if (welfareDoc.exists) {
      const updateData: any = {
        disbursementStatus: status === 'successful' ? 'paid' : status === 'failed' ? 'failed' : 'processing',
        gatewayResponse: payload,
        relworxDisbursementId: disbursementId
      };
      
      if (status === 'successful') {
        updateData.paidAt = Date.now();
        updateData.status = 'paid'; // Update main status too
        
        const welfareData = welfareDoc.data();
        if (welfareData) {
          // Record public money-out
          const moneyOutRef = getDb().collection('moneyOut').doc();
          await moneyOutRef.set({
            id: moneyOutRef.id,
            type: "welfare",
            amount: welfareData.amountRequested || 0,
            reason: `Welfare Payout: ${welfareData.category || ''}`,
            beneficiaryName: welfareData.personName || 'Unknown Member',
            transactionReference: reference,
            approvedBy: 'SYSTEM_RELWORX',
            createdAt: Date.now()
          });

          await getDb().collection('notifications').add({
            userId: 'ALL_APPROVED',
            title: "Welfare Payout Disbursed",
            body: `A welfare payout of UGX ${new Intl.NumberFormat('en-UG').format(welfareData.amountRequested || 0)} for ${welfareData.personName} was completed.`,
            type: "system",
            targetUrl: "/welfare",
            read: false,
            createdAt: Date.now()
          });
          
          if (welfareData.userId) {
             await getDb().collection('notifications').add({
              userId: welfareData.userId,
              title: "Your Welfare Request Paid",
              body: `Your welfare request payout of UGX ${new Intl.NumberFormat('en-UG').format(welfareData.amountRequested || 0)} was successfully processed.`,
              type: "welfare_update",
              targetUrl: "/apply-welfare",
              read: false,
              createdAt: Date.now()
            });
          }
        }
      }
      
      await welfareRef.update(updateData);
      
      // Trigger activity log
      await getDb().collection('activityLogs').add({
        action: 'RELWORX_DISBURSEMENT_WELFARE',
        adminId: 'SYSTEM',
        targetId: reference,
        details: `Relworx disbursement webhook received. Status: ${status}`,
        createdAt: Date.now()
      });
    }
  }

  return { success: true };
}
