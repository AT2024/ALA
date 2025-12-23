// CRITICAL: Load environment variables FIRST
import dotenv from 'dotenv';
dotenv.config();

// Now safe to import modules that depend on environment variables
import { initializeDatabase } from './config/database';
import logger from './utils/logger';

const initializeDb = async () => {
  try {
    // Initialize database connection and sync models
    await initializeDatabase();
    logger.info('Database connection established and models synchronized');
    logger.info('Database initialization completed successfully');
  } catch (error) {
    logger.error(`Database initialization error: ${error}`);
    process.exit(1);
  }
};

// Run the initialization
initializeDb();
