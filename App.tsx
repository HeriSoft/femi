
import React, { useState, useEffect, useMemo } from 'react';
import { ThemeContextType } from './types.ts'; // Update to .ts
import ChatPage from './components/ChatPage.tsx'; // Update to .tsx
import Header from './components/Header.tsx'; // Update to .tsx

export const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => { // Restore generic type
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) {
      return storedTheme as 'light' | 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const themeContextValue = useMemo(() => ({ theme, toggleTheme }), [theme]);

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <div className="flex flex-col h-screen bg-secondary-light dark:bg-neutral-dark transition-colors duration-300">
        <Header />
        <main className="flex-grow overflow-hidden">
          <ChatPage />
        </main>
      </div>
    </ThemeContext.Provider>
  );
};

export default App;