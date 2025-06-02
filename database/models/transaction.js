import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import User from './user.js';
import CreditPackage from './creditPackage.js';

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  transaction_uuid: {
    type: DataTypes.STRING(36),
    unique: true,
    allowNull: false,
    defaultValue: () => uuidv4(),
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  type: {
    type: DataTypes.ENUM('purchase', 'usage', 'refund', 'adjustment'),
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  credits_changed: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  amount_paid: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  currency_paid: {
    type: DataTypes.STRING(3),
    allowNull: true,
  },
  payment_gateway: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  gateway_transaction_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending',
  },
  related_package_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: CreditPackage,
      key: 'id',
    },
    onDelete: 'SET NULL',
  },
  service_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  timestamps: false,
  tableName: 'transactions',
});

export default Transaction;