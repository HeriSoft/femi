

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ThemeContextType, Model, UserGlobalProfile, LanguageOption, UserLanguageProfile, WebGameType, NotificationType as AppNotificationType, TienLenGameModalProps } from './types.ts';
import ChatPage from './components/ChatPage.tsx';
import Header, { MockUser } from './components/Header.tsx';
import LanguageLearningModal from './components/LanguageLearningModal.tsx';
import GamesModal from './components/GamesModal.tsx';
import WebGamePlayerModal from './components/WebGamePlayerModal.tsx';
import TienLenGameModal from './components/games/tienlen/TienLenGameModal.tsx'; // Import TienLenGameModal
// VoiceAgentModal import removed
import { NotificationProvider, useNotification } from './contexts/NotificationContext.tsx';
import { KeyIcon } from './components/Icons.tsx';
import { LOCAL_STORAGE_USER_PROFILE_KEY, DEFAULT_USER_LANGUAGE_PROFILE, EXP_MILESTONES_CONFIG, BADGES_CATALOG, LOCAL_STORAGE_CHAT_BACKGROUND_KEY } from './constants.ts';

export const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

// Define AppContentProps interface
interface AppContentProps {
  currentUser: MockUser | null;
  onLogin: (user: MockUser) => void;
  onLogout: () => void;
  isLoginModalInitiallyOpen: boolean;
  onLoginModalOpened: () => void;
  
  isLanguageLearningModalOpen: boolean;
  onToggleLanguageLearningModal: () => void;
  
  isGamesModalOpen: boolean;
  onToggleGamesModal: () => void;

  isVoiceAgentWidgetActive: boolean; 
  onToggleVoiceAgentWidget: () => void; 
  
  userProfile: UserGlobalProfile; 
  onUpdateUserProfile: (updatedProfile: UserGlobalProfile) => void;
  onAddExpWithNotification: (language: LanguageOption, expPoints: number) => void;

  activeWebGameType: WebGameType;
  onPlayWebGame: (gameType: WebGameType, gameTitle: string) => void;
  activeWebGameTitle: string;
  isWebGamePlayerModalOpen: boolean;
  onCloseWebGamePlayerModal: () => void;
  
  isTienLenModalOpen: boolean; 
  onToggleTienLenModal: () => void; 

  chatBackgroundUrl: string | null;
  onChatBackgroundChange: (newUrl: string | null) => void;
  
  isAppReady: boolean;
}

// AppContent component defined outside App
const AppContent: React.FC<AppContentProps> = ({
  currentUser, onLogin, onLogout, isLoginModalInitiallyOpen, onLoginModalOpened,
  isLanguageLearningModalOpen, onToggleLanguageLearningModal,
  isGamesModalOpen, onToggleGamesModal,
  isVoiceAgentWidgetActive, onToggleVoiceAgentWidget, 
  userProfile, onUpdateUserProfile, onAddExpWithNotification,
  activeWebGameType, onPlayWebGame, activeWebGameTitle, isWebGamePlayerModalOpen, onCloseWebGamePlayerModal,
  isTienLenModalOpen, onToggleTienLenModal, 
  chatBackgroundUrl, onChatBackgroundChange,
  isAppReady
}) => {

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
  
  const elevenLabsAgentId = "agent_01jwhhnh4recyazyeabp4sa3ne";

  return (
    <div className="flex flex-col h-screen bg-secondary-light dark:bg-neutral-dark transition-colors duration-300">
      <Header
        key={currentUser ? 'header-logged-in' : 'header-logged-out'} 
        currentUser={currentUser}
        onLogin={onLogin}
        onLogout={onLogout}
        openLoginModalInitially={isLoginModalInitiallyOpen && !currentUser} 
        onLoginModalOpened={onLoginModalOpened}
        onToggleLanguageLearningModal={onToggleLanguageLearningModal}
        onToggleGamesModal={onToggleGamesModal} 
        onToggleVoiceAgentWidget={onToggleVoiceAgentWidget} 
        chatBackgroundUrl={chatBackgroundUrl}
        onChatBackgroundChange={onChatBackgroundChange}
        userProfile={userProfile} 
        onUpdateUserProfile={onUpdateUserProfile} 
      />
      <main className="flex-grow overflow-hidden">
        {currentUser ? ( 
          <ChatPage chatBackgroundUrl={chatBackgroundUrl} userProfile={userProfile} />
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
            onClose={onToggleLanguageLearningModal} 
            userProfile={userProfile}
            onUpdateProfile={onUpdateUserProfile}
            onAddExp={onAddExpWithNotification}
          />
          <GamesModal
            isOpen={isGamesModalOpen}
            onClose={onToggleGamesModal} 
            onPlayWebGame={onPlayWebGame}
          />
          {activeWebGameType !== 'tien-len' && activeWebGameType !== '8-ball-pool' && ( 
            <WebGamePlayerModal
                isOpen={isWebGamePlayerModalOpen}
                onClose={onCloseWebGamePlayerModal}
                gameType={activeWebGameType}
                gameTitle={activeWebGameTitle}
            />
          )}
          
          {activeWebGameType === 'tien-len' && (
            <TienLenGameModal 
                isOpen={isWebGamePlayerModalOpen} 
                onClose={onCloseWebGamePlayerModal} 
            />
          )}
           {activeWebGameType === '8-ball-pool' && (
            <WebGamePlayerModal 
                isOpen={isWebGamePlayerModalOpen}
                onClose={onCloseWebGamePlayerModal}
                gameType={activeWebGameType}
                gameTitle={activeWebGameTitle}
            />
          )}
          {/* VoiceAgentModal removed, widget rendered below */}
          {isVoiceAgentWidgetActive && (
            <elevenlabs-convai agent-id={elevenLabsAgentId}></elevenlabs-convai>
          )}
        </>
      )}
    </div>
  );
};


const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) {
      return storedTheme as 'light' | 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [currentUser, setCurrentUser] = useState<MockUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserGlobalProfile>({ languageProfiles: {}, aboutMe: '' }); 
  const [isLoginModalInitiallyOpen, setIsLoginModalInitiallyOpen] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false); 
  const [isLanguageLearningModalOpen, setIsLanguageLearningModalOpen] = useState(false);
  const [isGamesModalOpen, setIsGamesModalOpen] = useState(false); 
  const [isVoiceAgentWidgetActive, setIsVoiceAgentWidgetActive] = useState(false); 
  const [isWebGamePlayerModalOpen, setIsWebGamePlayerModalOpen] = useState(false);
  const [activeWebGameType, setActiveWebGameType] = useState<WebGameType>(null);
  const [activeWebGameTitle, setActiveWebGameTitle] = useState<string>('');
  const [chatBackgroundUrl, setChatBackgroundUrl] = useState<string | null>(null);
  
  const notificationsHook = useNotification(); 
  const addAppNotification = notificationsHook.addNotification;

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const storedBg = localStorage.getItem(LOCAL_STORAGE_CHAT_BACKGROUND_KEY);
    if (storedBg) {
        setChatBackgroundUrl(storedBg);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      setIsAppReady(false); 
      let loadedProfile: UserGlobalProfile = { languageProfiles: {}, aboutMe: '' }; 
      try {
        const storedProfileString = localStorage.getItem(LOCAL_STORAGE_USER_PROFILE_KEY);
        if (storedProfileString) {
          const parsedProfile = JSON.parse(storedProfileString);
          if (parsedProfile && typeof parsedProfile === 'object' && 'languageProfiles' in parsedProfile) {
            loadedProfile = { ...loadedProfile, ...parsedProfile }; 
          }
        }
      } catch (error) {
        console.error("[App.tsx] Error loading/parsing user language profile from localStorage:", error);
      }
      setUserProfile(loadedProfile);
      setIsAppReady(true); 
    } else {
      setUserProfile({ languageProfiles: {}, aboutMe: '' }); 
      setIsAppReady(true); 
      setIsLoginModalInitiallyOpen(true); 
      setIsLanguageLearningModalOpen(false); 
      setIsGamesModalOpen(false); 
      setIsVoiceAgentWidgetActive(false); 
      setIsWebGamePlayerModalOpen(false);
      setActiveWebGameType(null);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && isAppReady) { 
      try {
        localStorage.setItem(LOCAL_STORAGE_USER_PROFILE_KEY, JSON.stringify(userProfile));
      } catch (error) {
        console.error("Error saving user language profile to localStorage:", error);
      }
    }
  }, [userProfile, currentUser, isAppReady]);

  const toggleTheme = useCallback(() => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  }, []);

  const handleLogin = useCallback((user: MockUser) => {
    setCurrentUser(user); 
    setIsLoginModalInitiallyOpen(false);
  }, []);

  const handleLogout = useCallback(() => {
    setCurrentUser(null); 
  }, []);
  
  const handleUpdateUserProfile = useCallback((updatedProfile: UserGlobalProfile) => {
    setUserProfile(updatedProfile);
  }, []);

  const handleChatBackgroundChange = useCallback((newUrl: string | null) => {
    setChatBackgroundUrl(newUrl);
    if (newUrl) {
        localStorage.setItem(LOCAL_STORAGE_CHAT_BACKGROUND_KEY, newUrl);
    } else {
        localStorage.removeItem(LOCAL_STORAGE_CHAT_BACKGROUND_KEY);
    }
  }, []);

  const handleAddExp = useCallback((language: LanguageOption, expPoints: number, boundAddAppNotification?: (message: string, type: AppNotificationType, details?: string) => void) => {
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
          if (boundAddAppNotification) { 
            boundAddAppNotification(`Milestone Reached! +${milestone.bonus} bonus EXP for ${language.toUpperCase()}!`, 'success');
          }
          if (milestone.badgeId && !langProfile.earnedBadgeIds.includes(milestone.badgeId)) {
            langProfile.earnedBadgeIds.push(milestone.badgeId);
            const badge = BADGES_CATALOG[milestone.badgeId];
            if (badge && boundAddAppNotification) {
              boundAddAppNotification(`Badge Unlocked: ${badge.name} (${badge.icon}) for ${language.toUpperCase()}!`, 'success', badge.description);
            }
          }
        }
      });
      return newProfile;
    });
  }, []);
  
  const handleAddExpWithNotification = useCallback((language: LanguageOption, expPoints: number) => {
    handleAddExp(language, expPoints, addAppNotification);
  }, [addAppNotification, handleAddExp]);

  const onLoginModalOpened = useCallback(() => {
    setIsLoginModalInitiallyOpen(false);
  }, []);

  const onToggleLanguageLearningModal = useCallback(() => {
    if (currentUser) {
        setIsLanguageLearningModalOpen(prev => !prev);
    }
  }, [currentUser]);

  const onToggleGamesModal = useCallback(() => {
    if (currentUser) {
        setIsGamesModalOpen(prev => !prev);
    }
  }, [currentUser]);

  const onToggleVoiceAgentWidget = useCallback(() => { 
    if (currentUser) {
        setIsVoiceAgentWidgetActive(prev => !prev);
    }
  }, [currentUser]);


  const onPlayWebGame = useCallback((gameType: WebGameType, gameTitle: string) => {
    if (gameType) {
      setActiveWebGameType(gameType);
      setActiveWebGameTitle(gameTitle);
      setIsWebGamePlayerModalOpen(true); 
      setIsGamesModalOpen(false); 
    }
  }, []);

  const onCloseWebGamePlayerModal = useCallback(() => {
    setIsWebGamePlayerModalOpen(false);
    setActiveWebGameType(null);
    setActiveWebGameTitle('');
  }, []);
  

  const themeContextValue = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <AppContent
        currentUser={currentUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
        isLoginModalInitiallyOpen={isLoginModalInitiallyOpen}
        onLoginModalOpened={onLoginModalOpened}
        
        isLanguageLearningModalOpen={isLanguageLearningModalOpen}
        onToggleLanguageLearningModal={onToggleLanguageLearningModal}
        
        isGamesModalOpen={isGamesModalOpen}
        onToggleGamesModal={onToggleGamesModal}

        isVoiceAgentWidgetActive={isVoiceAgentWidgetActive} 
        onToggleVoiceAgentWidget={onToggleVoiceAgentWidget}
        
        userProfile={userProfile}
        onUpdateUserProfile={handleUpdateUserProfile}
        onAddExpWithNotification={handleAddExpWithNotification}

        activeWebGameType={activeWebGameType}
        onPlayWebGame={onPlayWebGame}
        activeWebGameTitle={activeWebGameTitle}
        isWebGamePlayerModalOpen={isWebGamePlayerModalOpen}
        onCloseWebGamePlayerModal={onCloseWebGamePlayerModal}
        
        isTienLenModalOpen={activeWebGameType === 'tien-len' && isWebGamePlayerModalOpen} 
        onToggleTienLenModal={() => { /* Handled by onPlayWebGame and onCloseWebGamePlayerModal */ }} 

        chatBackgroundUrl={chatBackgroundUrl}
        onChatBackgroundChange={handleChatBackgroundChange}
        
        isAppReady={isAppReady}
      />
    </ThemeContext.Provider>
  );
};

const RootAppWrapper: React.FC = () => {
  return (
    <NotificationProvider>
      <App />
    </NotificationProvider>
  );
};

export default RootAppWrapper;
