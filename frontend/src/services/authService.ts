import api from './api';

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    phoneNumber: string;
    role: 'hospital' | 'alphatau' | 'admin';
    name: string;
    positionCode?: string;
    custName?: string;
    sites?: string[];
    fullAccess?: boolean;
  };
  token: string;
}

export const authService = {
  // Request verification code via email or phone with Priority system validation
  async requestVerificationCode(identifier: string): Promise<{
    success: boolean;
    message?: string;
    userData?: {
      name: string;
      email: string;
      phoneNumber: string;
      positionCode: string;
      custName: string;
      sites?: string[];
      fullAccess?: boolean;
    };
  }> {
    try {
      console.log('Requesting verification code for:', identifier);
      
      // Validate identifier format
      const isEmail = identifier.includes('@');
      const isPhone = /^[\d\s\-\+\(\)]+$/.test(identifier.trim());
      
      if (!isEmail && !isPhone) {
        return {
          success: false,
          message: 'Please enter a valid email address or phone number.'
        };
      }
      
      // The backend will validate against Priority PHONEBOOK table
      const response = await api.post('/auth/request-code', { 
        identifier: identifier.trim()
      });
      
      return {
        success: true,
        message: `Verification code sent to ${identifier}. Use code 123456 for verification.`,
        userData: response.data.userData
      };
    } catch (error: any) {
      console.error('Error requesting verification code:', error);
      
      // Enhanced error handling based on Priority system responses
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;
        
        switch (status) {
          case 404:
            return {
              success: false,
              message: 'User not found in the Priority system. Please contact the ATM team to set up your account.'
            };
          case 401:
            return {
              success: false,
              message: 'Access denied. Your account may not have the necessary permissions.'
            };
          case 403:
            return {
              success: false,
              message: 'Your account is not authorized to access this system.'
            };
          case 500:
            return {
              success: false,
              message: 'System error while connecting to Priority. Please try again or contact support.'
            };
          case 503:
            return {
              success: false,
              message: 'Priority system is temporarily unavailable. Please try again later.'
            };
          default:
            return {
              success: false,
              message: errorData?.message || 'Failed to validate user credentials. Please try again.'
            };
        }
      }
      
      // Network or other errors
      if (error.code === 'NETWORK_ERROR' || !navigator.onLine) {
        return {
          success: false,
          message: 'Network connection error. Please check your internet connection and try again.'
        };
      }
      
      return {
        success: false,
        message: error.message || 'Failed to request verification code. Please try again.'
      };
    }
  },

  // Verify the code and get authentication token
  async verifyCode(identifier: string, code: string): Promise<AuthResponse> {
    try {
      const response = await api.post<AuthResponse>('/auth/verify', {
        identifier: identifier.trim(),
        code: code.trim(),
      });
      
      // Enhance user data with Priority information
      const userData = response.data.user;
      
      // Determine user role based on Priority position code
      let role: 'hospital' | 'alphatau' | 'admin' = 'hospital';
      if (userData.positionCode === '99') {
        role = 'alphatau'; // ATM users with full access
      } else if (userData.positionCode && parseInt(userData.positionCode) >= 50) {
        role = 'admin'; // Site administrators
      }
      
      return {
        ...response.data,
        user: {
          ...userData,
          role
        }
      };
    } catch (error: any) {
      console.error('Error verifying code:', error);
      
      if (error.response) {
        const status = error.response.status;
        const errorData = error.response.data;
        
        if (status === 400) {
          throw new Error('Invalid verification code. Please check the code and try again.');
        } else if (status === 408 || status === 410) {
          throw new Error('Verification code has expired. Please request a new code.');
        } else if (status === 429) {
          throw new Error('Too many attempts. Please wait a few minutes before trying again.');
        }
        
        throw new Error(errorData?.message || 'Verification failed. Please try again.');
      }
      
      throw new Error('Verification failed. Please check your connection and try again.');
    }
  },

  // Validate token with the backend
  async validateToken(token: string): Promise<boolean> {
    try {
      const response = await api.post('/auth/validate-token', {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  },

  // Request a resend of the verification code
  async resendVerificationCode(identifier: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      await api.post('/auth/resend-code', { 
        identifier: identifier.trim() 
      });
      
      return {
        success: true,
        message: 'Verification code resent successfully.'
      };
    } catch (error: any) {
      console.error('Error resending verification code:', error);
      
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to resend verification code. Please try again.'
      };
    }
  },
  
  // Get user's site access information
  async getUserSiteAccess(userId: string): Promise<{
    sites: string[];
    fullAccess: boolean;
  }> {
    try {
      const response = await api.get(`/auth/user-sites/${userId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error getting user site access:', error);
      
      // Return default access in case of error
      return {
        sites: [],
        fullAccess: false
      };
    }
  }
};
