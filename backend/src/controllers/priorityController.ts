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
        sites: priorityUserAccess.sites || []
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
    // DEBUG: Log that we reached this controller
    logger.info('🎯 === PRIORITY ORDERS CONTROLLER REACHED - NEW VERSION ===');
    logger.info(`Timestamp: ${new Date().toISOString()}`);
    logger.info(`Request Method: ${req.method}`);
    logger.info(`Request URL: ${req.originalUrl}`);
    logger.info(`Request Path: ${req.path}`);
    logger.info(`Request Body:`, req.body);
    logger.info('=================================');
    
    const { site, date, procedureType } = req.body;
    
    if (!site) {
      logger.error('❌ Missing site parameter');
      res.status(400).json({ 
        error: 'Site parameter is required'
      });
      return;
    }
    
    logger.info(`✅ Starting order fetch for site: ${site}, date: ${date}, procedureType: ${procedureType}`);
    
    // Validate user has access to this site
    const userSites = req.user?.metadata?.sites || [];
    const userHasFullAccess = req.user?.metadata?.positionCode === 99;
    
    if (!userHasFullAccess && !userSites.includes(site)) {
      res.status(403).json({
        error: 'Access denied to this site'
      });
      return;
    }
    
    // Get orders from Priority for the specified site using exact CUSTNAME and date filtering
    let orders = await priorityService.getOrdersForSiteWithFilter(site, req.user?.email, date);
    
    logger.info(`Retrieved ${orders.length} orders from Priority service for site ${site}`);
    
    // DEBUG: Log raw Priority API response
    logger.info('=== RAW PRIORITY API RESPONSE DEBUG ===');
    logger.info(`Site: ${site}, Date: ${date}, ProcedureType: ${procedureType}`);
    logger.info(`Raw orders count: ${orders.length}`);
    orders.forEach((order: any, index: number) => {
      logger.info(`RAW ORDER ${index + 1}:`);
      logger.info(`  ORDNAME: ${order.ORDNAME}`);
      logger.info(`  CUSTNAME: ${order.CUSTNAME}`);
      logger.info(`  REFERENCE: ${order.REFERENCE}`);
      logger.info(`  CURDATE: ${order.CURDATE}`);
      logger.info(`  SIBD_TREATDAY: ${order.SIBD_TREATDAY}`);
      logger.info(`  SBD_SEEDQTY: ${order.SBD_SEEDQTY}`);
      logger.info(`  SBD_PREFACTIV: ${order.SBD_PREFACTIV}`);
      logger.info(`  Full object:`, JSON.stringify(order, null, 2));
    });
    logger.info('=== END RAW PRIORITY API RESPONSE ===');
    
    // 🎯 Orders are already filtered by date and site at Priority API level
    logger.info(`✅ Orders already filtered by Priority API - no additional filtering needed`);
    
    // Validate and clean order data (basic validation only)
    const validOrders = orders.filter((order: any) => {
      // Check for required fields
      if (!order.ORDNAME) {
        logger.warn(`⚠️ Skipping order without ORDNAME:`, order);
        return false;
      }
      
      if (!order.CUSTNAME) {
        logger.warn(`⚠️ Order ${order.ORDNAME} missing CUSTNAME`);
        return false;
      }
      
      // Orders already have proper date filtering at API level
      logger.info(`✅ VALIDATED - Order: ${order.ORDNAME}, Site: ${order.CUSTNAME}, Treatment Date: ${order.SIBD_TREATDAY}`);
      
      return true;
    });
    
    logger.info(`📊 VALIDATION SUMMARY: ${validOrders.length} valid orders (removed ${orders.length - validOrders.length} invalid)`);
    
    // Use all valid orders since date filtering is already done at Priority API level
    orders = validOrders;
    
    if (orders.length > 0) {
      logger.info(`✅ PRIORITY API FILTERED ORDERS:`);
      orders.forEach((order: any) => {
        logger.info(`  📋 ${order.ORDNAME} | Site: ${order.CUSTNAME} | Treatment: ${order.SIBD_TREATDAY} | Seeds: ${order.SBD_SEEDQTY}`);
      });
    } else {
      logger.info(`📭 No orders found for site ${site} on date ${date} (already filtered by Priority API)`);
    }
    
    // Filter by procedure type if needed
    if (procedureType === 'removal') {
      // For removal procedures, filter orders that are 14+ days old
      const today = new Date();
      orders = orders.filter((order: any) => {
        if (!order.CURDATE && !order.SIBD_TREATDAY) return false;
        
        const orderDate = new Date(order.SIBD_TREATDAY || order.CURDATE);
        const daysSinceInsertion = Math.floor(
          (today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysSinceInsertion >= 14 && daysSinceInsertion <= 20;
      });
    }
    
    // Log final results with detailed breakdown
    logger.info(`Final results for site ${site}:`);
    logger.info(`- Total orders found: ${orders.length}`);
    logger.info(`- Date filter applied: ${date || 'None'}`);
    logger.info(`- Procedure type filter: ${procedureType || 'None'}`);
    
    // Add validation summary to response
    const response = {
      success: true,
      orders: orders,
      site: site,
      date: date,
      count: orders.length,
      metadata: {
        totalRetrieved: validOrders.length,
        afterDateFilter: orders.length,
        filters: {
          site,
          date: date || null,
          procedureType: procedureType || null
        }
      }
    };
    
    logger.info(`Returning ${orders.length} orders for site ${site}`);
    res.status(200).json(response);
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
    const subformData = await priorityService.getOrderSubform(orderId, req.user?.email);
    
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

// @desc    Get available applicators for a treatment
// @route   GET /api/proxy/priority/applicators/available
// @access  Private
export const getAvailableApplicators = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { site, currentDate } = req.query;
    
    logger.info(`Received request for available applicators - Site: ${site}, Date: ${currentDate}, User: ${req.user?.email}`);
    
    if (!site || !currentDate) {
      logger.error('Missing required parameters: site and currentDate are required');
      res.status(400).json({ 
        success: false,
        error: 'Site and current date are required',
        receivedParams: { site, currentDate }
      });
      return;
    }
    
    // Validate user has access to this site
    const userSites = req.user?.metadata?.sites || [];
    const userHasFullAccess = req.user?.metadata?.positionCode === 99;
    
    if (!userHasFullAccess && !userSites.includes(site)) {
      logger.error(`User ${req.user?.email} does not have access to site ${site}. User sites: ${userSites.join(', ')}`);
      res.status(403).json({
        success: false,
        error: `Access denied to site ${site}`,
        userSites: userSites
      });
      return;
    }
    
    logger.info(`User ${req.user?.email} has access to site ${site}. Getting available applicators...`);
    
    // Get available applicators from Priority service
    const applicators = await priorityService.getAvailableApplicatorsForTreatment(
      site as string, 
      currentDate as string,
      req.user?.email
    );
    
    logger.info(`Successfully retrieved ${applicators.length} available applicators for site ${site}`);
    
    res.status(200).json({
      success: true,
      applicators: applicators,
      count: applicators.length,
      site: site,
      date: currentDate
    });
  } catch (error: any) {
    logger.error(`Error getting available applicators for site ${req.query.site}: ${error.message}`);
    
    // Enhanced error logging
    if (error.response) {
      logger.error(`Priority API error response:`, {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      site: req.query.site,
      date: req.query.currentDate
    });
  }
});

// @desc    Search applicators by name with fuzzy matching
// @route   POST /api/proxy/priority/applicators/search
// @access  Private
export const searchApplicators = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { query, site, currentDate } = req.body;
    
    if (!query || !site || !currentDate) {
      res.status(400).json({ 
        error: 'Query, site, and current date are required'
      });
      return;
    }
    
    logger.info(`Searching applicators with query: "${query}" for site: ${site}`);
    
    // Search applicators using Priority service
    const searchResult = await priorityService.searchApplicatorsByName(
      query, 
      site, 
      currentDate
    );
    
    logger.info(`Search result - Found: ${searchResult.found}, Suggestions: ${searchResult.suggestions?.length || 0}`);
    
    res.status(200).json({
      success: true,
      result: searchResult
    });
  } catch (error: any) {
    logger.error(`Error searching applicators: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

