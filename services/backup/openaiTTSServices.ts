
import { OpenAITtsSettings, OpenAiTtsVoice } from '../types.ts';

const OPENAI_TTS_API_URL = 'https://api.openai.com/v1/audio/speech';

export interface OpenAITtsParams {
  apiKey: string;
  modelIdentifier: 'tts-1' | 'tts-1-hd';
  textInput: string;
  voice: OpenAiTtsVoice;
  speed: number; // 0.25 to 4.0
  responseFormat?: 'mp3' | 'opus' | 'aac' | 'flac'; // Default is mp3
}

export async function generateOpenAITTS(
  params: OpenAITtsParams
): Promise<{ audioBlob?: Blob; error?: string }> {
  const {
    apiKey,
    modelIdentifier,
    textInput,
    voice,
    speed,
    responseFormat = 'mp3',
  } = params;

  if (!apiKey) {
    return { error: "OpenAI API Key (VITE_OPENAI_API_KEY) is not configured." };
  }
  if (!textInput.trim()) {
    return { error: "Text input cannot be empty for TTS." };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  const body = {
    model: modelIdentifier,
    input: textInput,
    voice: voice,
    speed: Math.max(0.25, Math.min(4.0, speed)), // Clamp speed
    response_format: responseFormat,
  };

  try {
    const response = await fetch(OPENAI_TTS_API_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errorDetail = `Error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorDetail = errorData.error?.message || errorDetail;
      } catch (e) {
        // Failed to parse JSON error, use status text
      }
      return { error: `OpenAI TTS API Error: ${errorDetail}` };
    }

    const audioBlob = await response.blob();
    if (audioBlob.type.startsWith('application/json')) {
        // This means an error occurred but was returned with 200 OK and JSON body somehow
        try {
            const errorText = await audioBlob.text();
            const errorData = JSON.parse(errorText);
            return { error: `OpenAI TTS API Error (unexpected JSON response): ${errorData.error?.message || errorText}` };
        } catch (e) {
            return { error: `OpenAI TTS API Error: Received JSON error, but failed to parse it.` };
        }
    }


    return { audioBlob };

  } catch (error: any) {
    console.error('OpenAI TTS Service Fetch Error:', error);
    return { error: `Fetch error for OpenAI TTS: ${error.message || 'Unknown fetch error'}` };
  }
}
