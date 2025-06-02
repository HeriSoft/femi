import express from 'express';
import { listCreditPackages } from '../controllers/creditPackageController.js';

const router = express.Router();
router.get('/', listCreditPackages);
export default router;