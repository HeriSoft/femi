

import { Chat } from '@google/genai'; // Updated import
import React from 'react'; // Added for React.DetailedHTMLProps

export enum Model {
  GEMINI = 'Gemini (gemini-2.5-flash-preview-05-20)', // Updated model identifier
  DEEPSEEK = 'Deepseek (deepseek-chat)', 
  GPT4O = 'ChatGPT (gpt-4.1)', // Changed display name and underlying model
  GPT4O_MINI = 'ChatGPT (gpt-4.1-mini)', // Updated to gpt-4.1-mini
  CLAUDE = 'Claude (Mock)',
  GEMINI_ADVANCED = 'Gemini Advanced (gemini-1.5-pro-latest)',
  IMAGEN3 = 'Imagen3 (imagen-3.0-generate-002)',
  OPENAI_TTS = 'OpenAI (TTS)', // New TTS Model
  REAL_TIME_TRANSLATION = 'Real-Time Translation (Gemini)', // New Real-Time Translation Model
  AI_AGENT = 'AI Agent (gemini-2.5-flash-preview-04-17)', // Renamed from AI_TASK_ORCHESTRATOR and updated model ID
}

export interface ChatMessage {
  id: string;
  text: string; // For user prompts or AI text responses
  sender: 'user' | 'ai';
  timestamp: number; // Added to store the time of message creation
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
  // Fields for AI Agent (previously Task Orchestrator)
  isTaskGoal?: boolean; // Flags if this user message defines a main task goal for the AI Agent
  isTaskPlan?: boolean; // Flags if this AI message contains a task plan/response from the AI Agent
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

export interface RealTimeTranslationSettings {
  targetLanguage: string; // language code e.g. 'vi', 'en'
}

// Settings for AI Agent (previously Task Orchestrator)
export interface AiAgentSettings extends ModelSettings {}


export type AllModelSettings = {
  [key in Model]?: ModelSettings & Partial<ImagenSettings> & Partial<OpenAITtsSettings> & Partial<RealTimeTranslationSettings> & Partial<AiAgentSettings>;
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
  isRealTimeTranslation?: boolean; // Flag for real-time translation model
  isAiAgent?: boolean; // Flag for AI Agent model (renamed from isTaskOrchestrator)
}

export interface Persona {
  id: string;
  name: string;
  instruction: string;
}

export interface SettingsPanelProps {
  selectedModel: Model;
  onModelChange: (model: Model) => void;
  modelSettings: ModelSettings & Partial<ImagenSettings> & Partial<OpenAITtsSettings> & Partial<RealTimeTranslationSettings> & Partial<AiAgentSettings>; 
  onModelSettingsChange: (settings: Partial<ModelSettings & ImagenSettings & OpenAITtsSettings & RealTimeTranslationSettings & AiAgentSettings>) => void;
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
  modelSettingsSnapshot: ModelSettings & Partial<ImagenSettings> & Partial<OpenAITtsSettings> & Partial<RealTimeTranslationSettings> & Partial<AiAgentSettings>; 
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
export type LanguageOption = 'en' | 'ja' | 'ko' | 'zh' | 'vi'; // Kept for language learning feature itself
export type TranslationLanguageCode = 'en' | 'vi' | 'ko' | 'ja' | 'zh' | 'th' | 'ru' | 'it'; // For Real-Time Translation

export interface LanguageOptionConfig { // Used by Language Learning feature
  code: LanguageOption;
  name: string;
  flag?: string; // e.g., emoji flag or URL to small image
}

export interface TranslationLanguageOptionConfig { // For Real-Time Translation target languages
  code: TranslationLanguageCode;
  name: string;
  flag?: string;
}


export type LanguageLearningActivityType = 'listening' | 'speaking' | 'vocabulary' | 'quiz' | 'sentence-scramble' | 'handwriting';

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
  favoriteLanguage?: LanguageOption; // User's preferred language for translations
  aboutMe?: string; // New field for user's self-description
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
  
  // For Sentence Scramble
  originalSentence?: string;
  scrambledWords?: { word: string, id: number }[]; // id is the original index of the word

  // For Handwriting
  targetText?: string; // Character/word to write

  aiPromptForGeneration?: string; 
  aiPromptForEvaluation?: string; 
}

// State for an active learning session/exercise
export interface LearningActivityState {
    isLoadingContent: boolean;
    content: LearningContent | null;
    error: string | null;
    userAnswer: string | number | null | string[]; // Can be string for sentence scramble sentence
    userSelectedWordIds?: number[]; // For sentence scramble, to track which scrambled words were used
    isAnswerSubmitted: boolean;
    isAnswerCorrect: boolean | null;
    audioUrl?: string; // For listening exercise audio
    isAudioPlaying?: boolean; // For listening exercise audio playback status
    translatedUserSpeech?: string; // For speaking practice translation
    isLoadingTranslation?: boolean; // For speaking practice translation loading state

    // For Handwriting
    userHandwritingImage?: string; // base64 data URL of user's input (canvas or uploaded)
    accuracyScore?: number;        // 0-100
    aiFeedback?: string;           // Qualitative feedback from AI
    handwritingInputMethod?: 'draw' | 'upload'; // Current input method
}


export interface LanguageLearningModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserGlobalProfile | null;
  onUpdateProfile: (updatedProfile: UserGlobalProfile) => void;
  onAddExp: (language: LanguageOption, expPoints: number) => void;
}

// Mini Games Arcade Types
export type WebGameType = 'tic-tac-toe' | 'sliding-puzzle' | 'snake' | 'flappy-bird' | 'tien-len' | '8-ball-pool' | null;


export interface GamesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayWebGame: (gameType: WebGameType, gameTitle: string) => void; 
}


export interface WebGamePlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameType: WebGameType;
  gameTitle: string;
}

// Login Device Log
export interface LoginDeviceLog {
  id: string; 
  device: string; 
  timestamp: number; 
}

// Account Settings
export type AccountTabType = 'devices' | 'background' | 'avatar' | 'payment' | 'profile'; // Added 'profile'

export interface BackgroundOption {
  id: string;
  name: string;
  imageUrl: string;
  thumbnailUrl: string;
}

export interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChatBackgroundChange: (newUrl: string | null) => void; 
  currentChatBackground: string | null; 
  userProfile: UserGlobalProfile | null; // Added userProfile
  onUpdateUserProfile: (updatedProfile: UserGlobalProfile) => void; // Added onUpdateUserProfile
}

// Tien Len Game Types
export enum CardSuit {
  SPADES = '♠',   // Bích
  CLUBS = '♣',    // Chuồn (Tép)
  DIAMONDS = '♦', // Rô
  HEARTS = '♥',   // Cơ
}

export enum CardRank { // Values for sorting, 3 is lowest, 2 is highest
  THREE = '3', FOUR = '4', FIVE = '5', SIX = '6', SEVEN = '7',
  EIGHT = '8', NINE = '9', TEN = '10', JACK = 'J', QUEEN = 'Q',
  KING = 'K', ACE = 'A', TWO = '2',
}

export interface TienLenCard {
  id: string; // e.g., "H3" for Heart 3, "S2" for Spade 2
  rank: CardRank;
  suit: CardSuit;
  value: number; // Numerical value for comparison (3=0, ..., 2=12)
  isSelected?: boolean;
}

export type PlayerHand = TienLenCard[];

export enum TienLenHandType {
  INVALID = 'INVALID',
  SINGLE = 'SINGLE',
  PAIR = 'PAIR',
  TRIPLE = 'TRIPLE',
  STRAIGHT = 'STRAIGHT', // Sequence of 3+ cards
  THREE_PAIR_STRAIGHT = 'THREE_PAIR_STRAIGHT', // Ba đôi thông
  FOUR_OF_A_KIND = 'FOUR_OF_A_KIND', // Tứ quý
  // Add more complex types like FOUR_PAIR_STRAIGHT (Bốn đôi thông), STRAIGHT_FLUSH (Sảnh rồng) later if needed
}

export interface ValidatedHand {
  type: TienLenHandType;
  cards: TienLenCard[];
  rankValue: number; // For singles, pairs, triples, quads: the rank of the cards. For straights: the rank of the highest card.
  suitValue?: number; // For singles, the suit value for tie-breaking.
  length?: number; // For straights, the number of cards in the straight.
}


export interface TienLenGameState {
  playerHand: PlayerHand;
  aiHand: PlayerHand;
  table: TienLenCard[]; // Cards currently displayed on the table (from the last played valid hand)
  lastPlayedHand: ValidatedHand | null; // The last successfully played hand's structured info
  currentPlayer: 'player' | 'ai';
  turnHistory: Array<{ player: 'player' | 'ai'; playedCards: ValidatedHand | null; passed: boolean }>;
  winner: 'player' | 'ai' | null;
  isDealing: boolean;
  statusMessage: string;
  playerScore: number;
  aiScore: number;
  turnTimer: number;
  isPaused: boolean;
  firstPlayerOfTheGame: 'player' | 'ai' | null; // Who holds 3 of Spades
  isFirstTurnOfGame: boolean; // Is it the very first turn of the entire game?
}


export interface TienLenGameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Props for HandwritingCanvas component
export interface HandwritingCanvasProps {
  width: number;
  height: number;
  penColor?: string;
  penThickness?: number;
  canvasRef: React.RefObject<HTMLCanvasElement>; // Pass ref from parent to allow parent to access canvas data
  disabled?: boolean;
}

// Removed global declaration for 'elevenlabs-convai' from here
// It will be moved to global.d.ts
