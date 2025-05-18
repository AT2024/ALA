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
  };
  token: string;
}

export const authService = {
  // Request verification code via SMS or email
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
    };
  }> {
    try {
      console.log('Requesting verification code for:', identifier);
      
      // The backend will validate emails with Priority
      const response = await api.post('/auth/request-code', { identifier });
      
      return {
        success: true,
        message: 'Verification code sent',
        userData: response.data.userData
      };
    } catch (error: any) {
      console.error('Error requesting verification code:', error);
      
      // For development/debugging, handle only test@example.com as the test email
      if (identifier === 'test@example.com') {
        console.log('Using fallback for test email');
        return {
          success: true,
          message: 'Test verification code sent (123456)',
          userData: {
            name: 'Test User',
            email: identifier,
            phoneNumber: '+1234567890',
            positionCode: '99',
            custName: '100078',
            sites: ['100078']
          }
        };
      }
      
      // Provide a user-friendly error message based on status code
      if (error.response) {
        if (error.response.status === 404) {
          return {
            success: false,
            message: 'User not found in the Priority system. Please check your email and try again.'
          };
        } else if (error.response.status === 500) {
          return {
            success: false,
            message: 'System error while connecting to Priority. Please try again or contact support.'
          };
        }
      }
      
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to request verification code'
      };
    }
  },

  // Verify the code and get authentication token
  async verifyCode(identifier: string, code: string): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/verify', {
      identifier,
      code,
    });
    
    return response.data;
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
  async resendVerificationCode(identifier: string): Promise<void> {
    await api.post('/auth/resend-code', { identifier });
  }
};
