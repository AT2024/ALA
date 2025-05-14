import api from './api';

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    phoneNumber: string;
    role: 'hospital' | 'alphatau' | 'admin';
    name: string;
  };
  token: string;
}

export const authService = {
  // Request verification code via SMS or email
  async requestVerificationCode(identifier: string): Promise<void> {
    // Always use the full API path for dev safety
    await api.post('/api/auth/request-code', { identifier });
  },

  // Verify the code and get authentication token
  async verifyCode(identifier: string, code: string): Promise<AuthResponse> {
    // Always use the full API path for dev safety
    const response = await api.post<AuthResponse>('/api/auth/verify', {
      identifier,
      code,
    });
    return response.data;
  },

  // Validate token with the backend
  async validateToken(token: string): Promise<boolean> {
    try {
      const response = await api.post('/api/auth/validate-token', {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  },

  // Request a resend of the verification code
  async resendVerificationCode(identifier: string): Promise<void> {
    await api.post('/api/auth/resend-code', { identifier });
  }
};
