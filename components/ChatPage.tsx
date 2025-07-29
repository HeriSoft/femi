// Fix: Remove triple-slash directive for 'vite/client' as its types are not found and import.meta.env is manually typed.
// Fix: Add 'useMemo' to React import
import React, { useState, useRef, useEffect, useCallback, useMemo, useContext } from 'react';
// Update to .ts/.tsx extensions
import { Model, ChatMessage, ModelSettings, AllModelSettings, Part, GroundingSource, ApiKeyStatus, getActualModelIdentifier, ApiChatMessage, ApiStreamChunk, ImagenSettings, ChatSession, Persona, OpenAITtsSettings, RealTimeTranslationSettings, OpenAiTtsVoice, ThemeContextType, UserGlobalProfile, AiAgentSmartSettings, PrivateModeSettings, FluxKontexSettings, NotificationType, UserSessionState, DemoUserLimits, PaidUserLimits, SingleImageData, MultiImageData, FluxKontexAspectRatio, EditImageWithFluxKontexParams, FluxDevSettings, GenerateImageWithFluxDevParams, KlingAiSettings, KlingAiDuration, KlingAiAspectRatio, GenerateVideoWithKlingParams, AnyModelSettings, ModelSpecificSettingsMap, TradingProSettings, TradingProState, TradingPair, GeminiTradingAnalysisResponse, FluxDevImageSize } from '../types.ts'; // Removed AlphaVantageProxyResponse
import type { Content } from '@google/genai'; // For constructing Gemini history
import { ALL_MODEL_DEFAULT_SETTINGS, API_KEY_STATUSES_DEFINITIONS, LOCAL_STORAGE_SETTINGS_KEY, LOCAL_STORAGE_HISTORY_KEY, LOCAL_STORAGE_PERSONAS_KEY, TRANSLATION_TARGET_LANGUAGES, MAX_SAVED_CHAT_SESSIONS, OPENAI_TTS_MAX_INPUT_LENGTH, PAID_USER_LIMITS_CONFIG, DEFAULT_FLUX_KONTEX_SETTINGS, DEFAULT_FLUX_DEV_SETTINGS, FLUX_DEV_IMAGE_SIZES, DEFAULT_KLING_AI_SETTINGS, KLING_AI_DURATIONS, KLING_AI_ASPECT_RATIOS, TRADING_PRO_PAIRS, DEFAULT_TRADING_PRO_SETTINGS, DEFAULT_MODEL_SETTINGS, MAX_TTS_FILE_UPLOAD_SIZE_BYTES, MAX_TRANSLATION_MP3_UPLOAD_SIZE_BYTES, MAX_TRANSLATION_TXT_UPLOAD_SIZE_BYTES } from '../constants.ts';
import { MessageBubble } from './MessageBubble.tsx';
import SettingsPanel from './SettingsPanel.tsx';
import HistoryPanel from './HistoryPanel.tsx';
import ImageModal from './ImageModal.tsx';
import TradingProView from './TradingProView.tsx';
import ErrorBoundary from './ErrorBoundary.tsx';
import { useNotification } from '../contexts/NotificationContext.tsx';
import { sendGeminiMessageStream, generateImageWithImagen } from '../services/geminiService.ts';
import { sendOpenAIMessageStream } from '../services/openaiService.ts';
import { sendDeepseekMessageStream } from '../services/deepseekService.ts';
import { sendMockMessageStream } from '../services/mockApiService.ts';
import { generateOpenAITTS, ProxiedOpenAITtsParams, transcribeOpenAIAudio } from "../services/openaiTTSService.ts";
import { editImageWithFluxKontexProxy, generateImageWithFluxDevProxy, checkFalQueueStatusProxy, generateVideoWithKlingProxy } from '../services/falService.ts';
import { PaperAirplaneIcon, CogIcon, XMarkIcon, PromptIcon, Bars3Icon, ChatBubbleLeftRightIcon, ClockIcon as HistoryIcon, MicrophoneIcon, StopCircleIcon, SpeakerWaveIcon, MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon, LanguageIcon, KeyIcon, ChevronDownIcon, ArrowDownTrayIcon, PencilIcon as EditIcon, PhotoIcon, ArrowUpTrayIcon, DocumentTextIcon, FilmIcon, PresentationChartLineIcon } from './Icons.tsx';
import { ThemeContext } from '../App.tsx';

// Corrected getSpecificDefaultSettings
const getSpecificDefaultSettings = <K extends Model>(modelKey: K): ModelSpecificSettingsMap[K] => {
  // ALL_MODEL_DEFAULT_SETTINGS is typed as ModelSpecificSettingsMap,
  // which guarantees that an entry exists for every Model key and is correctly typed.
  const settings = ALL_MODEL_DEFAULT_SETTINGS[modelKey];
  if (!settings && process.env.NODE_ENV !== 'production') {
    console.error(
        `[ChatPage] CRITICAL RUNTIME WARNING: Default settings for model "${modelKey}" are unexpectedly missing from ALL_MODEL_DEFAULT_SETTINGS. ` +
        `This indicates a mismatch between the Model enum and the ALL_MODEL_DEFAULT_SETTINGS constant. ` +
        `The application may behave unpredictably for this model. Please check constants.ts.`
    );
    // This path should ideally not be hit if constants are correct.
    // Returning a cast empty object to satisfy TS in a dev-time broken state,
    // but this is not a proper fix for missing constants.
    return {} as ModelSpecificSettingsMap[K];
  }
  return settings as ModelSpecificSettingsMap[K];
};

// Updated mergeSettings to work with ModelSpecificSettingsMap
const mergeSettings = (target: ModelSpecificSettingsMap, source: Partial<AllModelSettings>): ModelSpecificSettingsMap => {
  const output = { ...target }; // output is ModelSpecificSettingsMap
  for (const keyString in source) {
    if (Object.prototype.hasOwnProperty.call(source, keyString)) {
      const modelKey = keyString as Model;
      if (Object.values(Model).includes(modelKey)) {
        const sourceSettingsPartialForModel = source[modelKey];
        if (sourceSettingsPartialForModel) {
          // target[modelKey] is guaranteed to exist because target is ModelSpecificSettingsMap
          const baseSettingsForModel: ModelSpecificSettingsMap[typeof modelKey] = target[modelKey];

          output[modelKey] = {
            ...(baseSettingsForModel as any), // Cast to any for spread compatibility
            ...(sourceSettingsPartialForModel as any),
          } as ModelSpecificSettingsMap[typeof modelKey];
        }
      }
    }
  }
  return output; // Returns ModelSpecificSettingsMap
};


const TEXT_READABLE_EXTENSIONS = [
  '.txt', '.md', '.json', '.js', '.ts', '.jsx', '.tsx',
  '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rs',
  '.rb', '.php', '.html', '.htm', '.css', '.scss', '.less',
  '.xml', '.yaml', '.yml', '.ini', '.sh', '.bat', '.ps1',
  '.sql', '.csv', '.log'
];

type SidebarTab = 'settings' | 'history';

declare global {
  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }

  interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
  }

  type SpeechRecognitionErrorCode =
    | "no-speech"
    | "aborted"
    | "audio-capture"
    | "network"
    | "not-allowed"
    | "service-not-allowed"
    | "bad-grammar"
    | "language-not-supported";

  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: SpeechRecognitionErrorCode;
    readonly message: string;
  }

  interface SpeechGrammar {
    src: string;
    weight: number;
  }

  interface SpeechGrammarList {
    readonly length: number;
    addFromString(string: string, weight?: number): void;
    addFromURI(src: string, weight?: number): void;
    item(index: number): SpeechGrammar;
    [index: number]: SpeechGrammar;
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    grammars: SpeechGrammarList;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;

    onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
    onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onspeechstart: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;

    abort(): void;
    start(): void;
    stop(): void;
  }

  var SpeechRecognition: {
    prototype: SpeechRecognition;
    new(): SpeechRecognition;
  };

  var SpeechGrammarList: {
    prototype: SpeechGrammarList;
    new(): SpeechGrammarList;
  };

  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
    SpeechGrammarList: typeof SpeechGrammarList;
    webkitSpeechGrammarList: typeof SpeechGrammarList;
  }
}


interface SearchResult {
  messageId: string;
}

interface ChatPageProps {
  chatBackgroundUrl: string | null;
  userProfile: UserGlobalProfile;
  userSession: UserSessionState;
  onUpdateDemoLimits: (updatedLimits: Partial<DemoUserLimits | PaidUserLimits>) => void;
}

async function safeResponseJson(response: Response): Promise<any> {
  const text = await response.text();
  try {
    if (!text) {
      return { error: `Empty response from server. Status: ${response.status} ${response.statusText}` };
    }
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse JSON response. Raw text (first 500 chars):", text.substring(0, 500));
    return {
      error: `Failed to parse JSON from server. Status: ${response.status} ${response.statusText}. Response (partial): ${text.substring(0,100)}...`
    };
  }
}

const VALID_FLUX_KONTEX_ASPECT_RATIOS: FluxKontexAspectRatio[] = ['default', '1:1', '16:9', '9:16', '4:3', '3:2', '2:3', '3:4', '9:21', '21:9'];
const getIsFluxKontexModel = (model: Model | null): boolean => {
  if (!model) return false;
  return model === Model.FLUX_KONTEX || model === Model.FLUX_KONTEX_MAX_MULTI;
};
const getIsFluxDevModel = (model: Model | null): boolean => {
    if (!model) return false;
    return model === Model.FLUX_ULTRA;
};
const getIsKlingVideoModel = (model: Model | null): boolean => {
    if (!model) return false;
    return model === Model.KLING_VIDEO;
};
const getIsTradingProModel = (model: Model | null): boolean => {
    if (!model) return false;
    return model === Model.TRADING_PRO;
}

const TRANSLATION_REQUEST_COOLDOWN_MS = 1000;

const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const DEFAULT_TRADING_PRO_VIEW_STATE: Omit<TradingProState, 'disclaimerAgreed' | 'selectedPair'> = {
    chartImageUrl: null,
    isLoadingAnalysis: false,
    analysisText: null,
    trendPredictions: null,
    analysisError: null,
    groundingSources: undefined,
    uploadedImageValidationError: null,
};


const ChatPage: React.FC<ChatPageProps> = ({ chatBackgroundUrl, userProfile, userSession, onUpdateDemoLimits }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<Model>(Model.GEMINI);
  const { addNotification } = useNotification();
  const themeContext = useContext(ThemeContext);

  const [personas, setPersonas] = useState<Persona[]>(() => {
    try {
      const storedPersonas = localStorage.getItem(LOCAL_STORAGE_PERSONAS_KEY);
      return storedPersonas ? JSON.parse(storedPersonas) : [];
    } catch (error: any) {
      console.error("Error loading personas from localStorage:", error);
      return [];
    }
  });
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);

  // Changed allSettings state type to ModelSpecificSettingsMap
  const [allSettings, setAllSettings] = useState<ModelSpecificSettingsMap>(() => {
    try {
      const storedSettings = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
      // Initialize completeDefaults as ModelSpecificSettingsMap using a deep copy of ALL_MODEL_DEFAULT_SETTINGS
      const deepClone = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));
      const completeDefaults: ModelSpecificSettingsMap = deepClone(ALL_MODEL_DEFAULT_SETTINGS);

      if (storedSettings) {
        const parsedSettings = JSON.parse(storedSettings) as Partial<AllModelSettings>; // Stored settings can be partial
        
        // Sanitization logic for Flux Kontext
        const fluxModelsToSanitize: Model[] = [Model.FLUX_KONTEX, Model.FLUX_KONTEX_MAX_MULTI];
        fluxModelsToSanitize.forEach(fluxModelKey => {
            const modelSpecSettings = parsedSettings[fluxModelKey];
            if (modelSpecSettings && 'aspect_ratio' in modelSpecSettings) {
                const fluxKontextSpecific = modelSpecSettings as Partial<FluxKontexSettings>;
                if (fluxKontextSpecific.aspect_ratio && !VALID_FLUX_KONTEX_ASPECT_RATIOS.includes(fluxKontextSpecific.aspect_ratio as FluxKontexAspectRatio)) {
                    console.warn(`[ChatPage Init] Invalid aspect_ratio "${fluxKontextSpecific.aspect_ratio}" found in localStorage for ${fluxModelKey}. Resetting to default "${DEFAULT_FLUX_KONTEX_SETTINGS.aspect_ratio}".`);
                    fluxKontextSpecific.aspect_ratio = DEFAULT_FLUX_KONTEX_SETTINGS.aspect_ratio;
                }
            }
        });
        
        // Sanitization logic for Flux Dev (FLUX_ULTRA)
        const fluxDevModelSpecSettings = parsedSettings[Model.FLUX_ULTRA];
        if (fluxDevModelSpecSettings) {
            const fluxDevSettings = fluxDevModelSpecSettings as Partial<FluxDevSettings & { aspect_ratio: any }>;
            
            // Remove old `aspect_ratio` if it exists
            if ('aspect_ratio' in fluxDevSettings) {
                console.warn(`[ChatPage Init] Old 'aspect_ratio' found for Flux Dev, removing. Value was: ${fluxDevSettings.aspect_ratio}`);
                delete fluxDevSettings.aspect_ratio;
            }

            // Validate or set default for new `image_size`
            const validImageSizes = FLUX_DEV_IMAGE_SIZES.map(opt => opt.value);
            if ('image_size' in fluxDevSettings && fluxDevSettings.image_size) {
                if (!validImageSizes.includes(fluxDevSettings.image_size as FluxDevImageSize)) {
                    console.warn(`[ChatPage Init] Invalid image_size "${fluxDevSettings.image_size}" found for Flux Dev. Resetting to default "${DEFAULT_FLUX_DEV_SETTINGS.image_size}".`);
                    fluxDevSettings.image_size = DEFAULT_FLUX_DEV_SETTINGS.image_size;
                }
            } else {
                // If image_size is not present, set it to default.
                fluxDevSettings.image_size = DEFAULT_FLUX_DEV_SETTINGS.image_size;
            }
        }
        return mergeSettings(completeDefaults, parsedSettings);
      }
      return completeDefaults;
    } catch (error: any) {
      console.error("Error loading settings from localStorage:", error);
      // Fallback to a deep copy of defaults
      return JSON.parse(JSON.stringify(ALL_MODEL_DEFAULT_SETTINGS)) as ModelSpecificSettingsMap;
    }
  });

  const currentModelSettings: AnyModelSettings = useMemo(() => {
    const selectedModelKey: Model = selectedModel;

    // Updated getTypedSettings to reflect allSettings as ModelSpecificSettingsMap
    const getTypedSettings = <K extends Model>(modelKey: K): ModelSpecificSettingsMap[K] => {
        // allSettings is now ModelSpecificSettingsMap, so allSettings[modelKey] is guaranteed.
        return allSettings[modelKey];
    };

    let baseModelSettings: AnyModelSettings;

    switch (selectedModelKey) {
        case Model.GEMINI: baseModelSettings = getTypedSettings(Model.GEMINI); break;
        case Model.GEMINI_ADVANCED: baseModelSettings = getTypedSettings(Model.GEMINI_ADVANCED); break;
        case Model.GPT4O: baseModelSettings = getTypedSettings(Model.GPT4O); break;
        case Model.GPT4O_MINI: baseModelSettings = getTypedSettings(Model.GPT4O_MINI); break;
        case Model.DEEPSEEK: baseModelSettings = getTypedSettings(Model.DEEPSEEK); break;
        case Model.CLAUDE: baseModelSettings = getTypedSettings(Model.CLAUDE); break;
        case Model.IMAGEN3: baseModelSettings = getTypedSettings(Model.IMAGEN3); break;
        case Model.OPENAI_TTS: baseModelSettings = getTypedSettings(Model.OPENAI_TTS); break;
        case Model.REAL_TIME_TRANSLATION: baseModelSettings = getTypedSettings(Model.REAL_TIME_TRANSLATION); break;
        case Model.AI_AGENT_SMART: baseModelSettings = getTypedSettings(Model.AI_AGENT_SMART); break;
        case Model.PRIVATE: baseModelSettings = getTypedSettings(Model.PRIVATE); break;
        case Model.FLUX_KONTEX: baseModelSettings = getTypedSettings(Model.FLUX_KONTEX); break;
        case Model.FLUX_KONTEX_MAX_MULTI: baseModelSettings = getTypedSettings(Model.FLUX_KONTEX_MAX_MULTI); break;
        case Model.FLUX_ULTRA: baseModelSettings = getTypedSettings(Model.FLUX_ULTRA); break;
        case Model.KLING_VIDEO: baseModelSettings = getTypedSettings(Model.KLING_VIDEO); break;
        case Model.TRADING_PRO: baseModelSettings = getTypedSettings(Model.TRADING_PRO); break;
        default:
            const _exhaustiveCheck: never = selectedModelKey;
            console.error(`[ChatPage] currentModelSettings useMemo: Unhandled model ${selectedModelKey}.`);
            baseModelSettings = getSpecificDefaultSettings(Model.GEMINI); 
    }

    let mutableSettingsCopy = { ...baseModelSettings };

    const aboutMeText = userProfile?.aboutMe?.trim();
    const activePersona = activePersonaId ? personas.find(p => p.id === activePersonaId) : null;

    if ('systemInstruction' in mutableSettingsCopy && (
        selectedModelKey === Model.GEMINI || selectedModelKey === Model.GEMINI_ADVANCED ||
        selectedModelKey === Model.GPT4O || selectedModelKey === Model.GPT4O_MINI ||
        selectedModelKey === Model.DEEPSEEK || selectedModelKey === Model.CLAUDE ||
        selectedModelKey === Model.AI_AGENT_SMART || selectedModelKey === Model.PRIVATE
    )) {
        let finalSystemInstruction = mutableSettingsCopy.systemInstruction;
        if (activePersona) {
            finalSystemInstruction = activePersona.instruction;
            if (aboutMeText) {
                finalSystemInstruction = `Background information about the user you are interacting with: "${aboutMeText}".\n\nYour current persona/task based on user's selection: "${activePersona.instruction}"`;
            }
        } else if (aboutMeText) {
            finalSystemInstruction = `Background information about the user you are interacting with: "${aboutMeText}".\n\nYour task: "${mutableSettingsCopy.systemInstruction}"`;
        }
        (mutableSettingsCopy as ModelSettings | AiAgentSmartSettings | PrivateModeSettings).systemInstruction = finalSystemInstruction;
    }

    return mutableSettingsCopy as AnyModelSettings;

  }, [allSettings, selectedModel, activePersonaId, personas, userProfile]);


  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploadedTextFileContent, setUploadedTextFileContent] = useState<string | null>(null);
  const [uploadedTextFileName, setUploadedTextFileName] = useState<string | null>(null);
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('settings');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);
  const prevSelectedModelRef = useRef<Model | null>(null);

  const isImagenModelSelected = selectedModel === Model.IMAGEN3;
  const isTextToSpeechModelSelected = selectedModel === Model.OPENAI_TTS;
  const isRealTimeTranslationMode = selectedModel === Model.REAL_TIME_TRANSLATION;
  const isAiAgentSmartMode = selectedModel === Model.AI_AGENT_SMART;
  const isPrivateModeSelected = selectedModel === Model.PRIVATE;
  const isClaudeModelSelected = selectedModel === Model.CLAUDE;
  const isAdminUser = !userSession.isDemoUser && !userSession.isPaidUser;

  const [tradingProState, setTradingProState] = useState<TradingProState>({
    disclaimerAgreed: false,
    chartImageUrl: null, // User-uploaded image for Trading Pro
    isLoadingAnalysis: false,
    analysisText: null,
    trendPredictions: null,
    analysisError: null,
    groundingSources: undefined,
    selectedPair: (allSettings[Model.TRADING_PRO] as TradingProSettings | undefined)?.selectedPair || null,
    uploadedImageValidationError: null,
  });


  const pruneChatSessions = useCallback((sessions: ChatSession[], maxSessions: number): { prunedSessions: ChatSession[], numPruned: number } => {
    if (sessions.length <= maxSessions) {
      return { prunedSessions: sessions, numPruned: 0 };
    }

    const originalLength = sessions.length;
    const pinned = sessions.filter(s => s.isPinned).sort((a, b) => b.timestamp - a.timestamp);
    const unpinned = sessions.filter(s => !s.isPinned).sort((a, b) => b.timestamp - a.timestamp);
    let finalSessions: ChatSession[];

    if (pinned.length >= maxSessions) {
      finalSessions = pinned.slice(0, maxSessions);
    } else {
      const numUnpinnedToKeep = maxSessions - pinned.length;
      const keptUnpinned = unpinned.slice(0, numUnpinnedToKeep);
      finalSessions = [...pinned, ...keptUnpinned];
    }

    finalSessions.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.timestamp - a.timestamp;
    });

    const numPruned = originalLength - finalSessions.length;
    return { prunedSessions: finalSessions, numPruned };
  }, []);


  const [savedSessions, setSavedSessions] = useState<ChatSession[]>(() => {
    try {
      const storedHistory = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
      if (storedHistory) {
        let sessions: ChatSession[] = JSON.parse(storedHistory);
        const { prunedSessions: initiallyPrunedSessions, numPruned } = pruneChatSessions(sessions, MAX_SAVED_CHAT_SESSIONS);
        if (numPruned > 0) {
          console.warn(`[ChatPage Init] Pruned ${numPruned} session(s) on load to meet storage limit.`);
        }
        return initiallyPrunedSessions;
      }
    } catch (error: any) {
      console.error("Error loading/pruning chat history from localStorage during init:", error);
    }
    return [];
  });

  useEffect(() => {
    const checkInitialPruning = () => {
        try {
            const storedHistory = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
            if (storedHistory) {
                const sessionsInStorage: ChatSession[] = JSON.parse(storedHistory);
                const numThatWouldBePruned = sessionsInStorage.length - pruneChatSessions(sessionsInStorage, MAX_SAVED_CHAT_SESSIONS).prunedSessions.length;
                if (numThatWouldBePruned > 0) {
                     addNotification(
                        `Chat history was extensive. ${numThatWouldBePruned} older unpinned chat(s) were not loaded to manage storage. Review saved chats.`,
                        "info"
                    );
                }
            }
        } catch (e) {
            console.error("Error checking initial pruning state:", e);
        }
    };
    checkInitialPruning();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentChatName, setCurrentChatName] = useState<string>("New Chat");

  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [modalPrompt, setModalPrompt] = useState<string>('');
  const [modalMimeType, setModalMimeType] = useState<'image/jpeg' | 'image/png'>('image/jpeg');

  const [isListening, setIsListening] = useState(false);
  const [isSpeechRecognitionSupported, setIsSpeechRecognitionSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const inputBeforeSpeechRef = useRef<string>("");
  const currentRecognizedTextSegmentRef = useRef<string>("");

  const liveTranscriptionRef = useRef<string>("");
  const currentInterimVisualRef = useRef<string>("");
  const interimTranslationBufferRef = useRef<string>("");
  const translationDebounceTimerRef = useRef<number | null>(null);
  const DEBOUNCE_TRANSLATION_MS = 750;

  const [liveTranscriptionDisplay, setLiveTranscriptionDisplay] = useState<string>("");
  const liveTranslationAccumulatorRef = useRef<string>("");
  const [liveTranslationDisplay, setLiveTranslationDisplay] = useState<string>("");
  const currentTranslationStreamControllerRef = useRef<AbortController | null>(null);
  const [isSpeakingLiveTranslation, setIsSpeakingLiveTranslation] = useState(false);
  const [liveTranslationAudioUrl, setLiveTranslationAudioUrl] = useState<string | null>(null);

  const lastSuccessfullyTranslatedTextRef = useRef<string|null>(null);
  const lastSuccessfullyTranslatedTimestampRef = useRef<number>(0);


  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [currentPlayingMessageId, setCurrentPlayingMessageId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [tempSearchQuery, setTempSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentSearchResultIndex, setCurrentSearchResultIndex] = useState(-1);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [isGpt41AccessModalOpen, setIsGpt41AccessModalOpen] = useState(false);
  const [gpt41AccessCodeInput, setGpt41AccessCodeInput] = useState('');
  const [isGpt41Unlocked, setIsGpt41Unlocked] = useState(false);
  const gpt41ModalInteractionFlagRef = useRef(false);
  const previousModelBeforeGpt41ModalRef = useRef<Model | null>(null);

  // State for Trading Pro Demo Access Modal
  const [isTradingProCodeModalOpen, setIsTradingProCodeModalOpen] = useState(false);
  const [tradingProAccessCodeInput, setTradingProAccessCodeInput] = useState('');
  const [tradingProCodeError, setTradingProCodeError] = useState<string | null>(null);
  const [demoTradingProAccessGranted, setDemoTradingProAccessGranted] = useState(false);
  const [modelBeforeTradingProModal, setModelBeforeTradingProModal] = useState<Model | null>(null);
  const [isTradingProCodeLoading, setIsTradingProCodeLoading] = useState(false);
  const [pendingSessionLoadForTradingPro, setPendingSessionLoadForTradingPro] = useState<ChatSession | null>(null);
  const prevDemoUserTokenRef = useRef<string | null | undefined>(userSession.demoUserToken);


  const clearSearch = useCallback(() => {
    setIsSearchActive(false);
    setSearchQuery('');
    setTempSearchQuery('');
    setSearchResults([]);
    setCurrentSearchResultIndex(-1);
  }, []);


  const apiKeyStatuses = useMemo((): Record<Model, ApiKeyStatus> => {
    // Use the imported definitions directly
    return API_KEY_STATUSES_DEFINITIONS;
  }, []);

  const displayedChatTitle = useMemo(() => {
    if (!activeSessionId) {
      switch (selectedModel) {
        case Model.FLUX_KONTEX:
          return "Flux Kontext Editor";
        case Model.FLUX_KONTEX_MAX_MULTI:
          return "Flux Kontext Max Editor";
        case Model.FLUX_ULTRA:
          return "Flux Dev Generator";
        case Model.KLING_VIDEO:
          return "Kling AI Video Generator";
        case Model.PRIVATE:
          return "Private Mode";
        case Model.AI_AGENT_SMART:
          return "AI Agent Smart";
        case Model.REAL_TIME_TRANSLATION:
          return "Real-Time Translation";
        case Model.TRADING_PRO:
          return "Trading Pro Analysis";
        default:
          return currentChatName;
      }
    }
    return currentChatName;
  }, [activeSessionId, selectedModel, currentChatName]);


  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(allSettings));
    } catch (error: any) {
      console.error("Error saving settings to localStorage:", error);
      addNotification("Failed to save app settings.", "error", error.message);
    }
  }, [allSettings, addNotification]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(savedSessions));
    } catch (error: any) {
      console.error("Error saving chat history to localStorage:", error);
      if (error.name === 'QuotaExceededError') {
        addNotification("Failed to save chat history: Storage quota exceeded. Please delete some older or unpinned chats.", "error", "Try removing unpinned chats or chats with large content like images.");
      } else {
        addNotification("Failed to save chat history.", "error", error.message);
      }
    }
  }, [savedSessions, addNotification]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_PERSONAS_KEY, JSON.stringify(personas));
    } catch (error: any) {
      console.error("Error saving personas to localStorage:", error);
      addNotification("Failed to save personas.", "error", error.message);
    }
  }, [personas, addNotification]);

  useEffect(() => {
    const chatDiv = chatContainerRef.current;
    if (chatDiv && !isSearchActive && !isRealTimeTranslationMode && messages.length > 0 && !getIsTradingProModel(selectedModel)) {
        const lastMessage = messages[messages.length - 1];
        const isUserMessage = lastMessage.sender === 'user';

        const nearBottomThreshold = chatDiv.clientHeight * 0.3;
        const isNearBottom = (chatDiv.scrollHeight - chatDiv.scrollTop - chatDiv.clientHeight) < nearBottomThreshold;

        if (isUserMessage || isNearBottom) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }
  }, [messages, isSearchActive, isRealTimeTranslationMode, selectedModel]);

  // Effect to reset demoTradingProAccessGranted if demo user changes or user is no longer demo
  useEffect(() => {
    if (!userSession.isDemoUser || (prevDemoUserTokenRef.current && prevDemoUserTokenRef.current !== userSession.demoUserToken)) {
      setDemoTradingProAccessGranted(false);
    }
    prevDemoUserTokenRef.current = userSession.demoUserToken;
  }, [userSession.isDemoUser, userSession.demoUserToken]);


  useEffect(() => {
    const currentModelStatus = apiKeyStatuses[selectedModel];
    const newModel = selectedModel;
    const oldModel = prevSelectedModelRef.current;

    // Handle Web Search Toggle based on model compatibility
    if (isWebSearchEnabled && (
        !currentModelStatus?.isGeminiPlatform ||
        currentModelStatus?.isImageGeneration ||
        currentModelStatus?.isTextToSpeech ||
        currentModelStatus?.isRealTimeTranslation ||
        currentModelStatus?.isPrivateMode ||
        currentModelStatus?.isImageEditing ||
        currentModelStatus?.isMultiImageEditing ||
        currentModelStatus?.isFluxDevImageGeneration ||
        getIsKlingVideoModel(selectedModel) ||
        getIsTradingProModel(selectedModel)
    )) {
        setIsWebSearchEnabled(false);
    }

    // Handle Image/File Clearing and other side effects on model *change*
    if (newModel !== oldModel) {
        let shouldClearGeneralAttachments = false;
        let shouldClearTextFileAttachmentsOnly = false;

        // Condition 1: Switching TO a model that doesn't use general attachments from the main chat bar.
        if (
            newModel === Model.IMAGEN3 ||
            newModel === Model.OPENAI_TTS ||
            newModel === Model.REAL_TIME_TRANSLATION ||
            newModel === Model.CLAUDE || // Assuming current mock Claude doesn't use attachments
            newModel === Model.FLUX_ULTRA // Flux Dev generates, doesn't take image input here
        ) {
            shouldClearGeneralAttachments = true;
        }
        // Condition 2: Switching FROM a model with specific attachments TO a DIFFERENT model.
        // This means if you had an image for Kling, and switch to Gemini, the image should clear.
        // But if you switch from Gemini with an image TO Kling, the image should persist.
        else if (oldModel && newModel !== oldModel) {
            if (
                (getIsKlingVideoModel(oldModel) && !getIsKlingVideoModel(newModel)) ||
                (getIsTradingProModel(oldModel) && !getIsTradingProModel(newModel)) ||
                (getIsFluxKontexModel(oldModel) && !getIsFluxKontexModel(newModel))
            ) {
                 shouldClearGeneralAttachments = true;
            }
        }

        // Condition 3: Switching between Flux Kontext types.
        if (oldModel && newModel &&
            ((newModel === Model.FLUX_KONTEX && oldModel === Model.FLUX_KONTEX_MAX_MULTI) ||
             (newModel === Model.FLUX_KONTEX_MAX_MULTI && oldModel === Model.FLUX_KONTEX))
        ) {
            shouldClearGeneralAttachments = true;
        }

        // Condition 4: Switching TO AI Agent Smart (only supports images).
        if (newModel === Model.AI_AGENT_SMART && !shouldClearGeneralAttachments) {
            shouldClearTextFileAttachmentsOnly = true;
        }


        if (shouldClearGeneralAttachments) {
            if (uploadedImages.length > 0 || imagePreviews.length > 0) {
                setUploadedImages([]);
                setImagePreviews([]);
                addNotification("Cleared previous image attachments for the new model or mode.", "info");
            }
            if (uploadedTextFileContent || uploadedTextFileName) {
                 setUploadedTextFileContent(null);
                 setUploadedTextFileName(null);
                 addNotification("Cleared previous file attachment for the new model or mode.", "info");
            }
            if (tradingProState.chartImageUrl) {
                setTradingProState(prev => ({ ...prev, chartImageUrl: null, uploadedImageValidationError: null}));
            }
        } else if (shouldClearTextFileAttachmentsOnly) {
             if (uploadedTextFileContent || uploadedTextFileName) {
                 setUploadedTextFileContent(null);
                 setUploadedTextFileName(null);
                 addNotification("Cleared previous file attachment as this model only supports images.", "info");
            }
        }


        // Clear personas if new model doesn't support them
        if (isImagenModelSelected || isTextToSpeechModelSelected || isRealTimeTranslationMode || isPrivateModeSelected || getIsFluxKontexModel(newModel) || isClaudeModelSelected || getIsFluxDevModel(newModel) || getIsKlingVideoModel(newModel) || getIsTradingProModel(newModel) || isAiAgentSmartMode) {
          if (activePersonaId) {
            setActivePersonaId(null);
          }
        }

        // Microphone stopping logic
        if (isListening && recognitionRef.current) {
            const micIncompatibleForCurrentModel =
                (isImagenModelSelected || isTextToSpeechModelSelected || isClaudeModelSelected || getIsFluxDevModel(newModel) || getIsKlingVideoModel(newModel) || getIsTradingProModel(newModel)) && !isRealTimeTranslationMode;
            const stopForGptModal = newModel === Model.GPT4O && isGpt41AccessModalOpen;

            if (micIncompatibleForCurrentModel || stopForGptModal) {
                recognitionRef.current.stop();
            }
        }

        // Stop audio playback
        if (currentPlayingMessageId && audioPlayerRef.current) {
            audioPlayerRef.current.pause();
            setCurrentPlayingMessageId(null);
        }

        // Handle Real-Time Translation mode specific resets
        if (newModel === Model.REAL_TIME_TRANSLATION) {
            setInput('');
        } else {
            setLiveTranscriptionDisplay("");
            setLiveTranslationDisplay("");
            liveTranscriptionRef.current = "";
            currentInterimVisualRef.current = "";
            interimTranslationBufferRef.current = "";
            liveTranslationAccumulatorRef.current = "";
            lastSuccessfullyTranslatedTextRef.current = null;
            lastSuccessfullyTranslatedTimestampRef.current = 0;
            currentTranslationStreamControllerRef.current?.abort();
            if (audioPlayerRef.current && isSpeakingLiveTranslation) {
                audioPlayerRef.current.pause();
                setIsSpeakingLiveTranslation(false);
                setLiveTranslationAudioUrl(null);
            }
        }

        // GPT-4.1 Modal logic
        if (newModel === Model.GPT4O) {
          if (!isGpt41Unlocked && !gpt41ModalInteractionFlagRef.current) {
            previousModelBeforeGpt41ModalRef.current = newModel;
            setIsGpt41AccessModalOpen(true);
            gpt41ModalInteractionFlagRef.current = true;
          }
        } else {
          gpt41ModalInteractionFlagRef.current = false;
          if (isGpt41AccessModalOpen) setIsGpt41AccessModalOpen(false);
        }

        // Reset Trading Pro state if switching away from it or to it with different pair
        if (oldModel === Model.TRADING_PRO && newModel !== Model.TRADING_PRO) {
            setTradingProState(prev => ({
                ...DEFAULT_TRADING_PRO_VIEW_STATE,
                disclaimerAgreed: prev.disclaimerAgreed,
                selectedPair: (allSettings[Model.TRADING_PRO] as TradingProSettings | undefined)?.selectedPair || null,
            }));
        } else if (newModel === Model.TRADING_PRO && oldModel !== Model.TRADING_PRO) {
            setTradingProState(prev => ({
                ...DEFAULT_TRADING_PRO_VIEW_STATE,
                disclaimerAgreed: prev.disclaimerAgreed,
                selectedPair: (allSettings[Model.TRADING_PRO] as TradingProSettings | undefined)?.selectedPair || null,
            }));
        }
        clearSearch();
    }
    prevSelectedModelRef.current = selectedModel;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel, addNotification, clearSearch, isGpt41Unlocked, isListening, isSpeakingLiveTranslation, allSettings, uploadedImages, imagePreviews, uploadedTextFileContent, uploadedTextFileName, tradingProState.chartImageUrl]); // Added dependencies


  const translateLiveSegment = useCallback(async (text: string, targetLangCode: string) => {
      const trimmedText = text.trim();
      if (!trimmedText || !targetLangCode) return;

      if (trimmedText === lastSuccessfullyTranslatedTextRef.current &&
          (Date.now() - lastSuccessfullyTranslatedTimestampRef.current < TRANSLATION_REQUEST_COOLDOWN_MS)) {
          console.log(`[translateLiveSegment] Cooldown: Skipping identical translation request for "${trimmedText}".`);
          const targetLangNameForCache = TRANSLATION_TARGET_LANGUAGES.find(l => l.code === targetLangCode)?.name || targetLangCode;
          const cacheMessage = `[${targetLangNameForCache}]: ${trimmedText} (from cache)\n`;
          setLiveTranslationDisplay(prev => {
            const placeholderRegex = new RegExp(escapeRegExp(`Translating to .*?: "${trimmedText.substring(0, 20)}.*? \\[ID: translate-.*?\\n`), 's');
            if (prev.match(placeholderRegex)) {
                return prev.replace(placeholderRegex, cacheMessage);
            }
            return liveTranslationAccumulatorRef.current;
          });
          return;
      }

      lastSuccessfullyTranslatedTextRef.current = trimmedText;
      lastSuccessfullyTranslatedTimestampRef.current = Date.now();

      const targetLangName = TRANSLATION_TARGET_LANGUAGES.find(l => l.code === targetLangCode)?.name || targetLangCode;
      const translationPlaceholderId = `translate-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const translationPlaceholder = `Translating to ${targetLangName}: "${trimmedText.substring(0, 20)}..." [ID: ${translationPlaceholderId}]\n`;

      setLiveTranslationDisplay(prev => prev + translationPlaceholder);

      currentTranslationStreamControllerRef.current?.abort();
      currentTranslationStreamControllerRef.current = new AbortController();
      const signal = currentTranslationStreamControllerRef.current.signal;

      try {
          const prompt = `Translate the following text to ${targetLangName}. Output only the translated text directly, without any introductory phrases or explanations: "${trimmedText}"`;
          const history: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
          const geminiModelId = getActualModelIdentifier(Model.GEMINI);

          const stream = sendGeminiMessageStream({
              historyContents: history,
              modelSettings: { temperature: 0.3, topK: 1, topP: 1, systemInstruction: "You are a direct text translator." } as ModelSettings,
              enableGoogleSearch: false,
              modelName: geminiModelId,
              userSession: userSession,
              signal: signal,
          });

          let segmentTranslation = "";
          for await (const chunk of stream) {
              if (signal.aborted) {
                  console.log("Translation stream aborted for segment:", trimmedText);
                  setLiveTranslationDisplay(prev => prev.replace(translationPlaceholder, `[Translation cancelled for "${trimmedText.substring(0,20)}..."]\n`));
                  return;
              }
              if (chunk.error) {
                if (chunk.error === 'Request aborted by client.') {
                    console.log('Translation explicitly aborted by client for segment:', trimmedText);
                    setLiveTranslationDisplay(prev => prev.replace(translationPlaceholder, `[Translation aborted for "${trimmedText.substring(0,20)}..."]\n`));
                    return;
                }
                throw new Error(chunk.error);
              }
              if (chunk.textDelta) {
                  segmentTranslation += chunk.textDelta;
                  setLiveTranslationDisplay(prev => prev.replace(translationPlaceholder, `[${targetLangName}]: ${segmentTranslation}\n`));
              }
          }
          const finalTranslatedSegment = `[${targetLangName}]: ${segmentTranslation.trim()}\n`;
          if (!liveTranslationAccumulatorRef.current.endsWith(finalTranslatedSegment)) {
              liveTranslationAccumulatorRef.current += finalTranslatedSegment;
          }
          setLiveTranslationDisplay(liveTranslationAccumulatorRef.current);

      } catch (error: any) {
          if (error.name === 'AbortError' || error.message === 'Request aborted by client.') {
            console.log('Previous translation fetch was aborted.');
          } else {
            console.error("Error translating segment:", error);
            addNotification(`Translation error: ${error.message}`, "error");
            liveTranslationAccumulatorRef.current += `[Error translating: ${error.message}]\n`;
            setLiveTranslationDisplay(liveTranslationAccumulatorRef.current);
          }
          if (trimmedText === lastSuccessfullyTranslatedTextRef.current) {
              lastSuccessfullyTranslatedTextRef.current = null;
          }
      }
  }, [addNotification, userSession]);

  const targetLanguageForSpeechEffect = useMemo(() => {
    if (isRealTimeTranslationMode) {
      return (currentModelSettings as RealTimeTranslationSettings).targetLanguage;
    }
    return undefined;
  }, [isRealTimeTranslationMode, currentModelSettings]);

  const translateLiveSegmentForSpeechEffect = useCallback((text: string, langCode: string) => {
      if (isRealTimeTranslationMode) {
          return translateLiveSegment(text, langCode);
      }
      return Promise.resolve();
  }, [isRealTimeTranslationMode, translateLiveSegment]);


  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setIsSpeechRecognitionSupported(false);
      return;
    }

    setIsSpeechRecognitionSupported(true);
    recognitionRef.current = new SpeechRecognitionAPI() as SpeechRecognition;
    const recognition = recognitionRef.current;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = isRealTimeTranslationMode ? (navigator.language || 'en-US') : (navigator.language.startsWith('vi') ? 'vi-VN' : (navigator.language || 'en-US'));

    recognition.onstart = () => {
        setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (isRealTimeTranslationMode) {
        let newlyFinalizedTextThisEvent = "";
        let latestInterimTextThisEvent = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcriptPart = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                newlyFinalizedTextThisEvent += transcriptPart;
            } else {
                latestInterimTextThisEvent = transcriptPart;
            }
        }

        if (newlyFinalizedTextThisEvent.trim()) {
            if (translationDebounceTimerRef.current) {
                clearTimeout(translationDebounceTimerRef.current);
                translationDebounceTimerRef.current = null;
            }
            interimTranslationBufferRef.current = "";

            const textToTranslate = newlyFinalizedTextThisEvent.trim();
            liveTranscriptionRef.current += textToTranslate + "\n";
            currentInterimVisualRef.current = "";
            setLiveTranscriptionDisplay(liveTranscriptionRef.current);
            translateLiveSegmentForSpeechEffect(textToTranslate, targetLanguageForSpeechEffect || 'en');
        } else if (latestInterimTextThisEvent.trim()) {
            currentInterimVisualRef.current = latestInterimTextThisEvent;
            setLiveTranscriptionDisplay(liveTranscriptionRef.current + currentInterimVisualRef.current);

            interimTranslationBufferRef.current = latestInterimTextThisEvent.trim();
            if (translationDebounceTimerRef.current) {
                clearTimeout(translationDebounceTimerRef.current);
            }
            translationDebounceTimerRef.current = window.setTimeout(() => {
                const textToTranslateInterim = interimTranslationBufferRef.current;
                if (textToTranslateInterim && currentInterimVisualRef.current.trim() === textToTranslateInterim) {
                    translateLiveSegmentForSpeechEffect(textToTranslateInterim, targetLanguageForSpeechEffect || 'en');
                }
                translationDebounceTimerRef.current = null;
            }, DEBOUNCE_TRANSLATION_MS);
        }
      } else {
          let newFinalTranscriptThisEvent = "";
          let latestInterimForDisplay = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
              const transcriptPart = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                  newFinalTranscriptThisEvent += transcriptPart;
              } else {
                  latestInterimForDisplay = transcriptPart;
              }
          }
          currentRecognizedTextSegmentRef.current = newFinalTranscriptThisEvent.trim() +
              (newFinalTranscriptThisEvent.trim() && latestInterimForDisplay.trim() ? " " : "") +
              latestInterimForDisplay.trim();
          let displayInput = inputBeforeSpeechRef.current;
          if (displayInput.trim() && currentRecognizedTextSegmentRef.current) {
            displayInput += " ";
          }
          displayInput += currentRecognizedTextSegmentRef.current;
          setInput(displayInput);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (translationDebounceTimerRef.current) {
          clearTimeout(translationDebounceTimerRef.current);
          translationDebounceTimerRef.current = null;
      }
      if (isRealTimeTranslationMode) {
          let remainingTextToTranslate = "";
          if (currentInterimVisualRef.current.trim()) {
             remainingTextToTranslate = currentInterimVisualRef.current.trim();
          }

          if (remainingTextToTranslate) {
              const recentlyTranslatedByCooldown =
                  remainingTextToTranslate === lastSuccessfullyTranslatedTextRef.current &&
                  (Date.now() - lastSuccessfullyTranslatedTimestampRef.current < TRANSLATION_REQUEST_COOLDOWN_MS);

              if (recentlyTranslatedByCooldown) {
                  console.log("[RTT onend] Cooldown: Skipping translation for final segment:", remainingTextToTranslate);
                  const alreadyTranscribed = liveTranscriptionRef.current.trim().endsWith(remainingTextToTranslate);
                  if (!alreadyTranscribed) {
                     liveTranscriptionRef.current += remainingTextToTranslate + "\n";
                     setLiveTranscriptionDisplay(liveTranscriptionRef.current);
                  }
              } else {
                  console.log("[RTT onend] Cooldown MISS or new text. Attempting translation for final segment:", remainingTextToTranslate);
                  const alreadyTranscribed = liveTranscriptionRef.current.trim().endsWith(remainingTextToTranslate);
                  if (!alreadyTranscribed) {
                     liveTranscriptionRef.current += remainingTextToTranslate + "\n";
                     setLiveTranscriptionDisplay(liveTranscriptionRef.current);
                  }
                  translateLiveSegmentForSpeechEffect(remainingTextToTranslate, targetLanguageForSpeechEffect || 'en');
              }
          }
          interimTranslationBufferRef.current = "";
          currentInterimVisualRef.current = "";
      } else {
          let finalInputText = inputBeforeSpeechRef.current;
          if (finalInputText.trim() && currentRecognizedTextSegmentRef.current.trim()) {
            finalInputText += " ";
          }
          finalInputText += currentRecognizedTextSegmentRef.current.trim();
          setInput(finalInputText);
          currentRecognizedTextSegmentRef.current = "";
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error', event.error, event.message);
      let errorMessage = `Speech recognition error: ${event.error}.`;
      if (event.error === 'not-allowed') {
        errorMessage = "Microphone access denied. Please allow microphone access in your browser settings.";
      } else if (event.error === 'no-speech' && isListening) {
        errorMessage = "No speech detected. Please try again.";
      } else if (event.error === 'aborted' && !isListening) {
        return;
      }
      addNotification(errorMessage, "error", event.message);
      setIsListening(false);
      if (isRealTimeTranslationMode) {
        interimTranslationBufferRef.current = "";
        currentInterimVisualRef.current = "";
        if (translationDebounceTimerRef.current) {
            clearTimeout(translationDebounceTimerRef.current);
            translationDebounceTimerRef.current = null;
        }
      }
    };

    return () => {
      recognition?.abort();
      if (translationDebounceTimerRef.current) {
        clearTimeout(translationDebounceTimerRef.current);
      }
    };
  }, [addNotification, isRealTimeTranslationMode, targetLanguageForSpeechEffect, translateLiveSegmentForSpeechEffect]);


  const handleToggleListen = () => {
    if (!isSpeechRecognitionSupported || !recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      if (isRealTimeTranslationMode) {
          liveTranscriptionRef.current = "";
          currentInterimVisualRef.current = "";
          interimTranslationBufferRef.current = "";
          liveTranslationAccumulatorRef.current = "";
          lastSuccessfullyTranslatedTextRef.current = null;
          lastSuccessfullyTranslatedTimestampRef.current = 0;
          setLiveTranscriptionDisplay("");
          setLiveTranslationDisplay("");
          currentTranslationStreamControllerRef.current?.abort();
          if (translationDebounceTimerRef.current) {
              clearTimeout(translationDebounceTimerRef.current);
              translationDebounceTimerRef.current = null;
          }
          if (audioPlayerRef.current && isSpeakingLiveTranslation) {
            audioPlayerRef.current.pause();
            setIsSpeakingLiveTranslation(false);
            setLiveTranslationAudioUrl(null);
          }
      } else {
          inputBeforeSpeechRef.current = input;
          currentRecognizedTextSegmentRef.current = "";
      }

      try {
        setIsListening(true); // Set before start() to avoid race condition with onend/onerror
        recognitionRef.current.start();
      } catch (e: any) {
        console.error("Error starting speech recognition:", e);
        addNotification("Could not start voice input. Please try again.", "error", e.message);
        setIsListening(false); // Reset if start fails
      }
    }
  };

  const handleModelSettingsChange = useCallback(
    (newSettingsFromPanel: Partial<AnyModelSettings>) => {
    setAllSettings(prevAllSettings => {
        const modelKey = selectedModel;
        // prevAllSettings is ModelSpecificSettingsMap, so prevAllSettings[modelKey] is guaranteed.
        const currentModelSpecificSettings = prevAllSettings[modelKey];
        
        const relevantNewSettings: Partial<ModelSpecificSettingsMap[typeof modelKey]> = {};
        for (const key in newSettingsFromPanel) {
            if (Object.prototype.hasOwnProperty.call(newSettingsFromPanel, key) &&
                Object.prototype.hasOwnProperty.call(currentModelSpecificSettings, key)) {
                (relevantNewSettings as any)[key] = (newSettingsFromPanel as any)[key];
            }
        }

        const updatedModelSpecificSettings: ModelSpecificSettingsMap[typeof modelKey] = {
            ...(currentModelSpecificSettings as any),
            ...relevantNewSettings,
        };
        return {
            ...prevAllSettings,
            [modelKey]: updatedModelSpecificSettings
        };
    });
  }, [selectedModel]);

  const handleTradingProCodeModalClose = useCallback(() => {
    setIsTradingProCodeModalOpen(false);
    setTradingProAccessCodeInput('');
    setTradingProCodeError(null);
    // If a model switch was pending and modal is cancelled, revert to the model before the attempt
    if (modelBeforeTradingProModal && selectedModel !== modelBeforeTradingProModal) {
        setSelectedModel(modelBeforeTradingProModal);
    }
    setModelBeforeTradingProModal(null);
    setPendingSessionLoadForTradingPro(null);
  }, [selectedModel, modelBeforeTradingProModal]);

  const handleTradingProCodeModalSubmit = useCallback(async () => {
    if (!userSession.demoUserToken || !tradingProAccessCodeInput.trim()) {
        setTradingProCodeError("Please enter an access code.");
        return;
    }
    setIsTradingProCodeLoading(true);
    setTradingProCodeError(null);
    try {
        const response = await fetch('/api/auth/validate-trading-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                demoUserToken: userSession.demoUserToken,
                tradingCode: tradingProAccessCodeInput.trim()
            })
        });
        const data = await response.json();
        if (data.success) {
            setDemoTradingProAccessGranted(true);
            setIsTradingProCodeModalOpen(false);
            setTradingProAccessCodeInput('');
            addNotification("Trading Pro access granted for this session!", "success");
            setSelectedModel(Model.TRADING_PRO); // Now actually switch to Trading Pro
            if (pendingSessionLoadForTradingPro) {
                handleLoadSession(pendingSessionLoadForTradingPro.id, true); // Force load as Trading Pro
                setPendingSessionLoadForTradingPro(null);
            }
        } else {
            setTradingProCodeError(data.message || "Invalid access code.");
        }
    } catch (err: any) {
        setTradingProCodeError(`Error validating code: ${err.message || 'Network error'}`);
    }
    setIsTradingProCodeLoading(false);
  }, [userSession.demoUserToken, tradingProAccessCodeInput, addNotification, pendingSessionLoadForTradingPro]); // Added pendingSessionLoadForTradingPro dependency


  const handleModelSelection = useCallback((newModel: Model) => {
    const isAdmin = !userSession.isDemoUser && !userSession.isPaidUser;
    if (newModel === Model.FLUX_KONTEX_MAX_MULTI && !userSession.isPaidUser && !isAdmin) {
      addNotification("Flux Kontext Max is for Paid Users or Admin only.", "error");
      return;
    }
    if (newModel === Model.FLUX_ULTRA && !userSession.isPaidUser && !isAdmin) {
      addNotification("Flux Dev is for Paid Users or Admin only.", "error");
      return;
    }
    if (newModel === Model.KLING_VIDEO && !userSession.isPaidUser && !isAdmin) {
      addNotification("Kling AI Video generation is only available for Paid Users or Admin.", "error");
      return;
    }

    // Trading Pro Access Logic for Demo users
    if (newModel === Model.TRADING_PRO && userSession.isDemoUser && !demoTradingProAccessGranted) {
        setModelBeforeTradingProModal(selectedModel); // Store current model
        setIsTradingProCodeModalOpen(true);
        // Do NOT call setSelectedModel(newModel) here yet. It will be called on successful code validation.
        return; 
    }
    
    if (newModel !== Model.GPT4O) gpt41ModalInteractionFlagRef.current = false;
    setSelectedModel(newModel);
  }, [userSession.isDemoUser, userSession.isPaidUser, demoTradingProAccessGranted, selectedModel, addNotification]);


  const handlePersonaChange = (personaId: string | null) => {
    setActivePersonaId(personaId);
  };

  const handlePersonaSave = (personaToSave: Persona) => {
    setPersonas(prev => {
      const existingIndex = prev.findIndex(p => p.id === personaToSave.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex] = personaToSave;
        return updated;
      }
      return [...prev, personaToSave];
    });
    addNotification(`Persona "${personaToSave.name}" saved.`, "success");
  };

  const handlePersonaDelete = (personaId: string) => {
    const personaToDelete = personas.find(p => p.id === personaId);
    setPersonas(prev => prev.filter(p => p.id !== personaId));
    if (activePersonaId === personaId) {
      setActivePersonaId(null);
    }
    if (personaToDelete) {
      addNotification(`Persona "${personaToDelete.name}" deleted.`, "info");
    }
  };

  const handleSaveCurrentChat = useCallback(() => {
    if (isRealTimeTranslationMode || isAiAgentSmartMode || isPrivateModeSelected || getIsFluxKontexModel(selectedModel) || getIsFluxDevModel(selectedModel) || getIsKlingVideoModel(selectedModel) || getIsTradingProModel(selectedModel)) {
        addNotification(`Cannot save chat in ${getIsTradingProModel(selectedModel) ? 'Trading Pro' : (isRealTimeTranslationMode ? 'Real-Time Translation' : (isAiAgentSmartMode ? 'AI Agent Smart' : (isPrivateModeSelected ? 'Private' : (getIsFluxKontexModel(selectedModel) ? 'Image Editing' : (getIsFluxDevModel(selectedModel) ? 'Flux Dev Image Gen' : 'Kling Video Gen')))))} mode.`, "info");
        return;
    }
    if (messages.length === 0) {
      setError("Cannot save an empty chat.");
      addNotification("Cannot save an empty chat.", "info");
      return;
    }
    setError(null);
    const sessionTimestamp = Date.now();
    let sessionName = "Chat - " + new Date(sessionTimestamp).toLocaleString();
    const firstUserMessage = messages.find(m => m.sender === 'user');
    if (firstUserMessage) {
        if (firstUserMessage.isImageQuery && firstUserMessage.text) {
            sessionName = `Image: ${firstUserMessage.text.substring(0, 30)}${firstUserMessage.text.length > 30 ? '...' : ''}`;
        } else if (firstUserMessage.isVideoQuery && firstUserMessage.text) {
            sessionName = `Video: ${firstUserMessage.text.substring(0, 30)}${firstUserMessage.text.length > 30 ? '...' : ''}`;
        } else if (firstUserMessage.isTaskGoal && firstUserMessage.text) {
            sessionName = `Agent Goal: ${firstUserMessage.text.substring(0, 30)}${firstUserMessage.text.length > 30 ? '...' : ''}`;
        } else if (firstUserMessage.isNote && firstUserMessage.text) {
            sessionName = `Note: ${firstUserMessage.text.substring(0, 30)}${firstUserMessage.text.length > 30 ? '...' : ''}`;
        } else if (firstUserMessage.text) {
            sessionName = firstUserMessage.text.substring(0, 40) + (firstUserMessage.text.length > 40 ? '...' : '');
        } else if (firstUserMessage.imagePreview) {
            sessionName = "Chat with Image Upload";
        } else if (firstUserMessage.imagePreviews && firstUserMessage.imagePreviews.length > 0) {
            sessionName = `Flux Edit (${firstUserMessage.imagePreviews.length} images)`;
        } else if (firstUserMessage.fileName) {
            sessionName = `Chat with File: ${firstUserMessage.fileName}`;
        }
    }

    const sessionModelSettingsSnapshot: AnyModelSettings = currentModelSettings as AnyModelSettings;

    if (activeSessionId) {
        setSavedSessions(prev => {
            const updatedSession = {
                ...prev.find(s => s.id === activeSessionId)!,
                name: prev.find(s => s.id === activeSessionId)?.name || sessionName,
                messages: [...messages],
                model: selectedModel,
                modelSettingsSnapshot: sessionModelSettingsSnapshot,
                timestamp: sessionTimestamp,
                activePersonaIdSnapshot: activePersonaId,
            };
            const otherSessions = prev.filter(s => s.id !== activeSessionId);
            const { prunedSessions } = pruneChatSessions([updatedSession, ...otherSessions], MAX_SAVED_CHAT_SESSIONS);
            return prunedSessions.sort((a, b) => b.timestamp - a.timestamp);
        });
        setCurrentChatName(savedSessions.find(s => s.id === activeSessionId)?.name || sessionName);
        addNotification(`Chat "${currentChatName}" updated in browser.`, "success");
    } else {
        const newSessionId = `session-${sessionTimestamp}`;
        const newSession: ChatSession = {
            id: newSessionId,
            name: sessionName,
            timestamp: sessionTimestamp,
            model: selectedModel,
            messages: [...messages],
            modelSettingsSnapshot: sessionModelSettingsSnapshot,
            isPinned: false,
            activePersonaIdSnapshot: activePersonaId,
        };

        setSavedSessions(prev => {
            const updatedSessions = [...prev, newSession];
            const { prunedSessions, numPruned } = pruneChatSessions(updatedSessions, MAX_SAVED_CHAT_SESSIONS);
            if (numPruned > 0) {
                const removedSession = prev.find(s => !s.isPinned && !prunedSessions.some(ps => ps.id === s.id && s.id !== newSession.id));
                 if (removedSession && newSession.id !== removedSession.id) {
                    addNotification(`Storage limit: Oldest unpinned chat "${removedSession.name}" removed from browser to make space.`, "info");
                } else if (numPruned > 0) {
                    addNotification(`Storage limit: ${numPruned} oldest unpinned chat(s) removed from browser to save new chat.`, "info");
                }
            }
            return prunedSessions.sort((a, b) => b.timestamp - a.timestamp);
        });
        setActiveSessionId(newSessionId);
        setCurrentChatName(sessionName);
        addNotification(`Chat "${sessionName}" saved to browser.`, "success");
    }
    clearSearch();
  }, [messages, selectedModel, currentModelSettings, activeSessionId, savedSessions, activePersonaId, addNotification, currentChatName, isRealTimeTranslationMode, isAiAgentSmartMode, isPrivateModeSelected, pruneChatSessions, clearSearch]);

  const handleLoadSession = useCallback((sessionId: string, forceLoadAsTradingPro: boolean = false) => {
    const sessionToLoad = savedSessions.find(s => s.id === sessionId);
    if (sessionToLoad) {
      // Handle Trading Pro access for Demo users when loading a session
      if (sessionToLoad.model === Model.TRADING_PRO && userSession.isDemoUser && !demoTradingProAccessGranted && !forceLoadAsTradingPro) {
          setModelBeforeTradingProModal(selectedModel); // Store current model
          setPendingSessionLoadForTradingPro(sessionToLoad); // Store session for later loading
          setIsTradingProCodeModalOpen(true); // Trigger modal
          addNotification("Trading Pro session requires access code for Demo users.", "info");
          return;
      }

      if (sessionToLoad.model === Model.REAL_TIME_TRANSLATION || sessionToLoad.model === Model.AI_AGENT_SMART || sessionToLoad.model === Model.PRIVATE || getIsFluxKontexModel(sessionToLoad.model) || getIsFluxDevModel(sessionToLoad.model) || getIsKlingVideoModel(sessionToLoad.model) || (getIsTradingProModel(sessionToLoad.model) && !forceLoadAsTradingPro && !userSession.isPaidUser && !isAdminUser && !(userSession.isDemoUser && demoTradingProAccessGranted))) {
          addNotification(`Cannot load "${sessionToLoad.model}" sessions directly or access restricted. Please start a new one or verify access.`, "info");
          return;
      }
      setMessages([...sessionToLoad.messages]);
      setSelectedModel(sessionToLoad.model);
      setActivePersonaId(sessionToLoad.activePersonaIdSnapshot || null);

      setAllSettings(prevAllSettings => {
        const defaultsForModel = getSpecificDefaultSettings(sessionToLoad.model);
        const snapshot = sessionToLoad.modelSettingsSnapshot as ModelSpecificSettingsMap[typeof sessionToLoad.model];

        const newModelSettingsForLoadedSession: ModelSpecificSettingsMap[typeof sessionToLoad.model] = {
            ...defaultsForModel,
            ...snapshot
        };

        return {
            ...prevAllSettings,
            [sessionToLoad.model]: newModelSettingsForLoadedSession,
        };
      });

      setActiveSessionId(sessionId);
      setCurrentChatName(sessionToLoad.name);
      setUploadedImages([]);
      setImagePreviews([]);
      setUploadedTextFileContent(null);
      setUploadedTextFileName(null);
      setIsWebSearchEnabled(false);
      setError(null);
      setIsSidebarOpen(false);
      addNotification(`Loaded chat from browser: "${sessionToLoad.name}".`, "info");
      clearSearch();
    } else {
      addNotification("Failed to load chat session from browser.", "error");
    }
  }, [savedSessions, addNotification, clearSearch, userSession.isDemoUser, demoTradingProAccessGranted, selectedModel, userSession.isPaidUser, isAdminUser]);


  const handleStartNewChat = useCallback(() => {
    setMessages([]);
    setActiveSessionId(null);
    setCurrentChatName("New Chat");
    setUploadedImages([]);
    setImagePreviews([]);
    setUploadedTextFileContent(null);
    setUploadedTextFileName(null);
    setIsWebSearchEnabled(false);

    if (selectedModel !== Model.REAL_TIME_TRANSLATION && selectedModel !== Model.PRIVATE && !getIsFluxKontexModel(selectedModel) && !getIsFluxDevModel(selectedModel) && !getIsKlingVideoModel(selectedModel) && !getIsTradingProModel(selectedModel) && !(selectedModel === Model.GPT4O && !isGpt41Unlocked)) {
        setAllSettings(prev => {
            const modelKey = selectedModel;
            const defaultSettingsForModel = getSpecificDefaultSettings(modelKey);
            return {
                ...prev,
                [modelKey]: { ...defaultSettingsForModel } ,
            };
        });
    } else if (selectedModel === Model.GPT4O && isGpt41Unlocked) {
        setAllSettings(prev => {
            const modelKey = selectedModel;
            const defaultSettingsForModel = getSpecificDefaultSettings(modelKey);
            return {
                ...prev,
                [modelKey]: { ...defaultSettingsForModel },
            };
        });
    }

    if (!isAiAgentSmartMode && !isPrivateModeSelected && !getIsFluxKontexModel(selectedModel) && !getIsFluxDevModel(selectedModel) && !getIsKlingVideoModel(selectedModel) && !getIsTradingProModel(selectedModel)) setActivePersonaId(null);
    setError(null);
    setIsSidebarOpen(false);
    addNotification("Started new chat.", "info");
    clearSearch();

    if (isRealTimeTranslationMode) {
        setLiveTranscriptionDisplay("");
        setLiveTranslationDisplay("");
        liveTranscriptionRef.current = "";
        currentInterimVisualRef.current = "";
        interimTranslationBufferRef.current = "";
        liveTranslationAccumulatorRef.current = "";
        lastSuccessfullyTranslatedTextRef.current = null;
        lastSuccessfullyTranslatedTimestampRef.current = 0;
        if (audioPlayerRef.current && isSpeakingLiveTranslation) {
            audioPlayerRef.current.pause();
            setIsSpeakingLiveTranslation(false);
        }
    }
    if (getIsTradingProModel(selectedModel)) {
        setTradingProState(prev => ({
            ...DEFAULT_TRADING_PRO_VIEW_STATE,
            disclaimerAgreed: prev.disclaimerAgreed,
            selectedPair: (allSettings[Model.TRADING_PRO] as TradingProSettings | undefined)?.selectedPair || null,
            chartImageUrl: null,
            uploadedImageValidationError: null,
        }));
    }

  }, [selectedModel, addNotification, isRealTimeTranslationMode, isSpeakingLiveTranslation, isGpt41Unlocked, isAiAgentSmartMode, isPrivateModeSelected, clearSearch, allSettings]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    const sessionToDelete = savedSessions.find(s => s.id === sessionId);
    setSavedSessions(prev => {
        const updatedSessions = prev.filter(s => s.id !== sessionId);
        const { prunedSessions } = pruneChatSessions(updatedSessions, MAX_SAVED_CHAT_SESSIONS);
        return prunedSessions;
    });
    if (activeSessionId === sessionId) {
      handleStartNewChat();
    }
    if (sessionToDelete) {
      addNotification(`Deleted chat from browser: "${sessionToDelete.name}".`, "info");
    }
  }, [activeSessionId, handleStartNewChat, savedSessions, addNotification, pruneChatSessions]);

  const handleRenameSession = useCallback((sessionId: string, newName: string) => {
    setSavedSessions(prev => {
        const updatedSessions = prev.map(s => s.id === sessionId ? { ...s, name: newName } : s);
        return updatedSessions;
    });
    if (activeSessionId === sessionId) {
        setCurrentChatName(newName);
    }
    addNotification(`Chat renamed to "${newName}" in browser.`, "info");
  }, [activeSessionId, addNotification]);

  const handleTogglePinSession = useCallback((sessionId: string) => {
    let sessionName = "";
    let isNowPinned = false;
    setSavedSessions(prev => {
        let newSessions = prev.map(s => {
            if (s.id === sessionId) {
                sessionName = s.name;
                isNowPinned = !s.isPinned;
                return { ...s, isPinned: !s.isPinned };
            }
            return s;
        });
        const { prunedSessions, numPruned } = pruneChatSessions(newSessions, MAX_SAVED_CHAT_SESSIONS);
        if (numPruned > 0) {
            addNotification(`Storage limit: ${numPruned} oldest unpinned chat(s) removed from browser due to pinning changes.`, "info");
        }
        return prunedSessions.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return b.timestamp - a.timestamp;
        });
    });
    if (sessionName) {
      addNotification(isNowPinned ? `Pinned "${sessionName}" in browser.` : `Unpinned "${sessionName}" in browser.`, "info");
    }
  }, [addNotification, pruneChatSessions]);

  const handleSaveChatToDevice = useCallback(() => {
    if (isRealTimeTranslationMode || isAiAgentSmartMode || isPrivateModeSelected || getIsFluxKontexModel(selectedModel) || getIsFluxDevModel(selectedModel) || getIsKlingVideoModel(selectedModel) || getIsTradingProModel(selectedModel)) {
      addNotification(`Cannot save chat to device in ${getIsTradingProModel(selectedModel) ? 'Trading Pro' : (isRealTimeTranslationMode ? 'Real-Time Translation' : (isAiAgentSmartMode ? 'AI Agent Smart' : (isPrivateModeSelected ? 'Private' : (getIsFluxKontexModel(selectedModel) ? 'Image Editing' : (getIsFluxDevModel(selectedModel) ? 'Flux Dev Image Gen' : 'Kling Video Gen')))))} mode.`, "info");
      return;
    }
    if (messages.length === 0) {
      addNotification("Cannot save an empty chat to device.", "info");
      return;
    }

    const sessionTimestamp = Date.now();
    let determinedSessionName: string;

    if (currentChatName === "New Chat" || !currentChatName.trim()) {
        const firstUserMessage = messages.find(m => m.sender === 'user');
        if (firstUserMessage) {
            if (firstUserMessage.text && firstUserMessage.text.trim()) {
                determinedSessionName = firstUserMessage.text.substring(0, 30);
            } else if (firstUserMessage.imagePreview) {
                determinedSessionName = "Chat_with_Image";
            } else if (firstUserMessage.imagePreviews && firstUserMessage.imagePreviews.length > 0) {
                determinedSessionName = "Chat_with_Multiple_Images";
            } else if (firstUserMessage.fileName) {
                determinedSessionName = `Chat_with_File_${firstUserMessage.fileName.substring(0,20)}`;
            } else {
                determinedSessionName = `Chat-${sessionTimestamp}`;
            }
        } else {
            determinedSessionName = `Chat-${sessionTimestamp}`;
        }
        if (!determinedSessionName.trim()) {
           determinedSessionName = `Chat-${sessionTimestamp}`;
        }
    } else {
        determinedSessionName = currentChatName;
    }

    const sessionToSave: ChatSession = {
      id: activeSessionId || `device-session-${sessionTimestamp}`,
      name: determinedSessionName,
      timestamp: sessionTimestamp,
      model: selectedModel,
      messages: [...messages],
      modelSettingsSnapshot: currentModelSettings as AnyModelSettings,
      isPinned: savedSessions.find(s => s.id === activeSessionId)?.isPinned || false,
      activePersonaIdSnapshot: activePersonaId,
    };

    try {
      const jsonString = JSON.stringify(sessionToSave, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      const safeFileName = determinedSessionName.replace(/[^a-z0-9_.-]/gi, '_').substring(0, 50);
      link.download = `${safeFileName || 'chat_session'}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(href);
      addNotification(`Chat "${determinedSessionName}" is being saved to your device.`, "success");
    } catch (e: any) {
      console.error("Error saving chat to device:", e);
      addNotification("Failed to save chat to device.", "error", e.message);
    }
  }, [messages, selectedModel, currentModelSettings, activeSessionId, currentChatName, activePersonaId, addNotification, isRealTimeTranslationMode, isAiAgentSmartMode, isPrivateModeSelected, savedSessions]);

  const handleLoadChatFromDevice = useCallback(async (file: File) => {
    if (!file) return;
    if (!file.name.endsWith('.json')) {
        addNotification("Invalid file type. Please select a .json chat file.", "error");
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const result = event.target?.result;
            if (typeof result !== 'string') {
                throw new Error("Failed to read file content as string.");
            }
            const sessionToLoad = JSON.parse(result) as ChatSession;

            if (!sessionToLoad.messages || !sessionToLoad.model || !sessionToLoad.modelSettingsSnapshot || !sessionToLoad.name || !sessionToLoad.timestamp) {
                throw new Error("File is not a valid chat session format. Missing required fields.");
            }
            if (sessionToLoad.model === Model.REAL_TIME_TRANSLATION || sessionToLoad.model === Model.AI_AGENT_SMART || sessionToLoad.model === Model.PRIVATE || getIsFluxKontexModel(sessionToLoad.model) || getIsFluxDevModel(sessionToLoad.model) || getIsKlingVideoModel(sessionToLoad.model) || getIsTradingProModel(sessionToLoad.model)) {
                addNotification(`Cannot load "${sessionToLoad.model}" sessions from file.`, "info");
                return;
            }

            setMessages([...sessionToLoad.messages]);
            setSelectedModel(sessionToLoad.model);
            setActivePersonaId(sessionToLoad.activePersonaIdSnapshot || null);

            setAllSettings(prevAllSettings => {
                const defaultsForModel = getSpecificDefaultSettings(sessionToLoad.model);
                const snapshot = sessionToLoad.modelSettingsSnapshot as ModelSpecificSettingsMap[typeof sessionToLoad.model];

                const relevantSnapshotFields: Partial<typeof defaultsForModel> = {};
                for (const key in snapshot) {
                    if (Object.prototype.hasOwnProperty.call(defaultsForModel, key) && (snapshot as any)[key] !== undefined) {
                        (relevantSnapshotFields as any)[key] = (snapshot as any)[key];
                    }
                }

                const newModelSettingsForLoadedSession: ModelSpecificSettingsMap[typeof sessionToLoad.model] = {
                    ...defaultsForModel,
                    ...relevantSnapshotFields
                };
                return {
                    ...prevAllSettings,
                    [sessionToLoad.model]: newModelSettingsForLoadedSession
                };
            });

            setActiveSessionId(null);
            setCurrentChatName(sessionToLoad.name + " (from device)");

            setUploadedImages([]);
            setImagePreviews([]);
            setUploadedTextFileContent(null);
            setUploadedTextFileName(null);
            setIsWebSearchEnabled(false);
            setError(null);
            setIsSidebarOpen(false);
            addNotification(`Loaded chat from device: "${sessionToLoad.name}".`, "info");
            clearSearch();

        } catch (e: any) {
            console.error("Error loading chat from device:", e);
            addNotification("Failed to load chat from device. The file might be corrupted or not a valid chat session.", "error", e.message);
        }
    };
    reader.onerror = () => {
        addNotification("Error reading the selected file.", "error");
    };
    reader.readAsText(file);
  }, [addNotification, clearSearch]);


  const handleOpenImageModal = useCallback((imageData: string, promptText: string, mime: 'image/jpeg' | 'image/png') => {
    setModalImage(imageData);
    setModalPrompt(promptText);
    setModalMimeType(mime);
    setIsImageModalOpen(true);
  }, []);

  const handlePlayAudio = useCallback((audioUrl: string, messageId: string) => {
    if (!audioPlayerRef.current) return;
    const player = audioPlayerRef.current;

    if (isSpeakingLiveTranslation) {
        player.pause();
        setIsSpeakingLiveTranslation(false);
        setLiveTranslationAudioUrl(null);
    }

    if (currentPlayingMessageId === messageId) {
      if (player.paused) {
        player.play().catch(e => {
          if ((e as DOMException).name === 'AbortError') {
            console.log('Audio play() request was aborted.');
          } else {
            console.error("Error resuming audio:", e);
            addNotification("Error resuming audio.", "error", (e as Error).message);
          }
          setCurrentPlayingMessageId(null);
        });
      } else {
        player.pause();
      }
    } else {
      if (!player.paused) {
          player.pause();
      }
      player.src = audioUrl;
      setCurrentPlayingMessageId(messageId);

      player.play().catch(e => {
        if ((e as DOMException).name === 'AbortError') {
           console.log('Audio play() request was aborted.');
        } else {
          console.error("Error playing new audio:", e);
          addNotification("Error playing new audio.", "error", (e as Error).message);
        }
        if (currentPlayingMessageId === messageId) {
          setCurrentPlayingMessageId(null);
        }
      });
    }
  }, [currentPlayingMessageId, addNotification, isSpeakingLiveTranslation]);

  const handleSpeakLiveTranslation = useCallback(async () => {
    if (!audioPlayerRef.current || !liveTranslationDisplay.trim() || isListening) return;

    if (userSession.isDemoUser && !userSession.isPaidUser) {
        addNotification("Chức năng này chỉ hoạt động cho người dùng trả phí", "info");
        return;
    }

    const player = audioPlayerRef.current;

    if (currentPlayingMessageId) {
        player.pause();
        setCurrentPlayingMessageId(null);
    }
    if (isSpeakingLiveTranslation) {
        player.pause();
        return;
    }

    setIsSpeakingLiveTranslation(true);
    setLiveTranslationAudioUrl(null);

    const openAiTtsModelSettings = allSettings[Model.OPENAI_TTS] as OpenAITtsSettings | undefined;
    const ttsParams: ProxiedOpenAITtsParams = {
        modelIdentifier: openAiTtsModelSettings?.modelIdentifier || 'tts-1',
        textInput: liveTranslationDisplay.replace(/\[.*?\]:\s*/g, '').trim(),
        voice: 'nova' as OpenAiTtsVoice,
        speed: openAiTtsModelSettings?.speed || 1.0,
        userSession: userSession,
    };

    try {
        const ttsResult = await generateOpenAITTS(ttsParams);
        if (ttsResult.error || !ttsResult.audioBlob) {
            throw new Error(ttsResult.error || "TTS generation failed to return audio.");
        }
        const audioBlobUrl = URL.createObjectURL(ttsResult.audioBlob);
        setLiveTranslationAudioUrl(audioBlobUrl);
        player.src = audioBlobUrl;
        player.play().catch(e => {
            console.error("Error playing live translation audio:", e);
            addNotification("Error playing translation audio.", "error", (e as Error).message);
            setIsSpeakingLiveTranslation(false);
            setLiveTranslationAudioUrl(null);
            if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl);
        });
    } catch (error: any) {
        console.error("Error generating live translation TTS:", error);
        addNotification(`TTS Error: ${error.message}`, "error");
        setIsSpeakingLiveTranslation(false);
    }
  }, [liveTranslationDisplay, addNotification, allSettings, isListening, currentPlayingMessageId, isSpeakingLiveTranslation, userSession]);


  useEffect(() => {
    const player = audioPlayerRef.current;
    if (player) {
        const handleAudioEndOrPause = () => {
            if (currentPlayingMessageId) setCurrentPlayingMessageId(null);
            if (isSpeakingLiveTranslation) {
                setIsSpeakingLiveTranslation(false);
                if (liveTranslationAudioUrl) {
                    URL.revokeObjectURL(liveTranslationAudioUrl);
                    setLiveTranslationAudioUrl(null);
                }
            }
        };
        player.addEventListener('ended', handleAudioEndOrPause);
        player.addEventListener('pause', handleAudioEndOrPause);
        return () => {
            player.removeEventListener('ended', handleAudioEndOrPause);
            player.removeEventListener('pause', handleAudioEndOrPause);
            if (liveTranslationAudioUrl) {
                URL.revokeObjectURL(liveTranslationAudioUrl);
            }
        };
    }
  }, [currentPlayingMessageId, isSpeakingLiveTranslation, liveTranslationAudioUrl]);

  const pollFalStatus = useCallback(async (requestId: string, aiMessageId: string, userPrompt: string, falModelIdForPolling: string) => {
    const MAX_TOTAL_POLLS = 30;
    const POLL_INTERVAL = 3000;
    const MAX_NOT_FOUND_POLLS = 12;

    let pollCount = 0;
    let notFoundCount = 0;
    let intervalId: number | undefined;

    const performPoll = async () => {
      pollCount++;
      if (pollCount > MAX_TOTAL_POLLS) {
        if (intervalId) clearInterval(intervalId);
        setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Image processing timed out for: "${userPrompt}". Please try again.`, isRegenerating: false, fluxRequestId: undefined } : msg));
        addNotification("Fal.ai image processing timed out.", "error");
        setIsLoading(false);
        return;
      }

      try {
        const statusResult = await checkFalQueueStatusProxy(requestId, falModelIdForPolling);

        if (statusResult.status === 'COMPLETED') {
          if (intervalId) clearInterval(intervalId);
          const imageOutput = statusResult.imageUrls && statusResult.imageUrls.length > 0 ? statusResult.imageUrls : (statusResult.imageUrl ? [statusResult.imageUrl] : []);

          if (imageOutput.length > 0) {
            setMessages(prev => prev.map(msg => msg.id === aiMessageId ? {
              ...msg,
              text: `Image(s) processed for prompt: "${userPrompt}"`,
              imagePreviews: imageOutput,
              imageMimeType: 'image/png',
              originalPrompt: userPrompt,
              isRegenerating: false,
              fluxRequestId: undefined,
              timestamp: msg.timestamp || Date.now()
            } : msg));
            addNotification("Image processing successful!", "success");
          } else {
            setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Image processing completed, but no image was returned. Prompt: "${userPrompt}"`, isRegenerating: false, fluxRequestId: undefined } : msg));
            addNotification("Fal.ai: Processing completed, but no image was returned by the API.", "info", statusResult.rawResult ? JSON.stringify(statusResult.rawResult).substring(0, 200) : undefined);
          }
          setIsLoading(false);
          return;
        } else if (statusResult.status === 'IN_PROGRESS' || statusResult.status === 'IN_QUEUE') {
          notFoundCount = 0;
          setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Image processing: ${statusResult.status?.toLowerCase()} (ID: ${requestId}). Attempt ${pollCount}/${MAX_TOTAL_POLLS}...` } : msg));
        } else if (statusResult.status === 'NOT_FOUND') {
          notFoundCount++;
          if (notFoundCount > MAX_NOT_FOUND_POLLS) {
            if (intervalId) clearInterval(intervalId);
            const errorMessage = statusResult.error || `Request ID ${requestId} not found after several attempts.`;
            setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Error processing image: ${errorMessage}. Prompt: "${userPrompt}"`, isRegenerating: false, fluxRequestId: undefined } : msg));
            addNotification(`Fal.ai Error: ${errorMessage}`, "error", statusResult.rawResult ? JSON.stringify(statusResult.rawResult).substring(0,200) : undefined);
            setIsLoading(false);
            return;
          }
          setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Image processing: Verifying request (ID: ${requestId}). Attempt ${pollCount}/${MAX_TOTAL_POLLS}...` } : msg));
        } else {
          if (intervalId) clearInterval(intervalId);
          const errorMessage = statusResult.error || "Unknown error during image processing.";
          setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Error processing image: ${errorMessage}. Prompt: "${userPrompt}"`, isRegenerating: false, fluxRequestId: undefined } : msg));
          addNotification(`Fal.ai Error: ${errorMessage}`, "error", statusResult.rawResult ? JSON.stringify(statusResult.rawResult).substring(0,200) : undefined);
          setIsLoading(false);
        }
      } catch (pollingError: any) {
        if (intervalId) clearInterval(intervalId);
        setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Error checking image processing status: ${pollingError.message}. Prompt: "${userPrompt}"`, isRegenerating: false, fluxRequestId: undefined } : msg));
        addNotification(`Polling Error: ${pollingError.message}`, "error");
        setIsLoading(false);
      }
    };

    performPoll();
    intervalId = window.setInterval(performPoll, POLL_INTERVAL);
  }, [addNotification, setMessages, setIsLoading]);

   const pollKlingVideoStatus = useCallback(async (requestId: string, aiMessageId: string, userPrompt: string, falModelIdForPolling: string) => {
    const MAX_TOTAL_POLLS_VIDEO = 60;
    const POLL_INTERVAL_VIDEO = 5000;
    const MAX_NOT_FOUND_POLLS_VIDEO = 15;

    let pollCount = 0;
    let notFoundCount = 0;
    let intervalId: number | undefined;

    const performPoll = async () => {
      pollCount++;
      if (pollCount > MAX_TOTAL_POLLS_VIDEO) {
        if (intervalId) clearInterval(intervalId);
        setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Video processing timed out for: "${userPrompt}". Please try again.`, isRegenerating: false, klingVideoRequestId: undefined } : msg));
        addNotification("Kling AI video processing timed out.", "error");
        setIsLoading(false);
        return;
      }

      try {
        const statusResult = await checkFalQueueStatusProxy(requestId, falModelIdForPolling);

        if (statusResult.status === 'COMPLETED') {
          if (intervalId) clearInterval(intervalId);
          if (statusResult.videoUrl) {
            setMessages(prev => prev.map(msg => msg.id === aiMessageId ? {
              ...msg,
              text: `Video processed for prompt: "${userPrompt}"`,
              videoUrl: statusResult.videoUrl,
              videoMimeType: 'video/mp4',
              originalPrompt: userPrompt,
              isRegenerating: false,
              klingVideoRequestId: undefined,
              timestamp: msg.timestamp || Date.now()
            } : msg));
            addNotification("Kling AI video processing successful!", "success");
          } else {
            setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Video processing completed, but no video was returned. Prompt: "${userPrompt}"`, isRegenerating: false, klingVideoRequestId: undefined } : msg));
            addNotification("Kling AI: Processing completed, but no video was returned by the API.", "info", statusResult.rawResult ? JSON.stringify(statusResult.rawResult).substring(0, 200) : undefined);
          }
          setIsLoading(false);
          return;
        } else if (statusResult.status === 'IN_PROGRESS' || statusResult.status === 'IN_QUEUE') {
          notFoundCount = 0;
          setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Video processing: ${statusResult.status?.toLowerCase()} (ID: ${requestId.substring(0,8)}...). Attempt ${pollCount}/${MAX_TOTAL_POLLS_VIDEO}...` } : msg));
        } else if (statusResult.status === 'NOT_FOUND') {
          notFoundCount++;
          if (notFoundCount > MAX_NOT_FOUND_POLLS_VIDEO) {
            if (intervalId) clearInterval(intervalId);
            const errorMessage = statusResult.error || `Request ID ${requestId} not found after several attempts.`;
            setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Error processing video: ${errorMessage}. Prompt: "${userPrompt}"`, isRegenerating: false, klingVideoRequestId: undefined } : msg));
            addNotification(`Kling AI Error: ${errorMessage}`, "error", statusResult.rawResult ? JSON.stringify(statusResult.rawResult).substring(0,200) : undefined);
            setIsLoading(false);
            return;
          }
          setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Video processing: Verifying request (ID: ${requestId.substring(0,8)}...). Attempt ${pollCount}/${MAX_TOTAL_POLLS_VIDEO}...` } : msg));
        } else {
          if (intervalId) clearInterval(intervalId);
          const errorMessage = statusResult.error || "Unknown error during video processing.";
          setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Error processing video: ${errorMessage}. Prompt: "${userPrompt}"`, isRegenerating: false, klingVideoRequestId: undefined } : msg));
          addNotification(`Kling AI Error: ${errorMessage}`, "error", statusResult.rawResult ? JSON.stringify(statusResult.rawResult).substring(0,200) : undefined);
          setIsLoading(false);
        }
      } catch (pollingError: any) {
        if (intervalId) clearInterval(intervalId);
        setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Error checking video processing status: ${pollingError.message}. Prompt: "${userPrompt}"`, isRegenerating: false, klingVideoRequestId: undefined } : msg));
        addNotification(`Kling Polling Error: ${pollingError.message}`, "error");
        setIsLoading(false);
      }
    };

    performPoll();
    intervalId = window.setInterval(performPoll, POLL_INTERVAL_VIDEO);
  }, [addNotification, setMessages, setIsLoading]);


  const internalSendMessage = async (
    currentInputText: string,
    currentUploadedImageFiles: File[],
    currentUploadedImagePreviews: string[],
    currentUploadedTextContent: string | null,
    currentUploadedTextFileName: string | null,
    isRegenerationOfAiMsgId?: string
  ) => {

    const messageTimestamp = Date.now();
    const userMessageId = messageTimestamp.toString();
    let userDisplayedText = currentInputText.trim();
    let textForApi = currentInputText.trim();

    if (isAiAgentSmartMode) {
        // AAS handles image via description from system. Text file content is not sent.
    } else if (currentUploadedTextFileName && currentUploadedTextContent) { // For other models that might support text files
        textForApi = `The user has uploaded a file named "${currentUploadedTextFileName}".\nThe content of this file is:\n${currentUploadedTextContent}\n\n---\n\n${textForApi}`;
    }

    const canHaveSingleImagePreview =
        selectedModel === Model.GEMINI ||
        selectedModel === Model.GEMINI_ADVANCED ||
        selectedModel === Model.GPT4O ||
        selectedModel === Model.GPT4O_MINI ||
        selectedModel === Model.DEEPSEEK ||
        selectedModel === Model.AI_AGENT_SMART ||
        selectedModel === Model.PRIVATE ||
        selectedModel === Model.FLUX_KONTEX ||
        selectedModel === Model.KLING_VIDEO ||
        selectedModel === Model.TRADING_PRO; // Trading Pro now can have a user-uploaded image preview

    const newUserMessage: ChatMessage = {
        id: userMessageId,
        text: userDisplayedText,
        sender: 'user',
        timestamp: messageTimestamp,
        imagePreview: canHaveSingleImagePreview && currentUploadedImagePreviews.length > 0 ? currentUploadedImagePreviews[0] : undefined,
        imagePreviews: (selectedModel === Model.FLUX_KONTEX_MAX_MULTI || getIsFluxDevModel(selectedModel)) ? currentUploadedImagePreviews : undefined,
        imageMimeTypes: (selectedModel === Model.FLUX_KONTEX_MAX_MULTI || getIsFluxDevModel(selectedModel)) ? currentUploadedImageFiles.map(f => f.type) : undefined,
        fileName: (selectedModel !== Model.AI_AGENT_SMART && currentUploadedTextFileName) ? currentUploadedTextFileName : undefined,
        isImageQuery: isImagenModelSelected || getIsFluxKontexModel(selectedModel) || getIsFluxDevModel(selectedModel) || isAiAgentSmartMode || getIsTradingProModel(selectedModel),
        isVideoQuery: getIsKlingVideoModel(selectedModel),
        isTaskGoal: isAiAgentSmartMode,
        isNote: isPrivateModeSelected && (currentUploadedImagePreviews.length === 0 && !currentUploadedTextFileName),
        model: isPrivateModeSelected ? Model.PRIVATE : undefined,
    };

    if (!isRegenerationOfAiMsgId) {
        setMessages((prev) => [...prev, newUserMessage]);
    }

    const aiMessageTimestamp = Date.now();
    const aiMessageId = isRegenerationOfAiMsgId || (aiMessageTimestamp + 1).toString();
    const actualModelIdentifierForFal = (getIsFluxKontexModel(selectedModel) || getIsFluxDevModel(selectedModel) || getIsKlingVideoModel(selectedModel)) ? getActualModelIdentifier(selectedModel) : undefined;
    const isAdmin = !userSession.isDemoUser && !userSession.isPaidUser;

    if (selectedModel === Model.FLUX_KONTEX_MAX_MULTI && !userSession.isPaidUser && !isAdmin) {
        addNotification("Flux Kontext Max is for Paid Users or Admin only.", "error");
        setIsLoading(false);
        return;
    }
    if (getIsFluxDevModel(selectedModel) && !userSession.isPaidUser && !isAdmin) {
        addNotification("Flux Dev is for Paid Users or Admin only.", "error");
        setIsLoading(false);
        return;
    }
    if (getIsKlingVideoModel(selectedModel) && !userSession.isPaidUser && !isAdmin) {
      addNotification("Kling AI Video generation is only available for Paid Users or Admin.", "error");
      setIsLoading(false);
      return;
    }
    if (getIsTradingProModel(selectedModel)) {
      // This case should be handled by onAnalyzeTradingProClick, not general sendMessage
      // For safety, if somehow called:
      addNotification("Trading Pro interactions are handled in its dedicated view.", "info");
      setIsLoading(false);
      return;
    }


    let aiPlaceholderText = isRegenerationOfAiMsgId ? 'Regenerating...' : '';
    if (!isRegenerationOfAiMsgId) {
        if (isImagenModelSelected) aiPlaceholderText = 'Generating image(s)...';
        else if (getIsFluxKontexModel(selectedModel)) aiPlaceholderText = 'Submitting image for editing...';
        else if (getIsFluxDevModel(selectedModel)) aiPlaceholderText = 'Generating image (Flux Dev)...';
        else if (getIsKlingVideoModel(selectedModel)) aiPlaceholderText = 'Submitting video request...';
        else if (isTextToSpeechModelSelected) aiPlaceholderText = 'Synthesizing audio...';
        else if (isAiAgentSmartMode) aiPlaceholderText = 'AI Agent Smart is processing...';
        else if (isPrivateModeSelected) aiPlaceholderText = 'Data logged locally. No AI response.';
        else aiPlaceholderText = 'Thinking...';
    }


    const aiMessagePlaceholder: ChatMessage = {
        id: aiMessageId,
        text: aiPlaceholderText,
        sender: 'ai',
        timestamp: aiMessageTimestamp,
        model: selectedModel,
        isRegenerating: !!isRegenerationOfAiMsgId,
        promptedByMessageId: userMessageId,
        isTaskPlan: isAiAgentSmartMode,
        originalPrompt: userDisplayedText,
        fluxModelId: (getIsFluxKontexModel(selectedModel) || getIsFluxDevModel(selectedModel) || getIsKlingVideoModel(selectedModel)) ? actualModelIdentifierForFal : undefined,
    };

    if (isPrivateModeSelected) {
        setMessages(prev => prev.map(msg => msg.id === userMessageId ? {...msg, model: Model.PRIVATE} : msg));
        setIsLoading(false);
        setInput('');
        setUploadedImages([]);
        setImagePreviews([]);
        setUploadedTextFileContent(null);
        setUploadedTextFileName(null);
        addNotification("Entry logged locally. AI features disabled in Private Mode.", "info");
        return;
    }

    if (isRegenerationOfAiMsgId) {
        setMessages(prev => prev.map(msg => msg.id === aiMessageId ? {...aiMessagePlaceholder, timestamp: msg.timestamp || aiMessageTimestamp } : msg));
    } else {
        setMessages((prev) => [...prev, aiMessagePlaceholder]);
    }

    let requestHeaders: HeadersInit = { 'Content-Type': 'application/json' };
    if (userSession.isPaidUser && userSession.paidUserToken) {
        requestHeaders['X-Paid-User-Token'] = userSession.paidUserToken;
    } else if (userSession.isDemoUser && userSession.demoUserToken) {
        requestHeaders['X-Demo-Token'] = userSession.demoUserToken;
    }

    if (userSession.isDemoUser && !isAdmin) {
        const limits = userSession.demoLimits;
        let limitExceeded = false;
        let notificationMessage = "";

        if (getIsFluxKontexModel(selectedModel)) {
            const isMax = selectedModel === Model.FLUX_KONTEX_MAX_MULTI;
            const usesLeft = isMax ? limits?.fluxKontextMaxMonthlyUsesLeft : limits?.fluxKontextProMonthlyUsesLeft;
            if (!limits || usesLeft === undefined || usesLeft <= 0) {
                limitExceeded = true;
                notificationMessage = `Đã hết lượt dùng thử ${isMax ? 'Flux Kontext Max' : 'Flux Kontext Pro'}. Vui lòng liên hệ admin.`;
            }
        } else if (getIsFluxDevModel(selectedModel)) {
            limitExceeded = true;
            notificationMessage = "Flux Dev is for Paid Users or Admin only. DEMO users cannot use this model.";
        } else if (getIsKlingVideoModel(selectedModel)) {
            limitExceeded = true;
            notificationMessage = "Kling AI Video is for Paid Users or Admin only. DEMO users cannot use this model.";
        } else if (isImagenModelSelected) {
            const imagenSettings = currentModelSettings as ImagenSettings;
            const numImagesToGen = imagenSettings.numberOfImages || 1;
            if (!limits || limits.imagen3MonthlyImagesLeft < numImagesToGen) {
                limitExceeded = true;
                notificationMessage = `Not enough Imagen3 demo uses left. Need ${numImagesToGen}, have ${limits?.imagen3MonthlyImagesLeft || 0}.`;
            }
        } else if (isTextToSpeechModelSelected) {
            if (!limits || currentInputText.length > limits.openaiTtsMonthlyCharsLeft) {
                 limitExceeded = true;
                 notificationMessage = `OpenAI TTS character limit exceeded for DEMO. Need ${currentInputText.length}, have ${limits?.openaiTtsMonthlyCharsLeft || 0} left.`;
            }
        }
        if (limitExceeded) {
            addNotification(notificationMessage, "error");
            setIsLoading(false);
            setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
            return;
        }
    }

    if (userSession.isPaidUser && userSession.paidLimits && !isAdmin) {
        if (getIsFluxDevModel(selectedModel)) {
            const fluxDevSettings = currentModelSettings as FluxDevSettings;
            const numImagesToGenFluxDev = fluxDevSettings.num_images || 1;
            if (userSession.paidLimits.fluxDevMonthlyImagesLeft < numImagesToGenFluxDev) {
                addNotification(`Not enough Flux Dev paid uses left. Need ${numImagesToGenFluxDev}, have ${userSession.paidLimits.fluxDevMonthlyImagesLeft}.`, "error");
                setIsLoading(false);
                setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
                return;
            }
        } else if (getIsKlingVideoModel(selectedModel)) {
            if ((userSession.paidLimits.klingVideoMonthlyUsed || 0) >= (userSession.paidLimits.klingVideoMonthlyMaxGenerations || PAID_USER_LIMITS_CONFIG.klingVideoMonthlyMaxGenerations || 1)) {
                 addNotification(`Monthly Kling AI Video generation limit reached. Max ${userSession.paidLimits.klingVideoMonthlyMaxGenerations || PAID_USER_LIMITS_CONFIG.klingVideoMonthlyMaxGenerations || 1} per month.`, "error");
                 setIsLoading(false);
                 setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
                 return;
            }
        }
    }


    try {
      const currentModelSpecificSettingsForApiCall: AnyModelSettings = currentModelSettings;
      const currentModelStatus = apiKeyStatuses[selectedModel];
      const actualModelIdentifier = getActualModelIdentifier(selectedModel);

      let apiResponseData: any;

      if (currentModelStatus?.isTextToSpeech && !currentModelStatus.isMock) {
          const ttsSettings = currentModelSpecificSettingsForApiCall as OpenAITtsSettings;
          const ttsParams: ProxiedOpenAITtsParams = {
            modelIdentifier: ttsSettings.modelIdentifier || 'tts-1',
            textInput: userDisplayedText,
            voice: ttsSettings.voice || 'alloy',
            speed: ttsSettings.speed || 1.0,
            userSession: userSession,
          };
          const ttsResult = await generateOpenAITTS(ttsParams);

          if (ttsResult.error || !ttsResult.audioBlob) {
              throw new Error(ttsResult.error || `OpenAI TTS Proxy Error`);
          }

          setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? {
              ...msg, text: `Audio generated for: "${userDisplayedText}"`, audioUrl: URL.createObjectURL(ttsResult.audioBlob), isRegenerating: false, timestamp: msg.timestamp || Date.now()
          } : msg));
          if (audioPlayerRef.current) handlePlayAudio(URL.createObjectURL(ttsResult.audioBlob), aiMessageId);

          if (userSession.isDemoUser && !isAdmin && userSession.demoLimits) {
              onUpdateDemoLimits({ openaiTtsMonthlyCharsLeft: (userSession.demoLimits?.openaiTtsMonthlyCharsLeft || 0) - userDisplayedText.length });
          }

      } else if ((currentModelStatus?.isImageEditing || currentModelStatus?.isMultiImageEditing) && !currentModelStatus.isMock) {
          if (currentUploadedImageFiles.length === 0 || currentUploadedImagePreviews.length === 0) {
            throw new Error("Flux Kontext requires at least one image to be uploaded.");
          }

          let fluxImageData: SingleImageData | MultiImageData;
          if (selectedModel === Model.FLUX_KONTEX_MAX_MULTI) {
            const imagesData = currentUploadedImagePreviews.map((previewUrl, index) => {
                const [header, base64DataOnly] = previewUrl.split(',');
                if (!base64DataOnly || !/^[A-Za-z0-9+/=]+$/.test(base64DataOnly)) {
                    throw new Error(`Invalid image data for image ${index + 1}.`);
                }
                const mimeTypeMatch = header?.match(/data:(image\/[a-zA-Z0-9-.+]+);base64/);
                return {
                    base64: base64DataOnly,
                    mimeType: mimeTypeMatch ? mimeTypeMatch[1] : (currentUploadedImageFiles[index]?.type || 'image/png')
                };
            });
            fluxImageData = { images_data: imagesData };
          } else {
            const [header, base64DataOnly] = currentUploadedImagePreviews[0].split(',');
             if (!base64DataOnly || !/^[A-Za-z0-9+/=]+$/.test(base64DataOnly)) {
                throw new Error("Invalid image data provided for Flux Kontext.");
            }
            const mimeTypeMatch = header?.match(/data:(image\/[a-zA-Z0-9-.+]+);base64/);
            fluxImageData = {
                image_base_64: base64DataOnly,
                image_mime_type: (mimeTypeMatch ? mimeTypeMatch[1] : (currentUploadedImageFiles[0]?.type || 'image/png')) as 'image/jpeg' | 'image/png'
            };
          }

          const fluxKontextApiSettings: Partial<FluxKontexSettings> = { ...(currentModelSpecificSettingsForApiCall as FluxKontexSettings) };
          if (fluxKontextApiSettings.aspect_ratio === 'default') {
              delete fluxKontextApiSettings.aspect_ratio;
          }

          const fluxParams: EditImageWithFluxKontexParams = {
              modelIdentifier: actualModelIdentifier,
              prompt: textForApi,
              settings: fluxKontextApiSettings as FluxKontexSettings,
              imageData: fluxImageData,
              requestHeaders: requestHeaders,
              userSession: userSession,
          };
          const fluxResult = await editImageWithFluxKontexProxy(fluxParams);

          if (fluxResult.error) throw new Error(fluxResult.error);

          if (fluxResult.requestId) {
            setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? {
                ...msg, text: fluxResult.message || `Image editing submitted (ID: ${fluxResult.requestId}). Waiting for results...`, fluxRequestId: fluxResult.requestId, isRegenerating: false, timestamp: msg.timestamp || Date.now(), fluxModelId: actualModelIdentifier
            } : msg));
            pollFalStatus(fluxResult.requestId, aiMessageId, userDisplayedText, actualModelIdentifier);
            if (userSession.isDemoUser && !isAdmin && userSession.demoLimits) {
                if (selectedModel === Model.FLUX_KONTEX) {
                    onUpdateDemoLimits({ fluxKontextProMonthlyUsesLeft: (userSession.demoLimits?.fluxKontextProMonthlyUsesLeft || 0) - 1 });
                }
            } else if (userSession.isPaidUser && !isAdmin && userSession.paidLimits) {
                const numImagesProcessed = 1;
                if (selectedModel === Model.FLUX_KONTEX_MAX_MULTI) {
                   onUpdateDemoLimits({ fluxKontextMaxMonthlyUsesLeft: (userSession.paidLimits.fluxKontextMaxMonthlyUsesLeft || 0) - numImagesProcessed});
                } else if (selectedModel === Model.FLUX_KONTEX) {
                    onUpdateDemoLimits({ fluxKontextProMonthlyUsesLeft: (userSession.paidLimits.fluxKontextProMonthlyUsesLeft || 0) - numImagesProcessed});
                }
            }
          } else { throw new Error(fluxResult.error || "Flux Kontext submission failed (no request ID)."); }
      } else if (currentModelStatus?.isFluxDevImageGeneration && !currentModelStatus.isMock) {
            const fluxDevApiSettings: FluxDevSettings = { ...(currentModelSpecificSettingsForApiCall as FluxDevSettings) };

            const fluxDevParams: GenerateImageWithFluxDevParams = {
                modelIdentifier: actualModelIdentifier,
                prompt: textForApi,
                settings: fluxDevApiSettings,
                requestHeaders: requestHeaders,
                userSession: userSession,
            };
            const fluxDevResult = await generateImageWithFluxDevProxy(fluxDevParams);
            if (fluxDevResult.error) throw new Error(fluxDevResult.error);

            if (fluxDevResult.requestId) {
                setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? {
                    ...msg, text: fluxDevResult.message || `Flux Dev image generation submitted (ID: ${fluxDevResult.requestId}). Waiting for results...`, fluxRequestId: fluxDevResult.requestId, isRegenerating: false, timestamp: msg.timestamp || Date.now(), fluxModelId: actualModelIdentifier
                } : msg));
                pollFalStatus(fluxDevResult.requestId, aiMessageId, userDisplayedText, actualModelIdentifier);
                if (userSession.isPaidUser && !isAdmin && userSession.paidLimits) {
                    const numImages = (currentModelSpecificSettingsForApiCall as FluxDevSettings).num_images || 1;
                    onUpdateDemoLimits({ fluxDevMonthlyImagesLeft: (userSession.paidLimits?.fluxDevMonthlyImagesLeft || 0) - numImages });
                }
            } else { throw new Error(fluxDevResult.error || "Flux Dev submission failed (no request ID)."); }
      } else if (currentModelStatus?.isKlingVideoGeneration && !currentModelStatus.isMock) {
          if (currentUploadedImageFiles.length === 0 || currentUploadedImagePreviews.length === 0) {
            throw new Error("Kling AI video generation requires an image to be uploaded.");
          }
          const [header, base64DataOnly] = currentUploadedImagePreviews[0].split(',');
          if (!base64DataOnly || !/^[A-Za-z0-9+/=]+$/.test(base64DataOnly)) {
            throw new Error("Invalid image data provided for Kling AI.");
          }
          const mimeTypeMatch = header?.match(/data:(image\/[a-zA-Z0-9-.+]+);base64/);
          const klingImageData: SingleImageData = {
              image_base_64: base64DataOnly,
              image_mime_type: (mimeTypeMatch ? mimeTypeMatch[1] : (currentUploadedImageFiles[0]?.type || 'image/png')) as 'image/jpeg' | 'image/png'
          };

          const klingApiSettings: KlingAiSettings = { ...(currentModelSpecificSettingsForApiCall as KlingAiSettings) };

          const klingParams: GenerateVideoWithKlingParams = {
              modelIdentifier: actualModelIdentifier,
              prompt: textForApi,
              settings: klingApiSettings,
              imageData: klingImageData,
              requestHeaders: requestHeaders,
              userSession: userSession,
          };
          const klingResult = await generateVideoWithKlingProxy(klingParams);
          if (klingResult.error) throw new Error(klingResult.error);

          if (klingResult.requestId) {
              setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? {
                  ...msg, text: klingResult.message || `Kling AI video request submitted (ID: ${klingResult.requestId}). Waiting for results...`, klingVideoRequestId: klingResult.requestId, isRegenerating: false, timestamp: msg.timestamp || Date.now(), fluxModelId: actualModelIdentifier
              } : msg));
              pollKlingVideoStatus(klingResult.requestId, aiMessageId, userDisplayedText, actualModelIdentifier);

              if (userSession.isPaidUser && !isAdmin && userSession.paidLimits) {
                  onUpdateDemoLimits({ klingVideoMonthlyUsed: (userSession.paidLimits.klingVideoMonthlyUsed || 0) + 1 });
              }
          } else { throw new Error(klingResult.error || "Kling AI video submission failed (no request ID)."); }
      } else if (isImagenModelSelected && !currentModelStatus.isMock) {
          const imagenBody = { prompt: userDisplayedText, modelSettings: currentModelSpecificSettingsForApiCall as ImagenSettings, modelName: actualModelIdentifier };
          const imagenFetchResponse = await fetch('/api/gemini/image/generate', {
              method: 'POST', headers: requestHeaders, body: JSON.stringify(imagenBody)
          });
          apiResponseData = await safeResponseJson(imagenFetchResponse);
          if (!imagenFetchResponse.ok || apiResponseData.error) {
              throw new Error(apiResponseData.error || `Imagen Proxy Error: ${imagenFetchResponse.statusText}`);
          }

          if (apiResponseData.generatedImages && apiResponseData.generatedImages.length > 0) {
            const mimeType = (currentModelSpecificSettingsForApiCall as ImagenSettings).outputMimeType || 'image/jpeg';
            const imageUrls = apiResponseData.generatedImages.map((img: any) => `data:${mimeType};base64,${img.image.imageBytes}`);
            setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? {
                    ...msg, text: `Generated ${imageUrls.length} image(s) for: "${userDisplayedText}"`,
                    imagePreviews: imageUrls, imageMimeType: mimeType, originalPrompt: userDisplayedText, isRegenerating: false,
                    timestamp: msg.timestamp || Date.now()
                  } : msg ));
            if (userSession.isDemoUser && !isAdmin && userSession.demoLimits) {
                const numGenerated = apiResponseData.generatedImages.length;
                onUpdateDemoLimits({ imagen3MonthlyImagesLeft: (userSession.demoLimits?.imagen3MonthlyImagesLeft || 0) - numGenerated });
            } else if (userSession.isPaidUser && !isAdmin && userSession.paidLimits) {
                const numGenerated = apiResponseData.generatedImages.length;
                onUpdateDemoLimits({ imagen3ImagesLeft: (userSession.paidLimits?.imagen3ImagesLeft || 0) - numGenerated });
            }
          } else { throw new Error(apiResponseData.error || "Image generation failed (no images returned)."); }

      } else if (currentModelStatus?.isGeminiPlatform && !currentModelStatus.isMock && !isRealTimeTranslationMode && !isPrivateModeSelected) {
        let geminiChatSettings: ModelSettings | AiAgentSmartSettings;
        if (selectedModel === Model.AI_AGENT_SMART) {
            geminiChatSettings = currentModelSpecificSettingsForApiCall as AiAgentSmartSettings;
        } else if ('systemInstruction' in currentModelSpecificSettingsForApiCall) {
            geminiChatSettings = currentModelSpecificSettingsForApiCall as ModelSettings;
        } else {
            console.error("Error: Gemini platform model selected but settings are not ModelSettings or AiAgentSmartSettings compatible", currentModelSpecificSettingsForApiCall);
            throw new Error("Incompatible settings for Gemini chat model.");
        }

        const geminiHistory: Content[] = messagesToGeminiHistory(messages, aiMessageId, newUserMessage.id, isAiAgentSmartMode);

        const currentUserParts: Part[] = [];
        if (textForApi.trim()) {
            currentUserParts.push({ text: textForApi.trim() });
        }

        if (currentUploadedImageFiles.length > 0 && currentUploadedImagePreviews.length > 0) {
            const base64Image = currentUploadedImagePreviews[0].split(',')[1];
            if (base64Image) {
                  currentUserParts.push({ inlineData: { mimeType: currentUploadedImageFiles[0].type, data: base64Image } });
            }
        }
        if (currentUserParts.length > 0) {
            geminiHistory.push({ role: 'user', parts: currentUserParts });
        } else if (geminiHistory.length === 0 && !isRegenerationOfAiMsgId) {
            throw new Error("Cannot send an empty message to the AI.");
        }

        const stream = sendGeminiMessageStream({
          historyContents: geminiHistory, modelSettings: geminiChatSettings, enableGoogleSearch: isAiAgentSmartMode || isWebSearchEnabled, modelName: actualModelIdentifier, userSession: userSession,
        });
        let currentText = ''; let currentGroundingSources: GroundingSource[] | undefined = undefined;
        for await (const chunk of stream) {
          if (chunk.error) throw new Error(chunk.error);
          if (chunk.textDelta) currentText += chunk.textDelta;
          if (chunk.groundingSources && chunk.groundingSources.length > 0) currentGroundingSources = chunk.groundingSources;
          setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? { ...msg, text: currentText, groundingSources: currentGroundingSources || msg.groundingSources, isRegenerating: false } : msg ));
        }
      } else if ((selectedModel === Model.GPT4O || selectedModel === Model.GPT4O_MINI) && !currentModelStatus.isMock) {
        const isRegen = !!isRegenerationOfAiMsgId;
        const activeImageFileForOpenAI = currentUploadedImageFiles.length > 0 ? currentUploadedImageFiles[0] : null;
        const activeImagePreviewForOpenAI = currentUploadedImagePreviews.length > 0 ? currentUploadedImagePreviews[0] : null;

        let openAISystemInstruction = DEFAULT_MODEL_SETTINGS.systemInstruction;
        if ('systemInstruction' in currentModelSpecificSettingsForApiCall) {
            openAISystemInstruction = (currentModelSpecificSettingsForApiCall as ModelSettings).systemInstruction;
        }

        const history: ApiChatMessage[] = messagesToOpenAIHistory(messages, aiMessageId, newUserMessage.id, openAISystemInstruction, textForApi, activeImageFileForOpenAI, activeImagePreviewForOpenAI, currentUploadedTextFileName, currentUploadedTextContent, isRegen, isRegenerationOfAiMsgId);

        const stream = sendOpenAIMessageStream({ modelIdentifier: actualModelIdentifier, history, modelSettings: currentModelSpecificSettingsForApiCall as ModelSettings, userSession: userSession });
        let currentText = '';
        for await (const chunk of stream) {
          if (chunk.error) throw new Error(chunk.error);
          if (chunk.textDelta) currentText += chunk.textDelta;
          setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? { ...msg, text: currentText, isRegenerating: false } : msg));
          if (chunk.isFinished) break;
        }

      } else if (selectedModel === Model.DEEPSEEK && !currentModelStatus.isMock) {
        let deepseekSystemInstruction = DEFAULT_MODEL_SETTINGS.systemInstruction;
        if ('systemInstruction' in currentModelSpecificSettingsForApiCall) {
            deepseekSystemInstruction = (currentModelSpecificSettingsForApiCall as ModelSettings).systemInstruction;
        }
        const history: ApiChatMessage[] = [{ role: 'system', content: deepseekSystemInstruction }];
         messages.filter(m => m.id !== aiMessageId && m.id !== newUserMessage.id).forEach(msg => {
            let msgContent = msg.text || " ";
            if (msg.sender === 'user' && msg.fileName && !msg.imagePreview && !TEXT_READABLE_EXTENSIONS.some(ext => msg.fileName?.toLowerCase().endsWith(ext))) {
                msgContent += `\n(System Note: User previously uploaded a file named '${msg.fileName}'. Its content was not directly available.)`;
            }
            if (msg.sender === 'user') history.push({ role: 'user', content: msgContent });
            else if (msg.sender === 'ai') history.push({ role: 'assistant', content: msgContent });
        });
        let currentTurnTextForDeepseek = textForApi.trim();

        history.push({ role: 'user', content: currentTurnTextForDeepseek || " " });

        const stream = sendDeepseekMessageStream({ modelIdentifier: actualModelIdentifier, history, modelSettings: currentModelSpecificSettingsForApiCall as ModelSettings, userSession: userSession });
        let currentText = '';
        for await (const chunk of stream) {
          if (chunk.error) throw new Error(chunk.error);
          if (chunk.textDelta) currentText += chunk.textDelta;
          setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? { ...msg, text: currentText, isRegenerating: false } : msg));
          if (chunk.isFinished) break;
        }

      } else if (currentModelStatus?.isMock && !isRealTimeTranslationMode && !isAiAgentSmartMode && !isPrivateModeSelected && !getIsFluxKontexModel(selectedModel) && !getIsFluxDevModel(selectedModel) && !getIsKlingVideoModel(selectedModel)) {
        const mockParts: Part[] = [];
        if (textForApi.trim()) mockParts.push({ text: textForApi.trim() });

        if (currentUploadedImageFiles.length > 0 && currentUploadedImagePreviews.length > 0) {
            mockParts.push({ inlineData: { mimeType: currentUploadedImageFiles[0].type as 'image/jpeg' | 'image/png', data: currentUploadedImagePreviews[0].split(',')[1] } });
        }
        const stream = sendMockMessageStream(mockParts, selectedModel, currentModelSpecificSettingsForApiCall as ModelSettings);
        let currentText = '';
        for await (const chunk of stream) {
          currentText += chunk;
          setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? { ...msg, text: currentText, isRegenerating: false } : msg));
        }
      } else if (!isRealTimeTranslationMode && !isPrivateModeSelected && !getIsFluxKontexModel(selectedModel) && !getIsFluxDevModel(selectedModel) && !getIsKlingVideoModel(selectedModel)) {
          throw new Error(`API integration for ${selectedModel} is not implemented or API key/Vertex config is missing and it's not a mock model.`);
      }
    } catch (e: any) {
      console.error("Error sending message:", e);
      const errorMessage = e.message || 'Failed to get response from AI (via proxy).';
      setError(errorMessage);
      addNotification(`API Error: ${errorMessage}`, "error", e.stack);
      const errorAiMessageId = aiMessageId || `error-${Date.now()}`;
      setMessages((prev) => prev.filter(msg => msg.id !== aiMessageId));
      setMessages((prev) => [...prev, {
        id: errorAiMessageId, text: `Error: ${errorMessage}`, sender: 'ai', model: selectedModel, timestamp: Date.now(), promptedByMessageId: userMessageId
      }]);
    }

    if (!(getIsFluxKontexModel(selectedModel) || getIsFluxDevModel(selectedModel) || getIsKlingVideoModel(selectedModel)) ||
        ((getIsFluxKontexModel(selectedModel) || getIsFluxDevModel(selectedModel)) && !messages.find(m => m.id === aiMessageId)?.fluxRequestId) ||
        (getIsKlingVideoModel(selectedModel) && !messages.find(m => m.id === aiMessageId)?.klingVideoRequestId)) {
      setIsLoading(false);
    }


    if (!isRegenerationOfAiMsgId && !isRealTimeTranslationMode && !isPrivateModeSelected) {
        setInput('');
        if (!getIsFluxKontexModel(selectedModel) && !getIsFluxDevModel(selectedModel) && !getIsKlingVideoModel(selectedModel) && !getIsTradingProModel(selectedModel)) { // Don't clear for trading pro image
            setUploadedImages([]);
            setImagePreviews([]);
        }
        if (selectedModel !== Model.AI_AGENT_SMART && selectedModel !== Model.TRADING_PRO) {
            setUploadedTextFileContent(null);
            setUploadedTextFileName(null);
        }
    }
    clearSearch();
  };

  const processTranslationFile = async (file: File) => {
    setIsLoading(true);
    setError(null);

    const isTxt = file.name.toLowerCase().endsWith('.txt');
    const userMessageId = Date.now().toString();
    const aiMessageId = (Date.now() + 1).toString();

    const userMessage: ChatMessage = {
        id: userMessageId,
        text: `(Translating from file: ${file.name})`,
        sender: 'user',
        timestamp: Date.now(),
        fileName: file.name,
    };
    const aiPlaceholder: ChatMessage = {
        id: aiMessageId,
        text: `Processing file "${file.name}"...`,
        sender: 'ai',
        timestamp: Date.now() + 1,
        model: selectedModel,
        promptedByMessageId: userMessageId,
    };
    setMessages(prev => [...prev, userMessage, aiPlaceholder]);

    try {
        let textToTranslate = '';
        if (isTxt) {
            textToTranslate = await file.text();
            setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Translating text from "${file.name}"...`, originalText: textToTranslate } : msg));
        } else { // It's an MP3
            setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Transcribing audio from "${file.name}"...` } : msg));
            const transcriptionResult = await transcribeOpenAIAudio({ audioFile: file, userSession });
            if (transcriptionResult.error || !transcriptionResult.transcription) {
                throw new Error(transcriptionResult.error || "Transcription failed to return text.");
            }
            textToTranslate = transcriptionResult.transcription;
            setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Translating transcribed text...`, originalText: textToTranslate } : msg));
        }
        
        if (!textToTranslate.trim()) throw new Error("File content is empty or could not be read.");

        // Now translate the text
        const targetLanguage = (currentModelSettings as RealTimeTranslationSettings).targetLanguage;
        const targetLangName = TRANSLATION_TARGET_LANGUAGES.find(l => l.code === targetLanguage)?.name || targetLanguage;
        const translationPrompt = `Translate the following text to ${targetLangName}. Output only the translated text directly, without any introductory phrases or explanations: "${textToTranslate}"`;
        const modelIdentifier = getActualModelIdentifier(Model.GEMINI);
        const history: Content[] = [{ role: 'user', parts: [{ text: translationPrompt }] }];
        const stream = sendGeminiMessageStream({ 
            modelName: modelIdentifier, historyContents: history, 
            modelSettings: { temperature: 0.3, topK: 1, topP: 1, systemInstruction: "You are a direct text translator." }, 
            enableGoogleSearch: false, userSession 
        });

        let translatedText = '';
        for await (const chunk of stream) {
            if (chunk.error) throw new Error(`Translation Error: ${chunk.error}`);
            if (chunk.textDelta) {
                translatedText += chunk.textDelta;
                setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, translatedText: translatedText } : msg));
            }
        }
        
        translatedText = translatedText.trim();
        if (!translatedText) throw new Error("Translation resulted in empty text.");

        // Update message with final translation and prepare for TTS
        setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Synthesizing audio for translation...`, translatedText: translatedText } : msg));
        
        // Don't generate audio for demo users in this mode.
        if (userSession.isDemoUser && !userSession.isPaidUser) {
             setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Audio output disabled for demo users.` } : msg));
             addNotification("Voice output for translated files is a Paid User feature.", "info");
             return; // End the process here for demo users
        }

        const openAiTtsModelSettings = allSettings[Model.OPENAI_TTS] as OpenAITtsSettings | undefined;
        const ttsParams: ProxiedOpenAITtsParams = {
            modelIdentifier: openAiTtsModelSettings?.modelIdentifier || 'tts-1', textInput: translatedText,
            voice: 'nova', speed: openAiTtsModelSettings?.speed || 1.0, userSession: userSession,
        };
        const ttsResult = await generateOpenAITTS(ttsParams);
        if (ttsResult.error || !ttsResult.audioBlob) throw new Error(ttsResult.error || `OpenAI TTS Proxy Error`);

        const audioUrl = URL.createObjectURL(ttsResult.audioBlob);
        setMessages(prev => prev.map(msg => msg.id === aiMessageId ? {
            ...msg, text: `Translation complete. Audio is ready.`, audioUrl: audioUrl,
        } : msg));
        handlePlayAudio(audioUrl, aiMessageId);

    } catch(e: any) {
        const errorMessage = e.message || `Failed to process the file: ${file.name}`;
        setError(errorMessage);
        addNotification(errorMessage, "error", e.stack);
        setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Error: ${errorMessage}` } : msg));
    } finally {
        setIsLoading(false);
        clearSearch();
    }
  };

  const handleSendMessage = async () => {
    if (isTextToSpeechModelSelected && uploadedTextFileContent) {
        setIsLoading(true);
        setError(null);
        
        const fileContent = uploadedTextFileContent;
        const fileName = uploadedTextFileName || 'uploaded file';

        const userMessageId = Date.now().toString();
        const aiMessageId = (Date.now() + 1).toString();
        
        const userMessage: ChatMessage = {
            id: userMessageId, text: `(Reading from file: ${fileName})`, sender: 'user',
            timestamp: Date.now(), fileName: fileName,
        };
        const aiPlaceholder: ChatMessage = {
            id: aiMessageId, text: `Translating content from "${fileName}"...`, sender: 'ai',
            timestamp: Date.now() + 1, model: selectedModel, promptedByMessageId: userMessageId,
        };
        setMessages(prev => [...prev, userMessage, aiPlaceholder]);
        
        try {
            const translationPrompt = `Translate the following text into natural, spoken English. Only return the translated text. Do not add any commentary, introductions, or markdown formatting. The output should be ready for a text-to-speech engine.\n\nText to translate:\n\n---\n\n${fileContent}`;
            const modelIdentifier = getActualModelIdentifier(Model.GEMINI);
            const history: Content[] = [{ role: 'user', parts: [{ text: translationPrompt }] }];
            const stream = sendGeminiMessageStream({ 
                modelName: modelIdentifier, historyContents: history, 
                modelSettings: { temperature: 0.3, topK: 32, topP: 0.95, systemInstruction: "You are a direct text translator." }, 
                enableGoogleSearch: false, userSession 
            });

            let translatedText = '';
            for await (const chunk of stream) {
                if (chunk.error) throw new Error(`Translation Error: ${chunk.error}`);
                if (chunk.textDelta) {
                    translatedText += chunk.textDelta;
                    setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Translating... (${translatedText.length} chars)` } : msg));
                }
            }
            
            translatedText = translatedText.trim();
            if (!translatedText) throw new Error("Translation resulted in empty text.");

            setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Synthesizing audio for "${fileName}"...` } : msg));

            const ttsSettings = currentModelSettings as OpenAITtsSettings;
            const ttsParams: ProxiedOpenAITtsParams = {
                modelIdentifier: ttsSettings.modelIdentifier || 'tts-1', textInput: translatedText,
                voice: ttsSettings.voice || 'alloy', speed: ttsSettings.speed || 1.0, userSession: userSession,
            };
            const ttsResult = await generateOpenAITTS(ttsParams);

            if (ttsResult.error || !ttsResult.audioBlob) throw new Error(ttsResult.error || `OpenAI TTS Proxy Error`);
            
            const audioUrl = URL.createObjectURL(ttsResult.audioBlob);
            setMessages(prev => prev.map(msg => msg.id === aiMessageId ? {
                ...msg, text: `Audio generated from file: "${fileName}"`, originalPrompt: `File: ${fileName}`,
                audioUrl: audioUrl, isRegenerating: false
            } : msg));
            handlePlayAudio(audioUrl, aiMessageId);

        } catch(e: any) {
            const errorMessage = e.message || 'Failed to process the text file.';
            setError(errorMessage);
            addNotification(errorMessage, "error", e.stack);
            setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Error processing file: ${errorMessage}` } : msg));
        } finally {
            setIsLoading(false);
            setUploadedTextFileContent(null);
            setUploadedTextFileName(null);
            clearSearch();
        }
        return; 
    }

    if (getIsTradingProModel(selectedModel) || isRealTimeTranslationMode || isListening) return;

    let determinedTtsMaxLength = OPENAI_TTS_MAX_INPUT_LENGTH;
    if (userSession.isDemoUser && !isAdminUser && userSession.demoLimits) {
        determinedTtsMaxLength = userSession.demoLimits.openaiTtsMonthlyMaxChars;
    } else if (userSession.isPaidUser && !isAdminUser && userSession.paidLimits) {
        determinedTtsMaxLength = userSession.paidLimits.openaiTtsMaxChars;
    }

    if ((isImagenModelSelected || getIsFluxDevModel(selectedModel)) && !input.trim()) {
        setError("Please enter a prompt for image generation.");
        addNotification("Please enter a prompt for image generation.", "info");
        return;
    }
    if (getIsFluxKontexModel(selectedModel)) {
        if (uploadedImages.length === 0) {
            setError("Please upload an image to edit.");
            addNotification("Please upload an image for Flux Kontext model.", "info");
            return;
        }
        if (!input.trim()) {
            setError("Please enter a prompt to describe how to edit the image.");
            addNotification("Please enter an editing prompt for Flux Kontext.", "info");
            return;
        }
    }
     if (getIsKlingVideoModel(selectedModel)) {
        if (uploadedImages.length === 0) {
            setError("Please upload an image for video generation.");
            addNotification("Please upload an image for Kling AI video generation.", "info");
            return;
        }
        if (!input.trim()) {
            setError("Please enter a prompt for video generation.");
            addNotification("Please enter a prompt for Kling AI video generation.", "info");
            return;
        }
    }
    if (isTextToSpeechModelSelected && !input.trim() && !uploadedTextFileContent) {
        setError("Please enter text for speech synthesis or upload a .txt file.");
        addNotification("Please enter text for speech synthesis or upload a .txt file.", "info");
        return;
    }
    if (isTextToSpeechModelSelected && input.trim() && !isAdminUser && input.length > determinedTtsMaxLength) {
        setError(`Input for TTS exceeds maximum length of ${determinedTtsMaxLength} characters for your account type.`);
        addNotification(`TTS input too long. Max ${determinedTtsMaxLength} chars.`, "error");
        return;
    }
    if (isAiAgentSmartMode && !input.trim() && uploadedImages.length === 0) {
        setError("Please enter a goal or upload an image for the AI Agent Smart.");
        addNotification("Please enter a goal or upload an image for the AI Agent Smart.", "info");
        return;
    }
     if (isPrivateModeSelected && !input.trim() && uploadedImages.length === 0 && !uploadedTextFileName) {
        setError("Please enter text, or upload an image/file to log in Private Mode.");
        addNotification("Please enter text, or upload an image/file to log in Private Mode.", "info");
        return;
    }
    if (!isImagenModelSelected && !isTextToSpeechModelSelected && !isAiAgentSmartMode && !isPrivateModeSelected && !getIsFluxKontexModel(selectedModel) && !getIsFluxDevModel(selectedModel) && !getIsKlingVideoModel(selectedModel) && !input.trim() && uploadedImages.length === 0 && !uploadedTextFileName) {
        return;
    }

    setIsLoading(true);
    setError(null);

    await internalSendMessage(input, uploadedImages, imagePreviews, uploadedTextFileContent, uploadedTextFileName);
  };

  const handleRegenerateResponse = async (aiMessageIdToRegenerate: string, promptedByMsgId: string) => {
      if (getIsTradingProModel(selectedModel) || isRealTimeTranslationMode || isAiAgentSmartMode || isPrivateModeSelected || getIsFluxKontexModel(selectedModel) || getIsFluxDevModel(selectedModel) || getIsKlingVideoModel(selectedModel)) return;
      const userMessageForRegen = messages.find(m => m.id === promptedByMsgId && m.sender === 'user');
      const aiMessageToRegen = messages.find(m => m.id === aiMessageIdToRegenerate && m.sender === 'ai');

      if (!userMessageForRegen) {
          setError("Could not find the original user message to regenerate response.");
          addNotification("Error: Original user message not found for regeneration.", "error");
          return;
      }
      if (!aiMessageToRegen) {
          setError("Could not find the AI message to regenerate.");
          addNotification("Error: AI message not found for regeneration.", "error");
          return;
      }

      setIsLoading(true);
      setError(null);

      const regenInputText = userMessageForRegen.text;
      const regenUploadedImagePreviews = userMessageForRegen.imagePreview ? [userMessageForRegen.imagePreview] : (userMessageForRegen.imagePreviews || []);

      const regenUploadedImageFiles: File[] = [];

      let currentRegenUploadedTextContent: string | null = null;
      let currentRegenUploadedTextFileName: string | null = userMessageForRegen.fileName ? userMessageForRegen.fileName : null;


      setMessages(prev => prev.map(msg => {
          if (msg.id === aiMessageIdToRegenerate) {
              let regeneratingText = 'Regenerating...';
              if (msg.model === Model.IMAGEN3 || msg.model === Model.FLUX_ULTRA) regeneratingText = 'Regenerating image(s)...';
              if (msg.model === Model.OPENAI_TTS) regeneratingText = 'Resynthesizing audio...';

              return {
                  ...msg, text: regeneratingText, imagePreviews: undefined, groundingSources: undefined, audioUrl: undefined, isRegenerating: true,
              };
          }
          return msg;
      }));

      await internalSendMessage(
          regenInputText, regenUploadedImageFiles, regenUploadedImagePreviews, currentRegenUploadedTextContent, currentRegenUploadedTextFileName, aiMessageIdToRegenerate
      );
  };

  const imageUploadLimit = useMemo(() => {
    if (selectedModel === Model.FLUX_KONTEX_MAX_MULTI) return 4;
    if (
        getIsKlingVideoModel(selectedModel) ||
        selectedModel === Model.FLUX_KONTEX ||
        selectedModel === Model.GEMINI ||
        selectedModel === Model.GPT4O ||
        selectedModel === Model.GPT4O_MINI ||
        selectedModel === Model.PRIVATE ||
        selectedModel === Model.AI_AGENT_SMART ||
        selectedModel === Model.TRADING_PRO // Added TRADING_PRO here
    ) return 1;
    // Models that explicitly do not support image uploads or have different handling
    if (selectedModel === Model.DEEPSEEK || getIsFluxDevModel(selectedModel) || isTextToSpeechModelSelected || isRealTimeTranslationMode || isImagenModelSelected || isClaudeModelSelected) return 0;
    return 0; // Default to 0 for any other unhandled model
  }, [selectedModel, isTextToSpeechModelSelected, isRealTimeTranslationMode, isImagenModelSelected, isClaudeModelSelected]);


  const handleSetUploadedImages = (newFiles: File[]) => {
    if (isTextToSpeechModelSelected || isRealTimeTranslationMode || isPrivateModeSelected ) { // Simplified, Kling and Trading Pro handled below
        return;
    }
    
    if (getIsKlingVideoModel(selectedModel) || getIsTradingProModel(selectedModel)) {
        if (newFiles.length > 0) {
            const firstFile = newFiles[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64Preview = reader.result as string;
                if (getIsKlingVideoModel(selectedModel)) {
                    setUploadedImages([firstFile]); // Still store the file for Kling
                    setImagePreviews([base64Preview]); // Generic preview
                } else if (getIsTradingProModel(selectedModel)) {
                    setTradingProState(prev => ({...prev, chartImageUrl: base64Preview, uploadedImageValidationError: null}));
                     // For Trading Pro, we don't use the general `uploadedImages` or `imagePreviews` state
                    setUploadedImages([]);
                    setImagePreviews([]);
                }
            };
            reader.onerror = (error) => {
                console.error("Error reading image file for preview:", error);
                addNotification("Error creating image preview.", "error");
                if (getIsKlingVideoModel(selectedModel)) setImagePreviews([]);
                else if (getIsTradingProModel(selectedModel)) setTradingProState(prev => ({...prev, chartImageUrl: null}));
            };
            reader.readAsDataURL(firstFile);
            setUploadedTextFileContent(null);
            setUploadedTextFileName(null);
        } else {
            if (getIsKlingVideoModel(selectedModel)) {
                 setUploadedImages([]);
                 setImagePreviews([]);
            } else if (getIsTradingProModel(selectedModel)) {
                 setTradingProState(prev => ({...prev, chartImageUrl: null}));
            }
        }
        clearSearch();
        return;
    }


    let currentFiles: File[] = [];

    if (selectedModel === Model.FLUX_KONTEX_MAX_MULTI) {
      const combinedFiles = [...uploadedImages, ...newFiles];
      currentFiles = combinedFiles.slice(0, imageUploadLimit);

      if (combinedFiles.length > imageUploadLimit) {
        addNotification(`Cannot upload more than ${imageUploadLimit} images for Flux Kontext Max. Only the first ${imageUploadLimit} were kept.`, "warning");
      }
    } else { // For models that take a single general image (Gemini, GPT, AAS, Flux Kontext Pro)
      currentFiles = newFiles.slice(0, 1);
    }

    setUploadedImages(currentFiles);
    if (currentFiles.length > 0) {
        setUploadedTextFileContent(null);
        setUploadedTextFileName(null);
    }

    if (currentFiles.length > 0) {
      const filePromises = currentFiles.map(file => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });

      Promise.all(filePromises)
        .then(newPreviewsArray => {
          setImagePreviews(newPreviewsArray);
          if (selectedModel === Model.AI_AGENT_SMART && newPreviewsArray.length > 0) { // If AAS and image uploaded, clear validation error
              setTradingProState(prev => ({...prev, uploadedImageValidationError: null})); // Assuming AAS uses TradingProState for this, need to check types.ts
          }
        })
        .catch(error => {
          console.error("Error reading image files for preview:", error);
          addNotification("Error creating image previews.", "error");
          setImagePreviews([]);
        });
    } else {
      setImagePreviews([]);
    }

    clearSearch();
  };


  const handleFileUpload = (file: File | null) => {
    if (isTextToSpeechModelSelected) {
        setUploadedImages([]);
        setImagePreviews([]);
        if (file) {
            if (!file.name.toLowerCase().endsWith('.txt')) {
                addNotification("Invalid file type for TTS model. Please upload a .txt file.", "error");
                setUploadedTextFileContent(null);
                setUploadedTextFileName(null);
                return;
            }
            if (file.size > MAX_TTS_FILE_UPLOAD_SIZE_BYTES) {
                addNotification(`File is too large. Max size for TTS is ${MAX_TTS_FILE_UPLOAD_SIZE_BYTES / 1024} KB.`, "error");
                setUploadedTextFileContent(null);
                setUploadedTextFileName(null);
                return;
            }
            setUploadedTextFileName(file.name);
            setError(null);
            const reader = new FileReader();
            reader.onload = (e) => { setUploadedTextFileContent(e.target?.result as string); };
            reader.onerror = () => {
              setError(`Error reading the file: ${file.name}`);
              addNotification(`Error reading file: ${file.name}`, "error", (reader.error as Error).message);
              setUploadedTextFileContent(null); setUploadedTextFileName(null);
            }
            reader.readAsText(file);
        } else {
            setUploadedTextFileContent(null);
            setUploadedTextFileName(null);
        }
        clearSearch();
        return;
    }
    if (isRealTimeTranslationMode) {
        setUploadedImages([]);
        setImagePreviews([]);
        if (file) {
            const fileNameLower = file.name.toLowerCase();
            const isTxt = fileNameLower.endsWith('.txt');
            const isMp3 = fileNameLower.endsWith('.mp3');

            if (!isTxt && !isMp3) {
                addNotification("Invalid file type. Please upload a .txt or .mp3 file for translation.", "error");
                return;
            }
            if (isTxt && file.size > MAX_TRANSLATION_TXT_UPLOAD_SIZE_BYTES) {
                addNotification(`Text file is too large. Max size is ${MAX_TRANSLATION_TXT_UPLOAD_SIZE_BYTES / 1024} KB.`, "error");
                return;
            }
            if (isMp3 && file.size > MAX_TRANSLATION_MP3_UPLOAD_SIZE_BYTES) {
                addNotification(`Audio file is too large. Max size is ${MAX_TRANSLATION_MP3_UPLOAD_SIZE_BYTES / 1024 / 1024} MB.`, "error");
                return;
            }
            processTranslationFile(file);
        }
        clearSearch();
        return;
    }
    if (isAiAgentSmartMode || getIsTradingProModel(selectedModel)) { 
        addNotification(`This model only supports direct image uploads.`, "info");
        return;
    }
    if (isImagenModelSelected || getIsFluxKontexModel(selectedModel) || isClaudeModelSelected || getIsFluxDevModel(selectedModel) || getIsKlingVideoModel(selectedModel)) return;

    setUploadedImages([]);
    setImagePreviews([]);

    if (file) {
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      setUploadedTextFileName(file.name);
      setError(null);

      if (TEXT_READABLE_EXTENSIONS.includes(fileExtension)) {
        const reader = new FileReader();
        reader.onload = (e) => { setUploadedTextFileContent(e.target?.result as string); };
        reader.onerror = () => {
          setError(`Error reading the file: ${file.name}`);
          addNotification(`Error reading file: ${file.name}`, "error", (reader.error as Error).message);
          setUploadedTextFileContent(null); setUploadedTextFileName(null);
        }
        reader.readAsText(file);
      } else {
        setUploadedTextFileContent(null);
        if (isPrivateModeSelected) { 
            addNotification(`File "${file.name}" logged. Content not displayed for this type.`, "info");
        } else {
            addNotification(`File "${file.name}" content cannot be displayed/embedded. This model might not process it.`, "warning" as NotificationType);
        }
      }
    } else { setUploadedTextFileContent(null); setUploadedTextFileName(null); }
    clearSearch();
  };

  const handleRemoveUploadedImage = (indexToRemove: number) => {
    if (getIsTradingProModel(selectedModel)) {
        setTradingProState(prev => ({...prev, chartImageUrl: null, uploadedImageValidationError: null}));
    } else {
        setUploadedImages(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
        setImagePreviews(prevPreviews => prevPreviews.filter((_, index) => index !== indexToRemove));
    }
  };

  const handleRemoveTextFilePreview = () => {
    handleFileUpload(null);
  };

  const executeSearch = useCallback(() => {
    if (!tempSearchQuery.trim()) {
      clearSearch();
      return;
    }
    setSearchQuery(tempSearchQuery);
    const query = tempSearchQuery.toLowerCase();
    const results: SearchResult[] = [];
    messages.forEach(msg => {
      if (msg.text && msg.text.toLowerCase().includes(query)) {
        results.push({ messageId: msg.id });
      }
    });
    setSearchResults(results);
    setCurrentSearchResultIndex(results.length > 0 ? 0 : -1);
    setIsSearchActive(true);
    if (results.length > 0) {
      addNotification(`${results.length} match(es) found for "${tempSearchQuery}".`, "info");
    } else {
      addNotification(`No matches found for "${tempSearchQuery}".`, "info");
    }
  }, [tempSearchQuery, messages, addNotification, clearSearch]);

  const navigateSearchResults = useCallback((direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;
    let newIndex = currentSearchResultIndex;
    if (direction === 'next') {
      newIndex = (currentSearchResultIndex + 1) % searchResults.length;
    } else {
      newIndex = (currentSearchResultIndex - 1 + searchResults.length) % searchResults.length;
    }
    setCurrentSearchResultIndex(newIndex);
  }, [searchResults, currentSearchResultIndex]);

  useEffect(() => {
    if (isSearchActive && currentSearchResultIndex !== -1 && searchResults[currentSearchResultIndex]) {
      const messageId = searchResults[currentSearchResultIndex].messageId;
      const element = messageRefs.current[messageId];
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentSearchResultIndex, searchResults, isSearchActive]);

  const handleScroll = useCallback(() => {
    const chatDiv = chatContainerRef.current;
    if (chatDiv) {
      const { scrollTop, scrollHeight, clientHeight } = chatDiv;
      const showButtonThreshold = 100; // Increased threshold for visibility
      const scrolledUpEnough = (scrollHeight - scrollTop - clientHeight) > showButtonThreshold;
      setShowScrollToBottomButton(scrolledUpEnough && scrollHeight > clientHeight);
    }
  }, []);

  useEffect(() => {
    const chatDiv = chatContainerRef.current;
    if (chatDiv) {
      chatDiv.addEventListener('scroll', handleScroll);
      return () => chatDiv.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const scrollToBottomUiButton = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollToBottomButton(false);
  }, []);

  const sidebarContent = (
    <>
        <div className="flex border-b border-secondary dark:border-neutral-darkest mb-4">
            <button onClick={() => setActiveSidebarTab('settings')} disabled={isLoading && !isRealTimeTranslationMode && !getIsTradingProModel(selectedModel) }
                className={`flex-1 py-2 px-4 text-sm font-medium text-center rounded-t-lg focus:outline-none flex items-center justify-center ${activeSidebarTab === 'settings' ? 'bg-primary text-white dark:bg-primary-light dark:text-neutral-darker' : 'text-neutral-600 dark:text-neutral-300 hover:bg-secondary/50 dark:hover:bg-neutral-dark/50'}`}
                aria-pressed={activeSidebarTab === 'settings'} >
                <CogIcon className="w-5 h-5 mr-2"/> Settings
            </button>
            <button onClick={() => setActiveSidebarTab('history')} disabled={isLoading && !isRealTimeTranslationMode && !getIsTradingProModel(selectedModel) }
                className={`flex-1 py-2 px-4 text-sm font-medium text-center rounded-t-lg focus:outline-none flex items-center justify-center ${activeSidebarTab === 'history' ? 'bg-primary text-white dark:bg-primary-light dark:text-neutral-darker' : 'text-neutral-600 dark:text-neutral-300 hover:bg-secondary/50 dark:hover:bg-neutral-dark/50'}`}
                aria-pressed={activeSidebarTab === 'history'} >
                <HistoryIcon className="w-5 h-5 mr-2"/> History
            </button>
        </div>
        {activeSidebarTab === 'settings' && (
            <SettingsPanel
                selectedModel={selectedModel}
                onModelChange={handleModelSelection}
                modelSettings={currentModelSettings}
                onModelSettingsChange={handleModelSettingsChange}
                isWebSearchEnabled={isWebSearchEnabled}
                onWebSearchToggle={setIsWebSearchEnabled}
                disabled={(isLoading && !isRealTimeTranslationMode && !getIsTradingProModel(selectedModel) ) || isGpt41AccessModalOpen}
                apiKeyStatuses={apiKeyStatuses}
                personas={personas}
                activePersonaId={activePersonaId}
                onPersonaChange={handlePersonaChange}
                onPersonaSave={handlePersonaSave}
                onPersonaDelete={handlePersonaDelete}
                userSession={userSession}
            />
        )}
        {activeSidebarTab === 'history' && (
            <HistoryPanel
                savedSessions={savedSessions}
                activeSessionId={activeSessionId}
                onLoadSession={handleLoadSession}
                onDeleteSession={handleDeleteSession}
                onRenameSession={handleRenameSession}
                onSaveCurrentChat={handleSaveCurrentChat}
                onStartNewChat={handleStartNewChat}
                isLoading={(isLoading && !isRealTimeTranslationMode && !getIsTradingProModel(selectedModel) ) || isGpt41AccessModalOpen}
                onTogglePinSession={handleTogglePinSession}
                onSaveChatToDevice={handleSaveChatToDevice}
                onLoadChatFromDevice={handleLoadChatFromDevice}
                onExportChatWithMediaData={() => {
                    addNotification("Export Chat with Media Data feature is not yet implemented.", "info");
                }}
            />
        )}
    </>
  );

  const calculateTextareaRows = () => {
    const baseLines = input.split('\n').length;
    const endsWithNewlineAdjustment = input.endsWith('\n') ? 1 : 0;
    return Math.min(5, baseLines + endsWithNewlineAdjustment);
  };

  const showMicrophoneButton = useMemo(() => {
    if (!isSpeechRecognitionSupported) return false;
    if (isTextToSpeechModelSelected || isImagenModelSelected || isClaudeModelSelected || getIsFluxDevModel(selectedModel) || getIsKlingVideoModel(selectedModel) || getIsTradingProModel(selectedModel)) return false;
    return true;
  }, [isSpeechRecognitionSupported, selectedModel, isTextToSpeechModelSelected, isImagenModelSelected, isClaudeModelSelected]);

  const showImageUploadInChatBar = useMemo(() => {
    // This button shows for any model that primarily consumes an image.
    return (
        getIsFluxKontexModel(selectedModel) ||
        getIsKlingVideoModel(selectedModel) ||
        getIsTradingProModel(selectedModel) ||
        // General purpose models that support vision
        selectedModel === Model.GEMINI ||
        selectedModel === Model.GEMINI_ADVANCED ||
        selectedModel === Model.GPT4O ||
        selectedModel === Model.GPT4O_MINI ||
        selectedModel === Model.AI_AGENT_SMART ||
        selectedModel === Model.PRIVATE
    );
  }, [selectedModel]);

  const showFileUploadInChatBar = useMemo(() => {
    // This button shows for models that take non-image files, or are text-only.
    // It should NOT appear if the image button is already shown.
    if (showImageUploadInChatBar) {
        return false;
    }
    return (
        selectedModel === Model.OPENAI_TTS ||
        selectedModel === Model.REAL_TIME_TRANSLATION ||
        selectedModel === Model.DEEPSEEK ||
        selectedModel === Model.CLAUDE
    );
  }, [selectedModel, showImageUploadInChatBar]);


  const currentPromptPlaceholder = () => {
    if (isListening && !isRealTimeTranslationMode) return "Đang nghe...";
    if (isImagenModelSelected) return "Enter prompt for image generation...";
    if (getIsFluxKontexModel(selectedModel)) return "Enter prompt to edit uploaded image...";
    if (getIsFluxDevModel(selectedModel)) return "Enter prompt for Flux Dev image generation...";
    if (getIsKlingVideoModel(selectedModel)) return "Enter prompt for video generation (image required)...";
    if (isTextToSpeechModelSelected) return "Type text to synthesize, or upload a .txt file...";
    if (isRealTimeTranslationMode) return "Real-Time Translation Active. Use Microphone or upload file.";
    if (isAiAgentSmartMode) return "Enter goal for AI Agent Smart, or upload image...";
    if (isPrivateModeSelected) return "Enter text or upload image/file to log locally...";
    if (isClaudeModelSelected) return "Chat with Claude (Mock)...";
    if (getIsTradingProModel(selectedModel)) return "Upload chart (optional) & click Analyze Market.";


    let placeholder = "Type your message";
    
    const canUploadImage = showImageUploadInChatBar || getIsKlingVideoModel(selectedModel) || isAiAgentSmartMode || getIsTradingProModel(selectedModel);
    const canUploadFile = showFileUploadInChatBar; 

    if (uploadedImages.length === 0 && imagePreviews.length === 0 && !uploadedTextFileName && !tradingProState.chartImageUrl) {
        if (canUploadImage && canUploadFile) { 
            placeholder += " or upload image/file";
        } else if (canUploadImage) { 
            placeholder += " or upload image";
        } else if (canUploadFile) { 
            placeholder += " or upload file";
        }
    }
    placeholder += "...";
    return placeholder;
  }

  const sendButtonLabel = () => {
    if (isImagenModelSelected || getIsFluxDevModel(selectedModel)) return "Generate Image";
    if (getIsKlingVideoModel(selectedModel)) return "Generate Video";
    if (getIsFluxKontexModel(selectedModel)) return "Edit Image";
    if (isTextToSpeechModelSelected) return "Synthesize Speech";
    if (isAiAgentSmartMode) return "Set Goal";
    if (isPrivateModeSelected) return "Log Entry";
    if (getIsTradingProModel(selectedModel)) return "Analyze Market";
    return "Send message";
  }

  const sendButtonIcon = () => {
    if (isImagenModelSelected || getIsFluxDevModel(selectedModel)) return <PromptIcon className="w-6 h-6" />;
    if (getIsKlingVideoModel(selectedModel)) return <FilmIcon className="w-6 h-6" />;
    if (getIsFluxKontexModel(selectedModel)) return <EditIcon className="w-6 h-6" />;
    if (isTextToSpeechModelSelected) return <SpeakerWaveIcon className="w-6 h-6" />;
    if (getIsTradingProModel(selectedModel)) return <PresentationChartLineIcon className="w-6 h-6" />;
    if (isAiAgentSmartMode || isPrivateModeSelected) return <PaperAirplaneIcon className="w-6 h-6" />;
    return <PaperAirplaneIcon className="w-6 h-6" />;
  }

  const targetTranslationLangName = useMemo(() => {
    if (isRealTimeTranslationMode) {
      const targetCode = (currentModelSettings as RealTimeTranslationSettings).targetLanguage || 'en';
      return TRANSLATION_TARGET_LANGUAGES.find(l => l.code === targetCode)?.name || targetCode;
    }
    return '';
  }, [isRealTimeTranslationMode, currentModelSettings]);


  const handleGpt41AccessModalClose = (switchToMini: boolean, notificationMessage?: string) => {
    setIsGpt41AccessModalOpen(false);
    setGpt41AccessCodeInput('');
    if (switchToMini) {
        setSelectedModel(Model.GPT4O_MINI);
        if (notificationMessage) addNotification(notificationMessage, "info");
    }
  };

  const handleGpt41CodeSubmit = () => {
    if (gpt41AccessCodeInput === 'bin') {
        setIsGpt41Unlocked(true);
        addNotification("Access to gpt-4.1 granted for this session!", "success");
        handleGpt41AccessModalClose(false);
    } else {
        addNotification("Incorrect secret code. Switching to gpt-4.1-mini.", "error");
        handleGpt41AccessModalClose(true);
    }
  };

  const chatAreaStyle: React.CSSProperties = useMemo(() => {
    if (chatBackgroundUrl) {
        return {
            backgroundImage: `url(${chatBackgroundUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
        };
    }
    const currentTheme = themeContext?.theme || 'light';
    return { backgroundColor: currentTheme === 'dark' ? '#0e1621' : '#ffffff' };
  }, [chatBackgroundUrl, themeContext?.theme]);


   const messagesToGeminiHistory = (
    allMessages: ChatMessage[],
    currentAiMessageId: string | null,
    currentUserMessageId: string | null,
    isAgentSmartMode: boolean
  ): Content[] => {
    const history: Content[] = [];

    allMessages.forEach(msg => {
        if (msg.id === currentAiMessageId || (msg.isNote && !isAgentSmartMode)) return;
        if (msg.isTaskPlan && !isAgentSmartMode) return;


        let role: 'user' | 'model' = 'user';
        if (msg.sender === 'ai') role = 'model';

        const parts: Part[] = [];
        if (msg.text) {
            let textForHistory = msg.text;
            if (isAgentSmartMode) {
                if (msg.isTaskGoal && msg.sender === 'user') textForHistory = `User's goal: ${msg.text}`;
                else if (msg.isTaskPlan && msg.sender === 'ai') textForHistory = `AI Agent Smart's plan/response: ${msg.text}`;
            }
            parts.push({ text: textForHistory });
        }

        if (msg.sender === 'user' && msg.imagePreview && !msg.isImageQuery && !msg.isVideoQuery && (!msg.imagePreviews || msg.imagePreviews.length === 0)) {
            try {
                const base64Data = msg.imagePreview.split(',')[1];
                const mimeTypeMatch = msg.imagePreview.match(/data:(image\/[a-zA-Z0-9-.+]+);base64/);
                if (base64Data && mimeTypeMatch && mimeTypeMatch[1]) {
                    parts.push({ inlineData: { mimeType: mimeTypeMatch[1], data: base64Data } });
                }
            } catch (e) { console.error("Error processing image for Gemini history:", e); }
        }

        if (parts.length > 0) {
            history.push({ role, parts });
        }
    });

    return history;
  };

  const messagesToOpenAIHistory = (
    allMessages: ChatMessage[],
    currentAiMessageId: string | null,
    currentUserMessageId: string | null,
    systemInstructionText: string, 
    currentInputTextForApi: string,
    currentActiveImageFile: File | null,
    currentActiveImagePreview: string | null,
    currentUploadedTextFileNameForOpenAI: string | null, 
    currentUploadedTextContentForOpenAI: string | null, 
    isRegeneration: boolean,
    isRegenerationOfAiMsgId?: string
  ): ApiChatMessage[] => {
    const history: ApiChatMessage[] = [{ role: 'system', content: systemInstructionText }];

    allMessages.forEach(msg => {
        if (msg.id === currentAiMessageId || msg.isNote) return;
        if (!isRegeneration && msg.id === currentUserMessageId) return;


        let role: 'user' | 'assistant';
        if (msg.sender === 'ai') {
            role = 'assistant';
        } else {
            role = 'user';
        }

        let apiMessageContent: ApiChatMessage['content'];

        const messageParts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail?: "auto" | "low" | "high" } }> = [];

        if (msg.text) {
            let textForHistory = msg.text;
            if (role === 'user' && msg.fileName && !TEXT_READABLE_EXTENSIONS.some(ext => msg.fileName?.toLowerCase().endsWith(ext)) && !msg.imagePreview) {
                textForHistory += `\n(System Note: User previously uploaded a file named '${msg.fileName}'. Its content was not directly available.)`;
            }
            messageParts.push({ type: 'text', text: textForHistory });
        }

        if (role === 'user' && msg.imagePreview && !msg.isImageQuery && !msg.isVideoQuery) {
            messageParts.push({ type: 'image_url', image_url: { url: msg.imagePreview, detail: "auto" } });
        }

        if (messageParts.length > 0) {
            apiMessageContent = messageParts.length === 1 && messageParts[0].type === 'text' ? messageParts[0].text : messageParts;
            history.push({ role, content: apiMessageContent });
        } else if (role === 'assistant' && !msg.text) {
             history.push({ role, content: " "});
        }
    });

    if (!isRegeneration) {
        const currentTurnContentParts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail?: "auto" | "low" | "high" } }> = [];
        let textForCurrentTurn = currentInputTextForApi.trim();

        if (currentUploadedTextFileNameForOpenAI) {
            if (currentUploadedTextContentForOpenAI) {
                textForCurrentTurn = `The user has uploaded a file named "${currentUploadedTextFileNameForOpenAI}".\nThe content of this file is:\n${currentUploadedTextContentForOpenAI}\n\n---\n\n${textForCurrentTurn}`;
            } else if (!currentActiveImageFile) { 
                textForCurrentTurn = `${textForCurrentTurn}\n\n(System Note: User uploaded a file named '${currentUploadedTextFileNameForOpenAI}'. Its content is not directly available to you.)`;
            }
        }


        if (textForCurrentTurn) {
            currentTurnContentParts.push({ type: 'text', text: textForCurrentTurn });
        }
        if (currentActiveImagePreview && currentActiveImageFile) {
            currentTurnContentParts.push({ type: 'image_url', image_url: { url: currentActiveImagePreview, detail: "auto" } });
        }

        if (currentTurnContentParts.length > 0) {
            history.push({ role: 'user', content: currentTurnContentParts.length === 1 && currentTurnContentParts[0].type === 'text' ? currentTurnContentParts[0].text : currentTurnContentParts });
        } else if (history.length === 1 && !isRegeneration) {
            // Avoid sending empty user message if history only has system prompt and no user input/image
        }
    }

    return history;
  };

  const imageFileAcceptTypes = "image/jpeg, image/png, image/webp, image/gif, image/avif";
  const generalFileAcceptTypes = ".txt,.md,.json,.js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.h,.hpp,.cs,.go,.rs,.rb,.php,.html,.htm,.css,.scss,.less,.xml,.yaml,.yml,.ini,.sh,.bat,.ps1,.sql,.csv,.log,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation";
  const ttsFileAcceptTypes = ".txt";
  const translationFileAcceptTypes = ".txt,.mp3,audio/mpeg";

  const generalChatBarInteractionDisabled = (isLoading && !isRealTimeTranslationMode && !getIsTradingProModel(selectedModel)) || isListening || (isGpt41AccessModalOpen && selectedModel === Model.GPT4O);
  const microphoneButtonDisabled =
    !isSpeechRecognitionSupported ||
    (!isListening && (
      (isLoading && !isRealTimeTranslationMode && !getIsTradingProModel(selectedModel)) ||
      (isGpt41AccessModalOpen && selectedModel === Model.GPT4O)
    ));

  const handleChatBarImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFilesArray = Array.from(files);
      handleSetUploadedImages(newFilesArray);
    }
    event.target.value = '';
  };

  const handleChatBarGeneralFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    handleFileUpload(file || null);
    event.target.value = '';
  };

  const showGenericAttachmentPreview = useMemo(() => {
    if (getIsKlingVideoModel(selectedModel) && imagePreviews.length > 0) {
        return true;
    }
    if (isTextToSpeechModelSelected || isRealTimeTranslationMode || isImagenModelSelected || isClaudeModelSelected || getIsFluxDevModel(selectedModel) || getIsTradingProModel(selectedModel)) {
        return false;
    }
    if (imagePreviews.length > 0 || uploadedTextFileName) {
        return true;
    }
    return false;
  }, [imagePreviews, uploadedTextFileName, isTextToSpeechModelSelected, isRealTimeTranslationMode, isImagenModelSelected, isClaudeModelSelected, selectedModel]);

  // `fetchTradingChartData` removed as Trading Pro no longer fetches chart data via Alpha Vantage

  // fetchChartData alias removed

  const handleTradingAnalysis = useCallback(async (pair: TradingPair, chartImageBase64: string | null) => {
    setTradingProState(prev => ({ ...prev, isLoadingAnalysis: true, analysisError: null, analysisText: null, trendPredictions: null, groundingSources: undefined, uploadedImageValidationError: null }));

    try {
      const response = await fetch('/api/gemini/trading-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userSession.isPaidUser && userSession.paidUserToken && { 'X-Paid-User-Token': userSession.paidUserToken }),
          ...(userSession.isDemoUser && userSession.demoUserToken && { 'X-Demo-Token': userSession.demoUserToken }),
        },
        body: JSON.stringify({
          chartImageBase64: chartImageBase64 ? chartImageBase64.split(',')[1] : null,
          pairLabel: pair.label,
          demoTradingProAccessGranted: userSession.isDemoUser ? demoTradingProAccessGranted : undefined, // Pass flag for demo users
        }),
      });
      const result: GeminiTradingAnalysisResponse & { error?: string } = await response.json(); // Ensure result can have an error field

      if (result.error === "IMAGE_INVALID_TRADING_CHART") {
        addNotification("Ảnh không hợp lệ. Phân tích sẽ dựa trên dữ liệu web.", "warning");
        setTradingProState(prev => ({
          ...prev,
          isLoadingAnalysis: false,
          analysisText: result.analysisText || "Phân tích dựa trên dữ liệu web do ảnh không hợp lệ.",
          trendPredictions: result.trendPredictions || null,
          groundingSources: result.groundingSources || [],
          analysisError: null,
          uploadedImageValidationError: "ảnh không hợp lệ",
          chartImageUrl: null, // Clear the invalid image
        }));
      } else if (result.error) {
        throw new Error(result.error);
      } else if (!result.analysisText && !result.trendPredictions) {
        throw new Error("No analysis data returned from proxy.");
      } else {
        setTradingProState(prev => ({
          ...prev,
          isLoadingAnalysis: false,
          analysisText: result.analysisText || "Analysis text not available.",
          trendPredictions: result.trendPredictions || null,
          groundingSources: result.groundingSources || [],
          analysisError: null,
          uploadedImageValidationError: null, // Clear any previous validation error
        }));
      }

    } catch (error: any) {
      console.error("[ChatPage] Error performing trading analysis:", error);
      addNotification(`Trading Analysis Error: ${error.message}`, "error");
      setTradingProState(prev => ({ ...prev, isLoadingAnalysis: false, analysisText: null, trendPredictions: null, analysisError: `Trading Analysis Error: ${error.message}`, uploadedImageValidationError: null }));
    }
  }, [addNotification, userSession, demoTradingProAccessGranted]);


  const onAnalyzeTradingProClick = async () => {
    const typedTradingSettings = currentModelSettings as TradingProSettings;
    const currentSelectedPairObject = TRADING_PRO_PAIRS.find(p => p.value === typedTradingSettings.selectedPair);

    if (!currentSelectedPairObject) {
      setTradingProState(prev => ({ ...prev, analysisError: "Please select a trading pair first." }));
      addNotification("Please select a trading pair first.", "info");
      return;
    }
    if (!tradingProState.disclaimerAgreed) {
      addNotification("Please agree to the disclaimer in the Trading Pro view first.", "info");
      return;
    }
    if (tradingProState.isLoadingAnalysis) {
        return;
    }
    
    // User-uploaded image is in tradingProState.chartImageUrl
    const userUploadedImageBase64 = tradingProState.chartImageUrl;

    setTradingProState(prev => ({
      ...prev,
      isLoadingAnalysis: true,
      analysisError: null,
      analysisText: null,
      trendPredictions: null,
      groundingSources: undefined,
      uploadedImageValidationError: null, // Clear previous validation error on new analysis
    }));
    await handleTradingAnalysis(currentSelectedPairObject, userUploadedImageBase64);
  };

  const isAnalyzeButtonDisabled = useMemo(() => {
    if (selectedModel !== Model.TRADING_PRO) return true; // Button is only for Trading Pro mode send
    const typedTradingSettings = currentModelSettings as TradingProSettings;
    return !typedTradingSettings.selectedPair ||
           !tradingProState.disclaimerAgreed ||
           tradingProState.isLoadingAnalysis;
  }, [selectedModel, currentModelSettings, tradingProState.disclaimerAgreed, tradingProState.isLoadingAnalysis]);


  return (
    <div className="h-full flex flex-col relative">
       {isTradingProCodeModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100] p-4" onClick={handleTradingProCodeModalClose}>
            <div className="bg-neutral-light dark:bg-neutral-darker p-6 rounded-lg shadow-xl w-full max-w-md text-center" onClick={(e) => e.stopPropagation()}>
                <KeyIcon className="w-12 h-12 text-primary dark:text-primary-light mx-auto mb-4"/>
                <h3 className="text-xl font-semibold text-neutral-darker dark:text-secondary-light mb-3">Trading Pro Access</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                    Please enter your Trading Access Code to use this feature.
                </p>
                <input
                    type="password"
                    value={tradingProAccessCodeInput}
                    onChange={(e) => setTradingProAccessCodeInput(e.target.value)}
                    onKeyPress={(e) => { if (e.key === 'Enter') handleTradingProCodeModalSubmit(); }}
                    placeholder="Access Code"
                    className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none mb-2"
                    autoFocus
                    disabled={isTradingProCodeLoading}
                />
                {tradingProCodeError && <p className="text-red-500 dark:text-red-400 text-xs mb-3">{tradingProCodeError}</p>}
                <div className="flex justify-center space-x-3">
                    <button onClick={handleTradingProCodeModalSubmit} disabled={isTradingProCodeLoading} className="px-5 py-2 bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50">
                        {isTradingProCodeLoading ? 'Verifying...' : 'Submit Code'}
                    </button>
                    <button onClick={handleTradingProCodeModalClose} disabled={isTradingProCodeLoading} className="px-4 py-2 bg-secondary dark:bg-neutral-darkest text-neutral-darker dark:text-secondary-light rounded-md">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
      )}
      {userSession.isPaidUser && userSession.paidSubscriptionEndDate && (
        <div className="bg-green-600 text-white text-xs text-center py-0.5 px-2 sticky top-0 z-40">
          Paid User: {userSession.paidUsername} | Subscription ends: {new Date(userSession.paidSubscriptionEndDate).toLocaleDateString()}
        </div>
      )}
      <div className="flex-grow flex overflow-hidden min-h-0">
        <div className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                        md:relative md:translate-x-0 md:w-80 lg:w-96
                        w-full max-w-xs sm:max-w-sm
                        bg-neutral-light dark:bg-neutral-darker border-r border-secondary dark:border-neutral-darkest
                        transition-transform duration-300 ease-in-out z-50 md:z-auto
                        shadow-lg md:shadow-none flex flex-col`}>
            <div className="relative flex justify-between items-center p-2 md:hidden">
                <span className="text-lg font-semibold text-neutral-darker dark:text-secondary-light ml-2">Menu</span>
                <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-2 rounded-full hover:bg-secondary dark:hover:bg-neutral-dark relative z-10"
                    aria-label="Close settings and history panel"
                >
                    <XMarkIcon className="w-6 h-6 text-neutral-darker dark:text-secondary-light"/>
                </button>
            </div>
            <div className="flex-grow overflow-y-auto overflow-x-hidden p-3 pt-0 md:pt-3 min-h-0">
                {sidebarContent}
            </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden" style={chatAreaStyle}>
           <audio ref={audioPlayerRef} className="hidden" />
            {isGpt41AccessModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100] p-4" onClick={() => handleGpt41AccessModalClose(true, "Switched to gpt-4.1-mini due to modal closure.")}>
                    <div className="bg-neutral-light dark:bg-neutral-darker p-6 rounded-lg shadow-xl w-full max-w-md text-center" onClick={(e) => e.stopPropagation()}>
                        <KeyIcon className="w-12 h-12 text-primary dark:text-primary-light mx-auto mb-4"/>
                        <h3 className="text-xl font-semibold text-neutral-darker dark:text-secondary-light mb-3">Access GPT-4.1</h3>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                            You've selected gpt-4.1. This model may have usage costs. Please enter the secret access code or it will default to gpt-4.1-mini.
                        </p>
                        <input
                            type="password"
                            value={gpt41AccessCodeInput}
                            onChange={(e) => setGpt41AccessCodeInput(e.target.value)}
                            onKeyPress={(e) => { if (e.key === 'Enter') handleGpt41CodeSubmit(); }}
                            placeholder="Secret Code"
                            className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none mb-4"
                            autoFocus
                        />
                        <div className="flex justify-center space-x-3">
                            <button onClick={handleGpt41CodeSubmit} className="px-5 py-2 bg-primary hover:bg-primary-dark text-white rounded-md">Submit Code</button>
                            <button onClick={() => handleGpt41AccessModalClose(true, "Switched to gpt-4.1-mini.")} className="px-4 py-2 bg-secondary dark:bg-neutral-darkest text-neutral-darker dark:text-secondary-light rounded-md">Use gpt-4.1-mini</button>
                        </div>
                    </div>
                </div>
            )}
          <div className="flex items-center p-3 border-b border-secondary dark:border-neutral-darkest bg-neutral-light dark:bg-neutral-darker backdrop-blur-sm sticky top-0 z-30">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 rounded-full hover:bg-secondary dark:hover:bg-neutral-dark md:hidden mr-2">
                <Bars3Icon className="w-6 h-6 text-neutral-darker dark:text-secondary-light"/>
            </button>
            <div className="flex-grow flex items-center min-w-0">
                {getIsTradingProModel(selectedModel) ? (
                    <PresentationChartLineIcon className="w-6 h-6 text-primary dark:text-primary-light mr-2 flex-shrink-0" />
                ) : (
                    <ChatBubbleLeftRightIcon className="w-6 h-6 text-primary dark:text-primary-light mr-2 flex-shrink-0"/>
                )}
                <h2 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light truncate" title={displayedChatTitle}>
                    {displayedChatTitle}
                </h2>
            </div>
            {!isRealTimeTranslationMode && !getIsTradingProModel(selectedModel) && (
              <div className="relative flex items-center ml-2">
                  <input
                      type="text"
                      placeholder="Search chat..."
                      value={tempSearchQuery}
                      onChange={(e) => setTempSearchQuery(e.target.value)}
                      onKeyPress={(e) => { if (e.key === 'Enter') executeSearch(); }}
                      className="px-2 py-1.5 text-xs border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark w-28 sm:w-36 focus:ring-1 focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none transition-all duration-200 ease-in-out focus:w-36 sm:focus:w-48"
                      disabled={isLoading}
                  />
                  <button onClick={executeSearch} className="p-1.5 text-neutral-500 hover:text-primary dark:hover:text-primary-light absolute right-0 top-1/2 -translate-y-1/2 mr-1" aria-label="Execute search">
                      <MagnifyingGlassIcon className="w-4 h-4"/>
                  </button>
              </div>
            )}
            {isSearchActive && !isRealTimeTranslationMode && !getIsTradingProModel(selectedModel) && (
                <button onClick={clearSearch} className="p-1.5 text-red-500 hover:text-red-700 ml-1" aria-label="Clear search">
                    <XMarkIcon className="w-4 h-4"/>
                </button>
            )}
          </div>
          {isSearchActive && searchResults.length > 0 && !isRealTimeTranslationMode && !getIsTradingProModel(selectedModel) && (
            <div className="sticky top-[calc(theme(spacing.16)_-_1px)] sm:top-[calc(theme(spacing.18)_-_1px)] md:top-0 z-20 bg-white dark:bg-neutral-darker/90 backdrop-blur-sm p-1.5 text-xs flex items-center justify-center space-x-2 border-b border-secondary dark:border-neutral-darkest">
                <span>{currentSearchResultIndex + 1} of {searchResults.length}</span>
                <button onClick={() => navigateSearchResults('prev')} className="p-1 rounded-full hover:bg-secondary dark:hover:bg-neutral-dark disabled:opacity-50" disabled={searchResults.length <= 1} aria-label="Previous search result">
                    <ChevronLeftIcon className="w-4 h-4"/>
                </button>
                <button onClick={() => navigateSearchResults('next')} className="p-1 rounded-full hover:bg-secondary dark:hover:bg-neutral-dark disabled:opacity-50" disabled={searchResults.length <= 1} aria-label="Next search result">
                    <ChevronRightIcon className="w-4 h-4"/>
                </button>
            </div>
          )}

            {isRealTimeTranslationMode ? (
                <div className="flex-grow p-3 border-t border-secondary dark:border-neutral-darkest bg-neutral-light dark:bg-neutral-darker max-h-full overflow-y-auto text-sm">
                    <div className="mb-2">
                        <h4 className="font-semibold text-neutral-600 dark:text-neutral-300">Live Transcription ({navigator.language || 'en-US'}):</h4>
                        <pre className="whitespace-pre-wrap text-neutral-700 dark:text-neutral-200">{liveTranscriptionDisplay || (isListening ? "Listening..." : "Start microphone to see transcription.")}</pre>
                    </div>
                    <div>
                        <h4 className="font-semibold text-neutral-600 dark:text-neutral-300">Live Translation ({targetTranslationLangName}):</h4>
                        <pre className="whitespace-pre-wrap text-neutral-700 dark:text-neutral-200">{liveTranslationDisplay || (isListening && liveTranscriptionDisplay ? "Translating..." : "Translation will appear here.")}</pre>
                    </div>
                </div>
            ) : getIsTradingProModel(selectedModel) ? (
                <ErrorBoundary fallbackUIMessage="Trading Pro view encountered an error.">
                    <TradingProView
                        settings={currentModelSettings as TradingProSettings}
                        onSettingsChange={(newSettings) => handleModelSettingsChange(newSettings)}
                        tradingProState={tradingProState}
                        setTradingProState={setTradingProState}
                        // fetchChartData prop removed
                        handleAnalysis={handleTradingAnalysis} // Pass handleTradingAnalysis
                        userSession={userSession}
                    />
                </ErrorBoundary>
            ) : (
                <div ref={chatContainerRef} className="flex-grow min-h-0 p-4 space-y-4 overflow-y-auto">
                    {messages.map((msg, index) => (
                        <div ref={(el: HTMLDivElement | null) => { messageRefs.current[msg.id] = el; }} key={msg.id} className="flex justify-start">
                            <MessageBubble
                            message={msg}
                            showAvatar={index === 0 || messages[index-1]?.sender !== msg.sender}
                            onImageClick={handleOpenImageModal}
                            onRegenerate={handleRegenerateResponse}
                            isLoading={isLoading && msg.id === messages.find(m => m.isRegenerating)?.id}
                            onPlayAudio={msg.audioUrl ? () => handlePlayAudio(msg.audioUrl!, msg.id) : undefined}
                            isAudioPlaying={currentPlayingMessageId === msg.id}
                            searchQuery={searchQuery}
                            isCurrentSearchResult={isSearchActive && searchResults[currentSearchResultIndex]?.messageId === msg.id}
                            />
                        </div>
                    ))}
                    <div ref={chatEndRef} />
                </div>
            )}
           {showScrollToBottomButton && !isRealTimeTranslationMode && !getIsTradingProModel(selectedModel) && (
              <button
                onClick={scrollToBottomUiButton}
                className="absolute bottom-24 right-6 sm:bottom-28 sm:right-10 p-2.5 bg-primary dark:bg-primary-light text-white rounded-full shadow-lg hover:bg-primary-dark dark:hover:bg-primary transition-colors z-20"
                aria-label="Scroll to bottom"
              >
                <ChevronDownIcon className="w-5 h-5" />
              </button>
            )}
          {error && !getIsTradingProModel(selectedModel) && <p className="p-4 text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/30 border-t border-red-200 dark:border-red-700 text-sm">{error}</p>}

          {showGenericAttachmentPreview && !getIsTradingProModel(selectedModel) && (imagePreviews.length > 0 || (uploadedTextFileName && selectedModel !== Model.AI_AGENT_SMART) ) && (
            <div className="p-2 border-t border-b border-secondary dark:border-neutral-darkest bg-neutral-light dark:bg-neutral-darker flex-shrink-0">
                <div className="flex flex-wrap items-center gap-2 max-h-24 overflow-y-auto">
                    {imagePreviews.map((previewUrl, index) => (
                        <div key={`preview-${index}`} className="relative group w-16 h-16">
                            <img
                                src={previewUrl}
                                alt={`Preview ${index + 1}`}
                                className="w-full h-full object-cover rounded-md border border-secondary dark:border-neutral-darkest"
                                title={uploadedImages[index]?.name || `Image ${index + 1}`}
                            />
                            <button
                                onClick={() => handleRemoveUploadedImage(index)}
                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                aria-label={`Remove image ${index + 1}`}
                                title="Remove image"
                            >
                                <XMarkIcon className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                    {uploadedTextFileName && selectedModel !== Model.AI_AGENT_SMART && ( 
                        <div className="flex items-center p-2 bg-secondary/50 dark:bg-neutral-dark/50 rounded-md text-xs text-neutral-700 dark:text-neutral-300">
                            <DocumentTextIcon className="w-4 h-4 mr-1.5 flex-shrink-0 text-primary dark:text-primary-light" />
                            <span className="truncate max-w-[150px] sm:max-w-[200px]" title={uploadedTextFileName}>
                                {uploadedTextFileName}
                            </span>
                            <button
                                onClick={handleRemoveTextFilePreview}
                                className="ml-2 text-red-500 hover:text-red-600"
                                aria-label="Remove file"
                                title="Remove file"
                            >
                                <XMarkIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
          )}


          <input type="file" id="image-upload-chatbar" className="hidden" onChange={handleChatBarImageUpload} accept={imageFileAcceptTypes} multiple={selectedModel === Model.FLUX_KONTEX_MAX_MULTI} />
          <input type="file" id="image-upload-chatbar-kling" className="hidden" onChange={handleChatBarImageUpload} accept={imageFileAcceptTypes} multiple={false} />
          {/* Input for Trading Pro will also use 'image-upload-chatbar' as limit is 1 */}
          <input type="file" id="file-upload-chatbar" className="hidden" onChange={handleChatBarGeneralFileUpload} 
            accept={isTextToSpeechModelSelected ? ttsFileAcceptTypes : isRealTimeTranslationMode ? translationFileAcceptTypes : generalFileAcceptTypes} />

          <div className="p-3 border-t border-secondary dark:border-neutral-darkest bg-neutral-light dark:bg-neutral-darker flex items-end flex-shrink-0">
            {showMicrophoneButton && (
                <button onClick={handleToggleListen} disabled={microphoneButtonDisabled}
                    className={`p-2.5 rounded-full transition-colors flex-shrink-0 mr-2
                                ${isListening ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' : 'bg-secondary dark:bg-neutral-darkest hover:bg-secondary-dark dark:hover:bg-neutral-dark text-neutral-darker dark:text-secondary-light'}
                                disabled:opacity-50`}
                    aria-label={isListening ? "Stop voice input" : "Start voice input"}
                    title={isListening ? "Stop Listening" : "Start Voice Input"}
                >
                    {isListening ? <StopCircleIcon className="w-5 h-5"/> : <MicrophoneIcon className="w-5 h-5"/>}
                </button>
            )}

            {showImageUploadInChatBar && (
              <button
                onClick={
                  getIsTradingProModel(selectedModel) && tradingProState.chartImageUrl
                    ? () => handleRemoveUploadedImage(0)
                    : () => document.getElementById(getIsKlingVideoModel(selectedModel) ? 'image-upload-chatbar-kling' : 'image-upload-chatbar')?.click()
                }
                disabled={
                  generalChatBarInteractionDisabled ||
                  (
                    !(getIsTradingProModel(selectedModel) && tradingProState.chartImageUrl) && // Don't disable if it's a clear button
                    uploadedImages.length >= imageUploadLimit
                  )
                }
                className={`p-2.5 rounded-full transition-colors flex-shrink-0 mr-2
                            ${getIsKlingVideoModel(selectedModel) ? 'bg-accent dark:bg-accent-light hover:bg-accent-dark text-white' : 
                             (getIsTradingProModel(selectedModel) && tradingProState.chartImageUrl ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-secondary dark:bg-neutral-darkest hover:bg-secondary-dark dark:hover:bg-neutral-dark text-neutral-darker dark:text-secondary-light')}
                            disabled:opacity-50`}
                aria-label={getIsTradingProModel(selectedModel) && tradingProState.chartImageUrl ? "Clear Uploaded Chart" : "Upload image"}
                title={getIsTradingProModel(selectedModel) && tradingProState.chartImageUrl ? "Clear Uploaded Chart" : "Upload Image"}
              >
                {getIsTradingProModel(selectedModel) && tradingProState.chartImageUrl ? <XMarkIcon className="w-5 h-5"/> : <PhotoIcon className="w-5 h-5"/>}
              </button>
            )}
            
            {showFileUploadInChatBar && (
               <button
                onClick={() => document.getElementById('file-upload-chatbar')?.click()}
                disabled={generalChatBarInteractionDisabled}
                className={`p-2.5 rounded-full transition-colors flex-shrink-0 mr-2
                            bg-secondary dark:bg-neutral-darkest hover:bg-secondary-dark dark:hover:bg-neutral-dark text-neutral-darker dark:text-secondary-light
                            disabled:opacity-50`}
                aria-label="Upload file"
                title="Upload File"
              >
                <ArrowUpTrayIcon className="w-5 h-5"/>
              </button>
            )}


            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey && !getIsTradingProModel(selectedModel)) { e.preventDefault(); handleSendMessage(); } }}
              placeholder={currentPromptPlaceholder()}
              rows={calculateTextareaRows()}
              className="flex-grow p-2.5 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-1 focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none resize-none text-sm"
              disabled={generalChatBarInteractionDisabled || isRealTimeTranslationMode || getIsTradingProModel(selectedModel)} // Disable textarea for Trading Pro, use button
              aria-label="Chat input message"
            />
            <button
              onClick={isRealTimeTranslationMode ? handleSpeakLiveTranslation : (getIsTradingProModel(selectedModel) ? onAnalyzeTradingProClick : handleSendMessage)}
              disabled={generalChatBarInteractionDisabled || (isRealTimeTranslationMode && (isListening || !liveTranslationDisplay.trim() || isSpeakingLiveTranslation || (userSession.isDemoUser && !userSession.isPaidUser))) || (getIsTradingProModel(selectedModel) && isAnalyzeButtonDisabled) }
              className={`ml-2 p-2.5 rounded-full transition-colors flex-shrink-0
                          ${isRealTimeTranslationMode
                            ? (isSpeakingLiveTranslation ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' : 'bg-accent hover:bg-accent-dark text-white disabled:bg-accent/50')
                            : 'bg-primary hover:bg-primary-dark dark:bg-primary-light dark:hover:bg-primary text-white dark:text-neutral-darker'}
                          disabled:opacity-50`}
              aria-label={isRealTimeTranslationMode ? (isSpeakingLiveTranslation ? "Stop Speaking Translation" : "Speak Translation") : sendButtonLabel()}
              title={isRealTimeTranslationMode ? (isSpeakingLiveTranslation ? "Stop Speaking Translation" : (userSession.isDemoUser && !userSession.isPaidUser ? "TTS for Paid Users Only" : "Speak Translation") ) : sendButtonLabel()}
            >
              {isRealTimeTranslationMode
                ? (isSpeakingLiveTranslation ? <StopCircleIcon className="w-6 h-6"/> : <SpeakerWaveIcon className="w-6 h-6"/>)
                : sendButtonIcon()
              }
            </button>
          </div>
        </div>
      </div>
      <ImageModal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} imageBase64={modalImage || ''} prompt={modalPrompt} mimeType={modalMimeType} />
    </div>
  );
};

export default ChatPage;