
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch'; // For OpenAI/Deepseek
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai'; // Assuming these are needed from SDK

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// CORS configuration
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS ? process.env.CORS_ALLOWED_ORIGINS.split(',') : [];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  }
}));

// Middleware to parse JSON bodies
app.use(express.json());

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
let ai;
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
        errorDetail = errorData.error?.message || `Status: ${openaiResponse.status}, Body: ${errorBodyText.substring(0,200)}`;
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
        errorDetail = errorData.error?.message || `Status: ${openaiResponse.status}, Body: ${errorBodyText.substring(0,200)}`;
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

app.get('/', (req, res) => {
  res.send('AI Chat Proxy Server is running.');
});

app.listen(port, () => {
  console.log(`AI Chat Proxy Server listening on port ${port}`);
  console.log(`Allowed CORS origins: ${process.env.CORS_ALLOWED_ORIGINS || '(Not Set, defaults to restrictive)'}`);
  console.log(`LOGIN_CODE_AUTH is ${process.env.LOGIN_CODE_AUTH ? 'SET' : 'NOT SET in proxy environment. Login will fail.'}`);
  console.log(`GEMINI_API_KEY is ${process.env.GEMINI_API_KEY ? 'SET' : 'NOT SET in proxy environment'}.`);
  console.log(`OPENAI_API_KEY is ${process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET in proxy environment'}.`);
  console.log(`DEEPSEEK_API_KEY is ${process.env.DEEPSEEK_API_KEY ? 'SET' : 'NOT SET in proxy environment'}.`);

  console.log("\nEnsure your frontend (e.g., Vite) is configured to proxy /api requests to this server if running on different ports during development.");
  console.log("Example Vite config (vite.config.js or vite.config.ts):");
  console.log("server: { proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } } }");
});
