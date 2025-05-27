

import { Chat } from '@google/genai'; // Updated import

export enum Model {
  GEMINI = 'Gemini (gemini-2.5-flash-preview-05-20)', // Updated model identifier
  DEEPSEEK = 'Deepseek (deepseek-chat)', 
  GPT4O = 'ChatGPT (gpt-4o)', // Changed display name
  GPT4O_MINI = 'ChatGPT (gpt-4o-mini)', // New model for language learning
  CLAUDE = 'Claude (Mock)',
  GEMINI_ADVANCED = 'Gemini Advanced (gemini-1.5-pro-latest)',
  IMAGEN3 = 'Imagen3 (imagen-3.0-generate-002)',
  OPENAI_TTS = 'OpenAI (TTS)', // New TTS Model
}

export interface ChatMessage {
  id: string;
  text: string; // For user prompts or AI text responses
  sender: 'user' | 'ai';
  model?: Model;
  imagePreview?: string; // For user messages with a single image (upload)
  imagePreviews?: string[]; // For AI generated images (can be multiple)
  imageMimeType?: 'image/jpeg' | 'image/png'; // For AI generated images
  originalPrompt?: string; // For AI generated images, to store the original user prompt
  fileName?: string; // For user messages with files
  groundingSources?: GroundingSource[];
  isImageQuery?: boolean; // To flag user messages that are image generation prompts
  isRegenerating?: boolean; // Flag for AI messages that are being regenerated
  // Stores the ID of the user message that led to this AI response, crucial for regeneration
  promptedByMessageId?: string; 
  audioUrl?: string; // For AI messages with synthesized audio
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface ModelSettings {
  temperature: number;
  topK: number; 
  topP: number;
  systemInstruction: string;
}

export interface ImagenSettings {
  numberOfImages: number; // 1 to 4
  outputMimeType: 'image/jpeg' | 'image/png';
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | string; // Allow common presets or custom strings
}

export type OpenAiTtsVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export interface OpenAITtsSettings {
  voice: OpenAiTtsVoice;
  speed: number; // 0.25 to 4.0
  modelIdentifier: 'tts-1' | 'tts-1-hd'; // Model for TTS
}

export type AllModelSettings = {
  [key in Model]?: ModelSettings & Partial<ImagenSettings> & Partial<OpenAITtsSettings>; // Allow ImagenSettings and OpenAITtsSettings
};

export interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export interface Part {
  text?: string;
  inlineData?: {
    mimeType:string;
    data: string;
  };
}

export interface GeminiChatState {
  chat?: Chat; 
  currentModel: string; 
  currentSystemInstruction?: string;
  currentTemperature?: number;
  currentTopK?: number;
  currentTopP?: number;
  currentEnableWebSearch?: boolean; // Added to track web search state for chat re-initialization
}

export interface ApiKeyStatus {
  isSet: boolean;
  envVarName: string; 
  modelName: string; 
  isMock: boolean;
  isGeminiPlatform: boolean; // True if the model runs on Google's Gemini platform (AI Studio API Key)
  isImageGeneration?: boolean; // Flag for image generation models
  isTextToSpeech?: boolean; // Flag for TTS models
}

export interface Persona {
  id: string;
  name: string;
  instruction: string;
}

export interface SettingsPanelProps {
  selectedModel: Model;
  onModelChange: (model: Model) => void;
  modelSettings: ModelSettings & Partial<ImagenSettings> & Partial<OpenAITtsSettings>; // Include Imagen & TTS Settings
  onModelSettingsChange: (settings: Partial<ModelSettings & Partial<ImagenSettings> & Partial<OpenAITtsSettings>>) => void;
  onImageUpload: (file: File | null) => void;
  imagePreview: string | null; // For user uploaded image preview
  onFileUpload: (file: File | null) => void;
  uploadedTextFileName: string | null;
  isWebSearchEnabled: boolean;
  onWebSearchToggle: (enabled: boolean) => void;
  disabled?: boolean;
  apiKeyStatuses: Record<Model, ApiKeyStatus>;
  personas: Persona[];
  activePersonaId: string | null;
  onPersonaChange: (personaId: string | null) => void;
  onPersonaSave: (persona: Persona) => void;
  onPersonaDelete: (personaId: string) => void;
}

export const getActualModelIdentifier = (modelEnumString: string): string => {
  const match = modelEnumString.match(/\(([^)]+)\)$/);
  return match ? match[1] : modelEnumString; 
};

// For OpenAI / Deepseek message history
export interface ApiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail?: "auto" | "low" | "high" } }>;
}

// Stream chunk for OpenAI and Deepseek services
export interface ApiStreamChunk {
  textDelta?: string;
  error?: string;
  isFinished?: boolean;
}

// Common parameters for OpenAI and Deepseek stream functions
export interface GeneralApiSendMessageParams {
  apiKey: string;
  modelIdentifier: string;
  history: ApiChatMessage[]; 
  modelSettings: ModelSettings;
}

// Chat History Types
export interface ChatSession {
  id: string;
  name: string;
  timestamp: number;
  model: Model; // The primary model used for this session
  messages: ChatMessage[];
  modelSettingsSnapshot: ModelSettings & Partial<ImagenSettings> & Partial<OpenAITtsSettings>; // Snapshot of settings for this session
  isPinned?: boolean; // For pinning important chats
  activePersonaIdSnapshot?: string | null; // Snapshot of active persona
}

export interface HistoryPanelProps {
  savedSessions: ChatSession[];
  activeSessionId: string | null;
  onLoadSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newName: string) => void;
  onSaveCurrentChat: () => void;
  onStartNewChat: () => void;
  isLoading: boolean; // To disable actions while chat is processing
  onTogglePinSession: (sessionId: string) => void;
}

// Notification System Types
export type NotificationType = 'success' | 'error' | 'info';

export interface NotificationMessage {
  id: string;
  message: string;
  type: NotificationType;
  timestamp: number;
  read: boolean;
  details?: string; // For optional extended error details
}

export interface NotificationContextType {
  notifications: NotificationMessage[];
  unreadCount: number;
  addNotification: (message: string, type: NotificationType, details?: string) => void;
  markAllAsRead: () => void;
  clearAllNotifications: () => void;
}

// Language Learning Feature Types
export type LanguageOption = 'en' | 'ja' | 'ko' | 'zh' | 'vi';

export interface LanguageOptionConfig {
  code: LanguageOption;
  name: string;
  flag?: string; // e.g., emoji flag or URL to small image
}

export type LanguageLearningActivityType = 'listening' | 'speaking' | 'vocabulary' | 'quiz';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // Emoji or a key for an Icon component
  expThreshold: number; // EXP needed to earn this badge
}

export interface UserLanguageProfile {
  exp: number;
  earnedBadgeIds: string[];
  // Could add lastActivityDate, streak, etc. later
}

export interface UserGlobalProfile {
  languageProfiles: Partial<Record<LanguageOption, UserLanguageProfile>>; // Use Partial for initially unselected languages
  // other global settings/achievements if any
}

export interface VocabularyItem {
  word: string;
  meaning: string; // Meaning in English or user's native language
  exampleSentence: string; // Example sentence in the target language
}

export interface LearningContent {
  id: string;
  activityType: LanguageLearningActivityType;
  language: LanguageOption;
  title?: string;
  instruction?: string; 
  
  // For Listening
  script?: string; // Text to be converted to audio
  question?: string; // Question about the script or for Quiz
  options?: string[]; // MCQ options (Listening or Quiz)
  correctAnswerIndex?: number; // Index of the correct option (Listening or Quiz)

  // For Speaking
  phraseToSpeak?: string; // Phrase for user to speak

  // For Vocabulary
  vocabularySet?: VocabularyItem[]; // Array of vocabulary words
  
  aiPromptForGeneration?: string; 
  aiPromptForEvaluation?: string; 
}

// State for an active learning session/exercise
export interface LearningActivityState {
    isLoadingContent: boolean;
    content: LearningContent | null;
    error: string | null;
    userAnswer: string | number | null; // For MCQ index, or transcribed text for speaking
    isAnswerSubmitted: boolean;
    isAnswerCorrect: boolean | null;
    audioUrl?: string; // For listening exercise audio
    isAudioPlaying?: boolean; // For listening exercise audio playback status
}


export interface LanguageLearningModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserGlobalProfile | null;
  onUpdateProfile: (updatedProfile: UserGlobalProfile) => void;
  onAddExp: (language: LanguageOption, expPoints: number) => void;
}

// Mini Games Arcade Types
// DosGameConfig removed as DOS games are removed.

export type WebGameType = 'tic-tac-toe' | 'sliding-puzzle' | 'snake' | 'flappy-bird' | null;

export interface GamesModalProps {
  isOpen: boolean;
  onClose: () => void;
  // onPlayDosGame removed
  onPlayWebGame: (gameType: WebGameType, gameTitle: string) => void; 
}

// DosGamePlayerModalProps removed as DOS games are removed.

export interface WebGamePlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameType: WebGameType;
  gameTitle: string;
}