

import React, { useContext, useState, useRef, useEffect } from 'react';
import { ThemeContext } from '../App.tsx';
import { ThemeContextType, UserGlobalProfile, LoginDeviceLog } from '../types.ts'; // Removed LanguageLearningModalProps, Added LoginDeviceLog
import { SunIcon, MoonIcon, BellIcon, UserCircleIcon as AvatarIcon, KeyIcon, XMarkIcon, AcademicCapIcon, PuzzlePieceIcon, UserCogIcon, ComputerDesktopIcon, IdentificationIcon, ChatBubbleLeftEllipsisIcon } from './Icons.tsx'; // Renamed UserCircleIcon to AvatarIcon for clarity, Added IdentificationIcon, ChatBubbleLeftEllipsisIcon
import { useNotification } from '../contexts/NotificationContext.tsx';
import NotificationPanel from './NotificationPanel.tsx';
import AccountSettingsModal from './AccountSettingsModal.tsx'; // Import AccountSettingsModal
import { LOCAL_STORAGE_DEVICE_LOGS_KEY, MAX_DEVICE_LOGS } from '../constants.ts';
// LanguageLearningModal import removed as it's now handled by App.tsx

export interface MockUser {
  name: string;
  email?: string;
}

interface HeaderProps {
  currentUser: MockUser | null;
  onLogin: (user: MockUser) => void;
  onLogout: () => void;
  openLoginModalInitially?: boolean;
  onLoginModalOpened?: () => void; 
  onToggleLanguageLearningModal: () => void; 
  onToggleGamesModal: () => void; 
  onToggleVoiceAgentWidget: () => void; // Updated prop name
  // Props for Account Settings background feature
  chatBackgroundUrl: string | null;
  onChatBackgroundChange: (newUrl: string | null) => void;
  // Props for Account Settings "About Me" feature
  userProfile: UserGlobalProfile | null;
  onUpdateUserProfile: (updatedProfile: UserGlobalProfile) => void;
}

// Helper to parse User Agent for basic OS info
const getDeviceType = (): string => {
  const ua = navigator.userAgent;
  const platform = (navigator as any).userAgentData?.platform || navigator.platform || "Unknown";

  if (/\b(iPhone|iPod|iPad)/i.test(ua) || /iPhone|iPod|iPad/i.test(platform)) return "iPhone/iPad";
  if (/\bAndroid/i.test(ua)) return "Android";
  if (/\bWindows/i.test(ua) || /Win/i.test(platform)) return "Windows";
  if (/\bMac/i.test(ua) || /Mac/i.test(platform)) return "Mac OS";
  if (/\bLinux/i.test(ua) || /Linux/i.test(platform)) return "Linux";
  if (/\bCrOS/i.test(ua)) return "Chrome OS"; // Chromebooks
  
  return "Unknown Device";
};


const Header: React.FC<HeaderProps> = ({
  currentUser,
  onLogin,
  onLogout,
  openLoginModalInitially,
  onLoginModalOpened,
  onToggleLanguageLearningModal,
  onToggleGamesModal, 
  onToggleVoiceAgentWidget, // Updated prop
  chatBackgroundUrl,
  onChatBackgroundChange,
  userProfile,
  onUpdateUserProfile,
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
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  const [isAccountSettingsModalOpen, setIsAccountSettingsModalOpen] = useState(false);


  // isLanguageLearningModalOpen state removed

  useEffect(() => {
    if (openLoginModalInitially && !currentUser && !isLoginModalOpen) {
      setIsLoginModalOpen(true);
      if (onLoginModalOpened) {
        onLoginModalOpened(); 
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

  const recordLoginDevice = () => {
    try {
      const deviceLogsString = localStorage.getItem(LOCAL_STORAGE_DEVICE_LOGS_KEY);
      let deviceLogs: LoginDeviceLog[] = deviceLogsString ? JSON.parse(deviceLogsString) : [];
      
      const newLog: LoginDeviceLog = {
        id: `log-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        device: getDeviceType(),
        timestamp: Date.now(),
      };

      deviceLogs.unshift(newLog); // Add to the beginning
      deviceLogs = deviceLogs.slice(0, MAX_DEVICE_LOGS); // Keep only the N most recent

      localStorage.setItem(LOCAL_STORAGE_DEVICE_LOGS_KEY, JSON.stringify(deviceLogs));
    } catch (error) {
      console.error("Error recording login device:", error);
      addNotification("Could not record login device information.", "error", (error as Error).message);
    }
  };

  const handleLoginSubmit = async () => {
    if (!loginCodeInput.trim()) {
      addNotification("Please enter a login code.", "error");
      return;
    }
    setIsLoginLoading(true);
    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: loginCodeInput }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onLogin({ name: "Authenticated User" });
        addNotification("Login successful!", "success");
        setIsLoginModalOpen(false);
        recordLoginDevice(); // Record device on successful login
      } else {
        addNotification(data.message || "Invalid login code or server error.", "error");
        setLoginCodeInput(''); 
      }
    } catch (error) {
      console.error("Login API call failed:", error);
      addNotification("Login request failed. Please check your connection or contact support.", "error");
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleSignOut = () => { 
    onLogout(); 
    setIsLoginDropdownOpen(false);
    addNotification("You have been logged out.", "info");
  };
  
  const handleOpenAccountSettings = () => {
    setIsAccountSettingsModalOpen(true);
    setIsLoginDropdownOpen(false);
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
        !(loginButtonRef.current && loginButtonRef.current.contains(event.target as Node)) 
      ) {
        const mainLoginButton = document.getElementById('main-login-button'); 
        if (mainLoginButton && mainLoginButton.contains(event.target as Node)) {
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
    <>
      <header className="bg-neutral-light dark:bg-neutral-darker shadow-md p-4 flex justify-between items-center sticky top-0 z-50">
        <h1 className="text-3xl font-bold text-primary dark:text-primary-light">
          femi
        </h1>
        <div className="flex items-center space-x-3">
          <button
            onClick={onToggleLanguageLearningModal} 
            disabled={!currentUser} 
            className="p-2 rounded-full hover:bg-secondary dark:hover:bg-neutral-darkest text-neutral-darker dark:text-secondary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Open language learning module"
            title="Language Learning Hub"
          >
            <AcademicCapIcon className="w-6 h-6" />
          </button>
           <button
            onClick={onToggleGamesModal}
            disabled={!currentUser}
            className="p-2 rounded-full hover:bg-secondary dark:hover:bg-neutral-darkest text-neutral-darker dark:text-secondary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Open mini games arcade"
            title="Mini Games Arcade"
          >
            <PuzzlePieceIcon className="w-6 h-6" />
          </button>
          <button
            onClick={onToggleVoiceAgentWidget} // Updated onClick
            disabled={!currentUser}
            className="p-2 rounded-full hover:bg-secondary dark:hover:bg-neutral-darkest text-neutral-darker dark:text-secondary-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Open Voice Agent"
            title="Voice Agent (Beta)"
          >
            <ChatBubbleLeftEllipsisIcon className="w-6 h-6" />
          </button>
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
            {currentUser ? ( 
              <>
                <button
                  ref={avatarButtonRef}
                  onClick={() => setIsLoginDropdownOpen(prev => !prev)}
                  className="flex items-center space-x-2 p-1 rounded-full hover:bg-secondary dark:hover:bg-neutral-darkest transition-colors"
                  aria-label="User menu"
                  aria-expanded={isLoginDropdownOpen}
                >
                  <AvatarIcon className="w-8 h-8 text-neutral-darker dark:text-secondary-light" />
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
                      onClick={handleOpenAccountSettings}
                      className="w-full text-left px-4 py-2 text-sm text-neutral-darker dark:text-secondary-light hover:bg-secondary dark:hover:bg-neutral-dark transition-colors flex items-center"
                    >
                      <UserCogIcon className="w-4 h-4 mr-2" /> Account
                    </button>
                    <button
                      onClick={handleSignOut} 
                      className="w-full text-left px-4 py-2 text-sm text-neutral-darker dark:text-secondary-light hover:bg-secondary dark:hover:bg-neutral-dark transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button
                id="main-login-button" 
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
                onKeyPress={(e) => { if (e.key === 'Enter' && !isLoginLoading) handleLoginSubmit(); }}
                placeholder="Login Code"
                className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none mb-4"
                autoFocus
                disabled={isLoginLoading}
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setIsLoginModalOpen(false)}
                  disabled={isLoginLoading}
                  className="px-4 py-2 text-sm font-medium text-neutral-darker dark:text-secondary-light bg-secondary dark:bg-neutral-darkest hover:bg-secondary-dark dark:hover:bg-neutral-dark rounded-md transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLoginSubmit}
                  disabled={isLoginLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark dark:bg-primary-light dark:text-neutral-darker dark:hover:bg-primary rounded-md transition-colors disabled:opacity-50"
                >
                  {isLoginLoading ? 'Verifying...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
      
      {currentUser && isAccountSettingsModalOpen && (
        <AccountSettingsModal
          isOpen={isAccountSettingsModalOpen}
          onClose={() => setIsAccountSettingsModalOpen(false)}
          onChatBackgroundChange={onChatBackgroundChange}
          currentChatBackground={chatBackgroundUrl}
          userProfile={userProfile}
          onUpdateUserProfile={onUpdateUserProfile}
        />
      )}
    </>
  );
};

export default Header;
