

import { OpenAITtsSettings, OpenAiTtsVoice, UserSessionState } from '../types.ts';
import { OPENAI_TTS_MAX_INPUT_LENGTH } from '../constants.ts'; // Import the constant

// OpenAITtsParams will no longer include apiKey
export interface ProxiedOpenAITtsParams {
  modelIdentifier: 'tts-1' | 'tts-1-hd';
  textInput: string;
  voice: OpenAiTtsVoice;
  speed: number; // 0.25 to 4.0
  userSession: UserSessionState; // Added userSession
  responseFormat?: 'mp3' | 'opus' | 'aac' | 'flac'; // Default is mp3
}

export interface ProxiedOpenAISttParams {
    audioFile: File;
    userSession: UserSessionState;
}

export interface ProxiedOpenAISttResponse {
    transcription?: string;
    error?: string;
}

const MAX_TTS_CHUNK_LENGTH = 4000; // OpenAI's limit is 4096, use a slightly smaller value for safety.
const MAX_TOTAL_LENGTH = OPENAI_TTS_MAX_INPUT_LENGTH; // Use imported constant

async function fetchAudioChunk(
  params: Omit<ProxiedOpenAITtsParams, 'textInput'> & { textInputChunk: string }
): Promise<{ audioBlob?: Blob; error?: string }> {
  const {
    modelIdentifier,
    textInputChunk,
    voice,
    speed,
    userSession, // Destructure userSession here
    responseFormat = 'mp3',
  } = params;

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (userSession.isPaidUser && userSession.paidUserToken) {
    headers['X-Paid-User-Token'] = userSession.paidUserToken;
  } else if (userSession.isDemoUser && userSession.demoUserToken) {
    headers['X-Demo-Token'] = userSession.demoUserToken;
  }

  try {
    const response = await fetch('/api/openai/tts/generate', {
      method: 'POST',
      headers: headers, // Use the constructed headers
      body: JSON.stringify({
        modelIdentifier,
        textInput: textInputChunk,
        voice,
        speed,
        responseFormat,
      }),
    });

    if (!response.ok) {
      let errorDetail = `Error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorDetail = errorData.error?.message || errorData.error || errorDetail; // Prefer OpenAI's error message
      } catch (e) {
        // Failed to parse JSON error, use status text
      }
      return { error: `OpenAI TTS Proxy Error for chunk: ${errorDetail}` };
    }

    const audioBlob = await response.blob();
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
    console.error('OpenAI TTS Proxy Service Fetch Error for chunk:', error);
    return { error: `Fetch error for OpenAI TTS chunk via proxy: ${error.message || 'Unknown fetch error'}` };
  }
}

export async function generateOpenAITTS(
  params: ProxiedOpenAITtsParams
): Promise<{ audioBlob?: Blob; error?: string }> {
  const { textInput, ...commonParams } = params;

  if (!textInput.trim()) {
    return { error: "Text input cannot be empty for TTS." };
  }

  if (textInput.length > MAX_TOTAL_LENGTH) {
    return { error: `Text input exceeds maximum allowed length of ${MAX_TOTAL_LENGTH} characters.` };
  }

  if (textInput.length <= MAX_TTS_CHUNK_LENGTH) {
    // If text is short enough, process as a single chunk
    return fetchAudioChunk({ ...commonParams, textInputChunk: textInput });
  }

  // Split text into chunks
  const chunks: string[] = [];
  let currentPosition = 0;
  while (currentPosition < textInput.length) {
    let endPosition = currentPosition + MAX_TTS_CHUNK_LENGTH;
    if (endPosition < textInput.length) {
      // Try to find a sentence break near the limit
      let sentenceBreak = textInput.lastIndexOf('.', endPosition);
      if (sentenceBreak < currentPosition) sentenceBreak = textInput.lastIndexOf('?', endPosition);
      if (sentenceBreak < currentPosition) sentenceBreak = textInput.lastIndexOf('!', endPosition);
      if (sentenceBreak < currentPosition) sentenceBreak = textInput.lastIndexOf('\n', endPosition);
      
      // If a good break is found within reasonable distance, use it
      if (sentenceBreak > currentPosition && sentenceBreak < endPosition) {
        endPosition = sentenceBreak + 1;
      }
    }
    chunks.push(textInput.substring(currentPosition, Math.min(endPosition, textInput.length)));
    currentPosition = Math.min(endPosition, textInput.length);
  }

  const audioBlobs: Blob[] = [];
  for (const chunk of chunks) {
    if (!chunk.trim()) continue; // Skip empty chunks if any

    const result = await fetchAudioChunk({ ...commonParams, textInputChunk: chunk });
    if (result.error || !result.audioBlob) {
      return { error: result.error || "Failed to generate audio for a part of the text." };
    }
    audioBlobs.push(result.audioBlob);
  }

  if (audioBlobs.length === 0) {
    return { error: "No audio data generated from chunks." };
  }

  // Concatenate blobs
  // Ensure all blobs have a type, default to the first blob's type or 'audio/mpeg'
  const mimeType = audioBlobs[0]?.type || (params.responseFormat === 'mp3' ? 'audio/mpeg' : `audio/${params.responseFormat || 'mpeg'}`);
  const combinedBlob = new Blob(audioBlobs, { type: mimeType });

  return { audioBlob: combinedBlob };
}

export async function transcribeOpenAIAudio(params: ProxiedOpenAISttParams): Promise<ProxiedOpenAISttResponse> {
    const { audioFile, userSession } = params;

    const formData = new FormData();
    formData.append('audio_file', audioFile);
    
    const headers: HeadersInit = {};
    if (userSession.isPaidUser && userSession.paidUserToken) {
        headers['X-Paid-User-Token'] = userSession.paidUserToken;
    } else if (userSession.isDemoUser && userSession.demoUserToken) {
        headers['X-Demo-Token'] = userSession.demoUserToken;
    }

    try {
        const response = await fetch('/api/openai/stt/transcribe', {
            method: 'POST',
            headers: headers,
            body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
            return { error: result.error || `OpenAI STT Proxy Error: ${response.statusText}` };
        }

        return { transcription: result.transcription };

    } catch (error: any) {
        console.error('OpenAI STT Proxy Service Fetch Error:', error);
        return { error: `Fetch error for OpenAI STT via proxy: ${error.message || 'Unknown fetch error'}` };
    }
}