

// Fix: Remove triple-slash directive for 'vite/client' as its types are not found and import.meta.env is manually typed.
import React, { useState, useRef, useEffect, useCallback } from 'react';
// Update to .ts/.tsx extensions
import { Model, ChatMessage, ModelSettings, AllModelSettings, Part, GroundingSource, GeminiChatState, ApiKeyStatus, getActualModelIdentifier, ApiChatMessage, ApiStreamChunk, ImagenSettings, ChatSession } from '../types.ts';
import { ALL_MODEL_DEFAULT_SETTINGS, LOCAL_STORAGE_SETTINGS_KEY, LOCAL_STORAGE_HISTORY_KEY } from '../constants.ts';
import MessageBubble from './MessageBubble.tsx';
import SettingsPanel from './SettingsPanel.tsx';
import HistoryPanel from './HistoryPanel.tsx'; // Import HistoryPanel
import ImageModal from './ImageModal.tsx'; // Import ImageModal
import { sendGeminiMessageStream, generateImageWithImagen } from '../services/geminiService.ts';
import { sendOpenAIMessageStream } from '../services/openaiService.ts';
import { sendDeepseekMessageStream } from '../services/deepseekService.ts';
import { sendMockMessageStream } from '../services/mockApiService.ts';
import { PaperAirplaneIcon, CogIcon, XMarkIcon, PhotoIcon as PromptIcon, Bars3Icon, ChatBubbleLeftRightIcon, ClockIcon as HistoryIcon } from './Icons.tsx'; // Changed PhotoIcon to PromptIcon for Imagen

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

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<Model>(Model.GEMINI);
  
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
    } catch (error) {
      console.error("Error loading settings from localStorage:", error);
    }
    const initialSettings: AllModelSettings = {};
    Object.values(Model).forEach(modelKey => {
        initialSettings[modelKey] = { ...(ALL_MODEL_DEFAULT_SETTINGS[modelKey] || ALL_MODEL_DEFAULT_SETTINGS[Model.GEMINI]!) };
    });
    return initialSettings;
  });
  
  const modelSettings = allSettings[selectedModel] || ALL_MODEL_DEFAULT_SETTINGS[Model.GEMINI]!;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null); // For user uploaded image
  const [uploadedTextFileContent, setUploadedTextFileContent] = useState<string | null>(null);
  const [uploadedTextFileName, setUploadedTextFileName] = useState<string | null>(null);
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // For mobile sidebar
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('settings');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const [geminiChatState, setGeminiChatState] = useState<GeminiChatState | null>(null);

  const isImagenModelSelected = selectedModel === Model.IMAGEN3;

  // Chat History State
  const [savedSessions, setSavedSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentChatName, setCurrentChatName] = useState<string>("New Chat");

  // Image Modal State
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null); // Single image for modal
  const [modalPrompt, setModalPrompt] = useState<string>('');
  const [modalMimeType, setModalMimeType] = useState<'image/jpeg' | 'image/png'>('image/jpeg');


  const apiKeyStatuses = React.useMemo((): Record<Model, ApiKeyStatus> => {
    const env = (window as any).process?.env || {};
    const geminiApiKeySet = !!env.API_KEY;

    return {
      [Model.GEMINI]: {
        isSet: geminiApiKeySet, 
        envVarName: 'API_KEY', // Google AI Studio API Key
        modelName: 'Gemini Flash (AI Studio)',
        isMock: false,
        isGeminiPlatform: true,
      },
      [Model.GEMINI_ADVANCED]: {
        isSet: geminiApiKeySet, 
        envVarName: 'API_KEY', // Google AI Studio API Key
        modelName: 'Gemini Advanced (AI Studio)',
        isMock: false,
        isGeminiPlatform: true,
      },
      [Model.GPT4O]: {
        isSet: !!env.VITE_OPENAI_API_KEY, 
        envVarName: 'VITE_OPENAI_API_KEY',
        modelName: 'ChatGPT',
        isMock: false, 
        isGeminiPlatform: false,
      },
      [Model.DEEPSEEK]: { 
        isSet: !!env.VITE_DEEPSEEK_API_KEY, 
        envVarName: 'VITE_DEEPSEEK_API_KEY',
        modelName: 'Deepseek',
        isMock: false, 
        isGeminiPlatform: false,
      },
      [Model.CLAUDE]: { 
        isSet: !!env.VITE_CLAUDE_API_KEY, 
        envVarName: 'VITE_CLAUDE_API_KEY',
        modelName: 'Claude',
        isMock: true, 
        isGeminiPlatform: false,
      },
      [Model.IMAGEN3]: {
        isSet: geminiApiKeySet,
        envVarName: 'API_KEY', // Google AI Studio API Key for Imagen
        modelName: 'Imagen3 Image Gen (AI Studio)',
        isMock: false,
        isGeminiPlatform: true,
        isImageGeneration: true,
      }
    };
  }, []);


  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(allSettings));
    } catch (error) {
      console.error("Error saving settings to localStorage:", error);
    }
  }, [allSettings]);

  // Load/Save Chat History
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem(LOCAL_STORAGE_HISTORY_KEY);
      if (storedHistory) {
        setSavedSessions(JSON.parse(storedHistory));
      }
    } catch (error) {
      console.error("Error loading chat history from localStorage:", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(savedSessions));
    } catch (error) {
      console.error("Error saving chat history to localStorage:", error);
    }
  }, [savedSessions]);


  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  useEffect(() => {
    const currentModelStatus = apiKeyStatuses[selectedModel];
    const isCurrentModelOnGeminiPlatform = currentModelStatus?.isGeminiPlatform;

    if (!isCurrentModelOnGeminiPlatform || currentModelStatus?.isMock || currentModelStatus?.isImageGeneration) {
      setGeminiChatState(null); 
    }
    if ((!isCurrentModelOnGeminiPlatform || currentModelStatus?.isImageGeneration) && isWebSearchEnabled) {
        setIsWebSearchEnabled(false);
    }
    
    if (isImagenModelSelected) { 
        setUploadedImage(null);
        setImagePreview(null); 
        setUploadedTextFileContent(null);
        setUploadedTextFileName(null);
    }

  }, [selectedModel, apiKeyStatuses, isWebSearchEnabled, isImagenModelSelected]);


  const handleModelSettingsChange = useCallback((newSettings: Partial<ModelSettings & ImagenSettings>) => {
    setAllSettings(prev => {
      const currentSpecificSettings = prev[selectedModel] || ALL_MODEL_DEFAULT_SETTINGS[selectedModel]!;
      let processedNewSettings = { ...newSettings };

      if ('numberOfImages' in processedNewSettings && typeof processedNewSettings.numberOfImages === 'number') {
        processedNewSettings.numberOfImages = Math.max(1, Math.min(4, processedNewSettings.numberOfImages));
      }

      const updatedModelSettings = { ...currentSpecificSettings, ...processedNewSettings };
      return {
        ...prev,
        [selectedModel]: updatedModelSettings
      };
    });
  }, [selectedModel]);

  // Chat History Handlers
  const handleSaveCurrentChat = useCallback(() => {
    if (messages.length === 0) {
      setError("Cannot save an empty chat.");
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
      } : s));
      setCurrentChatName(savedSessions.find(s => s.id === activeSessionId)?.name || sessionName);
    } else {
      const newSessionId = `session-${sessionTimestamp}`;
      const newSession: ChatSession = {
        id: newSessionId,
        name: sessionName,
        timestamp: sessionTimestamp,
        model: selectedModel,
        messages: [...messages],
        modelSettingsSnapshot: {...modelSettings},
      };
      setSavedSessions(prev => [...prev, newSession]);
      setActiveSessionId(newSessionId);
      setCurrentChatName(sessionName);
    }
  }, [messages, selectedModel, modelSettings, activeSessionId, savedSessions]);

  const handleLoadSession = useCallback((sessionId: string) => {
    const sessionToLoad = savedSessions.find(s => s.id === sessionId);
    if (sessionToLoad) {
      setMessages([...sessionToLoad.messages]);
      setSelectedModel(sessionToLoad.model);
      
      setAllSettings(prevAllSettings => {
        const updatedSettingsForModel = { 
          ...(prevAllSettings[sessionToLoad.model] || ALL_MODEL_DEFAULT_SETTINGS[sessionToLoad.model]!), 
          ...sessionToLoad.modelSettingsSnapshot 
        };
        return {
          ...prevAllSettings,
          [sessionToLoad.model]: updatedSettingsForModel
        };
      });

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
    }
  }, [savedSessions]);

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
    setError(null);
    setIsSidebarOpen(false); 
  }, []);

  const handleDeleteSession = useCallback((sessionId: string) => {
    setSavedSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      handleStartNewChat();
    }
  }, [activeSessionId, handleStartNewChat]); 
  
  const handleRenameSession = useCallback((sessionId: string, newName: string) => {
    setSavedSessions(prev => prev.map(s => s.id === sessionId ? { ...s, name: newName } : s));
    if (activeSessionId === sessionId) {
        setCurrentChatName(newName);
    }
  }, [activeSessionId]);

  const handleOpenImageModal = useCallback((imageB64: string, prompt: string, mimeType: 'image/jpeg' | 'image/png') => {
    setModalImage(imageB64);
    setModalPrompt(prompt);
    setModalMimeType(mimeType);
    setIsImageModalOpen(true);
  }, []);


  const handleSendMessage = async () => {
    if (!input.trim() && !uploadedImage && !uploadedTextFileName && !isImagenModelSelected) return;
    if (isImagenModelSelected && !input.trim()) {
        setError("Please enter a prompt for image generation.");
        return;
    }

    setIsLoading(true);
    setError(null);

    const userMessageId = Date.now().toString();
    let constructedMessageText = input.trim(); 
    const currentInputTrimmed = input.trim(); // Capture for originalPrompt
    
    if (uploadedTextFileName && !isImagenModelSelected) {
      let fileInfo = `The user has uploaded a file named "${uploadedTextFileName}".`;
      if (uploadedTextFileContent) {
        fileInfo += `\nThe content of this file is:\n${uploadedTextFileContent}`;
      }
      constructedMessageText = `${fileInfo}\n\n---\n\n${currentInputTrimmed}`;
    }

    const newUserMessage: ChatMessage = {
      id: userMessageId,
      text: currentInputTrimmed, 
      sender: 'user',
      imagePreview: !isImagenModelSelected ? imagePreview || undefined : undefined, 
      fileName: !isImagenModelSelected ? uploadedTextFileName || undefined : undefined,
      isImageQuery: isImagenModelSelected,
    };
    setMessages((prev) => [...prev, newUserMessage]);

    const aiMessageId = (Date.now() + 1).toString();
    const aiMessagePlaceholder: ChatMessage = {
        id: aiMessageId,
        text: isImagenModelSelected ? 'Generating image(s)...' : '',
        sender: 'ai',
        model: selectedModel,
    };
    setMessages((prev) => [...prev, aiMessagePlaceholder]);

    const geminiParts: Part[] = [];
    if (constructedMessageText.trim() && !isImagenModelSelected) {
      geminiParts.push({ text: constructedMessageText.trim() });
    }
    if (uploadedImage && imagePreview && !isImagenModelSelected) { 
      const base64Image = imagePreview.split(',')[1];
      geminiParts.push({ inlineData: { mimeType: uploadedImage.type, data: base64Image } });
    }

    try {
      const currentModelSpecificSettings = allSettings[selectedModel]!;
      const currentModelStatus = apiKeyStatuses[selectedModel];
      const actualModelIdentifier = getActualModelIdentifier(selectedModel);
      const env = (window as any).process?.env || {};

      if (currentModelStatus?.isGeminiPlatform && !currentModelStatus.isMock) { 
        const geminiApiKey = env.API_KEY as string | undefined;
        if (!geminiApiKey) {
          throw new Error(`Gemini API Key (API_KEY) is not configured in config.js for ${currentModelStatus.modelName}.`);
        }

        if (isImagenModelSelected) { 
            const imagenSettings = currentModelSpecificSettings as ImagenSettings;
            const result = await generateImageWithImagen({
              prompt: currentInputTrimmed,
              modelSettings: imagenSettings,
              modelName: actualModelIdentifier,
              apiKey: geminiApiKey,
            });

            if (result.error) throw new Error(result.error);
            if (result.imageBases64 && result.imageBases64.length > 0) {
              const mimeType = imagenSettings.outputMimeType || 'image/jpeg';
              const imageUrls = result.imageBases64.map(base64 => `data:${mimeType};base64,${base64}`);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMessageId ? { 
                    ...msg, 
                    text: `Generated ${imageUrls.length} image(s) for: "${currentInputTrimmed}"`, 
                    imagePreviews: imageUrls,
                    imageMimeType: mimeType,
                    originalPrompt: currentInputTrimmed,
                  } : msg
                )
              );
              // Modal is no longer opened automatically
            } else {
              throw new Error("Image generation failed to return any images.");
            }
        } else { 
            let chatStateToUse = geminiChatState;
            if (chatStateToUse &&
                (chatStateToUse.currentModel !== actualModelIdentifier ||
                chatStateToUse.currentSystemInstruction !== currentModelSpecificSettings.systemInstruction ||
                chatStateToUse.currentTemperature !== currentModelSpecificSettings.temperature ||
                chatStateToUse.currentTopK !== currentModelSpecificSettings.topK ||
                chatStateToUse.currentTopP !== currentModelSpecificSettings.topP)
                ) {
                chatStateToUse = null; 
                setGeminiChatState(null);
            }

            const stream = sendGeminiMessageStream({
              parts: geminiParts,
              modelSettings: currentModelSpecificSettings as ModelSettings,
              enableGoogleSearch: isWebSearchEnabled,
              chatState: chatStateToUse,
              modelName: actualModelIdentifier, 
              apiKey: geminiApiKey,
            });

            let currentText = '';
            let currentGroundingSources: GroundingSource[] | undefined = undefined;
            let newChatSessionState : GeminiChatState | undefined = undefined;

            for await (const chunk of stream) {
              if (chunk.error) throw new Error(chunk.error); 
              if (chunk.newChatState && !newChatSessionState) {
                 newChatSessionState = chunk.newChatState;
                 setGeminiChatState(newChatSessionState); 
              }
              if (chunk.textDelta) currentText += chunk.textDelta;
              if (chunk.groundingSources && chunk.groundingSources.length > 0) currentGroundingSources = chunk.groundingSources;
              
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === aiMessageId ? { ...msg, text: currentText, groundingSources: currentGroundingSources || msg.groundingSources } : msg
                )
              );
            }
        }
      } else if (selectedModel === Model.GPT4O && !currentModelStatus.isMock) {
        const apiKey = env[currentModelStatus.envVarName] as string | undefined;
        if (!apiKey) throw new Error(`${currentModelStatus.modelName} API Key (${currentModelStatus.envVarName}) is not configured.`);
        
        const history: ApiChatMessage[] = [{ role: 'system', content: currentModelSpecificSettings.systemInstruction }];
        messages.filter(m => m.id !== aiMessageId && m.id !== userMessageId).forEach(msg => { 
            if (msg.sender === 'user') {
                const userContent: any[] = [];
                if (msg.text) userContent.push({ type: 'text', text: msg.text });
                if (msg.imagePreview && !msg.isImageQuery) { 
                     userContent.push({ type: 'image_url', image_url: { url: msg.imagePreview } });
                }
                if (userContent.length > 0) {
                    history.push({ role: 'user', content: userContent });
                } else if (msg.text === "") { 
                     history.push({ role: 'user', content: " " });
                }
            } else if (msg.sender === 'ai') {
                history.push({ role: 'assistant', content: msg.text });
            }
        });
        
        const currentUserContent: Array<{type: 'text', text: string} | {type: 'image_url', image_url: {url: string, detail?: "auto" | "low" | "high" }}> = [];
        if (constructedMessageText.trim()) {
            currentUserContent.push({ type: 'text', text: constructedMessageText.trim() });
        }
        if (uploadedImage && imagePreview) { 
            currentUserContent.push({
                type: 'image_url',
                image_url: { url: imagePreview, detail: "auto" } 
            });
        }

        if(currentUserContent.length > 0) {
             history.push({ role: 'user', content: currentUserContent });
        } else if (currentInputTrimmed === "" && !uploadedImage) { 
             history.push({ role: 'user', content: " " }); 
        }

        const stream = sendOpenAIMessageStream({ apiKey, modelIdentifier: actualModelIdentifier, history, modelSettings: currentModelSpecificSettings as ModelSettings });
        let currentText = '';
        for await (const chunk of stream) {
          if (chunk.error) throw new Error(chunk.error);
          if (chunk.textDelta) currentText += chunk.textDelta;
          setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? { ...msg, text: currentText } : msg));
          if (chunk.isFinished) break;
        }

      } else if (selectedModel === Model.DEEPSEEK && !currentModelStatus.isMock) {
        const apiKey = env[currentModelStatus.envVarName] as string | undefined;
        if (!apiKey) throw new Error(`${currentModelStatus.modelName} API Key (${currentModelStatus.envVarName}) is not configured.`);

        const history: ApiChatMessage[] = [{ role: 'system', content: currentModelSpecificSettings.systemInstruction }];
         messages.filter(m => m.id !== aiMessageId && m.id !== userMessageId).forEach(msg => {
            if (msg.sender === 'user') {
                history.push({ role: 'user', content: msg.text }); 
            } else if (msg.sender === 'ai') {
                history.push({ role: 'assistant', content: msg.text });
            }
        });
        history.push({ role: 'user', content: constructedMessageText.trim() || " " });

        const stream = sendDeepseekMessageStream({ apiKey, modelIdentifier: actualModelIdentifier, history, modelSettings: currentModelSpecificSettings as ModelSettings });
        let currentText = '';
        for await (const chunk of stream) {
          if (chunk.error) throw new Error(chunk.error);
          if (chunk.textDelta) currentText += chunk.textDelta;
          setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? { ...msg, text: currentText } : msg));
          if (chunk.isFinished) break;
        }
      
      } else if (currentModelStatus?.isMock) { 
        const stream = sendMockMessageStream(geminiParts, selectedModel, currentModelSpecificSettings as ModelSettings); 
        let currentText = '';
        for await (const chunk of stream) {
          currentText += chunk;
          setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? { ...msg, text: currentText } : msg));
        }
      } else { 
        throw new Error(`API integration for ${selectedModel} is not implemented or API key/Vertex config is missing and it's not a mock model.`);
      }
    } catch (e: any) {
      console.error("Error sending message:", e);
      const errorMessage = e.message || 'Failed to get response from AI.';
      setError(errorMessage);
      setMessages((prev) => prev.filter(msg => msg.id !== aiMessageId)); 
      setMessages((prev) => [...prev, {id: aiMessageId, text: `Error: ${errorMessage}`, sender: 'ai', model: selectedModel}]);
    }

    setIsLoading(false);
    setInput(''); 
    if (!isImagenModelSelected) { 
        setUploadedImage(null);
        setImagePreview(null); 
        setUploadedTextFileContent(null);
        setUploadedTextFileName(null);
    }
  };

  const handleImageUpload = (file: File | null) => {
    if (isImagenModelSelected) return; 
    setUploadedImage(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string); 
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null); 
    }
  };

  const handleFileUpload = (file: File | null) => {
    if (isImagenModelSelected) return; 

    if (file) {
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      setUploadedTextFileName(file.name);
      setError(null);

      if (TEXT_READABLE_EXTENSIONS.includes(fileExtension)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setUploadedTextFileContent(e.target?.result as string);
        };
        reader.onerror = () => {
            setError(`Error reading the file: ${file.name}`);
            setUploadedTextFileContent(null);
            setUploadedTextFileName(null); 
        }
        reader.readAsText(file);
      } else {
        setUploadedTextFileContent(null); 
      }
    } else {
      setUploadedTextFileContent(null);
      setUploadedTextFileName(null);
    }
  };
  
  const sidebarContent = (
    <>
        <div className="flex border-b border-secondary dark:border-neutral-darkest mb-4">
            <button
                onClick={() => setActiveSidebarTab('settings')}
                disabled={isLoading}
                className={`flex-1 py-2 px-4 text-sm font-medium text-center rounded-t-lg focus:outline-none flex items-center justify-center
                            ${activeSidebarTab === 'settings' ? 'bg-primary text-white dark:bg-primary-light dark:text-neutral-darker' : 
                            'text-neutral-600 dark:text-neutral-300 hover:bg-secondary/50 dark:hover:bg-neutral-dark/50'}`}
                aria-pressed={activeSidebarTab === 'settings'}
            >
                <CogIcon className="w-5 h-5 mr-2"/> Settings
            </button>
            <button
                onClick={() => setActiveSidebarTab('history')}
                disabled={isLoading}
                className={`flex-1 py-2 px-4 text-sm font-medium text-center rounded-t-lg focus:outline-none flex items-center justify-center
                            ${activeSidebarTab === 'history' ? 'bg-primary text-white dark:bg-primary-light dark:text-neutral-darker' : 
                            'text-neutral-600 dark:text-neutral-300 hover:bg-secondary/50 dark:hover:bg-neutral-dark/50'}`}
                aria-pressed={activeSidebarTab === 'history'}
            >
                <HistoryIcon className="w-5 h-5 mr-2"/> History
            </button>
        </div>
        {activeSidebarTab === 'settings' && (
            <SettingsPanel
                selectedModel={selectedModel}
                onModelChange={(model) => { setSelectedModel(model); setGeminiChatState(null);}} 
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
            />
        )}
    </>
  );


  return (
    <div className="flex h-full">
      {/* Desktop Sidebar */}
      <div className={`hidden md:flex flex-col w-96 bg-neutral-light dark:bg-neutral-darker p-4 border-r border-secondary dark:border-neutral-darkest overflow-y-auto transition-all duration-300`}>
          {sidebarContent}
      </div>

      {/* Mobile Sidebar Overlay */}
       {isSidebarOpen && (
          <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-start">
            <div className="w-full max-w-xs sm:max-w-sm h-full bg-neutral-light dark:bg-neutral-darker shadow-xl p-4 overflow-y-auto">
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="absolute top-4 right-4 text-neutral-darker dark:text-secondary-light hover:text-red-500 dark:hover:text-red-400 z-50"
                aria-label="Close sidebar"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
              {sidebarContent}
            </div>
             <div className="flex-1" onClick={() => setIsSidebarOpen(false)}></div> {/* Click outside to close */}
          </div>
        )}

      <div className="flex-1 flex flex-col p-2 sm:p-4 overflow-hidden">
        <div className="flex items-center mb-2 sm:mb-4">
            <button
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden p-2 mr-2 rounded-md text-neutral-darker dark:text-secondary-light hover:bg-secondary dark:hover:bg-neutral-darkest"
                aria-label="Open sidebar"
            >
                <Bars3Icon className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light truncate">
                <ChatBubbleLeftRightIcon className="w-5 h-5 inline-block mr-2 align-text-bottom"/>
                {currentChatName || "New Chat"}
            </h2>
        </div>

        <div className="flex-grow overflow-y-auto mb-4 pr-2 space-y-4">
          {messages.map((msg) => (
            <MessageBubble 
                key={msg.id} 
                message={msg}
                onImageClick={msg.sender === 'ai' && msg.imagePreviews && msg.imagePreviews.length > 0 ? handleOpenImageModal : undefined}
            />
          ))}
          {isLoading && messages.length > 0 && messages[messages.length-1]?.sender === 'user' && ( 
             <MessageBubble key="loading" message={{id: 'loading', text: isImagenModelSelected ? 'Generating image(s)...' : 'Thinking...', sender: 'ai', model: selectedModel}} />
          )}
           {isLoading && messages.length === 0 && ( // Loading indicator for first message
             <MessageBubble key="loading-initial" message={{id: 'loading-initial', text: isImagenModelSelected ? 'Generating image(s)...' : 'Thinking...', sender: 'ai', model: selectedModel}} />
          )}
          <div ref={chatEndRef} />
        </div>

        {error && <div className="text-red-500 dark:text-red-400 p-2 my-2 bg-red-100 dark:bg-red-900 border border-red-500 dark:border-red-400 rounded-md text-sm">{error}</div>}

        {(!isImagenModelSelected && (imagePreview || uploadedTextFileName)) && (
            <div className="mb-2 p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-secondary-light dark:bg-neutral-darker">
                {imagePreview && ( // User uploaded image preview
                    <div className="relative group inline-block w-24 h-24 mr-2 align-top">
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded"/>
                        <button
                            onClick={() => { handleImageUpload(null); }}
                            className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Remove image"
                        >
                           <XMarkIcon className="w-4 h-4" />
                        </button>
                    </div>
                )}
                {uploadedTextFileName && (
                     <div className="inline-block align-top text-sm text-neutral-darker dark:text-secondary-light mt-1">
                        <span className="mr-2">File: {uploadedTextFileName}</span>
                        <button
                            onClick={() => { handleFileUpload(null); }}
                            className="text-red-500 hover:text-red-700 inline-flex items-center"
                            aria-label="Remove file"
                        >
                           <XMarkIcon className="w-4 h-4" />
                        </button>
                        {!uploadedTextFileContent && uploadedTextFileName && <p className="text-xs italic">(Content not displayed for this file type)</p>}
                    </div>
                )}
            </div>
        )}

        <div className="flex items-end border-t border-secondary dark:border-neutral-darkest pt-2 sm:pt-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={isImagenModelSelected ? "Enter prompt for image generation..." : "Type your message or upload an image/file..."}
            className="flex-grow p-3 border border-secondary dark:border-neutral-darkest rounded-lg focus:ring-2 focus:ring-primary dark:focus:ring-primary-light focus:border-transparent outline-none resize-none bg-neutral-light dark:bg-neutral-darker text-neutral-darker dark:text-secondary-light"
            rows={Math.min(5, input.split('\n').length + (input.endsWith('\n') ? 1: 0) )}
            disabled={isLoading}
            aria-label="Chat input"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || (!input.trim() && (!isImagenModelSelected && !uploadedImage && !uploadedTextFileName))}
            className="ml-2 p-3 bg-primary hover:bg-primary-dark dark:bg-primary-light dark:hover:bg-primary text-white rounded-lg disabled:opacity-50 transition-colors self-stretch flex items-center justify-center" // Ensure button stretches with textarea
            aria-label={isImagenModelSelected ? "Generate Image" : "Send message"}
          >
            {isImagenModelSelected ? <PromptIcon className="w-6 h-6" /> : <PaperAirplaneIcon className="w-6 h-6" />}
          </button>
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

export default ChatPage;