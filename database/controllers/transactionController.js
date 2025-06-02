import { getUserCredits, getUserTransactions } from '../services/creditService.js';

export const getCredits = async (req, res) => {
  try {
    const credits = await getUserCredits(req.user.user_uuid);
    res.json({ success: true, credits });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const listTransactions = async (req, res) => {
  const { page = 1, limit = 10, type } = req.query;
  try {
    const result = await getUserTransactions(req.user.user_uuid, parseInt(page), parseInt(limit), type);
    res.json({ success: true, transactions: result.transactions, pagination: result.pagination });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};