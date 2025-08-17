import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

interface LayoutProps {
  children: ReactNode;
  title: string;
  showBackButton?: boolean;
  backPath?: string;
  showLogout?: boolean;
}

// Pages where Next button should be hidden (end pages)
const END_PAGES = ['/treatment/list', '/treatment/removal'];

export default function Layout({ 
  children, 
  title, 
  showBackButton = false, 
  backPath = '', 
  showLogout = true 
}: LayoutProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  const handleBack = () => {
    if (backPath) {
      navigate(backPath);
    } else {
      navigate(-1);
    }
  };
  
  // Helper function to navigate through the treatment flow
  const navigateSequential = (direction: 'next') => {
    const currentPath = window.location.pathname;
    
    // Only handle 'next' direction - 'prev' removed per user request
    if (direction === 'next') {
      // Smart navigation based on current page and procedure type
      switch (currentPath) {
        case '/procedure-type':
          navigate('/treatment/select');
          break;
        case '/treatment/select':
          // Check if there's a Proceed button we can click instead
          const proceedButton = document.querySelector('button[type="button"]:not([disabled])') as HTMLButtonElement;
          if (proceedButton && proceedButton.textContent?.includes('Proceed')) {
            proceedButton.click();
          } else {
            console.warn('Next: Treatment form not complete - please fill all required fields');
          }
          break;
        case '/treatment/scan':
          navigate('/treatment/list');
          break;
        case '/treatment/removal':
        case '/treatment/list':
          // End pages - Next button should be hidden
          console.warn('Next button should not be visible on end pages');
          break;
        default:
          // Fallback to browser history for other pages
          navigate(1);
      }
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-primary p-4 text-white shadow-md">
        <div className="container mx-auto flex items-center justify-between">
          {/* Left section - Title with back button */}
          <div className="flex items-center gap-2">
            {showBackButton && (
              <button
                onClick={handleBack}
                className="rounded-full p-2 hover:bg-primary-foreground/10"
                title="Back to specified path"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
            )}
            <h1 className="text-xl font-bold">{title}</h1>
          </div>
          
          {/* Middle section - Debug navigation */}
          <div className="flex flex-col items-center">
            {/* Flow position indicator */}
            <div className="mb-1 text-xs text-white/70">
              {!END_PAGES.includes(window.location.pathname) && (
                <span>Treatment Flow - Navigation</span>
              )}
            </div>
            {/* Only show Next button if not on end pages */}
            {!END_PAGES.includes(window.location.pathname) && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigateSequential('next')}
                  className="flex items-center justify-center rounded-md bg-primary-foreground/10 px-3 py-2 text-sm font-medium hover:bg-primary-foreground/20"
                  title="Next screen (for debugging)"
                >
                  Next
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="ml-1"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </div>
            )}
          </div>
          
          {/* Right section - User info and logout */}
          <div className="flex items-center gap-4">
            {user && (
              <div className="text-sm">
                <span className="text-white/80">User: </span>
                <span className="font-semibold">{user.name}</span>
              </div>
            )}
            {showLogout && (
              <button
                onClick={logout}
                className="rounded-md bg-primary-foreground/10 px-3 py-1 text-sm hover:bg-primary-foreground/20"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto flex-1 p-4">
        {children}
      </main>

      <footer className="border-t bg-secondary p-4 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} AlphaTau Medical Ltd. All rights reserved.</p>
      </footer>
    </div>
  );
}
