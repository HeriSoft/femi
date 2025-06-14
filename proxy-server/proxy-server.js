
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
  // safety_tolerance: 5, // REMOVED - Not standard for Flux Kontext by Fal.ai
  // num_inference_steps: 30, // REMOVED - Not standard for Flux Kontext edit models by Fal.ai
  seed: null,
  num_images: 1,
  aspect_ratio: 'default',
  output_format: 'jpeg',
};

const PROXY_DEFAULT_FLUX_ULTRA_SETTINGS = {
  aspect_ratio: '16:9', // Updated from image_size, matches Fal.ai default for flux-pro/v1.1-ultra
  num_inference_steps: 28,
  seed: null,
  guidance_scale: 3.5,
  num_images: 1,
  enable_safety_checker: true,
  output_format: 'jpeg', // Fal.ai documentation implies jpeg is default
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

if (!LOGIN_CODE_AUTH_ADMIN) console.warn("PROXY WARNING: LOGIN_CODE_AUTH_ADMIN not found. Admin login will not function.");
else console.log("LOGIN_CODE_AUTH_ADMIN is SET for admin.");


// --- NAMED DEMO USER CONSTANTS (from DB) ---
const DEMO_USER_MONTHLY_LIMITS = {
  FLUX_KONTEX_MAX_MONTHLY: 0, // Flux Kontext Max is paid only, but keeping structure
  FLUX_KONTEX_PRO_MONTHLY: 1,
  IMAGEN3_MONTHLY_IMAGES: 20,
  OPENAI_TTS_MONTHLY_CHARS: 10000,
  FLUX_ULTRA_MONTHLY_IMAGES: 0, // Flux Ultra is paid only, so DEMO gets 0.
};

// --- PAID USER LIMITS ---
const PAID_USER_MAX_LIMITS_CONFIG = {
  IMAGEN3_MAX_IMAGES_PER_DAY: 50,
  OPENAI_TTS_MAX_CHARS_TOTAL: 20000,
  FLUX_KONTEX_MAX_MONTHLY_MAX_USES: 40,
  FLUX_KONTEX_PRO_MONTHLY_MAX_USES: 50,
  FLUX_ULTRA_MONTHLY_MAX_IMAGES: 100, // Renamed from FLUX_DEV
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
    const paidUserToken = req.headers['x-paid-user-token'];
    const demoUserToken = req.headers['x-demo-token'];

    req.isPaidUser = false;
    req.isDemoUser = false;
    req.authDbError = false;
    req.authenticationAttempted = false;
    req.authenticationFailed = false;


    if (paidUserToken) {
        req.authenticationAttempted = true;
        try {
            if (!pool) {
                console.error("[Paid Auth Middleware Error] Database pool not available.");
                req.authDbError = true;
                return next();
            }
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
                            paidUserFluxMonthlyUsageStore[user.username][yearMonth] = { fluxMaxUsed: 0, fluxProUsed: 0, fluxUltraUsed: 0 };
                        }
                        req.paidUser.fluxMaxMonthlyUsed = paidUserFluxMonthlyUsageStore[user.username][yearMonth].fluxMaxUsed;
                        req.paidUser.fluxProMonthlyUsed = paidUserFluxMonthlyUsageStore[user.username][yearMonth].fluxProUsed;
                        req.paidUser.fluxUltraMonthlyUsed = paidUserFluxMonthlyUsageStore[user.username][yearMonth].fluxUltraUsed;
                        req.isPaidUser = true;
                    } else {
                        req.authenticationFailed = true; // Subscription invalid
                    }
                } else {
                    req.authenticationFailed = true; // User type not PAID
                }
            } else {
                req.authenticationFailed = true; // User not found
            }
        } catch (dbError) {
            console.error("[Paid Auth DB Error]", dbError);
            req.authDbError = true;
            req.authenticationFailed = true; // DB error implies auth failure for this attempt
        }
    } else if (demoUserToken) {
        req.authenticationAttempted = true;
        try {
            if (!pool) {
                console.error("[Demo Auth Middleware Error] Database pool not available.");
                req.authDbError = true;
                return next();
            }
            const [users] = await pool.execute(
                'SELECT id, username, user_type, demo_flux_max_monthly_used, demo_flux_pro_monthly_used, demo_imagen_monthly_used, demo_tts_monthly_chars_used, demo_flux_ultra_monthly_used, demo_usage_last_reset_month FROM users WHERE username = ? AND user_type = "DEMO"',
                [demoUserToken]
            );
            if (users.length > 0) {
                const user = users[0];
                req.demoUser = {
                    id: user.id, username: user.username, isDemoUser: true,
                    fluxMaxMonthlyUsed: user.demo_flux_max_monthly_used || 0,
                    fluxProMonthlyUsed: user.demo_flux_pro_monthly_used || 0,
                    imagenMonthlyUsed: user.demo_imagen_monthly_used || 0,
                    ttsMonthlyCharsUsed: user.demo_tts_monthly_chars_used || 0,
                    fluxUltraMonthlyUsed: user.demo_flux_ultra_monthly_used || 0,
                    usageLastResetMonth: user.demo_usage_last_reset_month
                };
                req.isDemoUser = true;
            } else {
                 req.authenticationFailed = true; // Demo user not found or not DEMO type
            }
        } catch (dbError) {
            console.error("[Demo Auth DB Error]", dbError);
            req.authDbError = true;
            req.authenticationFailed = true; // DB error implies auth failure for this attempt
        }
    }
    next();
}
app.use(paidOrDemoUserAuthMiddleware);

app.post('/api/auth/verify-code', async (req, res) => {
    const { code } = req.body;

    if (code === LOGIN_CODE_AUTH_ADMIN) {
        if (!LOGIN_CODE_AUTH_ADMIN) return res.status(500).json({ success: false, message: "Admin login not configured." });
        console.log("[Admin Login] Successful via LOGIN_CODE_AUTH_ADMIN.");
        return res.json({ success: true, isAdmin: true, message: "Admin login successful." });
    }

    if (!pool) return res.status(503).json({ success: false, message: "Database service unavailable." });

    try {
        const [users] = await pool.execute(
            'SELECT id, username, user_type, password_hash, demo_flux_max_monthly_used, demo_flux_pro_monthly_used, demo_imagen_monthly_used, demo_tts_monthly_chars_used, demo_flux_ultra_monthly_used, demo_usage_last_reset_month FROM users WHERE username = ?',
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
                    paidUserFluxMonthlyUsageStore[user.username][yearMonth] = { fluxMaxUsed: 0, fluxProUsed: 0, fluxUltraUsed: 0 };
                }
                const userMonthlyUsage = paidUserFluxMonthlyUsageStore[user.username][yearMonth];

                return res.json({
                    success: true, isPaidUser: true, username: user.username,
                    paidUserToken: user.username, 
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
                        fluxUltraMonthlyImagesLeft: PAID_USER_MAX_LIMITS_CONFIG.FLUX_ULTRA_MONTHLY_MAX_IMAGES - userMonthlyUsage.fluxUltraUsed,
                        fluxUltraMonthlyMaxImages: PAID_USER_MAX_LIMITS_CONFIG.FLUX_ULTRA_MONTHLY_MAX_IMAGES,
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
                demo_flux_ultra_monthly_used: fluxUltraUsed = 0,
                demo_usage_last_reset_month: lastResetMonth
            } = user;

            if (lastResetMonth !== currentYearMonth) {
                console.log(`[DEMO Login] Resetting monthly limits for DEMO user ${user.username} for new month ${currentYearMonth}. Old month: ${lastResetMonth}`);
                fluxMaxUsed = 0; fluxProUsed = 0; imagenUsed = 0; ttsCharsUsed = 0; fluxUltraUsed = 0;
                await pool.execute(
                    'UPDATE users SET demo_flux_max_monthly_used=0, demo_flux_pro_monthly_used=0, demo_imagen_monthly_used=0, demo_tts_monthly_chars_used=0, demo_flux_ultra_monthly_used=0, demo_usage_last_reset_month=? WHERE id=?',
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
                fluxUltraMonthlyImagesLeft: Math.max(0, DEMO_USER_MONTHLY_LIMITS.FLUX_ULTRA_MONTHLY_IMAGES - fluxUltraUsed),
                fluxUltraMonthlyMaxImages: DEMO_USER_MONTHLY_LIMITS.FLUX_ULTRA_MONTHLY_IMAGES,
            };
            return res.json({
                success: true, isDemoUser: true, username: user.username,
                demoUserToken: user.username, 
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

app.post('/api/gemini/chat/stream', async (req, res) => {
    if (req.authDbError) {
        console.log(`[Gemini Chat Stream Proxy] Access denied due to database error during authentication (IP: ${getClientIp(req)}).`);
        return res.status(503).json({ error: "Service temporarily unavailable due to a database issue during authentication. Please try again later." });
    }
    if (req.authenticationAttempted && req.authenticationFailed) {
        console.log(`[Gemini Chat Stream Proxy] Access denied for user with invalid/expired token (IP: ${getClientIp(req)}).`);
        return res.status(403).json({ error: "Access Denied. Your session token is invalid, expired, or your account access has been restricted." });
    }
    // If we reach here, user is either Admin (no token), or valid Paid/Demo user.

    if (!ai) return res.status(500).json({ error: "Google GenAI SDK not initialized." });
    const { modelName, historyContents, modelSettings, enableGoogleSearch } = req.body;
    if (!modelName || !historyContents || !modelSettings) return res.status(400).json({ error: "Missing fields." });

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
        console.error("[Gemini Chat Stream Proxy Error]", error);
        const errorMessage = String(error.statusInfo?.message || error.message || "Gemini stream failed due to an internal server error.");
        const errorStatus = error.status || 500;
        if (!res.headersSent) {
            res.status(errorStatus).type('application/json').send(JSON.stringify({ error: errorMessage }));
        } else {
            res.write(JSON.stringify({ error: `Gemini stream failed mid-stream: ${errorMessage}` }) + '\n');
            res.end();
        }
    }
});

app.post('/api/gemini/image/generate', async (req, res) => {
  try {
    if (req.authDbError) {
        return res.status(503).json({ error: "Service temporarily unavailable due to a database issue during authentication." });
    }
    if (req.authenticationAttempted && req.authenticationFailed) {
        return res.status(403).json({ error: "Access Denied. Your session token is invalid, expired, or your account access has been restricted." });
    }

    if (!ai) return res.status(500).json({ error: "Google GenAI SDK not initialized." });
    const { modelName, prompt, modelSettings } = req.body;
    if (!modelName || !prompt || !modelSettings) return res.status(400).json({ error: "Missing fields for Imagen." });

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
      console.log(`[Imagen Proxy] Admin or un-tokened user (IP: ${getClientIp(req)}) generating ${numImagesToGenerate} image(s). No specific limits applied.`);
    }

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

app.post('/api/openai/chat/stream', async (req, res) => {
    if (req.authDbError) {
        return res.status(503).json({ error: "Service temporarily unavailable due to a database issue during authentication. Please try again later." });
    }
    if (req.authenticationAttempted && req.authenticationFailed) {
        return res.status(403).json({ error: "Access Denied. Your session token is invalid, expired, or your account access has been restricted." });
    }
    
    try {
        if (!OPENAI_API_KEY) return res.status(500).json({ error: "OpenAI API Key not configured." });
        const { modelIdentifier, history, modelSettings } = req.body;
        if (!modelIdentifier || !history || !modelSettings) return res.status(400).json({ error: "Missing fields." });
        
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

app.post('/api/openai/tts/generate', async (req, res) => {
  try {
    if (req.authDbError) {
        return res.status(503).json({ error: "Service temporarily unavailable due to a database issue during authentication." });
    }
    if (req.authenticationAttempted && req.authenticationFailed) {
        return res.status(403).json({ error: "Access Denied. Your session token is invalid, expired, or your account access has been restricted." });
    }
    if (!OPENAI_API_KEY) return res.status(500).json({ error: "OpenAI API Key not configured." });
    const { modelIdentifier, textInput, voice, speed, responseFormat = 'mp3' } = req.body;
    if (!modelIdentifier || !textInput || !voice || speed === undefined) return res.status(400).json({ error: "Missing fields for OpenAI TTS." });

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
      console.log(`[OpenAI TTS Proxy] Admin or un-tokened user (IP: ${getClientIp(req)}) generating audio for ${currentChars} chars.`);
      if (currentChars > PAID_USER_MAX_LIMITS_CONFIG.OPENAI_TTS_MAX_CHARS_TOTAL) { 
        return res.status(413).json({ error: `Input too long for TTS. Max: ${PAID_USER_MAX_LIMITS_CONFIG.OPENAI_TTS_MAX_CHARS_TOTAL}`, limitReached: true });
      }
    }
    
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

app.post('/api/deepseek/chat/stream', async (req, res) => {
    if (req.authDbError) {
        return res.status(503).json({ error: "Service temporarily unavailable due to a database issue during authentication. Please try again later." });
    }
    if (req.authenticationAttempted && req.authenticationFailed) {
        return res.status(403).json({ error: "Access Denied. Your session token is invalid, expired, or your account access has been restricted." });
    }

    try {
        if (!DEEPSEEK_API_KEY) return res.status(500).json({ error: "Deepseek API Key not configured." });
        const { modelIdentifier, history, modelSettings } = req.body;
        if (!modelIdentifier || !history || !modelSettings) return res.status(400).json({ error: "Missing fields." });

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

app.post('/api/fal/image/edit/flux-kontext', async (req, res) => {
  try {
    if (req.authDbError) {
        return res.status(503).json({ error: "Service temporarily unavailable due to a database issue during authentication." });
    }
     if (req.authenticationAttempted && req.authenticationFailed) {
        return res.status(403).json({ error: "Access Denied. Your session token is invalid, expired, or your account access has been restricted." });
    }
    if (!FAL_KEY) return res.status(500).json({ error: "Fal.ai API Key not configured." });
    const { modelIdentifier, prompt, image_base_64, image_mime_type, images_data, ...clientSettings } = req.body;
    if (!modelIdentifier || !prompt) return res.status(400).json({ error: "Missing modelIdentifier or prompt for Flux." });

    const isFluxMax = modelIdentifier === 'fal-ai/flux-pro/kontext/max/multi';
    const isFluxPro = modelIdentifier === 'fal-ai/flux-pro/kontext'; 

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
      console.log(`[Fal Flux Kontext Proxy] Admin or un-tokened user (IP: ${getClientIp(req)}) using Flux Kontext.`);
    }

    const effectiveSettings = {
        ...PROXY_DEFAULT_FLUX_KONTEX_SETTINGS, 
        ...clientSettings 
    };
    
    let falInputPayload = { prompt };

    if (isFluxMax) {
        if (!images_data || !Array.isArray(images_data) || images_data.length === 0) {
            return res.status(400).json({ error: "Flux Max requires 'images_data' array." });
        }
        falInputPayload.image_urls = images_data.map(img => {
            if (!img.base64 || !img.mimeType) { 
                console.error("Invalid item in images_data:", img); 
                throw new Error("Invalid image data item in images_data array. Each item must have base64 and mimeType.");
            }
            return `data:${img.mimeType};base64,${img.base64}`;
        });
    } else { 
        if (!image_base_64 || !image_mime_type) {
            return res.status(400).json({ error: "Flux Pro requires 'image_base_64' and 'image_mime_type'." });
        }
        falInputPayload.image_url = `data:${image_mime_type};base64,${image_base_64}`;
    }

    if (effectiveSettings.seed !== undefined && effectiveSettings.seed !== null) falInputPayload.seed = effectiveSettings.seed;
    if (effectiveSettings.guidance_scale !== undefined) falInputPayload.guidance_scale = effectiveSettings.guidance_scale;
    if (effectiveSettings.num_images !== undefined) falInputPayload.num_images = effectiveSettings.num_images;
    if (effectiveSettings.aspect_ratio && effectiveSettings.aspect_ratio !== 'default') { 
        falInputPayload.aspect_ratio = effectiveSettings.aspect_ratio;
    }
    if (effectiveSettings.output_format) falInputPayload.output_format = effectiveSettings.output_format;
    
    if (clientSettings.num_inference_steps !== undefined && modelIdentifier === 'fal-ai/flux-pro/kontext') { 
        falInputPayload.num_inference_steps = clientSettings.num_inference_steps;
    }
    if (clientSettings.safety_tolerance !== undefined) { 
        falInputPayload.safety_tolerance = clientSettings.safety_tolerance;
    }

    const queueResult = await fal.queue.submit(modelIdentifier, { input: falInputPayload });
    if (!queueResult?.request_id) return res.status(500).json({ error: "Fal.ai submission failed (no request ID)." });

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

app.post('/api/fal/image/generate/flux-ultra', async (req, res) => { 
  try {
    if (req.authDbError) {
        return res.status(503).json({ error: "Service temporarily unavailable due to a database issue during authentication." });
    }
     if (req.authenticationAttempted && req.authenticationFailed) {
        return res.status(403).json({ error: "Access Denied. Your session token is invalid, expired, or your account access has been restricted." });
    }
    if (!FAL_KEY) return res.status(500).json({ error: "Fal.ai API Key not configured." });
    const { modelIdentifier, prompt, ...settings } = req.body; 
    
    if (modelIdentifier !== 'fal-ai/flux-pro/v1.1-ultra') { 
        return res.status(400).json({ error: "Invalid modelIdentifier for Flux1.1 [Ultra]." });
    }
    if (!prompt) return res.status(400).json({ error: "Missing prompt for Flux1.1 [Ultra]." });

    const numImagesToGenerate = Math.max(1, Math.min(4, settings?.num_images || 1));

    if (req.isPaidUser && req.paidUser) {
      const yearMonth = getCurrentYearMonth();
      const monthlyUsage = paidUserFluxMonthlyUsageStore[req.paidUser.username]?.[yearMonth];
      if (!monthlyUsage) return res.status(500).json({ error: "Paid user usage data not found." });
      if ((monthlyUsage.fluxUltraUsed || 0) + numImagesToGenerate > PAID_USER_MAX_LIMITS_CONFIG.FLUX_ULTRA_MONTHLY_MAX_IMAGES) {
        return res.status(429).json({ error: `Monthly Flux1.1 [Ultra] image limit reached for paid user. Max: ${PAID_USER_MAX_LIMITS_CONFIG.FLUX_ULTRA_MONTHLY_MAX_IMAGES}, Used: ${monthlyUsage.fluxUltraUsed || 0}, Requested: ${numImagesToGenerate}`, limitReached: true });
      }
    } else if (req.isDemoUser) { 
        return res.status(403).json({ error: `Flux1.1 [Ultra] is for Paid Users only. DEMO users cannot use this model.`, limitReached: true });
    } else { 
      console.log(`[Fal Flux Ultra Proxy] Admin or un-tokened user (IP: ${getClientIp(req)}) using Flux Ultra.`);
    }

    const falInput = { prompt, ...PROXY_DEFAULT_FLUX_ULTRA_SETTINGS, ...settings, num_images: numImagesToGenerate }; 
    
    if (falInput.aspect_ratio === 'default') {
        delete falInput.aspect_ratio;
    }
    
    const queueResult = await fal.queue.submit(modelIdentifier, { input: falInput });
    if (!queueResult?.request_id) return res.status(500).json({ error: "Fal.ai Flux1.1 [Ultra] submission failed (no request ID)." });

    if (req.isPaidUser && req.paidUser) {
      const yearMonth = getCurrentYearMonth();
      paidUserFluxMonthlyUsageStore[req.paidUser.username][yearMonth].fluxUltraUsed = (paidUserFluxMonthlyUsageStore[req.paidUser.username][yearMonth].fluxUltraUsed || 0) + numImagesToGenerate;
      console.log(`[Paid Usage] Flux Ultra: User ${req.paidUser.username} generated ${numImagesToGenerate} images. New monthly total: ${paidUserFluxMonthlyUsageStore[req.paidUser.username][yearMonth].fluxUltraUsed}`);
    }
    
    res.json({ requestId: queueResult.request_id, message: "Flux1.1 [Ultra] image generation request submitted." });
  } catch (error) {
    console.error("[Flux Ultra Gen Proxy Error]", error);
    res.status(500).json({ error: `Flux Ultra Gen Error: ${error.message || "Internal server error"}` });
  }
});


app.post('/api/fal/image/edit/status', async (req, res) => {
  try {
    // For POST status checks, authentication might still be desired if the status endpoint could be abused.
    // For now, keeping it consistent with other Fal endpoints.
    if (req.authDbError && req.method === 'POST') { 
        return res.status(503).json({ error: "Service temporarily unavailable due to a database issue during authentication." });
    }
    if (req.authenticationAttempted && req.authenticationFailed && req.method === 'POST') {
       return res.status(403).json({ error: "Access Denied for status check due to invalid token." });
    }
    if (!FAL_KEY) return res.status(500).json({ error: "Fal.ai API Key not configured." });
    const { requestId, modelIdentifier } = req.body;
    if (!requestId || !modelIdentifier) return res.status(400).json({ error: "Missing requestId or modelIdentifier." });

    const statusResult = await fal.queue.status(modelIdentifier, { requestId });
    let responsePayload = { status: statusResult?.status, rawResult: statusResult };

    if (statusResult?.status === 'COMPLETED') {
        const jobResult = await fal.queue.result(modelIdentifier, { requestId });
        responsePayload.rawResult = jobResult; 

        let imageUrls = [];
        if (jobResult?.images && Array.isArray(jobResult.images)) { 
            imageUrls = jobResult.images.map(img => img?.url).filter(Boolean);
        }
        
        if (imageUrls.length === 0 && jobResult?.image_url && typeof jobResult.image_url === 'string') { 
            imageUrls.push(jobResult.image_url);
        }
        
        if (imageUrls.length === 0 && jobResult?.data?.images && Array.isArray(jobResult.data.images)) {
            imageUrls = jobResult.data.images.map(img => img?.url).filter(Boolean);
        }

        if (imageUrls.length > 0) {
            responsePayload.imageUrls = imageUrls; 
            responsePayload.imageUrl = imageUrls[0]; 
            responsePayload.message = "Image processing completed successfully.";
        } else {
            responsePayload.status = 'COMPLETED_NO_IMAGE'; 
            responsePayload.message = "Processing completed, but no image URL found in the result.";
            responsePayload.error = "Fal.ai result did not contain expected image URL(s). Raw result logged on proxy.";
            console.warn(`[Fal Status] COMPLETED_NO_IMAGE for ${modelIdentifier}, reqId ${requestId}. Raw result:`, JSON.stringify(jobResult, null, 2));
        }
    } else if (statusResult?.status === 'ERROR') {
        responsePayload.error = statusResult.error?.message || "Fal.ai reported an error.";
        responsePayload.message = "Image processing failed.";
    } else if (!statusResult) {
        return res.status(404).json({ status: 'NOT_FOUND', error: `Request ID ${requestId} not found for ${modelIdentifier}.` });
    }
    res.json(responsePayload);
  } catch (error) {
    console.error("[Fal Status Proxy Error]", error);
    if (error.response && error.response.status === 422) { 
        const falError = await error.response.json().catch(() => ({})); 
        return res.status(422).json({
            status: 'FAL_API_ERROR', 
            error: `Fal Status Check Error: Unprocessable Entity. ${falError.detail?.[0]?.msg || JSON.stringify(falError.detail) || ""}`,
            rawResult: falError 
        });
    }
    res.status(500).json({ status: 'PROXY_REQUEST_ERROR', error: `Fal Status Check Error: ${error.message || "Internal server error"}` });
  }
});

console.log("Debug: Type of app before listen:", typeof app);
console.log("Debug: Type of app.listen before listen:", typeof app.listen);
console.log("Debug: Script execution reached just before app.listen call.");

app.listen(port, () => {
  console.log(`AI Chat Proxy Server listening at http://localhost:${port}`);
  if (allowedOrigins.length === 0) console.warn("PROXY WARNING: CORS_ALLOWED_ORIGINS not set.");
  else if (allowedOrigins.includes('*')) console.warn("PROXY WARNING: CORS_ALLOWED_ORIGINS is '*'.");
  else console.log(`CORS allows requests from: ${allowedOrigins.join(', ')}`);
  if (!pool) console.error("WARNING: MySQL connection pool IS NOT available. DB operations will fail.");
});
