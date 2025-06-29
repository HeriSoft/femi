
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ThemeContextType, Model, UserGlobalProfile, LanguageOption, UserLanguageProfile, WebGameType, NotificationType as AppNotificationType, TienLenGameModalProps, CreditPackage, UserSessionState, DemoUserLoginResponse, DemoUserLimits, LoginResponseType, PaidLoginResponse, AdminLoginResponse, PaidUserLimits, HeaderProps, MockUser } from './types.ts'; // Added HeaderProps, MockUser
import ChatPage from './components/ChatPage.tsx';
import Header from './components/Header.tsx'; // MockUser is now imported via types.ts
import LanguageLearningModal from './components/LanguageLearningModal.tsx';
import GamesModal from './components/GamesModal.tsx';
import WebGamePlayerModal from './components/WebGamePlayerModal.tsx';
import TienLenGameModal from './components/games/tienlen/TienLenGameModal.tsx';
import NewsModal from './components/NewsModal.tsx'; // Import NewsModal
import { NotificationProvider, useNotification } from './contexts/NotificationContext.tsx';
import { KeyIcon } from './components/Icons.tsx';
import { LOCAL_STORAGE_USER_PROFILE_KEY, DEFAULT_USER_LANGUAGE_PROFILE, EXP_MILESTONES_CONFIG, BADGES_CATALOG, LOCAL_STORAGE_CHAT_BACKGROUND_KEY, DEMO_CREDIT_PACKAGES, INITIAL_DEMO_USER_LIMITS, PAID_USER_LIMITS_CONFIG } from './constants.ts'; // Removed DEMO_USER_KEY
import ErrorBoundary from './components/ErrorBoundary.tsx'; // Import ErrorBoundary

export const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

interface AppContentProps {
  currentUser: MockUser | null;
  onLogin: (code: string) => void;
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
  currentUserCredits: number;
  onPurchaseCredits: (packageId: string, paymentMethod: 'paypal' | 'stripe' | 'vietqr') => void;
  paypalEmail: string | undefined;
  onSavePayPalEmail: (email: string) => void;

  userSession: UserSessionState;
  onUpdateDemoLimits: (updatedLimits: Partial<DemoUserLimits | PaidUserLimits>) => void; // Updated to include PaidUserLimits

  isNewsModalOpen: boolean; 
  onCloseNewsModal: () => void; 
  onToggleNewsModal: () => void; // Added for manual news toggle
}

const AppContent: React.FC<AppContentProps> = ({
  currentUser, onLogin, onLogout, isLoginModalInitiallyOpen, onLoginModalOpened,
  isLanguageLearningModalOpen, onToggleLanguageLearningModal,
  isGamesModalOpen, onToggleGamesModal,
  isVoiceAgentWidgetActive, onToggleVoiceAgentWidget, 
  userProfile, onUpdateUserProfile, onAddExpWithNotification,
  activeWebGameType, onPlayWebGame, activeWebGameTitle, isWebGamePlayerModalOpen, onCloseWebGamePlayerModal,
  isTienLenModalOpen, 
  chatBackgroundUrl, onChatBackgroundChange,
  isAppReady,
  currentUserCredits, onPurchaseCredits, paypalEmail, onSavePayPalEmail,
  userSession, onUpdateDemoLimits,
  isNewsModalOpen, onCloseNewsModal, onToggleNewsModal // Added onToggleNewsModal
}) => {

  if (!isAppReady && !userSession.isDemoUser && !userSession.isPaidUser) { 
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
    <div className="flex flex-col h-full bg-secondary-light dark:bg-neutral-dark transition-colors duration-300 overflow-hidden">
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
        currentUserCredits={currentUserCredits}
        onPurchaseCredits={onPurchaseCredits}
        paypalEmail={paypalEmail}
        onSavePayPalEmail={onSavePayPalEmail}
        onToggleNewsModal={onToggleNewsModal} // Pass handler
      />
      <main className="flex-grow flex flex-col overflow-hidden min-h-0"> {/* Ensured flex-col and min-h-0 for the main content area */}
        {currentUser || userSession.isDemoUser || userSession.isPaidUser ? ( 
          <ChatPage 
            chatBackgroundUrl={chatBackgroundUrl} 
            userProfile={userProfile} 
            userSession={userSession} 
            onUpdateDemoLimits={onUpdateDemoLimits} 
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <KeyIcon className="w-16 h-16 text-primary dark:text-primary-light mb-6" />
            <h2 className="text-3xl font-semibold text-neutral-darker dark:text-secondary-light mb-3">
              Authentication Required
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 max-w-md">
              Please log in to access the AI chat application. You can do this by clicking the "Login" button in the header.
              Try a DEMO username like "guest_demo" (if available) or your Admin/Paid user code.
            </p>
          </div>
        )}
      </main>
      {isNewsModalOpen && <NewsModal isOpen={isNewsModalOpen} onClose={onCloseNewsModal} />}
      {(currentUser || userSession.isDemoUser || userSession.isPaidUser) && (
        <>
          <LanguageLearningModal 
            isOpen={isLanguageLearningModalOpen} 
            onClose={onToggleLanguageLearningModal} 
            userProfile={userProfile} 
            userSession={userSession}
            onUpdateProfile={onUpdateUserProfile} 
            onAddExp={onAddExpWithNotification} />
          <GamesModal isOpen={isGamesModalOpen} onClose={onToggleGamesModal} onPlayWebGame={onPlayWebGame} />
          {activeWebGameType !== 'tien-len' && activeWebGameType !== '8-ball-pool' && ( <WebGamePlayerModal isOpen={isWebGamePlayerModalOpen} onClose={onCloseWebGamePlayerModal} gameType={activeWebGameType} gameTitle={activeWebGameTitle} /> )}
          {activeWebGameType === 'tien-len' && ( <TienLenGameModal isOpen={isWebGamePlayerModalOpen} onClose={onCloseWebGamePlayerModal} /> )}
          {activeWebGameType === '8-ball-pool' && ( <WebGamePlayerModal isOpen={isWebGamePlayerModalOpen} onClose={onCloseWebGamePlayerModal} gameType={activeWebGameType} gameTitle={activeWebGameTitle} /> )}
          {isVoiceAgentWidgetActive && ( <elevenlabs-convai agent-id={elevenLabsAgentId}></elevenlabs-convai> )}
        </>
      )}
    </div>
  );
};


const App = (): JSX.Element => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const storedTheme = localStorage.getItem('theme');
    return storedTheme ? (storedTheme as 'light' | 'dark') : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });

  const [currentUser, setCurrentUser] = useState<MockUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserGlobalProfile>({ languageProfiles: {}, aboutMe: '', credits: 100, paypalEmail: undefined }); 
  const [isLoginModalInitiallyOpen, setIsLoginModalInitiallyOpen] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false); 
  const [isLanguageLearningModalOpen, setIsLanguageLearningModalOpen] = useState(false);
  const [isGamesModalOpen, setIsGamesModalOpen] = useState(false); 
  const [isVoiceAgentWidgetActive, setIsVoiceAgentWidgetActive] = useState(false); 
  const [isWebGamePlayerModalOpen, setIsWebGamePlayerModalOpen] = useState(false);
  const [activeWebGameType, setActiveWebGameType] = useState<WebGameType>(null);
  const [activeWebGameTitle, setActiveWebGameTitle] = useState<string>('');
  const [chatBackgroundUrl, setChatBackgroundUrl] = useState<string | null>(null);
  
  const [userSession, setUserSession] = useState<UserSessionState>({
    isDemoUser: false,
    demoUsername: undefined,
    demoUserToken: null,
    demoLimits: null,
    isPaidUser: false,
    paidUsername: undefined,
    paidUserToken: null,
    paidSubscriptionEndDate: null,
    paidLimits: null,
  });

  const [isNewsModalOpen, setIsNewsModalOpen] = useState(false); 

  const notificationsHook = useNotification(); 
  const addAppNotification = notificationsHook.addNotification;

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const storedBg = localStorage.getItem(LOCAL_STORAGE_CHAT_BACKGROUND_KEY);
    if (storedBg) setChatBackgroundUrl(storedBg);
  }, []);

  useEffect(() => {
    setIsAppReady(false);
    let profileToSet: UserGlobalProfile = { languageProfiles: {}, aboutMe: '', credits: 0, paypalEmail: undefined };

    if (currentUser && !userSession.isDemoUser && !userSession.isPaidUser) { // Admin user
      profileToSet = { languageProfiles: {}, aboutMe: 'Admin User', credits: 99999, paypalEmail: undefined };
    } else if (userSession.isDemoUser && userSession.demoUsername) { 
      profileToSet = { languageProfiles: {}, aboutMe: `DEMO User: ${userSession.demoUsername}`, credits: 0, paypalEmail: undefined }; 
      // DEMO user profile is not persisted in localStorage for now. Limits are server-driven.
    } else if (userSession.isPaidUser && userSession.paidUsername) {
        let loadedProfile: UserGlobalProfile = { languageProfiles: {}, aboutMe: `Paid User: ${userSession.paidUsername}`, credits: 1000, paypalEmail: undefined }; 
         try {
            const storedProfileString = localStorage.getItem(`${LOCAL_STORAGE_USER_PROFILE_KEY}_${userSession.paidUsername}`);
            if (storedProfileString) {
                const parsedProfile = JSON.parse(storedProfileString);
                if (parsedProfile && typeof parsedProfile === 'object') {
                    loadedProfile = { ...loadedProfile, ...parsedProfile, credits: typeof parsedProfile.credits === 'number' ? parsedProfile.credits : 1000, paypalEmail: typeof parsedProfile.paypalEmail === 'string' ? parsedProfile.paypalEmail : undefined }; 
                }
            }
        } catch (error) { console.error(`[App.tsx] Error loading profile for ${userSession.paidUsername}:`, error); }
        profileToSet = loadedProfile;
    } else { 
      setIsLoginModalInitiallyOpen(true); 
      setIsLanguageLearningModalOpen(false); setIsGamesModalOpen(false); setIsVoiceAgentWidgetActive(false); setIsWebGamePlayerModalOpen(false); setActiveWebGameType(null);
    }
    setUserProfile(profileToSet);
    setIsAppReady(true); 
  }, [currentUser, userSession.isDemoUser, userSession.isPaidUser, userSession.paidUsername, userSession.demoUsername]);

  useEffect(() => {
    // Only save profile for Admin or Paid users. DEMO user profiles are not saved to localStorage.
    if (isAppReady && ((currentUser && !userSession.isDemoUser && !userSession.isPaidUser) || (userSession.isPaidUser && userSession.paidUsername))) { 
      try {
        let profileKey = LOCAL_STORAGE_USER_PROFILE_KEY; // Default for admin or if paidUsername somehow not set
        if (userSession.isPaidUser && userSession.paidUsername) {
            profileKey = `${LOCAL_STORAGE_USER_PROFILE_KEY}_${userSession.paidUsername}`;
        } else if (currentUser?.name === "Admin User") { // Explicitly for Admin
             profileKey = `${LOCAL_STORAGE_USER_PROFILE_KEY}_admin`;
        } else {
            return; // Do not save if it's not admin or a specific paid user
        }
        localStorage.setItem(profileKey, JSON.stringify(userProfile));
      } catch (error) { console.error("Error saving user profile:", error); }
    }
  }, [userProfile, currentUser, isAppReady, userSession.isDemoUser, userSession.isPaidUser, userSession.paidUsername]);

  const toggleTheme = useCallback(() => setTheme(prev => prev === 'light' ? 'dark' : 'light'), []);

  const handleLogin = useCallback(async (loginCode: string) => { // loginCode is now username for all types
    setIsLoginModalInitiallyOpen(false);
    setCurrentUser(null); 
    setUserSession({ 
        isDemoUser: false, demoUsername: undefined, demoUserToken: null, demoLimits: null,
        isPaidUser: false, paidUsername: undefined, paidUserToken: null, paidSubscriptionEndDate: null, paidLimits: null,
    });
    setIsNewsModalOpen(false);

    try {
        const response = await fetch('/api/auth/verify-code', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: loginCode }),
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => `Proxy request failed with status ${response.status}`);
            addAppNotification(`Login failed: ${errorText.substring(0,100)}`, "error", `Status: ${response.status}`);
            return;
        }
        const data = await response.json() as LoginResponseType; 

        if (data.success) {
            if ((data as AdminLoginResponse).isAdmin) {
                setCurrentUser({ name: "Admin User" });
                setUserSession(prev => ({ ...prev, isPaidUser: false, isDemoUser: false })); 
                addAppNotification("Admin login successful!", "success");
                setIsNewsModalOpen(true);
            } else if ((data as DemoUserLoginResponse).isDemoUser) {
                const demoData = data as DemoUserLoginResponse;
                setCurrentUser({ name: demoData.username }); // Set current user for DEMO as well
                setUserSession({ 
                    isDemoUser: true, demoUsername: demoData.username, demoUserToken: demoData.demoUserToken, demoLimits: demoData.limits,
                    isPaidUser: false, paidLimits: null, paidSubscriptionEndDate: null, paidUserToken: null, paidUsername: undefined,
                });
                addAppNotification(`Logged in as DEMO user: ${demoData.username}. Monthly limits apply.`, "info");
                setIsNewsModalOpen(true);
            } else if ((data as PaidLoginResponse).isPaidUser) {
                const paidData = data as PaidLoginResponse;
                setCurrentUser({ name: paidData.username });
                setUserSession({
                    isPaidUser: true, paidUsername: paidData.username, paidUserToken: paidData.paidUserToken || null, 
                    paidSubscriptionEndDate: paidData.subscriptionEndDate || null, paidLimits: paidData.limits,
                    isDemoUser: false, demoUserToken: null, demoLimits: null, demoUsername: undefined, 
                });
                addAppNotification(`Welcome back, ${paidData.username}! Subscription active until ${new Date(paidData.subscriptionEndDate || 0).toLocaleDateString()}.`, "success");
                setIsNewsModalOpen(true);
            } else {
                 addAppNotification(data.message || "Login successful, but user type undetermined.", "warning");
            }
        } else {
             addAppNotification(data.message || "Invalid login code or username.", "error");
        }
    } catch (error: any) {
         addAppNotification(`Login request failed: ${error.message || 'Network error or malformed response'}.`, "error", "Check if the proxy server is running.");
    }
  }, [addAppNotification]);

  const handleLogout = useCallback(() => {
    setCurrentUser(null); 
    setUserSession({ 
        isDemoUser: false, demoUsername: undefined, demoUserToken: null, demoLimits: null,
        isPaidUser: false, paidUsername: undefined, paidUserToken: null, paidSubscriptionEndDate: null, paidLimits: null,
    }); 
    addAppNotification("You have been logged out.", "info");
    setIsNewsModalOpen(false);
  }, [addAppNotification]);
  
  const updateDemoLimits = useCallback((updatedLimits: Partial<DemoUserLimits | PaidUserLimits>) => {
    setUserSession(prev => {
        if (prev.isDemoUser && prev.demoLimits && ('fluxKontextMaxMonthlyUsesLeft' in updatedLimits || 'imagen3MonthlyImagesLeft' in updatedLimits || 'klingVideoMonthlyUsed' in updatedLimits)) {
            const newDemoLimits = { ...prev.demoLimits, ...(updatedLimits as Partial<DemoUserLimits>) };
            return { ...prev, demoLimits: newDemoLimits };
        } else if (prev.isPaidUser && prev.paidLimits && ('imagen3ImagesLeft' in updatedLimits || 'fluxUltraMonthlyImagesLeft' in updatedLimits || 'klingVideoMonthlyUsed' in updatedLimits)) { 
            const newPaidLimits = { ...prev.paidLimits, ...(updatedLimits as Partial<PaidUserLimits>) };
            return { ...prev, paidLimits: newPaidLimits };
        }
        return prev;
    });
  }, []);

  const handleUpdateUserProfile = useCallback((updatedProfile: UserGlobalProfile) => setUserProfile(updatedProfile), []);
  const handleChatBackgroundChange = useCallback((newUrl: string | null) => {
    setChatBackgroundUrl(newUrl);
    if (newUrl) localStorage.setItem(LOCAL_STORAGE_CHAT_BACKGROUND_KEY, newUrl);
    else localStorage.removeItem(LOCAL_STORAGE_CHAT_BACKGROUND_KEY);
  }, []);
  const handleAddExp = useCallback((language: LanguageOption, expPoints: number, boundAddAppNotification?: (message: string, type: AppNotificationType, details?: string) => void): void => {
    const effectiveAddNotification = boundAddAppNotification || addAppNotification;
    setUserProfile((prevProfile: UserGlobalProfile): UserGlobalProfile => {
      const newProfile: UserGlobalProfile = JSON.parse(JSON.stringify(prevProfile)); 
      if (!newProfile.languageProfiles) newProfile.languageProfiles = {};
      if (!newProfile.languageProfiles[language]) newProfile.languageProfiles[language] = { ...DEFAULT_USER_LANGUAGE_PROFILE };
      const langProfile = newProfile.languageProfiles[language] as UserLanguageProfile; 
      const oldExp = langProfile.exp;
      langProfile.exp += expPoints;
      EXP_MILESTONES_CONFIG.forEach(milestone => {
        if (oldExp < milestone.exp && langProfile.exp >= milestone.exp) {
          langProfile.exp += milestone.bonus;
          if (effectiveAddNotification) effectiveAddNotification(`Milestone Reached! +${milestone.bonus} bonus EXP for ${language.toUpperCase()}!`, 'success');
          if (milestone.badgeId && !langProfile.earnedBadgeIds.includes(milestone.badgeId)) {
            langProfile.earnedBadgeIds.push(milestone.badgeId);
            const badge = BADGES_CATALOG[milestone.badgeId];
            if (badge && effectiveAddNotification) effectiveAddNotification(`Badge Unlocked: ${badge.name} (${badge.icon}) for ${language.toUpperCase()}!`, 'success', badge.description);
          }
        }
      });
      return newProfile; 
    });
  }, [addAppNotification]); 
  const handleAddExpWithNotification = useCallback((language: LanguageOption, expPoints: number) => handleAddExp(language, expPoints, addAppNotification), [addAppNotification, handleAddExp]);
  const onLoginModalOpened = useCallback(() => setIsLoginModalInitiallyOpen(false), []);
  const onToggleLanguageLearningModal = useCallback(() => { if (currentUser || userSession.isDemoUser || userSession.isPaidUser) setIsLanguageLearningModalOpen(prev => !prev); }, [currentUser, userSession.isDemoUser, userSession.isPaidUser]);
  const onToggleGamesModal = useCallback(() => { if (currentUser || userSession.isDemoUser || userSession.isPaidUser) setIsGamesModalOpen(prev => !prev); }, [currentUser, userSession.isDemoUser, userSession.isPaidUser]);
  const onToggleVoiceAgentWidget = useCallback(() => { if (currentUser || userSession.isDemoUser || userSession.isPaidUser) setIsVoiceAgentWidgetActive(prev => !prev); }, [currentUser, userSession.isDemoUser, userSession.isPaidUser]);
  const onPlayWebGame = useCallback((gameType: WebGameType, gameTitle: string) => {
    if (gameType) { setActiveWebGameType(gameType); setActiveWebGameTitle(gameTitle); setIsWebGamePlayerModalOpen(true); setIsGamesModalOpen(false); }
  }, []);
  const onCloseWebGamePlayerModal = useCallback(() => { setIsWebGamePlayerModalOpen(false); setActiveWebGameType(null); setActiveWebGameTitle(''); }, []);
  const handlePurchaseCredits = useCallback((packageId: string, paymentMethod: 'paypal' | 'stripe' | 'vietqr') => {
    const pkg = DEMO_CREDIT_PACKAGES.find(p => p.id === packageId);
    if (pkg) {
      setUserProfile(prev => ({ ...prev, credits: (prev.credits || 0) + pkg.creditsAwarded }));
      addAppNotification(`Successfully purchased ${pkg.name} (+${pkg.creditsAwarded} credits) using ${paymentMethod}. (Mock Purchase)`, 'success');
    } else {
      addAppNotification("Credit package not found.", "error");
    }
  }, [addAppNotification]);
  const handleSavePayPalEmail = useCallback((email: string) => {
    setUserProfile(prev => ({ ...prev, paypalEmail: email }));
    addAppNotification("Mock: PayPal email saved.", "info");
  }, [addAppNotification]);

  const handleToggleNewsModal = useCallback(() => setIsNewsModalOpen(true), []);

  const themeContextValue = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <ErrorBoundary fallbackUIMessage="A critical error occurred in the application.">
        <AppContent
          currentUser={currentUser} onLogin={handleLogin} onLogout={handleLogout} isLoginModalInitiallyOpen={isLoginModalInitiallyOpen} onLoginModalOpened={onLoginModalOpened}
          isLanguageLearningModalOpen={isLanguageLearningModalOpen} onToggleLanguageLearningModal={onToggleLanguageLearningModal}
          isGamesModalOpen={isGamesModalOpen} onToggleGamesModal={onToggleGamesModal}
          isVoiceAgentWidgetActive={isVoiceAgentWidgetActive} onToggleVoiceAgentWidget={onToggleVoiceAgentWidget}
          userProfile={userProfile} onUpdateUserProfile={handleUpdateUserProfile} onAddExpWithNotification={handleAddExpWithNotification}
          activeWebGameType={activeWebGameType} onPlayWebGame={onPlayWebGame} activeWebGameTitle={activeWebGameTitle} isWebGamePlayerModalOpen={isWebGamePlayerModalOpen} onCloseWebGamePlayerModal={onCloseWebGamePlayerModal}
          isTienLenModalOpen={activeWebGameType === 'tien-len' && isWebGamePlayerModalOpen} onToggleTienLenModal={() => {}} // Empty func for now as it's part of WebGamePlayerModal flow
          chatBackgroundUrl={chatBackgroundUrl} onChatBackgroundChange={handleChatBackgroundChange}
          isAppReady={isAppReady}
          currentUserCredits={userProfile.credits} onPurchaseCredits={handlePurchaseCredits} paypalEmail={userProfile.paypalEmail} onSavePayPalEmail={handleSavePayPalEmail}
          userSession={userSession} onUpdateDemoLimits={updateDemoLimits}
          isNewsModalOpen={isNewsModalOpen} 
          onCloseNewsModal={() => setIsNewsModalOpen(false)} 
          onToggleNewsModal={handleToggleNewsModal} // Pass handler
        />
      </ErrorBoundary>
    </ThemeContext.Provider>
  );
};

export const RootAppWrapper: React.FC = () => {
  return (
    <NotificationProvider>
      <App />
    </NotificationProvider>
  );
};