import express from 'express';
import { googleCallback } from '../controllers/authController.js';

const router = express.Router();
router.post('/google/callback', googleCallback);
export default router;