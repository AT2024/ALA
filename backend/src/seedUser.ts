// import { User } from './models';
// import { initializeDatabase } from './config/database';
// import logger from './utils/logger';

// const seedUser = async () => {
//   try {
//     // Initialize database connection
//     await initializeDatabase();

//     // Check if test user already exists
//     const existingUser = await User.findOne({
//       where: { email: 'test@example.com' }
//     });

//     if (existingUser) {
//       logger.info('Test user already exists');
//       return;
//     }

//     // Create test user
//     const user = await User.create({
//       name: 'Test User',
//       email: 'test@example.com',
//       phoneNumber: '+1234567890',
//       role: 'hospital'
//     });

//     logger.info(`Test user created with ID: ${user.id}`);
//   } catch (error) {
//     logger.error(`Error seeding user: ${error}`);
//   } finally {
//     process.exit(0);
//   }
// };

// // Run the seed function
// seedUser();
