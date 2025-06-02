import paypal from '@paypal/checkout-server-sdk';
import Stripe from 'stripe';
import { VietQR } from 'vietqr';
import { env } from '../config/env.js';
import CreditPackage from '../models/creditPackage.js';
import Transaction from '../models/transaction.js';
import { addCredits } from './creditService.js';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export const createStripePaymentIntent = async (packageUuid, userId) => {
  const creditPackage = await CreditPackage.findOne({ where: { package_uuid: packageUuid } });
  if (!creditPackage) throw new Error('Credit package not found');

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(creditPackage.price * 100),
    currency: creditPackage.currency.toLowerCase(),
    metadata: { userId, packageUuid },
  });

  const transaction = await Transaction.create({
    user_id: userId,
    type: 'purchase',
    status: 'pending',
    payment_gateway: 'stripe',
    related_package_id: creditPackage.id,
    amount_paid: creditPackage.price,
    currency_paid: creditPackage.currency,
  });

  return { clientSecret: paymentIntent.client_secret, internalTransactionUUID: transaction.transaction_uuid };
};

export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ success: false, message: `Webhook Error: ${err.message}` });
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const { userId, packageUuid } = paymentIntent.metadata;
    const creditPackage = await CreditPackage.findOne({ where: { package_uuid: packageUuid } });
    const transaction = await Transaction.findOne({
      where: { user_id: userId, related_package_id: creditPackage.id, status: 'pending', payment_gateway: 'stripe' },
    });

    if (transaction) {
      transaction.status = 'completed';
      transaction.gateway_transaction_id = paymentIntent.id;
      await transaction.save();

      const user = await User.findByPk(userId);
      await addCredits(user.user_uuid, creditPackage.credits_awarded, {
        description: `Purchase of ${creditPackage.name}`,
        amount_paid: creditPackage.price,
        currency_paid: creditPackage.currency,
        payment_gateway: 'stripe',
        gateway_transaction_id: paymentIntent.id,
      });
    }
  }
  res.json({ success: true, received: true });
};

const vietQR = new VietQR({
  clientID: env.VIETQR_CLIENT_ID,
  apiKey: env.VIETQR_API_KEY,
});

export const createVietQRPayment = async (packageUuid, userId) => {
  const creditPackage = await CreditPackage.findOne({ where: { package_uuid: packageUuid } });
  if (!creditPackage) throw new Error('Gói credit không tồn tại');

  const qrData = {
    bank: '970415', // Mã ngân hàng, ví dụ: Vietcombank
    accountName: 'Tên tài khoản nhận', // Thay bằng tên tài khoản thực tế
    accountNumber: 'Số tài khoản nhận', // Thay bằng số tài khoản thực tế
    amount: creditPackage.price.toString(), // Số tiền thanh toán
    memo: `Mua gói ${creditPackage.name}`, // Mô tả giao dịch
    template: 'compact', // Mẫu mã QR
  };

  const qrCode = await vietQR.genQRCodeBase64(qrData);
  if (qrCode.code !== '00') throw new Error('Không thể tạo mã QR');

  const transaction = await Transaction.create({
    user_id: userId,
    type: 'purchase',
    status: 'pending',
    payment_gateway: 'vietqr',
    related_package_id: creditPackage.id,
    amount_paid: creditPackage.price,
    currency_paid: creditPackage.currency,
    metadata: { qrDataURL: qrCode.data.qrDataURL },
  });

  return { qrDataURL: qrCode.data.qrDataURL, internalTransactionUUID: transaction.transaction_uuid };
};

export const handleVietQRWebhook = async (req, res) => {
  const { transactionId, status } = req.body; // Điều chỉnh theo cấu trúc webhook thực tế

  const transaction = await Transaction.findOne({ where: { gateway_transaction_id: transactionId } });
  if (!transaction) return res.status(404).json({ success: false, message: 'Giao dịch không tồn tại' });

  if (status === 'success') {
    transaction.status = 'completed';
    await transaction.save();

    const creditPackage = await CreditPackage.findByPk(transaction.related_package_id);
    const user = await User.findByPk(transaction.user_id);
    await addCredits(user.user_uuid, creditPackage.credits_awarded, {
      description: `Mua gói ${creditPackage.name} qua VietQR`,
      amount_paid: transaction.amount_paid,
      currency_paid: transaction.currency_paid,
      payment_gateway: 'vietqr',
      gateway_transaction_id: transactionId,
    });
  } else {
    transaction.status = 'failed';
    await transaction.save();
  }

  res.status(200).json({ success: true });
};

const paypalEnv = new paypal.core.SandboxEnvironment(env.PAYPAL_CLIENT_ID, env.PAYPAL_CLIENT_SECRET);
const paypalClient = new paypal.core.PayPalHttpClient(paypalEnv);

export const createPayPalOrder = async (packageUuid, userId) => {
  const creditPackage = await CreditPackage.findOne({ where: { package_uuid: packageUuid } });
  if (!creditPackage) throw new Error('Credit package not found');

  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer('return=representation');
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [{
      amount: { currency_code: creditPackage.currency, value: creditPackage.price.toFixed(2) },
      description: creditPackage.name,
    }],
  });

  const order = await paypalClient.execute(request);
  const transaction = await Transaction.create({
    user_id: userId,
    type: 'purchase',
    status: 'pending',
    payment_gateway: 'paypal',
    related_package_id: creditPackage.id,
    amount_paid: creditPackage.price,
    currency_paid: creditPackage.currency,
  });

  return { orderID: order.result.id, internalTransactionUUID: transaction.transaction_uuid };
};

export const capturePayPalOrder = async (orderID, internalTransactionUUID, userUuid) => {
  const request = new paypal.orders.OrdersCaptureRequest(orderID);
  request.requestBody({});
  const capture = await paypalClient.execute(request);

  const transaction = await Transaction.findOne({ where: { transaction_uuid: internalTransactionUUID } });
  if (!transaction) throw new Error('Transaction not found');

  transaction.status = 'completed';
  transaction.gateway_transaction_id = capture.result.id;
  await transaction.save();

  const creditPackage = await CreditPackage.findByPk(transaction.related_package_id);
  await addCredits(userUuid, creditPackage.credits_awarded, {
    description: `Purchase of ${creditPackage.name}`,
    amount_paid: transaction.amount_paid,
    currency_paid: transaction.currency_paid,
    payment_gateway: 'paypal',
    gateway_transaction_id: capture.result.id,
  });

  return true;
};