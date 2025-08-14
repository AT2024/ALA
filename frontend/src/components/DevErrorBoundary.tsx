import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
}

class DevErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.group('🚨 Error Boundary Caught Error');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo.componentStack);
    
    // Log current state for debugging
    const debugInfo = {
      localStorage: Object.keys(localStorage).reduce((acc, key) => {
        if (key.includes('cached') || key.includes('user') || key.includes('treatment')) {
          acc[key] = localStorage.getItem(key);
        }
        return acc;
      }, {} as Record<string, string | null>),
      sessionStorage: Object.keys(sessionStorage).reduce((acc, key) => {
        acc[key] = sessionStorage.getItem(key);
        return acc;
      }, {} as Record<string, string | null>),
      url: window.location.href,
      timestamp: new Date().toISOString()
    };
    
    console.error('Debug Info at Error Time:', debugInfo);
    console.groupEnd();
    
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError && process.env.NODE_ENV === 'development') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 font-bold">!</span>
                </div>
              </div>
              <div className="ml-3">
                <h1 className="text-lg font-medium text-gray-900">
                  Development Error
                </h1>
                <p className="text-sm text-gray-500">
                  Check the console for detailed error information
                </p>
              </div>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <h3 className="text-sm font-medium text-red-800 mb-2">Error Message:</h3>
              <p className="text-xs text-red-700 font-mono break-all">
                {this.state.error?.message}
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700 transition-colors"
              >
                Reload Page
              </button>
              <button
                onClick={() => {
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.href = '/login';
                }}
                className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md text-sm hover:bg-gray-700 transition-colors"
              >
                Clear Data & Restart
              </button>
            </div>
            
            <div className="mt-4 text-xs text-gray-500">
              <p>This error boundary only shows in development mode.</p>
            </div>
          </div>
        </div>
      );
    }

    if (this.state.hasError) {
      // In production, just show a simple error message
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Something went wrong
            </h1>
            <p className="text-gray-600 mb-4">
              Please refresh the page and try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default DevErrorBoundary;