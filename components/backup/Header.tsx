
import React, { useContext, useState, useRef, useEffect } from 'react';
import { ThemeContext } from '../App.tsx';
import { ThemeContextType } from '../types.ts';
import { SunIcon, MoonIcon, BellIcon, UserCircleIcon, KeyIcon, XMarkIcon } from './Icons.tsx';
import { useNotification } from '../contexts/NotificationContext.tsx';
import NotificationPanel from './NotificationPanel.tsx';

// Mock user type - export it if App.tsx needs it.
export interface MockUser {
  name: string;
  email?: string;
}

interface HeaderProps {
  currentUser: MockUser | null;
  onLogin: (user: MockUser) => void;
  onLogout: () => void;
  openLoginModalInitially?: boolean;
  onLoginModalOpened?: () => void; // Callback to inform parent modal has been handled
}

const Header: React.FC<HeaderProps> = ({
  currentUser,
  onLogin,
  onLogout,
  openLoginModalInitially,
  onLoginModalOpened
}) => {
  const themeContext = useContext(ThemeContext);
  const { unreadCount, markAllAsRead, addNotification } = useNotification();
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const notificationPanelRef = useRef<HTMLDivElement>(null);

  const [isLoginDropdownOpen, setIsLoginDropdownOpen] = useState(false);
  const loginDropdownRef = useRef<HTMLDivElement>(null);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginCodeInput, setLoginCodeInput] = useState('');
  const loginModalRef = useRef<HTMLDivElement>(null);
  const loginButtonRef = useRef<HTMLButtonElement>(null);


  useEffect(() => {
    if (openLoginModalInitially && !currentUser && !isLoginModalOpen) {
      setIsLoginModalOpen(true);
      if (onLoginModalOpened) {
        onLoginModalOpened(); // Notify parent that the modal was opened
      }
    }
  }, [openLoginModalInitially, currentUser, isLoginModalOpen, onLoginModalOpened]);


  if (!themeContext) {
    return null;
  }
  const { theme, toggleTheme } = themeContext as ThemeContextType;

  const handleNotificationToggle = () => {
    setIsNotificationPanelOpen(prev => {
      if (!prev) {
        markAllAsRead();
      }
      return !prev;
    });
  };

  const handleOpenLoginModal = () => {
    setIsLoginModalOpen(true);
    setLoginCodeInput('');
  };

  const handleLoginSubmit = () => {
    const configuredLoginCode = (window as any).process?.env?.LOGIN_CODE_AUTH;

    if (!configuredLoginCode) {
      addNotification("Login code is not configured in the application settings (config.js).", "error");
      setIsLoginModalOpen(false);
      return;
    }

    if (loginCodeInput === configuredLoginCode) {
      onLogin({ // Call prop function
        name: "Authenticated User",
      });
      addNotification("Login successful!", "success");
      setIsLoginModalOpen(false);
    } else {
      addNotification("Invalid login code.", "error");
      setLoginCodeInput('');
    }
  };

  const handleSignOut = () => { // Renamed from handleMockSignOut for clarity
    onLogout(); // Call prop function
    setIsLoginDropdownOpen(false);
    addNotification("You have been logged out.", "info");
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationPanelRef.current &&
        !notificationPanelRef.current.contains(event.target as Node) &&
        notificationButtonRef.current &&
        !notificationButtonRef.current.contains(event.target as Node)
      ) {
        setIsNotificationPanelOpen(false);
      }
      if (
        loginDropdownRef.current &&
        !loginDropdownRef.current.contains(event.target as Node) &&
        avatarButtonRef.current &&
        !avatarButtonRef.current.contains(event.target as Node)
      ) {
        setIsLoginDropdownOpen(false);
      }
      if (
        loginModalRef.current &&
        !loginModalRef.current.contains(event.target as Node) &&
        !(loginButtonRef.current && loginButtonRef.current.contains(event.target as Node)) // Ensure not clicking the login button itself
      ) {
         // Check if the click is outside the modal AND not on the button that opens it
        const mainLoginButton = document.getElementById('main-login-button'); // Assuming we add an ID to the login button for this check
        if (mainLoginButton && mainLoginButton.contains(event.target as Node)) {
            // Click was on the button that opens the modal, so don't close it
            return;
        }
        setIsLoginModalOpen(false);
      }
    };

    if (isNotificationPanelOpen || isLoginDropdownOpen || isLoginModalOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotificationPanelOpen, isLoginDropdownOpen, isLoginModalOpen]);


  return (
    <header className="bg-neutral-light dark:bg-neutral-darker shadow-md p-4 flex justify-between items-center sticky top-0 z-50">
      <h1 className="text-3xl font-bold text-primary dark:text-primary-light">
        femi
      </h1>
      <div className="flex items-center space-x-3">
        <div className="relative">
          <button
            ref={notificationButtonRef}
            onClick={handleNotificationToggle}
            className="p-2 rounded-full hover:bg-secondary dark:hover:bg-neutral-darkest text-neutral-darker dark:text-secondary-light transition-colors relative"
            aria-label="Toggle notifications panel"
            aria-expanded={isNotificationPanelOpen}
          >
            <BellIcon className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="notification-badge">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {isNotificationPanelOpen && (
            <div ref={notificationPanelRef}>
              <NotificationPanel onClose={() => setIsNotificationPanelOpen(false)} />
            </div>
          )}
        </div>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full hover:bg-secondary dark:hover:bg-neutral-darkest text-neutral-darker dark:text-secondary-light transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
        </button>

        <div className="relative">
          {currentUser ? ( // Use prop currentUser
            <>
              <button
                ref={avatarButtonRef}
                onClick={() => setIsLoginDropdownOpen(prev => !prev)}
                className="flex items-center space-x-2 p-1 rounded-full hover:bg-secondary dark:hover:bg-neutral-darkest transition-colors"
                aria-label="User menu"
                aria-expanded={isLoginDropdownOpen}
              >
                <UserCircleIcon className="w-8 h-8 text-neutral-darker dark:text-secondary-light" />
                <span className="text-sm font-medium text-neutral-darker dark:text-secondary-light hidden sm:block">{currentUser.name}</span>
              </button>
              {isLoginDropdownOpen && (
                <div
                  ref={loginDropdownRef}
                  className="absolute top-full right-0 mt-2 w-48 bg-neutral-light dark:bg-neutral-darker border border-secondary dark:border-neutral-darkest rounded-md shadow-lg py-1 z-50"
                >
                  <div className="px-4 py-2 border-b border-secondary dark:border-neutral-darkest">
                    <p className="text-sm font-medium text-neutral-darker dark:text-secondary-light truncate">{currentUser.name}</p>
                    {currentUser.email && <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{currentUser.email}</p>}
                  </div>
                  <button
                    onClick={handleSignOut} // Use updated handler name
                    className="w-full text-left px-4 py-2 text-sm text-neutral-darker dark:text-secondary-light hover:bg-secondary dark:hover:bg-neutral-dark transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </>
          ) : (
            <button
              id="main-login-button" // Added ID for click outside logic refinement
              ref={loginButtonRef}
              onClick={handleOpenLoginModal}
              className="flex items-center px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark dark:bg-primary-light dark:text-neutral-darker dark:hover:bg-primary rounded-md transition-colors"
            >
              <KeyIcon className="w-4 h-4 mr-2" />
              Login
            </button>
          )}
        </div>
      </div>

      {isLoginModalOpen && (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]"
            onClick={(e) => {
                 // Only close if click is directly on backdrop
                if (e.target === e.currentTarget) {
                    setIsLoginModalOpen(false);
                }
            }}
        >
          <div
            ref={loginModalRef}
            className="bg-neutral-light dark:bg-neutral-darker p-6 rounded-lg shadow-xl w-full max-w-sm transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light">Enter Login Code</h3>
              <button
                onClick={() => setIsLoginModalOpen(false)}
                className="p-1 rounded-full hover:bg-secondary dark:hover:bg-neutral-dark"
                aria-label="Close login modal"
              >
                <XMarkIcon className="w-5 h-5 text-neutral-darker dark:text-secondary-light" />
              </button>
            </div>
            <input
              type="password"
              value={loginCodeInput}
              onChange={(e) => setLoginCodeInput(e.target.value)}
              onKeyPress={(e) => { if (e.key === 'Enter') handleLoginSubmit(); }}
              placeholder="Login Code"
              className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none mb-4"
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setIsLoginModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-neutral-darker dark:text-secondary-light bg-secondary dark:bg-neutral-darkest hover:bg-secondary-dark dark:hover:bg-neutral-dark rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLoginSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark dark:bg-primary-light dark:text-neutral-darker dark:hover:bg-primary rounded-md transition-colors"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
