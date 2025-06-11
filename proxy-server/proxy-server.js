
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { GoogleGenAI } from '@google/genai';
import { fal } from '@fal-ai/client';
import { randomBytes } from 'crypto';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';

console.log(`[Proxy Server] Starting up at ${new Date().toISOString()}...`); 

// Define DEFAULT_FLUX_KONTEX_SETTINGS directly.
const PROXY_DEFAULT_FLUX_KONTEX_SETTINGS = {
  guidance_scale: 7.5,
  safety_tolerance: 5,
  num_inference_steps: 30,
  seed: null,
  num_images: 1,
  aspect_ratio: 'default', 
  output_format: 'jpeg',
};

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// --- MySQL Connection Pool ---
let pool;
try {
    pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
    console.log("MySQL Connection Pool created successfully.");
    pool.getConnection()
        .then(conn => {
            console.log("Successfully connected to MySQL database.");
            conn.release();
        })
        .catch(err => {
            console.error("Failed to connect to MySQL database:", err);
        });
} catch (error) {
    console.error("CRITICAL: Failed to create MySQL connection pool:", error);
}


const rawCORSOrigins = process.env.CORS_ALLOWED_ORIGINS;
const allowedOrigins = rawCORSOrigins ? String(rawCORSOrigins).split(',').map(o => o.trim()) : [];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// --- Authentication ---
const LOGIN_CODE_AUTH_ADMIN = process.env.LOGIN_CODE_AUTH_ADMIN;
// const DEMO_USER_LOGIN_CODE = process.env.DEMO_USER_LOGIN_CODE || "DEMO"; // No longer a generic code

if (!LOGIN_CODE_AUTH_ADMIN) console.warn("PROXY WARNING: LOGIN_CODE_AUTH_ADMIN not found. Admin login will not function.");
else console.log("LOGIN_CODE_AUTH_ADMIN is SET for admin.");
// console.log(`DEMO_USER_LOGIN_CODE is: ${DEMO_USER_LOGIN_CODE}`); // Removed


// --- NAMED DEMO USER CONSTANTS (from DB) ---
const DEMO_USER_MONTHLY_LIMITS = {
  FLUX_KONTEX_MAX_MONTHLY: 0, // Changed from 5 to 0
  FLUX_KONTEX_PRO_MONTHLY: 10,
  IMAGEN3_MONTHLY_IMAGES: 20,
  OPENAI_TTS_MONTHLY_CHARS: 10000,
};

// --- PAID USER LIMITS ---
const PAID_USER_MAX_LIMITS_CONFIG = {
  IMAGEN3_MAX_IMAGES_PER_DAY: 50, 
  OPENAI_TTS_MAX_CHARS_TOTAL: 20000, 
  FLUX_KONTEX_MAX_MONTHLY_MAX_USES: 40,
  FLUX_KONTEX_PRO_MONTHLY_MAX_USES: 50,
};

const paidUserFluxMonthlyUsageStore = {}; 

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0]).trim();
  }
  return req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip;
}

function getCurrentYearMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0'); 
    return `${year}-${month}`;
}


async function paidOrDemoUserAuthMiddleware(req, res, next) {
    const paidUserToken = req.headers['x-paid-user-token']; // Paid username as token
    const demoUserToken = req.headers['x-demo-user-token']; // Demo username as token

    if (paidUserToken) {
        try {
            if (!pool) throw new Error("Database not available for paid user auth.");
            const [users] = await pool.execute('SELECT id, username, user_type FROM users WHERE username = ?', [paidUserToken]);
            if (users.length > 0) {
                const user = users[0];
                if (user.user_type === 'PAID') {
                    const [subscriptions] = await pool.execute(
                        'SELECT end_date FROM subscriptions WHERE user_id = ? AND status = "active" AND end_date > NOW()',
                        [user.id]
                    );
                    if (subscriptions.length > 0) {
                        req.paidUser = {
                            id: user.id, username: user.username, isPaidUser: true,
                            subscriptionEndDate: subscriptions[0].end_date
                        };

                        const yearMonth = getCurrentYearMonth();
                        if (!paidUserFluxMonthlyUsageStore[user.username]) paidUserFluxMonthlyUsageStore[user.username] = {};
                        if (!paidUserFluxMonthlyUsageStore[user.username][yearMonth]) {
                            paidUserFluxMonthlyUsageStore[user.username][yearMonth] = { fluxMaxUsed: 0, fluxProUsed: 0 };
                        }
                        req.paidUser.fluxMaxMonthlyUsed = paidUserFluxMonthlyUsageStore[user.username][yearMonth].fluxMaxUsed;
                        req.paidUser.fluxProMonthlyUsed = paidUserFluxMonthlyUsageStore[user.username][yearMonth].fluxProUsed;
                        req.isPaidUser = true;
                    }
                }
            }
        } catch (dbError) { console.error("[Paid Auth DB Error]", dbError); }
    } else if (demoUserToken) {
        try {
            if (!pool) throw new Error("Database not available for demo user auth.");
            const [users] = await pool.execute(
                'SELECT id, username, user_type, demo_flux_max_monthly_used, demo_flux_pro_monthly_used, demo_imagen_monthly_used, demo_tts_monthly_chars_used, demo_usage_last_reset_month FROM users WHERE username = ? AND user_type = "DEMO"', 
                [demoUserToken] // Assuming demoUserToken is the demo username
            );
            if (users.length > 0) {
                const user = users[0];
                req.demoUser = { // Attach DB fetched demo user data
                    id: user.id, username: user.username, isDemoUser: true,
                    fluxMaxMonthlyUsed: user.demo_flux_max_monthly_used || 0,
                    fluxProMonthlyUsed: user.demo_flux_pro_monthly_used || 0,
                    imagenMonthlyUsed: user.demo_imagen_monthly_used || 0,
                    ttsMonthlyCharsUsed: user.demo_tts_monthly_chars_used || 0,
                    usageLastResetMonth: user.demo_usage_last_reset_month
                };
                req.isDemoUser = true;
            }
        } catch (dbError) { console.error("[Demo Auth DB Error]", dbError); }
    }
    next();
}
app.use(paidOrDemoUserAuthMiddleware); // Applies to all routes after this

app.post('/api/auth/verify-code', async (req, res) => {
    const { code } = req.body; // 'code' is now the username (admin, paid, or demo)
    
    if (code === LOGIN_CODE_AUTH_ADMIN) {
        if (!LOGIN_CODE_AUTH_ADMIN) return res.status(500).json({ success: false, message: "Admin login not configured." });
        console.log("[Admin Login] Successful via LOGIN_CODE_AUTH_ADMIN.");
        return res.json({ success: true, isAdmin: true, message: "Admin login successful." });
    }

    if (!pool) return res.status(503).json({ success: false, message: "Database service unavailable." });

    try {
        const [users] = await pool.execute(
            'SELECT id, username, user_type, password_hash, demo_flux_max_monthly_used, demo_flux_pro_monthly_used, demo_imagen_monthly_used, demo_tts_monthly_chars_used, demo_usage_last_reset_month FROM users WHERE username = ?', 
            [code]
        );

        if (users.length === 0) {
            console.log(`[Login] Username "${code}" not found in DB.`);
            return res.status(401).json({ success: false, message: "Invalid username or code." });
        }
        const user = users[0];

        if (user.user_type === 'PAID') {
            console.log(`[Paid Login Attempt] User "${user.username}" (PAID type) found.`);
            const [subscriptions] = await pool.execute(
                'SELECT end_date FROM subscriptions WHERE user_id = ? AND status = "active" AND end_date > NOW()',
                [user.id]
            );
            if (subscriptions.length > 0) {
                const subEndDate = new Date(subscriptions[0].end_date);
                console.log(`[Paid Login] User ${user.username} has active subscription until ${subEndDate.toISOString()}.`);
                
                const yearMonth = getCurrentYearMonth();
                if (!paidUserFluxMonthlyUsageStore[user.username]) paidUserFluxMonthlyUsageStore[user.username] = {};
                if (!paidUserFluxMonthlyUsageStore[user.username][yearMonth]) {
                    paidUserFluxMonthlyUsageStore[user.username][yearMonth] = { fluxMaxUsed: 0, fluxProUsed: 0 };
                }
                const userMonthlyUsage = paidUserFluxMonthlyUsageStore[user.username][yearMonth];

                return res.json({
                    success: true, isPaidUser: true, username: user.username,
                    paidUserToken: user.username, // Using username as token for simplicity
                    subscriptionEndDate: subEndDate.toISOString(),
                    limits: {
                        imagen3ImagesLeft: PAID_USER_MAX_LIMITS_CONFIG.IMAGEN3_MAX_IMAGES_PER_DAY,
                        imagen3MaxImages: PAID_USER_MAX_LIMITS_CONFIG.IMAGEN3_MAX_IMAGES_PER_DAY,
                        openaiTtsCharsLeft: PAID_USER_MAX_LIMITS_CONFIG.OPENAI_TTS_MAX_CHARS_TOTAL,
                        openaiTtsMaxChars: PAID_USER_MAX_LIMITS_CONFIG.OPENAI_TTS_MAX_CHARS_TOTAL,
                        fluxKontextMaxMonthlyUsesLeft: PAID_USER_MAX_LIMITS_CONFIG.FLUX_KONTEX_MAX_MONTHLY_MAX_USES - userMonthlyUsage.fluxMaxUsed,
                        fluxKontextMaxMonthlyMaxUses: PAID_USER_MAX_LIMITS_CONFIG.FLUX_KONTEX_MAX_MONTHLY_MAX_USES,
                        fluxKontextProMonthlyUsesLeft: PAID_USER_MAX_LIMITS_CONFIG.FLUX_KONTEX_PRO_MONTHLY_MAX_USES - userMonthlyUsage.fluxProUsed,
                        fluxKontextProMonthlyMaxUses: PAID_USER_MAX_LIMITS_CONFIG.FLUX_KONTEX_PRO_MONTHLY_MAX_USES,
                    }
                });
            } else {
                console.log(`[Paid Login] User ${user.username} found, but no active/valid subscription.`);
                return res.status(403).json({ success: false, message: "Subscription inactive or expired." });
            }
        } else if (user.user_type === 'DEMO') {
            console.log(`[DEMO Login] User "${user.username}" (DEMO type) found.`);
            const currentYearMonth = getCurrentYearMonth();
            let { 
                demo_flux_max_monthly_used: fluxMaxUsed = 0, 
                demo_flux_pro_monthly_used: fluxProUsed = 0,
                demo_imagen_monthly_used: imagenUsed = 0,
                demo_tts_monthly_chars_used: ttsCharsUsed = 0,
                demo_usage_last_reset_month: lastResetMonth
            } = user;

            if (lastResetMonth !== currentYearMonth) {
                console.log(`[DEMO Login] Resetting monthly limits for DEMO user ${user.username} for new month ${currentYearMonth}. Old month: ${lastResetMonth}`);
                fluxMaxUsed = 0; fluxProUsed = 0; imagenUsed = 0; ttsCharsUsed = 0;
                await pool.execute(
                    'UPDATE users SET demo_flux_max_monthly_used=0, demo_flux_pro_monthly_used=0, demo_imagen_monthly_used=0, demo_tts_monthly_chars_used=0, demo_usage_last_reset_month=? WHERE id=?',
                    [currentYearMonth, user.id]
                );
            }
            
            const limits = {
                fluxKontextMaxMonthlyUsesLeft: Math.max(0, DEMO_USER_MONTHLY_LIMITS.FLUX_KONTEX_MAX_MONTHLY - fluxMaxUsed),
                fluxKontextMaxMonthlyMaxUses: DEMO_USER_MONTHLY_LIMITS.FLUX_KONTEX_MAX_MONTHLY,
                fluxKontextProMonthlyUsesLeft: Math.max(0, DEMO_USER_MONTHLY_LIMITS.FLUX_KONTEX_PRO_MONTHLY - fluxProUsed),
                fluxKontextProMonthlyMaxUses: DEMO_USER_MONTHLY_LIMITS.FLUX_KONTEX_PRO_MONTHLY,
                imagen3MonthlyImagesLeft: Math.max(0, DEMO_USER_MONTHLY_LIMITS.IMAGEN3_MONTHLY_IMAGES - imagenUsed),
                imagen3MonthlyMaxImages: DEMO_USER_MONTHLY_LIMITS.IMAGEN3_MONTHLY_IMAGES,
                openaiTtsMonthlyCharsLeft: Math.max(0, DEMO_USER_MONTHLY_LIMITS.OPENAI_TTS_MONTHLY_CHARS - ttsCharsUsed),
                openaiTtsMonthlyMaxChars: DEMO_USER_MONTHLY_LIMITS.OPENAI_TTS_MONTHLY_CHARS,
            };
            return res.json({
                success: true, isDemoUser: true, username: user.username,
                demoUserToken: user.username, // Using username as token for demo user
                limits
            });
        } else {
            console.log(`[Login] User "${user.username}" found, but has unhandled user_type: ${user.user_type}.`);
            return res.status(403).json({ success: false, message: "Access denied for this user type." });
        }
    } catch (dbError) {
        console.error("[DB Auth Error]", dbError);
        return res.status(500).json({ success: false, message: "Database error during authentication." });
    }
});


const GEMINI_API_KEY_PROXY = process.env.GEMINI_API_KEY;
let ai;
if (GEMINI_API_KEY_PROXY) {
  ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY_PROXY });
  console.log("Google GenAI SDK initialized.");
} else console.warn("PROXY WARNING: GEMINI_API_KEY missing.");

app.post('/api/gemini/chat/stream', paidOrDemoUserAuthMiddleware, async (req, res) => { // Ensure middleware runs
    if (!ai) return res.status(500).json({ error: "Google GenAI SDK not initialized." });
    const { modelName, historyContents, modelSettings, enableGoogleSearch } = req.body;
    if (!modelName || !historyContents || !modelSettings) return res.status(400).json({ error: "Missing fields." });
    // DEMO user limits for Gemini chat are not implemented yet, allow for now if authenticated.
    try {
        const tools = enableGoogleSearch ? [{googleSearch: {}}] : [];
        const config = {
            systemInstruction: modelSettings.systemInstruction,
            temperature: modelSettings.temperature,
            topK: modelSettings.topK,
            topP: modelSettings.topP,
            tools: tools.length > 0 ? tools : undefined
        };
        const stream = await ai.models.generateContentStream({ model: modelName, contents: historyContents, config: config });
        res.setHeader('Content-Type', 'text/plain'); 
        for await (const chunk of stream) {
            const textContent = chunk.text; 
            const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
            const responseChunk = { textDelta: textContent || "", groundingSources: [] };
            if (groundingMetadata?.groundingChunks) {
                groundingMetadata.groundingChunks.forEach(gc => { if (gc.web?.uri) responseChunk.groundingSources.push({ uri: gc.web.uri, title: gc.web.title || gc.web.uri }); });
            }
            res.write(JSON.stringify(responseChunk) + '\n');
        }
        res.end();
    } catch (error) {
        console.error("[Gemini Chat Stream Proxy Error]", error);
        const errorMessage = String(error.statusInfo?.message || error.message || "Gemini stream failed due to an internal server error.");
        const errorStatus = error.status || 500;
        if (!res.headersSent) res.status(errorStatus).type('application/json').send(JSON.stringify({ error: errorMessage }));
        else { res.write(JSON.stringify({ error: `Gemini stream failed mid-stream: ${errorMessage}` }) + '\n'); res.end(); }
    }
});

app.post('/api/gemini/image/generate', paidOrDemoUserAuthMiddleware, async (req, res) => {
  try {
    const { modelName, prompt, modelSettings } = req.body;
    const numImagesToGenerate = Math.max(1, Math.min(4, modelSettings?.numberOfImages || 1));

    if (req.isPaidUser) {
      console.log(`[Imagen Proxy] Paid user ${req.paidUser.username} generating ${numImagesToGenerate} image(s).`);
    } else if (req.isDemoUser) {
      if (!req.demoUser || !pool) {
          return res.status(500).json({ error: "Internal server error: Demo user data or DB not found."});
      }
      const remainingUses = DEMO_USER_MONTHLY_LIMITS.IMAGEN3_MONTHLY_IMAGES - req.demoUser.imagenMonthlyUsed;
      if (numImagesToGenerate > remainingUses) {
        return res.status(429).json({ error: `Monthly Imagen3 limit for DEMO user reached. You have ${remainingUses} image(s) left (requested ${numImagesToGenerate}).`, limitReached: true, usesLeft: remainingUses });
      }
    } else { 
      return res.status(401).json({ error: "User not authenticated for Imagen generation." });
    }

    if (!ai) return res.status(500).json({ error: "Google GenAI SDK not initialized." });
    if (!modelName || !prompt || !modelSettings) return res.status(400).json({ error: "Missing fields for Imagen." });

    const config = {
        numberOfImages: numImagesToGenerate,
        outputMimeType: modelSettings.outputMimeType || 'image/jpeg',
        ...(modelSettings.aspectRatio && modelSettings.aspectRatio !== 'default' && { aspectRatio: modelSettings.aspectRatio }),
    };
    const response = await ai.models.generateImages({ model: modelName, prompt: prompt, config: config });

    if (req.isDemoUser && req.demoUser) {
      const numGenerated = response.generatedImages?.length || 0;
      await pool.execute(
          'UPDATE users SET demo_imagen_monthly_used = demo_imagen_monthly_used + ? WHERE id = ?',
          [numGenerated, req.demoUser.id]
      );
      console.log(`[Demo Usage] Imagen: User ${req.demoUser.username} used ${numGenerated} images. New monthly total: ${req.demoUser.imagenMonthlyUsed + numGenerated}/${DEMO_USER_MONTHLY_LIMITS.IMAGEN3_MONTHLY_IMAGES}`);
    }
    res.json(response);
  } catch (error) {
    console.error("[Imagen Proxy Error]", error);
    let msgString = "Imagen generation failed due to an internal server error.";
    if (error instanceof Error) msgString = error.message;
    else if (error.statusInfo?.message) msgString = String(error.statusInfo.message);
    const errorStatus = error.status || 500;
    if (!res.headersSent) return res.status(errorStatus).json({ error: `Imagen generation failed: ${msgString}` });
    else console.error("[Imagen Proxy Error] Headers already sent.");
  }
});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';
if (OPENAI_API_KEY) console.log("OpenAI API Key found."); else console.warn("PROXY WARNING: OPENAI_API_KEY missing.");

app.post('/api/openai/chat/stream', paidOrDemoUserAuthMiddleware, async (req, res) => {
    try {
        if (!OPENAI_API_KEY) return res.status(500).json({ error: "OpenAI API Key not configured." });
        const { modelIdentifier, history, modelSettings } = req.body;
        if (!modelIdentifier || !history || !modelSettings) return res.status(400).json({ error: "Missing fields." });
        // DEMO user limits for OpenAI chat are not implemented yet, allow for now if authenticated.
        const openaiResponse = await fetch(OPENAI_CHAT_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
            body: JSON.stringify({ model: modelIdentifier, messages: history, temperature: modelSettings.temperature, top_p: modelSettings.topP, stream: true }),
        });
        if (!openaiResponse.ok) {
            const errTxt = await openaiResponse.text();
            const errorMsg = `OpenAI Error: ${String(errTxt).substring(0,100)}`;
            res.status(openaiResponse.status); 
            res.setHeader('Content-Type', 'text/event-stream'); 
            res.write(`data: ${JSON.stringify({error: errorMsg, isFinished: true})}\n\n`);
            return res.end();
        }
        res.setHeader('Content-Type', 'text/event-stream');
        openaiResponse.body.pipe(res);
    } catch (error) {
        console.error("[OpenAI Chat Proxy Error]", error);
        let errorMsg = "OpenAI chat stream failed on proxy.";
        if (error instanceof Error) errorMsg = error.message;
        if (!res.headersSent) res.status(500); res.setHeader('Content-Type', 'text/event-stream');
        res.write(`data: ${JSON.stringify({error: errorMsg, isFinished: true})}\n\n`);
        if (!res.writableEnded) res.end();
    }
});

app.post('/api/openai/tts/generate', paidOrDemoUserAuthMiddleware, async (req, res) => {
  try {
    const { modelIdentifier, textInput, voice, speed, responseFormat = 'mp3' } = req.body;
    const currentChars = textInput ? textInput.length : 0;

    if (req.isPaidUser) {
      if (currentChars > PAID_USER_MAX_LIMITS_CONFIG.OPENAI_TTS_MAX_CHARS_TOTAL) {
          return res.status(413).json({ error: `Input too long for Paid user TTS. Max: ${PAID_USER_MAX_LIMITS_CONFIG.OPENAI_TTS_MAX_CHARS_TOTAL}`, limitReached: true });
      }
      console.log(`[OpenAI TTS Proxy] Paid user ${req.paidUser.username} generating audio for ${currentChars} chars.`);
    } else if (req.isDemoUser) {
      if (!req.demoUser || !pool) {
          return res.status(500).json({ error: "Internal server error: Demo user data or DB not found."});
      }
      const remainingChars = DEMO_USER_MONTHLY_LIMITS.OPENAI_TTS_MONTHLY_CHARS - req.demoUser.ttsMonthlyCharsUsed;
      if (currentChars > remainingChars) {
        return res.status(429).json({ error: `Monthly TTS character limit for DEMO user reached. Remaining: ${remainingChars}, requested: ${currentChars}`, limitReached: true });
      }
    } else {
      return res.status(401).json({ error: "User not authenticated for TTS." });
    }
    if (!modelIdentifier || !textInput || !voice || speed === undefined) return res.status(400).json({ error: "Missing fields for OpenAI TTS." });

    const openaiResponse = await fetch(OPENAI_TTS_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}`},
        body: JSON.stringify({ model: modelIdentifier, input: textInput, voice: voice, speed: speed, response_format: responseFormat }),
    });
    if (!openaiResponse.ok) {
        const errData = await openaiResponse.json().catch(() => ({}));
        const errorMsg = String(errData.error?.message || "OpenAI TTS API Error");
        return res.status(openaiResponse.status).json({ error: errorMsg });
    }
    if (req.isDemoUser && req.demoUser) {
      await pool.execute(
          'UPDATE users SET demo_tts_monthly_chars_used = demo_tts_monthly_chars_used + ? WHERE id = ?',
          [currentChars, req.demoUser.id]
      );
      console.log(`[Demo Usage] TTS: User ${req.demoUser.username} used ${currentChars} chars. New monthly total: ${req.demoUser.ttsMonthlyCharsUsed + currentChars}/${DEMO_USER_MONTHLY_LIMITS.OPENAI_TTS_MONTHLY_CHARS}`);
    }
    res.setHeader('Content-Type', `audio/${responseFormat}`);
    openaiResponse.body.pipe(res);
  } catch (error) {
    console.error("[OpenAI TTS Proxy Error]", error);
    let errorMsg = "Failed to generate audio via proxy.";
    if (error instanceof Error) errorMsg = error.message;
    if (!res.headersSent) res.status(500).json({ error: errorMsg });
  }
});

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/chat/completions';
if (DEEPSEEK_API_KEY) console.log("Deepseek API Key found."); else console.warn("PROXY WARNING: DEEPSEEK_API_KEY missing.");

app.post('/api/deepseek/chat/stream', paidOrDemoUserAuthMiddleware, async (req, res) => {
    try {
        if (!DEEPSEEK_API_KEY) return res.status(500).json({ error: "Deepseek API Key not configured." });
        const { modelIdentifier, history, modelSettings } = req.body;
        if (!modelIdentifier || !history || !modelSettings) return res.status(400).json({ error: "Missing fields." });
        // DEMO user limits for Deepseek chat are not implemented yet, allow for now if authenticated.
        const dsResponse = await fetch(DEEPSEEK_CHAT_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
            body: JSON.stringify({ model: modelIdentifier, messages: history, temperature: modelSettings.temperature, top_p: modelSettings.topP, stream: true }),
        });
        if (!dsResponse.ok) {
            const errTxt = await dsResponse.text();
            const errorMsg = `Deepseek Error: ${String(errTxt).substring(0,100)}`;
            res.status(dsResponse.status);
            res.setHeader('Content-Type', 'text/event-stream');
            res.write(`data: ${JSON.stringify({error: errorMsg, isFinished: true})}\n\n`);
            return res.end();
        }
        res.setHeader('Content-Type', 'text/event-stream');
        dsResponse.body.pipe(res);
    } catch (error) {
        console.error("[Deepseek Chat Proxy Error]", error);
        let errorMsg = "Deepseek chat stream failed on proxy.";
        if (error instanceof Error) errorMsg = error.message;
        if (!res.headersSent) res.status(500); res.setHeader('Content-Type', 'text/event-stream');
        res.write(`data: ${JSON.stringify({error: errorMsg, isFinished: true})}\n\n`);
        if (!res.writableEnded) res.end();
    }
});

const FAL_KEY = process.env.FAL_KEY;
if (FAL_KEY) console.log("Fal.ai Key (FAL_KEY) found."); else console.warn("PROXY WARNING: FAL_KEY not found. Fal.ai endpoints will likely fail.");

app.post('/api/fal/image/edit/flux-kontext', paidOrDemoUserAuthMiddleware, async (req, res) => {
  try {
    if (!FAL_KEY) return res.status(500).json({ error: "Fal.ai API Key not configured." });
    const { modelIdentifier, prompt, image_base_64, image_mime_type, images_data, ...settings } = req.body;
    if (!modelIdentifier || !prompt) return res.status(400).json({ error: "Missing modelIdentifier or prompt for Flux." });
    
    const isFluxMax = modelIdentifier === 'fal-ai/flux-pro/kontext/max/multi';
    const isFluxPro = modelIdentifier === 'fal-ai/flux-pro/kontext';

    if (isFluxMax && (!images_data || !Array.isArray(images_data) || images_data.length === 0)) {
        return res.status(400).json({ error: "Flux Max requires 'images_data' array." });
    } else if (isFluxPro && (!image_base_64 || !image_mime_type)) {
        return res.status(400).json({ error: "Flux Pro requires 'image_base_64' and 'image_mime_type'." });
    }
    
    // Limit checks
    if (req.isPaidUser && req.paidUser) {
        const yearMonth = getCurrentYearMonth();
        const monthlyUsage = paidUserFluxMonthlyUsageStore[req.paidUser.username]?.[yearMonth];
        if (!monthlyUsage) return res.status(500).json({ error: "Paid user usage data not found." });
        if (isFluxMax && monthlyUsage.fluxMaxUsed >= PAID_USER_MAX_LIMITS_CONFIG.FLUX_KONTEX_MAX_MONTHLY_MAX_USES) {
            return res.status(429).json({ error: `Monthly Flux Max limit reached.`, limitReached: true });
        }
        if (isFluxPro && monthlyUsage.fluxProUsed >= PAID_USER_MAX_LIMITS_CONFIG.FLUX_KONTEX_PRO_MONTHLY_MAX_USES) {
            return res.status(429).json({ error: `Monthly Flux Pro limit reached.`, limitReached: true });
        }
    } else if (req.isDemoUser && req.demoUser) {
        if (!pool) return res.status(500).json({ error: "DB not available for DEMO limit check." });
        const limitToCheck = isFluxMax ? DEMO_USER_MONTHLY_LIMITS.FLUX_KONTEX_MAX_MONTHLY : DEMO_USER_MONTHLY_LIMITS.FLUX_KONTEX_PRO_MONTHLY;
        const usedCount = isFluxMax ? req.demoUser.fluxMaxMonthlyUsed : req.demoUser.fluxProMonthlyUsed;
        if (usedCount >= limitToCheck) {
            return res.status(429).json({ error: `Monthly ${isFluxMax ? 'Flux Max' : 'Flux Pro'} limit for DEMO user reached.`, limitReached: true });
        }
    } else {
      return res.status(401).json({ error: "User not authenticated for Flux." });
    }

    let falInput = { prompt, ...PROXY_DEFAULT_FLUX_KONTEX_SETTINGS, ...settings };
    if (isFluxMax) falInput.image_urls = images_data.map(img => `data:${img.mimeType};base64,${img.base64}`);
    else falInput.image_url = `data:${image_mime_type};base64,${image_base_64}`;
    if (modelIdentifier === 'fal-ai/flux-pro/kontext/max/multi' && falInput.num_inference_steps) delete falInput.num_inference_steps;


    const queueResult = await fal.queue.submit(modelIdentifier, { input: falInput });
    if (!queueResult?.request_id) return res.status(500).json({ error: "Fal.ai submission failed (no request ID)." });

    // Update usage counts
    if (req.isPaidUser && req.paidUser) {
        const yearMonth = getCurrentYearMonth();
        if (isFluxMax) paidUserFluxMonthlyUsageStore[req.paidUser.username][yearMonth].fluxMaxUsed += 1;
        if (isFluxPro) paidUserFluxMonthlyUsageStore[req.paidUser.username][yearMonth].fluxProUsed += 1;
        console.log(`[Paid Usage] Flux (${isFluxMax ? 'Max' : 'Pro'}): User ${req.paidUser.username}. Total used this month - Max: ${paidUserFluxMonthlyUsageStore[req.paidUser.username][yearMonth].fluxMaxUsed}, Pro: ${paidUserFluxMonthlyUsageStore[req.paidUser.username][yearMonth].fluxProUsed}`);
    } else if (req.isDemoUser && req.demoUser) {
        const fieldToUpdate = isFluxMax ? 'demo_flux_max_monthly_used' : 'demo_flux_pro_monthly_used';
        await pool.execute(`UPDATE users SET ${fieldToUpdate} = ${fieldToUpdate} + 1 WHERE id = ?`, [req.demoUser.id]);
        console.log(`[Demo Usage] Flux (${isFluxMax ? 'Max' : 'Pro'}): User ${req.demoUser.username} used 1 attempt.`);
    }
    res.json({ requestId: queueResult.request_id, message: "Image editing request submitted." });
  } catch (error) {
    console.error("[Flux Edit Proxy Error]", error);
    res.status(500).json({ error: `Flux Edit Error: ${error.message || "Internal server error"}` });
  }
});

app.post('/api/fal/image/edit/status', async (req, res) => {
  try {
    if (!FAL_KEY) return res.status(500).json({ error: "Fal.ai API Key not configured." });
    const { requestId, modelIdentifier } = req.body;
    if (!requestId || !modelIdentifier) return res.status(400).json({ error: "Missing requestId or modelIdentifier." });

    const statusResult = await fal.queue.status(modelIdentifier, { requestId });
    let responsePayload = { status: statusResult?.status, rawResult: statusResult };

    if (statusResult?.status === 'COMPLETED') {
        const jobResult = await fal.queue.result(modelIdentifier, { requestId });
        responsePayload.rawResult = jobResult; // Ensure full result is in rawResult
        let imageUrl = jobResult?.images?.[0]?.url || jobResult?.data?.images?.[0]?.url;
        if (imageUrl) {
            responsePayload.editedImageUrl = imageUrl;
            responsePayload.message = "Image editing completed successfully.";
        } else {
            responsePayload.status = 'COMPLETED_NO_IMAGE';
            responsePayload.message = "Processing completed, but no image URL found.";
            responsePayload.error = "Fal.ai result did not contain an image URL.";
        }
    } else if (statusResult?.status === 'ERROR') {
        responsePayload.error = statusResult.error?.message || "Fal.ai reported an error.";
        responsePayload.message = "Image editing failed.";
    } else if (!statusResult) {
        return res.status(404).json({ status: 'NOT_FOUND', error: `Request ID ${requestId} not found.` });
    }
    res.json(responsePayload);
  } catch (error) {
    console.error("[Flux Status Proxy Error]", error);
    res.status(500).json({ status: 'PROXY_REQUEST_ERROR', error: `Fal Status Check Error: ${error.message || "Internal server error"}` });
  }
});


app.listen(port, () => {
  console.log(`AI Chat Proxy Server listening at http://localhost:${port}`);
  if (allowedOrigins.length === 0) console.warn("PROXY WARNING: CORS_ALLOWED_ORIGINS not set.");
  else if (allowedOrigins.includes('*')) console.warn("PROXY WARNING: CORS_ALLOWED_ORIGINS is '*'.");
  else console.log(`CORS allows requests from: ${allowedOrigins.join(', ')}`);
  if (!pool) console.error("WARNING: MySQL connection pool IS NOT available. DB operations will fail.");
});
