
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch'; // For OpenAI/Deepseek
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai'; // Assuming these are needed from SDK
import { fal } from '@fal-ai/client'; // Import fal.ai client

// Define DEFAULT_FLUX_KONTEX_SETTINGS directly to avoid import issues
const DEFAULT_FLUX_KONTEX_SETTINGS = {
  guidance_scale: 7.5,
  safety_tolerance: 5,
  num_inference_steps: 30,
  seed: null, 
  num_images: 1,
  aspect_ratio: 'Original',
};

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// CORS configuration
const rawCORSOrigins = process.env.CORS_ALLOWED_ORIGINS;
// Ensure rawCORSOrigins is treated as a string before splitting, even if it's undefined.
const allowedOrigins = rawCORSOrigins ? String(rawCORSOrigins).split(',').map(o => o.trim()) : [];
console.log('[CORS Config] Raw CORS_ALLOWED_ORIGINS env var from process.env:', rawCORSOrigins);
console.log('[CORS Config] Parsed allowedOrigins array:', allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    // Log details for every CORS check
    console.log(`[CORS Check] Request origin: '${origin}'. Allowed origins list: [${allowedOrigins.join(', ')}]`);

    // Allow requests with no origin (like mobile apps or curl requests, or server-to-server)
    if (!origin) {
      console.log('[CORS Check] No origin provided with the request. Allowing.');
      return callback(null, true);
    }
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      console.log(`[CORS Check] Origin '${origin}' IS in the allowed list. Allowing.`);
      return callback(null, true);
    }
    console.error(`[CORS Check] Origin '${origin}' IS NOT in the allowed list. Blocking due to CORS policy.`);
    return callback(new Error('Not allowed by CORS'));
  }
}));

// Middleware to parse JSON bodies - INCREASED LIMIT
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true })); // Also for form data if ever needed

// --- Authentication ---
const LOGIN_CODE_AUTH_SERVER = process.env.LOGIN_CODE_AUTH;
if (!LOGIN_CODE_AUTH_SERVER) {
    console.warn("PROXY WARNING: LOGIN_CODE_AUTH not found in process.env. Simple login will not function.");
} else {
    console.log("LOGIN_CODE_AUTH is SET on proxy server.");
}

app.post('/api/auth/verify-code', (req, res) => {
    const { code } = req.body;
    if (!LOGIN_CODE_AUTH_SERVER) {
        return res.status(500).json({ success: false, message: "Login feature not configured on the server." });
    }
    if (code && code === LOGIN_CODE_AUTH_SERVER) {
        return res.json({ success: true, message: "Login successful." });
    } else {
        return res.status(401).json({ success: false, message: "Invalid login code." });
    }
});


// --- GEMINI API PROXY ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let ai; // GoogleGenAI instance
if (GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  console.log("Gemini AI SDK initialized with API Key.")
} else {
  console.warn("PROXY WARNING: GEMINI_API_KEY not found in process.env. Gemini and Imagen endpoints will likely fail.");
}

// Proxy for Gemini Chat (Streaming)
// Expects: { modelName, historyContents, modelSettings, enableGoogleSearch }
app.post('/api/gemini/chat/stream', async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: "Gemini AI SDK not initialized (API key missing on proxy)." });
  }
  const { modelName, historyContents, modelSettings, enableGoogleSearch } = req.body;

  if (!modelName || !historyContents || !modelSettings) {
    return res.status(400).json({ error: "Missing required fields: modelName, historyContents, modelSettings." });
  }

  try {
    const tools = enableGoogleSearch ? [{googleSearch: {}}] : [];
    const config = {
        systemInstruction: modelSettings.systemInstruction,
        temperature: modelSettings.temperature,
        topK: modelSettings.topK,
        topP: modelSettings.topP,
        tools: tools.length > 0 ? tools : undefined,
    };
    
    console.log(`[Gemini Proxy] Streaming chat for model: ${modelName}. Search: ${enableGoogleSearch}`);
    const stream = await ai.models.generateContentStream({
        model: modelName,
        contents: historyContents, 
        config: config,
    });

    res.setHeader('Content-Type', 'text/plain'); 

    for await (const chunk of stream) {
      const textContent = chunk.text;
      const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
      
      const responseChunk = {
        textDelta: textContent || "",
        groundingSources: []
      };

      if (groundingMetadata?.groundingChunks) {
        groundingMetadata.groundingChunks.forEach(gc => {
          if (gc.web?.uri) {
            responseChunk.groundingSources.push({
              uri: gc.web.uri,
              title: gc.web.title || gc.web.uri
            });
          }
        });
      }
      res.write(JSON.stringify(responseChunk) + '\n');
    }
    res.end();

  } catch (error) {
    console.error("[Gemini Proxy Error] /api/gemini/chat/stream:", error.message, error.statusInfo || error);
    res.status(error.status || 500).json({ error: error.message || "Failed to stream Gemini response." });
  }
});


// Proxy for Imagen Image Generation
// Expects: { modelName, prompt, modelSettings }
app.post('/api/gemini/image/generate', async (req, res) => {
  if (!ai) {
    return res.status(500).json({ error: "Gemini AI SDK not initialized (API key missing on proxy)." });
  }
  const { modelName, prompt, modelSettings } = req.body;

  if (!modelName || !prompt || !modelSettings) {
    return res.status(400).json({ error: "Missing required fields: modelName, prompt, modelSettings." });
  }
  
  try {
    console.log(`[Imagen Proxy] Generating image for model: ${modelName}`);
    const config = { 
        numberOfImages: Math.max(1, Math.min(4, modelSettings.numberOfImages || 1)),
        outputMimeType: modelSettings.outputMimeType || 'image/jpeg',
        ...(modelSettings.aspectRatio && { aspectRatio: modelSettings.aspectRatio }),
    };

    const response = await ai.models.generateImages({
      model: modelName,
      prompt: prompt,
      config: config,
    });

    res.json(response); 

  } catch (error) {
    console.error("[Imagen Proxy Error] /api/gemini/image/generate:", error.message, error.statusInfo || error);
    let detailedMessage = error.message || "Failed to generate image via proxy.";
    if (error.statusInfo && error.statusInfo.message) {
        detailedMessage = error.statusInfo.message;
    }
    res.status(error.status || 500).json({ error: detailedMessage, details: error.statusInfo });
  }
});


// --- OPENAI API PROXY ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';

if (OPENAI_API_KEY) {
    console.log("OpenAI API Key found in process.env.")
} else {
    console.warn("PROXY WARNING: OPENAI_API_KEY not found in process.env. OpenAI endpoints will likely fail.");
}

// Proxy for OpenAI Chat (Streaming)
// Expects: { modelIdentifier, history, modelSettings }
app.post('/api/openai/chat/stream', async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "OpenAI API Key not configured on proxy." });
  }
  const { modelIdentifier, history, modelSettings } = req.body;

  if (!modelIdentifier || !history || !modelSettings) {
    return res.status(400).json({ error: "Missing required fields for OpenAI chat." });
  }

  try {
    console.log(`[OpenAI Chat Proxy] Streaming for model: ${modelIdentifier}`);
    const openaiResponse = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: modelIdentifier,
        messages: history,
        temperature: modelSettings.temperature,
        top_p: modelSettings.topP,
        stream: true,
      }),
    });

    if (!openaiResponse.ok) {
      const errorBodyText = await openaiResponse.text();
      console.error(`[OpenAI Chat Proxy] OpenAI API Error: Status ${openaiResponse.status}, Body: ${errorBodyText}`);
      let errorDetail;
      try {
        const errorData = JSON.parse(errorBodyText);
        errorDetail = errorData.error?.message || errorData.error || `Status: ${openaiResponse.status}, Body: ${errorBodyText.substring(0,200)}`;
      } catch(e){errorDetail = `Status: ${openaiResponse.status}, Body: ${errorBodyText.substring(0,200)}`;}
      return res.status(openaiResponse.status).send(`data: ${JSON.stringify({error: errorDetail, isFinished: true})}\n\n`);
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of openaiResponse.body) {
      res.write(chunk);
    }
    res.end();

  } catch (error) {
    console.error("[OpenAI Chat Proxy Error]:", error.message);
    res.status(500).send(`data: ${JSON.stringify({error: error.message, isFinished: true})}\n\n`);
  }
});

// Proxy for OpenAI TTS
// Expects: { modelIdentifier, textInput, voice, speed, responseFormat }
app.post('/api/openai/tts/generate', async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "OpenAI API Key not configured on proxy." });
  }
  const { modelIdentifier, textInput, voice, speed, responseFormat = 'mp3' } = req.body;

  if (!modelIdentifier || !textInput || !voice || speed === undefined) {
    return res.status(400).json({ error: "Missing required fields for OpenAI TTS." });
  }
  
  try {
    console.log(`[OpenAI TTS Proxy] Generating audio with model: ${modelIdentifier}, voice: ${voice}`);
    const openaiResponse = await fetch(OPENAI_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: modelIdentifier,
        input: textInput,
        voice: voice,
        speed: speed,
        response_format: responseFormat,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({})); // Attempt to parse error JSON
      const errorDetail = errorData.error?.message || errorData.error || `OpenAI TTS API Error: ${openaiResponse.statusText}`;
      console.error(`[OpenAI TTS Proxy] API Error: ${errorDetail}`, errorData);
      return res.status(openaiResponse.status).json({ error: errorDetail });
    }

    res.setHeader('Content-Type', `audio/${responseFormat}`);
    openaiResponse.body.pipe(res);

  } catch (error) {
    console.error("[OpenAI TTS Proxy Error]:", error.message);
    res.status(500).json({ error: error.message || "Failed to generate audio via OpenAI TTS proxy." });
  }
});

// --- DEEPSEEK API PROXY ---
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/chat/completions';

if (DEEPSEEK_API_KEY) {
    console.log("Deepseek API Key found in process.env.")
} else {
    console.warn("PROXY WARNING: DEEPSEEK_API_KEY not found in process.env. Deepseek endpoints will likely fail.");
}

// Proxy for Deepseek Chat (Streaming)
// Expects: { modelIdentifier, history, modelSettings }
app.post('/api/deepseek/chat/stream', async (req, res) => {
  if (!DEEPSEEK_API_KEY) {
    return res.status(500).json({ error: "Deepseek API Key not configured on proxy." });
  }
  const { modelIdentifier, history, modelSettings } = req.body;

  if (!modelIdentifier || !history || !modelSettings) {
    return res.status(400).json({ error: "Missing required fields for Deepseek chat." });
  }

  try {
    console.log(`[Deepseek Chat Proxy] Streaming for model: ${modelIdentifier}`);
    const deepseekResponse = await fetch(DEEPSEEK_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: modelIdentifier,
        messages: history,
        temperature: modelSettings.temperature,
        top_p: modelSettings.topP,
        stream: true,
      }),
    });

    if (!deepseekResponse.ok) {
      const errorBodyText = await deepseekResponse.text();
      console.error(`[Deepseek Chat Proxy] Deepseek API Error: Status ${deepseekResponse.status}, Body: ${errorBodyText}`);
      let errorDetail;
      try {
        const errorData = JSON.parse(errorBodyText);
        errorDetail = errorData.error?.message || errorData.error || `Status: ${deepseekResponse.status}, Body: ${errorBodyText.substring(0,200)}`;
      } catch(e){errorDetail = `Status: ${deepseekResponse.status}, Body: ${errorBodyText.substring(0,200)}`;}
      return res.status(deepseekResponse.status).send(`data: ${JSON.stringify({error: errorDetail, isFinished: true})}\n\n`);
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of deepseekResponse.body) {
      res.write(chunk);
    }
    res.end();

  } catch (error) {
    console.error("[Deepseek Chat Proxy Error]:", error.message);
    res.status(500).send(`data: ${JSON.stringify({error: error.message, isFinished: true})}\n\n`);
  }
});

// --- FAL.AI API PROXY (for Flux Kontext) ---
const FAL_KEY = process.env.FAL_KEY;
if (FAL_KEY) {
    console.log("Fal.ai Key (FAL_KEY) found in process.env.");
} else {
    console.warn("PROXY WARNING: FAL_KEY not found in process.env. Fal.ai endpoints will likely fail.");
}

// Proxy for Fal.ai Flux Kontext Image Editing
app.post('/api/fal/image/edit/flux-kontext', async (req, res) => {
    if (!FAL_KEY) {
        return res.status(500).json({ error: "Fal.ai API Key (FAL_KEY) not configured on proxy." });
    }
    const {
        image_base_64,
        image_mime_type, 
        prompt,
        guidance_scale: guidance_scale_param,
        safety_tolerance: safety_tolerance_param,
        num_inference_steps: num_inference_steps_param,
        seed: seed_param,
    } = req.body;

    if (!image_base_64 || !prompt || !image_mime_type) {
        return res.status(400).json({ error: "Missing required fields: image_base_64, imageMimeType, prompt for Flux Kontext." });
    }
    
    const guidance_scale = guidance_scale_param ?? DEFAULT_FLUX_KONTEX_SETTINGS.guidance_scale;
    const safety_tolerance = safety_tolerance_param ?? DEFAULT_FLUX_KONTEX_SETTINGS.safety_tolerance;
    const num_inference_steps = num_inference_steps_param ?? DEFAULT_FLUX_KONTEX_SETTINGS.num_inference_steps;
    const seed_value = seed_param; 

    const falInput = {
        prompt: prompt,
        image_url: `data:${image_mime_type};base64,${image_base_64}`,
        guidance_scale: guidance_scale,
        safety_tolerance: safety_tolerance,
        seed: (seed_value === null || seed_value === undefined) ? null : seed_value,
        num_inference_steps: num_inference_steps,
    };

    console.log(`[Flux Kontext Proxy] Input data for fal.queue.submit:`, {
        ...falInput, 
        image_url: falInput.image_url.substring(0, 50) + (falInput.image_url.length > 50 ? `... ${falInput.image_url.length - 50} more characters` : "")
    });

    try {
        const queueResult = await fal.queue.submit("fal-ai/flux-pro/kontext", {
            input: falInput,
        });

        if (queueResult && queueResult.request_id) {
            console.log(`[Flux Kontext Proxy] Request ID from fal.queue.submit: ${queueResult.request_id}`);
            res.json({ requestId: queueResult.request_id, message: "Image editing request submitted via queue. Polling for status." });
        } else {
            console.error("[Flux Kontext Proxy] Fal.queue.submit did not return a request_id. Result:", queueResult);
            res.status(500).json({ error: "Fal.ai Flux Kontext: Failed to get a request ID for polling.", rawResult: queueResult });
        }

    } catch (error) {
        console.error("[Flux Kontext Proxy Error] /api/fal/image/edit/flux-kontext:", error);
        res.status(500).json({ error: error.message || "Failed to submit image editing request to Fal.ai proxy." });
    }
});

// Proxy for checking Fal.ai request status
// Expects: { requestId }
app.post('/api/fal/image/edit/status', async (req, res) => {
    if (!FAL_KEY) {
        return res.status(500).json({ error: "Fal.ai API Key (FAL_KEY) not configured on proxy." });
    }
    const { requestId } = req.body;

    if (!requestId) {
        return res.status(400).json({ error: "Missing requestId for status check." });
    }

    try {
        console.log(`[Flux Kontext Status Proxy] Checking status for request ID: ${requestId}`);
        const statusResult = await fal.queue.status("fal-ai/flux-pro/kontext", { requestId });
        let responsePayload = { rawResult: statusResult, status: undefined, editedImageUrl: undefined, message: undefined, error: undefined };

        if (statusResult) {
            if (statusResult.status === 'COMPLETED') {
                try {
                    console.log(`[Flux Kontext Status Proxy] Status is COMPLETED for ${requestId}. Fetching result...`);
                    const jobResult = await fal.queue.result("fal-ai/flux-pro/kontext", { requestId });
                    console.log(`[Flux Kontext Status Proxy] Result fetched for ${requestId}. (Full result logged if verbose)`);
                     if (process.env.VERBOSE_LOGGING === 'true') console.log("[Flux Kontext Status Proxy] Full result object:", JSON.stringify(jobResult, null, 2));


                    if (jobResult && jobResult.data && jobResult.data.images && Array.isArray(jobResult.data.images) && jobResult.data.images.length > 0 && jobResult.data.images[0].url) {
                        responsePayload.status = 'COMPLETED';
                        responsePayload.editedImageUrl = jobResult.data.images[0].url;
                        responsePayload.message = "Image editing completed successfully.";
                        responsePayload.rawResult = jobResult;
                    } else {
                        responsePayload.status = 'COMPLETED_NO_IMAGE';
                        responsePayload.message = "Processing completed, but no image URL was found in Fal.ai result payload.";
                        responsePayload.error = "Fal.ai result payload did not contain an image URL or was structured unexpectedly.";
                        responsePayload.rawResult = jobResult;
                        console.warn("[Flux Kontext Status Proxy] 'COMPLETED' status, result fetched, but no image URL at expected path (result.data.images[0].url). Fal.ai result:", jobResult);
                    }
                } catch (resultError) {
                    console.error(`[Flux Kontext Status Proxy Error] Fetching result for COMPLETED ${requestId}:`, resultError);
                    responsePayload.status = 'ERROR_FETCHING_RESULT';
                    responsePayload.error = `Failed to fetch result for completed job: ${resultError.message}`;
                    responsePayload.message = "Image editing completed, but failed to retrieve the final image.";
                }
            } else if (statusResult.status === 'IN_PROGRESS' || statusResult.status === 'IN_QUEUE') {
                responsePayload.status = statusResult.status;
                responsePayload.message = `Image editing is ${statusResult.status.toLowerCase()}.`;
            } else if (statusResult.status === 'ERROR') { 
                responsePayload.status = 'ERROR';
                const errorLog = statusResult.logs?.find(log => log.level === 'ERROR');
                responsePayload.error = statusResult.error?.message || errorLog?.message || "Fal.ai reported an error.";
                responsePayload.message = "Image editing failed.";
            } else { 
                responsePayload.status = statusResult.status || 'IN_PROGRESS'; 
                responsePayload.message = `Image editing status: ${statusResult.status || 'Unknown'}.`;
            }
            
            console.log(`[Flux Kontext Status Proxy] Status for ${requestId}: ${responsePayload.status}. Message: ${responsePayload.message}`);
            return res.json(responsePayload);

        } else { 
            console.warn(`[Flux Kontext Status Proxy] Request ID ${requestId} not found by Fal.ai or statusResult was null/undefined.`);
            return res.status(404).json({ status: 'NOT_FOUND', error: `Request ID ${requestId} not found or invalid status response.`, message: `Request ID ${requestId} not found or invalid status.` });
        }

    } catch (error) { 
        console.error(`[Flux Kontext Status Proxy Error] Checking status for ${requestId}:`, error);
        if (error.message && (error.message.includes("404") || error.message.toLowerCase().includes("not found") || error.message.toLowerCase().includes("request not found"))) {
            return res.status(404).json({ status: 'NOT_FOUND', error: `Request ID ${requestId} not found (Fal error: ${error.message}).`, message: `Request ID ${requestId} not found.` });
        }
        res.status(500).json({ 
            status: 'PROXY_REQUEST_ERROR', 
            error: error.message || "Failed to check Fal.ai request status via proxy.", 
            message: "Error checking status with Fal.ai proxy." 
        });
    }
});


// --- SERVER START ---
app.listen(port, () => {
  console.log(`AI Chat Proxy Server listening at http://localhost:${port}`);
  if (allowedOrigins.length === 0) {
      console.warn("PROXY WARNING: CORS_ALLOWED_ORIGINS is not set or is empty. This means NO cross-origin requests will be allowed by default if 'origin' header is present. For local development with a frontend on a different port, set e.g., CORS_ALLOWED_ORIGINS=http://localhost:5173 (if Vite default) or http://localhost:3000 (if Create React App default). For Vercel deployment, ensure your Vercel project URL is in this list.");
  } else if (allowedOrigins.includes('*')) {
      console.warn("PROXY WARNING: CORS_ALLOWED_ORIGINS is set to '*'. This allows all origins, which might be insecure for production environments.");
  } else {
      console.log(`CORS allows requests from these origins: ${allowedOrigins.join(', ')}`);
  }
});
