// CRITICAL: Load environment variables FIRST
import dotenv from 'dotenv';
dotenv.config();

// Now safe to import modules that depend on environment variables
import { initializeDatabase } from './config/database';
import { User, Treatment, Applicator } from './models';
import logger from './utils/logger';

const initializeDb = async () => {
  try {
    // Initialize database connection and sync models
    await initializeDatabase();
    logger.info('Database connection established and models synchronized');
    
    // Check if admin user exists
    const adminExists = await User.findOne({
      where: { role: 'admin' },
    });
    
    // If no admin user exists, create one
    if (!adminExists) {
      logger.info('Creating admin user');
      await User.create({
        name: 'Admin User',
        email: 'admin@example.com',
        phoneNumber: '+1234567890',
        role: 'admin',
        metadata: {
          sites: [], // Admin has access to all sites
          positionCode: 99 // Admin position code
        }
      });
    }
    
    // Create some test data for development
    if (process.env.NODE_ENV === 'development') {
      // Check if test hospital user exists
      const hospitalUserExists = await User.findOne({
        where: { role: 'hospital' },
      });
      
      // If no hospital user exists, create one
      if (!hospitalUserExists) {
        logger.info('Creating test hospital user');
        await User.create({
          name: 'Hospital User',
          email: 'hospital@example.com',
          phoneNumber: '+9876543210',
          role: 'hospital',
          metadata: {
            sites: ['100078'], // Example site
            positionCode: 50 // Non-admin position code
          }
        });
      }
      
      // Check if AlphaTau user exists
      const alphaTauUserExists = await User.findOne({
        where: { role: 'alphatau' },
      });
      
      // If no AlphaTau user exists, create one
      if (!alphaTauUserExists) {
        logger.info('Creating test AlphaTau user');
        await User.create({
          name: 'AlphaTau User',
          email: 'alphatau@example.com',
          phoneNumber: '+1122334455',
          role: 'alphatau',
          metadata: {
            sites: [], // Empty means all sites
            positionCode: 99 // Admin position code for AlphaTau staff
          }
        });
      }
    }
    
    logger.info('Database initialization completed successfully');
  } catch (error) {
    logger.error(`Database initialization error: ${error}`);
    process.exit(1);
  }
};

// Run the initialization
initializeDb();