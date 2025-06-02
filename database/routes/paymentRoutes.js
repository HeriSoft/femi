import express from 'express';
import { authenticateJWT } from '../middleware/authMiddleware.js';
import { createVietQRPayment, handleVietQRWebhook, createPayPalOrder, capturePayPalOrder, createStripePaymentIntent, handleStripeWebhook } from '../services/paymentService.js';

const router = express.Router();

router.post('/vietqr/create-payment', authenticateJWT, async (req, res) => {
  try {
    const { package_uuid } = req.body;
    const result = await createVietQRPayment(package_uuid, req.user.id);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/vietqr/webhook', handleVietQRWebhook);

router.post('/paypal/create-order', authenticateJWT, async (req, res) => {
  try {
    const { package_uuid } = req.body;
    const result = await createPayPalOrder(package_uuid, req.user.id);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/paypal/capture-order', authenticateJWT, async (req, res) => {
  try {
    const { orderID, internalTransactionUUID } = req.body;
    await capturePayPalOrder(orderID, internalTransactionUUID, req.user.user_uuid);
    res.json({ success: true, message: 'Payment successful, credits added.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/stripe/create-payment-intent', authenticateJWT, async (req, res) => {
  try {
    const { package_uuid } = req.body;
    const result = await createStripePaymentIntent(package_uuid, req.user.id);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/stripe/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

export default router;