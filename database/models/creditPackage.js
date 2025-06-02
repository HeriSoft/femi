import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

const CreditPackage = sequelize.define('CreditPackage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  package_uuid: {
    type: DataTypes.STRING(36),
    unique: true,
    allowNull: false,
    defaultValue: () => uuidv4(),
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
  },
  credits_awarded: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
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
  tableName: 'credit_packages',
});

export default CreditPackage;