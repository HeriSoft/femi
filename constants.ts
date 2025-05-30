

import { Model, AllModelSettings, ModelSettings, ImagenSettings, LanguageOptionConfig, Badge, UserLanguageProfile, LanguageOption, RealTimeTranslationSettings, TranslationLanguageOptionConfig, OpenAITtsSettings, AccountTabType, BackgroundOption, CardSuit, CardRank, AiAgentSettings } from './types.ts'; // Update to .ts

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  systemInstruction: 'You are a helpful AI assistant.',
};

export const DEFAULT_IMAGEN_SETTINGS: ImagenSettings = {
  numberOfImages: 1,
  outputMimeType: 'image/jpeg',
  aspectRatio: '1:1', // Default aspect ratio
};

export const DEFAULT_OPENAI_TTS_SETTINGS: OpenAITtsSettings = {
    voice: 'alloy',
    speed: 1.0,
    modelIdentifier: 'tts-1',
};

export const DEFAULT_REAL_TIME_TRANSLATION_SETTINGS: RealTimeTranslationSettings = {
  targetLanguage: 'en', // Default to English
};

export const DEFAULT_AI_AGENT_SETTINGS: AiAgentSettings = {
  ...DEFAULT_MODEL_SETTINGS, // Base settings like topP
  temperature: 0.5, 
  topK: 32, // Adjusted for potentially more focused planning
  systemInstruction: `You are an AI Agent powered by Gemini. Your primary function is to understand a user's high-level goal or complex task, break it down into logical steps, and create a comprehensive plan or document.

FILE HANDLING:
- TEXT FILES and IMAGE FILES: If the user uploads a text file (e.g., .txt, .md, .js) or an image file (e.g., .png, .jpg), its content WILL BE EMBEDDED directly within the 'user' turn of the prompt you are currently processing. You will see this embedded content, often marked (e.g., "Content from uploaded file [filename]: ..."). This embedded content IS the file's content. You MUST analyze and incorporate this provided, embedded information from the text/image file into your response. DO NOT state you cannot access it.
- OTHER FILE TYPES (e.g., PDF, DOCX, ZIP): If the user mentions uploading a file type like PDF, DOCX, etc., you will likely only receive the FILENAME, NOT ITS CONTENT. In this case:
    1. Politely inform the user that you cannot directly access or process the internal content of that specific file type (e.g., "I cannot directly read the content of PDF files.").
    2. Suggest alternatives: Ask the user to paste relevant text from the file, summarize the file's content, or ask specific questions about it if they want you to work with its information.
    3. You CAN use the filename as context if the user's goal involves tasks like searching the web for information related to the file's topic (e.g., "Find reviews for the document named 'product_specs.pdf'").

WEB SEARCH AND CITATION:
To achieve user goals, you WILL use web search capabilities to gather necessary information, find relevant data, or identify useful resources IF the user's goal AND THE PROVIDED EMBEDDED FILE CONTENT (IF ANY, for text/images) are insufficient for a complete answer.
If the task implies needing visual information (e.g., "show me pictures of Da Lat") and no image was uploaded by the user as part of the embedded content, you should use web search to find URLs to web pages containing relevant images and provide those URLs. You MUST NOT generate images yourself with an image generation tool.
Always cite your sources by providing URLs when you use information from the web. These URLs will typically come from the 'groundingMetadata' provided to you.

OUTPUT:
Present your findings and the plan in a clear, structured format (e.g., using markdown for lists, headings). If the user's request implies creating a document (e.g., an email, a report, a detailed itinerary), generate the full text content for that document.
Your goal is to act as an autonomous assistant that takes a complex request, potentially including embedded file context for text/images or filename context for other types, and returns a complete, actionable result. Be thorough and proactive.`,
};


export const ALL_MODEL_DEFAULT_SETTINGS: AllModelSettings = {
  [Model.GEMINI]: { ...DEFAULT_MODEL_SETTINGS, systemInstruction: 'You are a helpful and creative AI assistant powered by Gemini Flash.' },
  [Model.GEMINI_ADVANCED]: { ...DEFAULT_MODEL_SETTINGS, systemInstruction: 'You are Gemini Advanced, a powerful multimodal AI by Google.' },
  [Model.GPT4O]: { ...DEFAULT_MODEL_SETTINGS, systemInstruction: 'You are ChatGPT (gpt-4.1), a powerful AI by OpenAI.' }, 
  [Model.GPT4O_MINI]: { ...DEFAULT_MODEL_SETTINGS, systemInstruction: 'You are ChatGPT (gpt-4.1-mini), an efficient AI by OpenAI.' }, // Updated
  [Model.DEEPSEEK]: { ...DEFAULT_MODEL_SETTINGS, systemInstruction: 'You are Deepseek Coder, an AI specialized in coding and chat, powered by the deepseek-chat model.' },
  [Model.CLAUDE]: { ...DEFAULT_MODEL_SETTINGS, systemInstruction: 'You are Claude, a helpful AI assistant by Anthropic.' },
  [Model.IMAGEN3]: { 
    ...DEFAULT_MODEL_SETTINGS, 
    ...DEFAULT_IMAGEN_SETTINGS, 
    systemInstruction: 'Image generation prompt.', 
  },
  [Model.OPENAI_TTS]: {
    ...DEFAULT_MODEL_SETTINGS, // Basic settings, mostly unused
    ...DEFAULT_OPENAI_TTS_SETTINGS,
    systemInstruction: 'Text to speech synthesis.', // Placeholder
  },
  [Model.REAL_TIME_TRANSLATION]: {
    ...DEFAULT_MODEL_SETTINGS, // Basic settings, mostly unused
    ...DEFAULT_REAL_TIME_TRANSLATION_SETTINGS,
    systemInstruction: 'Translate the given text accurately.', // Placeholder system instruction
  },
  [Model.AI_AGENT]: { ...DEFAULT_AI_AGENT_SETTINGS },
};
 
export const LOCAL_STORAGE_SETTINGS_KEY = 'femiAiChatSettings';
export const LOCAL_STORAGE_HISTORY_KEY = 'femiAiChatHistory';
export const LOCAL_STORAGE_PERSONAS_KEY = 'femiAiChatPersonas';
export const LOCAL_STORAGE_NOTIFICATIONS_KEY = 'femiAiNotifications';
export const MAX_NOTIFICATIONS = 50; // Max notifications to store
export const LOCAL_STORAGE_DEVICE_LOGS_KEY = 'femiAiDeviceLogs';
export const MAX_DEVICE_LOGS = 5;
export const LOCAL_STORAGE_CHAT_BACKGROUND_KEY = 'femiAiChatBackgroundUrl';


// Language Learning Constants
export const LOCAL_STORAGE_USER_PROFILE_KEY = 'femiAiLanguageLearningProfile';

export const LANGUAGE_OPTIONS: LanguageOptionConfig[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese (Mandarin)', flag: '🇨🇳' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
];

export const TRANSLATION_TARGET_LANGUAGES: TranslationLanguageOptionConfig[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'zh', name: 'Chinese (Mandarin)', flag: '🇨🇳' },
  { code: 'th', name: 'Thai', flag: '🇹🇭' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
];


export const DEFAULT_USER_LANGUAGE_PROFILE: UserLanguageProfile = {
  exp: 0,
  earnedBadgeIds: [],
};

export const EXP_MILESTONES_CONFIG: Array<{ exp: number; bonus: number; badgeId?: string }> = [
  { exp: 100, bonus: 50, badgeId: 'beginner_linguist' },
  { exp: 500, bonus: 100, badgeId: 'adept_speaker' },
  { exp: 1000, bonus: 200, badgeId: 'fluent_friend' },
  { exp: 2500, bonus: 300, badgeId: 'language_champion' },
  { exp: 5000, bonus: 500, badgeId: 'polyglot_prodigy' },
];

export const BADGES_CATALOG: Record<string, Badge> = {
  'beginner_linguist': { id: 'beginner_linguist', name: 'Beginner Linguist', description: 'Reached 100 EXP!', icon: '🌱', expThreshold: 100 },
  'adept_speaker': { id: 'adept_speaker', name: 'Adept Speaker', description: 'Reached 500 EXP!', icon: '🗣️', expThreshold: 500 },
  'fluent_friend': { id: 'fluent_friend', name: 'Fluent Friend', description: 'Reached 1000 EXP!', icon: '🤝', expThreshold: 1000 },
  'language_champion': { id: 'language_champion', name: 'Language Champion', description: 'Reached 2500 EXP!', icon: '🏆', expThreshold: 2500 },
  'polyglot_prodigy': { id: 'polyglot_prodigy', name: 'Polyglot Prodigy', description: 'Reached 5000 EXP!', icon: '🌟', expThreshold: 5000 },
};

export const getNextMilestone = (currentExp: number): { milestoneExp: number, remainingExp: number, progressPercentage: number, currentLevelMilestone: number, nextLevelMilestone: number } | null => {
  const sortedMilestones = [...EXP_MILESTONES_CONFIG].sort((a, b) => a.exp - b.exp);
  
  let currentLevelMilestone = 0;
  for (const milestone of sortedMilestones) {
    if (currentExp < milestone.exp) {
      const nextMilestone = milestone;
      const remainingExp = nextMilestone.exp - currentExp;
      const totalExpForLevel = nextMilestone.exp - currentLevelMilestone;
      const expInCurrentLevel = currentExp - currentLevelMilestone;
      const progressPercentage = totalExpForLevel > 0 ? Math.min(100, (expInCurrentLevel / totalExpForLevel) * 100) : 0;
      return { 
        milestoneExp: nextMilestone.exp, 
        remainingExp, 
        progressPercentage,
        currentLevelMilestone: currentLevelMilestone,
        nextLevelMilestone: nextMilestone.exp
      };
    }
    currentLevelMilestone = milestone.exp;
  }
  // If all milestones passed or no milestones defined
  const lastMilestoneExp = sortedMilestones.length > 0 ? sortedMilestones[sortedMilestones.length - 1].exp : 0;
  return { 
    milestoneExp: lastMilestoneExp + 500, // Arbitrary next goal if all passed
    remainingExp: (lastMilestoneExp + 500) - currentExp, 
    progressPercentage: currentExp > lastMilestoneExp && lastMilestoneExp > 0 ? 100 : 0, // Simplified if past all known milestones
    currentLevelMilestone: lastMilestoneExp,
    nextLevelMilestone: lastMilestoneExp + 500 
  }; 
};

// Account Settings Constants
export const ACCOUNT_MENU_ITEMS: Array<{ id: AccountTabType; label: string; status?: 'coming_soon' }> = [
  { id: 'profile', label: 'My Profile' }, // Added "My Profile" tab
  { id: 'devices', label: 'Devices' },
  { id: 'background', label: 'Background' },
  { id: 'avatar', label: 'Avatar', status: 'coming_soon' },
  { id: 'payment', label: 'Payment', status: 'coming_soon' },
];

export const DEMO_BACKGROUNDS: BackgroundOption[] = [
  { id: 'bg_default_none', name: 'Default (None)', imageUrl: '', thumbnailUrl: '' }, 
  { 
    id: 'bg_cosmic_pattern', 
    name: 'Cosmic Pattern', 
    imageUrl: 'https://i.ibb.co/PZJc42yb/1f2023c9-af75-4a08-9c75-f72e7e1fd2f2.jpg', 
    thumbnailUrl: 'https://i.ibb.co/PZJc42yb/1f2023c9-af75-4a08-9c75-f72e7e1fd2f2.jpg' 
  },
  { 
    id: 'bg_colorful_gradient', 
    name: 'Colorful Gradient', 
    imageUrl: 'https://i.ibb.co/tpKxvSy2/10081449.jpg', 
    thumbnailUrl: 'https://i.ibb.co/tpKxvSy2/10081449.jpg' 
  },
  { 
    id: 'bg_abstract_art', 
    name: 'Abstract Art', 
    imageUrl: 'https://i.ibb.co/mp8DJtd/v882-sasi-34-e.jpg', 
    thumbnailUrl: 'https://i.ibb.co/mp8DJtd/v882-sasi-34-e.jpg' 
  },
];

// Tien Len Game Constants
export const TIEN_LEN_SUITS: CardSuit[] = [CardSuit.SPADES, CardSuit.CLUBS, CardSuit.DIAMONDS, CardSuit.HEARTS];
export const TIEN_LEN_RANKS: CardRank[] = [
  CardRank.THREE, CardRank.FOUR, CardRank.FIVE, CardRank.SIX, CardRank.SEVEN,
  CardRank.EIGHT, CardRank.NINE, CardRank.TEN, CardRank.JACK, CardRank.QUEEN,
  CardRank.KING, CardRank.ACE, CardRank.TWO
];

// Numerical values for ranks (3 is lowest, 2 is highest)
export const TIEN_LEN_RANK_VALUES: Record<CardRank, number> = {
  [CardRank.THREE]: 0, [CardRank.FOUR]: 1, [CardRank.FIVE]: 2, [CardRank.SIX]: 3,
  [CardRank.SEVEN]: 4, [CardRank.EIGHT]: 5, [CardRank.NINE]: 6, [CardRank.TEN]: 7,
  [CardRank.JACK]: 8, [CardRank.QUEEN]: 9, [CardRank.KING]: 10, [CardRank.ACE]: 11,
  [CardRank.TWO]: 12,
};

// Suit priorities (lower value is weaker suit for same rank)
export const TIEN_LEN_SUIT_VALUES: Record<CardSuit, number> = {
  [CardSuit.SPADES]: 0,   // Bích
  [CardSuit.CLUBS]: 1,    // Chuồn (Tép)
  [CardSuit.DIAMONDS]: 2, // Rô
  [CardSuit.HEARTS]: 3,   // Cơ
};

export const CARDS_PER_PLAYER = 12; // Changed from 13 to 12
export const TIEN_LEN_TURN_COUNTDOWN_SECONDS = 10;
export const TIEN_LEN_AI_THINKING_MILLISECONDS = 1500;
