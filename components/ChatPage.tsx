
// Fix: Remove triple-slash directive for 'vite/client' as its types are not found and import.meta.env is manually typed.
// Fix: Add 'useMemo' to React import
import React, { useState, useRef, useEffect, useCallback, useMemo, useContext } from 'react';
// Update to .ts/.tsx extensions
import { Model, ChatMessage, ModelSettings, AllModelSettings, Part, GroundingSource, ApiKeyStatus, getActualModelIdentifier, ApiChatMessage, ApiStreamChunk, ImagenSettings, ChatSession, Persona, OpenAITtsSettings, RealTimeTranslationSettings, OpenAiTtsVoice, ThemeContextType, UserGlobalProfile, AiAgentSettings } from '../types.ts';
import type { Content } from '@google/genai'; // For constructing Gemini history
import { ALL_MODEL_DEFAULT_SETTINGS, LOCAL_STORAGE_SETTINGS_KEY, LOCAL_STORAGE_HISTORY_KEY, LOCAL_STORAGE_PERSONAS_KEY, TRANSLATION_TARGET_LANGUAGES, MAX_SAVED_CHAT_SESSIONS } from '../constants.ts';
import MessageBubble from './MessageBubble.tsx';
import SettingsPanel from './SettingsPanel.tsx';
import HistoryPanel from './HistoryPanel.tsx'; // Import HistoryPanel
import ImageModal from './ImageModal.tsx'; // Import ImageModal
import { useNotification } from '../contexts/NotificationContext.tsx'; // Import useNotification
import { sendGeminiMessageStream, generateImageWithImagen } from '../services/geminiService.ts';
import { sendOpenAIMessageStream } from '../services/openaiService.ts';
import { sendDeepseekMessageStream } from '../services/deepseekService.ts';
import { sendMockMessageStream } from '../services/mockApiService.ts';
import { generateOpenAITTS } from "../services/openaiTTSService"; // Changed this line
// Added MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon, LanguageIcon, KeyIcon, ChevronDownIcon
import { PaperAirplaneIcon, CogIcon, XMarkIcon, PromptIcon, Bars3Icon, ChatBubbleLeftRightIcon, ClockIcon as HistoryIcon, MicrophoneIcon, StopCircleIcon, SpeakerWaveIcon, MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon, LanguageIcon, KeyIcon, ChevronDownIcon, ArrowDownTrayIcon } from './Icons.tsx';
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
  
  // SpeechGrammarList and SpeechGrammar (if grammars property is used, good to have)
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

  // The main SpeechRecognition interface
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

  // Constructor for SpeechRecognition
  var SpeechRecognition: {
    prototype: SpeechRecognition;
    new(): SpeechRecognition;
  };
  
  // Constructor for SpeechGrammarList
  var SpeechGrammarList: {
    prototype: SpeechGrammarList;
    new(): SpeechGrammarList;
  };

  // Augment window object
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
    SpeechGrammarList: typeof SpeechGrammarList;
    webkitSpeechGrammarList: typeof SpeechGrammarList; 
  }
}


interface SearchResult {
  messageId: string;
  // Potentially add matchIndex within message in future if needed
}

interface ChatPageProps {
  chatBackgroundUrl: string | null;
  userProfile: UserGlobalProfile; // Added userProfile prop
}

const ChatPage: React.FC<ChatPageProps> = ({ chatBackgroundUrl, userProfile }) => {
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

    // For non-special models, construct system instruction with About Me and Persona
    if (selectedModel !== Model.IMAGEN3 && selectedModel !== Model.OPENAI_TTS && selectedModel !== Model.REAL_TIME_TRANSLATION && selectedModel !== Model.AI_AGENT) {
        let finalSystemInstruction = baseSettings.systemInstruction;

        if (activePersona) {
            finalSystemInstruction = activePersona.instruction;
            if (aboutMeText) {
                finalSystemInstruction = `Background information about the user you are interacting with: "${aboutMeText}".\n\nYour current persona/task based on user's selection: "${activePersona.instruction}"`;
            }
        } else if (aboutMeText) {
            // No persona, but "About Me" exists
            finalSystemInstruction = `Background information about the user you are interacting with: "${aboutMeText}".\n\nYour task: "${baseSettings.systemInstruction}"`;
        }
        // If neither persona nor aboutMeText, finalSystemInstruction remains baseSettings.systemInstruction
        return { ...baseSettings, systemInstruction: finalSystemInstruction };
    }
    // For special models (Imagen, TTS, RTTM, AiAgent), just return base settings for that model
    return baseSettings;
  }, [allSettings, selectedModel, activePersonaId, personas, userProfile]);


  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null); 
  const [uploadedTextFileContent, setUploadedTextFileContent] = useState<string | null>(null);
  const [uploadedTextFileName, setUploadedTextFileName] = useState<string | null>(null);
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('settings');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null); // For scroll button
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);

  const isImagenModelSelected = selectedModel === Model.IMAGEN3;
  const isTextToSpeechModelSelected = selectedModel === Model.OPENAI_TTS;
  const isRealTimeTranslationMode = selectedModel === Model.REAL_TIME_TRANSLATION;
  const isAiAgentMode = selectedModel === Model.AI_AGENT;

  const pruneChatSessions = useCallback((sessions: ChatSession[], maxSessions: number): { prunedSessions: ChatSession[], numPruned: number } => {
    if (sessions.length <= maxSessions) {
      return { prunedSessions: sessions, numPruned: 0 };
    }

    const originalLength = sessions.length;
    const pinned = sessions.filter(s => s.isPinned).sort((a, b) => b.timestamp - a.timestamp); // newest pinned first
    const unpinned = sessions.filter(s => !s.isPinned).sort((a, b) => b.timestamp - a.timestamp); // newest unpinned first
    let finalSessions: ChatSession[];

    if (pinned.length >= maxSessions) {
      // Keep only the most recent 'maxSessions' pinned ones
      finalSessions = pinned.slice(0, maxSessions);
    } else {
      // Keep all pinned, and fill the rest with the newest unpinned ones
      const numUnpinnedToKeep = maxSessions - pinned.length;
      const keptUnpinned = unpinned.slice(0, numUnpinnedToKeep);
      finalSessions = [...pinned, ...keptUnpinned];
    }
    
    // Re-sort the final list to ensure pinned items come first, then by timestamp for overall display consistency.
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
          // Notification will be handled by a useEffect after initial render
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
    // This effect runs once after initial mount to check if pruning happened during useState initialization
    // and shows a notification if necessary. This avoids calling addNotification from within useState initializer.
    const checkInitialPruning = () => {
        try {
            const storedHistory = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
            if (storedHistory) {
                const sessionsInStorage: ChatSession[] = JSON.parse(storedHistory);
                 // Calculate how many *would have been* pruned if logic ran on raw storage.
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
  }, []); // Empty dependency array ensures this runs only once on mount


  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentChatName, setCurrentChatName] = useState<string>("New Chat");

  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null); 
  const [modalPrompt, setModalPrompt] = useState<string>('');
  const [modalMimeType, setModalMimeType] = useState<'image/jpeg' | 'image/png'>('image/jpeg');

  // Speech-to-Text state (shared between chat input and real-time translation)
  const [isListening, setIsListening] = useState(false); // General listening state
  const [isSpeechRecognitionSupported, setIsSpeechRecognitionSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // For regular chat input STT:
  const inputBeforeSpeechRef = useRef<string>(""); 
  const currentRecognizedTextSegmentRef = useRef<string>(""); 
  // For Real-Time Translation Mode:
  const liveTranscriptionRef = useRef<string>("");
  const [liveTranscriptionDisplay, setLiveTranscriptionDisplay] = useState<string>("");
  const liveTranslationAccumulatorRef = useRef<string>("");
  const [liveTranslationDisplay, setLiveTranslationDisplay] = useState<string>("");
  const currentTranslationStreamControllerRef = useRef<AbortController | null>(null);
  const [isSpeakingLiveTranslation, setIsSpeakingLiveTranslation] = useState(false);
  const [liveTranslationAudioUrl, setLiveTranslationAudioUrl] = useState<string | null>(null);


  // Audio playback state
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [currentPlayingMessageId, setCurrentPlayingMessageId] = useState<string | null>(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [tempSearchQuery, setTempSearchQuery] = useState(''); // For input field before search is executed
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentSearchResultIndex, setCurrentSearchResultIndex] = useState(-1);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // GPT-4.1 Access Modal State
  const [isGpt41AccessModalOpen, setIsGpt41AccessModalOpen] = useState(false);
  const [gpt41AccessCodeInput, setGpt41AccessCodeInput] = useState('');
  const [isGpt41Unlocked, setIsGpt41Unlocked] = useState(false);
  const gpt41ModalInteractionFlagRef = useRef(false); // Tracks if modal has been shown for current GPT4O selection
  const previousModelBeforeGpt41ModalRef = useRef<Model | null>(null);


  const apiKeyStatuses = React.useMemo((): Record<Model, ApiKeyStatus> => {
    const isProxyExpectedToHaveKey = true; 

    return {
      [Model.GEMINI]: {isSet: isProxyExpectedToHaveKey, envVarName: 'GEMINI_API_KEY (on proxy)', modelName: 'Gemini Flash', isMock: false, isGeminiPlatform: true},
      [Model.GEMINI_ADVANCED]: {isSet: isProxyExpectedToHaveKey, envVarName: 'GEMINI_API_KEY (on proxy)', modelName: 'Gemini Advanced', isMock: false, isGeminiPlatform: true},
      [Model.GPT4O]: {isSet: isProxyExpectedToHaveKey, envVarName: 'OPENAI_API_KEY (on proxy)', modelName: 'ChatGPT (gpt-4.1)', isMock: false, isGeminiPlatform: false},
      [Model.GPT4O_MINI]: {isSet: isProxyExpectedToHaveKey, envVarName: 'OPENAI_API_KEY (on proxy)', modelName: 'ChatGPT (gpt-4.1-mini)', isMock: false, isGeminiPlatform: false}, // Updated
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
    };
  }, []);


  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(allSettings));
    } catch (error: any) {
      console.error("Error saving settings to localStorage:", error);
      addNotification("Failed to save app settings.", "error", error.message);
    }
  }, [allSettings, addNotification]);

  useEffect(() => {
    // The `savedSessions` state is already pruned by operations that modify it.
    // This useEffect just handles writing the current state to localStorage.
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
    if (!isSearchActive && !isRealTimeTranslationMode && !showScrollToBottomButton) { 
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSearchActive, isRealTimeTranslationMode, showScrollToBottomButton]);
  
  // Effect for model selection changes, including GPT-4.1 access modal
  useEffect(() => {
    const currentModelStatus = apiKeyStatuses[selectedModel];
    // Disable web search if current model is not Gemini platform chat or if AI Agent (which handles its own search)
    if ((!currentModelStatus?.isGeminiPlatform || currentModelStatus?.isImageGeneration || currentModelStatus?.isTextToSpeech || currentModelStatus?.isRealTimeTranslation || currentModelStatus?.isAiAgent) && isWebSearchEnabled) {
        setIsWebSearchEnabled(false);
    }
    
    if (isImagenModelSelected || isTextToSpeechModelSelected || isRealTimeTranslationMode ) { // AI Agent can have attachments
        setUploadedImage(null);
        setImagePreview(null); 
        setUploadedTextFileContent(null);
        setUploadedTextFileName(null);
        if (!isAiAgentMode) setActivePersonaId(null); // AI Agent doesn't use personas, but other special models do clear it
        if (isListening && !isRealTimeTranslationMode) { // Stop chat STT if switching to special mode
            recognitionRef.current?.stop();
        }
    }
    if (isRealTimeTranslationMode) {
      setInput(''); // Clear chat input when entering translation mode
      if (audioPlayerRef.current && currentPlayingMessageId) {
          audioPlayerRef.current.pause();
          setCurrentPlayingMessageId(null);
      }
    } else {
      if (isListening && recognitionRef.current && selectedModel !== Model.GPT4O && !isGpt41AccessModalOpen) { // only stop if not opening GPT4.1 modal
          recognitionRef.current.stop(); 
      }
      setLiveTranscriptionDisplay("");
      setLiveTranslationDisplay("");
      liveTranscriptionRef.current = "";
      liveTranslationAccumulatorRef.current = "";
      currentTranslationStreamControllerRef.current?.abort();
      if (audioPlayerRef.current && isSpeakingLiveTranslation) {
          audioPlayerRef.current.pause();
          setIsSpeakingLiveTranslation(false);
          setLiveTranslationAudioUrl(null);
      }
    }

    if (currentPlayingMessageId && audioPlayerRef.current) {
        audioPlayerRef.current.pause(); 
        setCurrentPlayingMessageId(null);  
    }

    // GPT-4.1 Access Modal Logic
    if (selectedModel === Model.GPT4O) {
      if (!isGpt41Unlocked && !gpt41ModalInteractionFlagRef.current) {
        previousModelBeforeGpt41ModalRef.current = selectedModel; // Store current selection context
        setIsGpt41AccessModalOpen(true);
        gpt41ModalInteractionFlagRef.current = true; // Mark that we've attempted to show the modal for this selection
      }
    } else {
      // If navigating away from GPT4O, reset the interaction flag so it can pop up again if re-selected
      gpt41ModalInteractionFlagRef.current = false;
      if (isGpt41AccessModalOpen) setIsGpt41AccessModalOpen(false); // Close modal if open and model changed
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel]); // Dependencies intentionally simplified for this specific logic


  const translateLiveSegment = useCallback(async (text: string, targetLangCode: string) => {
      if (!text.trim() || !targetLangCode) return;

      const targetLangName = TRANSLATION_TARGET_LANGUAGES.find(l => l.code === targetLangCode)?.name || targetLangCode;
      const translationPlaceholder = `Translating to ${targetLangName}: "${text.substring(0, 20)}..."\n`;
      
      setLiveTranslationDisplay(prev => prev + translationPlaceholder);

      currentTranslationStreamControllerRef.current?.abort(); // Cancel previous stream if any
      currentTranslationStreamControllerRef.current = new AbortController();
      const signal = currentTranslationStreamControllerRef.current.signal;

      try {
          const prompt = `Translate the following text to ${targetLangName}. Output only the translated text directly, without any introductory phrases or explanations: "${text}"`;
          const history: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
          const geminiModelId = getActualModelIdentifier(Model.GEMINI); // Use Gemini Flash for translation

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
          // Final update for the segment, replacing placeholder entirely
          liveTranslationAccumulatorRef.current += `[${targetLangName}]: ${segmentTranslation.trim()}\n`;
          setLiveTranslationDisplay(liveTranslationAccumulatorRef.current); // Show full accumulated history

      } catch (error: any) {
          if (error.name === 'AbortError') {
            console.log('Previous translation fetch was aborted.');
          } else {
            console.error("Error translating segment:", error);
            addNotification(`Translation error: ${error.message}`, "error");
            setLiveTranslationDisplay(prev => prev.replace(translationPlaceholder, `[Error translating: ${error.message}]\n`));
            liveTranslationAccumulatorRef.current += `[Error translating: ${error.message}]\n`;
          }
      }
  }, [addNotification]);

  // Speech-to-Text Effect
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
      let finalTranscriptForSegment = "";
      let currentInterimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptForSegment += transcript;
        } else {
          currentInterimTranscript += transcript;
        }
      }

      if (isRealTimeTranslationMode) {
          setLiveTranscriptionDisplay(liveTranscriptionRef.current + finalTranscriptForSegment + currentInterimTranscript);
          if (finalTranscriptForSegment.trim()) {
              liveTranscriptionRef.current += finalTranscriptForSegment.trim() + "\n"; 
              const targetLangCode = (modelSettings as RealTimeTranslationSettings).targetLanguage || 'en';
              translateLiveSegment(finalTranscriptForSegment.trim(), targetLangCode);
          }
      } else { // Regular chat input STT
          currentRecognizedTextSegmentRef.current = finalTranscriptForSegment.trim() + 
              (finalTranscriptForSegment.trim() && currentInterimTranscript.trim() ? " " : "") + 
              currentInterimTranscript.trim();

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
      if (!isRealTimeTranslationMode) { // Finalize chat input
        let finalInputText = inputBeforeSpeechRef.current;
         if (finalInputText.trim() && currentRecognizedTextSegmentRef.current.trim()) {
          finalInputText += " ";
        }
        finalInputText += currentRecognizedTextSegmentRef.current.trim();
        setInput(finalInputText);
      }
      // For RTTM, onend just means recording stopped, display is already updated.
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error', event.error, event.message);
      let errorMessage = `Speech recognition error: ${event.error}.`;
      if (event.error === 'not-allowed') {
        errorMessage = "Microphone access denied. Please allow microphone access in your browser settings.";
      } else if (event.error === 'no-speech' && isListening) { // Only show no-speech error if actively listening
        errorMessage = "No speech detected. Please try again.";
      } else if (event.error === 'aborted' && !isListening) { // Expected if user stops it
        return; 
      }
      addNotification(errorMessage, "error", event.message);
      setIsListening(false);
    };

    return () => {
      recognition?.abort(); // Use abort instead of stop for faster cleanup
    };
  // Removed `isListening` from dependencies to prevent premature abort/onend.
  }, [addNotification, isRealTimeTranslationMode, modelSettings, translateLiveSegment]);


  const handleToggleListen = () => {
    if (!isSpeechRecognitionSupported || !recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop(); // Will trigger 'onend' which sets isListening = false
    } else {
      if (isRealTimeTranslationMode) {
          liveTranscriptionRef.current = "";
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


  const handleModelSettingsChange = useCallback((newSettings: Partial<ModelSettings & ImagenSettings & OpenAITtsSettings & RealTimeTranslationSettings & AiAgentSettings>) => {
    setAllSettings(prev => {
      const baseModelSettings = prev[selectedModel] || ALL_MODEL_DEFAULT_SETTINGS[selectedModel]!;
      let processedNewSettings = { ...newSettings };

      if ('numberOfImages' in processedNewSettings && typeof processedNewSettings.numberOfImages === 'number') {
        processedNewSettings.numberOfImages = Math.max(1, Math.min(4, processedNewSettings.numberOfImages));
      }
       if ('speed' in processedNewSettings && typeof processedNewSettings.speed === 'number') {
        processedNewSettings.speed = Math.max(0.25, Math.min(4.0, processedNewSettings.speed));
      }
      
      const activeP = activePersonaId ? personas.find(p => p.id === activePersonaId) : null;
      if (activeP && 'systemInstruction' in processedNewSettings && selectedModel !== Model.IMAGEN3 && selectedModel !== Model.OPENAI_TTS && selectedModel !== Model.REAL_TIME_TRANSLATION && selectedModel !== Model.AI_AGENT) {
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
    if (isRealTimeTranslationMode || isAiAgentMode) {
        addNotification(`Cannot save chat in ${isRealTimeTranslationMode ? 'Real-Time Translation' : 'AI Agent'} mode.`, "info");
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
        } else if (firstUserMessage.text) {
            sessionName = firstUserMessage.text.substring(0, 40) + (firstUserMessage.text.length > 40 ? '...' : '');
        } else if (firstUserMessage.imagePreview) {
            sessionName = "Chat with Image Upload";
        } else if (firstUserMessage.fileName) {
            sessionName = `Chat with File: ${firstUserMessage.fileName}`;
        }
    }


    if (activeSessionId) {
        setSavedSessions(prev => {
            const updatedSession = {
                ...prev.find(s => s.id === activeSessionId)!,
                name: prev.find(s => s.id === activeSessionId)?.name || sessionName, // Keep existing name on update unless it's new
                messages: [...messages],
                model: selectedModel,
                modelSettingsSnapshot: {...modelSettings}, 
                timestamp: sessionTimestamp, // Update timestamp on save
                activePersonaIdSnapshot: activePersonaId, 
            };
            const otherSessions = prev.filter(s => s.id !== activeSessionId);
            const { prunedSessions } = pruneChatSessions([updatedSession, ...otherSessions], MAX_SAVED_CHAT_SESSIONS);
             // No specific notification for pruning on update, as it's less direct.
            return prunedSessions.sort((a, b) => b.timestamp - a.timestamp);
        });
        setCurrentChatName(savedSessions.find(s => s.id === activeSessionId)?.name || sessionName);
        addNotification(`Chat "${currentChatName}" updated.`, "success");
    } else { // Saving a new chat
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
                 if (removedSession && newSession.id !== removedSession.id) { // Ensure we don't announce removal of the session just saved if it was part of a complex prune
                    addNotification(`Storage limit: Oldest unpinned chat "${removedSession.name}" removed to make space.`, "info");
                } else if (numPruned > 0) { // Generic if specific removed session not easily identifiable or it was the new one (should not happen)
                    addNotification(`Storage limit: ${numPruned} oldest unpinned chat(s) removed to save new chat.`, "info");
                }
            }
            return prunedSessions.sort((a, b) => b.timestamp - a.timestamp);
        });
        setActiveSessionId(newSessionId);
        setCurrentChatName(sessionName);
        addNotification(`Chat "${sessionName}" saved.`, "success");
    }
    clearSearch();
  }, [messages, selectedModel, modelSettings, activeSessionId, savedSessions, activePersonaId, addNotification, currentChatName, isRealTimeTranslationMode, isAiAgentMode, pruneChatSessions]);

  const handleLoadSession = useCallback((sessionId: string) => {
    const sessionToLoad = savedSessions.find(s => s.id === sessionId);
    if (sessionToLoad) {
      if (sessionToLoad.model === Model.REAL_TIME_TRANSLATION || sessionToLoad.model === Model.AI_AGENT) {
          addNotification(`Cannot load ${sessionToLoad.model === Model.REAL_TIME_TRANSLATION ? 'Real-Time Translation' : 'AI Agent'} sessions directly. Please start a new one if needed.`, "info");
          return;
      }
      setMessages([...sessionToLoad.messages]);
      setSelectedModel(sessionToLoad.model); // This might trigger the GPT-4.1 modal
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
      setUploadedImage(null);
      setImagePreview(null);
      setUploadedTextFileContent(null);
      setUploadedTextFileName(null);
      setIsWebSearchEnabled(false); 
      setError(null);
      setIsSidebarOpen(false); 
      addNotification(`Loaded chat: "${sessionToLoad.name}".`, "info");
      clearSearch();
    } else {
      addNotification("Failed to load chat session.", "error");
    }
  }, [savedSessions, addNotification]);

  const handleStartNewChat = useCallback(() => {
    setMessages([]);
    setActiveSessionId(null);
    setCurrentChatName("New Chat");
    setUploadedImage(null);
    setImagePreview(null);
    setUploadedTextFileContent(null);
    setUploadedTextFileName(null);
    setIsWebSearchEnabled(false);
    
    if (selectedModel !== Model.REAL_TIME_TRANSLATION && !(selectedModel === Model.GPT4O && !isGpt41Unlocked)) { // AI Agent settings reset normally
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

    if (!isAiAgentMode) setActivePersonaId(null); // AI Agent doesn't use personas, so don't clear if it's the active model
    setError(null);
    setIsSidebarOpen(false); 
    addNotification("Started new chat.", "info");
    clearSearch();
     
    if (isRealTimeTranslationMode) {
        setLiveTranscriptionDisplay("");
        setLiveTranslationDisplay("");
        liveTranscriptionRef.current = "";
        liveTranslationAccumulatorRef.current = "";
        if (audioPlayerRef.current && isSpeakingLiveTranslation) {
            audioPlayerRef.current.pause();
            setIsSpeakingLiveTranslation(false);
        }
    }
  }, [selectedModel, addNotification, isRealTimeTranslationMode, isSpeakingLiveTranslation, isGpt41Unlocked, isAiAgentMode]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    const sessionToDelete = savedSessions.find(s => s.id === sessionId);
    setSavedSessions(prev => {
        const updatedSessions = prev.filter(s => s.id !== sessionId);
        // Pruning is not strictly necessary on delete unless we have a complex min-sessions rule.
        // But, for consistency, we can re-apply. The prune function handles cases where length <= max.
        const { prunedSessions } = pruneChatSessions(updatedSessions, MAX_SAVED_CHAT_SESSIONS);
        return prunedSessions;
    });
    if (activeSessionId === sessionId) {
      handleStartNewChat(); 
    }
    if (sessionToDelete) {
      addNotification(`Deleted chat: "${sessionToDelete.name}".`, "info");
    }
  }, [activeSessionId, handleStartNewChat, savedSessions, addNotification, pruneChatSessions]); 
  
  const handleRenameSession = useCallback((sessionId: string, newName: string) => {
    setSavedSessions(prev => {
        const updatedSessions = prev.map(s => s.id === sessionId ? { ...s, name: newName } : s);
        // No pruning needed on rename itself as count doesn't change.
        return updatedSessions;
    });
    if (activeSessionId === sessionId) {
        setCurrentChatName(newName);
    }
    addNotification(`Chat renamed to "${newName}".`, "info");
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
        // Re-apply pruning after pinning/unpinning as it might affect which sessions are kept
        const { prunedSessions, numPruned } = pruneChatSessions(newSessions, MAX_SAVED_CHAT_SESSIONS);
        if (numPruned > 0) {
            addNotification(`Storage limit: ${numPruned} oldest unpinned chat(s) removed due to pinning changes.`, "info");
        }
        return prunedSessions.sort((a, b) => { // Ensure pinned come first, then by time
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return b.timestamp - a.timestamp;
        });
    });
    if (sessionName) {
      addNotification(isNowPinned ? `Pinned "${sessionName}".` : `Unpinned "${sessionName}".`, "info");
    }
  }, [addNotification, pruneChatSessions]);


  const handleOpenImageModal = useCallback((imageB64: string, promptText: string, mime: 'image/jpeg' | 'image/png') => {
    setModalImage(imageB64);
    setModalPrompt(promptText);
    setModalMimeType(mime);
    setIsImageModalOpen(true);
  }, []);

  const handlePlayAudio = useCallback((audioUrl: string, messageId: string) => {
    if (!audioPlayerRef.current) return;
    const player = audioPlayerRef.current;

    // Stop live translation audio if it's playing
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
        // onpause listener will set currentPlayingMessageId to null
      }
    } else { 
      if (!player.paused) { // If playing something else (another message)
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
    const player = audioPlayerRef.current;

    if (currentPlayingMessageId) { // If message audio is playing, stop it
        player.pause();
        setCurrentPlayingMessageId(null);
    }
    if (isSpeakingLiveTranslation) { // If already speaking live translation
        player.pause(); // This will trigger onpause, setting isSpeakingLiveTranslation to false
        return;
    }
    
    setIsSpeakingLiveTranslation(true);
    setLiveTranslationAudioUrl(null); // Clear previous URL if any

    const openAiTtsModelSettings = allSettings[Model.OPENAI_TTS] as OpenAITtsSettings | undefined;
    const ttsParams = {
        modelIdentifier: openAiTtsModelSettings?.modelIdentifier || 'tts-1',
        textInput: liveTranslationDisplay.replace(/\[.*?\]:\s*/g, '').trim(), // Remove "[Language]: " prefixes
        voice: 'nova' as OpenAiTtsVoice, // Explicitly female voice
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
  }, [liveTranslationDisplay, addNotification, allSettings, isListening, currentPlayingMessageId, isSpeakingLiveTranslation]);


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
            if (liveTranslationAudioUrl) { // Clean up blob URL on component unmount if player didn't end
                URL.revokeObjectURL(liveTranslationAudioUrl);
            }
        };
    }
  }, [currentPlayingMessageId, isSpeakingLiveTranslation, liveTranslationAudioUrl]);


  const internalSendMessage = async (
    currentInputText: string,
    currentUploadedImageFile: File | null, 
    currentImagePreviewDataUrl: string | null, 
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
        } else if (currentUploadedTextFileName && !currentUploadedTextContent && !currentUploadedImageFile) {
            textForApi = `${fileContextNote}\n\nUser's goal: ${textForApi}`;
        }
    } else if (currentUploadedTextFileName && currentUploadedTextContent) { // Standard chat with text file
        textForApi = `The user has uploaded a file named "${currentUploadedTextFileName}".\nThe content of this file is:\n${currentUploadedTextContent}\n\n---\n\n${textForApi}`;
    }
    // For standard chat models, if a non-text/non-image file is uploaded, `textForApi` might need the fileContextNote later for those specific model handlers.

    const newUserMessage: ChatMessage = {
        id: userMessageId,
        text: userDisplayedText, 
        sender: 'user',
        timestamp: messageTimestamp,
        imagePreview: currentImagePreviewDataUrl || undefined,
        fileName: currentUploadedTextFileName || undefined,
        isImageQuery: isImagenModelSelected,
        isTaskGoal: isAiAgentMode, 
    };

    if (!isRegenerationOfAiMsgId) {
        setMessages((prev) => [...prev, newUserMessage]);
    }
    
    const aiMessageTimestamp = Date.now(); 
    const aiMessageId = isRegenerationOfAiMsgId || (aiMessageTimestamp + 1).toString();
    
    let aiPlaceholderText = isRegenerationOfAiMsgId ? 'Regenerating...' : '';
    if (!isRegenerationOfAiMsgId) {
        if (isImagenModelSelected) aiPlaceholderText = 'Generating image(s)...';
        else if (isTextToSpeechModelSelected) aiPlaceholderText = 'Synthesizing audio...';
        else if (isAiAgentMode) aiPlaceholderText = 'AI Agent is processing your goal...';
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
    };

    if (isRegenerationOfAiMsgId) {
        setMessages(prev => prev.map(msg => msg.id === aiMessageId ? {...aiMessagePlaceholder, timestamp: msg.timestamp || aiMessageTimestamp } : msg));
    } else {
        setMessages((prev) => [...prev, aiMessagePlaceholder]);
    }
    
    try {
      const currentModelSpecificSettings = modelSettings as ModelSettings & ImagenSettings & OpenAITtsSettings & RealTimeTranslationSettings & AiAgentSettings;
      const currentModelStatus = apiKeyStatuses[selectedModel];
      const actualModelIdentifier = getActualModelIdentifier(selectedModel);

      if (currentModelStatus?.isTextToSpeech && !currentModelStatus.isMock) {
        const ttsResult = await generateOpenAITTS({
            modelIdentifier: currentModelSpecificSettings.modelIdentifier || 'tts-1',
            textInput: userDisplayedText, 
            voice: currentModelSpecificSettings.voice || 'alloy',
            speed: currentModelSpecificSettings.speed || 1.0
        });

        if (ttsResult.error) throw new Error(ttsResult.error);
        if (ttsResult.audioBlob) {
            const audioBlobUrl = URL.createObjectURL(ttsResult.audioBlob);
            setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? {
                ...msg,
                text: `Audio generated for: "${userDisplayedText}"`,
                audioUrl: audioBlobUrl,
                isRegenerating: false,
                timestamp: msg.timestamp || Date.now() 
            } : msg));
             if (audioPlayerRef.current && audioBlobUrl) { 
                handlePlayAudio(audioBlobUrl, aiMessageId);
            }
        } else {
            throw new Error("TTS generation failed to return audio.");
        }

      } else if (currentModelStatus?.isGeminiPlatform && !currentModelStatus.isMock && !isRealTimeTranslationMode) { 
        if (isImagenModelSelected) { 
            const imagenSettings = currentModelSpecificSettings as ImagenSettings;
            const result = await generateImageWithImagen({
              prompt: userDisplayedText, modelSettings: imagenSettings, modelName: actualModelIdentifier,
            });

            if (result.error) throw new Error(result.error);
            if (result.imageBases64 && result.imageBases64.length > 0) {
              const mimeType = imagenSettings.outputMimeType || 'image/jpeg';
              const imageUrls = result.imageBases64.map(base64 => `data:${mimeType};base64,${base64}`);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMessageId ? { 
                    ...msg, text: `Generated ${imageUrls.length} image(s) for: "${userDisplayedText}"`, 
                    imagePreviews: imageUrls, imageMimeType: mimeType, originalPrompt: userDisplayedText, isRegenerating: false,
                    timestamp: msg.timestamp || Date.now() 
                  } : msg
                )
              );
            } else { throw new Error("Image generation failed to return any images. Check proxy logs and original API response for details."); }
        } else { // Gemini Chat (including AI Agent if it's Gemini-based)
            const geminiHistory: Content[] = [];
            
            if (!isAiAgentMode) { // AI Agent might have different history logic or rely solely on current prompt with context.
                messages
                .filter(m => m.id !== aiMessageId && m.id !== newUserMessage.id) 
                .forEach(msg => {
                    const messageParts: Part[] = [];
                    if (msg.text && msg.text.trim()) {
                        messageParts.push({ text: msg.text.trim() });
                    }
                    if (msg.sender === 'user' && msg.fileName && !msg.imagePreview && !TEXT_READABLE_EXTENSIONS.some(ext => msg.fileName?.toLowerCase().endsWith(ext))) {
                         // For non-AI Agent Gemini, inform about non-readable file name in history
                        messageParts.push({ text: `(System Note: User previously uploaded a file named '${msg.fileName}'. Its content was not directly available.)` });
                    }
                    if (msg.sender === 'user' && msg.imagePreview) {
                    try {
                        const [header, base64Data] = msg.imagePreview.split(',');
                        if (base64Data) {
                        const mimeTypeMatch = header.match(/data:(image\/[a-zA-Z0-9-.+]+);base64/);
                        if (mimeTypeMatch && mimeTypeMatch[1]) {
                            messageParts.push({
                            inlineData: {
                                mimeType: mimeTypeMatch[1], 
                                data: base64Data
                            }
                            });
                        }
                        }
                    } catch (e) { console.error("Error processing user imagePreview in history for Gemini:", e); }
                    }
                    // AI image previews in history might not be needed or useful for Gemini text chat
                    // if (msg.sender === 'ai' && msg.imagePreviews && msg.imagePreviews.length > 0) { ... }
                    
                    if (messageParts.length > 0) {
                        geminiHistory.push({ role: msg.sender === 'user' ? 'user' : 'model', parts: messageParts });
                    }
                });
            }


            const currentUserParts: Part[] = [];
            if (textForApi.trim()) { 
                currentUserParts.push({ text: textForApi.trim() });
            }
            // Add non-text/non-image file note for non-AI Agent Gemini models if not already in textForApi
            if (!isAiAgentMode && currentUploadedTextFileName && !currentUploadedTextContent && !currentUploadedImageFile) {
                currentUserParts.push({ text: fileContextNote });
            }
            
            if (currentUploadedImageFile && currentImagePreviewDataUrl) { 
                try {
                    const base64Image = currentImagePreviewDataUrl.split(',')[1];
                    if (base64Image) {
                         currentUserParts.push({ inlineData: { mimeType: currentUploadedImageFile.type, data: base64Image } });
                    }
                } catch(e) { console.error("Error processing current user uploaded image for Gemini:", e); }
            }
            
            if (currentUserParts.length > 0) {
                geminiHistory.push({ role: 'user', parts: currentUserParts });
            } else if (geminiHistory.length === 0 && !isRegenerationOfAiMsgId) {
                console.error("Attempting to send an empty message to Gemini. Aborting.");
                throw new Error("Cannot send an empty message to the AI.");
            }

            const stream = sendGeminiMessageStream({
              historyContents: geminiHistory, 
              modelSettings: currentModelSpecificSettings as ModelSettings, 
              enableGoogleSearch: isAiAgentMode || isWebSearchEnabled, 
              modelName: actualModelIdentifier, 
            });

            let currentText = ''; let currentGroundingSources: GroundingSource[] | undefined = undefined;
            for await (const chunk of stream) {
              if (chunk.error) throw new Error(chunk.error); 
              if (chunk.textDelta) currentText += chunk.textDelta;
              if (chunk.groundingSources && chunk.groundingSources.length > 0) currentGroundingSources = chunk.groundingSources;
              setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? { ...msg, text: currentText, groundingSources: currentGroundingSources || msg.groundingSources, isRegenerating: false } : msg ));
            }
        }
      } else if ((selectedModel === Model.GPT4O || selectedModel === Model.GPT4O_MINI) && !currentModelStatus.isMock) { 
        const history: ApiChatMessage[] = [{ role: 'system', content: currentModelSpecificSettings.systemInstruction }];
        messages.filter(m => m.id !== aiMessageId && m.id !== newUserMessage.id).forEach(msg => { 
            if (msg.sender === 'user') {
                let userContentText = msg.text || "";
                if (msg.fileName && !msg.imagePreview && !TEXT_READABLE_EXTENSIONS.some(ext => msg.fileName?.toLowerCase().endsWith(ext))) {
                    userContentText += `\n(System Note: User previously uploaded a file named '${msg.fileName}'. Its content was not directly available.)`;
                }
                const userContentParts: any[] = [];
                if (userContentText.trim()) userContentParts.push({ type: 'text', text: userContentText.trim() });
                if (msg.imagePreview && !msg.isImageQuery) userContentParts.push({ type: 'image_url', image_url: { url: msg.imagePreview } });
                
                if (userContentParts.length > 0) history.push({ role: 'user', content: userContentParts });
                else if (msg.text === "") history.push({ role: 'user', content: " " }); // Handle empty string prompts
            } else if (msg.sender === 'ai') {
                 history.push({ role: 'assistant', content: msg.text || " " });
            }
        });
        
        let currentTurnTextForApi = textForApi.trim();
        if (currentUploadedTextFileName && !currentUploadedTextContent && !currentUploadedImageFile) {
            currentTurnTextForApi = `${currentTurnTextForApi}\n\n${fileContextNote}`;
        }

        const currentUserContent: Array<{type: 'text', text: string} | {type: 'image_url', image_url: {url: string, detail?: "auto" | "low" | "high" }}> = [];
        if (currentTurnTextForApi.trim()) currentUserContent.push({ type: 'text', text: currentTurnTextForApi.trim() });
        if (currentUploadedImageFile && currentImagePreviewDataUrl) currentUserContent.push({ type: 'image_url', image_url: { url: currentImagePreviewDataUrl, detail: "auto" }});

        if(currentUserContent.length > 0) history.push({ role: 'user', content: currentUserContent });
        else if (userDisplayedText === "" && !currentUploadedImageFile && !currentUploadedTextFileName) history.push({ role: 'user', content: " " }); 

        const stream = sendOpenAIMessageStream({ 
            modelIdentifier: actualModelIdentifier, 
            history, 
            modelSettings: currentModelSpecificSettings as ModelSettings 
        });
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
        if (currentUploadedTextFileName && !currentUploadedTextContent && !currentUploadedImageFile) {
            currentTurnTextForDeepseek = `${currentTurnTextForDeepseek}\n\n${fileContextNote}`;
        }
        history.push({ role: 'user', content: currentTurnTextForDeepseek || " " }); 

        const stream = sendDeepseekMessageStream({ 
            modelIdentifier: actualModelIdentifier, 
            history, 
            modelSettings: currentModelSpecificSettings as ModelSettings 
        });
        let currentText = '';
        for await (const chunk of stream) {
          if (chunk.error) throw new Error(chunk.error);
          if (chunk.textDelta) currentText += chunk.textDelta;
          setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? { ...msg, text: currentText, isRegenerating: false } : msg));
          if (chunk.isFinished) break;
        }
      
      } else if (currentModelStatus?.isMock && !isRealTimeTranslationMode && !isAiAgentMode) { 
        const mockParts: Part[] = [];
        if (textForApi.trim()) mockParts.push({ text: textForApi.trim() });
        if (currentUploadedTextFileName && !currentUploadedTextContent && !currentUploadedImageFile) {
            mockParts.push({ text: fileContextNote });
        }
        if (currentUploadedImageFile && currentImagePreviewDataUrl) { 
            mockParts.push({ inlineData: { mimeType: currentUploadedImageFile.type as 'image/jpeg' | 'image/png', data: currentImagePreviewDataUrl.split(',')[1] } });
        }
        const stream = sendMockMessageStream(mockParts, selectedModel, currentModelSpecificSettings as ModelSettings); 
        let currentText = '';
        for await (const chunk of stream) {
          currentText += chunk;
          setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? { ...msg, text: currentText, isRegenerating: false } : msg));
        }
      } else if (!isRealTimeTranslationMode) { 
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
        id: errorAiMessageId, 
        text: `Error: ${errorMessage}`, 
        sender: 'ai', 
        model: selectedModel, 
        timestamp: Date.now(), 
        promptedByMessageId: userMessageId
      }]);
    }

    setIsLoading(false);
    if (!isRegenerationOfAiMsgId && !isRealTimeTranslationMode) { 
        setInput(''); 
        setUploadedImage(null);
        setImagePreview(null); 
        setUploadedTextFileContent(null);
        setUploadedTextFileName(null);
    }
    clearSearch();
  };

  const handleSendMessage = async () => {
    if (isRealTimeTranslationMode || isListening) return; 
    if (!input.trim() && !uploadedImage && !uploadedTextFileName && !isImagenModelSelected && !isTextToSpeechModelSelected && !isAiAgentMode) return;
    if ((isImagenModelSelected || isTextToSpeechModelSelected || isAiAgentMode) && !input.trim() && !uploadedImage && !uploadedTextFileName) { 
        let errorMsg = "";
        if (isImagenModelSelected) errorMsg = "Please enter a prompt for image generation.";
        else if (isTextToSpeechModelSelected) errorMsg = "Please enter text for speech synthesis.";
        else if (isAiAgentMode) errorMsg = "Please enter a goal or upload a file for the AI Agent.";
        
        setError(errorMsg);
        addNotification(errorMsg, "info");
        return;
    }
    setIsLoading(true);
    setError(null);
    await internalSendMessage(input, uploadedImage, imagePreview, uploadedTextFileContent, uploadedTextFileName);
  };
  
  const handleRegenerateResponse = async (aiMessageIdToRegenerate: string, promptedByMsgId: string) => {
      if (isRealTimeTranslationMode || isAiAgentMode) return; 
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
      let currentRegenImageFile: File | null = null; 
      let currentRegenImagePreview: string | null = userMessageForRegen.imagePreview || null;
      let currentRegenUploadedTextContent: string | null = null; // Need to retrieve this from history if possible
      let currentRegenUploadedTextFileName: string | null = userMessageForRegen.fileName || null;

      // Logic to re-fetch text file content for regeneration IF NEEDED.
      // For now, assume it was part of the original userMessageForRegen.text or we can't re-fetch it.
      // A more robust solution would be to store the text content on the userMessage object itself.


      setMessages(prev => prev.map(msg => {
          if (msg.id === aiMessageIdToRegenerate) {
              let regeneratingText = 'Regenerating...';
              if (msg.model === Model.IMAGEN3) regeneratingText = 'Regenerating image(s)...';
              if (msg.model === Model.OPENAI_TTS) regeneratingText = 'Resynthesizing audio...';
              
              return {
                  ...msg,
                  text: regeneratingText,
                  imagePreviews: undefined, 
                  groundingSources: undefined, 
                  audioUrl: undefined, 
                  isRegenerating: true,
              };
          }
          return msg;
      }));
      
      await internalSendMessage(
          regenInputText, 
          currentRegenImageFile, 
          currentRegenImagePreview, 
          currentRegenUploadedTextContent, // This will be null if not from original message text
          currentRegenUploadedTextFileName,
          aiMessageIdToRegenerate 
      );
  };


  const handleImageUpload = (file: File | null) => {
    if (isImagenModelSelected || isTextToSpeechModelSelected || isRealTimeTranslationMode) return; 
    setUploadedImage(file);
    setUploadedTextFileContent(null); 
    setUploadedTextFileName(null);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setImagePreview(reader.result as string); };
      reader.readAsDataURL(file);
    } else { setImagePreview(null); }
    clearSearch();
  };

  const handleFileUpload = (file: File | null) => {
    if (isImagenModelSelected || isTextToSpeechModelSelected || isRealTimeTranslationMode) return; 

    setUploadedImage(null); 
    setImagePreview(null);

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
        // For non-AI Agent models, they won't be explicitly told about the file yet.
        // For AI Agent, it will be notified.
        if (isAiAgentMode) {
            addNotification(`File "${file.name}" content cannot be displayed/embedded. AI Agent will be notified of the filename.`, "info");
        } else {
            addNotification(`File "${file.name}" content cannot be displayed/embedded. This model might not process it.`, "info");
        }
      }
    } else { setUploadedTextFileContent(null); setUploadedTextFileName(null); }
    clearSearch();
  };

  // Search Functions
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
  }, [tempSearchQuery, messages, addNotification]);

  const clearSearch = useCallback(() => {
    setTempSearchQuery('');
    setSearchQuery('');
    setSearchResults([]);
    setCurrentSearchResultIndex(-1);
    setIsSearchActive(false);
  }, []);

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

  // Scroll to current search result
  useEffect(() => {
    if (isSearchActive && currentSearchResultIndex !== -1 && searchResults[currentSearchResultIndex]) {
      const messageId = searchResults[currentSearchResultIndex].messageId;
      const element = messageRefs.current[messageId];
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentSearchResultIndex, searchResults, isSearchActive]);

  // Scroll to bottom button logic
  const handleScroll = useCallback(() => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      // Show button if scrolled up more than 40px from the bottom
      setShowScrollToBottomButton(scrollHeight - scrollTop - clientHeight > 40);
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
    setShowScrollToBottomButton(false); // Hide button after clicking
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
                modelSettings={modelSettings as ModelSettings & ImagenSettings & OpenAITtsSettings & RealTimeTranslationSettings & AiAgentSettings} 
                onModelSettingsChange={handleModelSettingsChange}
                onImageUpload={handleImageUpload}
                imagePreview={imagePreview}
                onFileUpload={handleFileUpload}
                uploadedTextFileName={uploadedTextFileName}
                isWebSearchEnabled={isWebSearchEnabled}
                onWebSearchToggle={setIsWebSearchEnabled}
                disabled={(isLoading && !isRealTimeTranslationMode ) || isGpt41AccessModalOpen}
                apiKeyStatuses={apiKeyStatuses}
                personas={personas}
                activePersonaId={activePersonaId}
                onPersonaChange={handlePersonaChange}
                onPersonaSave={handlePersonaSave}
                onPersonaDelete={handlePersonaDelete}
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
            />
        )}
    </>
  );

  const calculateTextareaRows = () => {
    const baseLines = input.split('\n').length;
    const endsWithNewlineAdjustment = input.endsWith('\n') ? 1 : 0;
    return Math.min(5, baseLines + endsWithNewlineAdjustment);
  };

  const currentPromptPlaceholder = () => {
    if (isListening && !isRealTimeTranslationMode) return "Đang nghe..."; 
    if (isImagenModelSelected) return "Enter prompt for image generation...";
    if (isTextToSpeechModelSelected) return "Enter text to synthesize speech...";
    if (isRealTimeTranslationMode) return "Real-Time Translation Active. Use Microphone.";
    if (isAiAgentMode) return "Enter main goal for AI Agent, or upload file...";
    return "Type your message or upload an image/file...";
  }

  const sendButtonLabel = () => {
    if (isImagenModelSelected) return "Generate Image";
    if (isTextToSpeechModelSelected) return "Synthesize Speech";
    if (isAiAgentMode) return "Set Goal";
    return "Send message";
  }

  const sendButtonIcon = () => {
    if (isImagenModelSelected) return <PromptIcon className="w-6 h-6" />;
    if (isTextToSpeechModelSelected) return <SpeakerWaveIcon className="w-6 h-6" />;
    if (isAiAgentMode) return <PaperAirplaneIcon className="w-6 h-6" />; 
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
    // gpt41ModalInteractionFlagRef.current is already true or will be handled by model change effect
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
    // Default background color based on theme
    const currentTheme = themeContext?.theme || 'light';
    return { backgroundColor: currentTheme === 'dark' ? '#0e1621' : '#ffffff' };
  }, [chatBackgroundUrl, themeContext?.theme]);


  return (
    <div className="flex h-full">
      <audio ref={audioPlayerRef} className="hidden" />
      <div className={`hidden md:flex flex-col w-96 bg-neutral-light dark:bg-neutral-darker p-4 border-r border-secondary dark:border-neutral-darkest overflow-y-auto transition-all duration-300`}>
          {sidebarContent}
      </div>

       {isSidebarOpen && (
          <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-[60] flex justify-start"> {/* Increased z-index */}
            <div className="w-full max-w-xs sm:max-w-sm h-full bg-neutral-light dark:bg-neutral-darker shadow-xl p-4 overflow-y-auto">
              <button onClick={() => setIsSidebarOpen(false)} className="absolute top-4 right-4 text-neutral-darker dark:text-secondary-light hover:text-red-500 dark:hover:text-red-400 z-[70]" aria-label="Close sidebar"> {/* Ensure button is above panel */}
                <XMarkIcon className="w-6 h-6" />
              </button>
              {sidebarContent}
            </div>
             <div className="flex-1" onClick={() => setIsSidebarOpen(false)}></div> 
          </div>
        )}

      <div className="flex-1 flex flex-col p-2 sm:p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-2 sm:mb-4">
            <div className="flex items-center">
                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 mr-2 rounded-md text-neutral-darker dark:text-secondary-light hover:bg-secondary dark:hover:bg-neutral-darkest" aria-label="Open sidebar">
                    <Bars3Icon className="w-6 h-6" />
                </button>
                <h2 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light truncate">
                    {isRealTimeTranslationMode ? <LanguageIcon className="w-5 h-5 inline-block mr-2 align-text-bottom"/> : <ChatBubbleLeftRightIcon className="w-5 h-5 inline-block mr-2 align-text-bottom"/>}
                    {isRealTimeTranslationMode ? "Real-Time Translation" : (isAiAgentMode ? "AI Agent" : (currentChatName || "New Chat"))}
                </h2>
            </div>
            {/* Search Bar - Hidden in Real-Time Translation Mode */}
            {!isRealTimeTranslationMode && (
              <div className="flex items-center space-x-1.5 ml-2">
                  <div className="relative">
                      <input
                          type="search"
                          placeholder="Search messages..."
                          value={tempSearchQuery}
                          onChange={(e) => setTempSearchQuery(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') executeSearch(); }}
                          className="pl-8 pr-2 py-1.5 border border-secondary dark:border-neutral-darkest rounded-md text-sm bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none w-32 sm:w-48"
                          aria-label="Search messages in current chat"
                      />
                      <MagnifyingGlassIcon className="w-4 h-4 absolute left-2 top-1/2 transform -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
                  </div>
                  {isSearchActive && (
                      <>
                          <button onClick={() => navigateSearchResults('prev')} disabled={searchResults.length === 0} className="p-1.5 rounded-md text-neutral-darker dark:text-secondary-light hover:bg-secondary/70 dark:hover:bg-neutral-darkest disabled:opacity-50" aria-label="Previous search result" >
                              <ChevronLeftIcon className="w-4 h-4" />
                          </button>
                          <span className="text-xs text-neutral-500 dark:text-neutral-400">
                              {searchResults.length > 0 ? `${currentSearchResultIndex + 1}/${searchResults.length}` : '0/0'}
                          </span>
                          <button onClick={() => navigateSearchResults('next')} disabled={searchResults.length === 0} className="p-1.5 rounded-md text-neutral-darker dark:text-secondary-light hover:bg-secondary/70 dark:hover:bg-neutral-darkest disabled:opacity-50" aria-label="Next search result" >
                              <ChevronRightIcon className="w-4 h-4" />
                          </button>
                          <button onClick={clearSearch} className="p-1.5 rounded-md text-neutral-darker dark:text-secondary-light hover:bg-secondary/70 dark:hover:bg-neutral-darkest" aria-label="Clear search" >
                              <XMarkIcon className="w-4 h-4" />
                          </button>
                      </>
                  )}
              </div>
            )}
        </div>

        {/* Main Content Area: Chat Messages OR Real-Time Translation UI */}
        {isRealTimeTranslationMode ? (
            <div className="flex-grow grid grid-rows-2 gap-2 sm:gap-4 overflow-hidden mb-4">
                <div className="bg-neutral-light dark:bg-neutral-darker p-3 rounded-lg shadow-sm overflow-y-auto border border-secondary dark:border-neutral-darkest">
                    <h3 className="font-semibold text-neutral-darker dark:text-secondary-light mb-2 sticky top-0 bg-neutral-light dark:bg-neutral-darker py-1">Your Speech (Transcription)</h3>
                    <p className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-200">{liveTranscriptionDisplay || "Waiting for speech..."}</p>
                </div>
                <div className="bg-neutral-light dark:bg-neutral-darker p-3 rounded-lg shadow-sm overflow-y-auto border border-secondary dark:border-neutral-darkest">
                    <div className="flex justify-between items-center sticky top-0 bg-neutral-light dark:bg-neutral-darker py-1 mb-2">
                        <h3 className="font-semibold text-neutral-darker dark:text-secondary-light">Translation ({targetTranslationLangName})</h3>
                        <button
                            onClick={handleSpeakLiveTranslation}
                            disabled={!liveTranslationDisplay.trim() || isSpeakingLiveTranslation || isListening}
                            className="p-1.5 rounded-full text-primary dark:text-primary-light hover:bg-secondary/70 dark:hover:bg-neutral-dark disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label={isSpeakingLiveTranslation ? "Stop speaking translation" : "Speak translation"}
                            title={isSpeakingLiveTranslation ? "Stop speaking translation" : "Speak translation"}
                        >
                            {isSpeakingLiveTranslation ? <StopCircleIcon className="w-5 h-5" /> : <SpeakerWaveIcon className="w-5 h-5" />}
                        </button>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-200">{liveTranslationDisplay || "Translation will appear here..."}</p>
                </div>
            </div>
        ) : ( /* Chat Messages or AI Agent UI */
          <div 
            ref={chatContainerRef}
            className="flex-grow overflow-y-auto mb-4 pr-2 space-y-2 relative" 
            style={chatAreaStyle}
          >
            {messages.map((msg, index) => {
                const nextMessage = messages[index + 1];
                
                const showAvatar = !nextMessage || nextMessage.sender !== msg.sender;
                return (
                    <div key={msg.id} ref={(el: HTMLDivElement | null) => { if(el) messageRefs.current[msg.id] = el; }}>
                        <MessageBubble 
                            message={msg}
                            showAvatar={showAvatar}
                            onImageClick={msg.sender === 'ai' && msg.imagePreviews && msg.imagePreviews.length > 0 ? handleOpenImageModal : undefined}
                            onRegenerate={msg.sender === 'ai' && msg.promptedByMessageId && !msg.isRegenerating && !isAiAgentMode ? handleRegenerateResponse : undefined}
                            isLoading={isLoading}
                            onPlayAudio={msg.audioUrl ? () => handlePlayAudio(msg.audioUrl!, msg.id) : undefined}
                            isAudioPlaying={currentPlayingMessageId === msg.id}
                            searchQuery={isSearchActive ? searchQuery : ''}
                            isCurrentSearchResult={isSearchActive && searchResults[currentSearchResultIndex]?.messageId === msg.id}
                        />
                    </div>
                );
            })}
            {isLoading && messages.length > 0 && messages[messages.length-1]?.sender === 'user' && !messages[messages.length-1]?.isRegenerating && ( 
              <MessageBubble key="loading" message={{id: 'loading', text: isImagenModelSelected ? 'Generating image(s)...' : (isTextToSpeechModelSelected ? 'Synthesizing audio...' : (isAiAgentMode ? 'AI Agent is processing your goal...' : 'Thinking...')), sender: 'ai', model: selectedModel, timestamp: Date.now(), promptedByMessageId: messages[messages.length-1].id }} showAvatar={true} />
            )}
            {isLoading && messages.length === 0 && ( 
              <MessageBubble key="loading-initial" message={{id: 'loading-initial', text: isImagenModelSelected ? 'Generating image(s)...' : (isTextToSpeechModelSelected ? 'Synthesizing audio...' : (isAiAgentMode ? 'AI Agent is processing your goal...' : 'Thinking...')), sender: 'ai', model: selectedModel, timestamp: Date.now(), promptedByMessageId: 'initial' }} showAvatar={true} />
            )}
            <div ref={chatEndRef} />
            {/* Scroll to Bottom Button - Only shown if not in RTTM */}
            {!isRealTimeTranslationMode &&(
                <button
                    onClick={scrollToBottomUiButton}
                    className={`
                        absolute bottom-4 right-4 z-20 p-2.5 
                        bg-primary dark:bg-primary-light text-white 
                        rounded-full shadow-lg 
                        hover:bg-primary-dark dark:hover:bg-primary 
                        focus:outline-none focus:ring-2 focus:ring-primary-dark dark:focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-neutral-darker 
                        transition-all duration-300 ease-in-out transform
                        ${showScrollToBottomButton ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}
                    `}
                    aria-label="Scroll to latest messages"
                    title="Scroll to Bottom"
                    aria-hidden={!showScrollToBottomButton}
                >
                    <ChevronDownIcon className="w-5 h-5" />
                </button>
            )}
          </div>
        )}

        {error && !isRealTimeTranslationMode && <div className="text-red-500 dark:text-red-400 p-2 my-2 bg-red-100 dark:bg-red-900 border border-red-500 dark:border-red-400 rounded-md text-sm">{error}</div>}

        {/* Attachments Preview - Hidden in Real-Time Translation Mode */}
        {!isRealTimeTranslationMode && (!isImagenModelSelected && !isTextToSpeechModelSelected && (imagePreview || uploadedTextFileName)) && (
            <div className="mb-2 p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-secondary-light dark:bg-neutral-darker">
                {imagePreview && ( 
                    <div className="relative group inline-block w-24 h-24 mr-2 align-top">
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded"/>
                        <button onClick={() => { handleImageUpload(null); }} className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Remove image" >
                           <XMarkIcon className="w-4 h-4" />
                        </button>
                    </div>
                )}
                {uploadedTextFileName && (
                     <div className="inline-block align-top text-sm text-neutral-darker dark:text-secondary-light mt-1">
                        <span className="mr-2">Attached File: {uploadedTextFileName}</span>
                        <button onClick={() => { handleFileUpload(null); }} className="text-red-500 hover:text-red-700 inline-flex items-center" aria-label="Remove file" >
                           <XMarkIcon className="w-4 h-4" />
                        </button>
                        {!uploadedTextFileContent && uploadedTextFileName && <p className="text-xs italic">(Content not displayed for this file type)</p>}
                    </div>
                )}
            </div>
        )}

        {/* Input Area: Standard Chat Input OR Real-Time Translation Controls OR AI Agent Input */}
        <div className="flex items-end border-t border-secondary dark:border-neutral-darkest pt-2 sm:pt-4">
          {isRealTimeTranslationMode ? (
            <div className="w-full flex justify-center">
                <button
                  onClick={handleToggleListen}
                  disabled={!isSpeechRecognitionSupported || isSpeakingLiveTranslation}
                  className={`p-3 rounded-lg transition-colors self-stretch flex items-center justify-center text-xl ${
                    isListening 
                      ? 'bg-red-500 hover:bg-red-600 text-white' 
                      : 'bg-green-500 hover:bg-green-600 text-white' 
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  aria-label={isListening ? "Stop Real-Time Translation" : "Start Real-Time Translation"}
                  aria-pressed={isListening}
                >
                  {isListening ? <StopCircleIcon className="w-8 h-8" /> : <MicrophoneIcon className="w-8 h-8" />}
                  <span className="ml-2 text-lg">{isListening ? "Stop Recording" : "Start Recording"}</span>
                </button>
            </div>
          ) : (
            <>
              {(!isImagenModelSelected && !isTextToSpeechModelSelected && !isAiAgentMode) && ( // Hide mic for AI Agent if not needed
                <button
                  onClick={handleToggleListen}
                  disabled={isLoading || !isSpeechRecognitionSupported || isImagenModelSelected || isTextToSpeechModelSelected || isGpt41AccessModalOpen}
                  className={`mr-2 p-3 rounded-lg transition-colors self-stretch flex items-center justify-center ${
                    isListening 
                      ? 'bg-red-500 hover:bg-red-600 text-white' 
                      : 'bg-secondary dark:bg-neutral-darkest hover:bg-secondary-dark dark:hover:bg-neutral-dark text-primary dark:text-primary-light'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  aria-label={isListening ? "Stop voice input" : "Start voice input"}
                  aria-pressed={isListening}
                >
                  {isListening ? <StopCircleIcon className="w-6 h-6" /> : <MicrophoneIcon className="w-6 h-6" />}
                </button>
              )}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey && !isLoading && !isListening) { e.preventDefault(); handleSendMessage(); }}}
                placeholder={currentPromptPlaceholder()}
                className="flex-grow p-3 border border-secondary dark:border-neutral-darkest rounded-lg focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:border-transparent outline-none resize-none bg-neutral-light dark:bg-neutral-darker text-neutral-darker dark:text-secondary-light"
                rows={calculateTextareaRows()}
                disabled={isLoading || isListening || isGpt41AccessModalOpen}
                aria-label="Chat input"
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading || isListening || isGpt41AccessModalOpen || ((!input.trim() && !uploadedImage && !uploadedTextFileName) && (isAiAgentMode ? (!uploadedImage && !uploadedTextFileName) : (!isImagenModelSelected && !isTextToSpeechModelSelected))) }
                className="ml-2 p-3 bg-primary hover:bg-primary-dark dark:bg-primary-light dark:hover:bg-primary text-white rounded-lg disabled:opacity-50 transition-colors self-stretch flex items-center justify-center" 
                aria-label={sendButtonLabel()} >
                {sendButtonIcon()}
              </button>
            </>
          )}
        </div>
      </div>
      {isImageModalOpen && modalImage && (
        <ImageModal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} imageBase64={modalImage} prompt={modalPrompt} mimeType={modalMimeType} />
      )}

      {/* GPT-4.1 Access Modal */}
      {isGpt41AccessModalOpen && (
        <div 
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300"
            onClick={() => handleGpt41AccessModalClose(true, "gpt-4.1 requires a code to use. Switched to gpt-4.1-mini.")}
            role="dialog"
            aria-modal="true"
            aria-labelledby="gpt41-access-modal-title"
        >
            <div 
                className="bg-neutral-light dark:bg-neutral-darker rounded-lg shadow-xl p-6 w-full max-w-md transform transition-all duration-300 scale-100 opacity-100"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 id="gpt41-access-modal-title" className="text-lg font-semibold text-neutral-darker dark:text-secondary-light flex items-center">
                        <KeyIcon className="w-5 h-5 mr-2 text-primary dark:text-primary-light"/> Access gpt-4.1 Model
                    </h3>
                    <button
                        onClick={() => handleGpt41AccessModalClose(true, "gpt-4.1 requires a code to use. Switched to gpt-4.1-mini.")}
                        className="p-1 rounded-full hover:bg-secondary dark:hover:bg-neutral-dark"
                        aria-label="Close"
                    >
                        <XMarkIcon className="w-5 h-5 text-neutral-darker dark:text-secondary-light" />
                    </button>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4">
                    This is a new test model, will soon debut. If you have a secret code, enter below to use.
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
                <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2">
                    <button
                        onClick={() => handleGpt41AccessModalClose(true, "Switched to gpt-4.1-mini.")}
                        className="px-4 py-2 text-sm font-medium text-neutral-darker dark:text-secondary-light bg-secondary dark:bg-neutral-darkest hover:bg-secondary-dark dark:hover:bg-neutral-dark rounded-md transition-colors w-full sm:w-auto"
                    >
                        Use gpt-4.1-mini instead
                    </button>
                    <button
                        onClick={handleGpt41CodeSubmit}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark dark:bg-primary-light dark:text-neutral-darker dark:hover:bg-primary rounded-md transition-colors w-full sm:w-auto"
                    >
                        Submit Code
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
