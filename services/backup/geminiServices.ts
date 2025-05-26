
import { GoogleGenAI, Chat, GenerateContentResponse, Part as GenPart, Tool, GenerateImagesResponse } from "@google/genai";
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
        currentChatState.currentTopP === modelSettings.topP &&
        currentChatState.currentEnableWebSearch === enableGoogleSearch // Check if web search status has changed
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
        currentEnableWebSearch: enableGoogleSearch, // Store current web search status
      };
      yield { newChatState: newChatStateForReturn };
    }

    const sdkParts: GenPart[] = appParts.map(part => {
      if (part.text) return { text: part.text };
      if (part.inlineData) return { inlineData: { mimeType: part.inlineData.mimeType, data: part.inlineData.data }};
      return null; 
    }).filter(p => p !== null) as GenPart[];

    // The 'message' key seems to be an accepted way to pass current turn's parts for chat.
    // The Chat object is already initialized with the correct tools setting if it was re-created.
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

    // Log the full request for debugging
    console.log("Imagen API Request:", { model: modelName, prompt: prompt, config: config });
    const response: GenerateImagesResponse = await ai.models.generateImages({
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
      // FIX: Removed direct access to response.promptFeedback as it no longer exists on GenerateImagesResponse.
      // The API might return an empty generatedImages array for various reasons, including safety filters or prompt issues.
      // Specific block reasons or detailed safety feedback previously available via `promptFeedback` must now be exposed
      // or may not be exposed directly in the same way by the SDK if images are not generated.
      // Users should inspect the full API response logged to the console for any available details.
      let errorReason = "API returned no images. This could be due to safety filters, an issue with the prompt, or other API processing reasons. Please try modifying your prompt or check the console for the full API response details.";
      
      const detailedError = `Image generation failed: ${errorReason}`;
      // Log the actual 'response' object. If the user's console shows [object Object],
      // they need to expand it in their browser's developer tools.
      console.error(detailedError, "Full API Response object for context (expand in console to inspect):", response);
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
    } else if (error.message && error.message.includes("billed users")) {
        errorMessage = "Imagen API is only accessible to billed users at this time. Please ensure billing is enabled for the Google Cloud Project associated with your API key. Original error: " + error.message;
    }
    return { error: errorMessage };
  }
}
