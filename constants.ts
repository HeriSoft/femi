
import { Model, AllModelSettings, ModelSettings, ImagenSettings, LanguageOptionConfig, Badge, UserLanguageProfile, LanguageOption, RealTimeTranslationSettings, TranslationLanguageOptionConfig, OpenAITtsSettings, AccountTabType, BackgroundOption, CardSuit, CardRank, AiAgentSmartSettings, CreditPackage, PrivateModeSettings, FluxKontexSettings, FluxKontexAspectRatio, DemoUserLimits, PaidUserLimits, FluxUltraSettings, FluxUltraAspectRatio, KlingAiSettings, KlingAiDuration, KlingAiAspectRatio, ModelSpecificSettingsMap, TradingProSettings, TradingPair } from './types.ts';

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
};

export const DEFAULT_REAL_TIME_TRANSLATION_SETTINGS: RealTimeTranslationSettings = {
  targetLanguage: 'en',
};

export const DEFAULT_AI_AGENT_SMART_SETTINGS: AiAgentSmartSettings = {
  ...DEFAULT_MODEL_SETTINGS,
  temperature: 0.5,
  topK: 32,
  systemInstruction: `[Tên và Vai trò]
AI-Agent Smart (AAS), một trợ lý đàm thoại thông minh và thân thiện cho một ứng dụng web/di động chuyên về tìm kiếm và điều hướng địa điểm địa phương.

[Mục tiêu Chính]
Mục tiêu chính là đóng vai trò giao diện hội thoại, hiểu rõ nhu cầu của người dùng thông qua văn bản và thông tin từ hình ảnh (được hệ thống cung cấp), cung cấp thông tin về các địa điểm phù hợp gần vị trí của họ và hỗ trợ họ di chuyển đến đó một cách hiệu quả.
Khi bắt đầu cuộc trò chuyện, nếu hệ thống đã cung cấp vị trí của người dùng, hãy xác nhận với họ rằng bạn đã biết vị trí đó (ví dụ: "Chào bạn, tôi đã biết vị trí của bạn là [tên vị trí nếu có, hoặc chỉ là 'vị trí hiện tại của bạn']...")

[Các API Liên Quan (Được Hệ thống Backend Sử dụng)]
Ứng dụng mà bạn là một phần sử dụng các API sau để thu thập dữ liệu và thực hiện hành động. Quan trọng: Với vai trò là AI Agent, AI Gemini không trực tiếp gọi các API này. Hệ thống backend sẽ thực hiện việc gọi API và cung cấp kết quả cho bạn để bạn xử lý và phản hồi người dùng.
- Geolocation API (Trình duyệt/Thiết bị): Dùng để lấy vị trí chính xác của người dùng (vĩ độ, kinh độ) từ trình duyệt hoặc thiết bị. Vị trí này được hệ thống cung cấp cho AI.
- Gemini Vision: Được sử dụng bởi backend để phân tích hình ảnh người dùng tải lên.
- Google Places API (Google Maps Platform): Dùng để tìm kiếm các địa điểm.
- Google Directions API (Google Maps Platform): Dùng để tính toán và cung cấp hướng dẫn di chuyển.
- Google Geocoding API (Google Maps Platform - Tùy chọn): Dùng để chuyển đổi địa chỉ/tên địa điểm thành tọa độ.

[Vai trò của AI-Agent Smart (AAS) trong Triển khai]
- Lớp giao tiếp (Conversational Layer) giữa người dùng và các API địa lý/hình ảnh (thông qua hệ thống backend).
- Input: Tin nhắn văn bản từ người dùng và các "Thông báo Hệ thống" (System Notes) cung cấp thông tin về vị trí người dùng, kết quả phân tích ảnh, kết quả tìm kiếm địa điểm, v.v.
- Output: Phản hồi bằng văn bản cho người dùng và các "Chỉ dẫn Hệ thống" (System Instructions) để hệ thống backend biết cần làm gì tiếp theo (ví dụ: "Người dùng muốn tìm quán phở", "Sử dụng từ khóa 'iPhone 15' và vị trí người dùng để tìm cửa hàng", "Người dùng đã xác nhận địa điểm X, cần chỉ đường").
  ĐỊNH DẠNG OUTPUT ĐẶC BIỆT:
  - Khi bạn đang thực hiện một hành động nền (ví dụ: tìm kiếm vị trí, phân tích ảnh), hãy thông báo cho người dùng bằng cách sử dụng: (( System: [Mô tả hành động của bạn]... ))
    Ví dụ: (( System: Đang tìm kiếm vị trí của bạn... )) hoặc (( System: Đang phân tích hình ảnh bạn cung cấp... ))
  - Khi hiển thị thông tin chi tiết về một địa điểm, hãy sử dụng các tiền tố sau trên các dòng riêng biệt:
    ĐỊA ĐIỂM: [Tên địa điểm]
    ĐỊA CHỈ: [Địa chỉ]
    GIÁ: [Thông tin giá cả, ví dụ: 20.000đ - 50.000đ, hoặc 'Chưa rõ']
    KM: [Khoảng cách, ví dụ: 1.2 km, hoặc 'Chưa rõ']
    ĐÁNH GIÁ: [Đánh giá, ví dụ: 4.5 sao, hoặc 'Chưa có đánh giá']
  - Khi bạn muốn hệ thống hiển thị một nút hành động cho người dùng, hãy sử dụng định dạng: [BUTTON:Tên Nút Hiển Thị:MãHànhĐộng]
    Ví dụ: [BUTTON:Chỉ đường đến đây:NAVIGATE_PLACE_XYZ] hoặc [BUTTON:Xem thêm chi tiết:VIEW_DETAILS_ABC]

[Khả năng và Logic Tương tác Chính]
Xử lý các tình huống dựa trên input nhận được:
1. Bắt đầu: Chào hỏi người dùng. Nếu "Thông báo Hệ thống" cung cấp vị trí, hãy xác nhận điều đó. Hỏi họ cần tìm gì.
   Ví dụ: "Chào bạn, tôi đã biết vị trí của bạn. Bạn muốn tìm gì hôm nay?" hoặc "Chào bạn, bạn muốn tìm địa điểm nào hôm nay? Bạn có thể cho tôi biết vị trí hiện tại của bạn không?" (nếu vị trí chưa được cung cấp).
   (( System: Đang chờ vị trí người dùng (nếu chưa có)... ))

2. Xử lý Yêu cầu Văn bản:
   - Nhận yêu cầu văn bản (ví dụ: "tìm quán cà phê yên tĩnh").
   - Xác nhận yêu cầu. Nếu cần, hỏi thêm chi tiết.
   - (( System: Đang tìm kiếm '[yêu cầu]' dựa trên vị trí của bạn... ))
   - Gửi "Chỉ dẫn Hệ thống" cho backend. Ví dụ: "Tìm kiếm 'quán cà phê yên tĩnh' gần [vị trí người dùng]."
   - Chờ "Thông báo Hệ thống về Kết quả Tìm kiếm Địa điểm".
   - Diễn giải kết quả. Nếu có địa điểm, trình bày dùng các tiền tố định dạng. Hỏi có muốn chỉ đường không.
     Ví dụ: "Tôi đã tìm được một số quán cà phê gần bạn:\nĐỊA ĐIỂM: The Coffee House\nĐỊA CHỈ: 123 Nguyễn Văn Linh\nKM: 0.5 km\nĐÁNH GIÁ: 4.2 sao\n[BUTTON:Chỉ đường đến The Coffee House:NAVIGATE_THE_COFFEE_HOUSE]"

3. Xử lý Tải ảnh:
   - Nhận "Thông báo Hệ thống về Tải ảnh".
   - Thông báo: "Tôi đã nhận được ảnh của bạn."
   - (( System: Đang phân tích hình ảnh... ))
   - Chờ "Thông báo Hệ thống về Kết quả Phân tích Ảnh".

4. Xử lý Kết quả Phân tích Ảnh:
   - Nhận "Thông báo Hệ thống về Kết quả Phân tích Ảnh" (ví dụ: "Ảnh chứa: 'một tô phở', 'logo Highland Coffee'").
   - Nếu nhận diện được tên cụ thể: "Tôi thấy bạn đã tải lên ảnh có 'logo Highland Coffee'. Bạn có muốn tôi tìm các cửa hàng Highland Coffee gần đây không?"
     (( System: Chờ xác nhận của người dùng để tìm 'Highland Coffee'... ))
   - Nếu nhận diện chung chung: "Tôi thấy trong ảnh là một nhà thờ có kiến trúc rất đẹp. Bạn có thể cho tôi biết nó ở gần địa danh nổi tiếng nào không?"
     (( System: Chờ người dùng cung cấp thêm thông tin về vị trí của đối tượng trong ảnh... ))

5. Xử lý Gợi ý Địa lý từ Người dùng:
   - Nhận gợi ý khu vực (ví dụ: "nó gần chợ Cồn").
   - Xác nhận: "Ok, tôi sẽ tìm các [loại địa điểm từ ảnh, nếu có] gần chợ Cồn."
   - (( System: Đang tìm kiếm gần 'chợ Cồn'... ))
   - Gửi "Chỉ dẫn Hệ thống". Chờ kết quả và xử lý.

6. Hỗ trợ Chỉ đường:
   - Khi người dùng yêu cầu chỉ đường.
   - Gửi "Chỉ dẫn Hệ thống": "Tạo chỉ đường đến [Tên địa điểm] tại [Địa chỉ/Tọa độ]".
   - Thông báo: "Ok, tôi đã chuẩn bị chỉ đường cho bạn. [BUTTON:Xem chỉ đường đến [Tên địa điểm]:NAVIGATE_PLACE_XYZ]"

[Lưu ý Quan trọng]
- Luôn thân thiện, lịch sự và chủ động.
- Sử dụng các định dạng (( System: ... )), tiền tố địa điểm, và [BUTTON:...] như đã hướng dẫn.
- Bạn KHÔNG trực tiếp gọi API.
`,
};


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

export const DEFAULT_FLUX_ULTRA_SETTINGS: FluxUltraSettings = {
  aspect_ratio: '16:9',
  num_inference_steps: 28,
  seed: null,
  guidance_scale: 3.5,
  num_images: 1,
  enable_safety_checker: true,
  output_format: 'jpeg',
};

export const DEFAULT_KLING_AI_SETTINGS: KlingAiSettings = {
  duration: "5" as KlingAiDuration,
  aspect_ratio: "16:9" as KlingAiAspectRatio,
  negative_prompt: "blur, distort, and low quality",
  cfg_scale: 0.5,
};

export const DEFAULT_TRADING_PRO_SETTINGS: TradingProSettings = {
  selectedPair: null,
};


const GENERIC_FILE_HANDLING_INSTRUCTION = `
FILE HANDLING:
- If the user's message includes a system note like "(System Note: User uploaded a file named '[filename]'. Its content is not directly available to you...)", it means the user attached a file (e.g., PDF, DOCX) whose content cannot be read by you directly.
- In this situation:
    1. Acknowledge the file by its name if relevant to the conversation.
    2. Politely explain that you cannot access or process the internal content of such files.
    3. Suggest that the user copy and paste the text from the file, summarize it, or ask specific questions about it if they want you to work with its information.
- If the user uploads a plain text file (like .txt, .md) or an image, its content *may* be directly included in their message for you to process. Use this embedded content if available.
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
  [Model.AI_AGENT_SMART]: { ...DEFAULT_AI_AGENT_SMART_SETTINGS },
  [Model.PRIVATE]: { ...DEFAULT_PRIVATE_MODE_SETTINGS },
  [Model.FLUX_KONTEX]: { ...DEFAULT_FLUX_KONTEX_SETTINGS },
  [Model.FLUX_KONTEX_MAX_MULTI]: { ...DEFAULT_FLUX_KONTEX_SETTINGS, num_images: 2 },
  [Model.FLUX_ULTRA]: { ...DEFAULT_FLUX_ULTRA_SETTINGS },
  [Model.KLING_VIDEO]: { ...DEFAULT_KLING_AI_SETTINGS },
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


export const DEMO_USER_DEFAULT_MONTHLY_LIMITS = {
  FLUX_KONTEX_MAX_MONTHLY: 0,
  FLUX_KONTEX_PRO_MONTHLY: 1,
  IMAGEN3_MONTHLY_IMAGES: 5,
  OPENAI_TTS_MONTHLY_CHARS: 10000,
  FLUX_ULTRA_MONTHLY_IMAGES: 0,
  KLING_VIDEO_MONTHLY_MAX_USES: 0,
};

export const INITIAL_DEMO_USER_LIMITS: DemoUserLimits = {
  fluxKontextMaxMonthlyUsesLeft: DEMO_USER_DEFAULT_MONTHLY_LIMITS.FLUX_KONTEX_MAX_MONTHLY,
  fluxKontextMaxMonthlyMaxUses: DEMO_USER_DEFAULT_MONTHLY_LIMITS.FLUX_KONTEX_MAX_MONTHLY,
  fluxKontextProMonthlyUsesLeft: DEMO_USER_DEFAULT_MONTHLY_LIMITS.FLUX_KONTEX_PRO_MONTHLY,
  fluxKontextProMonthlyMaxUses: DEMO_USER_DEFAULT_MONTHLY_LIMITS.FLUX_KONTEX_PRO_MONTHLY,
  imagen3MonthlyImagesLeft: DEMO_USER_DEFAULT_MONTHLY_LIMITS.IMAGEN3_MONTHLY_IMAGES,
  imagen3MonthlyMaxImages: DEMO_USER_DEFAULT_MONTHLY_LIMITS.IMAGEN3_MONTHLY_IMAGES,
  openaiTtsMonthlyCharsLeft: DEMO_USER_DEFAULT_MONTHLY_LIMITS.OPENAI_TTS_MONTHLY_CHARS,
  openaiTtsMonthlyMaxChars: DEMO_USER_DEFAULT_MONTHLY_LIMITS.OPENAI_TTS_MONTHLY_CHARS,
  fluxUltraMonthlyImagesLeft: DEMO_USER_DEFAULT_MONTHLY_LIMITS.FLUX_ULTRA_MONTHLY_IMAGES,
  fluxUltraMonthlyMaxImages: DEMO_USER_DEFAULT_MONTHLY_LIMITS.FLUX_ULTRA_MONTHLY_IMAGES,
  klingVideoMonthlyUsed: 0,
  klingVideoMonthlyMaxUses: DEMO_USER_DEFAULT_MONTHLY_LIMITS.KLING_VIDEO_MONTHLY_MAX_USES,
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
  fluxUltraMonthlyImagesLeft: 0,
  fluxUltraMonthlyMaxImages: 30,
  klingVideoMonthlyUsed: 0,
  klingVideoMonthlyMaxGenerations: 1,
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

// Flux Ultra Aspect Ratio Options
export const FLUX_ULTRA_ASPECT_RATIOS: { value: FluxUltraAspectRatio; label: string }[] = [
  { value: '16:9', label: '16:9 (Widescreen)' },
  { value: '1:1', label: '1:1 (Square)' },
  { value: '4:3', label: '4:3 (Standard)' },
  { value: '3:2', label: '3:2 (Photo)' },
  { value: '21:9', label: '21:9 (Ultra Wide)' },
  { value: '2:3', label: '2:3 (Tall Photo)' },
  { value: '3:4', label: '3:4 (Portrait)' },
  { value: '9:16', label: '9:16 (Tall Screen)' },
  { value: '9:21', label: '9:21 (Ultra Tall)' },
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

// Trading Pro Constants
export const TRADING_PRO_DISCLAIMER = `Mô hình này dựa trên kiến thức, kinh nghiệm, kỹ năng phân tích của AI để mang lại cái nhìn tổng quan chính xác và thực tế của thị trường giao dịch Crypto hoặc Vàng thế giới.\n\nĐây KHÔNG phải lời khuyên đầu tư. Chúng tôi KHÔNG đảm bảo mang lại lợi nhuận cho nhà đầu tư. Bạn phải thực sự cẩn trọng trong mọi quyết định đầu tư và quản lý vốn hiệu quả nếu bạn có ý định tham gia thị trường.\n\nChúng tôi sẽ KHÔNG chịu mọi trách nhiệm về tổn thất nếu bạn thua lỗ hoặc gặp rủi ro.`;

export const TRADING_PRO_PAIRS: TradingPair[] = [
  {
    value: 'XAUUSD',
    label: 'XAU/USD (Gold)',
    alphaVantageFunction: 'TIME_SERIES_DAILY', // Changed from FX_DAILY
    alphaVantageSymbol: 'GOLD', // Using a common symbol for Gold, actual might vary for AV
    outputsize: 'compact' // Added outputsize for daily functions
  },
  {
    value: 'BTCUSD',
    label: 'BTC/USD (Bitcoin)',
    alphaVantageSymbol: 'BTC',
    alphaVantageMarket: 'USD',
    alphaVantageFunction: 'DIGITAL_CURRENCY_DAILY',
    outputsize: 'compact' // Added outputsize for daily functions
  },
];

export const ALPHA_VANTAGE_API_KEY = 'N9STQCJB0YIWCCV1';
