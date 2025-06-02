import express from 'express';
import { getCredits, listTransactions } from '../controllers/transactionController.js';
import { authenticateJWT } from '../middleware/authMiddleware.js';

const router = express.Router();
router.get('/me/credits', authenticateJWT, getCredits);
router.get('/me/transactions', authenticateJWT, listTransactions);
export default router;