import logger from '../utils/logger';

// This service provides mock data when real Priority API is unavailable
const mockPriorityService = {
  // Mock user data for testing
  getMockUserByEmail(email: string): any {
    logger.info(`Getting mock user data for email: ${email}`);
    
    // Demo users for testing
    const mockUsers = [
      {
        EMAIL: 'test@example.com',
        NAME: 'Test User',
        PHONE: '+972501234567',
        POSITIONCODE: '10',
        CUSTNAME: '100001'
      },
      {
        EMAIL: 'admin@example.com',
        NAME: 'Admin User',
        PHONE: '+972509876543',
        POSITIONCODE: '99',
        CUSTNAME: '100002'
      },
      {
        EMAIL: 'doctor@hospital.com',
        NAME: 'Doctor Smith',
        PHONE: '+972505555555',
        POSITIONCODE: '20',
        CUSTNAME: '100003'
      },
      // {
      //   EMAIL: 'tzufitc@alphatau.com',
      //   NAME: 'TzufitC',
      //   PHONE: '971',
      //   POSITIONCODE: '99',
      //   CUSTNAME: '100078'
      // }
    ];
    
    // Find the user by email (case-insensitive)
    return mockUsers.find(user => user.EMAIL.toLowerCase() === email.toLowerCase());
  },
  
  // Get mock PHONEBOOK data
  getMockContacts(): any[] {
    logger.info('Getting mock contacts data');
    
    return [
      {
        EMAIL: 'test@example.com',
        NAME: 'Test User',
        PHONE: '+972501234567',
        POSITIONCODE: '10',
        CUSTNAME: '100001',
        CUSTDES: 'Hospital A'
      },
      {
        EMAIL: 'admin@example.com',
        NAME: 'Admin User',
        PHONE: '+972509876543',
        POSITIONCODE: '99',
        CUSTNAME: '100002',
        CUSTDES: 'Admin Office'
      },
      {
        EMAIL: 'doctor@hospital.com',
        NAME: 'Doctor Smith',
        PHONE: '+972505555555',
        POSITIONCODE: '20',
        CUSTNAME: '100003',
        CUSTDES: 'Hospital C'
      },
      {
        EMAIL: 'nurse@hospital.com',
        NAME: 'Nurse Johnson',
        PHONE: '+972507777777',
        POSITIONCODE: '30',
        CUSTNAME: '100003',
        CUSTDES: 'Hospital C'
      },
      {
        EMAIL: 'tech@alphatau.com',
        NAME: 'Tech Support',
        PHONE: '+972508888888',
        POSITIONCODE: '40',
        CUSTNAME: '100004',
        CUSTDES: 'Alpha Tau'
      },
      // {
      //   EMAIL: 'tzufitc@alphatau.com',
      //   NAME: 'TzufitC',
      //   PHONE: '971',
      //   POSITIONCODE: '99',
      //   CUSTNAME: '100078',
      //   CUSTDES: 'ATM'
      // }
    ];
  },
  
  // Get mock ORDERS data
  getMockOrders(custName?: string): any[] {
    logger.info(`Getting mock orders data${custName ? ` for customer: ${custName}` : ''}`);
    
    const allOrders = [
      {
        ORDNAME: 'ORD001',
        CUSTNAME: '100001',
        CUSTDES: 'Hospital A',
        SIBD_TREATDAY: '2025-05-10',
        TYPEDES: 'Inert',
        BOOLCLOSED: 'N',
        SBD_APPLICATOR: '12345',
        TOTQUANT: 5
      },
      {
        ORDNAME: 'ORD002',
        CUSTNAME: '100001',
        CUSTDES: 'Hospital A',
        SIBD_TREATDAY: '2025-05-15',
        TYPEDES: 'Active',
        BOOLCLOSED: 'N',
        SBD_APPLICATOR: '67890',
        TOTQUANT: 3
      },
      {
        ORDNAME: 'ORD003',
        CUSTNAME: '100003',
        CUSTDES: 'Hospital C',
        SIBD_TREATDAY: '2025-05-12',
        TYPEDES: 'Inert',
        BOOLCLOSED: 'Y',
        SBD_APPLICATOR: '24680',
        TOTQUANT: 2
      },
      {
        ORDNAME: 'ORD004',
        CUSTNAME: '100004',
        CUSTDES: 'AlphaTau Office',
        SIBD_TREATDAY: '2025-05-20',
        TYPEDES: 'Inert',
        BOOLCLOSED: 'N',
        SBD_APPLICATOR: '13579',
        TOTQUANT: 10
      },
      {
        ORDNAME: 'ORD005',
        CUSTNAME: '100078',
        CUSTDES: 'ATM',
        SIBD_TREATDAY: '2025-05-17',
        TYPEDES: 'Inert',
        BOOLCLOSED: 'N',
        SBD_APPLICATOR: '54321',
        TOTQUANT: 7
      }
    ];
    
    if (!custName) {
      return allOrders;
    }
    
    return allOrders.filter(order => order.CUSTNAME === custName);
  }
};

export default mockPriorityService;