import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { authService } from '@/services/authService';

const VerificationPage = () => {
  const { verify, error, clearError, isLoading } = useAuth();
  const [code, setCode] = useState('');
  const [remainingTime, setRemainingTime] = useState(10); // 10 seconds timeout
  const [resendDisabled, setResendDisabled] = useState(true);
  const navigate = useNavigate();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Start countdown timer
  const startCountdown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRemainingTime(10);
    setResendDisabled(true);

    timerRef.current = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          setResendDisabled(false);
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Start countdown on mount
  useEffect(() => {
    startCountdown();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startCountdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code) {
      await verify(code);
    }
  };

  const handleResendCode = async () => {
    try {
      // Get the identifier from local storage or session
      const identifier = sessionStorage.getItem('loginIdentifier');
      if (!identifier) {
        // If not found, go back to login
        navigate('/login');
        return;
      }

      await authService.resendVerificationCode(identifier);
      startCountdown();
    } catch (err) {
      console.error('Failed to resend code:', err);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img 
            src="/logo.png" 
            alt="AlphaTau Logo" 
            className="mx-auto mb-4 h-16 w-auto"
          />
          <h1 className="text-2xl font-bold text-gray-900">
            Verification Code
          </h1>
          <p className="mt-2 text-gray-600">
            Enter the verification code sent to your email or phone
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p>{error}</p>
              </div>
              <div className="ml-auto pl-3">
                <div className="-mx-1.5 -my-1.5">
                  <button
                    onClick={clearError}
                    className="inline-flex rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none"
                  >
                    <span className="sr-only">Dismiss</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="code"
              className="block text-sm font-medium text-gray-700"
            >
              Verification Code
            </label>
            <div className="mt-1">
              <input
                id="code"
                name="code"
                type="text"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col space-y-4">
            <button
              type="submit"
              disabled={isLoading || !code}
              className="flex w-full justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Verifying...
                </>
              ) : (
                'Verify Code'
              )}
            </button>
            
            <button
              type="button"
              disabled={resendDisabled}
              onClick={handleResendCode}
              className="text-sm font-medium text-primary hover:text-primary/80 disabled:text-gray-400"
            >
              {resendDisabled
                ? `Resend code in ${remainingTime}s`
                : 'Resend verification code'}
            </button>
            
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Back to login
            </button>
          </div>
        </form>
        <p className="mt-8 text-center text-xs text-gray-400">v{APP_VERSION}</p>
      </div>
    </div>
  );
};

export default VerificationPage;
