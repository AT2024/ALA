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
import priorityRoutes from './routes/priorityRoutes';
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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/treatments', treatmentRoutes);
app.use('/api/applicators', applicatorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/proxy/priority', priorityRoutes);

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
      }
    } catch (dbError) {
      logger.error(`Database initialization error: ${dbError}`);
      logger.warn('Server started without database connection. Some features may not work.');
    }
    
    return server;
  } catch (error) {
    logger.error(`Failed to start server: ${error}`);
    process.exit(1);
  }
};

startServer();

export default app;