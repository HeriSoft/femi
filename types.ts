

import { Chat } from '@google/genai'; // Updated import
import React from 'react'; // Added for React.DetailedHTMLProps

export enum Model {
  GEMINI = 'Gemini (gemini-2.5-flash)', 
  DEEPSEEK = 'Deepseek (deepseek-chat)', 
  GPT4O = 'ChatGPT (gpt-4.1)', 
  GPT4O_MINI = 'ChatGPT (gpt-4.1-mini)', 
  CLAUDE = 'Claude (Mock)',
  GEMINI_ADVANCED = 'Gemini Advanced (gemini-2.5-flash)',
  IMAGEN3 = 'Imagen3 (imagen-3.0-generate-002)',
  OPENAI_TTS = 'OpenAI (TTS)', 
  REAL_TIME_TRANSLATION = 'Real-Time Translation (gemini-2.5-flash)', 
  AI_AGENT_SMART = 'AI Agent Smart (gemini-2.5-flash)',
  PRIVATE = 'Private (Local Data Storage)', 
  FLUX_KONTEX = 'Flux Kontext Image Edit (fal-ai/flux-pro/kontext)', 
  FLUX_KONTEX_MAX_MULTI = 'Flux Kontext Max Multi-Image (fal-ai/flux-pro/kontext/max/multi)',
  FLUX_ULTRA = 'Flux Dev (fal-ai/flux-1/dev)', 
  KLING_VIDEO = 'Kling AI Video Gen (fal-ai/kling-video/v2.1/standard/image-to-video)', 
  TRADING_PRO = 'Trading Pro (gemini-2.5-flash Analysis)', 
}

export interface ChatMessage {
  id: string;
  text: string; 
  sender: 'user' | 'ai';
  timestamp: number; 
  model?: Model;
  imagePreview?: string; 
  imagePreviews?: string[]; 
  imageMimeType?: 'image/jpeg' | 'image/png'; 
  imageMimeTypes?: string[]; 
  originalPrompt?: string; 
  fileName?: string; 
  fileContent?: string; 
  groundingSources?: GroundingSource[];
  isImageQuery?: boolean; 
  isRegenerating?: boolean; 
  promptedByMessageId?: string; 
  audioUrl?: string; 
  isTaskGoal?: boolean; 
  isTaskPlan?: boolean; 
  videoFile?: File; 
  videoFileName?: string; 
  videoMimeType?: string; 
  isNote?: boolean; 
  fluxRequestId?: string; 
  klingVideoRequestId?: string; 
  fluxModelId?: string; 
  isVideoQuery?: boolean; 
  videoUrl?: string; 
  originalText?: string; 
  translatedText?: string; 

  tradingAnalysis?: {
    pair: TradingPairValue;
    analysisText: string;
    trendPredictions: { up_percentage: number; down_percentage: number; sideways_percentage: number };
    chartImageUrl?: string; // This can now be the user-uploaded image for AI consideration or if AI references one
  };
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
  numberOfImages: number; 
  outputMimeType: 'image/jpeg' | 'image/png';
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | string; 
}

export type OpenAiTtsVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export interface OpenAITtsSettings {
  voice: OpenAiTtsVoice;
  speed: number; 
  modelIdentifier: 'tts-1' | 'tts-1-hd'; 
}

export interface RealTimeTranslationSettings {
  targetLanguage: string; 
}

// Settings for AI Agent Smart (renamed from AiAgentSettings)
export interface AiAgentSmartSettings extends ModelSettings {}

export interface PrivateModeSettings extends Pick<ModelSettings, 'systemInstruction'> { 
}

export type FluxKontexAspectRatio = 'default' | '1:1' | '16:9' | '9:16' | '4:3' | '3:2' | '2:3' | '3:4' | '9:21' | '21:9';


export interface FluxKontexSettings {
  guidance_scale: number; 
  safety_tolerance?: number; 
  num_inference_steps?: number; 
  seed?: number | null; 
  num_images?: number; 
  aspect_ratio?: FluxKontexAspectRatio; 
  output_format?: 'jpeg' | 'png'; 
}

export type FluxDevImageSize = 'square_hd' | 'square' | 'portrait_4_3' | 'portrait_16_9' | 'landscape_4_3' | 'landscape_16_9';

export interface FluxDevSettings { 
  image_size?: FluxDevImageSize; 
  num_inference_steps?: number;
  seed?: number | null;
  guidance_scale?: number;
  num_images?: number; 
  enable_safety_checker?: boolean;
  output_format?: 'jpeg' | 'png'; 
}

export type KlingAiDuration = "5" | "10";
export type KlingAiAspectRatio = "16:9" | "9:16" | "1:1";

export interface KlingAiSettings {
  duration: KlingAiDuration;
  aspect_ratio: KlingAiAspectRatio;
  negative_prompt?: string; 
  cfg_scale?: number; 
}

export type TradingPairValue = 'XAUUSD' | 'BTCUSD'; 
export interface TradingPair {
  value: TradingPairValue;
  label: string; 
}

// CandlestickPoint type for chart.js-chart-financial
export interface CandlestickPoint {
    x: number; // Timestamp
    o: number; // Open
    h: number; // High
    l: number; // Low
    c: number; // Close
}


export interface TradingProState {
  disclaimerAgreed: boolean;
  chartImageUrl: string | null; // Will hold user-uploaded image if provided, or null
  isLoadingAnalysis: boolean;
  analysisText: string | null;
  trendPredictions: { up_percentage: number; down_percentage: number; sideways_percentage: number } | null;
  analysisError: string | null;
  groundingSources?: GroundingSource[];
  selectedPair: TradingPairValue | null; 
  uploadedImageValidationError: string | null; // For "ảnh không hợp lệ"
}

export interface TradingProSettings {
  selectedPair: TradingPairValue | null;
}

export type ModelSpecificSettingsMap = {
  [Model.GEMINI]: ModelSettings;
  [Model.GEMINI_ADVANCED]: ModelSettings;
  [Model.GPT4O]: ModelSettings;
  [Model.GPT4O_MINI]: ModelSettings;
  [Model.DEEPSEEK]: ModelSettings;
  [Model.CLAUDE]: ModelSettings;
  [Model.IMAGEN3]: ImagenSettings;
  [Model.OPENAI_TTS]: OpenAITtsSettings;
  [Model.REAL_TIME_TRANSLATION]: RealTimeTranslationSettings;
  [Model.AI_AGENT_SMART]: AiAgentSmartSettings; // Updated
  [Model.PRIVATE]: PrivateModeSettings;
  [Model.FLUX_KONTEX]: FluxKontexSettings;
  [Model.FLUX_KONTEX_MAX_MULTI]: FluxKontexSettings;
  [Model.FLUX_ULTRA]: FluxDevSettings;
  [Model.KLING_VIDEO]: KlingAiSettings;
  [Model.TRADING_PRO]: TradingProSettings;
};

export type AnyModelSettings = 
  | ModelSettings
  | ImagenSettings
  | OpenAITtsSettings
  | RealTimeTranslationSettings
  | AiAgentSmartSettings // Updated
  | PrivateModeSettings
  | FluxKontexSettings
  | FluxDevSettings
  | KlingAiSettings
  | TradingProSettings;


export type AllModelSettings = {
  [K in Model]?: ModelSpecificSettingsMap[K];
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
  currentEnableWebSearch?: boolean; 
}

export interface ApiKeyStatus {
  isSet: boolean;
  envVarName: string; 
  modelName: string; 
  isMock: boolean;
  isGeminiPlatform: boolean; 
  isImageGeneration?: boolean; 
  isTextToSpeech?: boolean; 
  isRealTimeTranslation?: boolean; 
  isAiAgentSmart?: boolean; // Renamed from isAiAgent
  isPrivateMode?: boolean; 
  isImageEditing?: boolean; 
  isMultiImageEditing?: boolean; 
  isFluxDevImageGeneration?: boolean; 
  isKlingVideoGeneration?: boolean; 
  isTradingPro?: boolean; 
}

export interface Persona {
  id: string;
  name: string;
  instruction: string;
}

export interface SettingsPanelProps {
  selectedModel: Model;
  onModelChange: (model: Model) => void;
  modelSettings: AnyModelSettings; 
  onModelSettingsChange: (settings: Partial<AnyModelSettings>) => void; 
  isWebSearchEnabled: boolean;
  onWebSearchToggle: (enabled: boolean) => void;
  disabled: boolean;
  apiKeyStatuses: Record<Model, ApiKeyStatus>;
  personas: Persona[];
  activePersonaId: string | null;
  onPersonaChange: (personaId: string | null) => void;
  onPersonaSave: (persona: Persona) => void;
  onPersonaDelete: (personaId: string) => void;
  userSession: UserSessionState;
}


export interface HistoryPanelProps {
  savedSessions: ChatSession[];
  activeSessionId: string | null;
  onLoadSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newName: string) => void;
  onSaveCurrentChat: () => void;
  onStartNewChat: () => void;
  isLoading: boolean;
  onTogglePinSession: (sessionId: string) => void;
  onSaveChatToDevice: () => void;
  onLoadChatFromDevice: (file: File) => void;
  onExportChatWithMediaData: () => void;
}

export interface ChatSession {
  id: string;
  name: string;
  timestamp: number;
  model: Model;
  messages: ChatMessage[];
  modelSettingsSnapshot: AnyModelSettings; 
  isPinned: boolean;
  activePersonaIdSnapshot: string | null; 
}

export interface ApiChatMessage {
  role: 'user' | 'assistant' | 'system' | 'function' | 'tool';
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail?: "auto" | "low" | "high" } }>;
  name?: string; 
  tool_calls?: any[]; 
  tool_call_id?: string; 
}

export interface ApiStreamChunk {
  textDelta?: string;
  isFinished?: boolean;
  error?: string;
}

export interface GeneralApiSendMessageParams {
  modelIdentifier: string; 
  history: ApiChatMessage[];
  modelSettings: ModelSettings;
  userSession: UserSessionState; 
}

export interface NotificationMessage {
  id: string;
  message: string;
  type: NotificationType;
  timestamp: number;
  read: boolean;
  details?: string; 
}

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface NotificationContextType {
  notifications: NotificationMessage[];
  unreadCount: number;
  addNotification: (message: string, type: NotificationType, details?: string) => void;
  markAllAsRead: () => void;
  clearAllNotifications: () => void;
}

export interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChatBackgroundChange: (newUrl: string | null) => void;
  currentChatBackground: string | null;
  userProfile: UserGlobalProfile | null; 
  onUpdateUserProfile: (updatedProfile: UserGlobalProfile) => void;
  currentUserCredits: number;
  onPurchaseCredits: (packageId: string, paymentMethod: 'paypal' | 'stripe' | 'vietqr') => void;
  paypalEmail: string | undefined;
  onSavePayPalEmail: (email: string) => void;
}

export type AccountTabType = 'profile' | 'credits' | 'devices' | 'background' | 'avatar' | 'payment';


export type LanguageOption = 'en' | 'ja' | 'ko' | 'zh' | 'vi'; 
export type LanguageLearningActivityType = 'listening' | 'speaking' | 'vocabulary' | 'quiz' | 'sentence-scramble' | 'handwriting';


export interface LanguageOptionConfig {
  code: LanguageOption;
  name: string;
  flag: string;
}

export interface TranslationLanguageOptionConfig {
  code: string; 
  name: string;
  flag: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; 
  expThreshold: number;
}

export interface UserLanguageProfile {
  exp: number;
  earnedBadgeIds: string[];
}

export interface UserGlobalProfile {
  languageProfiles: {
    [key in LanguageOption]?: UserLanguageProfile;
  };
  aboutMe?: string;
  credits: number; 
  paypalEmail?: string; 
  favoriteLanguage?: LanguageOption | "";
}

export interface LanguageLearningModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserGlobalProfile | null;
  userSession: UserSessionState; 
  onUpdateProfile: (profile: UserGlobalProfile) => void;
  onAddExp: (language: LanguageOption, expPoints: number) => void;
}

export interface LearningContent {
    id: string;
    activityType: LanguageLearningActivityType;
    language: LanguageOption;
    script?: string; 
    question?: string; 
    options?: string[]; 
    correctAnswerIndex?: number; 
    phraseToSpeak?: string; 
    vocabularySet?: VocabularyItem[]; 
    originalSentence?: string; 
    scrambledWords?: { word: string, id: number }[]; 
    targetText?: string; 
    instruction?: string; 
}

export interface VocabularyItem {
    word: string;
    meaning: string;
    exampleSentence: string;
}

export interface LearningActivityState {
    isLoadingContent: boolean;
    content: LearningContent | null;
    error: string | null;
    userAnswer: string | number | null; 
    userSelectedWordIds?: number[]; 
    isAnswerSubmitted: boolean;
    isAnswerCorrect: boolean | null;
    audioUrl?: string; 
    isAudioPlaying?: boolean; 
    translatedUserSpeech?: string; 
    isLoadingTranslation?: boolean; 
    userHandwritingImage?: string; 
    accuracyScore?: number; 
    aiFeedback?: string; 
    handwritingInputMethod?: 'draw' | 'upload'; 
}

export interface GamesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayWebGame: (gameType: WebGameType, gameTitle: string) => void;
}

export type WebGameType = 'tic-tac-toe' | 'sliding-puzzle' | 'flappy-bird' | 'tien-len' | '8-ball-pool' | null;

export interface WebGamePlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameType: WebGameType;
  gameTitle: string;
}

export enum CardSuit {
  SPADES = '♠',   
  CLUBS = '♣',    
  DIAMONDS = '♦', 
  HEARTS = '♥'    
}

export enum CardRank { 
  THREE = '3', FOUR = '4', FIVE = '5', SIX = '6', SEVEN = '7',
  EIGHT = '8', NINE = '9', TEN = '10', JACK = 'J', QUEEN = 'Q',
  KING = 'K', ACE = 'A', TWO = '2'
}

export interface TienLenCard {
  id: string; 
  rank: CardRank;
  suit: CardSuit;
  value: number; 
  isSelected: boolean;
}

export type PlayerHand = TienLenCard[];

export interface TienLenGameState {
  playerHand: PlayerHand;
  aiHand: PlayerHand;
  table: TienLenCard[]; 
  lastPlayedHand: ValidatedHand | null; 
  currentPlayer: 'player' | 'ai';
  turnHistory: TurnHistoryEntry[];
  winner: 'player' | 'ai' | null;
  isDealing: boolean;
  statusMessage: string;
  playerScore: number;
  aiScore: number;
  turnTimer: number;
  isPaused: boolean;
  firstPlayerOfTheGame: 'player' | 'ai' | null; 
  isFirstTurnOfGame: boolean;
}

export interface TurnHistoryEntry {
  player: 'player' | 'ai';
  playedCards: ValidatedHand | null; 
  passed: boolean;
}

export enum TienLenHandType {
  SINGLE = 'Single',
  PAIR = 'Pair',
  TRIPLE = 'Triple',
  STRAIGHT = 'Straight', 
  FOUR_OF_A_KIND = 'Four of a Kind', 
  THREE_PAIR_STRAIGHT = 'Three Pair Straight', 
  INVALID = 'Invalid',
}

export interface ValidatedHand {
  type: TienLenHandType;
  cards: TienLenCard[];
  rankValue: number; 
  suitValue?: number; 
  length?: number; 
}

export interface TienLenGameModalProps {
  isOpen: boolean;
  onClose: () => void;
}


export interface LoginDeviceLog {
  id: string;
  device: string;
  timestamp: number;
}

export interface CreditPackage {
  id: string;
  name: string;
  description: string;
  price: number; 
  currency: 'USD' | 'VND'; 
  creditsAwarded: number;
}

export interface DemoUserLimits {
  fluxKontextMaxMonthlyUsesLeft: number;
  fluxKontextMaxMonthlyMaxUses: number;
  fluxKontextProMonthlyUsesLeft: number;
  fluxKontextProMonthlyMaxUses: number;
  imagen3MonthlyImagesLeft: number;
  imagen3MonthlyMaxImages: number;
  openaiTtsMonthlyCharsLeft: number;
  openaiTtsMonthlyMaxChars: number;
  fluxDevMonthlyImagesLeft: number; 
  fluxDevMonthlyMaxImages: number;
  klingVideoMonthlyUsed?: number; 
  klingVideoMonthlyMaxUses?: number; 
}

export interface PaidUserLimits {
  imagen3ImagesLeft: number; 
  imagen3MaxImages: number;
  openaiTtsCharsLeft: number; 
  openaiTtsMaxChars: number;
  fluxKontextMaxMonthlyUsesLeft: number;
  fluxKontextMaxMonthlyMaxUses: number; 
  fluxKontextProMonthlyUsesLeft: number;
  fluxKontextProMonthlyMaxUses: number; 
  fluxDevMonthlyImagesLeft: number; 
  fluxDevMonthlyMaxImages: number;  
  klingVideoMonthlyUsed?: number; 
  klingVideoMonthlyMaxGenerations?: number; 
}

export interface UserSessionState {
  isDemoUser: boolean;
  demoUsername?: string; 
  demoUserToken: string | null; 
  demoLimits: DemoUserLimits | null; 

  isPaidUser: boolean;
  paidUsername?: string;
  paidUserToken?: string | null; 
  paidSubscriptionEndDate?: string | null; 
  paidLimits: PaidUserLimits | null;
}

export interface DemoUserLoginResponse {
    success: boolean;
    message?: string;
    isDemoUser: true; 
    username: string; 
    demoUserToken: string; 
    limits: DemoUserLimits; 
}

export interface AdminLoginResponse {
    success: boolean;
    message?: string;
    isAdmin: true;
}

export interface PaidLoginResponse {
    success: boolean;
    message?: string;
    isPaidUser: true;
    username: string;
    paidUserToken?: string; 
    subscriptionEndDate?: string; 
    limits: PaidUserLimits;
}

export type LoginResponseType = DemoUserLoginResponse | AdminLoginResponse | PaidLoginResponse;


export interface SingleImageData {
  image_base_64: string;
  image_mime_type: 'image/jpeg' | 'image/png';
}

export interface MultiImageData {
  images_data: Array<{ base64: string; mimeType: string }>;
}

export interface EditImageWithFluxKontexParams {
  modelIdentifier: string; 
  prompt: string;
  settings: FluxKontexSettings;
  imageData: SingleImageData | MultiImageData; 
  userSession: UserSessionState;
  requestHeaders?: HeadersInit; 
}

export interface GenerateImageWithFluxDevParams {
  modelIdentifier: string; 
  prompt: string;
  settings: FluxDevSettings;
  userSession: UserSessionState;
  requestHeaders?: HeadersInit; 
}

export interface GenerateVideoWithKlingParams {
  modelIdentifier: string; 
  prompt: string;
  settings: KlingAiSettings;
  imageData: SingleImageData; 
  userSession: UserSessionState;
  requestHeaders?: HeadersInit;
}


export interface HandwritingCanvasProps {
  width: number;
  height: number;
  penColor?: string;
  penThickness?: number;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  disabled?: boolean;
}

export interface BackgroundOption {
  id: string;
  name: string;
  imageUrl: string;
  thumbnailUrl: string;
}

export interface MockUser {
  name: string;
  email?: string;
}

export interface HeaderProps {
  currentUser: MockUser | null;
  onLogin: (code: string) => void;
  onLogout: () => void;
  openLoginModalInitially?: boolean;
  onLoginModalOpened?: () => void;
  onToggleLanguageLearningModal: () => void;
  onToggleGamesModal: () => void;
  onToggleVoiceAgentWidget: () => void;
  chatBackgroundUrl: string | null;
  onChatBackgroundChange: (newUrl: string | null) => void;
  userProfile: UserGlobalProfile | null;
  onUpdateUserProfile: (updatedProfile: UserGlobalProfile) => void;
  currentUserCredits: number;
  onPurchaseCredits: (packageId: string, paymentMethod: 'paypal' | 'stripe' | 'vietqr') => void;
  paypalEmail: string | undefined;
  onSavePayPalEmail: (email: string) => void;
  onToggleNewsModal: () => void; 
}


export const getActualModelIdentifier = (model: Model): string => {
  const match = model.match(/\(([^)]+)\)$/);
  return match ? match[1] : model;
};

export interface FalSubmitProxyResponse {
  requestId?: string;
  message?: string;
  error?: string;
}

export interface FalStatusProxyResponse {
  status?: 'COMPLETED' | 'IN_PROGRESS' | 'IN_QUEUE' | 'ERROR' | 'COMPLETED_NO_IMAGE' | 'NOT_FOUND' | 'PROXY_REQUEST_ERROR' | 'NETWORK_ERROR' | string;
  imageUrl?: string; 
  imageUrls?: string[];
  videoUrl?: string; 
  error?: string;
  message?: string; 
  rawResult?: any; 
}

export interface GeminiTradingAnalysisResponse {
  analysisText?: string;
  trendPredictions?: { up_percentage: number; down_percentage: number; sideways_percentage: number };
  groundingSources?: GroundingSource[];
  error?: string;
}