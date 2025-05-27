// Fix: Remove triple-slash directive for 'vite/client' as its types are not found and import.meta.env is manually typed.
// Fix: Add 'useMemo' to React import
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
// Update to .ts/.tsx extensions
import { Model, ChatMessage, ModelSettings, AllModelSettings, Part, GroundingSource, ApiKeyStatus, getActualModelIdentifier, ApiChatMessage, ApiStreamChunk, ImagenSettings, ChatSession, Persona, OpenAITtsSettings } from '../types.ts';
import type { Content } from '@google/genai'; // For constructing Gemini history
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
  // geminiChatState is removed as proxy calls are stateless for Gemini chat.

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
  const inputBeforeSpeechRef = useRef<string>(""); // Text in input field *before* current STT session started
  const currentRecognizedTextSegmentRef = useRef<string>(""); // Text recognized *during* current STT session (final + latest interim)

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
    const isProxyExpectedToHaveKey = true; 

    return {
      [Model.GEMINI]: {isSet: isProxyExpectedToHaveKey, envVarName: 'GEMINI_API_KEY (on proxy)', modelName: 'Gemini Flash', isMock: false, isGeminiPlatform: true},
      [Model.GEMINI_ADVANCED]: {isSet: isProxyExpectedToHaveKey, envVarName: 'GEMINI_API_KEY (on proxy)', modelName: 'Gemini Advanced', isMock: false, isGeminiPlatform: true},
      [Model.GPT4O]: {isSet: isProxyExpectedToHaveKey, envVarName: 'OPENAI_API_KEY (on proxy)', modelName: 'ChatGPT (gpt-4o)', isMock: false, isGeminiPlatform: false},
      [Model.GPT4O_MINI]: {isSet: isProxyExpectedToHaveKey, envVarName: 'OPENAI_API_KEY (on proxy)', modelName: 'ChatGPT (gpt-4o-mini)', isMock: false, isGeminiPlatform: false},
      [Model.DEEPSEEK]: { isSet: isProxyExpectedToHaveKey, envVarName: 'DEEPSEEK_API_KEY (on proxy)', modelName: 'Deepseek', isMock: false, isGeminiPlatform: false},
      [Model.CLAUDE]: { isSet: true, envVarName: 'N/A (Mock)', modelName: 'Claude', isMock: true, isGeminiPlatform: false}, 
      [Model.IMAGEN3]: {isSet: isProxyExpectedToHaveKey, envVarName: 'GEMINI_API_KEY (on proxy)', modelName: 'Imagen3 Image Gen', isMock: false, isGeminiPlatform: true, isImageGeneration: true},
      [Model.OPENAI_TTS]: {isSet: isProxyExpectedToHaveKey, envVarName: 'OPENAI_API_KEY (on proxy)', modelName: 'OpenAI TTS', isMock: false, isGeminiPlatform: false, isTextToSpeech: true }
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
    // No need to manage geminiChatState as it's removed.
    if ((!currentModelStatus?.isGeminiPlatform || currentModelStatus?.isImageGeneration || currentModelStatus?.isTextToSpeech) && isWebSearchEnabled) {
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
            // Note: onend handler will set isListening to false
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

      recognition.continuous = true; // Keep listening even after a pause in speech
      recognition.interimResults = true; // Get results as they are being recognized
      recognition.lang = navigator.language.startsWith('vi') ? 'vi-VN' : (navigator.language || 'en-US');

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalizedSpeechForThisSession = "";
        let latestInterimSegment = "";

        // Reconstruct the full transcript for the current session from all result segments
        for (let i = 0; i < event.results.length; i++) {
          const segmentTranscript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalizedSpeechForThisSession += (finalizedSpeechForThisSession.length > 0 && segmentTranscript.trim().length > 0 ? " " : "") + segmentTranscript.trim();
          } else {
            latestInterimSegment = segmentTranscript; // Keep track of the latest interim part
          }
        }
        
        currentRecognizedTextSegmentRef.current = finalizedSpeechForThisSession + 
            (finalizedSpeechForThisSession.length > 0 && latestInterimSegment.trim().length > 0 ? " " : "") + 
            latestInterimSegment.trim();

        let displayInput = inputBeforeSpeechRef.current;
        if (displayInput.trim() && currentRecognizedTextSegmentRef.current.trim()) {
          displayInput += " ";
        }
        displayInput += currentRecognizedTextSegmentRef.current;
        setInput(displayInput);
      };

      recognition.onend = () => {
        setIsListening(false);
        // Finalize the input with the text accumulated during the session
        let finalInputText = inputBeforeSpeechRef.current;
        if (finalInputText.trim() && currentRecognizedTextSegmentRef.current.trim()) {
          finalInputText += " ";
        }
        finalInputText += currentRecognizedTextSegmentRef.current.trim();
        setInput(finalInputText);
        // currentRecognizedTextSegmentRef.current will be reset if listening starts again
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
        setIsListening(false); // Ensure listening state is reset
      };

      return () => {
        recognition?.stop();
      };
    } else {
      setIsSpeechRecognitionSupported(false);
      // No addNotification here to avoid spamming if it's called multiple times during setup
    }
  }, [addNotification]); // addNotification is stable

  const handleToggleListen = () => {
    if (!isSpeechRecognitionSupported || !recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop(); // This will trigger 'onend'
    } else {
      inputBeforeSpeechRef.current = input; // Store text existing before this speech session
      currentRecognizedTextSegmentRef.current = ""; // Reset text for current speech session
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e: any) {
        // Handle cases where start() might fail immediately (e.g., already started)
        console.error("Error starting speech recognition:", e);
        addNotification("Could not start voice input. Please try again.", "error", e.message);
        setIsListening(false);
      }
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
    // No geminiChatState to reset
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
      // geminiChatState removed
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
    // geminiChatState removed
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
    
    try {
      const currentModelSpecificSettings = modelSettings as ModelSettings & ImagenSettings & OpenAITtsSettings;
      const currentModelStatus = apiKeyStatuses[selectedModel];
      const actualModelIdentifier = getActualModelIdentifier(selectedModel);
      // env variable is no longer read from client for API keys

      if (currentModelStatus?.isTextToSpeech && !currentModelStatus.isMock) {
        // API key is handled by proxy
        const ttsResult = await generateOpenAITTS({
            // apiKey parameter removed
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
        // API key is handled by proxy
        if (isImagenModelSelected) { 
            const imagenSettings = currentModelSpecificSettings as ImagenSettings;
            const result = await generateImageWithImagen({
              prompt: originalUserPromptForAi, modelSettings: imagenSettings, modelName: actualModelIdentifier, // apiKey removed
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
            } else { throw new Error("Image generation failed to return any images. Check proxy logs and original API response for details."); }
        } else { 
            // Construct Gemini history for stateless proxy call
            const geminiHistory: Content[] = [];
            messages
              .filter(m => m.id !== aiMessageId && m.id !== newUserMessage.id) // Exclude current pending AI and new user message
              .forEach(msg => {
                const messageParts: Part[] = [];
                if (msg.text && msg.text.trim()) {
                  messageParts.push({ text: msg.text.trim() });
                }

                if (msg.sender === 'user' && msg.imagePreview) {
                  try {
                    const [header, base64Data] = msg.imagePreview.split(',');
                    if (base64Data) {
                      const mimeTypeMatch = header.match(/data:(image\/[a-zA-Z0-9-.+]+);base64/);
                      if (mimeTypeMatch && mimeTypeMatch[1]) {
                        messageParts.push({
                          inlineData: {
                            mimeType: mimeTypeMatch[1], // More general MIME type
                            data: base64Data
                          }
                        });
                      } else {
                        console.warn("Could not determine mimeType from user imagePreview in history for Gemini:", msg.imagePreview);
                      }
                    }
                  } catch (e) {
                    console.error("Error processing user imagePreview in history for Gemini:", e);
                  }
                }

                if (msg.sender === 'ai' && msg.imagePreviews && msg.imagePreviews.length > 0) {
                  msg.imagePreviews.forEach(imgPrev => {
                    try {
                      const [header, base64Data] = imgPrev.split(',');
                      if (base64Data) {
                        const mimeType = msg.imageMimeType || (header.includes('/png') ? 'image/png' : (header.includes('/jpeg') ? 'image/jpeg' : 'image/jpeg')); // Basic inference
                        messageParts.push({
                          inlineData: {
                            mimeType: mimeType as 'image/jpeg' | 'image/png', // Still keep it tight for Gemini if possible
                            data: base64Data
                          }
                        });
                      }
                    } catch (e) {
                      console.error("Error processing AI imagePreview in history for Gemini:", e);
                    }
                  });
                }
                
                if (messageParts.length > 0) {
                  geminiHistory.push({ role: msg.sender === 'user' ? 'user' : 'model', parts: messageParts });
                } else {
                   console.warn(`Skipping historical message (ID: ${msg.id}, Sender: ${msg.sender}) for Gemini history as it has no parts.`);
                }
            });

            const currentUserParts: Part[] = [];
            if (constructedMessageText.trim()) {
                currentUserParts.push({ text: constructedMessageText.trim() });
            }
            if (currentUploadedImage && currentImagePreview && !isImagenModelSelected && !isTextToSpeechModelSelected) {
                try {
                    const base64Image = currentImagePreview.split(',')[1];
                    if (base64Image) {
                         currentUserParts.push({
                            inlineData: {
                                mimeType: currentUploadedImage.type, // Use file's original MIME type
                                data: base64Image
                            }
                        });
                    }
                } catch(e) {
                    console.error("Error processing current user uploaded image for Gemini:", e);
                }
            }
            
            if (currentUserParts.length > 0) {
                geminiHistory.push({ role: 'user', parts: currentUserParts });
            } else if (geminiHistory.length === 0 && !isRegenerationOfAiMsgId) {
                // This case means the user sent a truly empty message (should be caught by handleSendMessage)
                // or it's a regeneration of an AI message that was the first in chat.
                // If geminiHistory is empty and current user parts are empty, it means no content at all.
                console.error("Attempting to send an empty message to Gemini. Aborting.");
                throw new Error("Cannot send an empty message to the AI.");
            }


            const stream = sendGeminiMessageStream({
              historyContents: geminiHistory, 
              modelSettings: currentModelSpecificSettings as ModelSettings, 
              enableGoogleSearch: isWebSearchEnabled,
              modelName: actualModelIdentifier, 
              // apiKey and chatState removed
            });

            let currentText = ''; let currentGroundingSources: GroundingSource[] | undefined = undefined;

            for await (const chunk of stream) {
              if (chunk.error) throw new Error(chunk.error); 
              if (chunk.textDelta) currentText += chunk.textDelta;
              if (chunk.groundingSources && chunk.groundingSources.length > 0) currentGroundingSources = chunk.groundingSources;
              
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMessageId ? { ...msg, text: currentText, groundingSources: currentGroundingSources || msg.groundingSources, isRegenerating: false } : msg
                )
              );
            }
        }
      } else if ((selectedModel === Model.GPT4O || selectedModel === Model.GPT4O_MINI) && !currentModelStatus.isMock) { // Adjusted for GPT4O_MINI
        // API key handled by proxy
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

        const stream = sendOpenAIMessageStream({ 
            /* apiKey removed */ 
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
        // API key handled by proxy
        const history: ApiChatMessage[] = [{ role: 'system', content: currentModelSpecificSettings.systemInstruction }];
         messages.filter(m => m.id !== aiMessageId && m.id !== newUserMessage.id).forEach(msg => {
            if (msg.sender === 'user') history.push({ role: 'user', content: msg.text }); 
            else if (msg.sender === 'ai') history.push({ role: 'assistant', content: msg.text });
        });
        history.push({ role: 'user', content: constructedMessageText.trim() || " " });

        const stream = sendDeepseekMessageStream({ 
            /* apiKey removed */ 
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
      
      } else if (currentModelStatus?.isMock) { 
        // For mock, prepare Gemini-like parts for simplicity, though mock service might not use all of it
        const mockParts: Part[] = [];
        if (constructedMessageText.trim()) mockParts.push({ text: constructedMessageText.trim() });
        if (currentUploadedImage && currentImagePreview) {
            mockParts.push({ inlineData: { mimeType: currentUploadedImage.type as 'image/jpeg' | 'image/png', data: currentImagePreview.split(',')[1] } });
        }
        const stream = sendMockMessageStream(mockParts, selectedModel, currentModelSpecificSettings as ModelSettings); 
        let currentText = '';
        for await (const chunk of stream) {
          currentText += chunk;
          setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? { ...msg, text: currentText, isRegenerating: false } : msg));
        }
      } else { throw new Error(`API integration for ${selectedModel} is not implemented or API key/Vertex config is missing and it's not a mock model.`); }
    } catch (e: any) {
      console.error("Error sending message:", e);
      const errorMessage = e.message || 'Failed to get response from AI (via proxy).';
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
      // For regeneration, image/file data needs to be from the original user message.
      // The current `uploadedImage`, `imagePreview` might be stale if user changed them after sending original.
      // This requires ChatMessage to potentially store original file/image data if full fidelity regen is needed,
      // or we assume regeneration uses the text and any *currently* selected image/file (simpler but might differ).
      // For now, let's use what's available on userMessageForRegen if possible, else current state.

      let regenImagePreview: string | null = userMessageForRegen.imagePreview || null;
      let regenUploadedImageFile: File | null = null; // We don't store original File object, so this is tricky.
                                                    // Proxy might need to handle image by URL if we passed it.
                                                    // For simplicity, we might only be able to regen with text + current image if any.
      // This part needs more thought for robust image/file regeneration via proxy.
      // For now, if userMessageForRegen.imagePreview exists, we'll use that.
      // The File object itself is lost, so the proxy would need image data.
      // Let's assume if imagePreview exists on userMessageForRegen, the internalSendMessage needs to handle it.
      // This implies internalSendMessage might need to fetch that imagePreview if it's a URL, or have base64 data.
      
      // Current implementation sends base64 of currentUploadedImage. If regenerating a message with an old image,
      // this is not ideal. A true regeneration would re-use the *exact* inputs.
      // Let's proceed with current image/file, as that's what the previous structure implicitly did.
      const currentRegenImageFile = uploadedImage; // The one currently in state
      const currentRegenImagePreview = imagePreview; // The one currently in state
      const currentRegenUploadedTextContent = uploadedTextFileContent; // Current one
      const currentRegenUploadedTextFileName = uploadedTextFileName; // Current one


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
          regenInputText, // Text from original user message
          currentRegenImageFile, // Current File object
          currentRegenImagePreview, // Current preview string
          currentRegenUploadedTextContent,
          currentRegenUploadedTextFileName,
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
                onModelChange={(model) => { setSelectedModel(model); /* geminiChatState removed */ clearSearch();}} 
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
            <div key={msg.id} ref={(el: HTMLDivElement | null) => { if(el) messageRefs.current[msg.id] = el; }}>
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
