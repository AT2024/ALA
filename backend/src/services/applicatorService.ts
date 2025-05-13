import { Applicator, Treatment } from '../models';
import { Op } from 'sequelize';
import logger from '../utils/logger';

export const applicatorService = {
  // Get applicators for a treatment
  async getApplicators(treatmentId: string) {
    try {
      const applicators = await Applicator.findAll({
        where: { treatmentId },
        order: [['insertionTime', 'ASC']],
      });
      
      return applicators;
    } catch (error) {
      logger.error(`Error fetching applicators: ${error}`);
      throw error;
    }
  },

  // Get a single applicator by ID
  async getApplicatorById(id: string) {
    try {
      const applicator = await Applicator.findByPk(id);
      
      if (!applicator) {
        throw new Error('Applicator not found');
      }
      
      return applicator;
    } catch (error) {
      logger.error(`Error fetching applicator by ID: ${error}`);
      throw error;
    }
  },

  // Validate an applicator barcode for a treatment
  async validateApplicator(barcode: string, treatmentId: string) {
    try {
      // Check if the treatment exists
      const treatment = await Treatment.findByPk(treatmentId);
      
      if (!treatment) {
        return {
          valid: false,
          message: 'Treatment not found',
          requiresAdminApproval: false,
        };
      }
      
      // Check if applicator already exists in this treatment
      const existingInCurrentTreatment = await Applicator.findOne({
        where: { 
          serialNumber: barcode,
          treatmentId
        },
      });
      
      if (existingInCurrentTreatment) {
        return {
          valid: false,
          message: 'This applicator was already scanned for this treatment.',
          requiresAdminApproval: false,
          applicator: existingInCurrentTreatment,
        };
      }
      
      // Check if applicator exists in Applicators Serial Numbers DB
      const existingApplicator = await Applicator.findOne({
        where: { serialNumber: barcode },
      });
      
      if (existingApplicator) {
        // Check usage type
        if (existingApplicator.usageType === 'none') {
          return {
            valid: false,
            message: 'This applicator was scanned with status "No use".',
            requiresAdminApproval: true,
          };
        }
        
        // Check if tied to another treatment
        if (existingApplicator.treatmentId !== treatmentId) {
          return {
            valid: false,
            message: 'This applicator is intended for another treatment.',
            requiresAdminApproval: true,
          };
        }
      } else {
        // If not found, try to import applicator lists from treatments at the same site in past 24 hours
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const recentTreatments = await Treatment.findAll({
          where: {
            site: treatment.site,
            date: {
              [Op.gte]: yesterday
            },
            id: {
              [Op.ne]: treatmentId
            }
          }
        });
        
        // Check all applicators from recent treatments
        for (const recentTreatment of recentTreatments) {
          const recentApplicators = await Applicator.findAll({
            where: { treatmentId: recentTreatment.id }
          });
          
          const matchingApplicator = recentApplicators.find(app => app.serialNumber === barcode);
          
          if (matchingApplicator) {
            return {
              valid: false,
              message: 'This applicator is intended for another treatment.',
              requiresAdminApproval: true,
            };
          }
        }
        
        // If still not found, default message
        return {
          valid: false,
          message: 'You are not allowed to use this applicator for this treatment.',
          requiresAdminApproval: true,
        };
      }
      
      // If all checks pass, the applicator is valid
      return {
        valid: true,
        message: 'Applicator validated successfully',
        requiresAdminApproval: false,
      };
    } catch (error) {
      logger.error(`Error validating applicator: ${error}`);
      throw error;
    }
  },

  // Add an applicator to a treatment with validation
  async addApplicator(treatmentId: string, data: any, userId: string) {
    try {
      const treatment = await Treatment.findByPk(treatmentId);
      
      if (!treatment) {
        throw new Error('Treatment not found');
      }
      
      if (treatment.isComplete) {
        throw new Error('Cannot add applicator to a completed treatment');
      }
      
      // Validate required fields
      if (!data.serialNumber) {
        throw new Error('Serial number is required');
      }
      
      if (!data.usageType) {
        throw new Error('Usage type is required');
      }
      
      // Validate usage type
      if (!['full', 'faulty', 'none'].includes(data.usageType)) {
        throw new Error('Invalid usage type. Must be "full", "faulty", or "none"');
      }
      
      // If usage type is "faulty", comments are required
      if (data.usageType === 'faulty' && !data.comments) {
        throw new Error('Comments are required for faulty applicators');
      }
      
      // Create the applicator
      const applicator = await Applicator.create({
        ...data,
        treatmentId,
        addedBy: userId,
        insertionTime: data.insertionTime || new Date(),
        seedQuantity: data.seedQuantity || 0,
        isRemoved: false,
      });
      
      return applicator;
    } catch (error) {
      logger.error(`Error adding applicator: ${error}`);
      throw error;
    }
  },

  // Update applicator with validation for removal treatment
  async updateApplicatorForRemoval(id: string, data: any, userId: string) {
    try {
      const applicator = await Applicator.findByPk(id);
      
      if (!applicator) {
        throw new Error('Applicator not found');
      }
      
      const treatment = await Treatment.findByPk(applicator.treatmentId);
      
      if (!treatment) {
        throw new Error('Treatment not found');
      }
      
      if (treatment.isComplete) {
        throw new Error('Cannot update applicator in a completed treatment');
      }
      
      if (treatment.type !== 'removal') {
        throw new Error('This method is only for removal treatments');
      }
      
      // Update applicator
      const updateData: any = {
        ...data,
      };
      
      // If marking as removed, set removal time and removed by
      if (data.isRemoved === true && !applicator.isRemoved) {
        updateData.removalTime = new Date();
        updateData.removedBy = userId;
      }
      
      await applicator.update(updateData);
      
      return applicator;
    } catch (error) {
      logger.error(`Error updating applicator for removal: ${error}`);
      throw error;
    }
  },
  
  // Calculate seed count status for a removal treatment
  async calculateSeedCountStatus(treatmentId: string) {
    try {
      const applicators = await Applicator.findAll({
        where: { treatmentId }
      });
      
      const totalSeeds = applicators.reduce((sum, app) => sum + app.seedQuantity, 0);
      const removedSeeds = applicators.reduce((sum, app) => 
        app.isRemoved ? sum + app.seedQuantity : sum, 0
      );
      
      return {
        totalSeeds,
        removedSeeds,
        complete: totalSeeds === removedSeeds,
        status: totalSeeds === removedSeeds ? 'complete' : 'incomplete',
      };
    } catch (error) {
      logger.error(`Error calculating seed count status: ${error}`);
      throw error;
    }
  },
  
  // Regular update function
  async updateApplicator(id: string, data: any) {
    try {
      const applicator = await Applicator.findByPk(id);
      
      if (!applicator) {
        throw new Error('Applicator not found');
      }
      
      await applicator.update(data);
      
      return applicator;
    } catch (error) {
      logger.error(`Error updating applicator: ${error}`);
      throw error;
    }
  },
};

export default applicatorService;