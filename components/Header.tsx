
import React, { useContext } from 'react';
import { ThemeContext } from '../App.tsx'; // Update to .tsx
import { ThemeContextType } from '../types.ts'; // Update to .ts
import { SunIcon, MoonIcon } from './Icons.tsx'; // Update to .tsx

const Header: React.FC = () => {
  const themeContext = useContext(ThemeContext);

  if (!themeContext) {
    return null; // Or some fallback UI
  }
  // Fix: Explicitly assert themeContext to ThemeContextType after the guard.
  const { theme, toggleTheme } = themeContext as ThemeContextType;

  return (
    <header className="bg-neutral-light dark:bg-neutral-darker shadow-md p-4 flex justify-between items-center sticky top-0 z-50">
      <h1 className="text-3xl font-bold text-primary dark:text-primary-light">
        femi
      </h1>
      <button
        onClick={toggleTheme}
        className="p-2 rounded-full hover:bg-secondary dark:hover:bg-neutral-darkest text-neutral-darker dark:text-secondary-light transition-colors"
        aria-label="Toggle theme"
      >
        {theme === 'light' ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
      </button>
    </header>
  );
};

export default Header;