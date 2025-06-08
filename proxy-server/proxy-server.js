
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch'; // For OpenAI/Deepseek
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai'; // Assuming these are needed from SDK
import { fal } from '@fal-ai/client'; // Import fal.ai client

// Define DEFAULT_FLUX_KONTEX_SETTINGS directly to avoid import issues
const DEFAULT_FLUX_KONTEX_SETTINGS = {
  guidance_scale: 7.5,
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
      return res.status(openaiResponse.status).json({ error: `OpenAI API Error: ${errorDetail}` });
    }
    
    res.setHeader('Content-Type', 'text/event-stream');
    openaiResponse.body.pipe(res);

  } catch (error) {
    console.error("[OpenAI Chat Proxy Error] /api/openai/chat/stream:", error);
    res.status(500).json({ error: error.message || "Failed to stream OpenAI response." });
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
    console.log(`[OpenAI TTS Proxy] Generating audio for model: ${modelIdentifier}, voice: ${voice}`);
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
        speed: Math.max(0.25, Math.min(4.0, speed)),
        response_format: responseFormat,
      }),
    });

    if (!openaiResponse.ok) {
      const errorBodyText = await openaiResponse.text();
      console.error(`[OpenAI TTS Proxy] OpenAI TTS API Error: Status ${openaiResponse.status}, Body: ${errorBodyText}`);
      let errorDetail;
      try {
        const errorData = JSON.parse(errorBodyText);
        errorDetail = errorData.error?.message || errorData.error || `Status: ${openaiResponse.status}, Body: ${errorBodyText.substring(0,200)}`;
      } catch(e){errorDetail = `Status: ${openaiResponse.status}, Body: ${errorBodyText.substring(0,200)}`;}
      return res.status(openaiResponse.status).json({ error: `OpenAI TTS API Error: ${errorDetail}` });
    }

    res.setHeader('Content-Type', openaiResponse.headers.get('content-type') || `audio/${responseFormat}`);
    openaiResponse.body.pipe(res);

  } catch (error) {
    console.error("[OpenAI TTS Proxy Error] /api/openai/tts/generate:", error);
    res.status(500).json({ error: error.message || "Failed to generate OpenAI TTS audio." });
  }
});


// --- DEEPSEEK API PROXY ---
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/chat/completions';

if (DEEPSEEK_API_KEY) {
    console.log("Deepseek API Key found in process.env.");
} else {
    console.warn("PROXY WARNING: DEEPSEEK_API_KEY not found in process.env. Deepseek endpoints will likely fail.");
}

// Proxy for Deepseek Chat (Streaming)
// Expects: { modelIdentifier, history, modelSettings }
app.post('/api/deepseek/chat/stream', async (req, res) => {
  console.log(`[Deepseek Chat Proxy] Received request. DEEPSEEK_API_KEY is ${DEEPSEEK_API_KEY ? 'SET' : 'NOT SET'}`);
  if (!DEEPSEEK_API_KEY) {
    console.error("[Deepseek Chat Proxy] Aborting: Deepseek API Key not configured on proxy.");
    return res.status(500).json({ error: "Deepseek API Key not configured on proxy." });
  }
  const { modelIdentifier, history, modelSettings } = req.body;

  if (!modelIdentifier || !history || !modelSettings) {
    console.error("[Deepseek Chat Proxy] Aborting: Missing required fields for Deepseek chat.", {modelIdentifier, historyExists: !!history, modelSettingsExists: !!modelSettings});
    return res.status(400).json({ error: "Missing required fields for Deepseek chat." });
  }
  
  const textOnlyHistory = history.map(msg => {
    if (typeof msg.content !== 'string') {
      const textPart = (msg.content).find(p => p.type === 'text');
      return { ...msg, content: textPart ? textPart.text : "" };
    }
    return msg;
  }).filter(msg => msg.content || msg.role === 'assistant');

  const requestPayload = {
    model: modelIdentifier,
    messages: textOnlyHistory,
    temperature: modelSettings.temperature,
    top_p: modelSettings.topP,
    stream: true,
  };
  
  console.log(`[Deepseek Chat Proxy] Streaming for model: ${modelIdentifier}. Payload:`, JSON.stringify(requestPayload, null, 2));

  try {
    const deepseekResponse = await fetch(DEEPSEEK_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(requestPayload),
    });

    if (!deepseekResponse.ok) {
      const errorBodyText = await deepseekResponse.text(); // Get raw text first
      console.error(`[Deepseek Chat Proxy] Deepseek API Error: Status ${deepseekResponse.status}, Body: ${errorBodyText}`);
      let errorDetail;
      try {
        const errorData = JSON.parse(errorBodyText); // Try to parse as JSON
        errorDetail = errorData.error?.message || errorData.detail || errorData.message || `Status: ${deepseekResponse.status}, Body: ${errorBodyText.substring(0, 200)}`;
      } catch (e) {
        errorDetail = `Status: ${deepseekResponse.status}, Body: ${errorBodyText.substring(0,200)}`;
      }
      return res.status(deepseekResponse.status).json({ error: `Deepseek API Error: ${errorDetail}` });
    }

    res.setHeader('Content-Type', 'text/event-stream'); 
    deepseekResponse.body.pipe(res);

  } catch (error) {
    console.error("[Deepseek Chat Proxy Error] Fetch or other error in /api/deepseek/chat/stream:", error);
    res.status(500).json({ error: error.message || "Failed to stream Deepseek response due to proxy internal error." });
  }
});


// --- FAL.AI API PROXY ---
const FAL_KEY = process.env.FAL_KEY;
const FAL_MODEL_FLUX_KONTEX = "fal-ai/flux-pro/kontext"; // Use full model ID for both submission and status/result

if (FAL_KEY) {
  fal.config({ credentials: FAL_KEY });
  console.log("Fal.ai SDK configured with FAL_KEY.");
} else {
  console.warn("PROXY WARNING: FAL_KEY not set in process.env. Fal.ai endpoints will likely fail.");
}

app.post('/api/fal/image/edit/flux-kontext', async (req, res) => {
  if (!FAL_KEY) {
    return res.status(500).json({ error: "Fal.ai API Key not configured on proxy." });
  }

  const { image_base_64, image_mime_type, prompt: promptFromUser, guidance_scale: guidanceScaleFromBody } = req.body;

  if (!image_base_64) {
    return res.status(400).json({ error: "Missing image_base_64 for Flux Kontex." });
  }
  if (!promptFromUser || typeof promptFromUser !== 'string' || promptFromUser.trim() === '') {
    return res.status(400).json({ error: "Missing or invalid prompt for Flux Kontex. Must be a non-empty string." });
  }
  const prompt = promptFromUser.trim();

  let guidanceScaleToUse = DEFAULT_FLUX_KONTEX_SETTINGS.guidance_scale;
  if (guidanceScaleFromBody !== undefined) {
    const parsedFromBody = Number(guidanceScaleFromBody);
    if (isNaN(parsedFromBody) || parsedFromBody < 1 || parsedFromBody > 20) {
      return res.status(400).json({ error: "guidance_scale must be a number between 1 and 20." });
    }
    guidanceScaleToUse = parsedFromBody;
  }

  try {
    const imageBuffer = Buffer.from(image_base_64, 'base64');
    const mimeType = image_mime_type || 'image/png';
    if (!['image/png', 'image/jpeg'].includes(mimeType)) {
      return res.status(400).json({ error: "Unsupported image MIME type. Use image/png or image/jpeg." });
    }

    console.log(`[Flux Kontex Proxy] Uploading image to Fal.ai storage. MIME type: ${mimeType}`);
    const storageUploadResult = await fal.storage.upload(imageBuffer, { contentType: mimeType });
    console.log("[Flux Kontex Proxy] Raw response from fal.storage.upload:", storageUploadResult);

    let imageUrl;
    if (typeof storageUploadResult === 'string' && storageUploadResult.startsWith('http')) {
        imageUrl = storageUploadResult;
    } else if (typeof storageUploadResult === 'object' && storageUploadResult !== null && typeof storageUploadResult.url === 'string' && storageUploadResult.url.startsWith('http')) {
        imageUrl = storageUploadResult.url;
    } else {
        console.error("[Flux Kontex Proxy Error] Fal.ai storage upload did not return a valid URL. Full upload response:", storageUploadResult);
        throw new Error("Fal.ai storage upload failed to provide a usable image URL.");
    }
    console.log(`[Flux Kontex Proxy] Image uploaded to Fal.ai storage. URL: ${imageUrl}`);
    
    console.log(`[Flux Kontex Proxy] Submitting image editing. Prompt (first 30 chars): '${prompt.substring(0, 30)}...'`);
    console.log("[Flux Kontex Proxy] Input data:", { prompt, image_url: imageUrl, guidance_scale: guidanceScaleToUse });

    const submissionResponse = await fal.queue.submit(FAL_MODEL_FLUX_KONTEX, {
      input: {
        prompt: prompt,
        image_url: imageUrl,
        guidance_scale: guidanceScaleToUse,
      },
    });
    console.log("[Flux Kontex Proxy] Fal.ai Submission response:", JSON.stringify(submissionResponse, null, 2));

    let requestIdValue;
    if (submissionResponse && submissionResponse.request_id) {
      requestIdValue = submissionResponse.request_id;
    } else {
      console.error("[Flux Kontex Proxy] Fal.ai submission did not return a recognizable request_id:", submissionResponse);
      const submissionErrorMsg = submissionResponse?.detail || submissionResponse?.error?.message || "Fal.ai submission failed to return a request ID.";
      throw new Error(submissionErrorMsg);
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000)); 

    console.log(`[Flux Kontex Proxy] Performing early status check for requestId: ${requestIdValue} after delay`);
    try {
        const initialStatus = await fal.queue.status(FAL_MODEL_FLUX_KONTEX, { requestId: requestIdValue }); 
        console.log(`[Flux Kontex Proxy] Early status response for ${requestIdValue}:`, JSON.stringify(initialStatus, null, 2));

        if (initialStatus && (initialStatus.status === 'FAILED' || initialStatus.status === 'ERROR')) {
          const earlyErrorMessage = initialStatus.error?.message || initialStatus.result?.error?.message || initialStatus.result?.detail || initialStatus.detail || "Fal.ai request failed with early status check.";
          console.error(`[Flux Kontex Proxy] Initial status for ${requestIdValue} indicates failure: ${earlyErrorMessage}`);
        } else if (initialStatus && initialStatus.status === 'NOT_FOUND') {
            console.warn(`[Flux Kontex Proxy] Early status check for ${requestIdValue} returned NOT_FOUND. Client will proceed with polling.`);
        }
    } catch (statusError) {
        console.warn(`[Flux Kontex Proxy] Early status check API call for ${requestIdValue} failed:`, statusError.message);
    }

    res.json({ requestId: requestIdValue, message: "Request submitted, check status with requestId." });

  } catch (error) {
    console.error("[Flux Kontex Proxy Error] /api/fal/image/edit/flux-kontext:", error);
    const errorMessage = error.output?.error?.message || error.message || "Failed to submit image edit request.";
    const errorStatus = error.status || 500;
    res.status(errorStatus).json({ error: errorMessage, details: error.output || error });
  }
});


app.post('/api/fal/image/edit/status', async (req, res) => {
  if (!FAL_KEY) {
    return res.status(500).json({ error: "Fal.ai API Key not configured on proxy." });
  }
  const { requestId } = req.body;
  if (!requestId) {
    return res.status(400).json({ error: "Missing requestId." });
  }
  try {
    console.log(`[Flux Kontex Status] Checking status for requestId: ${requestId} using model ID: ${FAL_MODEL_FLUX_KONTEX}`);
    const statusResult = await fal.queue.status(FAL_MODEL_FLUX_KONTEX, { requestId });
    console.log(`[Flux Kontex Status] Fal.ai status response for ${requestId}:`, JSON.stringify(statusResult, null, 2));

    if (statusResult.status === 'COMPLETED') {
      console.log(`[Flux Kontex Status] Job ${requestId} COMPLETED. Fetching result...`);
      const jobResult = await fal.queue.result(FAL_MODEL_FLUX_KONTEX, { requestId });
      console.log(`[Flux Kontex Status] Fal.ai result response for ${requestId}:`, JSON.stringify(jobResult, null, 2));

      const imageUrl = jobResult?.data?.images?.[0]?.url;

      if (typeof imageUrl === 'string' && imageUrl.trim() !== '') {
        console.log(`[Flux Kontex Status] Extracted image URL: ${imageUrl}`);
        res.json({ status: 'COMPLETED', editedImageUrl: imageUrl, rawResult: jobResult });
      } else {
        console.warn(`[Flux Kontex Status] Request ${requestId} completed, but valid image URL not found.`);
        console.log(`[Flux Kontex Status] Detailed jobResult.data structure:`, JSON.stringify(jobResult?.data, null, 2));
        if (jobResult?.data?.images?.[0]) {
            console.log(`[Flux Kontex Status] First image object:`, JSON.stringify(jobResult.data.images[0], null, 2));
            console.log(`[Flux Kontex Status] URL property: ${jobResult.data.images[0].url}, Type: ${typeof jobResult.data.images[0].url}`);
        } else if (jobResult?.data?.images) {
             console.log(`[Flux Kontex Status] jobResult.data.images is an array but might be empty or items lack URL.`);
        } else if (jobResult?.data) {
            console.log(`[Flux Kontex Status] jobResult.data exists but jobResult.data.images is missing or not an array.`);
        } else {
            console.log(`[Flux Kontex Status] jobResult.data is missing.`);
        }
        res.status(200).json({ 
            status: 'COMPLETED_NO_IMAGE', 
            message: 'Processing completed, but the expected image URL was not found in the API response.', 
            rawResult: jobResult 
        });
      }
    } else if (statusResult.status === 'IN_PROGRESS' || statusResult.status === 'IN_QUEUE') {
      res.json({ status: statusResult.status, message: 'Image editing is still processing.' });
    } else if (statusResult.status === 'NOT_FOUND') { 
      res.json({ status: 'NOT_FOUND', message: 'Request ID not found. It might still be initializing or it is invalid.' });
    } else { 
      console.error("[Flux Kontex Status Error] Non-completed or non-progress status from fal.ai:", statusResult);
      const errorMessage = statusResult.error?.message || statusResult.detail || "Failed to get a successful image edit result from Fal.ai.";
      res.status(statusResult.error?.status_code || (statusResult.status === 'ERROR' ? 500 : 200) ).json({ status: statusResult.status || 'ERROR', error: errorMessage, details: statusResult });
    }
  } catch (error) {
    console.error("[Flux Kontex Status Error] API call to fal.queue.status or fal.queue.result failed:", error);
    const errorMessage = error.output?.error?.message || error.message || "Failed to get result for the request.";
    const errorStatus = error.status || 500; 
    const errorDetails = error.output || error;
    
    let falApiReportedStatus = 'ERROR_IN_PROXY_CALL';
    if (error.name === 'ApiError' && error.status === 404) {
        falApiReportedStatus = 'NOT_FOUND';
    } else if (error.output?.status) {
        falApiReportedStatus = error.output.status;
    }

    res.status(errorStatus).json({ status: falApiReportedStatus, error: errorMessage, details: errorDetails });
  }
});


app.get('/', (req, res) => {
  res.send('AI Chat Proxy Server is running.');
});

// Final server startup logs
app.listen(port, () => {
  console.log(`AI Chat Proxy Server listening on port ${port}`);
  console.log(`LOGIN_CODE_AUTH is ${process.env.LOGIN_CODE_AUTH ? 'SET' : 'NOT SET in proxy environment. Login will fail.'}`);
  console.log(`GEMINI_API_KEY is ${process.env.GEMINI_API_KEY ? 'SET' : 'NOT SET in proxy environment'}.`);
  console.log(`OPENAI_API_KEY is ${process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET in proxy environment'}.`);
  console.log(`DEEPSEEK_API_KEY is ${process.env.DEEPSEEK_API_KEY ? 'SET' : 'NOT SET in proxy environment'}.`);
  console.log(`FAL_KEY is ${FAL_KEY ? 'SET' : 'NOT SET in proxy environment. Fal.ai endpoints will fail.'}`);


  console.log("\nEnsure your frontend (e.g., Vite) is configured to proxy /api requests to this server if running on different ports during development.");
  console.log("Example Vite config (vite.config.js or vite.config.ts):");
  console.log("server: { proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } } }");
});
