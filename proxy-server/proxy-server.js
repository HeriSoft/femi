
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
const DEMO_USER_LOGIN_CODE = process.env.DEMO_USER_LOGIN_CODE || "DEMO";

if (!LOGIN_CODE_AUTH_ADMIN) console.warn("PROXY WARNING: LOGIN_CODE_AUTH_ADMIN not found. Admin login will not function.");
else console.log("LOGIN_CODE_AUTH_ADMIN is SET for admin.");
console.log(`DEMO_USER_LOGIN_CODE is: ${DEMO_USER_LOGIN_CODE}`);


// --- DEMO MODE CONSTANTS & STORAGE ---
const DEMO_LIMITS_CONFIG_PROXY = {
  FLUX_KONTEX_MAX_USES_SESSION: 2, 
  IMAGEN3_MAX_IMAGES_SESSION: 10, 
  OPENAI_TTS_MAX_CHARS_TOTAL: 5000,
};

// --- PAID USER LIMITS ---
const PAID_USER_MAX_LIMITS_CONFIG = { // Renamed for clarity
  IMAGEN3_MAX_IMAGES_PER_DAY: 50, // Daily limit for Imagen
  OPENAI_TTS_MAX_CHARS_TOTAL: 20000, // Per use/session limit for TTS
  FLUX_KONTEX_MAX_MONTHLY_MAX_USES: 40, // Monthly limit for Flux Max
  FLUX_KONTEX_PRO_MONTHLY_MAX_USES: 50,  // Monthly limit for Flux Pro
};

const paidUserFluxMonthlyUsageStore = {}; // { [username]: { [yearMonth]: { fluxMaxUsed: number, fluxProUsed: number } } }

const demoUserUsageStore = {};
const DEMO_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;
const MIN_INTERVAL_BETWEEN_FULL_DEMO_RESETS_MS = 30 * 24 * 60 * 60 * 1000; 

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0]).trim();
  }
  return req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip;
}
function getTodaysDateString() { return new Date().toISOString().split('T')[0]; }
function getCurrentYearMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0'); // getMonth() is 0-indexed
    return `${year}-${month}`;
}


function manageDemoUserData(ip) {
  const today = getTodaysDateString();
  let userData = demoUserUsageStore[ip];
  const now = Date.now();
  
  console.log(`[ManageDemoUserData DEBUG] IP: ${ip}, Current Time: ${new Date(now).toISOString()}`);
  if (userData) {
      console.log(`[ManageDemoUserData DEBUG] Existing userData found for IP ${ip}. Token: ${userData.token}, TokenExpiry: ${new Date(userData.tokenExpiry).toISOString()}, CooldownUntil: ${new Date(userData.canStartNewFullDemoAfter).toISOString()}, FluxUses: ${userData.fluxUses}, ImagenUses: ${userData.imagenUses}, TTSChars: ${userData.ttsChars}, LastAccess: ${userData.lastAccessDate}, Blocked: ${userData.isBlocked}`);
  } else {
      console.log(`[ManageDemoUserData DEBUG] No existing userData found for IP ${ip}.`);
  }

  if (!userData || now >= userData.canStartNewFullDemoAfter) {
    userData = {
      token: randomBytes(16).toString('hex'),
      tokenExpiry: now + DEMO_TOKEN_EXPIRY_MS,
      fluxUses: 0, 
      imagenUses: 0, 
      ttsChars: 0,
      lastAccessDate: today,
      isBlocked: false,
      canStartNewFullDemoAfter: now + MIN_INTERVAL_BETWEEN_FULL_DEMO_RESETS_MS,
      limitsLastExhaustedTimestamp: undefined,
    };
    demoUserUsageStore[ip] = userData;
    console.log(`[ManageDemoUserData] IP ${ip}. Full demo period (re)started. Uses reset. New Token: ${userData.token}, Cooldown until ${new Date(userData.canStartNewFullDemoAfter).toISOString()}`);
  } else {
    console.log(`[ManageDemoUserData DEBUG] IP ${ip} is an existing user within main cooldown. Preserving usage stats. Current Token: ${userData.token}, LastAccess: ${userData.lastAccessDate}`);
    if (userData.lastAccessDate !== today) {
      userData.lastAccessDate = today;
      console.log(`[ManageDemoUserData] IP ${ip}. New day of activity (${today}). Session limits (Flux, Imagen) persist until full demo reset.`);
    }
    if (now > userData.tokenExpiry && now < userData.canStartNewFullDemoAfter) {
      console.log(`[ManageDemoUserData DEBUG] Token expired for IP ${ip} (Expiry: ${new Date(userData.tokenExpiry).toISOString()}), but still in cooldown for new full demo (Until: ${new Date(userData.canStartNewFullDemoAfter).toISOString()}).`);
    }
  }
  return userData;
}

async function paidUserAuthMiddleware(req, res, next) {
    const paidUserToken = req.headers['x-paid-user-token']; // Username is used as token here
    if (paidUserToken) {
        try {
            if (!pool) throw new Error("Database not available for paid user auth.");
            const [users] = await pool.execute('SELECT id, username FROM users WHERE username = ?', [paidUserToken]);
            if (users.length > 0) {
                const user = users[0];
                const [subscriptions] = await pool.execute(
                    'SELECT end_date FROM subscriptions WHERE user_id = ? AND status = "active" AND end_date > NOW()',
                    [user.id]
                );
                if (subscriptions.length > 0) {
                    req.paidUser = {
                        id: user.id,
                        username: user.username,
                        isPaidUser: true,
                        subscriptionEndDate: subscriptions[0].end_date
                    };

                    // Initialize/Load monthly Flux usage for this paid user
                    const yearMonth = getCurrentYearMonth();
                    if (!paidUserFluxMonthlyUsageStore[user.username]) {
                        paidUserFluxMonthlyUsageStore[user.username] = {};
                    }
                    if (!paidUserFluxMonthlyUsageStore[user.username][yearMonth]) {
                        paidUserFluxMonthlyUsageStore[user.username][yearMonth] = { fluxMaxUsed: 0, fluxProUsed: 0 };
                        console.log(`[PaidUserAuth] Initialized monthly Flux usage for ${user.username} for ${yearMonth}.`);
                    }
                    req.paidUser.fluxMaxMonthlyUsed = paidUserFluxMonthlyUsageStore[user.username][yearMonth].fluxMaxUsed;
                    req.paidUser.fluxProMonthlyUsed = paidUserFluxMonthlyUsageStore[user.username][yearMonth].fluxProUsed;
                }
            }
        } catch (dbError) {
            console.error("[Paid Auth DB Error]", dbError);
        }
    }
    next();
}
app.use(paidUserAuthMiddleware);

app.post('/api/auth/verify-code', async (req, res) => {
    const { code } = req.body;
    if (code === DEMO_USER_LOGIN_CODE) {
        return res.status(400).json({ success: false, message: "Please use /api/auth/demo-login for DEMO access." });
    }
    if (code === LOGIN_CODE_AUTH_ADMIN) {
        if (!LOGIN_CODE_AUTH_ADMIN) return res.status(500).json({ success: false, message: "Admin login not configured." });
        console.log("[Admin Login] Successful via LOGIN_CODE_AUTH_ADMIN.");
        return res.json({ success: true, isAdmin: true, message: "Admin login successful." });
    }
    if (!pool) return res.status(503).json({ success: false, message: "Database service unavailable." });
    try {
        const [users] = await pool.execute('SELECT id, username, password_hash FROM users WHERE username = ?', [code]);
        if (users.length > 0) {
            const user = users[0];
            console.log(`[Paid Login Attempt] User "${user.username}" found. Password check SKIPPED for this simplified flow.`);
            const [subscriptions] = await pool.execute(
                'SELECT end_date FROM subscriptions WHERE user_id = ? AND status = "active" AND end_date > NOW()',
                [user.id]
            );
            if (subscriptions.length > 0) {
                const subEndDate = new Date(subscriptions[0].end_date);
                console.log(`[Paid Login] User ${user.username} has active subscription until ${subEndDate.toISOString()}.`);
                
                const yearMonth = getCurrentYearMonth();
                if (!paidUserFluxMonthlyUsageStore[user.username]) {
                    paidUserFluxMonthlyUsageStore[user.username] = {};
                }
                if (!paidUserFluxMonthlyUsageStore[user.username][yearMonth]) {
                    paidUserFluxMonthlyUsageStore[user.username][yearMonth] = { fluxMaxUsed: 0, fluxProUsed: 0 };
                }
                const userMonthlyUsage = paidUserFluxMonthlyUsageStore[user.username][yearMonth];

                return res.json({
                    success: true,
                    isPaidUser: true,
                    username: user.username,
                    subscriptionEndDate: subEndDate.toISOString(),
                    limits: {
                        imagen3ImagesLeft: PAID_USER_MAX_LIMITS_CONFIG.IMAGEN3_MAX_IMAGES_PER_DAY, // Assuming daily limits for Imagen are generous or managed differently
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
                return res.status(403).json({ success: false, message: "Subscription inactive, expired, or not found." });
            }
        } else {
            console.log(`[Login] Code "${code}" does not match DEMO, ADMIN, or any paid username in DB.`);
            return res.status(401).json({ success: false, message: "Invalid login code or username." });
        }
    } catch (dbError) {
        console.error("[DB Auth Error]", dbError);
        return res.status(500).json({ success: false, message: "Database error during authentication." });
    }
});

app.post('/api/auth/demo-login', (req, res) => {
  const clientIp = getClientIp(req);
  console.log(`[DemoLoginRoute DEBUG] Received demo login request from IP: ${clientIp}`);
  if (!clientIp) {
    console.log(`[DemoLoginRoute DEBUG] Could not determine client IP.`);
    return res.status(400).json({ success: false, message: "Could not determine client IP." });
  }

  let isBlockedByVpn = false;
  if (isBlockedByVpn) {
    if (!demoUserUsageStore[clientIp]) demoUserUsageStore[clientIp] = { isBlocked: true }; else demoUserUsageStore[clientIp].isBlocked = true;
    console.log(`[DemoLoginRoute DEBUG] IP ${clientIp} BLOCKED by VPN/Proxy rule.`);
    return res.status(403).json({ success: false, message: "Access via VPN/Proxy is not permitted for DEMO.", isBlocked: true });
  }

  const userData = manageDemoUserData(clientIp);
  console.log(`[DemoLoginRoute DEBUG] IP: ${clientIp}. UserData from manage: Token=${userData.token}, Expires=${new Date(userData.tokenExpiry).toISOString()}, CooldownUntil=${new Date(userData.canStartNewFullDemoAfter).toISOString()}, FluxUses=${userData.fluxUses}, ImagenUses=${userData.imagenUses}, TTSChars=${userData.ttsChars}, IsBlocked=${userData.isBlocked}`);

  if (userData.isBlocked) {
    console.log(`[DemoLoginRoute DEBUG] IP ${clientIp} is flagged as BLOCKED in userData.`);
    return res.status(403).json({ success: false, message: "IP flagged.", isBlocked: true });
  }

  if (Date.now() > userData.tokenExpiry && Date.now() < userData.canStartNewFullDemoAfter) {
    const timeLeftMs = userData.canStartNewFullDemoAfter - Date.now();
    const hoursLeft = Math.ceil(timeLeftMs / (1000 * 60 * 60));
    console.log(`[DemoLoginRoute DEBUG] IP: ${clientIp}. BLOCKING: Token expired (at ${new Date(userData.tokenExpiry).toISOString()}), but still in cooldown (until ${new Date(userData.canStartNewFullDemoAfter).toISOString()}). Responding 403.`);
    return res.status(403).json({ success: false, message: `DEMO cool-down. Try in approx ${hoursLeft}h.`, isBlocked: false, cooldownActive: true, tryAgainAfter: new Date(userData.canStartNewFullDemoAfter).toISOString() });
  }

  const limits = {
    fluxKontextUsesLeft: Math.max(0, DEMO_LIMITS_CONFIG_PROXY.FLUX_KONTEX_MAX_USES_SESSION - userData.fluxUses),
    fluxKontextMaxUses: DEMO_LIMITS_CONFIG_PROXY.FLUX_KONTEX_MAX_USES_SESSION,
    imagen3ImagesLeft: Math.max(0, DEMO_LIMITS_CONFIG_PROXY.IMAGEN3_MAX_IMAGES_SESSION - userData.imagenUses),
    imagen3MaxImages: DEMO_LIMITS_CONFIG_PROXY.IMAGEN3_MAX_IMAGES_SESSION,
    openaiTtsCharsLeft: Math.max(0, DEMO_LIMITS_CONFIG_PROXY.OPENAI_TTS_MAX_CHARS_TOTAL - userData.ttsChars),
    openaiTtsMaxChars: DEMO_LIMITS_CONFIG_PROXY.OPENAI_TTS_MAX_CHARS_TOTAL,
  };
  console.log(`[DemoLoginRoute DEBUG] IP: ${clientIp}. SUCCESS: Sending token ${userData.token}, Limits: ${JSON.stringify(limits)}, IsBlockedByVPNHeader: ${isBlockedByVpn}, UserDataIsBlockedFlag: ${userData.isBlocked}`);
  res.json({ success: true, demoUserToken: userData.token, limits, isBlocked: userData.isBlocked });
});


function demoOrPaidUserAuth(req, res, next) {
  if (req.paidUser) { // req.paidUser is set by paidUserAuthMiddleware if valid
    req.isPaidUser = true;
    return next();
  }
  const demoToken = req.headers['x-demo-token'];
  if (!demoToken) return next(); 

  const clientIp = getClientIp(req);
  if (!clientIp) return res.status(400).json({ error: "Could not determine client IP for demo auth." });

  const storedUserData = demoUserUsageStore[clientIp];
  if (!storedUserData || storedUserData.token !== demoToken || Date.now() > (storedUserData.tokenExpiry || 0)) {
    return res.status(401).json({ error: "Invalid or expired demo session. Please login with DEMO key again.", demoSessionInvalid: true });
  }
  if (storedUserData.isBlocked) {
    return res.status(403).json({ error: "Demo access for your IP has been blocked.", demoSessionInvalid: true });
  }
  req.isDemoUser = true;
  req.clientIp = clientIp;
  req.demoUserData = storedUserData; // Attach full demo user data for use in endpoints
  next();
}


const GEMINI_API_KEY_PROXY = process.env.GEMINI_API_KEY;
let ai;
if (GEMINI_API_KEY_PROXY) {
  ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY_PROXY });
  console.log("Google GenAI SDK initialized.");
} else console.warn("PROXY WARNING: GEMINI_API_KEY missing.");

app.post('/api/gemini/chat/stream', demoOrPaidUserAuth, async (req, res) => {
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

app.post('/api/gemini/image/generate', demoOrPaidUserAuth, async (req, res) => {
  try {
    const { modelName, prompt, modelSettings } = req.body;
    const numImagesToGenerate = Math.max(1, Math.min(4, modelSettings?.numberOfImages || 1));

    if (req.isPaidUser) {
      console.log(`[Imagen Proxy] Paid user ${req.paidUser.username} generating ${numImagesToGenerate} image(s).`);
      // TODO: Paid user Imagen limit check if necessary (e.g., daily/monthly based on subscription)
      // For now, assuming paid users have a high or subscription-based limit for Imagen
    } else if (req.isDemoUser) {
      if (!req.demoUserData) {
          console.error("[Imagen Proxy Error] demoUserData is missing for a demo user request. IP:", req.clientIp);
          return res.status(500).json({ error: "Internal server error: Demo user data not found."});
      }
      const remainingUses = DEMO_LIMITS_CONFIG_PROXY.IMAGEN3_MAX_IMAGES_SESSION - req.demoUserData.imagenUses;
      if (numImagesToGenerate > remainingUses) {
        return res.status(429).json({ error: `Đã hết lượt tạo ảnh Imagen3 cho phiên DEMO này. Bạn còn lại ${remainingUses} ảnh (yêu cầu ${numImagesToGenerate}).`, limitReached: true, usesLeft: remainingUses });
      }
    } else if (!GEMINI_API_KEY_PROXY) { 
      return res.status(500).json({ error: "Google API Key missing for non-authenticated Imagen generation." });
    }

    if (!ai) return res.status(500).json({ error: "Google GenAI SDK not initialized." });
    if (!modelName || !prompt || !modelSettings) return res.status(400).json({ error: "Missing fields for Imagen." });

    const config = {
        numberOfImages: numImagesToGenerate,
        outputMimeType: modelSettings.outputMimeType || 'image/jpeg',
        ...(modelSettings.aspectRatio && modelSettings.aspectRatio !== 'default' && { aspectRatio: modelSettings.aspectRatio }),
    };
    const response = await ai.models.generateImages({ model: modelName, prompt: prompt, config: config });

    if (req.isDemoUser && req.demoUserData && req.clientIp && demoUserUsageStore[req.clientIp]) {
      const numGenerated = response.generatedImages?.length || 0;
      demoUserUsageStore[req.clientIp].imagenUses += numGenerated;
      console.log(`[Demo Usage] Imagen: IP ${req.clientIp} used ${numGenerated} images. Total for session: ${demoUserUsageStore[req.clientIp].imagenUses}/${DEMO_LIMITS_CONFIG_PROXY.IMAGEN3_MAX_IMAGES_SESSION}`);
      if (demoUserUsageStore[req.clientIp].imagenUses >= DEMO_LIMITS_CONFIG_PROXY.IMAGEN3_MAX_IMAGES_SESSION) {
          demoUserUsageStore[req.clientIp].limitsLastExhaustedTimestamp = Date.now();
      }
    }
    res.json(response);
  } catch (error) {
    console.error("[Imagen Proxy Error]", error);
    let msgString = "Imagen generation failed due to an internal server error.";
    let errorDetails = {};
    if (error instanceof Error) {
        msgString = error.message;
        errorDetails = { name: error.name, stack: error.stack?.substring(0, 200) };
    } else if (error.statusInfo && error.statusInfo.message) { 
        msgString = String(error.statusInfo.message);
    } else if (typeof error === 'object' && error !== null) {
        msgString = JSON.stringify(error);
    } else {
        msgString = String(error);
    }

    const errorStatus = error.status || 500;
    if (!res.headersSent) {
        return res.status(errorStatus).json({ error: `Imagen generation failed: ${msgString}`, details: errorDetails });
    } else {
        console.error("[Imagen Proxy Error] Headers already sent for Imagen error.");
    }
  }
});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';
if (OPENAI_API_KEY) console.log("OpenAI API Key found."); else console.warn("PROXY WARNING: OPENAI_API_KEY missing.");

app.post('/api/openai/chat/stream', demoOrPaidUserAuth, async (req, res) => {
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
        let errorDetails = {};
        if (error instanceof Error) {
            errorMsg = error.message;
            errorDetails = { name: error.name, stack: error.stack?.substring(0, 200) };
        } else if (typeof error === 'object' && error !== null) {
            errorMsg = JSON.stringify(error);
        } else {
            errorMsg = String(error);
        }

        if (!res.headersSent) {
            res.status(500);
            res.setHeader('Content-Type', 'text/event-stream');
        }
        res.write(`data: ${JSON.stringify({error: errorMsg, details: errorDetails, isFinished: true})}\n\n`);
        if (!res.writableEnded) res.end();
    }
});

app.post('/api/openai/tts/generate', demoOrPaidUserAuth, async (req, res) => {
  try {
    const { modelIdentifier, textInput, voice, speed, responseFormat = 'mp3' } = req.body;
    const currentChars = textInput ? textInput.length : 0;

    if (req.isPaidUser) {
      if (currentChars > PAID_USER_MAX_LIMITS_CONFIG.OPENAI_TTS_MAX_CHARS_TOTAL) {
          return res.status(413).json({ error: `Input quá dài cho người dùng trả phí TTS. Tối đa: ${PAID_USER_MAX_LIMITS_CONFIG.OPENAI_TTS_MAX_CHARS_TOTAL}`, limitReached: true });
      }
      console.log(`[OpenAI TTS Proxy] Paid user ${req.paidUser.username} generating audio for ${currentChars} chars.`);
    } else if (req.isDemoUser) {
      if (!req.demoUserData) {
          console.error("[OpenAI TTS Proxy Error] demoUserData is missing for a demo user request. IP:", req.clientIp);
          return res.status(500).json({ error: "Internal server error: Demo user data not found."});
      }
      const remainingChars = DEMO_LIMITS_CONFIG_PROXY.OPENAI_TTS_MAX_CHARS_TOTAL - req.demoUserData.ttsChars;
      if (currentChars > remainingChars) {
        return res.status(429).json({ error: `Đã hết ký tự sử dụng OpenAI TTS cho phiên DEMO này. Còn lại: ${remainingChars}, cần: ${currentChars}`, limitReached: true });
      }
    } else if (!OPENAI_API_KEY) { 
      return res.status(500).json({ error: "OpenAI API Key not configured for non-authenticated TTS." });
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
    if (req.isDemoUser && req.demoUserData && req.clientIp && demoUserUsageStore[req.clientIp]) {
      demoUserUsageStore[req.clientIp].ttsChars += currentChars;
      console.log(`[Demo Usage] TTS: IP ${req.clientIp} used ${currentChars} chars. Total for session: ${demoUserUsageStore[req.clientIp].ttsChars}/${DEMO_LIMITS_CONFIG_PROXY.OPENAI_TTS_MAX_CHARS_TOTAL}`);
      if (demoUserUsageStore[req.clientIp].ttsChars >= DEMO_LIMITS_CONFIG_PROXY.OPENAI_TTS_MAX_CHARS_TOTAL) {
          demoUserUsageStore[req.clientIp].limitsLastExhaustedTimestamp = Date.now();
      }
    }
    res.setHeader('Content-Type', `audio/${responseFormat}`);
    openaiResponse.body.pipe(res);
  } catch (error) {
    console.error("[OpenAI TTS Proxy Error]", error);
    let errorMsg = "Failed to generate audio via proxy.";
    let errorDetails = {};
    if (error instanceof Error) {
        errorMsg = error.message;
        errorDetails = { name: error.name, stack: error.stack?.substring(0, 200) };
    } else if (typeof error === 'object' && error !== null) {
        errorMsg = JSON.stringify(error);
    } else {
        errorMsg = String(error);
    }
    if (!res.headersSent) {
        res.status(500).json({ error: errorMsg, details: errorDetails });
    }
  }
});

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/chat/completions';
if (DEEPSEEK_API_KEY) console.log("Deepseek API Key found."); else console.warn("PROXY WARNING: DEEPSEEK_API_KEY missing.");

app.post('/api/deepseek/chat/stream', demoOrPaidUserAuth, async (req, res) => {
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
        let errorDetails = {};
        if (error instanceof Error) {
            errorMsg = error.message;
            errorDetails = { name: error.name, stack: error.stack?.substring(0, 200) };
        } else if (typeof error === 'object' && error !== null) {
            errorMsg = JSON.stringify(error);
        } else {
            errorMsg = String(error);
        }
         if (!res.headersSent) {
            res.status(500);
            res.setHeader('Content-Type', 'text/event-stream');
        }
        res.write(`data: ${JSON.stringify({error: errorMsg, details: errorDetails, isFinished: true})}\n\n`);
        if (!res.writableEnded) res.end();
    }
});

const FAL_KEY = process.env.FAL_KEY;
if (FAL_KEY) {
    console.log("Fal.ai Key (FAL_KEY) found in process.env.");
} else {
    console.warn("PROXY WARNING: FAL_KEY not found in process.env. Fal.ai endpoints will likely fail.");
}

app.post('/api/fal/image/edit/flux-kontext', demoOrPaidUserAuth, async (req, res) => {
  const currentClientIp = getClientIp(req); 
  console.log(`[Flux Endpoint DEBUG] Request received. IP: ${currentClientIp}, PaidUser: ${req.isPaidUser}, DemoUser: ${req.isDemoUser}`);

  if (req.isPaidUser && req.paidUser) {
    console.log(`[Flux Endpoint DEBUG] Paid User: ${req.paidUser.username}. Monthly Flux Max Used: ${req.paidUser.fluxMaxMonthlyUsed}, Pro Used: ${req.paidUser.fluxProMonthlyUsed}`);
  } else if (req.isDemoUser && req.demoUserData) {
    console.log(`[Flux Endpoint DEBUG] Demo User. Initial req.demoUserData.fluxUses: ${req.demoUserData.fluxUses}`);
    if (demoUserUsageStore[currentClientIp]) {
      console.log(`[Flux Endpoint DEBUG] Demo User. Initial demoUserUsageStore[${currentClientIp}].fluxUses: ${demoUserUsageStore[currentClientIp].fluxUses}`);
    } else {
      console.warn(`[Flux Endpoint DEBUG] Demo User. demoUserUsageStore[${currentClientIp}] is UNDEFINED, but req.demoUserData exists.`);
    }
  }

  try {
    if (!FAL_KEY) {
        return res.status(500).json({ error: "Fal.ai API Key (FAL_KEY) not configured on proxy." });
    }
    const {
        modelIdentifier, 
        prompt,
        image_base_64,
        image_mime_type,
        images_data, 
        guidance_scale: guidance_scale_param,
        safety_tolerance: safety_tolerance_param,
        num_inference_steps: num_inference_steps_param,
        seed: seed_param,
        num_images: num_images_param, 
        aspect_ratio: aspect_ratio_param, 
        output_format: output_format_param,
    } = req.body;

    if (!modelIdentifier || !prompt) {
         return res.status(400).json({ error: "Missing required fields: modelIdentifier, prompt for Flux Kontext." });
    }
    
    const isFluxMax = modelIdentifier === 'fal-ai/flux-pro/kontext/max/multi';
    const isFluxPro = modelIdentifier === 'fal-ai/flux-pro/kontext';

    if (isFluxMax && (!images_data || !Array.isArray(images_data) || images_data.length === 0)) {
        return res.status(400).json({ error: "Flux Kontext Max/Multi requires 'images_data' array." });
    } else if (isFluxPro && (!image_base_64 || !image_mime_type)) {
        return res.status(400).json({ error: "Standard Flux Kontext requires 'image_base_64' and 'image_mime_type'." });
    }


    // Check limits
    if (req.isPaidUser && req.paidUser) {
        const yearMonth = getCurrentYearMonth();
        const monthlyUsage = paidUserFluxMonthlyUsageStore[req.paidUser.username]?.[yearMonth];
        if (!monthlyUsage) {
             console.error(`[Flux Endpoint CRITICAL] Paid user ${req.paidUser.username} monthly usage for ${yearMonth} not found/initialized!`);
             return res.status(500).json({ error: "Internal server error: Paid user usage data not found." });
        }
        if (isFluxMax && monthlyUsage.fluxMaxUsed >= PAID_USER_MAX_LIMITS_CONFIG.FLUX_KONTEX_MAX_MONTHLY_MAX_USES) {
            return res.status(429).json({ error: `Monthly limit for Flux Kontext Max reached (${PAID_USER_MAX_LIMITS_CONFIG.FLUX_KONTEX_MAX_MONTHLY_MAX_USES} images/month).`, limitReached: true });
        }
        if (isFluxPro && monthlyUsage.fluxProUsed >= PAID_USER_MAX_LIMITS_CONFIG.FLUX_KONTEX_PRO_MONTHLY_MAX_USES) {
            return res.status(429).json({ error: `Monthly limit for Flux Kontext Pro reached (${PAID_USER_MAX_LIMITS_CONFIG.FLUX_KONTEX_PRO_MONTHLY_MAX_USES} images/month).`, limitReached: true });
        }
    } else if (req.isDemoUser) {
      if (!req.demoUserData || !currentClientIp || !demoUserUsageStore[currentClientIp]) {
        console.error("[Flux Endpoint CRITICAL] Demo user data integrity issue before limit check. IP:", currentClientIp, "req.demoUserData exists:", !!req.demoUserData, "store entry exists:", !!demoUserUsageStore[currentClientIp]);
        return res.status(500).json({ error: "Demo user data integrity issue. Cannot process request."});
      }
      const remainingUses = DEMO_LIMITS_CONFIG_PROXY.FLUX_KONTEX_MAX_USES_SESSION - demoUserUsageStore[currentClientIp].fluxUses;
      console.log(`[Flux Endpoint DEBUG] Demo User ${currentClientIp}. Flux uses before this request: ${demoUserUsageStore[currentClientIp].fluxUses}. Remaining: ${remainingUses}`);
      if (remainingUses <= 0) {
        console.log(`[Flux Endpoint DEBUG] Demo User ${currentClientIp} has no Flux uses left. Blocking.`);
        return res.status(429).json({ error: `Đã hết ${DEMO_LIMITS_CONFIG_PROXY.FLUX_KONTEX_MAX_USES_SESSION} lượt sử dụng Flux Kontext cho phiên DEMO này.`, limitReached: true, usesLeft: 0 });
      }
    }

    let falInput = {
        prompt: prompt,
        guidance_scale: guidance_scale_param ?? PROXY_DEFAULT_FLUX_KONTEX_SETTINGS.guidance_scale,
        safety_tolerance: safety_tolerance_param ?? PROXY_DEFAULT_FLUX_KONTEX_SETTINGS.safety_tolerance,
        seed: (seed_param === null || seed_param === undefined) ? null : seed_param, 
        num_images: num_images_param ?? PROXY_DEFAULT_FLUX_KONTEX_SETTINGS.num_images,
        output_format: output_format_param ?? PROXY_DEFAULT_FLUX_KONTEX_SETTINGS.output_format,
    };
    const effectiveAspectRatio = aspect_ratio_param === undefined 
      ? PROXY_DEFAULT_FLUX_KONTEX_SETTINGS.aspect_ratio 
      : aspect_ratio_param; 
    if (effectiveAspectRatio && effectiveAspectRatio !== 'default') {
        falInput.aspect_ratio = effectiveAspectRatio;
    }
    if (modelIdentifier !== 'fal-ai/flux-pro/kontext/max/multi') {
        falInput.num_inference_steps = num_inference_steps_param ?? PROXY_DEFAULT_FLUX_KONTEX_SETTINGS.num_inference_steps;
    } else {
        console.log(`[Flux Kontext Max/Multi Proxy] Not including 'num_inference_steps' as it's not in the model's schema.`);
    }

    if (isFluxMax) {
        falInput.image_urls = images_data.map(img => `data:${img.mimeType};base64,${img.base64}`);
    } else { 
        falInput.image_url = `data:${image_mime_type};base64,${image_base_64}`;
    }
    console.log(`[Flux Endpoint DEBUG] Calling Fal.ai with model ${modelIdentifier}. Input (image data truncated):`, { ...falInput, image_url: falInput.image_url?.substring(0,50), image_urls: falInput.image_urls?.map(u => u.substring(0,50)) });

    const queueResult = await fal.queue.submit(modelIdentifier, { input: falInput });
    console.log(`[Flux Endpoint DEBUG] Fal.queue.submit result: request_id = ${queueResult?.request_id}`);

    if (queueResult && queueResult.request_id) {
        console.log(`[Flux Kontext Proxy] Request ID from fal.queue.submit for model ${modelIdentifier}: ${queueResult.request_id}`);
        
        if (req.isPaidUser && req.paidUser) {
            const yearMonth = getCurrentYearMonth();
            const userMonthlyStore = paidUserFluxMonthlyUsageStore[req.paidUser.username]?.[yearMonth];
            if (userMonthlyStore) {
                if (isFluxMax) userMonthlyStore.fluxMaxUsed += 1;
                if (isFluxPro) userMonthlyStore.fluxProUsed += 1;
                console.log(`[Paid Usage] Flux (${isFluxMax ? 'Max' : 'Pro'}): User ${req.paidUser.username} used 1 attempt. Total for month ${yearMonth}: Max=${userMonthlyStore.fluxMaxUsed}, Pro=${userMonthlyStore.fluxProUsed}`);
            }
        } else if (req.isDemoUser && req.demoUserData && currentClientIp && demoUserUsageStore[currentClientIp]) { 
          console.log(`[Flux Endpoint DEBUG] Before increment: demoUserUsageStore[${currentClientIp}].fluxUses = ${demoUserUsageStore[currentClientIp].fluxUses}`);
          demoUserUsageStore[currentClientIp].fluxUses += 1;
          console.log(`[Flux Endpoint DEBUG] After increment: demoUserUsageStore[${currentClientIp}].fluxUses = ${demoUserUsageStore[currentClientIp].fluxUses}`);
          console.log(`[Demo Usage] Flux: IP ${currentClientIp} used 1 attempt. Total for session: ${demoUserUsageStore[currentClientIp].fluxUses}/${DEMO_LIMITS_CONFIG_PROXY.FLUX_KONTEX_MAX_USES_SESSION}`);
          if (demoUserUsageStore[currentClientIp].fluxUses >= DEMO_LIMITS_CONFIG_PROXY.FLUX_KONTEX_MAX_USES_SESSION) {
              demoUserUsageStore[currentClientIp].limitsLastExhaustedTimestamp = Date.now();
          }
        }
        res.json({ requestId: queueResult.request_id, message: "Image editing request submitted via queue. Polling for status." });
    } else {
        console.error(`[Flux Kontext Proxy] Fal.queue.submit for model ${modelIdentifier} did not return a request_id. Result:`, queueResult);
        res.status(500).json({ error: "Fal.ai Flux Kontext: Failed to get a request ID for polling.", rawResult: queueResult });
    }
  } catch (error) {
    console.error("[Flux Kontext Proxy Error] /api/fal/image/edit/flux-kontext:", error);
    let errorMsg = "Failed to submit image editing request to Fal.ai proxy due to an internal server error.";
    let errorDetails = {};
    if (error instanceof Error) {
        errorMsg = error.message;
        errorDetails = { name: error.name, stack: error.stack?.substring(0, 200) };
    } else if (typeof error === 'object' && error !== null) {
        errorMsg = JSON.stringify(error); 
    } else {
        errorMsg = String(error);
    }
    if (!res.headersSent) {
        res.status(500).json({ error: `Flux Kontext Submission Error: ${errorMsg}`, details: errorDetails });
    } else {
        console.error("[Flux Proxy Error] Headers already sent for Flux Kontext submission error.");
    }
  }
});

app.post('/api/fal/image/edit/status', async (req, res) => {
  let requestIdFromRequest = req.body?.requestId;
  let modelIdFromRequest = req.body?.modelIdentifier;
  try {
    if (!FAL_KEY) {
        return res.status(500).json({ error: "Fal.ai API Key (FAL_KEY) not configured on proxy." });
    }
    const { requestId, modelIdentifier } = req.body;
    requestIdFromRequest = requestId; 
    modelIdFromRequest = modelIdentifier; 

    if (!requestId || !modelIdentifier) {
        return res.status(400).json({ error: "Missing requestId or modelIdentifier for status check." });
    }
    console.log(`[Flux Kontext Status Proxy] Checking status for request ID: ${requestId} on model: ${modelIdentifier}`);

    const statusResult = await fal.queue.status(modelIdentifier, { requestId });

    let responsePayload = { rawResult: statusResult, status: undefined, editedImageUrl: undefined, message: undefined, error: undefined };
    if (statusResult) {
        if (statusResult.status === 'COMPLETED') {
            try {
                console.log(`[Flux Kontext Status Proxy] Status is COMPLETED for ${requestId} (${modelIdentifier}). Fetching result...`);
                const jobResult = await fal.queue.result(modelIdentifier, { requestId });
                console.log(`[Flux Kontext Status Proxy] Result fetched for ${requestId} (${modelIdentifier}).`);
                 if (process.env.VERBOSE_LOGGING === 'true') console.log("[Flux Kontext Status Proxy] Full result object:", JSON.stringify(jobResult, null, 2));

                let imageUrl;
                if (jobResult && jobResult.images && Array.isArray(jobResult.images) && jobResult.images.length > 0 && jobResult.images[0].url) {
                    imageUrl = jobResult.images[0].url;
                } else if (jobResult && jobResult.data && jobResult.data.images && Array.isArray(jobResult.data.images) && jobResult.data.images.length > 0 && jobResult.data.images[0].url) {
                    imageUrl = jobResult.data.images[0].url; 
                }
                if (imageUrl) {
                    responsePayload.status = 'COMPLETED';
                    responsePayload.editedImageUrl = imageUrl;
                    responsePayload.message = "Image editing completed successfully.";
                    responsePayload.rawResult = jobResult; 
                } else {
                    responsePayload.status = 'COMPLETED_NO_IMAGE';
                    responsePayload.message = "Processing completed, but no image URL was found in Fal.ai result payload.";
                    responsePayload.error = "Fal.ai result payload did not contain an image URL or was structured unexpectedly.";
                    responsePayload.rawResult = jobResult;
                    console.warn(`[Flux Kontext Status Proxy] 'COMPLETED' status for ${modelIdentifier}, result fetched, but no image URL at expected path. Fal.ai result:`, jobResult);
                }
            } catch (resultError) {
                let detailedErrorMessage = String(resultError.message || "Failed to fetch result for completed job.");
                if (resultError.status === 422 && resultError.body && resultError.body.detail) {
                    try { detailedErrorMessage += ` Fal.ai Details: ${JSON.stringify(resultError.body.detail)}`; } 
                    catch (stringifyError) { detailedErrorMessage += ` Fal.ai Details: (Could not stringify error body detail)`; }
                }
                console.error(`[Flux Kontext Status Proxy Error] Fetching result for COMPLETED ${requestId} (${modelIdentifier}):`, resultError, "Detailed Error Message:", detailedErrorMessage);
                responsePayload.status = 'ERROR_FETCHING_RESULT';
                responsePayload.error = detailedErrorMessage;
                responsePayload.message = "Image editing completed, but failed to retrieve the final image due to an API error.";
            }
        } else if (statusResult.status === 'IN_PROGRESS' || statusResult.status === 'IN_QUEUE') {
            responsePayload.status = statusResult.status;
            responsePayload.message = `Image editing is ${statusResult.status.toLowerCase()}.`;
        } else if (statusResult.status === 'ERROR') { 
            responsePayload.status = 'ERROR';
            const errorLog = statusResult.logs?.find(log => log.level === 'ERROR');
            responsePayload.error = String(statusResult.error?.message || errorLog?.message || "Fal.ai reported an error.");
            responsePayload.message = "Image editing failed.";
        } else { 
            responsePayload.status = statusResult.status || 'IN_PROGRESS'; 
            responsePayload.message = `Image editing status: ${statusResult.status || 'Unknown'}.`;
        }
        console.log(`[Flux Kontext Status Proxy] Status for ${requestId} (${modelIdentifier}): ${responsePayload.status}. Message: ${responsePayload.message}`);
        return res.json(responsePayload);
    } else { 
        console.warn(`[Flux Kontext Status Proxy] Request ID ${requestId} (${modelIdentifier}) not found by Fal.ai or statusResult was null/undefined.`);
        return res.status(404).json({ status: 'NOT_FOUND', error: `Request ID ${requestId} for model ${modelIdentifier} not found or invalid status response.`, message: `Request ID ${requestId} not found or invalid status.` });
    }
  } catch (error) { 
    console.error(`[Flux Kontext Status Proxy Error] Checking status for ${requestIdFromRequest} (Model: ${modelIdFromRequest}):`, error);
    let errorMsg = "Failed to check Fal.ai request status via proxy.";
    let errorDetails = {};
    if (error instanceof Error) {
        errorMsg = error.message;
        errorDetails = { name: error.name, stack: error.stack?.substring(0, 200) };
    } else if (typeof error === 'object' && error !== null) {
        errorMsg = JSON.stringify(error);
    } else {
        errorMsg = String(error);
    }
    if (error.message && (error.message.includes("404") || error.message.toLowerCase().includes("not found") || error.message.toLowerCase().includes("request not found"))) {
        if (!res.headersSent) {
            return res.status(404).json({ status: 'NOT_FOUND', error: `Request ID ${requestIdFromRequest} not found (Fal error: ${errorMsg}).`, message: `Request ID ${requestIdFromRequest} not found.`, details: errorDetails });
        }
    }
    if (!res.headersSent) {
        res.status(500).json({ status: 'PROXY_REQUEST_ERROR', error: `Fal Status Check Error: ${errorMsg}`, message: "Error checking status with Fal.ai proxy.", details: errorDetails });
    } else {
        console.error("[Flux Status Proxy Error] Headers already sent for status check error.");
    }
  }
});

app.listen(port, () => {
  console.log(`AI Chat Proxy Server listening at http://localhost:${port}`);
  if (allowedOrigins.length === 0) console.warn("PROXY WARNING: CORS_ALLOWED_ORIGINS not set.");
  else if (allowedOrigins.includes('*')) console.warn("PROXY WARNING: CORS_ALLOWED_ORIGINS is '*'.");
  else console.log(`CORS allows requests from: ${allowedOrigins.join(', ')}`);
  if (!pool) console.error("WARNING: MySQL connection pool IS NOT available. DB operations will fail.");
});