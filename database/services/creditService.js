import User from '../models/user.js';
import Transaction from '../models/transaction.js';
import CreditPackage from '../models/creditPackage.js';
import sequelize from '../config/database.js';

export const getCreditPackages = async () => {
  return await CreditPackage.findAll({ where: { is_active: true } });
};

export const getUserCredits = async (userUuid) => {
  const user = await User.findOne({ where: { user_uuid: userUuid } });
  return user ? user.credits : null;
};

export const addCredits = async (userUuid, creditsToAdd, transactionDetails) => {
  const user = await User.findOne({ where: { user_uuid: userUuid } });
  if (!user) throw new Error('User not found');

  const t = await sequelize.transaction();
  try {
    user.credits += creditsToAdd;
    await user.save({ transaction: t });
    await Transaction.create(
      { ...transactionDetails, user_id: user.id, type: 'purchase', status: 'completed', credits_changed: creditsToAdd },
      { transaction: t }
    );
    await t.commit();
  } catch (error) {
    await t.rollback();
    throw error;
  }
};

export const deductCredits = async (userUuid, creditsToDeduct, serviceName, description) => {
  const user = await User.findOne({ where: { user_uuid: userUuid } });
  if (!user) throw new Error('User not found');
  if (user.credits < creditsToDeduct) throw new Error('Insufficient credits');

  const t = await sequelize.transaction();
  try {
    user.credits -= creditsToDeduct;
    await user.save({ transaction: t });
    await Transaction.create(
      {
        user_id: user.id,
        type: 'usage',
        status: 'completed',
        credits_changed: -creditsToDeduct,
        service_name: serviceName,
        description,
      },
      { transaction: t }
    );
    await t.commit();
  } catch (error) {
    await t.rollback();
    throw error;
  }
};

export const getUserTransactions = async (userUuid, page = 1, limit = 10, type = null) => {
  const user = await User.findOne({ where: { user_uuid: userUuid } });
  if (!user) throw new Error('User not found');

  const where = { user_id: user.id };
  if (type) where.type = type;

  const offset = (page - 1) * limit;
  const { count, rows } = await Transaction.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
  });

  return {
    transactions: rows,
    pagination: { currentPage: page, totalPages: Math.ceil(count / limit), totalItems: count },
  };
};