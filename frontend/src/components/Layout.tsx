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

// Define the treatment flow sequence to enable sequential navigation
const TREATMENT_FLOW = [
  '/treatment/select',   // Treatment selection
  '/treatment/scan',     // Scan QR Code
  '/treatment/applicator', // Applicator information
  '/treatment/list',     // Use list
  '/treatment/removal'   // Seed removal
];

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
  const navigateSequential = (direction: 'next' | 'prev') => {
    const currentPath = window.location.pathname;
    const currentIndex = TREATMENT_FLOW.indexOf(currentPath);
    
    if (currentIndex !== -1) {
      // If we're in the treatment flow
      const newIndex = direction === 'next' 
        ? Math.min(currentIndex + 1, TREATMENT_FLOW.length - 1)
        : Math.max(currentIndex - 1, 0);
      
      if (newIndex !== currentIndex) {
        navigate(TREATMENT_FLOW[newIndex]);
      }
    } else {
      // If we're not in the treatment flow, use browser history
      navigate(direction === 'next' ? 1 : -1);
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
              {TREATMENT_FLOW.indexOf(window.location.pathname) !== -1 && (
                <span>
                  Step {TREATMENT_FLOW.indexOf(window.location.pathname) + 1}/{TREATMENT_FLOW.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateSequential('prev')}
                className="flex items-center justify-center rounded-md bg-primary-foreground/10 px-3 py-2 text-sm font-medium hover:bg-primary-foreground/20"
                title="Previous screen (for debugging)"
              >
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
                  className="mr-1"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
                Prev
              </button>
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
