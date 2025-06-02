import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_uuid: {
    type: DataTypes.STRING(36),
    unique: true,
    allowNull: false,
    defaultValue: () => uuidv4(),
  },
  google_id: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  credits: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
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
  tableName: 'users',
});

export default User;