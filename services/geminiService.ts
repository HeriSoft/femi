
import { ModelSettings, Part, GroundingSource, GeminiChatState, ImagenSettings } from '../types.ts';
import type { Content, GenerateImagesResponse } from "@google/genai"; // Only for type if needed, not direct use

// Interface for the chunk structure expected from the proxy's Gemini stream
interface GeminiProxyStreamChunk {
  textDelta?: string;
  groundingSources?: GroundingSource[];
  imagePart?: { // New field for image data from multimodal chat models
    mimeType: string;
    data: string; // base64 encoded
  };
  error?: string;
}

interface SendMessageParams {
  historyContents: Content[]; // Full conversation history including current prompt
  modelSettings: ModelSettings;
  enableGoogleSearch: boolean;
  modelName: string;
  // apiKey parameter removed
}

interface GenerateImageParams {
  prompt: string;
  modelSettings: ImagenSettings;
  modelName: string; // e.g., 'imagen-3.0-generate-002'
  // apiKey parameter removed
}

export async function* sendGeminiMessageStream(
  params: SendMessageParams
): AsyncGenerator<GeminiProxyStreamChunk, void, undefined> {
  const { historyContents, modelSettings, enableGoogleSearch, modelName } = params;

  try {
    const response = await fetch('/api/gemini/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        modelName,
        historyContents,
        modelSettings,
        enableGoogleSearch,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
      yield { error: errorData.error || `Gemini proxy request failed: ${response.statusText}` };
      return;
    }

    if (!response.body) {
      yield { error: "Proxy response for Gemini stream has no body." };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
        const line = buffer.substring(0, newlineIndex);
        buffer = buffer.substring(newlineIndex + 1);
        if (line.trim()) {
          try {
            const chunk = JSON.parse(line) as GeminiProxyStreamChunk;
            yield chunk;
          } catch (e) {
            console.error("Failed to parse Gemini stream chunk from proxy:", e, line);
            yield { error: "Malformed chunk from proxy." };
          }
        }
      }
    }
     // Process any remaining buffer content if stream ends without a newline
    if (buffer.trim()) {
        try {
            const chunk = JSON.parse(buffer) as GeminiProxyStreamChunk;
            yield chunk;
        } catch (e) {
            console.error("Failed to parse final Gemini stream chunk from proxy:", e, buffer);
            yield { error: "Malformed final chunk from proxy." };
        }
    }

  } catch (error: any) {
    console.error("Error calling Gemini proxy service:", error);
    yield { error: `Network or unexpected error calling Gemini proxy: ${error.message}` };
  }
}

export async function generateImageWithImagen(
  params: GenerateImageParams
): Promise<{ imageBases64?: string[]; error?: string, rawResponse?: GenerateImagesResponse }> {
  const { prompt, modelSettings, modelName } = params;

  try {
    const response = await fetch('/api/gemini/image/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, modelSettings, modelName }),
    });

    const data: GenerateImagesResponse & { error?: string } = await response.json();

    if (!response.ok || data.error) {
      return { error: data.error || `Imagen proxy request failed: ${response.statusText}` };
    }
    
    // The proxy forwards the Imagen SDK response directly.
    // We need to extract imageBytes from the 'image' property of each generatedImage.
    if (data.generatedImages && data.generatedImages.length > 0) {
      const imageBases64 = data.generatedImages.map(img => img.image.imageBytes);
      return { imageBases64, rawResponse: data };
    } else {
       // Check for detailed error in the raw response if no images.
       // Based on the original Imagen service, specific error feedback might be in other parts of the response.
       // The proxy server's error handling or the structure of `data` from proxy might include details.
       let errorReason = "API returned no images. This could be due to safety filters or prompt issues. Check console for details from proxy.";
       if (data.error) { // if proxy added specific error message
           errorReason = data.error;
       }
       // It seems `promptFeedback` isn't directly on GenerateImagesResponse anymore,
       // so direct client-side interpretation of detailed block reasons from the raw response is complex.
       // The proxy error message should be the primary source of error info.
       console.error("Imagen generation via proxy problem:", errorReason, "Full response from proxy:", data);
       return { error: errorReason, rawResponse: data };
    }

  } catch (error: any) {
    console.error("Error calling Imagen proxy service:", error);
    return { error: `Network or unexpected error calling Imagen proxy: ${error.message}` };
  }
}