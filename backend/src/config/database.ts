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

// Initialize database connection
export const initializeDatabase = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    
    // Sync models with database
    await sequelize.sync({ alter: process.env.NODE_ENV !== 'production' });
    logger.info('Database models synchronized');
  } catch (error) {
    logger.error(`Database connection error: ${error}`);
    throw error;
  }
};

export default sequelize;
