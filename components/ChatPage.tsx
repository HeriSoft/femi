
// Fix: Remove triple-slash directive for 'vite/client' as its types are not found and import.meta.env is manually typed.
// Fix: Add 'useMemo' to React import
import React, { useState, useRef, useEffect, useCallback, useMemo, useContext } from 'react';
// Update to .ts/.tsx extensions
import { Model, ChatMessage, ModelSettings, AllModelSettings, Part, GroundingSource, ApiKeyStatus, getActualModelIdentifier, ApiChatMessage, ApiStreamChunk, ImagenSettings, ChatSession, Persona, OpenAITtsSettings, RealTimeTranslationSettings, OpenAiTtsVoice, ThemeContextType, UserGlobalProfile, AiAgentSettings, PrivateModeSettings, FluxKontexSettings, NotificationType, UserSessionState, DemoUserLimits, PaidUserLimits, SingleImageData, MultiImageData, FluxKontexAspectRatio } from '../types.ts'; // Added UserSessionState, DemoUserLimits, PaidUserLimits, SingleImageData, MultiImageData, FluxKontexAspectRatio
import type { Content } from '@google/genai'; // For constructing Gemini history
import { ALL_MODEL_DEFAULT_SETTINGS, LOCAL_STORAGE_SETTINGS_KEY, LOCAL_STORAGE_HISTORY_KEY, LOCAL_STORAGE_PERSONAS_KEY, TRANSLATION_TARGET_LANGUAGES, MAX_SAVED_CHAT_SESSIONS, OPENAI_TTS_MAX_INPUT_LENGTH, PAID_USER_LIMITS_CONFIG, DEFAULT_FLUX_KONTEX_SETTINGS } from '../constants.ts';
import { MessageBubble } from './MessageBubble.tsx'; // Changed to named import
import SettingsPanel from './SettingsPanel.tsx';
import HistoryPanel from './HistoryPanel.tsx'; // Import HistoryPanel
import ImageModal from './ImageModal.tsx'; // Import ImageModal
import { useNotification } from '../contexts/NotificationContext.tsx'; // Import useNotification
import { sendGeminiMessageStream, generateImageWithImagen } from '../services/geminiService.ts';
import { sendOpenAIMessageStream } from '../services/openaiService.ts';
import { sendDeepseekMessageStream } from '../services/deepseekService.ts';
import { sendMockMessageStream } from '../services/mockApiService.ts';
import { generateOpenAITTS } from "../services/openaiTTSService"; // Changed this line
import { editImageWithFluxKontexProxy, checkFluxKontexStatusProxy } from '../services/falService.ts'; // Added Fal.ai service
// Added MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon, LanguageIcon, KeyIcon, ChevronDownIcon
import { PaperAirplaneIcon, CogIcon, XMarkIcon, PromptIcon, Bars3Icon, ChatBubbleLeftRightIcon, ClockIcon as HistoryIcon, MicrophoneIcon, StopCircleIcon, SpeakerWaveIcon, MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon, LanguageIcon, KeyIcon, ChevronDownIcon, ArrowDownTrayIcon, PencilIcon as EditIcon, PhotoIcon, ArrowUpTrayIcon, DocumentTextIcon } from './Icons.tsx'; // Added EditIcon, PhotoIcon, ArrowUpTrayIcon, DocumentTextIcon
import { ThemeContext } from '../App.tsx'; // Import ThemeContext

// Helper to deep merge settings, useful for loading from localStorage
const mergeSettings = (target: AllModelSettings, source: Partial<AllModelSettings>): AllModelSettings => {
  const output = { ...target };
  for (const keyString in source) {
    if (Object.prototype.hasOwnProperty.call(source, keyString)) {
      if (Object.values(Model).includes(keyString as Model)) {
        const modelKey = keyString as Model;
        const sourceModelSettings = source[modelKey];

        if (sourceModelSettings) {
          const targetModelSettings = output[modelKey];
          if (targetModelSettings) {
            output[modelKey] = { ...targetModelSettings, ...sourceModelSettings };
          } else {
            output[modelKey] = { ...sourceModelSettings };
          }
        }
      }
    }
  }
  return output;
};

const TEXT_READABLE_EXTENSIONS = [
  '.txt', '.md', '.json', '.js', '.ts', '.jsx', '.tsx',
  '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rs',
  '.rb', '.php', '.html', '.htm', '.css', '.scss', '.less',
  '.xml', '.yaml', '.yml', '.ini', '.sh', '.bat', '.ps1',
  '.sql', '.csv', '.log'
];

type SidebarTab = 'settings' | 'history';

// FIX: Added comprehensive global type definitions for Web Speech API
declare global {
  // SpeechRecognitionResultList, SpeechRecognitionResult, SpeechRecognitionAlternative
  // are needed for SpeechRecognitionEvent
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

  // SpeechRecognitionEvent
  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
  }

  // SpeechRecognitionErrorCode and SpeechRecognitionErrorEvent
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
    onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
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
  onUpdateDemoLimits: (updatedLimits: Partial<DemoUserLimits>) => void;
}

async function safeResponseJson(response: Response): Promise<any> {
  const text = await response.text();
  try {
    if (!text) { // Handle empty response string
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

  const [allSettings, setAllSettings] = useState<AllModelSettings>(() => {
    try {
      const storedSettings = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
      if (storedSettings) {
        const parsedSettings = JSON.parse(storedSettings) as Partial<AllModelSettings>;

        // Sanitize Flux Kontext aspect_ratio settings
        const fluxModelsToSanitize: Model[] = [Model.FLUX_KONTEX, Model.FLUX_KONTEX_MAX_MULTI];
        fluxModelsToSanitize.forEach(fluxModelKey => {
          if (parsedSettings[fluxModelKey] && parsedSettings[fluxModelKey]!.aspect_ratio) {
            const currentAspectRatio = parsedSettings[fluxModelKey]!.aspect_ratio as string;
            if (!VALID_FLUX_KONTEX_ASPECT_RATIOS.includes(currentAspectRatio as FluxKontexAspectRatio)) {
              console.warn(`[ChatPage Init] Invalid aspect_ratio "${currentAspectRatio}" found in localStorage for ${fluxModelKey}. Resetting to default "${DEFAULT_FLUX_KONTEX_SETTINGS.aspect_ratio}".`);
              parsedSettings[fluxModelKey]!.aspect_ratio = DEFAULT_FLUX_KONTEX_SETTINGS.aspect_ratio;
            }
          }
        });

        const completeDefaults: AllModelSettings = {};
        Object.values(Model).forEach(modelKey => {
            completeDefaults[modelKey] = { ...(ALL_MODEL_DEFAULT_SETTINGS[modelKey] || ALL_MODEL_DEFAULT_SETTINGS[Model.GEMINI]!) };
        });
        return mergeSettings(completeDefaults, parsedSettings);
      }
    } catch (error: any) {
      console.error("Error loading settings from localStorage:", error);
    }
    const initialSettings: AllModelSettings = {};
    Object.values(Model).forEach(modelKey => {
        initialSettings[modelKey] = { ...(ALL_MODEL_DEFAULT_SETTINGS[modelKey] || ALL_MODEL_DEFAULT_SETTINGS[Model.GEMINI]!) };
    });
    return initialSettings;
  });

  const modelSettings = useMemo(() => {
    const baseSettings = allSettings[selectedModel] || ALL_MODEL_DEFAULT_SETTINGS[Model.GEMINI]!;
    const aboutMeText = userProfile?.aboutMe?.trim();
    const activePersona = activePersonaId ? personas.find(p => p.id === activePersonaId) : null;

    if (selectedModel !== Model.IMAGEN3 && selectedModel !== Model.OPENAI_TTS && selectedModel !== Model.REAL_TIME_TRANSLATION && selectedModel !== Model.AI_AGENT && selectedModel !== Model.PRIVATE && selectedModel !== Model.FLUX_KONTEX && selectedModel !== Model.FLUX_KONTEX_MAX_MULTI) {
        let finalSystemInstruction = baseSettings.systemInstruction;

        if (activePersona) {
            finalSystemInstruction = activePersona.instruction;
            if (aboutMeText) {
                finalSystemInstruction = `Background information about the user you are interacting with: "${aboutMeText}".\n\nYour current persona/task based on user's selection: "${activePersona.instruction}"`;
            }
        } else if (aboutMeText) {
            finalSystemInstruction = `Background information about the user you are interacting with: "${aboutMeText}".\n\nYour task: "${baseSettings.systemInstruction}"`;
        }
        return { ...baseSettings, systemInstruction: finalSystemInstruction };
    }
    return baseSettings;
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
  const isAiAgentMode = selectedModel === Model.AI_AGENT;
  const isPrivateModeSelected = selectedModel === Model.PRIVATE;
  const isFluxKontexModelSelected = selectedModel === Model.FLUX_KONTEX || selectedModel === Model.FLUX_KONTEX_MAX_MULTI;
  const isClaudeModelSelected = selectedModel === Model.CLAUDE;


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

  // Refs for Real-Time Translation
  const liveTranscriptionRef = useRef<string>(""); // Stores all text *sent for translation*
  const currentInterimVisualRef = useRef<string>(""); // Stores the latest visual part of the current utterance (not yet sent for translation)
  const interimTranslationBufferRef = useRef<string>(""); // Accumulates interim speech before debounced translation
  const translationDebounceTimerRef = useRef<number | null>(null);
  const DEBOUNCE_TRANSLATION_MS = 750; // Time to wait for more speech before translating interim

  const [liveTranscriptionDisplay, setLiveTranscriptionDisplay] = useState<string>("");
  const liveTranslationAccumulatorRef = useRef<string>("");
  const [liveTranslationDisplay, setLiveTranslationDisplay] = useState<string>("");
  const currentTranslationStreamControllerRef = useRef<AbortController | null>(null);
  const [isSpeakingLiveTranslation, setIsSpeakingLiveTranslation] = useState(false);
  const [liveTranslationAudioUrl, setLiveTranslationAudioUrl] = useState<string | null>(null);


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

  const clearSearch = useCallback(() => {
    setIsSearchActive(false);
    setSearchQuery('');
    setTempSearchQuery('');
    setSearchResults([]);
    setCurrentSearchResultIndex(-1);
  }, []);


  const apiKeyStatuses = React.useMemo((): Record<Model, ApiKeyStatus> => {
    const isProxyExpectedToHaveKey = true;

    return {
      [Model.GEMINI]: {isSet: isProxyExpectedToHaveKey, envVarName: 'GEMINI_API_KEY (on proxy)', modelName: 'Gemini Flash', isMock: false, isGeminiPlatform: true},
      [Model.GEMINI_ADVANCED]: {isSet: isProxyExpectedToHaveKey, envVarName: 'GEMINI_API_KEY (on proxy)', modelName: 'Gemini Advanced', isMock: false, isGeminiPlatform: true},
      [Model.GPT4O]: {isSet: isProxyExpectedToHaveKey, envVarName: 'OPENAI_API_KEY (on proxy)', modelName: 'ChatGPT (gpt-4.1)', isMock: false, isGeminiPlatform: false},
      [Model.GPT4O_MINI]: {isSet: isProxyExpectedToHaveKey, envVarName: 'OPENAI_API_KEY (on proxy)', modelName: 'ChatGPT (gpt-4.1-mini)', isMock: false, isGeminiPlatform: false},
      [Model.DEEPSEEK]: { isSet: isProxyExpectedToHaveKey, envVarName: 'DEEPSEEK_API_KEY (on proxy)', modelName: 'Deepseek', isMock: false, isGeminiPlatform: false},
      [Model.CLAUDE]: { isSet: true, envVarName: 'N/A (Mock)', modelName: 'Claude', isMock: true, isGeminiPlatform: false},
      [Model.IMAGEN3]: {isSet: isProxyExpectedToHaveKey, envVarName: 'GEMINI_API_KEY (on proxy)', modelName: 'Imagen3 Image Gen', isMock: false, isGeminiPlatform: true, isImageGeneration: true},
      [Model.OPENAI_TTS]: {isSet: isProxyExpectedToHaveKey, envVarName: 'OPENAI_API_KEY (on proxy)', modelName: 'OpenAI TTS', isMock: false, isGeminiPlatform: false, isTextToSpeech: true },
      [Model.REAL_TIME_TRANSLATION]: {isSet: isProxyExpectedToHaveKey, envVarName: 'GEMINI_API_KEY (on proxy)', modelName: 'Real-Time Translation (Gemini)', isMock: false, isGeminiPlatform: true, isRealTimeTranslation: true },
      [Model.AI_AGENT]: {
        isSet: isProxyExpectedToHaveKey,
        envVarName: 'GEMINI_API_KEY (on proxy)',
        modelName: 'AI Agent (gemini-2.5-flash-preview-04-17)',
        isMock: false,
        isGeminiPlatform: true,
        isAiAgent: true,
      },
      [Model.PRIVATE]: {
        isSet: true,
        envVarName: 'N/A (Local)',
        modelName: 'Private (Local Data Storage)',
        isMock: true,
        isGeminiPlatform: false,
        isPrivateMode: true,
      },
      [Model.FLUX_KONTEX]: {
        isSet: isProxyExpectedToHaveKey,
        envVarName: 'FAL_KEY (on proxy)',
        modelName: 'Flux Kontext Image Edit',
        isMock: false,
        isGeminiPlatform: false,
        isImageEditing: true
      },
      [Model.FLUX_KONTEX_MAX_MULTI]: {
        isSet: isProxyExpectedToHaveKey,
        envVarName: 'FAL_KEY (on proxy)',
        modelName: 'Flux Kontext Max (Multi-Image Edit)',
        isMock: false,
        isGeminiPlatform: false,
        isImageEditing: false, 
        isMultiImageEditing: true,
      },
    };
  }, []);

  const displayedChatTitle = useMemo(() => {
    if (!activeSessionId) { // It's a new chat or not yet saved
      switch (selectedModel) {
        case Model.FLUX_KONTEX:
          return "Flux Kontext Editor";
        case Model.FLUX_KONTEX_MAX_MULTI:
          return "Flux Kontext Max Editor";
        case Model.PRIVATE:
          return "Private Mode";
        case Model.AI_AGENT:
          return "AI Agent";
        case Model.REAL_TIME_TRANSLATION:
          return "Real-Time Translation";
        default:
          return currentChatName; // This would be "New Chat" from initial state or handleStartNewChat
      }
    }
    return currentChatName; // This is the name of the loaded/saved session
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
    if (chatDiv && !isSearchActive && !isRealTimeTranslationMode && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        const isUserMessage = lastMessage.sender === 'user';

        const nearBottomThreshold = chatDiv.clientHeight * 0.3;
        const isNearBottom = (chatDiv.scrollHeight - chatDiv.scrollTop - chatDiv.clientHeight) < nearBottomThreshold;

        if (isUserMessage || isNearBottom) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }
  }, [messages, isSearchActive, isRealTimeTranslationMode]);

  useEffect(() => {
    const currentModelStatus = apiKeyStatuses[selectedModel];
    if ((!currentModelStatus?.isGeminiPlatform || currentModelStatus?.isImageGeneration || currentModelStatus?.isTextToSpeech || currentModelStatus?.isRealTimeTranslation || currentModelStatus?.isAiAgent || currentModelStatus?.isPrivateMode || currentModelStatus?.isImageEditing || currentModelStatus?.isMultiImageEditing) && isWebSearchEnabled) {
        setIsWebSearchEnabled(false);
    }

    // Clear image attachments
    const previousModel = prevSelectedModelRef.current;
    const shouldClearImagesOnModelSwitch = 
      (isImagenModelSelected || isTextToSpeechModelSelected || isRealTimeTranslationMode || isPrivateModeSelected || isClaudeModelSelected || isAiAgentMode) ||
      (selectedModel !== previousModel && (
        // Clear if switching TO a Flux model from a non-Flux model
        (getIsFluxKontexModel(selectedModel) && !getIsFluxKontexModel(previousModel)) ||
        // Clear if switching FROM a Flux model to a non-Flux model
        (!getIsFluxKontexModel(selectedModel) && getIsFluxKontexModel(previousModel)) ||
        // Clear if switching between Flux Standard and Flux Max
        (selectedModel === Model.FLUX_KONTEX && previousModel === Model.FLUX_KONTEX_MAX_MULTI) ||
        (selectedModel === Model.FLUX_KONTEX_MAX_MULTI && previousModel === Model.FLUX_KONTEX)
      ));

    if (shouldClearImagesOnModelSwitch) {
      if (uploadedImages.length > 0 || imagePreviews.length > 0) {
        setUploadedImages([]);
        setImagePreviews([]);
      }
    }


    // Clear text file attachments
    if (isImagenModelSelected || isTextToSpeechModelSelected || isRealTimeTranslationMode || isFluxKontexModelSelected || isClaudeModelSelected || isPrivateModeSelected) {
      if (uploadedTextFileContent || uploadedTextFileName) {
        setUploadedTextFileContent(null);
        setUploadedTextFileName(null);
      }
    }
    // Note: AI Agent KEEPS text files.

    // Clear personas
    if (isImagenModelSelected || isTextToSpeechModelSelected || isRealTimeTranslationMode || isPrivateModeSelected || isFluxKontexModelSelected || isClaudeModelSelected) {
      if (activePersonaId) {
        setActivePersonaId(null);
      }
    }
    // Note: AI Agent KEEPS personas.

    // Microphone stopping logic
    if (isListening && recognitionRef.current) {
      const stopMicForModel =
        (isImagenModelSelected && !isRealTimeTranslationMode) ||
        (isTextToSpeechModelSelected && !isRealTimeTranslationMode) ||
        (isClaudeModelSelected && !isRealTimeTranslationMode);

      if (stopMicForModel) {
        recognitionRef.current.stop();
      } else if (
          !isRealTimeTranslationMode &&
          selectedModel !== Model.GPT4O && // Original condition for GPT4O
          !isGpt41AccessModalOpen && // Original condition for GPT4O modal
          selectedModel !== Model.AI_AGENT // AI Agent KEEPS mic if it was on
      ) {
        // Fallback stop for other models (e.g. Gemini, Deepseek), excluding AI Agent.
        recognitionRef.current.stop();
      }
    }


    if (currentPlayingMessageId && audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        setCurrentPlayingMessageId(null);
    }

    if (isRealTimeTranslationMode) {
      setInput('');
      // Existing RTT audio stop already handled by general currentPlayingMessageId check above
    } else {
      // Existing non-RTT GPT4O mic stop logic is covered by the refined microphone stopping logic above
      setLiveTranscriptionDisplay("");
      setLiveTranslationDisplay("");
      liveTranscriptionRef.current = "";
      currentInterimVisualRef.current = "";
      interimTranslationBufferRef.current = "";
      liveTranslationAccumulatorRef.current = "";
      currentTranslationStreamControllerRef.current?.abort();
      if (audioPlayerRef.current && isSpeakingLiveTranslation) {
          audioPlayerRef.current.pause();
          setIsSpeakingLiveTranslation(false);
          setLiveTranslationAudioUrl(null);
      }
    }


    if (selectedModel === Model.GPT4O) {
      if (!isGpt41Unlocked && !gpt41ModalInteractionFlagRef.current) {
        previousModelBeforeGpt41ModalRef.current = selectedModel;
        setIsGpt41AccessModalOpen(true);
        gpt41ModalInteractionFlagRef.current = true;
      }
    } else {
      gpt41ModalInteractionFlagRef.current = false;
      if (isGpt41AccessModalOpen) setIsGpt41AccessModalOpen(false);
    }
    clearSearch();
    prevSelectedModelRef.current = selectedModel;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel, clearSearch]);


  const translateLiveSegment = useCallback(async (text: string, targetLangCode: string) => {
      if (!text.trim() || !targetLangCode) return;

      const targetLangName = TRANSLATION_TARGET_LANGUAGES.find(l => l.code === targetLangCode)?.name || targetLangCode;
      const translationPlaceholderId = `translate-${Date.now()}`;
      const translationPlaceholder = `Translating to ${targetLangName}: "${text.substring(0, 20)}..." [ID: ${translationPlaceholderId}]\n`;

      setLiveTranslationDisplay(prev => prev + translationPlaceholder);

      currentTranslationStreamControllerRef.current?.abort();
      currentTranslationStreamControllerRef.current = new AbortController();
      const signal = currentTranslationStreamControllerRef.current.signal;

      try {
          const prompt = `Translate the following text to ${targetLangName}. Output only the translated text directly, without any introductory phrases or explanations: "${text}"`;
          const history: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
          const geminiModelId = getActualModelIdentifier(Model.GEMINI);

          const stream = sendGeminiMessageStream({
              historyContents: history,
              modelSettings: { temperature: 0.3, topK: 1, topP: 1, systemInstruction: "You are a direct text translator." } as ModelSettings,
              enableGoogleSearch: false,
              modelName: geminiModelId,
          });

          let segmentTranslation = "";
          for await (const chunk of stream) {
              if (signal.aborted) {
                  console.log("Translation stream aborted for segment:", text);
                  setLiveTranslationDisplay(prev => prev.replace(translationPlaceholder, `[Translation cancelled for "${text.substring(0,20)}..."]\n`));
                  return;
              }
              if (chunk.error) throw new Error(chunk.error);
              if (chunk.textDelta) {
                  segmentTranslation += chunk.textDelta;
                  setLiveTranslationDisplay(prev => prev.replace(translationPlaceholder, `[${targetLangName}]: ${segmentTranslation}\n`));
              }
          }
          // Append to accumulator and then set display to accumulator ensures final consistency
          liveTranslationAccumulatorRef.current += `[${targetLangName}]: ${segmentTranslation.trim()}\n`;
          setLiveTranslationDisplay(liveTranslationAccumulatorRef.current);

      } catch (error: any) {
          if (error.name === 'AbortError') {
            console.log('Previous translation fetch was aborted.');
          } else {
            console.error("Error translating segment:", error);
            addNotification(`Translation error: ${error.message}`, "error");
            liveTranslationAccumulatorRef.current += `[Error translating: ${error.message}]\n`;
            setLiveTranslationDisplay(liveTranslationAccumulatorRef.current);
          }
      }
  }, [addNotification]);

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


    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let newFinalTranscriptThisEvent = "";
      let latestInterimForDisplay = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptPart = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
              newFinalTranscriptThisEvent += transcriptPart;
              currentInterimVisualRef.current = "";
          } else {
              latestInterimForDisplay = transcriptPart;
          }
      }

      if (isRealTimeTranslationMode) {
          if (!newFinalTranscriptThisEvent.trim() && latestInterimForDisplay.trim()) {
            currentInterimVisualRef.current = latestInterimForDisplay;
          }
          setLiveTranscriptionDisplay(liveTranscriptionRef.current + currentInterimVisualRef.current);

          if (newFinalTranscriptThisEvent.trim()) {
              if (translationDebounceTimerRef.current) {
                  clearTimeout(translationDebounceTimerRef.current);
                  translationDebounceTimerRef.current = null;
              }
              const textToTranslate = newFinalTranscriptThisEvent.trim();
              liveTranscriptionRef.current += textToTranslate + "\n";
              setLiveTranscriptionDisplay(liveTranscriptionRef.current);
              currentInterimVisualRef.current = "";
              translateLiveSegment(textToTranslate, (modelSettings as RealTimeTranslationSettings).targetLanguage || 'en');
              interimTranslationBufferRef.current = "";
          } else if (latestInterimForDisplay.trim()) {
              interimTranslationBufferRef.current = latestInterimForDisplay; // Buffer the latest full interim
              if (translationDebounceTimerRef.current) {
                  clearTimeout(translationDebounceTimerRef.current);
              }
              translationDebounceTimerRef.current = window.setTimeout(() => {
                  if (interimTranslationBufferRef.current.trim()) {
                      const textToTranslate = interimTranslationBufferRef.current.trim();
                      liveTranscriptionRef.current += textToTranslate + "\n";
                      setLiveTranscriptionDisplay(liveTranscriptionRef.current);
                      currentInterimVisualRef.current = "";
                      translateLiveSegment(textToTranslate, (modelSettings as RealTimeTranslationSettings).targetLanguage || 'en');
                      interimTranslationBufferRef.current = "";
                  }
                  translationDebounceTimerRef.current = null;
              }, DEBOUNCE_TRANSLATION_MS);
          }
      } else { // Non-real-time mode
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
      setIsListening(false); // Ensure isListening is set to false when recognition ends
      if (translationDebounceTimerRef.current) {
          clearTimeout(translationDebounceTimerRef.current);
          translationDebounceTimerRef.current = null;
      }
      if (isRealTimeTranslationMode) {
          let remainingTextToTranslate = "";
          if (interimTranslationBufferRef.current.trim()) {
              remainingTextToTranslate = interimTranslationBufferRef.current.trim();
          } else if (currentInterimVisualRef.current.trim() && !liveTranscriptionRef.current.endsWith(currentInterimVisualRef.current.trim() + "\n")) {
              remainingTextToTranslate = currentInterimVisualRef.current.trim();
          }

          if (remainingTextToTranslate) {
              liveTranscriptionRef.current += remainingTextToTranslate + "\n";
              setLiveTranscriptionDisplay(liveTranscriptionRef.current);
              translateLiveSegment(remainingTextToTranslate, (modelSettings as RealTimeTranslationSettings).targetLanguage || 'en');
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
      setIsListening(false); // Ensure isListening is set to false on error
      // Clear buffers on error too
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
  }, [addNotification, isRealTimeTranslationMode, modelSettings, translateLiveSegment]); // Removed 'isListening'


  const handleToggleListen = () => {
    if (!isSpeechRecognitionSupported || !recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      // setIsListening(false) will be called by onend or onerror
    } else {
      if (isRealTimeTranslationMode) {
          liveTranscriptionRef.current = "";
          currentInterimVisualRef.current = "";
          interimTranslationBufferRef.current = "";
          liveTranslationAccumulatorRef.current = "";
          setLiveTranscriptionDisplay("");
          setLiveTranslationDisplay("");
          currentTranslationStreamControllerRef.current?.abort();
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
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e: any) {
        console.error("Error starting speech recognition:", e);
        addNotification("Could not start voice input. Please try again.", "error", e.message);
        setIsListening(false);
      }
    }
  };


  const handleModelSettingsChange = useCallback((newSettings: Partial<ModelSettings & ImagenSettings & OpenAITtsSettings & RealTimeTranslationSettings & AiAgentSettings & PrivateModeSettings & FluxKontexSettings>) => {
    setAllSettings(prev => {
      const baseModelSettings = prev[selectedModel] || ALL_MODEL_DEFAULT_SETTINGS[selectedModel]!;
      let processedNewSettings = { ...newSettings };

      if ('numberOfImages' in processedNewSettings && typeof processedNewSettings.numberOfImages === 'number') {
        processedNewSettings.numberOfImages = Math.max(1, Math.min(4, processedNewSettings.numberOfImages));
      }
       if ('speed' in processedNewSettings && typeof processedNewSettings.speed === 'number') {
        processedNewSettings.speed = Math.max(0.25, Math.min(4.0, processedNewSettings.speed));
      }
      if ('guidance_scale' in processedNewSettings && typeof processedNewSettings.guidance_scale === 'number') {
        processedNewSettings.guidance_scale = Math.max(0, Math.min(20, processedNewSettings.guidance_scale));
      }

      const activeP = activePersonaId ? personas.find(p => p.id === activePersonaId) : null;
      if (activeP && 'systemInstruction' in processedNewSettings && selectedModel !== Model.IMAGEN3 && selectedModel !== Model.OPENAI_TTS && selectedModel !== Model.REAL_TIME_TRANSLATION && selectedModel !== Model.AI_AGENT && selectedModel !== Model.PRIVATE && selectedModel !== Model.FLUX_KONTEX && selectedModel !== Model.FLUX_KONTEX_MAX_MULTI) {
          delete processedNewSettings.systemInstruction;
      }

      const updatedModelSettings = { ...baseModelSettings, ...processedNewSettings };
      return {
        ...prev,
        [selectedModel]: updatedModelSettings
      };
    });
  }, [selectedModel, activePersonaId, personas]);

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
    if (isRealTimeTranslationMode || isAiAgentMode || isPrivateModeSelected || isFluxKontexModelSelected) {
        addNotification(`Cannot save chat in ${isRealTimeTranslationMode ? 'Real-Time Translation' : (isAiAgentMode ? 'AI Agent' : (isPrivateModeSelected ? 'Private' : 'Image Editing'))} mode.`, "info");
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
        } else if (firstUserMessage.isTaskGoal && firstUserMessage.text) {
            sessionName = `Agent Goal: ${firstUserMessage.text.substring(0, 30)}${firstUserMessage.text.length > 30 ? '...' : ''}`;
        } else if (firstUserMessage.isNote && firstUserMessage.text) {
            sessionName = `Note: ${firstUserMessage.text.substring(0, 30)}${firstUserMessage.text.length > 30 ? '...' : ''}`;
        } else if (firstUserMessage.text) {
            sessionName = firstUserMessage.text.substring(0, 40) + (firstUserMessage.text.length > 40 ? '...' : '');
        } else if (firstUserMessage.imagePreview) {
            sessionName = "Chat with Image Upload";
        } else if (firstUserMessage.imagePreviews && firstUserMessage.imagePreviews.length > 0) { // For Flux Max user message
            sessionName = `Flux Edit (${firstUserMessage.imagePreviews.length} images)`;
        } else if (firstUserMessage.fileName) {
            sessionName = `Chat with File: ${firstUserMessage.fileName}`;
        }
    }


    if (activeSessionId) {
        setSavedSessions(prev => {
            const updatedSession = {
                ...prev.find(s => s.id === activeSessionId)!,
                name: prev.find(s => s.id === activeSessionId)?.name || sessionName,
                messages: [...messages],
                model: selectedModel,
                modelSettingsSnapshot: {...modelSettings},
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
            modelSettingsSnapshot: {...modelSettings},
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
  }, [messages, selectedModel, modelSettings, activeSessionId, savedSessions, activePersonaId, addNotification, currentChatName, isRealTimeTranslationMode, isAiAgentMode, isPrivateModeSelected, isFluxKontexModelSelected, pruneChatSessions, clearSearch]);

  const handleLoadSession = useCallback((sessionId: string) => {
    const sessionToLoad = savedSessions.find(s => s.id === sessionId);
    if (sessionToLoad) {
      if (sessionToLoad.model === Model.REAL_TIME_TRANSLATION || sessionToLoad.model === Model.AI_AGENT || sessionToLoad.model === Model.PRIVATE || sessionToLoad.model === Model.FLUX_KONTEX || sessionToLoad.model === Model.FLUX_KONTEX_MAX_MULTI) {
          addNotification(`Cannot load "${sessionToLoad.model}" sessions directly. Please start a new one if needed.`, "info");
          return;
      }
      setMessages([...sessionToLoad.messages]);
      setSelectedModel(sessionToLoad.model);
      setActivePersonaId(sessionToLoad.activePersonaIdSnapshot || null);

      setAllSettings(prevAllSettings => ({
          ...prevAllSettings,
          [sessionToLoad.model]: {
            ...(prevAllSettings[sessionToLoad.model] || ALL_MODEL_DEFAULT_SETTINGS[sessionToLoad.model]!),
            ...sessionToLoad.modelSettingsSnapshot
          }
      }));

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
  }, [savedSessions, addNotification, clearSearch]);

  const handleStartNewChat = useCallback(() => {
    setMessages([]);
    setActiveSessionId(null);
    // currentChatName will be updated by the displayedChatTitle logic via useMemo
    // but ensure the base is "New Chat" if no special model is active
    setCurrentChatName("New Chat");
    setUploadedImages([]);
    setImagePreviews([]);
    setUploadedTextFileContent(null);
    setUploadedTextFileName(null);
    setIsWebSearchEnabled(false);

    if (selectedModel !== Model.REAL_TIME_TRANSLATION && selectedModel !== Model.PRIVATE && selectedModel !== Model.FLUX_KONTEX && selectedModel !== Model.FLUX_KONTEX_MAX_MULTI && !(selectedModel === Model.GPT4O && !isGpt41Unlocked)) {
        setAllSettings(prev => ({
            ...prev,
            [selectedModel]: { ...(ALL_MODEL_DEFAULT_SETTINGS[selectedModel] || ALL_MODEL_DEFAULT_SETTINGS[Model.GEMINI]!) }
        }));
    } else if (selectedModel === Model.GPT4O && isGpt41Unlocked) {
         setAllSettings(prev => ({
            ...prev,
            [selectedModel]: { ...(ALL_MODEL_DEFAULT_SETTINGS[selectedModel] || ALL_MODEL_DEFAULT_SETTINGS[Model.GEMINI]!) }
        }));
    }

    if (!isAiAgentMode && !isPrivateModeSelected && !isFluxKontexModelSelected) setActivePersonaId(null);
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
        if (audioPlayerRef.current && isSpeakingLiveTranslation) {
            audioPlayerRef.current.pause();
            setIsSpeakingLiveTranslation(false);
        }
    }
  }, [selectedModel, addNotification, isRealTimeTranslationMode, isSpeakingLiveTranslation, isGpt41Unlocked, isAiAgentMode, isPrivateModeSelected, isFluxKontexModelSelected, clearSearch]);

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
    if (isRealTimeTranslationMode || isAiAgentMode || isPrivateModeSelected || isFluxKontexModelSelected) {
      addNotification(`Cannot save chat to device in ${isRealTimeTranslationMode ? 'Real-Time Translation' : (isAiAgentMode ? 'AI Agent' : (isPrivateModeSelected ? 'Private' : 'Image Editing'))} mode.`, "info");
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
        // Ensure determinedSessionName is not empty
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
      modelSettingsSnapshot: { ...modelSettings },
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
  }, [messages, selectedModel, modelSettings, activeSessionId, currentChatName, activePersonaId, addNotification, isRealTimeTranslationMode, isAiAgentMode, isPrivateModeSelected, isFluxKontexModelSelected, savedSessions]);


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
            if (sessionToLoad.model === Model.REAL_TIME_TRANSLATION || sessionToLoad.model === Model.AI_AGENT || sessionToLoad.model === Model.PRIVATE || sessionToLoad.model === Model.FLUX_KONTEX || sessionToLoad.model === Model.FLUX_KONTEX_MAX_MULTI) {
                addNotification(`Cannot load "${sessionToLoad.model}" sessions from file.`, "info");
                return;
            }

            setMessages([...sessionToLoad.messages]);
            setSelectedModel(sessionToLoad.model);
            setActivePersonaId(sessionToLoad.activePersonaIdSnapshot || null);

            setAllSettings(prevAllSettings => ({
                ...prevAllSettings,
                [sessionToLoad.model]: {
                  ...(prevAllSettings[sessionToLoad.model] || ALL_MODEL_DEFAULT_SETTINGS[sessionToLoad.model]!),
                  ...sessionToLoad.modelSettingsSnapshot
                }
            }));

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

    if (userSession.isDemoUser && !userSession.isPaidUser) { // Check if demo AND not paid
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
    const ttsParams = {
        modelIdentifier: openAiTtsModelSettings?.modelIdentifier || 'tts-1',
        textInput: liveTranslationDisplay.replace(/\[.*?\]:\s*/g, '').trim(),
        voice: 'nova' as OpenAiTtsVoice,
        speed: openAiTtsModelSettings?.speed || 1.0,
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
  }, [liveTranslationDisplay, addNotification, allSettings, isListening, currentPlayingMessageId, isSpeakingLiveTranslation, userSession.isDemoUser, userSession.isPaidUser]);


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

  const pollFluxKontexStatus = useCallback(async (requestId: string, aiMessageId: string, userPrompt: string, fluxModelIdForPolling: string) => {
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
        setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Image editing timed out for: "${userPrompt}". Please try again.`, isRegenerating: false, fluxRequestId: undefined } : msg));
        addNotification("Flux Kontext image editing timed out.", "error");
        setIsLoading(false);
        return;
      }

      try {
        const statusResult = await checkFluxKontexStatusProxy(requestId, fluxModelIdForPolling);

        if (statusResult.status === 'COMPLETED') {
          if (intervalId) clearInterval(intervalId);
          if (statusResult.editedImageUrl) {
            setMessages(prev => prev.map(msg => msg.id === aiMessageId ? {
              ...msg,
              text: `Image edited based on your prompt: "${userPrompt}"`,
              imagePreviews: [statusResult.editedImageUrl!],
              imageMimeType: 'image/png', // Fal usually returns PNG for these models
              originalPrompt: userPrompt,
              isRegenerating: false,
              fluxRequestId: undefined,
              timestamp: msg.timestamp || Date.now()
            } : msg));
            addNotification("Image editing successful!", "success");
          } else {
            setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Image editing completed, but no image was returned. Prompt: "${userPrompt}"`, isRegenerating: false, fluxRequestId: undefined } : msg));
            addNotification("Flux Kontext: Processing completed, but no image was returned by the API.", "info", statusResult.rawResult ? JSON.stringify(statusResult.rawResult).substring(0, 200) : undefined);
          }
          setIsLoading(false);
          return;
        } else if (statusResult.status === 'IN_PROGRESS' || statusResult.status === 'IN_QUEUE') {
          notFoundCount = 0;
          setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Image editing: ${statusResult.status?.toLowerCase()} (ID: ${requestId}). Attempt ${pollCount}/${MAX_TOTAL_POLLS}...` } : msg));
        } else if (statusResult.status === 'NOT_FOUND') {
          notFoundCount++;
          if (notFoundCount > MAX_NOT_FOUND_POLLS) {
            if (intervalId) clearInterval(intervalId);
            const errorMessage = statusResult.error || `Request ID ${requestId} not found after several attempts.`;
            setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Error editing image: ${errorMessage}. Prompt: "${userPrompt}"`, isRegenerating: false, fluxRequestId: undefined } : msg));
            addNotification(`Flux Kontext Error: ${errorMessage}`, "error", statusResult.rawResult ? JSON.stringify(statusResult.rawResult).substring(0,200) : undefined);
            setIsLoading(false);
            return;
          }
          setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Image editing: Verifying request (ID: ${requestId}). Attempt ${pollCount}/${MAX_TOTAL_POLLS}...` } : msg));
        } else {
          if (intervalId) clearInterval(intervalId);
          const errorMessage = statusResult.error || "Unknown error during image editing.";
          setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Error editing image: ${errorMessage}. Prompt: "${userPrompt}"`, isRegenerating: false, fluxRequestId: undefined } : msg));
          addNotification(`Flux Kontext Error: ${errorMessage}`, "error", statusResult.rawResult ? JSON.stringify(statusResult.rawResult).substring(0,200) : undefined);
          setIsLoading(false);
        }
      } catch (pollingError: any) {
        if (intervalId) clearInterval(intervalId);
        setMessages(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: `Error checking image edit status: ${pollingError.message}. Prompt: "${userPrompt}"`, isRegenerating: false, fluxRequestId: undefined } : msg));
        addNotification(`Polling Error: ${pollingError.message}`, "error");
        setIsLoading(false);
      }
    };

    performPoll();
    intervalId = window.setInterval(performPoll, POLL_INTERVAL);
  }, [addNotification, setMessages, setIsLoading]);


  const internalSendMessage = async (
    currentInputText: string,
    currentUploadedImageFiles: File[], // Changed from single File to array
    currentUploadedImagePreviews: string[], // Changed from single string to array
    currentUploadedTextContent: string | null,
    currentUploadedTextFileName: string | null,
    isRegenerationOfAiMsgId?: string
  ) => {

    const messageTimestamp = Date.now();
    const userMessageId = messageTimestamp.toString();
    let userDisplayedText = currentInputText.trim();
    let textForApi = currentInputText.trim();

    const fileContextNote = `(System Note: User uploaded a file named '${currentUploadedTextFileName}'. Its content is not directly available to you. Please refer to your system instructions on how to handle this situation.)`;

    if (isAiAgentMode) {
        if (currentUploadedTextFileName && currentUploadedTextContent) {
            textForApi = `Content from uploaded file "${currentUploadedTextFileName}":\n${currentUploadedTextContent}\n\n---\n\nUser's goal: ${textForApi}`;
        } else if (currentUploadedTextFileName && !currentUploadedTextContent && currentUploadedImagePreviews.length === 0) {
            textForApi = `${fileContextNote}\n\nUser's goal: ${textForApi}`;
        }
    } else if (currentUploadedTextFileName && currentUploadedTextContent) {
        textForApi = `The user has uploaded a file named "${currentUploadedTextFileName}".\nThe content of this file is:\n${currentUploadedTextContent}\n\n---\n\n${textForApi}`;
    }

    const newUserMessage: ChatMessage = {
        id: userMessageId,
        text: userDisplayedText,
        sender: 'user',
        timestamp: messageTimestamp,
        imagePreview: selectedModel !== Model.FLUX_KONTEX_MAX_MULTI && currentUploadedImagePreviews.length > 0 ? currentUploadedImagePreviews[0] : undefined,
        imagePreviews: selectedModel === Model.FLUX_KONTEX_MAX_MULTI ? currentUploadedImagePreviews : undefined,
        imageMimeTypes: selectedModel === Model.FLUX_KONTEX_MAX_MULTI ? currentUploadedImageFiles.map(f => f.type) : undefined,
        fileName: currentUploadedTextFileName || undefined,
        isImageQuery: isImagenModelSelected || isFluxKontexModelSelected,
        isTaskGoal: isAiAgentMode,
        isNote: isPrivateModeSelected && (currentUploadedImagePreviews.length === 0 && !currentUploadedTextFileName),
        model: isPrivateModeSelected ? Model.PRIVATE : undefined,
    };

    if (!isRegenerationOfAiMsgId) {
        setMessages((prev) => [...prev, newUserMessage]);
    }

    const aiMessageTimestamp = Date.now();
    const aiMessageId = isRegenerationOfAiMsgId || (aiMessageTimestamp + 1).toString();
    const actualModelIdentifierForFlux = isFluxKontexModelSelected ? getActualModelIdentifier(selectedModel) : undefined;


    let aiPlaceholderText = isRegenerationOfAiMsgId ? 'Regenerating...' : '';
    if (!isRegenerationOfAiMsgId) {
        if (isImagenModelSelected) aiPlaceholderText = 'Generating image(s)...';
        else if (isFluxKontexModelSelected) aiPlaceholderText = 'Submitting image for editing...';
        else if (isTextToSpeechModelSelected) aiPlaceholderText = 'Synthesizing audio...';
        else if (isAiAgentMode) aiPlaceholderText = 'AI Agent is processing your goal...';
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
        isTaskPlan: isAiAgentMode,
        originalPrompt: userDisplayedText,
        fluxModelId: isFluxKontexModelSelected ? actualModelIdentifierForFlux : undefined,
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

    // User Type Checks and Header Setup
    let requestHeaders: HeadersInit = { 'Content-Type': 'application/json' };
    if (userSession.isPaidUser && userSession.paidUsername) { 
        requestHeaders['X-Paid-User-Token'] = userSession.paidUsername;
    } else if (userSession.isDemoUser && userSession.demoUserToken) {
        if (isFluxKontexModelSelected || isImagenModelSelected || isTextToSpeechModelSelected) {
             requestHeaders['X-Demo-Token'] = userSession.demoUserToken;
        }
    }

    // Check Limits
    if (!userSession.isPaidUser && userSession.isDemoUser) { 
        const limits = userSession.demoLimits;
        let limitExceeded = false;
        let notificationMessage = "";

        if (isFluxKontexModelSelected) {
            if (!limits || limits.fluxKontextUsesLeft <= 0) {
                limitExceeded = true;
                notificationMessage = "Đã hết lượt 2 lần dùng thử Flux Kontext. Vui lòng liên hệ facebook admin Lee Thinh để mua gói hằng tháng giá rẻ.";
            }
        } else if (isImagenModelSelected) {
            const imagenSettings = modelSettings as ImagenSettings;
            const numImagesToGen = imagenSettings.numberOfImages || 1;
            if (!limits || limits.imagen3ImagesLeft < numImagesToGen) {
                limitExceeded = true;
                notificationMessage = `Not enough Imagen3 demo uses left. Need ${numImagesToGen}, have ${limits?.imagen3ImagesLeft || 0}.`;
            }
        } else if (isTextToSpeechModelSelected) {
            if (!limits || currentInputText.length > limits.openaiTtsCharsLeft) {
                 limitExceeded = true;
                 notificationMessage = `OpenAI TTS character limit exceeded for DEMO. Need ${currentInputText.length}, have ${limits?.openaiTtsCharsLeft || 0} left.`;
            }
        }
        if (limitExceeded) {
            addNotification(notificationMessage, "error");
            setIsLoading(false);
            setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
            return;
        }
    }
    
    if (userSession.isPaidUser && userSession.paidLimits) {
        // Paid user limits are checked by proxy or based on subscription status mostly
    }


    try {
      const currentModelSpecificSettings = modelSettings as ModelSettings & ImagenSettings & OpenAITtsSettings & RealTimeTranslationSettings & AiAgentSettings & PrivateModeSettings & FluxKontexSettings;
      const currentModelStatus = apiKeyStatuses[selectedModel];
      const actualModelIdentifier = getActualModelIdentifier(selectedModel);

      let apiResponseData: any;

      if (currentModelStatus?.isTextToSpeech && !currentModelStatus.isMock) {
          const ttsBody = {
            modelIdentifier: currentModelSpecificSettings.modelIdentifier || 'tts-1',
            textInput: userDisplayedText,
            voice: currentModelSpecificSettings.voice || 'alloy',
            speed: currentModelSpecificSettings.speed || 1.0
          };
          const ttsFetchResponse = await fetch('/api/openai/tts/generate', {
              method: 'POST', headers: requestHeaders, body: JSON.stringify(ttsBody)
          });

          if (!ttsFetchResponse.ok) {
              apiResponseData = await safeResponseJson(ttsFetchResponse);
              throw new Error(apiResponseData.error || `OpenAI TTS Proxy Error: ${ttsFetchResponse.statusText}`);
          }
          const audioBlob = await ttsFetchResponse.blob();

          setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? {
              ...msg, text: `Audio generated for: "${userDisplayedText}"`, audioUrl: URL.createObjectURL(audioBlob), isRegenerating: false, timestamp: msg.timestamp || Date.now()
          } : msg));
          if (audioPlayerRef.current) handlePlayAudio(URL.createObjectURL(audioBlob), aiMessageId);

          if (userSession.isDemoUser && !userSession.isPaidUser) {
              onUpdateDemoLimits({ openaiTtsCharsLeft: (userSession.demoLimits?.openaiTtsCharsLeft || 0) - userDisplayedText.length });
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
          } else { // Standard Flux Kontext (single image)
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

          const fluxResult = await editImageWithFluxKontexProxy({
              modelIdentifier: actualModelIdentifier, // This is 'fal-ai/flux-pro/kontext' or 'fal-ai/flux-pro/kontext/max/multi'
              prompt: textForApi,
              settings: currentModelSpecificSettings as FluxKontexSettings,
              imageData: fluxImageData
          });
          
          if (fluxResult.error) throw new Error(fluxResult.error);

          if (fluxResult.requestId) {
            setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? {
                ...msg, text: fluxResult.message || `Image editing submitted (ID: ${fluxResult.requestId}). Waiting for results...`, fluxRequestId: fluxResult.requestId, isRegenerating: false, timestamp: msg.timestamp || Date.now(), fluxModelId: actualModelIdentifier
            } : msg));
            pollFluxKontexStatus(fluxResult.requestId, aiMessageId, userDisplayedText, actualModelIdentifier); // Pass model ID for polling
            if (userSession.isDemoUser && !userSession.isPaidUser) {
                onUpdateDemoLimits({ fluxKontextUsesLeft: (userSession.demoLimits?.fluxKontextUsesLeft || 0) - 1 });
            }
          } else { throw new Error(fluxResult.error || "Flux Kontext submission failed (no request ID)."); }

      } else if (isImagenModelSelected && !currentModelStatus.isMock) {
          const imagenBody = { prompt: userDisplayedText, modelSettings: currentModelSpecificSettings as ImagenSettings, modelName: actualModelIdentifier };
          const imagenFetchResponse = await fetch('/api/gemini/image/generate', {
              method: 'POST', headers: requestHeaders, body: JSON.stringify(imagenBody)
          });
          apiResponseData = await safeResponseJson(imagenFetchResponse);
          if (!imagenFetchResponse.ok || apiResponseData.error) {
              throw new Error(apiResponseData.error || `Imagen Proxy Error: ${imagenFetchResponse.statusText}`);
          }

          if (apiResponseData.generatedImages && apiResponseData.generatedImages.length > 0) {
            const mimeType = (currentModelSpecificSettings as ImagenSettings).outputMimeType || 'image/jpeg';
            const imageUrls = apiResponseData.generatedImages.map((img: any) => `data:${mimeType};base64,${img.image.imageBytes}`);
            setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? {
                    ...msg, text: `Generated ${imageUrls.length} image(s) for: "${userDisplayedText}"`,
                    imagePreviews: imageUrls, imageMimeType: mimeType, originalPrompt: userDisplayedText, isRegenerating: false,
                    timestamp: msg.timestamp || Date.now()
                  } : msg ));
            if (userSession.isDemoUser && !userSession.isPaidUser) {
                const numGenerated = apiResponseData.generatedImages.length;
                onUpdateDemoLimits({ imagen3ImagesLeft: (userSession.demoLimits?.imagen3ImagesLeft || 0) - numGenerated });
            }
          } else { throw new Error(apiResponseData.error || "Image generation failed (no images returned)."); }

      } else if (currentModelStatus?.isGeminiPlatform && !currentModelStatus.isMock && !isRealTimeTranslationMode && !isPrivateModeSelected) {
        const geminiHistory: Content[] = messagesToGeminiHistory(messages, aiMessageId, newUserMessage.id, isAiAgentMode);

        const currentUserParts: Part[] = [];
        if (textForApi.trim()) {
            currentUserParts.push({ text: textForApi.trim() });
        }
        if (!isAiAgentMode && currentUploadedTextFileName && !currentUploadedTextContent && currentUploadedImageFiles.length === 0) {
            currentUserParts.push({ text: fileContextNote });
        }
        if (currentUploadedImageFiles.length > 0 && currentUploadedImagePreviews.length > 0) { // Only process if files and previews exist
            const base64Image = currentUploadedImagePreviews[0].split(',')[1]; // Assuming single image for Gemini for now
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
          historyContents: geminiHistory, modelSettings: currentModelSpecificSettings as ModelSettings, enableGoogleSearch: isAiAgentMode || isWebSearchEnabled, modelName: actualModelIdentifier,
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

        const history: ApiChatMessage[] = messagesToOpenAIHistory(messages, aiMessageId, newUserMessage.id, currentModelSpecificSettings.systemInstruction, textForApi, activeImageFileForOpenAI, activeImagePreviewForOpenAI, currentUploadedTextFileName, currentUploadedTextContent, isRegen, isRegenerationOfAiMsgId);

        const stream = sendOpenAIMessageStream({ modelIdentifier: actualModelIdentifier, history, modelSettings: currentModelSpecificSettings as ModelSettings });
        let currentText = '';
        for await (const chunk of stream) {
          if (chunk.error) throw new Error(chunk.error);
          if (chunk.textDelta) currentText += chunk.textDelta;
          setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? { ...msg, text: currentText, isRegenerating: false } : msg));
          if (chunk.isFinished) break;
        }

      } else if (selectedModel === Model.DEEPSEEK && !currentModelStatus.isMock) {
        const history: ApiChatMessage[] = [{ role: 'system', content: currentModelSpecificSettings.systemInstruction }];
         messages.filter(m => m.id !== aiMessageId && m.id !== newUserMessage.id).forEach(msg => {
            let msgContent = msg.text || " ";
            if (msg.sender === 'user' && msg.fileName && !msg.imagePreview && !TEXT_READABLE_EXTENSIONS.some(ext => msg.fileName?.toLowerCase().endsWith(ext))) {
                msgContent += `\n(System Note: User previously uploaded a file named '${msg.fileName}'. Its content was not directly available.)`;
            }
            if (msg.sender === 'user') history.push({ role: 'user', content: msgContent });
            else if (msg.sender === 'ai') history.push({ role: 'assistant', content: msgContent });
        });
        let currentTurnTextForDeepseek = textForApi.trim();
        if (currentUploadedTextFileName && !currentUploadedTextContent && currentUploadedImageFiles.length === 0) {
            currentTurnTextForDeepseek = `${currentTurnTextForDeepseek}\n\n${fileContextNote}`;
        }
        history.push({ role: 'user', content: currentTurnTextForDeepseek || " " });

        const stream = sendDeepseekMessageStream({ modelIdentifier: actualModelIdentifier, history, modelSettings: currentModelSpecificSettings as ModelSettings });
        let currentText = '';
        for await (const chunk of stream) {
          if (chunk.error) throw new Error(chunk.error);
          if (chunk.textDelta) currentText += chunk.textDelta;
          setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? { ...msg, text: currentText, isRegenerating: false } : msg));
          if (chunk.isFinished) break;
        }

      } else if (currentModelStatus?.isMock && !isRealTimeTranslationMode && !isAiAgentMode && !isPrivateModeSelected && !isFluxKontexModelSelected) {
        const mockParts: Part[] = [];
        if (textForApi.trim()) mockParts.push({ text: textForApi.trim() });
        if (currentUploadedTextFileName && !currentUploadedTextContent && currentUploadedImageFiles.length === 0) {
            mockParts.push({ text: fileContextNote });
        }
        if (currentUploadedImageFiles.length > 0 && currentUploadedImagePreviews.length > 0) {
            mockParts.push({ inlineData: { mimeType: currentUploadedImageFiles[0].type as 'image/jpeg' | 'image/png', data: currentUploadedImagePreviews[0].split(',')[1] } });
        }
        const stream = sendMockMessageStream(mockParts, selectedModel, currentModelSpecificSettings as ModelSettings);
        let currentText = '';
        for await (const chunk of stream) {
          currentText += chunk;
          setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? { ...msg, text: currentText, isRegenerating: false } : msg));
        }
      } else if (!isRealTimeTranslationMode && !isPrivateModeSelected && !isFluxKontexModelSelected) {
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

    if (!isFluxKontexModelSelected || (isFluxKontexModelSelected && !messages.find(m => m.id === aiMessageId)?.fluxRequestId)) {
      setIsLoading(false);
    }

    if (!isRegenerationOfAiMsgId && !isRealTimeTranslationMode && !isPrivateModeSelected) {
        setInput('');
        if (!isFluxKontexModelSelected) { // Only clear for non-Flux models after send
            setUploadedImages([]);
            setImagePreviews([]);
        }
        setUploadedTextFileContent(null);
        setUploadedTextFileName(null);
    }
    clearSearch();
  };

  const handleSendMessage = async () => {
    if (isRealTimeTranslationMode || isListening) return;

    let determinedTtsMaxLength = OPENAI_TTS_MAX_INPUT_LENGTH; // Default (usually paid user limit from constants)
    if (userSession.isDemoUser && !userSession.isPaidUser && userSession.demoLimits) {
        determinedTtsMaxLength = userSession.demoLimits.openaiTtsMaxChars;
    } else if (userSession.isPaidUser && userSession.paidLimits) {
        determinedTtsMaxLength = userSession.paidLimits.openaiTtsMaxChars;
    }

    if (isImagenModelSelected && !input.trim()) {
        setError("Please enter a prompt for image generation.");
        addNotification("Please enter a prompt for image generation.", "info");
        return;
    }
    if (isFluxKontexModelSelected) {
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
    if (isTextToSpeechModelSelected && !input.trim()) {
        setError("Please enter text for speech synthesis.");
        addNotification("Please enter text for speech synthesis.", "info");
        return;
    }
    if (isTextToSpeechModelSelected && input.length > determinedTtsMaxLength) {
        setError(`Input for TTS exceeds maximum length of ${determinedTtsMaxLength} characters for your account type.`);
        addNotification(`TTS input too long. Max ${determinedTtsMaxLength} chars.`, "error");
        return;
    }
    if (isAiAgentMode && !input.trim() && uploadedImages.length === 0 && !uploadedTextFileName) {
        setError("Please enter a goal or upload a file for the AI Agent.");
        addNotification("Please enter a goal or upload a file for the AI Agent.", "info");
        return;
    }
     if (isPrivateModeSelected && !input.trim() && uploadedImages.length === 0 && !uploadedTextFileName) {
        setError("Please enter text, or upload an image/file to log in Private Mode.");
        addNotification("Please enter text, or upload an image/file to log in Private Mode.", "info");
        return;
    }
    if (!isImagenModelSelected && !isTextToSpeechModelSelected && !isAiAgentMode && !isPrivateModeSelected && !isFluxKontexModelSelected && !input.trim() && uploadedImages.length === 0 && !uploadedTextFileName) {
        return;
    }

    setIsLoading(true);
    setError(null);
    
    await internalSendMessage(input, uploadedImages, imagePreviews, uploadedTextFileContent, uploadedTextFileName);
  };

  const handleRegenerateResponse = async (aiMessageIdToRegenerate: string, promptedByMsgId: string) => {
      if (isRealTimeTranslationMode || isAiAgentMode || isPrivateModeSelected || isFluxKontexModelSelected) return;
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
      
      // For regeneration, we assume the File objects are not available. We'll work with previews.
      // Construct temporary File-like objects if needed by downstream, or rely on previews.
      // For this flow, if it's regenerating a message that had an image, we'll use its preview.
      const regenUploadedImageFiles: File[] = []; // Cannot reconstruct File objects easily for regen
      
      let currentRegenUploadedTextContent: string | null = null; // TODO: Persist text file content if regen needed
      let currentRegenUploadedTextFileName: string | null = userMessageForRegen.fileName || null;

      setMessages(prev => prev.map(msg => {
          if (msg.id === aiMessageIdToRegenerate) {
              let regeneratingText = 'Regenerating...';
              if (msg.model === Model.IMAGEN3) regeneratingText = 'Regenerating image(s)...';
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

  const imageUploadLimit = useMemo(() => selectedModel === Model.FLUX_KONTEX_MAX_MULTI ? 4 : 1, [selectedModel]);

  const handleSetUploadedImages = (newFiles: File[]) => {
    if (isTextToSpeechModelSelected || isRealTimeTranslationMode || isPrivateModeSelected) return;
  
    let currentFiles: File[] = [];
    let currentPreviews: string[] = [];
  
    if (selectedModel === Model.FLUX_KONTEX_MAX_MULTI) {
      // For Flux Max, append new files to existing ones, respecting the limit.
      const combinedFiles = [...uploadedImages, ...newFiles];
      currentFiles = combinedFiles.slice(0, imageUploadLimit);
  
      if (combinedFiles.length > imageUploadLimit) {
        addNotification(`Cannot upload more than ${imageUploadLimit} images for Flux Kontext Max. Only the first ${imageUploadLimit} were kept.`, "warning");
      }
    } else {
      // For other models (including standard Flux Kontext), replace with the new file (limit 1).
      currentFiles = newFiles.slice(0, 1);
    }
  
    setUploadedImages(currentFiles);
    // Clear text file content if any image is uploaded, for all models that support image upload.
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
        })
        .catch(error => {
          console.error("Error reading image files for preview:", error);
          addNotification("Error creating image previews.", "error");
          setImagePreviews([]); // Clear previews on error
        });
    } else {
      setImagePreviews([]); // Clear previews if no files are valid/left
    }
  
    clearSearch();
  };


  const handleFileUpload = (file: File | null) => {
    if (isImagenModelSelected || isTextToSpeechModelSelected || isRealTimeTranslationMode || isFluxKontexModelSelected || isClaudeModelSelected) return;

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
        if (isAiAgentMode) {
            addNotification(`File "${file.name}" content cannot be displayed/embedded. AI Agent will be notified of the filename.`, "info");
        } else if (isPrivateModeSelected) {
            addNotification(`File "${file.name}" logged. Content not displayed for this type.`, "info");
        } else {
            addNotification(`File "${file.name}" content cannot be displayed/embedded. This model might not process it.`, "warning" as NotificationType);
        }
      }
    } else { setUploadedTextFileContent(null); setUploadedTextFileName(null); }
    clearSearch();
  };

  const handleRemoveUploadedImage = (indexToRemove: number) => {
    setUploadedImages(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    setImagePreviews(prevPreviews => prevPreviews.filter((_, index) => index !== indexToRemove));
  };

  const handleRemoveTextFilePreview = () => {
    handleFileUpload(null); // This already clears text file content and name
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
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const atBottomThreshold = 1;
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + atBottomThreshold;

      if (isAtBottom) {
        if (showScrollToBottomButton) setShowScrollToBottomButton(false);
      } else {
        if (!showScrollToBottomButton) setShowScrollToBottomButton(true);
      }
    }
  }, [showScrollToBottomButton]);

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
            <button onClick={() => setActiveSidebarTab('settings')} disabled={isLoading && !isRealTimeTranslationMode }
                className={`flex-1 py-2 px-4 text-sm font-medium text-center rounded-t-lg focus:outline-none flex items-center justify-center ${activeSidebarTab === 'settings' ? 'bg-primary text-white dark:bg-primary-light dark:text-neutral-darker' : 'text-neutral-600 dark:text-neutral-300 hover:bg-secondary/50 dark:hover:bg-neutral-dark/50'}`}
                aria-pressed={activeSidebarTab === 'settings'} >
                <CogIcon className="w-5 h-5 mr-2"/> Settings
            </button>
            <button onClick={() => setActiveSidebarTab('history')} disabled={isLoading && !isRealTimeTranslationMode }
                className={`flex-1 py-2 px-4 text-sm font-medium text-center rounded-t-lg focus:outline-none flex items-center justify-center ${activeSidebarTab === 'history' ? 'bg-primary text-white dark:bg-primary-light dark:text-neutral-darker' : 'text-neutral-600 dark:text-neutral-300 hover:bg-secondary/50 dark:hover:bg-neutral-dark/50'}`}
                aria-pressed={activeSidebarTab === 'history'} >
                <HistoryIcon className="w-5 h-5 mr-2"/> History
            </button>
        </div>
        {activeSidebarTab === 'settings' && (
            <SettingsPanel
                selectedModel={selectedModel}
                onModelChange={(model) => {
                    if (model !== Model.GPT4O) gpt41ModalInteractionFlagRef.current = false;
                    setSelectedModel(model);
                    clearSearch();
                }}
                modelSettings={modelSettings as ModelSettings & ImagenSettings & OpenAITtsSettings & RealTimeTranslationSettings & AiAgentSettings & PrivateModeSettings & FluxKontexSettings}
                onModelSettingsChange={handleModelSettingsChange}
                isWebSearchEnabled={isWebSearchEnabled}
                onWebSearchToggle={setIsWebSearchEnabled}
                disabled={(isLoading && !isRealTimeTranslationMode ) || isGpt41AccessModalOpen}
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
                isLoading={(isLoading && !isRealTimeTranslationMode ) || isGpt41AccessModalOpen}
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
    if (isTextToSpeechModelSelected || isImagenModelSelected || isClaudeModelSelected) return false;
    return true;
  }, [isSpeechRecognitionSupported, selectedModel, isTextToSpeechModelSelected, isImagenModelSelected, isClaudeModelSelected]);

  const showImageUploadInChatBar = useMemo(() => {
    return !isTextToSpeechModelSelected &&
           !isRealTimeTranslationMode &&
           selectedModel !== Model.DEEPSEEK &&
           !isImagenModelSelected &&
           !isAiAgentMode &&
           !isClaudeModelSelected;
  }, [selectedModel, isTextToSpeechModelSelected, isRealTimeTranslationMode, isImagenModelSelected, isAiAgentMode, isClaudeModelSelected]);

  const showFileUploadInChatBar = useMemo(() => {
    return !isImagenModelSelected &&
           !isTextToSpeechModelSelected &&
           !isRealTimeTranslationMode &&
           !isFluxKontexModelSelected &&
           !isClaudeModelSelected;
  }, [selectedModel, isImagenModelSelected, isTextToSpeechModelSelected, isRealTimeTranslationMode, isFluxKontexModelSelected, isClaudeModelSelected]);


  const currentPromptPlaceholder = () => {
    if (isListening && !isRealTimeTranslationMode) return "Đang nghe...";
    if (isImagenModelSelected) return "Enter prompt for image generation...";
    if (isFluxKontexModelSelected) return "Enter prompt to edit uploaded image...";
    if (isTextToSpeechModelSelected) return "Enter text to synthesize speech...";
    if (isRealTimeTranslationMode) return "Real-Time Translation Active. Use Microphone.";
    if (isAiAgentMode) return "Enter main goal for AI Agent, or upload file...";
    if (isPrivateModeSelected) return "Enter text or upload image/file to log locally...";
    if (isClaudeModelSelected) return "Chat with Claude (Mock)...";

    let placeholder = "Type your message";
    if (uploadedImages.length === 0 && imagePreviews.length === 0 && !uploadedTextFileName) {
        const canUploadImage = showImageUploadInChatBar;
        const canUploadFile = showFileUploadInChatBar;
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
    if (isImagenModelSelected) return "Generate Image";
    if (isFluxKontexModelSelected) return "Edit Image";
    if (isTextToSpeechModelSelected) return "Synthesize Speech";
    if (isAiAgentMode) return "Set Goal";
    if (isPrivateModeSelected) return "Log Entry";
    return "Send message";
  }

  const sendButtonIcon = () => {
    if (isImagenModelSelected) return <PromptIcon className="w-6 h-6" />;
    if (isFluxKontexModelSelected) return <EditIcon className="w-6 h-6" />;
    if (isTextToSpeechModelSelected) return <SpeakerWaveIcon className="w-6 h-6" />;
    if (isAiAgentMode || isPrivateModeSelected) return <PaperAirplaneIcon className="w-6 h-6" />;
    return <PaperAirplaneIcon className="w-6 h-6" />;
  }

  const targetTranslationLangName = useMemo(() => {
    if (isRealTimeTranslationMode) {
      const targetCode = (modelSettings as RealTimeTranslationSettings).targetLanguage || 'en';
      return TRANSLATION_TARGET_LANGUAGES.find(l => l.code === targetCode)?.name || targetCode;
    }
    return '';
  }, [isRealTimeTranslationMode, modelSettings]);


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


   // Function to convert message history to Gemini Content format
   const messagesToGeminiHistory = (
    allMessages: ChatMessage[],
    currentAiMessageId: string | null, // ID of the AI message currently being generated (to exclude it)
    currentUserMessageId: string | null, // ID of the user message that triggered this AI response (to include it properly)
    isAgentMode: boolean
  ): Content[] => {
    const history: Content[] = [];
    let systemInstructionUsed = false;

    allMessages.forEach(msg => {
        // Skip the AI message placeholder that's currently being filled or irrelevant notes
        if (msg.id === currentAiMessageId || (msg.isNote && !isAgentMode)) return;
        // Skip AI agent messages if not in agent mode (though this might be too restrictive)
        if (msg.isTaskPlan && !isAgentMode) return;


        let role: 'user' | 'model' = 'user'; // Default to user
        if (msg.sender === 'ai') role = 'model';

        const parts: Part[] = [];
        if (msg.text) {
            let textForHistory = msg.text;
            if (msg.isTaskGoal && isAgentMode && msg.sender === 'user') {
                textForHistory = `User's goal: ${msg.text}`;
            } else if (msg.isTaskPlan && isAgentMode && msg.sender === 'ai') {
                 textForHistory = `AI Agent's plan/response: ${msg.text}`;
            }
            parts.push({ text: textForHistory });
        }

        // Handle images uploaded by the user for Gemini multimodal
        // For Gemini, this is singular `imagePreview`
        if (msg.sender === 'user' && msg.imagePreview && !msg.isImageQuery && (!msg.imagePreviews || msg.imagePreviews.length === 0)) { 
            try {
                const base64Data = msg.imagePreview.split(',')[1];
                const mimeTypeMatch = msg.imagePreview.match(/data:(image\/[a-zA-Z0-9-.+]+);base64/);
                if (base64Data && mimeTypeMatch && mimeTypeMatch[1]) {
                    parts.push({ inlineData: { mimeType: mimeTypeMatch[1], data: base64Data } });
                }
            } catch (e) { console.error("Error processing image for Gemini history:", e); }
        }
        // Note: AI-generated images (msg.imagePreviews) are not sent back in history for Gemini

        if (parts.length > 0) {
            history.push({ role, parts });
        }
    });

    // For Gemini, system instruction is part of the modelSettings/config, not a message role directly.
    // The main `modelSettings.systemInstruction` is applied in the service call.
    // This function ensures messages are formatted correctly for the `contents` array.

    return history;
  };

  const messagesToOpenAIHistory = (
    allMessages: ChatMessage[],
    currentAiMessageId: string | null,
    currentUserMessageId: string | null,
    systemInstruction: string,
    currentInputTextForApi: string,
    currentActiveImageFile: File | null, // Singular for OpenAI GPT-4 vision
    currentActiveImagePreview: string | null, // Singular for OpenAI GPT-4 vision
    currentUploadedTextFileName: string | null,
    currentUploadedTextContent: string | null,
    isRegeneration: boolean,
    isRegenerationOfAiMsgId?: string // Added parameter
  ): ApiChatMessage[] => {
    const history: ApiChatMessage[] = [{ role: 'system', content: systemInstruction }];

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
        
        // For OpenAI, only send msg.imagePreview (singular) if it's a user message
        if (role === 'user' && msg.imagePreview && !msg.isImageQuery && (!msg.imagePreviews || msg.imagePreviews.length === 0)) {
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

        if (currentUploadedTextFileName) {
            if (currentUploadedTextContent) {
                textForCurrentTurn = `The user has uploaded a file named "${currentUploadedTextFileName}".\nThe content of this file is:\n${currentUploadedTextContent}\n\n---\n\n${textForCurrentTurn}`;
            } else if (!currentActiveImageFile) { 
                textForCurrentTurn = `${textForCurrentTurn}\n\n(System Note: User uploaded a file named '${currentUploadedTextFileName}'. Its content is not directly available to you.)`;
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
            // If only system prompt and nothing from user (and not a regeneration), it's an empty message.
        }
    }

    return history;
  };

  const imageFileAcceptTypes = "image/jpeg, image/png, image/webp, image/gif, image/avif";
  const generalFileAcceptTypes = ".txt,.md,.json,.js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.h,.hpp,.cs,.go,.rs,.rb,.php,.html,.htm,.css,.scss,.less,.xml,.yaml,.yml,.ini,.sh,.bat,.ps1,.sql,.csv,.log,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation";

  const generalChatBarInteractionDisabled = (isLoading && !isRealTimeTranslationMode) || isListening || (isGpt41AccessModalOpen && selectedModel === Model.GPT4O);

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
    if (isTextToSpeechModelSelected || isRealTimeTranslationMode || isImagenModelSelected || isClaudeModelSelected) {
        return false;
    }
    if (imagePreviews.length > 0 || uploadedTextFileName) {
        return true;
    }
    return false;
  }, [imagePreviews, uploadedTextFileName, isTextToSpeechModelSelected, isRealTimeTranslationMode, isImagenModelSelected, isClaudeModelSelected]);


  return (
    <div className={`h-full flex flex-col relative ${userSession.isDemoUser && userSession.isDemoBlockedByVpn ? 'filter blur-sm pointer-events-none' : ''}`}>
      {userSession.isDemoUser && userSession.isDemoBlockedByVpn && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <p className="text-white text-2xl font-bold p-8 bg-red-700 rounded-lg shadow-xl">
                DEMO Access Restricted (VPN/Proxy Detected)
            </p>
        </div>
      )}
      {userSession.isPaidUser && userSession.paidSubscriptionEndDate && (
        <div className="bg-green-600 text-white text-xs text-center py-0.5 px-2 sticky top-0 z-40">
          Paid User: {userSession.paidUsername} | Subscription ends: {new Date(userSession.paidSubscriptionEndDate).toLocaleDateString()}
        </div>
      )}
      <div className="flex-grow flex overflow-hidden min-h-0"> {/* This is MAIN_CONTENT_AREA in App.tsx */}
        {/* Sidebar */}
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
                    className="p-2 rounded-full hover:bg-secondary dark:hover:bg-neutral-dark relative z-10" // Ensure button is clickable
                    aria-label="Close settings and history panel"
                >
                    <XMarkIcon className="w-6 h-6 text-neutral-darker dark:text-secondary-light"/>
                </button>
            </div>
            <div className="flex-grow overflow-y-auto overflow-x-hidden p-3 pt-0 md:pt-3 min-h-0"> {/* Added overflow-x-hidden */}
                {sidebarContent}
            </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden" style={chatAreaStyle}>
           <audio ref={audioPlayerRef} className="hidden" />
           {/* GPT-4.1 Access Modal */}
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
                <ChatBubbleLeftRightIcon className="w-6 h-6 text-primary dark:text-primary-light mr-2 flex-shrink-0"/>
                <h2 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light truncate" title={displayedChatTitle}>
                    {displayedChatTitle}
                </h2>
            </div>
            {!isRealTimeTranslationMode && (
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
            {isSearchActive && !isRealTimeTranslationMode && (
                <button onClick={clearSearch} className="p-1.5 text-red-500 hover:text-red-700 ml-1" aria-label="Clear search">
                    <XMarkIcon className="w-4 h-4"/>
                </button>
            )}
          </div>
          {isSearchActive && searchResults.length > 0 && !isRealTimeTranslationMode && (
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

          {/* Conditional rendering for chat messages OR Real-Time Translation UI */}
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
            ) : (
                <div ref={chatContainerRef} className="flex-grow min-h-0 p-4 space-y-4 overflow-y-auto">
                    {messages.map((msg, index) => (
                        <div ref={(el: HTMLDivElement | null) => { messageRefs.current[msg.id] = el; }} key={msg.id} className="flex justify-start"> {/* All messages justify-start */}
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
                    <div ref={chatEndRef} /> {/* For scrolling to bottom */}
                </div>
            )}
           {showScrollToBottomButton && !isRealTimeTranslationMode && (
              <button
                onClick={scrollToBottomUiButton}
                className="absolute bottom-24 right-6 sm:bottom-28 sm:right-10 p-2.5 bg-primary dark:bg-primary-light text-white rounded-full shadow-lg hover:bg-primary-dark dark:hover:bg-primary transition-colors z-20"
                aria-label="Scroll to bottom"
              >
                <ChevronDownIcon className="w-5 h-5" />
              </button>
            )}
          {error && <p className="p-4 text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/30 border-t border-red-200 dark:border-red-700 text-sm">{error}</p>}

          {/* Attachment Previews Area */}
          {showGenericAttachmentPreview && (imagePreviews.length > 0 || uploadedTextFileName) && (
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
                    {uploadedTextFileName && (
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


          {/* Hidden file inputs for chat bar buttons */}
          <input type="file" id="image-upload-chatbar" className="hidden" onChange={handleChatBarImageUpload} accept={imageFileAcceptTypes} multiple={isFluxKontexModelSelected} />
          <input type="file" id="file-upload-chatbar" className="hidden" onChange={handleChatBarGeneralFileUpload} accept={generalFileAcceptTypes} />

          {/* Input Area */}
          <div className="p-3 border-t border-secondary dark:border-neutral-darkest bg-neutral-light dark:bg-neutral-darker flex items-end flex-shrink-0">
            {showMicrophoneButton && (
                <button onClick={handleToggleListen} disabled={generalChatBarInteractionDisabled}
                    className={`p-2.5 rounded-full transition-colors flex-shrink-0 mr-2
                                ${isListening ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' : 'bg-secondary dark:bg-neutral-darkest hover:bg-secondary-dark dark:hover:bg-neutral-dark text-neutral-darker dark:text-secondary-light'}
                                disabled:opacity-50`}
                    aria-label={isListening ? "Stop voice input" : "Start voice input"}
                    title={isListening ? "Stop Listening" : "Start Voice Input"}
                >
                    {isListening ? <StopCircleIcon className="w-5 h-5"/> : <MicrophoneIcon className="w-5 h-5"/>}
                </button>
            )}

            {/* Attachment Buttons */}
            {!isRealTimeTranslationMode && showImageUploadInChatBar && (
              <button
                onClick={() => document.getElementById('image-upload-chatbar')?.click()}
                disabled={generalChatBarInteractionDisabled || uploadedImages.length >= imageUploadLimit }
                className="p-2.5 rounded-full transition-colors flex-shrink-0 mr-1.5 text-neutral-darker dark:text-secondary-light hover:bg-secondary dark:hover:bg-neutral-dark disabled:opacity-50"
                aria-label="Upload image"
                title="Upload Image"
              >
                <PhotoIcon className="w-5 h-5"/>
              </button>
            )}
            {!isRealTimeTranslationMode && showFileUploadInChatBar && (
              <button
                onClick={() => document.getElementById('file-upload-chatbar')?.click()}
                disabled={generalChatBarInteractionDisabled}
                className="p-2.5 rounded-full transition-colors flex-shrink-0 mr-2 text-neutral-darker dark:text-secondary-light hover:bg-secondary dark:hover:bg-neutral-dark disabled:opacity-50"
                aria-label="Upload file"
                title="Upload File"
              >
                <ArrowUpTrayIcon className="w-5 h-5"/>
              </button>
            )}

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey && !isListening && !isRealTimeTranslationMode) { e.preventDefault(); handleSendMessage(); } }}
              placeholder={currentPromptPlaceholder()}
              rows={calculateTextareaRows()}
              className="flex-grow p-3 pr-2 border border-secondary dark:border-neutral-darkest rounded-lg resize-none focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none bg-white dark:bg-neutral-dark disabled:opacity-70"
              style={{ paddingLeft: '0.75rem' }}
              disabled={generalChatBarInteractionDisabled || (isRealTimeTranslationMode && !isSpeechRecognitionSupported)}
            />
            <div className="flex items-center space-x-1.5 flex-shrink-0 ml-2">
                {isRealTimeTranslationMode && (
                    <button onClick={handleSpeakLiveTranslation} disabled={isLoading || isListening || !liveTranslationDisplay.trim() || isSpeakingLiveTranslation || (userSession.isDemoUser && !userSession.isPaidUser)}
                        className={`p-2.5 rounded-full transition-colors
                                    ${isSpeakingLiveTranslation ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' : 'bg-accent hover:bg-accent-dark text-white'}
                                    disabled:opacity-50 disabled:cursor-not-allowed`}
                        aria-label={isSpeakingLiveTranslation ? "Stop speaking translation" : "Speak live translation"}
                        title={(userSession.isDemoUser && !userSession.isPaidUser) ? "Feature for paid users" : (isSpeakingLiveTranslation ? "Stop Speaking" : "Speak Translation")}
                    >
                         {isSpeakingLiveTranslation ? <StopCircleIcon className="w-5 h-5"/> : <SpeakerWaveIcon className="w-5 h-5"/>}
                    </button>
                )}
                {!isRealTimeTranslationMode && (
                    <button onClick={handleSendMessage} disabled={generalChatBarInteractionDisabled || (input.trim() === '' && uploadedImages.length === 0 && !uploadedTextFileName && !isImagenModelSelected && !isFluxKontexModelSelected && !isTextToSpeechModelSelected && !isAiAgentMode && !isPrivateModeSelected)}
                        className="p-2.5 bg-primary hover:bg-primary-dark dark:bg-primary-light dark:hover:bg-primary text-white dark:text-neutral-darker rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={sendButtonLabel()} title={sendButtonLabel()}
                    >
                        {isLoading && !(messages.find(m => m.isRegenerating)?.id) ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            sendButtonIcon()
                        )}
                    </button>
                )}
            </div>
          </div>
        </div>
      </div>
       {isImageModalOpen && modalImage && (
        <ImageModal
            isOpen={isImageModalOpen}
            onClose={() => setIsImageModalOpen(false)}
            imageBase64={modalImage}
            prompt={modalPrompt}
            mimeType={modalMimeType}
        />
      )}
    </div>
  );
};

// Helper: Check if message history needs system instruction for Gemini (currently not used directly in message array for Gemini)
function shouldAddSystemInstructionForGemini(history: Content[]): boolean {
  return history.length === 0 || history.every(msg => msg.role !== 'user'); // Simplistic check
}


export default ChatPage;

function messagesToGeminiHistory(messages: ChatMessage[], currentAiMessageId: string | null, id: string, isAiAgentMode: boolean): Content[] {
    const history: Content[] = [];
    // Filter out the current AI message being generated and any notes if not in agent mode
    messages.filter(msg => msg.id !== currentAiMessageId && (!msg.isNote || isAiAgentMode))
        .forEach(msg => {
            const role = msg.sender === 'user' ? 'user' : 'model';
            const parts: Part[] = [];
            if (msg.text) {
                let textForHistory = msg.text;
                if (isAiAgentMode) {
                    if (msg.isTaskGoal && msg.sender === 'user') textForHistory = `User's goal: ${msg.text}`;
                    else if (msg.isTaskPlan && msg.sender === 'ai') textForHistory = `AI Agent's plan/response: ${msg.text}`;
                }
                parts.push({ text: textForHistory });
            }
            if (msg.sender === 'user' && msg.imagePreview && !msg.isImageQuery) {
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
}

function messagesToOpenAIHistory(
    allMessages: ChatMessage[],
    currentAiMessageId: string | null,
    currentUserMessageId: string | null,
    systemInstruction: string,
    currentInputTextForApi: string,
    currentActiveImageFile: File | null,
    currentActiveImagePreview: string | null,
    currentUploadedTextFileName: string | null,
    currentUploadedTextContent: string | null,
    isRegeneration: boolean,
    isRegenerationOfAiMsgId?: string // Added parameter
): ApiChatMessage[] {
    const history: ApiChatMessage[] = [{ role: 'system', content: systemInstruction }];

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

        if (role === 'user' && msg.imagePreview && !msg.isImageQuery) {
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

        if (currentUploadedTextFileName) {
            if (currentUploadedTextContent) {
                textForCurrentTurn = `The user has uploaded a file named "${currentUploadedTextFileName}".\nThe content of this file is:\n${currentUploadedTextContent}\n\n---\n\n${textForCurrentTurn}`;
            } else if (!currentActiveImageFile) { // If no image, then the file context note applies
                textForCurrentTurn = `${textForCurrentTurn}\n\n(System Note: User uploaded a file named '${currentUploadedTextFileName}'. Its content is not directly available to you.)`;
            }
        }

        if (textForCurrentTurn) {
            currentTurnContentParts.push({ type: 'text', text: textForCurrentTurn });
        }
        if (currentActiveImagePreview && currentActiveImageFile) { // Only include image if it's actually there
            currentTurnContentParts.push({ type: 'image_url', image_url: { url: currentActiveImagePreview, detail: "auto" } });
        }

        if (currentTurnContentParts.length > 0) {
            history.push({ role: 'user', content: currentTurnContentParts.length === 1 && currentTurnContentParts[0].type === 'text' ? currentTurnContentParts[0].text : currentTurnContentParts });
        } else if (history.length === 1 && !isRegeneration) {
            // If only system prompt and nothing from user (and not a regeneration), it's an empty message.
            // The handleSendMessage checks should prevent sending a completely empty message (no text, no image).
        }
    }

    return history;
}
