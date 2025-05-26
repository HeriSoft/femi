
import { Model, AllModelSettings, ModelSettings, ImagenSettings } from './types.ts'; // Update to .ts

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

export const ALL_MODEL_DEFAULT_SETTINGS: AllModelSettings = {
  [Model.GEMINI]: { ...DEFAULT_MODEL_SETTINGS, systemInstruction: 'You are a helpful and creative AI assistant powered by Gemini Flash.' },
  [Model.GEMINI_ADVANCED]: { ...DEFAULT_MODEL_SETTINGS, systemInstruction: 'You are Gemini Advanced, a powerful multimodal AI by Google.' },
  [Model.GPT4O]: { ...DEFAULT_MODEL_SETTINGS, systemInstruction: 'You are ChatGPT (gpt-4o), a powerful AI by OpenAI.' }, 
  [Model.DEEPSEEK]: { ...DEFAULT_MODEL_SETTINGS, systemInstruction: 'You are Deepseek Coder, an AI specialized in coding and chat, powered by the deepseek-chat model.' },
  [Model.CLAUDE]: { ...DEFAULT_MODEL_SETTINGS, systemInstruction: 'You are Claude, a helpful AI assistant by Anthropic.' },
  [Model.IMAGEN3]: { 
    ...DEFAULT_MODEL_SETTINGS, // Inherit base settings, though most won't apply
    ...DEFAULT_IMAGEN_SETTINGS, // Apply Imagen specific defaults
    systemInstruction: 'Image generation prompt.', // Placeholder, not really used as a "system instruction" by Imagen
  },
};
 
export const LOCAL_STORAGE_SETTINGS_KEY = 'femiAiChatSettings';
export const LOCAL_STORAGE_HISTORY_KEY = 'femiAiChatHistory';
export const LOCAL_STORAGE_PERSONAS_KEY = 'femiAiChatPersonas';
export const LOCAL_STORAGE_NOTIFICATIONS_KEY = 'femiAiNotifications';
export const MAX_NOTIFICATIONS = 50; // Max notifications to store
