
import React, { useState, useEffect, useMemo } from 'react';
import { ThemeContextType, Model } from './types.ts'; // Added Model for potential future use if needed here
import ChatPage from './components/ChatPage.tsx';
import Header, { MockUser } from './components/Header.tsx'; // Import MockUser type
import { NotificationProvider } from './contexts/NotificationContext.tsx';
import { KeyIcon } from './components/Icons.tsx';

export const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) {
      return storedTheme as 'light' | 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Authentication state
  const [currentUser, setCurrentUser] = useState<MockUser | null>(null);
  const [isLoginModalInitiallyOpen, setIsLoginModalInitiallyOpen] = useState(false);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Check auth status on mount
  useEffect(() => {
    if (!currentUser) {
      setIsLoginModalInitiallyOpen(true); // Trigger modal open via Header prop
    }
  }, []); // Empty dependency array: run only on mount


  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const handleLogin = (user: MockUser) => {
    setCurrentUser(user);
    setIsLoginModalInitiallyOpen(false); // Close modal if it was opened automatically
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoginModalInitiallyOpen(true); // Prepare to open modal on next render if needed
  };

  const themeContextValue = useMemo(() => ({ theme, toggleTheme }), [theme]);

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <NotificationProvider>
        <div className="flex flex-col h-screen bg-secondary-light dark:bg-neutral-dark transition-colors duration-300">
          <Header
            currentUser={currentUser}
            onLogin={handleLogin}
            onLogout={handleLogout}
            openLoginModalInitially={isLoginModalInitiallyOpen}
            onLoginModalOpened={() => setIsLoginModalInitiallyOpen(false)} // Reset trigger once modal is handled by Header
          />
          <main className="flex-grow overflow-hidden">
            {currentUser ? (
              <ChatPage />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <KeyIcon className="w-16 h-16 text-primary dark:text-primary-light mb-6" />
                <h2 className="text-3xl font-semibold text-neutral-darker dark:text-secondary-light mb-3">
                  Authentication Required
                </h2>
                <p className="text-neutral-600 dark:text-neutral-400 max-w-md">
                  Please log in to access the AI chat application. You can do this by clicking the "Login" button in the header.
                </p>
                {/* The login modal will be triggered by the Header component */}
              </div>
            )}
          </main>
        </div>
      </NotificationProvider>
    </ThemeContext.Provider>
  );
};

export default App;
