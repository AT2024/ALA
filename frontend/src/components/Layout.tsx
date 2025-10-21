import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useWorkflowNavigation } from '@/hooks/useWorkflowNavigation';

interface LayoutProps {
  children: ReactNode;
  title: string;
  showBackButton?: boolean;
  backPath?: string;
  showLogout?: boolean;
}

export default function Layout({
  children,
  title,
  showBackButton = false,
  backPath = '',
  showLogout = true
}: LayoutProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { navigateBack, navigateNext, getCurrentStepInfo } = useWorkflowNavigation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleBack = () => {
    if (backPath) {
      navigate(backPath);
    } else {
      navigate(-1);
    }
  };

  // FIXED: Helper function to navigate through the workflow-aware treatment flow
  // This replaces the hardcoded TREATMENT_FLOW that caused the bug
  const navigateSequential = (direction: 'next' | 'prev') => {
    if (direction === 'prev') {
      navigateBack(); // Uses workflow-aware navigation
    } else {
      navigateNext(); // Uses workflow-aware navigation
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-primary text-white shadow-md">
        <div className="container mx-auto">
          {/* Mobile-first header: stacked layout on mobile, flex-row on md+ */}
          <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            {/* Top row on mobile: Logo, title, hamburger menu */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Logo: compact on mobile (h-6), full on desktop (h-8) */}
                <img
                  src="/alphataulogo.png"
                  alt="AlphaTau Medical"
                  className="h-6 w-auto md:h-8"
                />
                {showBackButton && (
                  <button
                    onClick={handleBack}
                    className="min-h-[44px] min-w-[44px] rounded-full p-2 hover:bg-primary-foreground/10"
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
                <h1 className="truncate text-sm font-bold md:text-xl md:text-clip max-w-[140px] sm:max-w-[200px] md:max-w-none">{title}</h1>
              </div>

              {/* Hamburger menu button - visible only on mobile */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="min-h-[44px] min-w-[44px] rounded-md p-2 hover:bg-primary-foreground/10 md:hidden"
                aria-label="Toggle menu"
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
                  {mobileMenuOpen ? (
                    <path d="M18 6 6 18M6 6l12 12" />
                  ) : (
                    <>
                      <path d="M3 12h18M3 6h18M3 18h18" />
                    </>
                  )}
                </svg>
              </button>
            </div>

            {/* Middle section - workflow navigation: hidden on mobile when menu closed, visible on md+ */}
            <div className={`${mobileMenuOpen ? 'flex' : 'hidden'} flex-col items-start gap-3 md:flex md:flex-col md:items-center`}>
              {/* Flow position indicator */}
              <div className="text-xs text-white/70 md:mb-1 truncate max-w-full">
                {(() => {
                  const stepInfo = getCurrentStepInfo();
                  return stepInfo.isInWorkflow && (
                    <span className="truncate">
                      Step {stepInfo.currentStep}/{stepInfo.totalSteps} - {stepInfo.procedureType?.toUpperCase()} Flow
                    </span>
                  );
                })()}
              </div>
              <div className="flex w-full items-center gap-2 md:w-auto md:gap-1">
                <button
                  onClick={() => navigateSequential('prev')}
                  className="flex min-h-[44px] flex-1 items-center justify-center rounded-md bg-primary-foreground/10 px-4 py-2 text-sm font-medium hover:bg-primary-foreground/20 md:flex-initial md:px-3"
                  title="Previous screen - workflow aware"
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
                  className="flex min-h-[44px] flex-1 items-center justify-center rounded-md bg-primary-foreground/10 px-4 py-2 text-sm font-medium hover:bg-primary-foreground/20 md:flex-initial md:px-3"
                  title="Next screen - workflow aware"
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

            {/* Right section - User info and logout: hidden on mobile when menu closed, visible on md+ */}
            <div className={`${mobileMenuOpen ? 'flex' : 'hidden'} w-full flex-col gap-3 md:flex md:w-auto md:flex-row md:items-center md:gap-4`}>
              {user && (
                <div className="text-sm">
                  <span className="text-white/80">User: </span>
                  <span className="font-semibold">{user.name}</span>
                </div>
              )}
              {showLogout && (
                <button
                  onClick={logout}
                  className="min-h-[44px] w-full rounded-md bg-primary-foreground/10 px-4 py-2 text-sm hover:bg-primary-foreground/20 md:w-auto md:px-3 md:py-1"
                >
                  Logout
                </button>
              )}
            </div>
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