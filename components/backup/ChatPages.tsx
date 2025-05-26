// Fix: Remove triple-slash directive for 'vite/client' as its types are not found and import.meta.env is manually typed.
// Fix: Add 'useMemo' to React import
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
// Update to .ts/.tsx extensions
import { Model, ChatMessage, ModelSettings, AllModelSettings, Part, GroundingSource, GeminiChatState, ApiKeyStatus, getActualModelIdentifier, ApiChatMessage, ApiStreamChunk, ImagenSettings, ChatSession, Persona, OpenAITtsSettings } from '../types.ts';
import { ALL_MODEL_DEFAULT_SETTINGS, LOCAL_STORAGE_SETTINGS_KEY, LOCAL_STORAGE_HISTORY_KEY, LOCAL_STORAGE_PERSONAS_KEY } from '../constants.ts';
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
// Added MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon
import { PaperAirplaneIcon, CogIcon, XMarkIcon, PhotoIcon as PromptIcon, Bars3Icon, ChatBubbleLeftRightIcon, ClockIcon as HistoryIcon, MicrophoneIcon, StopCircleIcon, SpeakerWaveIcon, MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon } from './Icons.tsx';

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


const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<Model>(Model.GEMINI);
  const { addNotification } = useNotification(); 

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
    const activePersona = activePersonaId ? personas.find(p => p.id === activePersonaId) : null;
    if (activePersona && selectedModel !== Model.IMAGEN3 && selectedModel !== Model.OPENAI_TTS) {
      return { ...baseSettings, systemInstruction: activePersona.instruction };
    }
    return baseSettings;
  }, [allSettings, selectedModel, activePersonaId, personas]);


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
  const [geminiChatState, setGeminiChatState] = useState<GeminiChatState | null>(null);

  const isImagenModelSelected = selectedModel === Model.IMAGEN3;
  const isTextToSpeechModelSelected = selectedModel === Model.OPENAI_TTS;


  const [savedSessions, setSavedSessions] = useState<ChatSession[]>(() => {
    try {
      const storedHistory = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
      if (storedHistory) {
        return JSON.parse(storedHistory);
      }
    } catch (error: any) {
      console.error("Error loading chat history from localStorage during init:", error);
    }
    return []; 
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentChatName, setCurrentChatName] = useState<string>("New Chat");

  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null); 
  const [modalPrompt, setModalPrompt] = useState<string>('');
  const [modalMimeType, setModalMimeType] = useState<'image/jpeg' | 'image/png'>('image/jpeg');

  // Speech-to-Text state
  const [isListening, setIsListening] = useState(false);
  const [isSpeechRecognitionSupported, setIsSpeechRecognitionSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const inputBeforeSpeechRef = useRef<string>("");
  const currentRecognizedTextSegmentRef = useRef<string>("");

  // Audio playback state
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [currentPlayingAudio, setCurrentPlayingAudio] = useState<string | null>(null); // Stores ID of message whose audio is playing
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [tempSearchQuery, setTempSearchQuery] = useState(''); // For input field before search is executed
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentSearchResultIndex, setCurrentSearchResultIndex] = useState(-1);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});


  const apiKeyStatuses = React.useMemo((): Record<Model, ApiKeyStatus> => {
    const env = (window as any).process?.env || {};
    const geminiApiKeySet = !!env.API_KEY;
    const openaiApiKeySet = !!env.VITE_OPENAI_API_KEY;

    return {
      [Model.GEMINI]: {isSet: geminiApiKeySet, envVarName: 'API_KEY', modelName: 'Gemini Flash (AI Studio)', isMock: false, isGeminiPlatform: true},
      [Model.GEMINI_ADVANCED]: {isSet: geminiApiKeySet, envVarName: 'API_KEY', modelName: 'Gemini Advanced (AI Studio)', isMock: false, isGeminiPlatform: true},
      [Model.GPT4O]: {isSet: openaiApiKeySet, envVarName: 'VITE_OPENAI_API_KEY', modelName: 'ChatGPT', isMock: false, isGeminiPlatform: false},
      [Model.DEEPSEEK]: { isSet: !!env.VITE_DEEPSEEK_API_KEY, envVarName: 'VITE_DEEPSEEK_API_KEY', modelName: 'Deepseek', isMock: false, isGeminiPlatform: false},
      [Model.CLAUDE]: { isSet: !!env.VITE_CLAUDE_API_KEY, envVarName: 'VITE_CLAUDE_API_KEY', modelName: 'Claude', isMock: true, isGeminiPlatform: false},
      [Model.IMAGEN3]: {isSet: geminiApiKeySet, envVarName: 'API_KEY', modelName: 'Imagen3 Image Gen (AI Studio)', isMock: false, isGeminiPlatform: true, isImageGeneration: true},
      [Model.OPENAI_TTS]: {isSet: openaiApiKeySet, envVarName: 'VITE_OPENAI_API_KEY', modelName: 'OpenAI TTS', isMock: false, isGeminiPlatform: false, isTextToSpeech: true }
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
    try {
      localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(savedSessions));
    } catch (error: any) {
      console.error("Error saving chat history to localStorage:", error);
      addNotification("Failed to save chat history.", "error", error.message);
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
    if (!isSearchActive) { // Only auto-scroll on new messages if search is not active
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSearchActive]);
  
  useEffect(() => {
    const currentModelStatus = apiKeyStatuses[selectedModel];
    const isCurrentModelOnGeminiPlatform = currentModelStatus?.isGeminiPlatform;

    if (!isCurrentModelOnGeminiPlatform || currentModelStatus?.isMock || currentModelStatus?.isImageGeneration || currentModelStatus?.isTextToSpeech) {
      setGeminiChatState(null); 
    }
    if ((!isCurrentModelOnGeminiPlatform || currentModelStatus?.isImageGeneration || currentModelStatus?.isTextToSpeech) && isWebSearchEnabled) {
        setIsWebSearchEnabled(false);
    }
    
    if (isImagenModelSelected || isTextToSpeechModelSelected) { 
        setUploadedImage(null);
        setImagePreview(null); 
        setUploadedTextFileContent(null);
        setUploadedTextFileName(null);
        setActivePersonaId(null); 
        if (isListening) { 
            recognitionRef.current?.stop();
            setIsListening(false);
        }
    }
    if (currentPlayingAudio && audioPlayerRef.current) {
        audioPlayerRef.current.pause(); // Stop playback if model changes etc.
        setCurrentPlayingAudio(null);   // Update state to reflect no audio is playing
    }

  }, [selectedModel, apiKeyStatuses, isWebSearchEnabled, isImagenModelSelected, isTextToSpeechModelSelected, isListening]);

  // Speech-to-Text Effect
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      setIsSpeechRecognitionSupported(true);
      recognitionRef.current = new SpeechRecognitionAPI() as SpeechRecognition;
      const recognition = recognitionRef.current;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language.startsWith('vi') ? 'vi-VN' : (navigator.language || 'en-US');

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = 0; i < event.results.length; i++) {
          const transcriptPart = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptPart;
          } else {
            interimTranscript += transcriptPart;
          }
        }
        
        if (finalTranscript.trim() && finalTranscript !== currentRecognizedTextSegmentRef.current) {
             inputBeforeSpeechRef.current = inputBeforeSpeechRef.current + 
                                           (inputBeforeSpeechRef.current.trim() && finalTranscript.trim() ? " " : "") +
                                           finalTranscript.trim();
             currentRecognizedTextSegmentRef.current = ""; 
             setInput(inputBeforeSpeechRef.current);
        } else {
            currentRecognizedTextSegmentRef.current = interimTranscript;
            setInput(
              inputBeforeSpeechRef.current +
              (inputBeforeSpeechRef.current.trim() && currentRecognizedTextSegmentRef.current.trim() ? " " : "") +
              currentRecognizedTextSegmentRef.current
            );
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (currentRecognizedTextSegmentRef.current.trim()) {
             const finalText = inputBeforeSpeechRef.current +
                          (inputBeforeSpeechRef.current.trim() && currentRecognizedTextSegmentRef.current.trim() ? " " : "") +
                          currentRecognizedTextSegmentRef.current.trim();
             setInput(finalText);
        } else {
             setInput(inputBeforeSpeechRef.current.trim());
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error', event.error, event.message);
        let errorMessage = `Speech recognition error: ${event.error}.`;
        if (event.error === 'not-allowed') {
          errorMessage = "Microphone access denied. Please allow microphone access in your browser settings.";
        } else if (event.error === 'no-speech') {
          errorMessage = "No speech detected. Please try again.";
        }
        addNotification(errorMessage, "error", event.message);
        setIsListening(false);
      };

      return () => {
        recognition?.stop();
      };
    } else {
      setIsSpeechRecognitionSupported(false);
      addNotification("Speech recognition is not supported by your browser.", "info");
    }
  }, [addNotification]);

  const handleToggleListen = () => {
    if (!isSpeechRecognitionSupported || !recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      inputBeforeSpeechRef.current = input; 
      currentRecognizedTextSegmentRef.current = ""; 
      recognitionRef.current.start();
      setIsListening(true);
    }
  };


  const handleModelSettingsChange = useCallback((newSettings: Partial<ModelSettings & ImagenSettings & OpenAITtsSettings>) => {
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
      if (activeP && 'systemInstruction' in processedNewSettings && selectedModel !== Model.IMAGEN3 && selectedModel !== Model.OPENAI_TTS) {
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
    setGeminiChatState(null); 
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
        } else if (firstUserMessage.text) {
            sessionName = firstUserMessage.text.substring(0, 40) + (firstUserMessage.text.length > 40 ? '...' : '');
        } else if (firstUserMessage.imagePreview) {
            sessionName = "Chat with Image Upload";
        } else if (firstUserMessage.fileName) {
            sessionName = `Chat with File: ${firstUserMessage.fileName}`;
        }
    }


    if (activeSessionId) {
      setSavedSessions(prev => prev.map(s => s.id === activeSessionId ? {
        ...s,
        name: s.name, 
        messages: [...messages],
        model: selectedModel,
        modelSettingsSnapshot: {...modelSettings}, 
        timestamp: sessionTimestamp,
        activePersonaIdSnapshot: activePersonaId, 
      } : s));
      setCurrentChatName(savedSessions.find(s => s.id === activeSessionId)?.name || sessionName);
      addNotification(`Chat "${currentChatName}" updated.`, "success");
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
      setSavedSessions(prev => [...prev, newSession]);
      setActiveSessionId(newSessionId);
      setCurrentChatName(sessionName);
      addNotification(`Chat "${sessionName}" saved.`, "success");
    }
    clearSearch();
  }, [messages, selectedModel, modelSettings, activeSessionId, savedSessions, activePersonaId, addNotification, currentChatName]);

  const handleLoadSession = useCallback((sessionId: string) => {
    const sessionToLoad = savedSessions.find(s => s.id === sessionId);
    if (sessionToLoad) {
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
      setGeminiChatState(null); 
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
    setGeminiChatState(null);
    setUploadedImage(null);
    setImagePreview(null);
    setUploadedTextFileContent(null);
    setUploadedTextFileName(null);
    setIsWebSearchEnabled(false);
    setAllSettings(prev => ({
        ...prev,
        [selectedModel]: { ...(ALL_MODEL_DEFAULT_SETTINGS[selectedModel] || ALL_MODEL_DEFAULT_SETTINGS[Model.GEMINI]!) }
    }));
    setActivePersonaId(null); 
    setError(null);
    setIsSidebarOpen(false); 
    addNotification("Started new chat.", "info");
    clearSearch();
  }, [selectedModel, addNotification]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    const sessionToDelete = savedSessions.find(s => s.id === sessionId);
    setSavedSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      handleStartNewChat(); // This will also call clearSearch
    }
    if (sessionToDelete) {
      addNotification(`Deleted chat: "${sessionToDelete.name}".`, "info");
    }
  }, [activeSessionId, handleStartNewChat, savedSessions, addNotification]); 
  
  const handleRenameSession = useCallback((sessionId: string, newName: string) => {
    setSavedSessions(prev => prev.map(s => s.id === sessionId ? { ...s, name: newName } : s));
    if (activeSessionId === sessionId) {
        setCurrentChatName(newName);
    }
    addNotification(`Chat renamed to "${newName}".`, "info");
  }, [activeSessionId, addNotification]);

  const handleTogglePinSession = useCallback((sessionId: string) => {
    let sessionName = "";
    let isNowPinned = false;
    setSavedSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        sessionName = s.name;
        isNowPinned = !s.isPinned;
        return { ...s, isPinned: !s.isPinned };
      }
      return s;
    }));
    if (sessionName) {
      addNotification(isNowPinned ? `Pinned "${sessionName}".` : `Unpinned "${sessionName}".`, "info");
    }
  }, [addNotification]);


  const handleOpenImageModal = useCallback((imageB64: string, promptText: string, mime: 'image/jpeg' | 'image/png') => {
    setModalImage(imageB64);
    setModalPrompt(promptText);
    setModalMimeType(mime);
    setIsImageModalOpen(true);
  }, []);

  const handlePlayAudio = useCallback((audioUrl: string, messageId: string) => {
    if (!audioPlayerRef.current) return;
    const player = audioPlayerRef.current;

    if (currentPlayingAudio === messageId) { 
      if (player.paused) {
        player.play().catch(e => {
          if ((e as DOMException).name === 'AbortError') {
            console.log('Audio play() request was aborted (e.g., by user action or new audio source). This is usually normal.');
          } else {
            console.error("Error resuming audio:", e);
            addNotification("Error resuming audio.", "error", (e as Error).message);
          }
          setCurrentPlayingAudio(null); 
        });
      } else {
        player.pause(); 
      }
    } else { 
      if (player.currentSrc && !player.paused) { 
          player.pause(); 
      }

      player.src = audioUrl;
      setCurrentPlayingAudio(messageId); 
      
      player.play().catch(e => {
        if ((e as DOMException).name === 'AbortError') {
           console.log('Audio play() request was aborted (e.g., by user action or new audio source). This is usually normal.');
        } else {
          console.error("Error playing new audio:", e);
          addNotification("Error playing new audio.", "error", (e as Error).message);
        }
        if (currentPlayingAudio === messageId) { 
          setCurrentPlayingAudio(null);
        }
      });
    }
  }, [currentPlayingAudio, addNotification]);

  useEffect(() => {
    const player = audioPlayerRef.current;
    if (player) {
        const handleAudioEndOrPause = () => setCurrentPlayingAudio(null);
        player.addEventListener('ended', handleAudioEndOrPause);
        player.addEventListener('pause', handleAudioEndOrPause); 
        return () => {
            player.removeEventListener('ended', handleAudioEndOrPause);
            player.removeEventListener('pause', handleAudioEndOrPause);
        };
    }
  }, []);


  const internalSendMessage = async (
    currentInputText: string,
    currentUploadedImage: File | null,
    currentImagePreview: string | null,
    currentUploadedTextContent: string | null,
    currentUploadedTextFileName: string | null,
    isRegenerationOfAiMsgId?: string 
  ) => {
    
    const userMessageId = Date.now().toString();
    let constructedMessageText = currentInputText.trim();
    const originalUserPromptForAi = currentInputText.trim(); 

    if (currentUploadedTextFileName && !isImagenModelSelected && !isTextToSpeechModelSelected) {
        let fileInfo = `The user has uploaded a file named "${currentUploadedTextFileName}".`;
        if (currentUploadedTextContent) {
            fileInfo += `\nThe content of this file is:\n${currentUploadedTextContent}`;
        }
        constructedMessageText = `${fileInfo}\n\n---\n\n${originalUserPromptForAi}`;
    }

    const newUserMessage: ChatMessage = {
        id: userMessageId,
        text: originalUserPromptForAi,
        sender: 'user',
        imagePreview: !isImagenModelSelected && !isTextToSpeechModelSelected ? currentImagePreview || undefined : undefined,
        fileName: !isImagenModelSelected && !isTextToSpeechModelSelected ? currentUploadedTextFileName || undefined : undefined,
        isImageQuery: isImagenModelSelected,
    };

    if (!isRegenerationOfAiMsgId) {
        setMessages((prev) => [...prev, newUserMessage]);
    }
    
    const aiMessageId = isRegenerationOfAiMsgId || (Date.now() + 1).toString();
    const aiMessagePlaceholder: ChatMessage = {
        id: aiMessageId,
        text: isImagenModelSelected ? 'Generating image(s)...' : (isTextToSpeechModelSelected ? 'Synthesizing audio...' : (isRegenerationOfAiMsgId ? 'Regenerating...' : '')),
        sender: 'ai',
        model: selectedModel,
        isRegenerating: !!isRegenerationOfAiMsgId,
        promptedByMessageId: userMessageId, 
    };

    if (isRegenerationOfAiMsgId) {
        setMessages(prev => prev.map(msg => msg.id === aiMessageId ? aiMessagePlaceholder : msg));
    } else {
        setMessages((prev) => [...prev, aiMessagePlaceholder]);
    }

    const geminiParts: Part[] = [];
    if (constructedMessageText.trim() && !isImagenModelSelected && !isTextToSpeechModelSelected) {
        geminiParts.push({ text: constructedMessageText.trim() });
    }
    if (currentUploadedImage && currentImagePreview && !isImagenModelSelected && !isTextToSpeechModelSelected) {
        const base64Image = currentImagePreview.split(',')[1];
        geminiParts.push({ inlineData: { mimeType: currentUploadedImage.type as 'image/jpeg' | 'image/png', data: base64Image } });
    }
    
    try {
      const currentModelSpecificSettings = modelSettings as ModelSettings & ImagenSettings & OpenAITtsSettings;
      const currentModelStatus = apiKeyStatuses[selectedModel];
      const actualModelIdentifier = getActualModelIdentifier(selectedModel);
      const env = (window as any).process?.env || {};

      if (currentModelStatus?.isTextToSpeech && !currentModelStatus.isMock) {
        const ttsApiKey = env[currentModelStatus.envVarName] as string | undefined;
        if (!ttsApiKey) throw new Error (`${currentModelStatus.modelName} API Key (${currentModelStatus.envVarName}) is not configured.`);

        const ttsResult = await generateOpenAITTS({
            apiKey: ttsApiKey,
            modelIdentifier: currentModelSpecificSettings.modelIdentifier || 'tts-1',
            textInput: originalUserPromptForAi,
            voice: currentModelSpecificSettings.voice || 'alloy',
            speed: currentModelSpecificSettings.speed || 1.0
        });

        if (ttsResult.error) throw new Error(ttsResult.error);
        if (ttsResult.audioBlob) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64AudioUrl = reader.result as string;
                setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? {
                    ...msg,
                    text: `Audio generated for: "${originalUserPromptForAi}"`,
                    audioUrl: base64AudioUrl,
                    isRegenerating: false
                } : msg));
                 if (audioPlayerRef.current && base64AudioUrl) { 
                    handlePlayAudio(base64AudioUrl, aiMessageId);
                }
            };
            reader.onerror = (error) => {
                console.error("FileReader error converting blob to Base64:", error);
                addNotification("Error processing audio for playback.", "error", (error as any)?.message);
                setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? {
                    ...msg,
                    text: `Error processing audio for: "${originalUserPromptForAi}". Playback might fail.`,
                    isRegenerating: false
                } : msg));
            };
            reader.readAsDataURL(ttsResult.audioBlob);
        } else {
            throw new Error("TTS generation failed to return audio.");
        }

      } else if (currentModelStatus?.isGeminiPlatform && !currentModelStatus.isMock) { 
        const geminiApiKey = env.API_KEY as string | undefined;
        if (!geminiApiKey) throw new Error(`Gemini API Key (API_KEY) is not configured in config.js for ${currentModelStatus.modelName}.`);

        if (isImagenModelSelected) { 
            const imagenSettings = currentModelSpecificSettings as ImagenSettings;
            const result = await generateImageWithImagen({
              prompt: originalUserPromptForAi, modelSettings: imagenSettings, modelName: actualModelIdentifier, apiKey: geminiApiKey,
            });

            if (result.error) throw new Error(result.error);
            if (result.imageBases64 && result.imageBases64.length > 0) {
              const mimeType = imagenSettings.outputMimeType || 'image/jpeg';
              const imageUrls = result.imageBases64.map(base64 => `data:${mimeType};base64,${base64}`);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMessageId ? { 
                    ...msg, text: `Generated ${imageUrls.length} image(s) for: "${originalUserPromptForAi}"`, 
                    imagePreviews: imageUrls, imageMimeType: mimeType, originalPrompt: originalUserPromptForAi, isRegenerating: false,
                  } : msg
                )
              );
            } else { throw new Error("Image generation failed to return any images."); }
        } else { 
            let chatStateToUse = geminiChatState;
            if (chatStateToUse &&
                (chatStateToUse.currentModel !== actualModelIdentifier ||
                chatStateToUse.currentSystemInstruction !== currentModelSpecificSettings.systemInstruction || 
                chatStateToUse.currentTemperature !== currentModelSpecificSettings.temperature ||
                chatStateToUse.currentTopK !== currentModelSpecificSettings.topK ||
                chatStateToUse.currentTopP !== currentModelSpecificSettings.topP ||
                chatStateToUse.currentEnableWebSearch !== isWebSearchEnabled) 
                ) {
                chatStateToUse = null; setGeminiChatState(null);
            }

            const stream = sendGeminiMessageStream({
              parts: geminiParts, modelSettings: currentModelSpecificSettings as ModelSettings, enableGoogleSearch: isWebSearchEnabled,
              chatState: chatStateToUse, modelName: actualModelIdentifier, apiKey: geminiApiKey,
            });

            let currentText = ''; let currentGroundingSources: GroundingSource[] | undefined = undefined;
            let newChatSessionState : GeminiChatState | undefined = undefined;

            for await (const chunk of stream) {
              if (chunk.error) throw new Error(chunk.error); 
              if (chunk.newChatState && !newChatSessionState) { newChatSessionState = chunk.newChatState; setGeminiChatState(newChatSessionState); }
              if (chunk.textDelta) currentText += chunk.textDelta;
              if (chunk.groundingSources && chunk.groundingSources.length > 0) currentGroundingSources = chunk.groundingSources;
              
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMessageId ? { ...msg, text: currentText, groundingSources: currentGroundingSources || msg.groundingSources, isRegenerating: false } : msg
                )
              );
            }
        }
      } else if (selectedModel === Model.GPT4O && !currentModelStatus.isMock) {
        const apiKey = env[currentModelStatus.envVarName] as string | undefined;
        if (!apiKey) throw new Error(`${currentModelStatus.modelName} API Key (${currentModelStatus.envVarName}) is not configured.`);
        
        const history: ApiChatMessage[] = [{ role: 'system', content: currentModelSpecificSettings.systemInstruction }];
        messages.filter(m => m.id !== aiMessageId && m.id !== newUserMessage.id).forEach(msg => { 
            if (msg.sender === 'user') {
                const userContent: any[] = [];
                if (msg.text) userContent.push({ type: 'text', text: msg.text });
                if (msg.imagePreview && !msg.isImageQuery) userContent.push({ type: 'image_url', image_url: { url: msg.imagePreview } });
                if (userContent.length > 0) history.push({ role: 'user', content: userContent });
                else if (msg.text === "") history.push({ role: 'user', content: " " });
            } else if (msg.sender === 'ai') history.push({ role: 'assistant', content: msg.text });
        });
        
        const currentUserContent: Array<{type: 'text', text: string} | {type: 'image_url', image_url: {url: string, detail?: "auto" | "low" | "high" }}> = [];
        if (constructedMessageText.trim()) currentUserContent.push({ type: 'text', text: constructedMessageText.trim() });
        if (currentUploadedImage && currentImagePreview) currentUserContent.push({ type: 'image_url', image_url: { url: currentImagePreview, detail: "auto" }});

        if(currentUserContent.length > 0) history.push({ role: 'user', content: currentUserContent });
        else if (originalUserPromptForAi === "" && !currentUploadedImage) history.push({ role: 'user', content: " " }); 

        const stream = sendOpenAIMessageStream({ apiKey, modelIdentifier: actualModelIdentifier, history, modelSettings: currentModelSpecificSettings as ModelSettings });
        let currentText = '';
        for await (const chunk of stream) {
          if (chunk.error) throw new Error(chunk.error);
          if (chunk.textDelta) currentText += chunk.textDelta;
          setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? { ...msg, text: currentText, isRegenerating: false } : msg));
          if (chunk.isFinished) break;
        }

      } else if (selectedModel === Model.DEEPSEEK && !currentModelStatus.isMock) {
        const apiKey = env[currentModelStatus.envVarName] as string | undefined;
        if (!apiKey) throw new Error(`${currentModelStatus.modelName} API Key (${currentModelStatus.envVarName}) is not configured.`);

        const history: ApiChatMessage[] = [{ role: 'system', content: currentModelSpecificSettings.systemInstruction }];
         messages.filter(m => m.id !== aiMessageId && m.id !== newUserMessage.id).forEach(msg => {
            if (msg.sender === 'user') history.push({ role: 'user', content: msg.text }); 
            else if (msg.sender === 'ai') history.push({ role: 'assistant', content: msg.text });
        });
        history.push({ role: 'user', content: constructedMessageText.trim() || " " });

        const stream = sendDeepseekMessageStream({ apiKey, modelIdentifier: actualModelIdentifier, history, modelSettings: currentModelSpecificSettings as ModelSettings });
        let currentText = '';
        for await (const chunk of stream) {
          if (chunk.error) throw new Error(chunk.error);
          if (chunk.textDelta) currentText += chunk.textDelta;
          setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? { ...msg, text: currentText, isRegenerating: false } : msg));
          if (chunk.isFinished) break;
        }
      
      } else if (currentModelStatus?.isMock) { 
        const stream = sendMockMessageStream(geminiParts, selectedModel, currentModelSpecificSettings as ModelSettings); 
        let currentText = '';
        for await (const chunk of stream) {
          currentText += chunk;
          setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? { ...msg, text: currentText, isRegenerating: false } : msg));
        }
      } else { throw new Error(`API integration for ${selectedModel} is not implemented or API key/Vertex config is missing and it's not a mock model.`); }
    } catch (e: any) {
      console.error("Error sending message:", e);
      const errorMessage = e.message || 'Failed to get response from AI.';
      setError(errorMessage); 
      addNotification(`API Error: ${errorMessage}`, "error", e.stack); 
      setMessages((prev) => prev.filter(msg => msg.id !== aiMessageId)); 
      setMessages((prev) => [...prev, {id: aiMessageId, text: `Error: ${errorMessage}`, sender: 'ai', model: selectedModel, promptedByMessageId: userMessageId}]);
    }

    setIsLoading(false);
    if (!isRegenerationOfAiMsgId) {
        setInput(''); 
        if (!isImagenModelSelected && !isTextToSpeechModelSelected) { 
            setUploadedImage(null);
            setImagePreview(null); 
            setUploadedTextFileContent(null);
            setUploadedTextFileName(null);
        }
    }
    clearSearch();
  };

  const handleSendMessage = async () => {
    if (isListening) return; 
    if (!input.trim() && !uploadedImage && !uploadedTextFileName && !isImagenModelSelected && !isTextToSpeechModelSelected) return;
    if ((isImagenModelSelected || isTextToSpeechModelSelected) && !input.trim()) {
        const errorMsg = isImagenModelSelected ? "Please enter a prompt for image generation." : "Please enter text for speech synthesis.";
        setError(errorMsg);
        addNotification(errorMsg, "info");
        return;
    }
    setIsLoading(true);
    setError(null);
    await internalSendMessage(input, uploadedImage, imagePreview, uploadedTextFileContent, uploadedTextFileName);
  };
  
  const handleRegenerateResponse = async (aiMessageIdToRegenerate: string, promptedByMsgId: string) => {
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
      let regenImagePreview: string | null = userMessageForRegen.imagePreview || imagePreview;
      let regenUploadedImage: File | null = uploadedImage; 
      let regenUploadedTextContent: string | null = uploadedTextFileContent; 
      let regenUploadedTextFileName: string | null = userMessageForRegen.fileName || uploadedTextFileName; 

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
          regenUploadedImage, 
          regenImagePreview,  
          regenUploadedTextContent, 
          regenUploadedTextFileName, 
          aiMessageIdToRegenerate 
      );
  };


  const handleImageUpload = (file: File | null) => {
    if (isImagenModelSelected || isTextToSpeechModelSelected) return; 
    setUploadedImage(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setImagePreview(reader.result as string); };
      reader.readAsDataURL(file);
    } else { setImagePreview(null); }
    clearSearch();
  };

  const handleFileUpload = (file: File | null) => {
    if (isImagenModelSelected || isTextToSpeechModelSelected) return; 

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
      } else { setUploadedTextFileContent(null); }
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

  
  const sidebarContent = (
    <>
        <div className="flex border-b border-secondary dark:border-neutral-darkest mb-4">
            <button onClick={() => setActiveSidebarTab('settings')} disabled={isLoading}
                className={`flex-1 py-2 px-4 text-sm font-medium text-center rounded-t-lg focus:outline-none flex items-center justify-center ${activeSidebarTab === 'settings' ? 'bg-primary text-white dark:bg-primary-light dark:text-neutral-darker' : 'text-neutral-600 dark:text-neutral-300 hover:bg-secondary/50 dark:hover:bg-neutral-dark/50'}`}
                aria-pressed={activeSidebarTab === 'settings'} >
                <CogIcon className="w-5 h-5 mr-2"/> Settings
            </button>
            <button onClick={() => setActiveSidebarTab('history')} disabled={isLoading}
                className={`flex-1 py-2 px-4 text-sm font-medium text-center rounded-t-lg focus:outline-none flex items-center justify-center ${activeSidebarTab === 'history' ? 'bg-primary text-white dark:bg-primary-light dark:text-neutral-darker' : 'text-neutral-600 dark:text-neutral-300 hover:bg-secondary/50 dark:hover:bg-neutral-dark/50'}`}
                aria-pressed={activeSidebarTab === 'history'} >
                <HistoryIcon className="w-5 h-5 mr-2"/> History
            </button>
        </div>
        {activeSidebarTab === 'settings' && (
            <SettingsPanel
                selectedModel={selectedModel}
                onModelChange={(model) => { setSelectedModel(model); setGeminiChatState(null); clearSearch();}} 
                modelSettings={modelSettings} 
                onModelSettingsChange={handleModelSettingsChange}
                onImageUpload={handleImageUpload}
                imagePreview={imagePreview}
                onFileUpload={handleFileUpload}
                uploadedTextFileName={uploadedTextFileName}
                isWebSearchEnabled={isWebSearchEnabled}
                onWebSearchToggle={setIsWebSearchEnabled}
                disabled={isLoading}
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
                isLoading={isLoading}
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
    if (isListening) return "Đang nghe...";
    if (isImagenModelSelected) return "Enter prompt for image generation...";
    if (isTextToSpeechModelSelected) return "Enter text to synthesize speech...";
    return "Type your message or upload an image/file...";
  }

  const sendButtonLabel = () => {
    if (isImagenModelSelected) return "Generate Image";
    if (isTextToSpeechModelSelected) return "Synthesize Speech";
    return "Send message";
  }

  const sendButtonIcon = () => {
    if (isImagenModelSelected) return <PromptIcon className="w-6 h-6" />;
    if (isTextToSpeechModelSelected) return <SpeakerWaveIcon className="w-6 h-6" />;
    return <PaperAirplaneIcon className="w-6 h-6" />;
  }

  return (
    <div className="flex h-full">
      <audio ref={audioPlayerRef} className="hidden" />
      <div className={`hidden md:flex flex-col w-96 bg-neutral-light dark:bg-neutral-darker p-4 border-r border-secondary dark:border-neutral-darkest overflow-y-auto transition-all duration-300`}>
          {sidebarContent}
      </div>

       {isSidebarOpen && (
          <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-start">
            <div className="w-full max-w-xs sm:max-w-sm h-full bg-neutral-light dark:bg-neutral-darker shadow-xl p-4 overflow-y-auto">
              <button onClick={() => setIsSidebarOpen(false)} className="absolute top-4 right-4 text-neutral-darker dark:text-secondary-light hover:text-red-500 dark:hover:text-red-400 z-50" aria-label="Close sidebar">
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
                    <ChatBubbleLeftRightIcon className="w-5 h-5 inline-block mr-2 align-text-bottom"/>
                    {currentChatName || "New Chat"}
                </h2>
            </div>
            {/* Search Bar */}
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
                        <button
                            onClick={() => navigateSearchResults('prev')}
                            disabled={searchResults.length === 0}
                            className="p-1.5 rounded-md text-neutral-darker dark:text-secondary-light hover:bg-secondary/70 dark:hover:bg-neutral-darkest disabled:opacity-50"
                            aria-label="Previous search result"
                        >
                            <ChevronLeftIcon className="w-4 h-4" />
                        </button>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                            {searchResults.length > 0 ? `${currentSearchResultIndex + 1}/${searchResults.length}` : '0/0'}
                        </span>
                        <button
                            onClick={() => navigateSearchResults('next')}
                            disabled={searchResults.length === 0}
                            className="p-1.5 rounded-md text-neutral-darker dark:text-secondary-light hover:bg-secondary/70 dark:hover:bg-neutral-darkest disabled:opacity-50"
                            aria-label="Next search result"
                        >
                            <ChevronRightIcon className="w-4 h-4" />
                        </button>
                        <button
                            onClick={clearSearch}
                            className="p-1.5 rounded-md text-neutral-darker dark:text-secondary-light hover:bg-secondary/70 dark:hover:bg-neutral-darkest"
                            aria-label="Clear search"
                        >
                            <XMarkIcon className="w-4 h-4" />
                        </button>
                    </>
                )}
            </div>
        </div>

        <div className="flex-grow overflow-y-auto mb-4 pr-2 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} ref={(el: HTMLDivElement | null) => { messageRefs.current[msg.id] = el; }}>
                <MessageBubble 
                    message={msg}
                    onImageClick={msg.sender === 'ai' && msg.imagePreviews && msg.imagePreviews.length > 0 ? handleOpenImageModal : undefined}
                    onRegenerate={msg.sender === 'ai' && msg.promptedByMessageId && !msg.isRegenerating ? handleRegenerateResponse : undefined}
                    isLoading={isLoading}
                    onPlayAudio={msg.audioUrl ? () => handlePlayAudio(msg.audioUrl!, msg.id) : undefined}
                    isAudioPlaying={currentPlayingAudio === msg.id}
                    searchQuery={isSearchActive ? searchQuery : ''}
                    isCurrentSearchResult={isSearchActive && searchResults[currentSearchResultIndex]?.messageId === msg.id}
                />
            </div>
          ))}
          {isLoading && messages.length > 0 && messages[messages.length-1]?.sender === 'user' && !messages[messages.length-1]?.isRegenerating && ( 
             <MessageBubble key="loading" message={{id: 'loading', text: isImagenModelSelected ? 'Generating image(s)...' : (isTextToSpeechModelSelected ? 'Synthesizing audio...' : 'Thinking...'), sender: 'ai', model: selectedModel, promptedByMessageId: messages[messages.length-1].id }} />
          )}
           {isLoading && messages.length === 0 && ( 
             <MessageBubble key="loading-initial" message={{id: 'loading-initial', text: isImagenModelSelected ? 'Generating image(s)...' : (isTextToSpeechModelSelected ? 'Synthesizing audio...' : 'Thinking...'), sender: 'ai', model: selectedModel, promptedByMessageId: 'initial' }} />
          )}
          <div ref={chatEndRef} />
        </div>

        {error && <div className="text-red-500 dark:text-red-400 p-2 my-2 bg-red-100 dark:bg-red-900 border border-red-500 dark:border-red-400 rounded-md text-sm">{error}</div>}

        {(!isImagenModelSelected && !isTextToSpeechModelSelected && (imagePreview || uploadedTextFileName)) && (
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
                        <span className="mr-2">File: {uploadedTextFileName}</span>
                        <button onClick={() => { handleFileUpload(null); }} className="text-red-500 hover:text-red-700 inline-flex items-center" aria-label="Remove file" >
                           <XMarkIcon className="w-4 h-4" />
                        </button>
                        {!uploadedTextFileContent && uploadedTextFileName && <p className="text-xs italic">(Content not displayed for this file type)</p>}
                    </div>
                )}
            </div>
        )}

        <div className="flex items-end border-t border-secondary dark:border-neutral-darkest pt-2 sm:pt-4">
          {(!isImagenModelSelected && !isTextToSpeechModelSelected) && (
            <button
              onClick={handleToggleListen}
              disabled={isLoading || !isSpeechRecognitionSupported || isImagenModelSelected || isTextToSpeechModelSelected}
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
            disabled={isLoading || isListening}
            aria-label="Chat input"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || isListening || (!input.trim() && (!isImagenModelSelected && !isTextToSpeechModelSelected && !uploadedImage && !uploadedTextFileName))}
            className="ml-2 p-3 bg-primary hover:bg-primary-dark dark:bg-primary-light dark:hover:bg-primary text-white rounded-lg disabled:opacity-50 transition-colors self-stretch flex items-center justify-center" 
            aria-label={sendButtonLabel()} >
            {sendButtonIcon()}
          </button>
        </div>
      </div>
      {isImageModalOpen && modalImage && (
        <ImageModal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} imageBase64={modalImage} prompt={modalPrompt} mimeType={modalMimeType} />
      )}
    </div>
  );
};

export default ChatPage;