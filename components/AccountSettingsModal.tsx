
import React, { useState, useEffect, useRef } from 'react';
import { LoginDeviceLog, AccountSettingsModalProps as LocalAccountSettingsModalProps, AccountTabType, BackgroundOption, UserGlobalProfile, CreditPackage } from '../types.ts';
import { XMarkIcon, ComputerDesktopIcon, ClockIcon, PhotoIcon, UserCircleIcon as AvatarIcon, CreditCardIcon, CheckCircleIcon, UserCogIcon, ArrowUpTrayIcon, IdentificationIcon, BanknotesIcon as CreditsCoinIcon, PayPalIcon, StripeIcon, QrCodeIcon, BuildingStorefrontIcon, BillingIcon } from './Icons.tsx';
import { LOCAL_STORAGE_DEVICE_LOGS_KEY, ACCOUNT_MENU_ITEMS, DEMO_BACKGROUNDS, DEMO_CREDIT_PACKAGES } from '../constants.ts';
import { useNotification } from '../contexts/NotificationContext.tsx';


const AccountSettingsModal: React.FC<LocalAccountSettingsModalProps> = ({ 
    isOpen, 
    onClose,
    onChatBackgroundChange,
    currentChatBackground,
    userProfile,
    onUpdateUserProfile,
    currentUserCredits,
    onPurchaseCredits,
    paypalEmail: initialPayPalEmail, // Renamed to avoid conflict with local state
    onSavePayPalEmail,
}) => {
  const [activeTab, setActiveTab] = useState<AccountTabType>(ACCOUNT_MENU_ITEMS[0].id);
  const [deviceLogs, setDeviceLogs] = useState<LoginDeviceLog[]>([]);
  const { addNotification } = useNotification();
  
  const [selectedBackgroundId, setSelectedBackgroundId] = useState<string>(
    DEMO_BACKGROUNDS.find(bg => bg.imageUrl === currentChatBackground)?.id || DEMO_BACKGROUNDS[0].id
  );
  const [customBackgroundFile, setCustomBackgroundFile] = useState<File | null>(null);
  const [customBackgroundPreviewUrl, setCustomBackgroundPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [aboutMeText, setAboutMeText] = useState(userProfile?.aboutMe || '');
  const [currentPaypalEmailInput, setCurrentPaypalEmailInput] = useState(initialPayPalEmail || '');


  useEffect(() => {
    if (isOpen) {
      const demoOption = DEMO_BACKGROUNDS.find(bg => bg.imageUrl === currentChatBackground);
      if (demoOption) {
        setSelectedBackgroundId(demoOption.id);
        setCustomBackgroundFile(null);
        setCustomBackgroundPreviewUrl(null);
      } else if (currentChatBackground) {
        setSelectedBackgroundId('custom_upload');
        setCustomBackgroundPreviewUrl(currentChatBackground);
        setCustomBackgroundFile(null);
      } else {
        setSelectedBackgroundId(DEMO_BACKGROUNDS[0].id);
        setCustomBackgroundFile(null);
        setCustomBackgroundPreviewUrl(null);
      }

      if (activeTab === 'devices') {
        try {
          const storedLogs = localStorage.getItem(LOCAL_STORAGE_DEVICE_LOGS_KEY);
          if (storedLogs) setDeviceLogs(JSON.parse(storedLogs));
          else setDeviceLogs([]);
        } catch (error) {
          console.error("Error loading device logs:", error);
          setDeviceLogs([]);
          addNotification("Failed to load device logs.", "error");
        }
      }
      if (activeTab === 'profile') {
        setAboutMeText(userProfile?.aboutMe || '');
      }
      if (activeTab === 'credits') {
        setCurrentPaypalEmailInput(initialPayPalEmail || '');
      }
    }
  }, [isOpen, activeTab, currentChatBackground, userProfile, addNotification, initialPayPalEmail]);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(undefined, {
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  const handleCustomBackgroundUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        addNotification("Image file is too large. Max 5MB allowed.", "error");
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
        addNotification("Invalid file type. Please upload JPG, PNG, WEBP, or GIF.", "error");
        return;
      }
      setCustomBackgroundFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomBackgroundPreviewUrl(reader.result as string);
        setSelectedBackgroundId('custom_upload');
      };
      reader.readAsDataURL(file);
    }
    event.target.value = '';
  };

  const handleSaveBackground = () => {
    if (selectedBackgroundId === 'custom_upload' && customBackgroundPreviewUrl) {
        onChatBackgroundChange(customBackgroundPreviewUrl);
        addNotification("Custom chat background updated.", 'success');
    } else {
        const selectedBg = DEMO_BACKGROUNDS.find(bg => bg.id === selectedBackgroundId);
        if (selectedBg) {
            const newUrl = selectedBg.imageUrl === '' ? null : selectedBg.imageUrl;
            onChatBackgroundChange(newUrl);
            addNotification(`Chat background updated to "${selectedBg.name}".`, 'success');
        } else {
            addNotification("Could not save background. Option not found.", 'error');
        }
    }
  };
  
  const handleSaveAboutMe = () => {
    if (userProfile) {
        const updatedProfile: UserGlobalProfile = {
            ...userProfile,
            aboutMe: aboutMeText.trim(),
        };
        onUpdateUserProfile(updatedProfile);
        addNotification("Your profile information has been saved.", "success");
    } else {
        addNotification("Could not save profile information. User profile not available.", "error");
    }
  };

  const handleSavePayPalEmailLocal = () => {
    // Basic email validation (can be improved)
    if (!currentPaypalEmailInput.trim() || !/\S+@\S+\.\S+/.test(currentPaypalEmailInput.trim())) {
        addNotification("Please enter a valid PayPal email address.", "error");
        return;
    }
    onSavePayPalEmail(currentPaypalEmailInput.trim());
    addNotification("PayPal email updated for quick checkout.", "success");
  };

  const getIconForTab = (tabId: AccountTabType) => {
    switch(tabId) {
        case 'profile': return <IdentificationIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3" />;
        case 'credits': return <CreditsCoinIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3" />;
        case 'devices': return <ComputerDesktopIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3" />;
        case 'background': return <PhotoIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3" />;
        case 'avatar': return <AvatarIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3" />;
        case 'payment': return <CreditCardIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3" />;
        default: return null;
    }
  }

  if (!isOpen) return null;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <section>
            <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light mb-3">
              About Me
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
              Provide some information about yourself so the AI can understand you better. 
              This context will be used to tailor responses. (e.g., your profession, interests, communication style preferences).
            </p>
            <textarea
              value={aboutMeText}
              onChange={(e) => setAboutMeText(e.target.value)}
              rows={8}
              className="w-full p-3 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none text-sm"
              placeholder="E.g., I am a software developer specializing in frontend technologies. I enjoy discussing programming, science fiction, and learning new languages. Please provide concise and technical answers when appropriate."
            />
            <button 
              onClick={handleSaveAboutMe}
              className="mt-4 px-6 py-2 bg-primary hover:bg-primary-dark dark:bg-primary-light dark:hover:bg-primary text-white dark:text-neutral-darker rounded-md text-sm font-medium"
            >
              Save Profile
            </button>
          </section>
        );
      case 'credits':
        return (
            <section className="space-y-6">
                <div>
                    <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light mb-2 flex items-center">
                        <CreditsCoinIcon className="w-6 h-6 mr-2 text-yellow-500" /> Your Current Balance
                    </h3>
                    <p className="text-3xl font-bold text-primary dark:text-primary-light">
                        🪙 {currentUserCredits.toLocaleString()} Credits
                    </p>
                </div>

                <div className="pt-4 border-t border-secondary dark:border-neutral-darkest">
                    <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light mb-3 flex items-center">
                        <BuildingStorefrontIcon className="w-6 h-6 mr-2 text-green-500" /> Purchase Credits
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {DEMO_CREDIT_PACKAGES.map((pkg) => (
                            <div key={pkg.id} className="p-4 border border-secondary dark:border-neutral-darkest rounded-lg bg-neutral-light dark:bg-neutral-dark shadow-sm flex flex-col justify-between">
                                <div>
                                    <h4 className="text-md font-semibold text-neutral-darker dark:text-secondary-light">{pkg.name}</h4>
                                    <p className="text-2xl font-bold text-accent dark:text-accent-light my-1">
                                        {pkg.creditsAwarded.toLocaleString()} <span className="text-sm">Credits</span>
                                    </p>
                                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                                        Price: ${pkg.price.toFixed(2)} {pkg.currency}
                                    </p>
                                    {pkg.description && <p className="text-xs text-neutral-500 dark:text-neutral-500 mb-3">{pkg.description}</p>}
                                </div>
                                <div className="space-y-2 mt-auto">
                                    <button onClick={() => onPurchaseCredits(pkg.id, 'paypal')} className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-[#0070BA] hover:bg-[#005EA6] rounded-md transition-colors">
                                        <PayPalIcon className="w-5 h-5 mr-2" /> Buy with PayPal
                                    </button>
                                    <button onClick={() => onPurchaseCredits(pkg.id, 'stripe')} className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-[#635BFF] hover:bg-[#534ACC] rounded-md transition-colors">
                                        <StripeIcon className="w-5 h-5 mr-2" /> Pay with Card
                                    </button>
                                    <button onClick={() => onPurchaseCredits(pkg.id, 'vietqr')} className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-neutral-darker dark:text-secondary-light bg-secondary dark:bg-neutral-darkest hover:bg-secondary-dark dark:hover:bg-neutral-dark rounded-md transition-colors">
                                        <QrCodeIcon className="w-5 h-5 mr-2" /> VietQR
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="pt-4 border-t border-secondary dark:border-neutral-darkest">
                    <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light mb-3 flex items-center">
                        <CreditCardIcon className="w-6 h-6 mr-2 text-blue-500" /> Payment Settings
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="paypal-email" className="block text-sm font-medium text-neutral-600 dark:text-neutral-300 mb-1">PayPal Email for Quick Checkout</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="email"
                                    id="paypal-email"
                                    value={currentPaypalEmailInput}
                                    onChange={(e) => setCurrentPaypalEmailInput(e.target.value)}
                                    placeholder="your.paypal.email@example.com"
                                    className="flex-grow p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none text-sm"
                                />
                                <button onClick={handleSavePayPalEmailLocal} className="px-4 py-2 text-sm text-white bg-primary hover:bg-primary-dark rounded-md">Save</button>
                            </div>
                        </div>
                        <div>
                            <button onClick={() => addNotification("Manage Stripe Cards: Feature coming soon!", "info")} className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-neutral-darker dark:text-secondary-light bg-secondary dark:bg-neutral-darkest hover:bg-secondary-dark dark:hover:bg-neutral-dark rounded-md transition-colors">
                                Manage Payment Cards (Stripe)
                            </button>
                             <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Full card management via Stripe integration coming soon.</p>
                        </div>
                         <div>
                            <button onClick={() => addNotification("View Billing History: Feature coming soon!", "info")} className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-neutral-darker dark:text-secondary-light bg-secondary dark:bg-neutral-darkest hover:bg-secondary-dark dark:hover:bg-neutral-dark rounded-md transition-colors flex items-center">
                               <BillingIcon className="w-5 h-5 mr-2"/> View Billing History
                            </button>
                             <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Access your invoices and payment history (coming soon).</p>
                        </div>
                    </div>
                </div>
            </section>
        );
      case 'devices':
        return (
          <section>
            <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light mb-3">
              Device Activity
            </h3>
            <div className="p-3 sm:p-4 bg-secondary/30 dark:bg-neutral-dark/20 rounded-md">
              <h4 className="text-md font-medium text-neutral-700 dark:text-neutral-200 mb-2">
                Logs
              </h4>
              {deviceLogs.length > 0 ? (
                <ul className="space-y-2 text-sm max-h-60 overflow-y-auto pr-2">
                  {deviceLogs.map((log) => (
                    <li key={log.id} className="p-2.5 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-neutral-darker dark:text-secondary-light">
                           {log.device}
                        </span>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center">
                          <ClockIcon className="w-3.5 h-3.5 mr-1" />
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">No recent device logs found.</p>
              )}
            </div>
          </section>
        );
      case 'background':
        return (
          <section>
            <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light mb-3">
              Chat Background
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {DEMO_BACKGROUNDS.map(bg => (
                <button 
                  key={bg.id} 
                  onClick={() => {
                    setSelectedBackgroundId(bg.id);
                    setCustomBackgroundFile(null); 
                    setCustomBackgroundPreviewUrl(null);
                  }}
                  className={`relative rounded-lg overflow-hidden border-2 aspect-[16/10] transition-all duration-200 ease-in-out focus:outline-none
                              ${selectedBackgroundId === bg.id ? 'border-primary dark:border-primary-light ring-2 ring-primary dark:ring-primary-light' : 'border-transparent hover:border-primary/50 dark:hover:border-primary-light/50'}`}
                  aria-pressed={selectedBackgroundId === bg.id}
                  aria-label={`Select background: ${bg.name}`}
                >
                  {bg.thumbnailUrl ? (
                    <img src={bg.thumbnailUrl} alt={bg.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-secondary dark:bg-neutral-dark flex items-center justify-center">
                       <span className="text-xs text-neutral-500 dark:text-neutral-400">Default</span>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/50 text-white text-xs text-center truncate">
                    {bg.name}
                  </div>
                  {selectedBackgroundId === bg.id && (
                    <div className="absolute top-1 right-1 bg-primary dark:bg-primary-light text-white rounded-full p-0.5">
                      <CheckCircleIcon className="w-4 h-4" />
                    </div>
                  )}
                </button>
              ))}
              {customBackgroundPreviewUrl && (
                 <button 
                  onClick={() => setSelectedBackgroundId('custom_upload')}
                  className={`relative rounded-lg overflow-hidden border-2 aspect-[16/10] transition-all duration-200 ease-in-out focus:outline-none
                              ${selectedBackgroundId === 'custom_upload' ? 'border-primary dark:border-primary-light ring-2 ring-primary dark:ring-primary-light' : 'border-transparent hover:border-primary/50 dark:hover:border-primary-light/50'}`}
                  aria-pressed={selectedBackgroundId === 'custom_upload'}
                  aria-label="Select custom uploaded background"
                >
                    <img src={customBackgroundPreviewUrl} alt="Custom Upload Preview" className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/50 text-white text-xs text-center truncate">
                        Custom Upload
                    </div>
                    {selectedBackgroundId === 'custom_upload' && (
                        <div className="absolute top-1 right-1 bg-primary dark:bg-primary-light text-white rounded-full p-0.5">
                        <CheckCircleIcon className="w-4 h-4" />
                        </div>
                    )}
                 </button>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <input 
                    type="file" 
                    accept="image/jpeg, image/png, image/webp, image/gif" 
                    ref={fileInputRef}
                    onChange={handleCustomBackgroundUpload}
                    className="hidden" 
                    aria-labelledby="upload-custom-bg-button"
                />
                <button
                    id="upload-custom-bg-button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full sm:w-auto flex items-center justify-center px-4 py-2 border-2 border-dashed border-secondary dark:border-neutral-darkest rounded-md cursor-pointer hover:bg-secondary/50 dark:hover:bg-neutral-dark/50 transition-colors text-sm text-neutral-darker dark:text-secondary-light"
                >
                    <ArrowUpTrayIcon className="w-5 h-5 mr-2"/>
                    Upload Your Own
                </button>
                <button 
                    onClick={handleSaveBackground}
                    className="w-full sm:w-auto px-6 py-2 bg-primary hover:bg-primary-dark dark:bg-primary-light dark:hover:bg-primary text-white dark:text-neutral-darker rounded-md text-sm font-medium"
                >
                    Save Background
                </button>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">Max file size: 5MB. Recommended: JPG, PNG, WEBP.</p>
          </section>
        );
      case 'avatar':
        return (
          <section>
            <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light mb-3">
              Customize Avatar
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400">Avatar customization options will be available here soon.</p>
          </section>
        );
      case 'payment': // This case is now part of 'credits' but kept if direct navigation is ever desired
        return (
          <section>
            <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light mb-3">
              Payment Information
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400">Manage your subscription and payment methods here in the future. (This section is currently combined with Credits)</p>
          </section>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70] p-2 sm:p-4 transition-opacity duration-300"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-settings-modal-title"
    >
      <div
        className="bg-neutral-light dark:bg-neutral-darker rounded-lg shadow-xl w-full max-w-xs sm:max-w-md md:max-w-lg lg:max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col transform transition-all duration-300 scale-100 opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-secondary dark:border-neutral-darkest sticky top-0 bg-neutral-light dark:bg-neutral-darker z-10">
          <h2 id="account-settings-modal-title" className="text-xl sm:text-2xl font-semibold text-primary dark:text-primary-light flex items-center">
            <UserCogIcon className="w-6 h-6 sm:w-7 sm:h-7 mr-2 sm:mr-3" /> Account Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-full text-neutral-darker dark:text-secondary-light hover:bg-secondary dark:hover:bg-neutral-darkest transition-colors"
            aria-label="Close account settings modal"
          >
            <XMarkIcon className="w-5 h-5 sm:w-6 sm:w-6" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-grow overflow-hidden">
          <nav className="flex-shrink-0 md:w-48 lg:w-56 md:border-r border-secondary dark:border-neutral-darkest p-2 sm:p-3 md:p-4 md:space-y-1 overflow-x-auto md:overflow-y-auto whitespace-nowrap md:whitespace-normal">
            <div className="flex flex-row md:flex-col space-x-1 md:space-x-0 md:space-y-1">
              {ACCOUNT_MENU_ITEMS.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  disabled={item.status === 'coming_soon'}
                  className={`w-full flex items-center px-3 py-2.5 text-xs sm:text-sm rounded-md transition-colors text-left whitespace-nowrap
                              ${activeTab === item.id 
                                  ? 'bg-primary text-white dark:bg-primary-light dark:text-neutral-darker font-medium' 
                                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-secondary/70 dark:hover:bg-neutral-dark/70'}
                              ${item.status === 'coming_soon' ? 'opacity-50 cursor-not-allowed' : ''}
                              md:mb-1`}
                  aria-current={activeTab === item.id ? 'page' : undefined}
                >
                  {getIconForTab(item.id)}
                  <span className="flex-grow">{item.label}</span>
                  {item.status === 'coming_soon' && (
                      <span className="ml-auto text-xs px-1.5 py-0.5 bg-yellow-200 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100 rounded-full hidden sm:inline">Soon</span>
                  )}
                </button>
              ))}
            </div>
          </nav>

          <main className="flex-grow p-3 sm:p-4 md:p-6 overflow-y-auto">
            {renderTabContent()}
          </main>
        </div>

        <div className="p-4 sm:p-5 border-t border-secondary dark:border-neutral-darkest sticky bottom-0 bg-neutral-light dark:bg-neutral-darker z-10">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 sm:py-2.5 bg-primary hover:bg-primary-dark dark:bg-primary-light dark:hover:bg-primary text-white dark:text-neutral-darker rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-light dark:ring-offset-neutral-darker focus:ring-primary-dark transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountSettingsModal;
