import { Sequelize } from 'sequelize';
import logger from '../utils/logger';

// Database connection config
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ala_db';

// Create Sequelize instance
const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: process.env.ENABLE_SSL === 'true' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  }
});

// Initialize database connection with retries
export const initializeDatabase = async (retries = 5, delay = 3000): Promise<boolean> => {
  let retryCount = 0;
  let connected = false;

  while (retryCount < retries && !connected) {
    try {
      if (retryCount > 0) {
        logger.info(`Retrying database connection (${retryCount}/${retries})...`);
      }
      
      await sequelize.authenticate();
      logger.info('Database connection established successfully');
      
      // Sync models with database
      await sequelize.sync({ alter: process.env.NODE_ENV !== 'production' });
      logger.info('Database models synchronized');
      connected = true;
      return true;
    } catch (error) {
      retryCount++;
      logger.error(`Database connection error (attempt ${retryCount}/${retries}): ${error}`);
      
      if (retryCount >= retries) {
        logger.error('Maximum database connection retries reached. Server will continue without database.');
        return false;
      }
      
      // Wait before retrying
      logger.info(`Waiting ${delay/1000} seconds before retrying...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return connected;
};

export default sequelize;
