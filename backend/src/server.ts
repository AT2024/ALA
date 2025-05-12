import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorMiddleware';
import { notFound } from './middleware/notFoundMiddleware';
import authRoutes from './routes/authRoutes';
import treatmentRoutes from './routes/treatmentRoutes';
import applicatorRoutes from './routes/applicatorRoutes';
import adminRoutes from './routes/adminRoutes';
import { initializeDatabase } from './config/database';
import logger from './utils/logger';

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/treatments', treatmentRoutes);
app.use('/api/applicators', applicatorRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

// Initialize database and start server
const startServer = async () => {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error}`);
    process.exit(1);
  }
};

startServer();

export default app;
