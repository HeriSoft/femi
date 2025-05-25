import { Chat } from '@google/genai'; // Updated import

export enum Model {
  GEMINI = 'Gemini (gemini-2.5-flash-preview-05-20)', // Updated model identifier
  DEEPSEEK = 'Deepseek (deepseek-chat)', 
  GPT4O = 'ChatGPT (gpt-4o)', 
  CLAUDE = 'Claude (Mock)',
  GEMINI_ADVANCED = 'Gemini Advanced (gemini-1.5-pro-latest)',
  IMAGEN3 = 'Imagen3 (imagen-3.0-generate-002)',
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

export type AllModelSettings = {
  [key in Model]?: ModelSettings & Partial<ImagenSettings>; // Allow ImagenSettings to be mixed in
};

export interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export interface Part {
  text?: string;
  inlineData?: {
    mimeType: string;
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
}

export interface ApiKeyStatus {
  isSet: boolean;
  envVarName: string; 
  modelName: string; 
  isMock: boolean;
  isGeminiPlatform: boolean; // True if the model runs on Google's Gemini platform (AI Studio API Key)
  isImageGeneration?: boolean; // Flag for image generation models
  // Vertex specific flags removed
  // isVertex?: boolean; 
  // vertexProjectEnvVar?: string; 
  // vertexLocationEnvVar?: string; 
}

export interface SettingsPanelProps {
  selectedModel: Model;
  onModelChange: (model: Model) => void;
  modelSettings: ModelSettings & Partial<ImagenSettings>; // Include ImagenSettings
  onModelSettingsChange: (settings: Partial<ModelSettings & Partial<ImagenSettings>>) => void;
  onImageUpload: (file: File | null) => void;
  imagePreview: string | null; // For user uploaded image preview
  onFileUpload: (file: File | null) => void;
  uploadedTextFileName: string | null;
  isWebSearchEnabled: boolean;
  onWebSearchToggle: (enabled: boolean) => void;
  disabled?: boolean;
  apiKeyStatuses: Record<Model, ApiKeyStatus>;
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
  modelSettingsSnapshot: ModelSettings & Partial<ImagenSettings>; // Snapshot of settings for this session
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
}