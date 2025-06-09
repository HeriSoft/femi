
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ThemeContextType, Model, UserGlobalProfile, LanguageOption, UserLanguageProfile, WebGameType, NotificationType as AppNotificationType, TienLenGameModalProps, CreditPackage, UserSessionState, DemoLoginResponse, DemoUserLimits, LoginResponseType, PaidLoginResponse, AdminLoginResponse, PaidUserLimits } from './types.ts';
import ChatPage from './components/ChatPage.tsx';
import Header, { MockUser } from './components/Header.tsx';
import LanguageLearningModal from './components/LanguageLearningModal.tsx';
import GamesModal from './components/GamesModal.tsx';
import WebGamePlayerModal from './components/WebGamePlayerModal.tsx';
import TienLenGameModal from './components/games/tienlen/TienLenGameModal.tsx';
import { NotificationProvider, useNotification } from './contexts/NotificationContext.tsx';
import { KeyIcon } from './components/Icons.tsx';
import { LOCAL_STORAGE_USER_PROFILE_KEY, DEFAULT_USER_LANGUAGE_PROFILE, EXP_MILESTONES_CONFIG, BADGES_CATALOG, LOCAL_STORAGE_CHAT_BACKGROUND_KEY, DEMO_CREDIT_PACKAGES, DEMO_USER_KEY, INITIAL_DEMO_USER_LIMITS, PAID_USER_LIMITS_CONFIG } from './constants.ts';

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
  onUpdateDemoLimits: (updatedLimits: Partial<DemoUserLimits>) => void;
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
  userSession, onUpdateDemoLimits
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
    <div className="flex flex-col h-screen bg-secondary-light dark:bg-neutral-dark transition-colors duration-300 overflow-hidden">
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
              Please log in to access the AI chat application. You can do this by clicking the "Login" button in the header. Try "DEMO" or your paid user code.
            </p>
          </div>
        )}
      </main>
      {(currentUser || userSession.isDemoUser || userSession.isPaidUser) && (
        <>
          <LanguageLearningModal isOpen={isLanguageLearningModalOpen} onClose={onToggleLanguageLearningModal} userProfile={userProfile} onUpdateProfile={onUpdateUserProfile} onAddExp={onAddExpWithNotification} />
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
    demoUserToken: null,
    demoLimits: null,
    isDemoBlockedByVpn: false,
    isPaidUser: false,
    paidUsername: undefined,
    paidUserToken: null,
    paidSubscriptionEndDate: null,
    paidLimits: null,
  });

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
    if (currentUser && !userSession.isDemoUser && !userSession.isPaidUser) { // Admin user
      let loadedProfile: UserGlobalProfile = { languageProfiles: {}, aboutMe: 'Admin User', credits: 99999, paypalEmail: undefined }; 
      // Admin might have a separate profile or default high credits
      setUserProfile(loadedProfile);
    } else if (userSession.isDemoUser) { 
      setUserProfile({ languageProfiles: {}, aboutMe: 'DEMO User', credits: 0, paypalEmail: undefined }); 
    } else if (userSession.isPaidUser) {
        let loadedProfile: UserGlobalProfile = { languageProfiles: {}, aboutMe: `Paid User: ${userSession.paidUsername}`, credits: 1000, paypalEmail: undefined }; // Example credits
         try {
            const storedProfileString = localStorage.getItem(`${LOCAL_STORAGE_USER_PROFILE_KEY}_${userSession.paidUsername}`);
            if (storedProfileString) {
                const parsedProfile = JSON.parse(storedProfileString);
                if (parsedProfile && typeof parsedProfile === 'object') {
                    loadedProfile = { ...loadedProfile, ...parsedProfile, credits: typeof parsedProfile.credits === 'number' ? parsedProfile.credits : 1000, paypalEmail: typeof parsedProfile.paypalEmail === 'string' ? parsedProfile.paypalEmail : undefined }; 
                }
            }
        } catch (error) { console.error(`[App.tsx] Error loading profile for ${userSession.paidUsername}:`, error); }
        setUserProfile(loadedProfile);
    } else { 
      setUserProfile({ languageProfiles: {}, aboutMe: '', credits: 0, paypalEmail: undefined }); 
      setIsLoginModalInitiallyOpen(true); 
      setIsLanguageLearningModalOpen(false); setIsGamesModalOpen(false); setIsVoiceAgentWidgetActive(false); setIsWebGamePlayerModalOpen(false); setActiveWebGameType(null);
    }
    setIsAppReady(true); 
  }, [currentUser, userSession.isDemoUser, userSession.isPaidUser, userSession.paidUsername]);

  useEffect(() => {
    if (currentUser && isAppReady) { 
      try {
        let profileKey = LOCAL_STORAGE_USER_PROFILE_KEY;
        if (userSession.isPaidUser && userSession.paidUsername) {
            profileKey = `${LOCAL_STORAGE_USER_PROFILE_KEY}_${userSession.paidUsername}`;
        } else if (userSession.isDemoUser || (!userSession.isDemoUser && !userSession.isPaidUser && currentUser?.name === "Admin User")) {
            // Admin profile might be stored under a generic key or not stored if it's static
            // Demo user profile is not persisted this way
            return; 
        }
        localStorage.setItem(profileKey, JSON.stringify(userProfile));
      } catch (error) { console.error("Error saving user profile:", error); }
    }
  }, [userProfile, currentUser, isAppReady, userSession.isDemoUser, userSession.isPaidUser, userSession.paidUsername]);

  const toggleTheme = useCallback(() => setTheme(prev => prev === 'light' ? 'dark' : 'light'), []);

  const handleLogin = useCallback(async (loginCode: string) => {
    setIsLoginModalInitiallyOpen(false);
    setCurrentUser(null); // Reset previous user state
    setUserSession({ // Reset session state
        isDemoUser: false, demoUserToken: null, demoLimits: null, isDemoBlockedByVpn: false,
        isPaidUser: false, paidUsername: undefined, paidUserToken: null, paidSubscriptionEndDate: null, paidLimits: null,
    });

    if (loginCode.toUpperCase() === DEMO_USER_KEY) { 
        try {
            const response = await fetch('/api/auth/demo-login', { method: 'POST' });
            if (!response.ok) {
                const errorText = await response.text().catch(() => `Proxy request failed with status ${response.status}`);
                addAppNotification(`DEMO login failed: ${errorText.substring(0,100)}`, "error", `Status: ${response.status}`);
                let isBlockedByVpnLocal = false; 
                try { const errJson = JSON.parse(errorText); if(errJson.isBlocked) isBlockedByVpnLocal = true;} catch(_) {}
                setUserSession(prev => ({ ...prev, isDemoBlockedByVpn: isBlockedByVpnLocal })); 
                return;
            }
            const data = await response.json() as DemoLoginResponse;
            if (data.success && data.demoUserToken && data.limits) {
                setCurrentUser({ name: "DEMO User" }); 
                setUserSession({ 
                    isDemoUser: true, demoUserToken: data.demoUserToken, demoLimits: data.limits, 
                    isDemoBlockedByVpn: data.isBlocked || false,
                    isPaidUser: false, paidLimits: null 
                });
                addAppNotification("Logged in as DEMO user. Usage limits apply.", "info");
                if (data.isBlocked) addAppNotification("DEMO access for your IP is restricted.", "error");
                if (data.cooldownActive) addAppNotification(data.message || "DEMO user is in cool-down.", "warning");

            } else {
                addAppNotification(data.message || "DEMO login failed.", "error", data.isBlocked ? "VPN/Proxy likely detected." : (data.message?.includes("cool-down") ? data.message : undefined));
                setUserSession(prev => ({ ...prev, isDemoBlockedByVpn: data.isBlocked || false }));
            }
        } catch (error: any) {
            addAppNotification(`Error during DEMO login: ${error.message || 'Network error or malformed response'}.`, "error", "Check if the proxy server is running.");
        }
    } else { 
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
                } else if ((data as PaidLoginResponse).isPaidUser) {
                    const paidData = data as PaidLoginResponse;
                    setCurrentUser({ name: paidData.username });
                    setUserSession({
                        isPaidUser: true, 
                        paidUsername: paidData.username, 
                        paidUserToken: paidData.paidUserToken || null, 
                        paidSubscriptionEndDate: paidData.subscriptionEndDate || null,
                        paidLimits: paidData.limits,
                        isDemoUser: false, demoUserToken: null, demoLimits: null, isDemoBlockedByVpn: false, 
                    });
                    addAppNotification(`Welcome back, ${paidData.username}! Subscription active until ${new Date(paidData.subscriptionEndDate || 0).toLocaleDateString()}.`, "success");
                } else {
                     addAppNotification(data.message || "Login successful, but user type undetermined.", "warning");
                }
            } else {
                 addAppNotification(data.message || "Invalid login code or username.", "error");
            }
        } catch (error: any) {
             addAppNotification(`Login request failed: ${error.message || 'Network error or malformed response'}.`, "error", "Check if the proxy server is running.");
        }
    }
  }, [addAppNotification]);

  const handleLogout = useCallback(() => {
    setCurrentUser(null); 
    setUserSession({ 
        isDemoUser: false, demoUserToken: null, demoLimits: null, isDemoBlockedByVpn: false,
        isPaidUser: false, paidUsername: undefined, paidUserToken: null, paidSubscriptionEndDate: null, paidLimits: null,
    }); 
    addAppNotification("You have been logged out.", "info");
  }, [addAppNotification]);
  
  const updateDemoLimits = useCallback((updatedLimits: Partial<DemoUserLimits>) => {
    setUserSession(prev => {
        if (prev.isDemoUser && prev.demoLimits) {
            const newLimits = { ...prev.demoLimits, ...updatedLimits };
            if (newLimits.fluxKontextUsesLeft < 0) newLimits.fluxKontextUsesLeft = 0;
            if (newLimits.imagen3ImagesLeft < 0) newLimits.imagen3ImagesLeft = 0;
            if (newLimits.openaiTtsCharsLeft < 0) newLimits.openaiTtsCharsLeft = 0;
            return { ...prev, demoLimits: newLimits };
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

  const themeContextValue = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return (
    <ThemeContext.Provider value={themeContextValue}>
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
      />
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
