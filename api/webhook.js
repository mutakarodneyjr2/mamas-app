// api/webhook.js
// Note: This endpoint is created for compatibility/testing purposes.
// Primary production webhook handling is implemented in /api/server.ts at /api/relworx/webhook.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed. Use POST.' });
  }

  try {
    const paymentData = req.body;
    console.log('Received Relworx Payment Data:', paymentData);

    const reference = paymentData?.reference || paymentData?.transaction_id;
    const status = paymentData?.status;
    const amount = paymentData?.amount;

    if (status === 'SUCCESS' || status === 'successful') {
      console.log(`Transaction ${reference} for UGX ${amount} was processed successfully.`);
    }

    return res.status(200).json({
      status: 'success',
      message: 'Webhook received successfully by Matuumu Secondary School backend.'
    });
  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
}
