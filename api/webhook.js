// api/webhook.js
// Note: This endpoint is created for compatibility/testing purposes.
// Primary production webhook handling is implemented in /api/server.ts at /api/relworx/webhook.

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ status: 'success', message: 'Webhook endpoint is active and healthy.' });
  }

  try {
    const paymentData = req.body || {};
    console.log('Received Relworx Payment Data:', paymentData);

    return res.status(200).json({
      status: 'success',
      message: 'Webhook received successfully by Matuumu Secondary School backend.'
    });
  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(200).json({ status: 'acknowledged', message: error.message });
  }
}
