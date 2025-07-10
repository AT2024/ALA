import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import logger from '../utils/logger';
import priorityService from '../services/priorityService';

// @desc    Validate user email against Priority PHONEBOOK
// @route   POST /api/proxy/priority/validate-email
// @access  Public
export const validateUserEmail = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  
  if (!email) {
    res.status(400);
    throw new Error('Email is required');
  }
  
  try {
    logger.info(`Validating email: ${email}`);
    
    // Check the email with Priority
    const priorityUserAccess = await priorityService.getUserSiteAccess(email);
    
    if (!priorityUserAccess.found) {
      logger.info(`Email ${email} not found in Priority system`);
      res.status(404).json({
        isValid: false,
        error: 'Email not found in the system'
      });
      return;
    }
    
    logger.info(`Email ${email} found in Priority system`);
    res.status(200).json({
      isValid: true,
      userData: {
        name: priorityUserAccess.user?.email || 'User',
        email: priorityUserAccess.user?.email || email,
        phoneNumber: priorityUserAccess.user?.phone || '',
        positionCode: priorityUserAccess.user?.positionCode || '',
        custName: priorityUserAccess.sites[0] || '',
      }
    });
  } catch (error: any) {
    logger.error(`Error validating email: ${error.message}`);
    res.status(500).json({
      isValid: false,
      error: `Error: ${error.message}`
    });
  }
});

// @desc    Debug Priority API connection
// @route   GET /api/proxy/priority/debug
// @access  Private
export const debugPriorityConnection = asyncHandler(async (req: Request, res: Response) => {
  try {
    // Use real connection test
    const result = await priorityService.debugPriorityConnection();
    
    res.status(200).json(result);
  } catch (error: any) {
    logger.error(`Debug error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Get treatments from Priority system
// @route   GET /api/proxy/priority/treatments
// @access  Private
export const getTreatments = asyncHandler(async (req: Request, res: Response) => {
  try {
    // Extract parameters from request query
    const { type, subjectId, site, date } = req.query;
    
    // Get user sites from request user metadata
    const userSites = req.user?.metadata?.sites || [];
    
    // Get treatments from Priority for user's sites
    const treatments = await priorityService.getTreatmentsForSites(
      userSites, 
      {
        type: type as string,
        subjectId: subjectId as string,
        site: site as string,
        date: date as string
      }
    );
    
    res.status(200).json(treatments);
  } catch (error: any) {
    logger.error(`Error fetching treatments: ${error.message}`);
    res.status(500).json({
      error: error.message
    });
  }
});

// @desc    Get all contacts from Priority PHONEBOOK
// @route   GET /api/proxy/priority/contacts
// @access  Private
export const getContacts = asyncHandler(async (req: Request, res: Response) => {
  try {
    // Get contacts directly from Priority
    const contacts = await priorityService.getContacts();
    
    res.status(200).json(contacts);
  } catch (error: any) {
    logger.error(`Error fetching contacts: ${error.message}`);
    res.status(500).json({
      error: error.message
    });
  }
});

// @desc    Get orders for a specific CUSTNAME (site)
// @route   GET /api/proxy/priority/orders
// @access  Private
export const getOrdersForSite = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { custName } = req.query;
    
    if (!custName) {
      res.status(400).json({ 
        error: 'custName parameter is required'
      });
      return;
    }
    
    // Get orders for the specified site
    const orders = await priorityService.getOrdersForSite(custName as string);
    
    res.status(200).json(orders);
  } catch (error: any) {
    logger.error(`Error fetching orders: ${error.message}`);
    res.status(500).json({
      error: error.message
    });
  }
});

// @desc    Get allowed sites for user based on POSITIONCODE and CUSTNAME
// @route   GET /api/proxy/priority/allowed-sites
// @access  Private
export const getAllowedSitesForUser = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { userPositionCode, userCustName } = req.query;
    
    if (!userPositionCode || !userCustName) {
      res.status(400).json({ 
        error: 'userPositionCode and userCustName parameters are required'
      });
      return;
    }
    
    // Get allowed sites for the user
    const sites = await priorityService.getAllowedSitesForUser(
      userPositionCode as string,
      userCustName as string
    );
    
    res.status(200).json(sites);
  } catch (error: any) {
    logger.error(`Error fetching allowed sites: ${error.message}`);
    res.status(500).json({
      error: error.message
    });
  }
});

// @desc    Get orders for a specific site and date (for treatment selection)
// @route   POST /api/proxy/priority/orders
// @access  Private
export const getOrdersForSiteAndDate = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { site, date, procedureType } = req.body;
    
    if (!site) {
      res.status(400).json({ 
        error: 'Site parameter is required'
      });
      return;
    }
    
    logger.info(`Fetching orders for site: ${site}, date: ${date}, procedureType: ${procedureType}`);
    
    // Validate user has access to this site
    const userSites = req.user?.metadata?.sites || [];
    const userHasFullAccess = req.user?.metadata?.positionCode === 99;
    
    if (!userHasFullAccess && !userSites.includes(site)) {
      res.status(403).json({
        error: 'Access denied to this site'
      });
      return;
    }
    
    // Get orders from Priority for the specified site using exact CUSTNAME filtering
    let orders = await priorityService.getOrdersForSiteWithFilter(site);
    
    // Filter orders by date if provided
    if (date) {
      const targetDate = new Date(date).toISOString().split('T')[0];
      logger.info(`Filtering orders by target date: ${targetDate}`);
      
      const beforeFilter = orders.length;
      orders = orders.filter((order: any) => {
        if (!order.CURDATE && !order.SIBD_DATE) {
          logger.debug(`Order ${order.ORDNAME || 'unknown'} has no date field`);
          return false;
        }
        
        const orderDate = new Date(order.CURDATE || order.SIBD_DATE).toISOString().split('T')[0];
        const matches = orderDate === targetDate;
        
        if (!matches) {
          logger.debug(`Order ${order.ORDNAME || 'unknown'} date ${orderDate} does not match target ${targetDate}`);
        }
        
        return matches;
      });
      
      logger.info(`Date filtering: ${beforeFilter} orders -> ${orders.length} orders for date ${targetDate}`);
    }
    
    // Filter by procedure type if needed
    if (procedureType === 'removal') {
      // For removal procedures, filter orders that are 14+ days old
      const today = new Date();
      orders = orders.filter((order: any) => {
        if (!order.CURDATE && !order.SIBD_DATE) return false;
        
        const orderDate = new Date(order.CURDATE || order.SIBD_DATE);
        const daysSinceInsertion = Math.floor(
          (today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysSinceInsertion >= 14 && daysSinceInsertion <= 20;
      });
    }
    
    logger.info(`Found ${orders.length} orders for site ${site}`);
    
    res.status(200).json({
      success: true,
      orders: orders,
      site: site,
      date: date,
      count: orders.length
    });
  } catch (error: any) {
    logger.error(`Error fetching orders for site and date: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Get order details using SIBD_APPLICATUSELIST_SUBFORM
// @route   GET /api/proxy/priority/orders/:orderId/subform
// @access  Private
export const getOrderSubform = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      res.status(400).json({ 
        error: 'Order ID is required'
      });
      return;
    }
    
    logger.info(`Fetching subform data for order: ${orderId}`);
    
    // Get subform data from Priority
    const subformData = await priorityService.getOrderSubform(orderId);
    
    logger.info(`Retrieved ${subformData.length} subform records for order ${orderId}`);
    
    res.status(200).json({
      success: true,
      orderId: orderId,
      data: subformData,
      count: subformData.length
    });
  } catch (error: any) {
    logger.error(`Error fetching order subform: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Get detailed order information including seed quantity and activity
// @route   GET /api/proxy/priority/orders/:orderId/details
// @access  Private
export const getOrderDetails = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      res.status(400).json({ 
        error: 'Order ID is required'
      });
      return;
    }
    
    logger.info(`Fetching detailed order information for: ${orderId}`);
    
    // Get detailed order information from Priority
    const orderDetails = await priorityService.getOrderDetails(orderId);
    
    logger.info(`Retrieved detailed order information for ${orderId}`);
    
    res.status(200).json({
      success: true,
      orderId: orderId,
      data: orderDetails
    });
  } catch (error: any) {
    logger.error(`Error fetching order details: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @desc    Validate applicator for manual entry
// @route   POST /api/proxy/priority/validate-applicator
// @access  Private
export const validateApplicator = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { serialNumber, currentSite, currentDate } = req.body;
    
    if (!serialNumber || !currentSite || !currentDate) {
      res.status(400).json({ 
        error: 'Serial number, current site, and current date are required'
      });
      return;
    }
    
    logger.info(`Validating applicator: ${serialNumber} for site: ${currentSite}`);
    
    // Validate applicator using Priority service
    const validationResult = await priorityService.validateApplicatorForManualEntry(
      serialNumber, 
      currentSite, 
      currentDate
    );
    
    logger.info(`Applicator validation result for ${serialNumber}: ${validationResult.valid ? 'VALID' : 'INVALID'}`);
    
    res.status(200).json({
      success: true,
      validation: validationResult
    });
  } catch (error: any) {
    logger.error(`Error validating applicator: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
