
import { OpenAITtsSettings, OpenAiTtsVoice } from '../types.ts';

// OpenAITtsParams will no longer include apiKey
export interface ProxiedOpenAITtsParams {
  modelIdentifier: 'tts-1' | 'tts-1-hd';
  textInput: string;
  voice: OpenAiTtsVoice;
  speed: number; // 0.25 to 4.0
  responseFormat?: 'mp3' | 'opus' | 'aac' | 'flac'; // Default is mp3
}

export async function generateOpenAITTS(
  params: ProxiedOpenAITtsParams // Updated params type
): Promise<{ audioBlob?: Blob; error?: string }> {
  const {
    modelIdentifier,
    textInput,
    voice,
    speed,
    responseFormat = 'mp3',
  } = params;

  if (!textInput.trim()) {
    return { error: "Text input cannot be empty for TTS." };
  }

  try {
    const response = await fetch('/api/openai/tts/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        modelIdentifier,
        textInput,
        voice,
        speed,
        responseFormat,
      }),
    });

    if (!response.ok) {
      let errorDetail = `Error: ${response.status} ${response.statusText}`;
      try {
        // Try to parse error from proxy, which should forward OpenAI's error structure
        const errorData = await response.json();
        errorDetail = errorData.error || errorDetail;
      } catch (e) {
        // Failed to parse JSON error, use status text
      }
      return { error: `OpenAI TTS Proxy Error: ${errorDetail}` };
    }

    const audioBlob = await response.blob();
     // Check if the blob is actually JSON, indicating an error was returned with a 200 OK by mistake
    if (audioBlob.type.startsWith('application/json')) {
        try {
            const errorText = await audioBlob.text();
            const errorData = JSON.parse(errorText);
            return { error: `OpenAI TTS API Error (via proxy, unexpected JSON): ${errorData.error?.message || errorText}` };
        } catch (e) {
            return { error: `OpenAI TTS API Error (via proxy): Received JSON error, but failed to parse it.` };
        }
    }

    return { audioBlob };

  } catch (error: any) {
    console.error('OpenAI TTS Proxy Service Fetch Error:', error);
    return { error: `Fetch error for OpenAI TTS via proxy: ${error.message || 'Unknown fetch error'}` };
  }
}
