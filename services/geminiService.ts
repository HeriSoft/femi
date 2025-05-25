
import { GoogleGenAI, Chat, GenerateContentResponse, Part as GenPart, Tool } from "@google/genai";
import { ModelSettings, Part, GroundingSource, GeminiChatState, ImagenSettings } from '../types.ts';

interface GeminiStreamChunk {
  textDelta?: string;
  groundingSources?: GroundingSource[];
  newChatState?: GeminiChatState;
  error?: string;
}

interface SendMessageParams {
  parts: Part[]; 
  modelSettings: ModelSettings;
  enableGoogleSearch: boolean;
  chatState: GeminiChatState | null;
  modelName: string; 
  apiKey: string; // API Key from Google AI Studio
}

interface GenerateImageParams {
  prompt: string;
  modelSettings: ImagenSettings;
  modelName: string; // e.g., 'imagen-3.0-generate-002'
  apiKey: string; // API Key from Google AI Studio
}

export async function* sendGeminiMessageStream(
  params: SendMessageParams
): AsyncGenerator<GeminiStreamChunk, void, undefined> {
  const { parts: appParts, modelSettings, enableGoogleSearch, chatState: currentChatState, modelName, apiKey } = params;

  if (!apiKey) {
    yield { error: "Gemini API Key (API_KEY) is not configured in config.js." };
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    let chat: Chat;
    let newChatStateForReturn: GeminiChatState | undefined = undefined;

    const tools: Tool[] = enableGoogleSearch ? [{googleSearch: {}}] : [];
    
    const currentConfigForChat = {
        systemInstruction: modelSettings.systemInstruction,
        temperature: modelSettings.temperature,
        topK: modelSettings.topK,
        topP: modelSettings.topP,
        tools: tools.length > 0 ? tools : undefined,
    };

    if (currentChatState?.chat &&
        currentChatState.currentModel === modelName &&
        currentChatState.currentSystemInstruction === modelSettings.systemInstruction &&
        currentChatState.currentTemperature === modelSettings.temperature &&
        currentChatState.currentTopK === modelSettings.topK &&
        currentChatState.currentTopP === modelSettings.topP
       ) {
      chat = currentChatState.chat;
    } else {
      chat = ai.chats.create({
        model: modelName, 
        config: currentConfigForChat
      });

      newChatStateForReturn = {
        chat: chat,
        currentModel: modelName,
        currentSystemInstruction: modelSettings.systemInstruction,
        currentTemperature: modelSettings.temperature,
        currentTopK: modelSettings.topK,
        currentTopP: modelSettings.topP,
      };
      yield { newChatState: newChatStateForReturn };
    }

    const sdkParts: GenPart[] = appParts.map(part => {
      if (part.text) return { text: part.text };
      if (part.inlineData) return { inlineData: { mimeType: part.inlineData.mimeType, data: part.inlineData.data }};
      return null; 
    }).filter(p => p !== null) as GenPart[];

    const streamResult = await chat.sendMessageStream({ message: sdkParts });

    for await (const chunk of streamResult) { 
      const textContent = chunk.text; 
      const groundingSources: GroundingSource[] = [];
      
      if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        chunk.candidates[0].groundingMetadata.groundingChunks.forEach(gc => {
          if (gc.web?.uri) { 
            groundingSources.push({ 
              uri: gc.web.uri, 
              title: gc.web.title || gc.web.uri 
            });
          }
        });
      }

      const chunkYield: GeminiStreamChunk = {};
      if (textContent) chunkYield.textDelta = textContent; 
      if (groundingSources.length > 0) chunkYield.groundingSources = groundingSources;

      if (Object.keys(chunkYield).length > 0) {
        yield chunkYield;
      }
    }
  } catch (error: any) {
    console.error("Gemini API Error (AI Studio Key):", error);
    let errorMessage = "An unexpected error occurred with the Gemini API.";
    if (error.message) {
        errorMessage = error.message;
    } else if (error.toString) {
        errorMessage = error.toString();
    }
    if (error.message && error.message.includes("API key not valid")) {
        errorMessage = "Gemini API key not valid. Please check the API_KEY in config.js and ensure it's active in Google AI Studio. Original: " + error.message;
    }
    yield { error: errorMessage };
  }
}

export async function generateImageWithImagen(
  params: GenerateImageParams
): Promise<{ imageBases64?: string[]; error?: string }> {
  const { prompt, modelSettings, modelName, apiKey } = params;

  if (!apiKey) {
    return { error: "Gemini API Key (API_KEY) for Imagen is not configured in config.js." };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const config: any = { 
        numberOfImages: Math.max(1, Math.min(4, modelSettings.numberOfImages || 1)),
        outputMimeType: modelSettings.outputMimeType || 'image/jpeg',
    };
    if (modelSettings.aspectRatio) {
        config.aspectRatio = modelSettings.aspectRatio;
    }

    const response = await ai.models.generateImages({
      model: modelName, 
      prompt: prompt,
      config: config,
    });

    // Log the full API response for debugging purposes by the user
    console.log("Imagen API Full Response:", JSON.stringify(response, null, 2));

    if (response.generatedImages && response.generatedImages.length > 0) {
      const imageBases64 = response.generatedImages.map(img => img.image.imageBytes);
      return { imageBases64: imageBases64 };
    } else {
      // Construct a more detailed error message
      let errorReason = "Unknown reason.";
      if (response && typeof response === 'object') {
        const anyResponse = response as any; // Cast to any to check for potential fields
        
        if (anyResponse.error && typeof anyResponse.error === 'object' && anyResponse.error.message) {
          errorReason = `API Error: ${anyResponse.error.message}`;
        } else if (anyResponse.error && typeof anyResponse.error === 'string') {
          errorReason = `API Error: ${anyResponse.error}`;
        }
        // Check for a structure similar to Gemini's promptFeedback for safety blocks
        // This is speculative for Imagen but follows Gemini patterns.
        else if (anyResponse.promptFeedback && anyResponse.promptFeedback.blockReason) {
          errorReason = `Prompt blocked due to: ${anyResponse.promptFeedback.blockReason}.`;
          if (anyResponse.promptFeedback.safetyRatings) {
            errorReason += ` Safety ratings: ${JSON.stringify(anyResponse.promptFeedback.safetyRatings)}`;
          }
        }
        else if (anyResponse.generatedImages && anyResponse.generatedImages.length === 0) {
            errorReason = "API returned an empty list of images. This might be due to safety filters, prompt restrictions, or other API-side issues.";
        }
        // Fallback to a generic message including part of the response for diagnosis
        else {
            const responsePreview = JSON.stringify(response).substring(0, 300); // Show a preview
            errorReason = `No images returned. API response (preview): ${responsePreview}`;
        }
      }
      
      const detailedError = `Image generation failed: ${errorReason}`;
      // Log the detailed error and full response to console for developer/user debugging
      console.error(detailedError, "Full API Response object for context:", response);
      return { error: detailedError };
    }

  } catch (error: any) {
    console.error("Imagen API Error (AI Studio Key) - Exception caught:", error);
    let errorMessage = "An unexpected error occurred with the Imagen API.";
     if (error.message) {
        errorMessage = error.message;
    }  else if (error.toString) {
        errorMessage = error.toString();
    }
     if (error.message && (error.message.includes("API key not valid") || error.message.includes("permission denied") || error.message.includes("Forbidden"))) {
        errorMessage = "Imagen API key not valid or permission denied. Please check the API_KEY in config.js and ensure it's active and correctly configured in Google AI Studio for image generation. Original error: " + error.message;
    }
    return { error: errorMessage };
  }
}
