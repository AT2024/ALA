// CRITICAL: Load environment variables FIRST, before any other imports
// This ensures all modules have access to process.env when they initialize
import dotenv from 'dotenv';
dotenv.config();

// Validate environment variables immediately after loading
import { validateEnvironment } from './config/validateEnv';
validateEnvironment();

// Now safe to import modules that depend on environment variables
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorMiddleware';
import { notFound } from './middleware/notFoundMiddleware';
import {
  apiRateLimit,
  authRateLimit,
  codeRequestRateLimit,
  verifyRateLimit,
  tokenValidateRateLimit,
  httpsRedirect,
  securityHeaders,
  corsOptions,
  requestLogger
} from './middleware/securityMiddleware';
import authRoutes from './routes/authRoutes';
import treatmentRoutes from './routes/treatmentRoutes';
import applicatorRoutes from './routes/applicatorRoutes';
import adminRoutes from './routes/adminRoutes';
import priorityRoutes from './routes/priorityRoutes';
import { initializeDatabase } from './config/database';
import './models'; // Import models to ensure they're loaded before database sync
import logger from './utils/logger';

// Initialize express app
const app = express();
app.set('trust proxy', true); // Trust nginx proxy headers
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(httpsRedirect);
app.use(securityHeaders);
app.use(requestLogger);

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors(corsOptions));

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Track database connection status
let isDatabaseConnected = false;

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is running',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    databaseConnected: isDatabaseConnected
  });
});

// Debug endpoint to check API routes
app.get('/api/routes', (req, res) => {
  const routes: Array<{path: string, methods: string[]}> = [];
  
  // Get registered routes
  app._router.stack.forEach((middleware: any) => {
    if(middleware.route){ // Routes registered directly on the app
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if(middleware.name === 'router'){ // Router middleware
      middleware.handle.stack.forEach((handler: any) => {
        if(handler.route){
          const path = handler.route.path;
          const methods = Object.keys(handler.route.methods);
          routes.push({ path: middleware.regexp.toString() + path, methods });
        }
      });
    }
  });
  
  res.status(200).json({
    routes,
    authRoutes: '/api/auth/*',
    treatmentRoutes: '/api/treatments/*',
    applicatorRoutes: '/api/applicators/*',
    adminRoutes: '/api/admin/*',
    priorityRoutes: '/api/proxy/priority/*'
  });
});

// Auth routes with specific rate limiting
app.post('/api/auth/request-code', codeRequestRateLimit, authRoutes);
app.post('/api/auth/verify', verifyRateLimit, authRoutes);
app.post('/api/auth/resend-code', codeRequestRateLimit, authRoutes);
app.post('/api/auth/validate-token', tokenValidateRateLimit, authRoutes);
app.get('/api/auth/debug-sites/:identifier', authRateLimit, authRoutes);
// Fallback for any other auth routes
app.use('/api/auth', authRateLimit, authRoutes);
app.use('/api/treatments', apiRateLimit, treatmentRoutes);
app.use('/api/applicators', apiRateLimit, applicatorRoutes);
app.use('/api/admin', apiRateLimit, adminRoutes);
app.use('/api/proxy/priority', apiRateLimit, priorityRoutes);

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

// Initialize database and start server
const startServer = async () => {
  try {
    // Start server regardless of database connection
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
    
    // Try to connect to database, but don't crash if it fails
    try {
      isDatabaseConnected = await initializeDatabase();
      if (!isDatabaseConnected) {
        logger.warn('Server started without database connection. Some features may not work.');

        // Schedule periodic retry attempts
        setInterval(async () => {
          logger.info('Attempting to reconnect to database...');
          isDatabaseConnected = await initializeDatabase(3, 1000);
          if (isDatabaseConnected) {
            logger.info('Successfully reconnected to database!');
          }
        }, 30000); // Retry every 30 seconds
      } else {
        logger.info('Database connected successfully');
      }
    } catch (dbError) {
      logger.error(`Database initialization error: ${dbError}`);
      logger.warn('Server started without database connection. Some features may not work.');
    }

    // Graceful shutdown handler
    const gracefulShutdown = () => {
      logger.info('Received shutdown signal...');
      server.close(() => {
        logger.info('Server closed gracefully');
        process.exit(0);
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
    return server;
  } catch (error) {
    logger.error(`Failed to start server: ${error}`);
    process.exit(1);
  }
};

startServer();

export default app;