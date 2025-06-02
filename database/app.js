import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorMiddleware } from './middleware/errorMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import creditPackageRoutes from './routes/creditPackageRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';

const app = express();

app.use(cors());
app.use(helmet());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/credit-packages', creditPackageRoutes);
app.use('/api/v1/users', transactionRoutes);
app.use('/api/v1/payments', paymentRoutes);

app.use(errorMiddleware);

export default app;