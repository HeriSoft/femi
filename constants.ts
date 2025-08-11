



import { Model, AllModelSettings, ModelSettings, ImagenSettings, LanguageOptionConfig, Badge, UserLanguageProfile, LanguageOption, RealTimeTranslationSettings, TranslationLanguageOptionConfig, OpenAITtsSettings, AccountTabType, BackgroundOption, CardSuit, CardRank, AdvancedToolsSettings, CreditPackage, PrivateModeSettings, FluxKontexSettings, FluxKontexAspectRatio, DemoUserLimits, PaidUserLimits, FluxDevSettings, KlingAiSettings, KlingAiDuration, KlingAiAspectRatio, ModelSpecificSettingsMap, TradingProSettings, TradingPair, FluxDevImageSize, WanI2vSettings, WanI2vResolution, WanI2vAspectRatio, FluxKontexLoraSettings, WanI2vV22Settings, WanI2vV22Resolution, WanI2vV22AspectRatio, WanI2vV22InterpolatorModel } from './types.ts';

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  systemInstruction: 'You are a helpful AI assistant.',
};

export const DEFAULT_IMAGEN_SETTINGS: ImagenSettings = {
  numberOfImages: 1,
  outputMimeType: 'image/jpeg',
  aspectRatio: '1:1',
};

export const DEFAULT_OPENAI_TTS_SETTINGS: OpenAITtsSettings = {
    voice: 'alloy',
    speed: 1.0,
    modelIdentifier: 'tts-1',
    translateBeforeSpeaking: true,
};

export const DEFAULT_REAL_TIME_TRANSLATION_SETTINGS: RealTimeTranslationSettings = {
  targetLanguage: 'en',
};

export const DEFAULT_ADVANCED_TOOLS_SETTINGS: AdvancedToolsSettings = { ...DEFAULT_MODEL_SETTINGS, systemInstruction: 'You are an advanced tool-using AI assistant. Your primary function is to understand user requests and route them to the appropriate tool, such as IP info, weather, or directions.' };


export const DEFAULT_PRIVATE_MODE_SETTINGS: PrivateModeSettings = {
  systemInstruction: 'Local data storage mode. No AI interaction.',
};

export const DEFAULT_FLUX_KONTEX_SETTINGS: FluxKontexSettings = {
  guidance_scale: 7.5,
  safety_tolerance: 5,
  num_inference_steps: 30,
  seed: null,
  num_images: 1,
  aspect_ratio: 'default',
  output_format: 'jpeg',
};

export const DEFAULT_FLUX_KONTEX_LORA_SETTINGS: FluxKontexLoraSettings = {
  negative_prompt: 'EasyNegative',
  num_inference_steps: 20,
  seed: null,
  guidance_scale: 2.5,
  num_images: 1,
  output_format: 'png',
  loras: [],
  acceleration: 'none',
  resolution_mode: 'match_input',
  enable_safety_checker: false,
  // New advanced defaults
  sampler_name: 'euler_ancestral',
  scheduler: 'normal',
  denoising_strength: 0.5,
  clip_skip: 2,
};

export const DEFAULT_FLUX_DEV_SETTINGS: FluxDevSettings = {
  image_size: 'landscape_4_3',
  num_inference_steps: 28,
  seed: null,
  guidance_scale: 3.5,
  num_images: 1,
  enable_safety_checker: false,
  output_format: 'jpeg',
};

export const DEFAULT_KLING_AI_SETTINGS: KlingAiSettings = {
  duration: "5" as KlingAiDuration,
  aspect_ratio: "16:9" as KlingAiAspectRatio,
  negative_prompt: "blur, distort, and low quality",
  cfg_scale: 0.5,
};

export const DEFAULT_WAN_I2V_SETTINGS: WanI2vSettings = {
  negative_prompt: "bright colors, overexposed, static, blurred details, subtitles, style, artwork, painting, picture, still, overall gray, worst quality, low quality, JPEG compression residue, ugly, incomplete, extra fingers, poorly drawn hands, poorly drawn faces, deformed, disfigured, malformed limbs, fused fingers, still picture, cluttered background, three legs, many people in the background, walking backwards",
  num_frames: 81,
  frames_per_second: 16,
  seed: null,
  resolution: "720p",
  num_inference_steps: 30,
  guide_scale: 5,
  shift: 5,
  enable_safety_checker: true,
  enable_prompt_expansion: false,
  aspect_ratio: "16:9",
  loras: [],
  reverse_video: false,
  turbo_mode: true,
};

export const DEFAULT_WAN_I2V_V22_SETTINGS: WanI2vV22Settings = {
  negative_prompt: "",
  num_frames: 81,
  frames_per_second: 24,
  seed: null,
  resolution: "720p",
  num_inference_steps: 40,
  guidance_scale: 3.5,
  shift: 5,
  enable_safety_checker: true,
  enable_prompt_expansion: false,
  aspect_ratio: "auto",
  interpolator_model: "film",
  num_interpolated_frames: 0,
  adjust_fps_for_interpolation: true,
  loras: [],
};


export const DEFAULT_TRADING_PRO_SETTINGS: TradingProSettings = {
  selectedPair: null,
};


const GENERIC_FILE_HANDLING_INSTRUCTION = `
IMAGE HANDLING:
- If the user uploads an image, the system will analyze it and provide you with a description of the image content in a "(System Note: Image analysis result: '[description]')".
- Use this description along with the user's text query to understand their intent.
- You do not receive or process the image data directly.

FILE HANDLING (NON-IMAGE):
- This model DOES NOT process general file uploads (e.g., PDF, DOCX).
- If a user mentions uploading a file that is not an image, politely inform them you cannot access its content and suggest they copy/paste relevant text.
`;

export const ALL_MODEL_DEFAULT_SETTINGS: ModelSpecificSettingsMap = {
  [Model.GEMINI]: { ...DEFAULT_MODEL_SETTINGS, systemInstruction: `You are a helpful and creative AI assistant powered by Gemini Flash.${GENERIC_FILE_HANDLING_INSTRUCTION}` },
  [Model.GEMINI_ADVANCED]: { ...DEFAULT_MODEL_SETTINGS, systemInstruction: `You are Gemini Advanced, a powerful multimodal AI by Google.${GENERIC_FILE_HANDLING_INSTRUCTION}` },
  [Model.GPT4O]: { ...DEFAULT_MODEL_SETTINGS, systemInstruction: `You are ChatGPT (gpt-4.1), a powerful AI by OpenAI.${GENERIC_FILE_HANDLING_INSTRUCTION}` },
  [Model.GPT4O_MINI]: { ...DEFAULT_MODEL_SETTINGS, systemInstruction: `You are ChatGPT (gpt-4.1-mini), an efficient AI by OpenAI.${GENERIC_FILE_HANDLING_INSTRUCTION}` },
  [Model.DEEPSEEK]: { ...DEFAULT_MODEL_SETTINGS, systemInstruction: `You are Deepseek Coder, an AI specialized in coding and chat, powered by the deepseek-chat model.${GENERIC_FILE_HANDLING_INSTRUCTION}` },
  [Model.CLAUDE]: { ...DEFAULT_MODEL_SETTINGS, systemInstruction: `You are Claude, a helpful AI assistant by Anthropic. ${GENERIC_FILE_HANDLING_INSTRUCTION}` },
  [Model.IMAGEN3]: { ...DEFAULT_IMAGEN_SETTINGS },
  [Model.OPENAI_TTS]: { ...DEFAULT_OPENAI_TTS_SETTINGS },
  [Model.REAL_TIME_TRANSLATION]: { ...DEFAULT_REAL_TIME_TRANSLATION_SETTINGS },
  [Model.ADVANCED_TOOLS]: { ...DEFAULT_ADVANCED_TOOLS_SETTINGS },
  [Model.PRIVATE]: { ...DEFAULT_PRIVATE_MODE_SETTINGS },
  [Model.FLUX_KONTEX]: { ...DEFAULT_FLUX_KONTEX_SETTINGS },
  [Model.FLUX_KONTEX_LORA]: { ...DEFAULT_FLUX_KONTEX_LORA_SETTINGS },
  [Model.FLUX_KONTEX_MAX_MULTI]: { ...DEFAULT_FLUX_KONTEX_SETTINGS, num_images: 2 },
  [Model.FLUX_ULTRA]: { ...DEFAULT_FLUX_DEV_SETTINGS },
  [Model.KLING_VIDEO]: { ...DEFAULT_KLING_AI_SETTINGS },
  [Model.WAN_I2V]: { ...DEFAULT_WAN_I2V_SETTINGS },
  [Model.WAN_I2V_V22]: { ...DEFAULT_WAN_I2V_V22_SETTINGS },
  [Model.TRADING_PRO]: { ...DEFAULT_TRADING_PRO_SETTINGS },
};

export const LOCAL_STORAGE_SETTINGS_KEY = 'femiAiChatSettings';
export const LOCAL_STORAGE_HISTORY_KEY = 'femiAiChatHistory';
export const LOCAL_STORAGE_PERSONAS_KEY = 'femiAiChatPersonas';
export const LOCAL_STORAGE_NOTIFICATIONS_KEY = 'femiAiNotifications';
export const MAX_NOTIFICATIONS = 50;
export const LOCAL_STORAGE_DEVICE_LOGS_KEY = 'femiAiDeviceLogs';
export const MAX_DEVICE_LOGS = 5;
export const LOCAL_STORAGE_CHAT_BACKGROUND_KEY = 'femiAiChatBackgroundUrl';
export const MAX_SAVED_CHAT_SESSIONS = 10;
export const MAX_TTS_FILE_UPLOAD_SIZE_BYTES = 100 * 1024; // 100 KB
export const MAX_TRANSLATION_MP3_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB (OpenAI Whisper limit)
export const MAX_TRANSLATION_TXT_UPLOAD_SIZE_BYTES = 100 * 1024; // 100 KB


export const DEMO_USER_DEFAULT_MONTHLY_LIMITS = {
  FLUX_KONTEX_MAX_MONTHLY: 0,
  FLUX_KONTEX_PRO_MONTHLY: 1,
  FLUX_KONTEX_LORA_MONTHLY: 0,
  IMAGEN3_MONTHLY_IMAGES: 5,
  OPENAI_TTS_MONTHLY_CHARS: 10000,
  FLUX_DEV_MONTHLY_IMAGES: 0,
  KLING_VIDEO_MONTHLY_MAX_USES: 0,
  WAN_I2V_MONTHLY_MAX_USES: 0,
  WAN_I2V_V22_MONTHLY_MAX_USES: 0,
};

export const INITIAL_DEMO_USER_LIMITS: DemoUserLimits = {
  fluxKontextMaxMonthlyUsesLeft: DEMO_USER_DEFAULT_MONTHLY_LIMITS.FLUX_KONTEX_MAX_MONTHLY,
  fluxKontextMaxMonthlyMaxUses: DEMO_USER_DEFAULT_MONTHLY_LIMITS.FLUX_KONTEX_MAX_MONTHLY,
  fluxKontextProMonthlyUsesLeft: DEMO_USER_DEFAULT_MONTHLY_LIMITS.FLUX_KONTEX_PRO_MONTHLY,
  fluxKontextProMonthlyMaxUses: DEMO_USER_DEFAULT_MONTHLY_LIMITS.FLUX_KONTEX_PRO_MONTHLY,
  fluxKontextLoraMonthlyUsed: 0,
  fluxKontextLoraMonthlyMaxUses: DEMO_USER_DEFAULT_MONTHLY_LIMITS.FLUX_KONTEX_LORA_MONTHLY,
  imagen3MonthlyImagesLeft: DEMO_USER_DEFAULT_MONTHLY_LIMITS.IMAGEN3_MONTHLY_IMAGES,
  imagen3MonthlyMaxImages: DEMO_USER_DEFAULT_MONTHLY_LIMITS.IMAGEN3_MONTHLY_IMAGES,
  openaiTtsMonthlyCharsLeft: DEMO_USER_DEFAULT_MONTHLY_LIMITS.OPENAI_TTS_MONTHLY_CHARS,
  openaiTtsMonthlyMaxChars: DEMO_USER_DEFAULT_MONTHLY_LIMITS.OPENAI_TTS_MONTHLY_CHARS,
  fluxDevMonthlyImagesLeft: DEMO_USER_DEFAULT_MONTHLY_LIMITS.FLUX_DEV_MONTHLY_IMAGES,
  fluxDevMonthlyMaxImages: DEMO_USER_DEFAULT_MONTHLY_LIMITS.FLUX_DEV_MONTHLY_IMAGES,
  klingVideoMonthlyUsed: 0,
  klingVideoMonthlyMaxUses: DEMO_USER_DEFAULT_MONTHLY_LIMITS.KLING_VIDEO_MONTHLY_MAX_USES,
  wanI2vMonthlyUsed: 0,
  wanI2vMonthlyMaxUses: DEMO_USER_DEFAULT_MONTHLY_LIMITS.WAN_I2V_MONTHLY_MAX_USES,
  wanI2vV22MonthlyUsed: 0,
  wanI2vV22MonthlyMaxUses: DEMO_USER_DEFAULT_MONTHLY_LIMITS.WAN_I2V_V22_MONTHLY_MAX_USES,
};


export const PAID_USER_LIMITS_CONFIG: PaidUserLimits = {
  imagen3ImagesLeft: 0,
  imagen3MaxImages: 25,
  openaiTtsCharsLeft: 0,
  openaiTtsMaxChars: 20000,
  fluxKontextMaxMonthlyUsesLeft: 0,
  fluxKontextMaxMonthlyMaxUses: 25,
  fluxKontextProMonthlyUsesLeft: 0,
  fluxKontextProMonthlyMaxUses: 35,
  fluxKontextLoraMonthlyUsed: 0,
  fluxKontextLoraMonthlyMaxGenerations: 20,
  fluxDevMonthlyImagesLeft: 0,
  fluxDevMonthlyMaxImages: 30,
  klingVideoMonthlyUsed: 0,
  klingVideoMonthlyMaxGenerations: 1,
  wanI2vMonthlyUsed: 0,
  wanI2vMonthlyMaxGenerations: 4,
  wanI2vV22MonthlyUsed: 0,
  wanI2vV22MonthlyMaxGenerations: 4,
};

export const OPENAI_TTS_MAX_INPUT_LENGTH = PAID_USER_LIMITS_CONFIG.openaiTtsMaxChars;


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
  const lastMilestoneExp = sortedMilestones.length > 0 ? sortedMilestones[sortedMilestones.length - 1].exp : 0;
  return {
    milestoneExp: lastMilestoneExp + 500,
    remainingExp: (lastMilestoneExp + 500) - currentExp,
    progressPercentage: currentExp > lastMilestoneExp && lastMilestoneExp > 0 ? 100 : 0,
    currentLevelMilestone: lastMilestoneExp,
    nextLevelMilestone: lastMilestoneExp + 500
  };
};

// Account Settings Constants
export const ACCOUNT_MENU_ITEMS: Array<{ id: AccountTabType; label: string; status?: 'coming_soon' }> = [
  { id: 'profile', label: 'My Profile' },
  { id: 'credits', label: 'Credits & Billing'},
  { id: 'devices', label: 'Devices' },
  { id: 'background', label: 'Background' },
  { id: 'avatar', label: 'Avatar', status: 'coming_soon' },
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

export const DEMO_CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'pkg_starter', name: 'Starter Pack', description: 'Great for trying things out.', price: 5.00, currency: 'USD', creditsAwarded: 500 },
  { id: 'pkg_basic', name: 'Basic Pack', description: 'Perfect for regular use.', price: 10.00, currency: 'USD', creditsAwarded: 1100 },
  { id: 'pkg_plus', name: 'Plus Pack', description: 'More credits, better value.', price: 20.00, currency: 'USD', creditsAwarded: 2500 },
  { id: 'pkg_pro', name: 'Pro Pack', description: 'For heavy users and projects.', price: 50.00, currency: 'USD', creditsAwarded: 6500 },
];

// Tien Len Game Constants
export const TIEN_LEN_SUITS: CardSuit[] = [CardSuit.SPADES, CardSuit.CLUBS, CardSuit.DIAMONDS, CardSuit.HEARTS];
export const TIEN_LEN_RANKS: CardRank[] = [
  CardRank.THREE, CardRank.FOUR, CardRank.FIVE, CardRank.SIX, CardRank.SEVEN,
  CardRank.EIGHT, CardRank.NINE, CardRank.TEN, CardRank.JACK, CardRank.QUEEN,
  CardRank.KING, CardRank.ACE, CardRank.TWO
];

export const TIEN_LEN_RANK_VALUES: Record<CardRank, number> = {
  [CardRank.THREE]: 0, [CardRank.FOUR]: 1, [CardRank.FIVE]: 2, [CardRank.SIX]: 3,
  [CardRank.SEVEN]: 4, [CardRank.EIGHT]: 5, [CardRank.NINE]: 6, [CardRank.TEN]: 7,
  [CardRank.JACK]: 8, [CardRank.QUEEN]: 9, [CardRank.KING]: 10, [CardRank.ACE]: 11,
  [CardRank.TWO]: 12,
};

export const TIEN_LEN_SUIT_VALUES: Record<CardSuit, number> = {
  [CardSuit.SPADES]: 0,
  [CardSuit.CLUBS]: 1,
  [CardSuit.DIAMONDS]: 2,
  [CardSuit.HEARTS]: 3,
};

export const CARDS_PER_PLAYER = 12;
export const TIEN_LEN_TURN_COUNTDOWN_SECONDS = 10;
export const TIEN_LEN_AI_THINKING_MILLISECONDS = 1500;

// Flux Dev Image Size Options
export const FLUX_DEV_IMAGE_SIZES: { value: FluxDevImageSize; label: string }[] = [
  { value: 'square_hd', label: 'Square HD (1:1)' },
  { value: 'square', label: 'Square (1:1)' },
  { value: 'portrait_4_3', label: 'Portrait (4:3)' },
  { value: 'portrait_16_9', label: 'Portrait (16:9)' },
  { value: 'landscape_4_3', label: 'Landscape (4:3)' },
  { value: 'landscape_16_9', label: 'Landscape (16:9)' },
];

// Kling AI Constants
export const KLING_AI_DURATIONS: { value: KlingAiDuration; label: string }[] = [
    { value: "5", label: "5 Seconds" },
    { value: "10", label: "10 Seconds" },
];

export const KLING_AI_ASPECT_RATIOS: { value: KlingAiAspectRatio; label: string }[] = [
    { value: "16:9", label: "16:9 (Widescreen)" },
    { value: "9:16", label: "9:16 (Portrait)" },
    { value: "1:1", label: "1:1 (Square)" },
];

// Wan I2V Video Constants
export const WAN_I2V_RESOLUTIONS: { value: WanI2vResolution; label: string }[] = [
    { value: "720p", label: "720p (HD)" },
    { value: "480p", label: "480p (SD)" },
];

export const WAN_I2V_ASPECT_RATIOS: { value: WanI2vAspectRatio; label: string }[] = [
    { value: "16:9", label: "16:9 (Widescreen)" },
    { value: "9:16", label: "9:16 (Portrait)" },
    { value: "1:1", label: "1:1 (Square)" },
    { value: "auto", label: "Auto (from image)" },
];

// Wan I2V v2.2 Video Constants
export const WAN_I2V_V22_RESOLUTIONS: { value: WanI2vV22Resolution; label: string }[] = [
    { value: "720p", label: "720p (HD)" },
    { value: "580p", label: "580p" },
];

export const WAN_I2V_V22_ASPECT_RATIOS: { value: WanI2vV22AspectRatio; label: string }[] = [
    { value: "auto", label: "Auto (from image)" },
    { value: "16:9", label: "16:9 (Widescreen)" },
    { value: "9:16", label: "9:16 (Portrait)" },
    { value: "1:1", label: "1:1 (Square)" },
];

export const WAN_I2V_V22_INTERPOLATORS: { value: WanI2vV22InterpolatorModel; label: string }[] = [
    { value: "film", label: "FILM (Default)" },
    { value: "rife", label: "RIFE (Smoother)" },
    { value: "none", label: "None" },
];


// Trading Pro Constants
export const TRADING_PRO_DISCLAIMER = `Mô hình này dựa trên kiến thức, kinh nghiệm, kỹ năng phân tích của AI để mang lại cái nhìn tổng quan chính xác và thực tế của thị trường giao dịch Crypto hoặc Vàng thế giới.\n\nĐây KHÔNG phải lời khuyên đầu tư. Chúng tôi KHÔNG đảm bảo mang lại lợi nhuận cho nhà đầu tư. Bạn phải thực sự cẩn trọng trong mọi quyết định đầu tư và quản lý vốn hiệu quả nếu bạn có ý định tham gia thị trường.\n\nChúng tôi sẽ KHÔNG chịu mọi trách nhiệm về tổn thất nếu bạn thua lỗ hoặc gặp rủi ro.`;

export const TRADING_PRO_PAIRS: TradingPair[] = [
  { value: 'XAUUSD', label: 'XAU/USD (Gold)' },
  { value: 'BTCUSD', label: 'BTC/USD (Bitcoin)' },
];

// ALPHA_VANTAGE_API_KEY removed
// Update the apiKeyStatuses for Trading Pro
export const API_KEY_STATUSES_DEFINITIONS = {
  [Model.GEMINI]: {isSet: true, envVarName: 'GEMINI_API_KEY (on proxy)', modelName: 'Gemini Flash', isMock: false, isGeminiPlatform: true},
  [Model.GEMINI_ADVANCED]: {isSet: true, envVarName: 'GEMINI_API_KEY (on proxy)', modelName: 'Gemini Advanced', isMock: false, isGeminiPlatform: true},
  [Model.GPT4O]: {isSet: true, envVarName: 'OPENAI_API_KEY (on proxy)', modelName: 'ChatGPT (gpt-4.1)', isMock: false, isGeminiPlatform: false},
  [Model.GPT4O_MINI]: {isSet: true, envVarName: 'OPENAI_API_KEY (on proxy)', modelName: 'ChatGPT (gpt-4.1-mini)', isMock: false, isGeminiPlatform: false},
  [Model.DEEPSEEK]: { isSet: true, envVarName: 'DEEPSEEK_API_KEY (on proxy)', modelName: 'Deepseek', isMock: false, isGeminiPlatform: false},
  [Model.CLAUDE]: { isSet: true, envVarName: 'N/A (Mock)', modelName: 'Claude', isMock: true, isGeminiPlatform: false},
  [Model.IMAGEN3]: {isSet: true, envVarName: 'GEMINI_API_KEY (on proxy)', modelName: 'Imagen3 Image Gen', isMock: false, isGeminiPlatform: true, isImageGeneration: true},
  [Model.OPENAI_TTS]: {isSet: true, envVarName: 'OPENAI_API_KEY (on proxy)', modelName: 'OpenAI TTS', isMock: false, isGeminiPlatform: false, isTextToSpeech: true },
  [Model.REAL_TIME_TRANSLATION]: {isSet: true, envVarName: 'GEMINI_API_KEY (on proxy)', modelName: 'Real-Time Translation (Gemini)', isMock: false, isGeminiPlatform: true, isRealTimeTranslation: true },
  [Model.ADVANCED_TOOLS]: {
    isSet: true,
    envVarName: 'N/A (Tool Suite)',
    modelName: 'Advanced Tools',
    isMock: true,
    isGeminiPlatform: false,
    isAdvancedTools: true,
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
    isSet: true,
    envVarName: 'FAL_KEY (on proxy)',
    modelName: 'Flux Kontext Image Edit',
    isMock: false,
    isGeminiPlatform: false,
    isImageEditing: true
  },
  [Model.FLUX_KONTEX_LORA]: {
    isSet: true,
    envVarName: 'FAL_KEY (on proxy)',
    modelName: 'Flux Kontext Lora',
    isMock: false,
    isGeminiPlatform: false,
    isImageEditing: true,
    isFluxKontexLora: true,
  },
  [Model.FLUX_KONTEX_MAX_MULTI]: {
    isSet: true,
    envVarName: 'FAL_KEY (on proxy)',
    modelName: 'Flux Kontext Max (Multi-Image Edit)',
    isMock: false,
    isGeminiPlatform: false,
    isImageEditing: false,
    isMultiImageEditing: true,
  },
  [Model.FLUX_ULTRA]: {
    isSet: true,
    envVarName: 'FAL_KEY (on proxy)',
    modelName: 'Flux Dev Image Gen',
    isMock: false,
    isGeminiPlatform: false,
    isFluxDevImageGeneration: true,
  },
  [Model.KLING_VIDEO]: {
    isSet: true,
    envVarName: 'FAL_KEY (on proxy)',
    modelName: 'Kling AI Video Gen',
    isMock: false,
    isGeminiPlatform: false,
    isKlingVideoGeneration: true,
  },
  [Model.WAN_I2V]: {
    isSet: true,
    envVarName: 'FAL_KEY (on proxy)',
    modelName: 'Wan I2V Video Gen',
    isMock: false,
    isGeminiPlatform: false,
    isWanI2vVideoGeneration: true,
  },
  [Model.WAN_I2V_V22]: {
    isSet: true,
    envVarName: 'FAL_KEY (on proxy)',
    modelName: 'Wan I2V v2.2 Video Gen',
    isMock: false,
    isGeminiPlatform: false,
    isWanI2vV22VideoGeneration: true,
  },
  [Model.TRADING_PRO]: {
    isSet: true, // Assuming proxy has necessary keys (Gemini for analysis)
    envVarName: 'GEMINI_API_KEY (on proxy)',
    modelName: 'Trading Analysis (gemini-2.5-flash)',
    isMock: false,
    isGeminiPlatform: true,
    isTradingPro: true,
  },
};
