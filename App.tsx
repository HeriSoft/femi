

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ThemeContextType, Model, UserGlobalProfile, LanguageOption, UserLanguageProfile, WebGameType } from './types.ts'; // Removed DosGameConfig
import ChatPage from './components/ChatPage.tsx';
import Header, { MockUser } from './components/Header.tsx'; 
import LanguageLearningModal from './components/LanguageLearningModal.tsx'; 
import GamesModal from './components/GamesModal.tsx'; 
// DosGamePlayerModal import removed
import WebGamePlayerModal from './components/WebGamePlayerModal.tsx'; 
import { NotificationProvider, useNotification } from './contexts/NotificationContext.tsx';
import { KeyIcon } from './components/Icons.tsx';
import { LOCAL_STORAGE_USER_PROFILE_KEY, DEFAULT_USER_LANGUAGE_PROFILE, EXP_MILESTONES_CONFIG, BADGES_CATALOG } from './constants.ts';

export const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) {
      return storedTheme as 'light' | 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [currentUser, setCurrentUser] = useState<MockUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserGlobalProfile>({ languageProfiles: {} });
  const [isLoginModalInitiallyOpen, setIsLoginModalInitiallyOpen] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false); 
  const [isLanguageLearningModalOpen, setIsLanguageLearningModalOpen] = useState(false);
  const [isGamesModalOpen, setIsGamesModalOpen] = useState(false); 
  // activeDosGameConfig state removed
  const [isWebGamePlayerModalOpen, setIsWebGamePlayerModalOpen] = useState(false);
  const [activeWebGameType, setActiveWebGameType] = useState<WebGameType>(null);
  const [activeWebGameTitle, setActiveWebGameTitle] = useState<string>('');


  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (currentUser) {
      setIsAppReady(false); 
      let loadedProfile: UserGlobalProfile = { languageProfiles: {} };
      try {
        const storedProfileString = localStorage.getItem(LOCAL_STORAGE_USER_PROFILE_KEY);
        if (storedProfileString) {
          const parsedProfile = JSON.parse(storedProfileString);
          if (parsedProfile && typeof parsedProfile === 'object' && 'languageProfiles' in parsedProfile) {
            loadedProfile = parsedProfile;
          } else {
            console.warn('[App.tsx] User profile from localStorage was malformed. Initializing a new profile.');
          }
        } else {
          console.log('[App.tsx] No user profile found in localStorage. Initializing a new profile.');
        }
      } catch (error) {
        console.error("[App.tsx] Error loading/parsing user language profile from localStorage:", error);
      }
      setUserProfile(loadedProfile);
      setIsAppReady(true); 
    } else {
      setUserProfile({ languageProfiles: {} }); 
      setIsAppReady(true); 
      setIsLoginModalInitiallyOpen(true); 
      setIsLanguageLearningModalOpen(false); 
      setIsGamesModalOpen(false); 
      // setActiveDosGameConfig(null); // Close DOS game on logout - removed
      setIsWebGamePlayerModalOpen(false); // Close Web game on logout
      setActiveWebGameType(null);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) { 
      try {
        localStorage.setItem(LOCAL_STORAGE_USER_PROFILE_KEY, JSON.stringify(userProfile));
      } catch (error) {
        console.error("Error saving user language profile to localStorage:", error);
      }
    }
  }, [userProfile, currentUser]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const handleLogin = (user: MockUser) => {
    setCurrentUser(user); 
    setIsLoginModalInitiallyOpen(false);
  };

  const handleLogout = () => {
    setCurrentUser(null); 
  };
  
  const handleUpdateUserProfile = useCallback((updatedProfile: UserGlobalProfile) => {
    setUserProfile(updatedProfile);
  }, []);

  const handleAddExp = useCallback((language: LanguageOption, expPoints: number, addAppNotification?: (message: string, type: import('./types.ts').NotificationType, details?: string) => void) => {
    setUserProfile(prevProfile => {
      const newProfile = JSON.parse(JSON.stringify(prevProfile)) as UserGlobalProfile;
      
      if (!newProfile.languageProfiles[language]) {
        newProfile.languageProfiles[language] = { ...DEFAULT_USER_LANGUAGE_PROFILE };
      }
      
      const langProfile = newProfile.languageProfiles[language] as UserLanguageProfile;
      const oldExp = langProfile.exp;
      langProfile.exp += expPoints;

      EXP_MILESTONES_CONFIG.forEach(milestone => {
        if (oldExp < milestone.exp && langProfile.exp >= milestone.exp) {
          langProfile.exp += milestone.bonus;
          if (addAppNotification) { 
            addAppNotification(`Milestone Reached! +${milestone.bonus} bonus EXP for ${language.toUpperCase()}!`, 'success');
          }
          
          if (milestone.badgeId && !langProfile.earnedBadgeIds.includes(milestone.badgeId)) {
            langProfile.earnedBadgeIds.push(milestone.badgeId);
            const badge = BADGES_CATALOG[milestone.badgeId];
            if (badge && addAppNotification) {
              addAppNotification(`Badge Unlocked: ${badge.name} (${badge.icon}) for ${language.toUpperCase()}!`, 'success', badge.description);
            }
          }
        }
      });
      return newProfile;
    });
  }, []);

  const themeContextValue = useMemo(() => ({ theme, toggleTheme }), [theme]);

  const AppContent: React.FC = () => {
    const { addNotification: addAppNotification } = useNotification();

    const handleAddExpWithNotification = useCallback((language: LanguageOption, expPoints: number) => {
        handleAddExp(language, expPoints, addAppNotification);
    }, [addAppNotification, handleAddExp]);

    const handleToggleLanguageLearningModal = () => {
        if (currentUser) {
            setIsLanguageLearningModalOpen(prev => !prev);
        }
    };

    const handleToggleGamesModal = () => { 
        if (currentUser) {
            setIsGamesModalOpen(prev => !prev);
        }
    };

    // handlePlayDosGame removed
    // handleCloseDosGame removed

    const handlePlayWebGame = (gameType: WebGameType, gameTitle: string) => {
      if (gameType) {
        setActiveWebGameType(gameType);
        setActiveWebGameTitle(gameTitle);
        setIsWebGamePlayerModalOpen(true);
        setIsGamesModalOpen(false); // Close the main games list modal
      }
    };

    const handleCloseWebGamePlayerModal = () => {
      setIsWebGamePlayerModalOpen(false);
      setActiveWebGameType(null);
      setActiveWebGameTitle('');
    };


    if (currentUser && !isAppReady) {
      return (
        <div className="flex flex-col items-center justify-center h-screen text-neutral-darker dark:text-secondary-light">
          <div role="status" aria-live="polite" className="animate-pulse">
            <svg className="w-10 h-10 mb-3 text-primary dark:text-primary-light" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 0C4.477 0 0 4.477 0 10A10 10 0 0 0 10 20C15.523 20 20 15.523 20 10A10 10 0 0 0 10 0ZM10 18C5.589 18 2 14.411 2 10C2 5.589 5.589 2 10 2C14.411 2 18 5.589 18 10C18 14.411 14.411 18 10 18Z" opacity=".2"/>
                <path d="M10 4C8.89543 4 8 4.89543 8 6V10C8 11.1046 8.89543 12 10 12C11.1046 12 12 11.1046 12 10V6C12 4.89543 11.1046 4 10 4Z" />
            </svg>
          </div>
          Loading user profile...
        </div>
      );
    }
    
    return (
      <div className="flex flex-col h-screen bg-secondary-light dark:bg-neutral-dark transition-colors duration-300">
        <Header
          key={currentUser ? 'header-logged-in' : 'header-logged-out'} 
          currentUser={currentUser}
          onLogin={handleLogin}
          onLogout={handleLogout}
          openLoginModalInitially={isLoginModalInitiallyOpen && !currentUser} 
          onLoginModalOpened={() => setIsLoginModalInitiallyOpen(false)}
          onToggleLanguageLearningModal={handleToggleLanguageLearningModal}
          onToggleGamesModal={handleToggleGamesModal} 
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
            </div>
          )}
        </main>
        {currentUser && ( 
          <>
            <LanguageLearningModal
              isOpen={isLanguageLearningModalOpen}
              onClose={() => setIsLanguageLearningModalOpen(false)}
              userProfile={userProfile}
              onUpdateProfile={handleUpdateUserProfile}
              onAddExp={handleAddExpWithNotification}
            />
            <GamesModal
              isOpen={isGamesModalOpen}
              onClose={() => setIsGamesModalOpen(false)}
              // onPlayDosGame removed
              onPlayWebGame={handlePlayWebGame}
            />
            {/* DosGamePlayerModal rendering removed */}
            <WebGamePlayerModal
                isOpen={isWebGamePlayerModalOpen}
                onClose={handleCloseWebGamePlayerModal}
                gameType={activeWebGameType}
                gameTitle={activeWebGameTitle}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </ThemeContext.Provider>
  );
};

export default App;