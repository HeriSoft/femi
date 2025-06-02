import { getCreditPackages } from '../services/creditService.js';

export const listCreditPackages = async (req, res) => {
  try {
    const packages = await getCreditPackages();
    res.json({ success: true, packages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};