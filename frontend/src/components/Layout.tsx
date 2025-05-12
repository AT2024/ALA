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

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-primary p-4 text-white shadow-md">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {showBackButton && (
              <button
                onClick={handleBack}
                className="rounded-full p-2 hover:bg-primary-foreground/10"
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
