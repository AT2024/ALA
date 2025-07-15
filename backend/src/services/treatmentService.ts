import { Treatment, Applicator, User } from '../models';
import { Op } from 'sequelize';
import sequelize from '../config/database';
import logger from '../utils/logger';
import priorityService from './priorityService';

interface TreatmentFilterParams {
  type?: 'insertion' | 'removal';
  subjectId?: string;
  site?: string;
  date?: string;
}

export const treatmentService = {
  // Get treatments with optional filtering
  async getTreatments(params: TreatmentFilterParams, userId?: string) {
    try {
      // First, check database for existing treatments
      const whereClause: any = {};
      
      if (params.type) {
        whereClause.type = params.type;
      }
      
      if (params.subjectId) {
        whereClause.subjectId = params.subjectId;
      }
      
      if (params.site) {
        whereClause.site = params.site;
      }
      
      if (params.date) {
        whereClause.date = {
          [Op.gte]: new Date(params.date),
          [Op.lt]: new Date(new Date(params.date).getTime() + 24 * 60 * 60 * 1000) // Add 1 day
        };
      }
      
      // If userId provided and not admin, filter by user
      let userFilter = {};
      if (userId) {
        const user = await User.findByPk(userId);
        if (user && user.role !== 'admin') {
          // For hospital and alphatau users, filter by user or site permissions
          const userSites = user.metadata?.sites || [];
          userFilter = {
            [Op.or]: [
              { userId },
              { site: { [Op.in]: userSites } }
            ]
          };
        }
      }
      
      // Get database treatments
      const dbTreatments = await Treatment.findAll({
        where: {
          ...whereClause,
          ...userFilter
        },
        order: [['date', 'DESC']],
      });
      
      // For removal treatments, apply the 14-20 day window rule only if we have insertion treatments
      if (params.type === 'removal') {
        const today = new Date();
        logger.info(`Applying removal treatment filter for ${dbTreatments.length} treatments`);
        
        const filteredDbTreatments = dbTreatments.filter(treatment => {
          // Only apply the rule if this is actually a removal treatment
          if (treatment.type !== 'removal') {
            return true; // Allow insertion treatments to pass through
          }
          
          const insertionTreatment = dbTreatments.find(t => 
            t.type === 'insertion' && 
            t.subjectId === treatment.subjectId && 
            t.site === treatment.site
          );
          
          if (!insertionTreatment) {
            logger.debug(`No insertion treatment found for removal treatment ${treatment.id}`);
            return false;
          }
          
          const insertionDate = new Date(insertionTreatment.date);
          const daysSinceInsertion = Math.floor((today.getTime() - insertionDate.getTime()) / (1000 * 60 * 60 * 24));
          
          const isInWindow = daysSinceInsertion >= 14 && daysSinceInsertion <= 20;
          logger.debug(`Treatment ${treatment.id}: ${daysSinceInsertion} days since insertion, in window: ${isInWindow}`);
          
          return isInWindow;
        });
        
        logger.info(`Removal filter: ${dbTreatments.length} -> ${filteredDbTreatments.length} treatments`);
        return filteredDbTreatments;
      }
      
      // Check if we need to fetch from Priority
      if (dbTreatments.length > 0) {
        return dbTreatments;
      }
      
      // If no treatments in DB, try to fetch from Priority
      const user = userId ? await User.findByPk(userId) : null;
      const userSites = user?.metadata?.sites || [];
      
      // Only fetch from Priority if we have site information
      if (userSites.length > 0) {
        const priorityTreatments = await priorityService.getTreatmentsForSites(userSites, params);
        
        // Save treatments to our database if they don't exist already
        for (const treatment of priorityTreatments) {
          await Treatment.findOrCreate({
            where: {
              priorityId: treatment.id,
              subjectId: treatment.subjectId,
              site: treatment.site,
              type: treatment.type
            },
            defaults: {
              ...treatment,
              userId: userId || null,
              date: new Date(treatment.date),
            }
          });
        }
        
        return priorityTreatments;
      }
      
      return dbTreatments;
    } catch (error) {
      logger.error(`Error fetching treatments: ${error}`);
      throw error;
    }
  },

  // Get a single treatment by ID
  async getTreatmentById(id: string, transaction?: any) {
    const queryId = `getTreatment_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info(`[TREATMENT_SERVICE] Starting getTreatmentById`, {
        queryId,
        treatmentId: id,
        idType: typeof id,
        idLength: id?.length,
        hasTransaction: !!transaction,
        transactionId: transaction?.id,
        timestamp: new Date().toISOString()
      });

      // Validate treatment ID format
      if (!id || typeof id !== 'string') {
        logger.error(`[TREATMENT_SERVICE] [${queryId}] Invalid treatment ID format`, {
          id,
          idType: typeof id,
          idValue: id
        });
        throw new Error('Invalid treatment ID format');
      }

      // Check database connection before query
      logger.debug(`[TREATMENT_SERVICE] [${queryId}] Checking database connection`);
      try {
        await sequelize.authenticate();
        logger.debug(`[TREATMENT_SERVICE] [${queryId}] Database connection verified`);
      } catch (dbError: any) {
        logger.error(`[TREATMENT_SERVICE] [${queryId}] Database connection failed`, {
          error: dbError.message
        });
        throw new Error('Database connection unavailable');
      }

      // Log query parameters
      const queryOptions = {
        include: [
          {
            model: Applicator,
            as: 'applicators',
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'phoneNumber', 'role'],
          },
        ],
        transaction, // Include transaction if provided
      };

      logger.debug(`[TREATMENT_SERVICE] [${queryId}] Executing database query`, {
        treatmentId: id,
        queryOptions: {
          includeApplicators: true,
          includeUser: true,
          hasTransaction: !!transaction,
          transactionIsolationLevel: transaction?.options?.isolationLevel
        }
      });

      const startTime = Date.now();
      const treatment = await Treatment.findByPk(id, queryOptions);
      const queryDuration = Date.now() - startTime;
      
      logger.info(`[TREATMENT_SERVICE] [${queryId}] Database query completed`, {
        treatmentId: id,
        queryDuration: `${queryDuration}ms`,
        treatmentFound: !!treatment,
        treatmentData: treatment ? {
          id: treatment.id,
          type: treatment.type,
          subjectId: treatment.subjectId,
          site: treatment.site,
          isComplete: treatment.isComplete,
          userId: treatment.userId,
          applicatorsCount: treatment.applicators?.length || 0,
          createdAt: treatment.createdAt,
          updatedAt: treatment.updatedAt
        } : null,
        hasTransaction: !!transaction,
        transactionId: transaction?.id
      });

      // Log performance warning for slow queries
      if (queryDuration > 1000) {
        logger.warn(`[TREATMENT_SERVICE] [${queryId}] Slow database query detected`, {
          treatmentId: id,
          queryDuration: `${queryDuration}ms`,
          threshold: '1000ms',
          recommendation: 'Consider optimizing query or checking database performance'
        });
      }
      
      if (!treatment) {
        // Additional debugging for missing treatment
        logger.error(`[TREATMENT_SERVICE] [${queryId}] Treatment not found in database`, {
          treatmentId: id,
          queryDuration: `${queryDuration}ms`,
          searchedInTransaction: !!transaction,
          transactionId: transaction?.id,
          
          // Let's also check if the ID exists in any form
          debugInfo: {
            idFormat: 'UUID expected',
            idPattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id),
            timestamp: new Date().toISOString()
          }
        });
        
        // Perform additional debugging query to check if treatment exists without transaction
        if (transaction) {
          try {
            logger.debug(`[TREATMENT_SERVICE] [${queryId}] Checking treatment existence without transaction`);
            const treatmentWithoutTransaction = await Treatment.findByPk(id);
            logger.debug(`[TREATMENT_SERVICE] [${queryId}] Treatment exists without transaction`, {
              found: !!treatmentWithoutTransaction,
              possibleTransactionIsolationIssue: !!treatmentWithoutTransaction
            });
          } catch (debugError: any) {
            logger.debug(`[TREATMENT_SERVICE] [${queryId}] Debug query also failed`, {
              error: debugError.message
            });
          }
        }
        
        throw new Error('Treatment not found');
      }
      
      logger.info(`[TREATMENT_SERVICE] [${queryId}] Treatment successfully retrieved`, {
        treatmentId: id,
        queryDuration: `${queryDuration}ms`,
        treatmentType: treatment.type,
        treatmentUserId: treatment.userId
      });
      
      return treatment;
    } catch (error: any) {
      logger.error(`[TREATMENT_SERVICE] [${queryId}] Error in getTreatmentById`, {
        queryId,
        treatmentId: id,
        hasTransaction: !!transaction,
        transactionId: transaction?.id,
        error: {
          message: error.message,
          name: error.name,
          code: error.code,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          sqlMessage: error.original?.message,
          sqlCode: error.original?.code,
          sqlState: error.original?.sqlState
        },
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  },

  // Create a new treatment
  async createTreatment(data: any, userId: string) {
    try {
      const treatment = await Treatment.create({
        ...data,
        userId,
      });
      
      // Update Priority system if needed
      if (process.env.SYNC_WITH_PRIORITY === 'true') {
        try {
          const priorityResult = await priorityService.updatePriorityWithTreatment({
            ...data,
            id: treatment.id
          });
          
          // Update treatment with Priority ID
          if (priorityResult.success) {
            await treatment.update({
              priorityId: priorityResult.priorityId
            });
          }
        } catch (priorityError) {
          logger.error(`Error syncing with Priority: ${priorityError}`);
          // Proceed without Priority sync in case of error
        }
      }
      
      return treatment;
    } catch (error) {
      logger.error(`Error creating treatment: ${error}`);
      throw error;
    }
  },

  // Update an existing treatment
  async updateTreatment(id: string, data: any) {
    try {
      const treatment = await Treatment.findByPk(id);
      
      if (!treatment) {
        throw new Error('Treatment not found');
      }
      
      // If treatment is already complete, prevent updates
      if (treatment.isComplete && !data.isComplete) {
        throw new Error('Cannot update a completed treatment');
      }
      
      // Validate time window (with special handling for "No Use" applicators)
      const timeWindowValidation = await this.validateTreatmentTimeWindow(id);
      if (!timeWindowValidation.valid) {
        throw new Error(timeWindowValidation.message);
      }
      
      await treatment.update(data);
      
      // Update Priority system if needed
      if (process.env.SYNC_WITH_PRIORITY === 'true' && treatment.priorityId) {
        try {
          await priorityService.updatePriorityWithTreatment({
            ...data,
            id: treatment.id,
            priorityId: treatment.priorityId
          });
        } catch (priorityError) {
          logger.error(`Error syncing with Priority: ${priorityError}`);
          // Proceed without Priority sync in case of error
        }
      }
      
      return treatment;
    } catch (error) {
      logger.error(`Error updating treatment: ${error}`);
      throw error;
    }
  },

  // Complete a treatment
  async completeTreatment(id: string, userId: string) {
    try {
      const treatment = await Treatment.findByPk(id);
      
      if (!treatment) {
        throw new Error('Treatment not found');
      }
      
      if (treatment.isComplete) {
        throw new Error('Treatment is already complete');
      }
      
      // For removal treatments, check seed count
      if (treatment.type === 'removal') {
        const applicators = await Applicator.findAll({
          where: { treatmentId: id }
        });
        
        const totalSeeds = applicators.reduce((sum, app) => sum + app.seedQuantity, 0);
        const removedSeeds = applicators.reduce((sum, app) => 
          app.isRemoved ? sum + app.seedQuantity : sum, 0
        );
        
        // If not all seeds are accounted for, log a warning
        if (totalSeeds !== removedSeeds) {
          logger.warn(`Treatment ${id} completed with missing seeds: ${totalSeeds - removedSeeds} seeds unaccounted for`);
        }
      }
      
      await treatment.update({
        isComplete: true,
        completedBy: userId,
        completedAt: new Date(),
      });
      
      // Update Priority system if needed
      if (process.env.SYNC_WITH_PRIORITY === 'true' && treatment.priorityId) {
        try {
          await priorityService.updatePriorityWithTreatment({
            ...treatment.toJSON(),
            isComplete: true,
            completedBy: userId,
            completedAt: new Date(),
            priorityId: treatment.priorityId
          });
        } catch (priorityError) {
          logger.error(`Error syncing with Priority: ${priorityError}`);
          // Proceed without Priority sync in case of error
        }
      }
      
      return treatment;
    } catch (error) {
      logger.error(`Error completing treatment: ${error}`);
      throw error;
    }
  },
  
  // Specific method for time window validation
  async validateTreatmentTimeWindow(treatmentId: string, applicatorId?: string) {
    try {
      const treatment = await Treatment.findByPk(treatmentId);
      
      if (!treatment) {
        throw new Error('Treatment not found');
      }
      
      const today = new Date();
      const treatmentDate = new Date(treatment.date);
      const daysSinceTreatment = Math.floor((today.getTime() - treatmentDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Special rule for "No Use" applicators - allow future editing
      if (applicatorId) {
        const applicator = await Applicator.findByPk(applicatorId);
        if (applicator && applicator.usageType === 'none') {
          return {
            valid: true,
            message: 'No Use applicators can be edited in the future'
          };
        }
      }
      
      // Standard window is 21 days (14 days + 7-day extension)
      if (daysSinceTreatment > 21) {
        return {
          valid: false,
          message: 'This treatment cannot be modified after 21 days'
        };
      }
      
      // Special rule for day after insertion
      if (treatment.type === 'insertion' && daysSinceTreatment === 1) {
        // Check if user is hospital staff or Alpha Tau
        const user = await User.findByPk(treatment.userId);
        if (user && (user.role === 'hospital' || user.role === 'alphatau')) {
          return {
            valid: true,
            message: 'Hospital staff and Alpha Tau personnel can edit the day after insertion'
          };
        }
      }
      
      return {
        valid: true,
        message: 'Treatment is within the editable time window'
      };
    } catch (error) {
      logger.error(`Error validating treatment time window: ${error}`);
      throw error;
    }
  },
};

export default treatmentService;