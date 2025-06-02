import { Sequelize } from 'sequelize';
import { env } from './env.js';

const sequelize = new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASSWORD, {
  host: env.DB_HOST,
  dialect: 'mysql',
  logging: false,
});

export default sequelize;