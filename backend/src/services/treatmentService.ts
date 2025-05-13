import { Treatment, Applicator, User } from '../models';
import { Op } from 'sequelize';
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
      
      // For removal treatments, apply the 14-20 day window rule
      if (params.type === 'removal') {
        const today = new Date();
        const filteredDbTreatments = dbTreatments.filter(treatment => {
          const insertionTreatment = dbTreatments.find(t => 
            t.type === 'insertion' && 
            t.subjectId === treatment.subjectId && 
            t.site === treatment.site
          );
          
          if (!insertionTreatment) return false;
          
          const insertionDate = new Date(insertionTreatment.date);
          const daysSinceInsertion = Math.floor((today.getTime() - insertionDate.getTime()) / (1000 * 60 * 60 * 24));
          
          return daysSinceInsertion >= 14 && daysSinceInsertion <= 20;
        });
        
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
  async getTreatmentById(id: string) {
    try {
      const treatment = await Treatment.findByPk(id, {
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
      });
      
      if (!treatment) {
        throw new Error('Treatment not found');
      }
      
      return treatment;
    } catch (error) {
      logger.error(`Error fetching treatment by ID: ${error}`);
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
      
      // Validate time window
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
  async validateTreatmentTimeWindow(treatmentId: string) {
    try {
      const treatment = await Treatment.findByPk(treatmentId);
      
      if (!treatment) {
        throw new Error('Treatment not found');
      }
      
      const today = new Date();
      const treatmentDate = new Date(treatment.date);
      const daysSinceTreatment = Math.floor((today.getTime() - treatmentDate.getTime()) / (1000 * 60 * 60 * 24));
      
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