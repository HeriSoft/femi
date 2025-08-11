
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { GoogleGenAI } from '@google/genai';
import { fal } from '@fal-ai/client';
import { randomBytes } from 'crypto';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import multer from 'multer';
import FormData from 'form-data';
import play from 'play-dl';
import ytdl from '@distube/ytdl-core';

console.log(`[Proxy Server] Starting up at ${new Date().toISOString()}...`);

// Define DEFAULT_FLUX_KONTEX_SETTINGS directly.
const PROXY_DEFAULT_FLUX_KONTEX_SETTINGS = {
  guidance_scale: 7.5,
  seed: null,
  num_images: 1,
  aspect_ratio: 'default',
  output_format: 'jpeg',
};

const PROXY_DEFAULT_FLUX_DEV_SETTINGS = {
  image_size: 'landscape_4_3',
  num_inference_steps: 28,
  seed: null,
  guidance_scale: 3.5,
  num_images: 1,
  enable_safety_checker: true,
  output_format: 'jpeg',
};

const PROXY_DEFAULT_KLING_AI_SETTINGS = {
  duration: "5",
  aspect_ratio: "16:9",
  negative_prompt: "blur, distort, and low quality",
  cfg_scale: 0.5,
};

const PROXY_DEFAULT_WAN_I2V_SETTINGS = {
  negative_prompt: "bright colors, overexposed, static, blurred details, subtitles, style, artwork, painting, picture, still, overall gray, worst quality, low quality, JPEG compression residue, ugly, incomplete, extra fingers, poorly drawn hands, poorly drawn faces, deformed, disfigured, malformed limbs, fused fingers, still picture, cluttered background, three legs, many people in the background, walking backwards",
  num_frames: 81,
  frames_per_second: 16,
  seed: null,
  resolution: "720p",
  num_inference_steps: 30,
  guide_scale: 5,
  shift: 5,
  enable_safety_checker: true,
  enable_prompt_expansion: false,
  aspect_ratio: "16:9",
  loras: [],
  reverse_video: false,
  turbo_mode: true,
};

const PROXY_DEFAULT_WAN_I2V_V22_SETTINGS = {
  negative_prompt: "",
  num_frames: 81,
  frames_per_second: 24,
  seed: null,
  resolution: "720p",
  num_inference_steps: 40,
  guidance_scale: 3.5,
  shift: 5,
  enable_safety_checker: true,
  enable_prompt_expansion: false,
  aspect_ratio: "auto",
  interpolator_model: "film",
  num_interpolated_frames: 0,
  adjust_fps_for_interpolation: true,
  loras: [],
};



dotenv.config();

let ytdlAgent = null;
if (process.env.YOUTUBE_COOKIES) {
  try {
    const cookies = JSON.parse(process.env.YOUTUBE_COOKIES);
    ytdlAgent = ytdl.createAgent(cookies);
    console.log("[Video Downloader] YouTube cookies loaded, agent created.");
  } catch (e) {
    console.error("[Video Downloader] Failed to parse YOUTUBE_COOKIES. Proceeding without cookies.", e.message);
  }
} else {
  console.warn("[Video Downloader] YOUTUBE_COOKIES environment variable not set. YouTube downloads may fail with 429 errors or 'not a bot' checks.");
}


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

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- Authentication ---
const LOGIN_CODE_AUTH_ADMIN = process.env.LOGIN_CODE_AUTH_ADMIN;

if (!LOGIN_CODE_AUTH_ADMIN) console.warn("PROXY WARNING: LOGIN_CODE_AUTH_ADMIN not found. Admin login will not function.");
else console.log("LOGIN_CODE_AUTH_ADMIN is SET for admin.");


// --- NAMED DEMO USER CONSTANTS (from DB) ---
const DEMO_USER_MONTHLY_LIMITS = {
  FLUX_KONTEX_MAX_MONTHLY: 0,
  FLUX_KONTEX_PRO_MONTHLY: 1,
  FLUX_KONTEX_LORA_MONTHLY: 0,
  IMAGEN3_MONTHLY_IMAGES: 5,
  OPENAI_TTS_MONTHLY_CHARS: 10000,
  FLUX_DEV_MONTHLY_IMAGES: 0,
  KLING_VIDEO_MONTHLY_MAX_USES: 0,
  WAN_I2V_MONTHLY_MAX_USES: 0,
  WAN_I2V_V22_MONTHLY_MAX_USES: 0,
};

// --- PAID USER LIMITS ---
const PAID_USER_MAX_LIMITS_CONFIG = {
  IMAGEN3_MONTHLY_MAX_IMAGES: 25,
  OPENAI_TTS_MAX_CHARS_TOTAL: 20000,
  FLUX_KONTEX_MAX_MONTHLY_MAX_USES: 25,
  FLUX_KONTEX_PRO_MONTHLY_MAX_USES: 35,
  FLUX_KONTEX_LORA_MONTHLY_MAX_USES: 20,
  FLUX_DEV_MONTHLY_MAX_IMAGES: 30,
  KLING_VIDEO_MONTHLY_MAX_GENERATIONS: 1,
  WAN_I2V_MONTHLY_MAX_GENERATIONS: 4,
  WAN_I2V_V22_MONTHLY_MAX_GENERATIONS: 4,
};


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
                req.authenticationFailed = true;
                return next();
            }
            const [users] = await pool.execute(
                'SELECT id, username, user_type, status, paid_flux_pro_monthly_used, paid_flux_max_monthly_used, paid_flux_lora_monthly_used, paid_flux_dev_monthly_used, paid_kling_video_monthly_used, paid_wani2v_monthly_used, paid_wani2v_v22_monthly_used, paid_imagen3_monthly_used, paid_usage_last_reset_month FROM users WHERE username = ?',
                [paidUserToken]
            );
            if (users.length > 0) {
                const user = users[0];
                if (user.status === 'suspended') {
                    req.authenticationFailed = true;
                    console.log(`[Paid Auth] Access denied for suspended user ${user.username}.`);
                } else if (user.user_type === 'PAID') {
                    const [subscriptions] = await pool.execute(
                        'SELECT end_date FROM subscriptions WHERE user_id = ? AND status = "active" AND end_date > NOW()',
                        [user.id]
                    );
                    if (subscriptions.length > 0) {
                        const currentYearMonth = getCurrentYearMonth();
                        let {
                            paid_flux_pro_monthly_used: fluxProUsed = 0,
                            paid_flux_max_monthly_used: fluxMaxUsed = 0,
                            paid_flux_lora_monthly_used: fluxLoraUsed = 0,
                            paid_flux_dev_monthly_used: fluxDevUsed = 0,
                            paid_kling_video_monthly_used: klingVideoUsed = 0,
                            paid_wani2v_monthly_used: wanI2vUsed = 0,
                            paid_wani2v_v22_monthly_used: wanI2vV22Used = 0,
                            paid_imagen3_monthly_used: imagen3Used = 0,
                            paid_usage_last_reset_month: lastResetMonth
                        } = user;

                        if (lastResetMonth !== currentYearMonth) {
                            console.log(`[Paid Auth] Resetting monthly limits for PAID user ${user.username} for new month ${currentYearMonth}. Old month: ${lastResetMonth}`);
                            fluxProUsed = 0; fluxMaxUsed = 0; fluxLoraUsed = 0; fluxDevUsed = 0; klingVideoUsed = 0; wanI2vUsed = 0; wanI2vV22Used = 0; imagen3Used = 0;
                            try {
                                await pool.execute(
                                    'UPDATE users SET paid_flux_pro_monthly_used=0, paid_flux_max_monthly_used=0, paid_flux_lora_monthly_used=0, paid_flux_dev_monthly_used=0, paid_kling_video_monthly_used=0, paid_wani2v_monthly_used=0, paid_wani2v_v22_monthly_used=0, paid_imagen3_monthly_used=0, paid_usage_last_reset_month=? WHERE id=?',
                                    [currentYearMonth, user.id]
                                );
                            } catch (dbResetError) {
                                console.error(`[Paid Auth DB Reset Error] Failed to reset limits for user ${user.username}:`, dbResetError);
                            }
                        }

                        req.paidUser = {
                            id: user.id, username: user.username, isPaidUser: true,
                            subscriptionEndDate: subscriptions[0].end_date,
                            fluxMaxMonthlyUsed: fluxMaxUsed,
                            fluxProMonthlyUsed: fluxProUsed,
                            fluxLoraMonthlyUsed: fluxLoraUsed,
                            fluxDevMonthlyUsed: fluxDevUsed,
                            klingVideoMonthlyUsed: klingVideoUsed,
                            wanI2vMonthlyUsed: wanI2vUsed,
                            wanI2vV22MonthlyUsed: wanI2vV22Used,
                            paid_imagen3_monthly_used: imagen3Used,
                        };
                        req.isPaidUser = true;
                        req.authenticationFailed = false;
                    } else {
                        req.authenticationFailed = true;
                        console.log(`[Paid Auth] User ${user.username} found, but no active/valid subscription.`);
                    }
                } else {
                    req.authenticationFailed = true;
                    console.log(`[Paid Auth] User ${user.username} found, but user_type is not PAID.`);
                }
            } else {
                req.authenticationFailed = true;
                console.log(`[Paid Auth] Token ${paidUserToken} not found in DB.`);
            }
        } catch (dbError) {
            console.error("[Paid Auth DB Error]", dbError);
            req.authDbError = true;
            req.authenticationFailed = true;
        }
    } else if (demoUserToken) {
        req.authenticationAttempted = true;
        try {
            if (!pool) {
                console.error("[Demo Auth Middleware Error] Database pool not available.");
                req.authDbError = true;
                req.authenticationFailed = true;
                return next();
            }
            const [users] = await pool.execute(
                'SELECT id, username, user_type, status, demo_flux_max_monthly_used, demo_flux_pro_monthly_used, demo_flux_lora_monthly_used, demo_imagen_monthly_used, demo_tts_monthly_chars_used, demo_flux_dev_monthly_used, demo_kling_video_monthly_used, demo_wani2v_monthly_used, demo_wani2v_v22_monthly_used, demo_usage_last_reset_month FROM users WHERE username = ? AND user_type = "DEMO"',
                [demoUserToken]
            );
            if (users.length > 0) {
                const user = users[0];
                if (user.status === 'suspended') {
                    req.authenticationFailed = true;
                    console.log(`[Demo Auth] Access denied for suspended demo user ${user.username}.`);
                } else {
                    req.demoUser = {
                        id: user.id, username: user.username, isDemoUser: true,
                        fluxMaxMonthlyUsed: user.demo_flux_max_monthly_used || 0,
                        fluxProMonthlyUsed: user.demo_flux_pro_monthly_used || 0,
                        fluxLoraMonthlyUsed: user.demo_flux_lora_monthly_used || 0,
                        imagenMonthlyUsed: user.demo_imagen_monthly_used || 0,
                        ttsMonthlyCharsUsed: user.demo_tts_monthly_chars_used || 0,
                        fluxDevMonthlyUsed: user.demo_flux_dev_monthly_used || 0,
                        klingVideoMonthlyUsed: user.demo_kling_video_monthly_used || 0,
                        wanI2vMonthlyUsed: user.demo_wani2v_monthly_used || 0,
                        wanI2vV22MonthlyUsed: user.demo_wani2v_v22_monthly_used || 0,
                        usageLastResetMonth: user.demo_usage_last_reset_month
                    };
                    req.isDemoUser = true;
                    req.authenticationFailed = false;
                }
            } else {
                 req.authenticationFailed = true;
                 console.log(`[Demo Auth] Token ${demoUserToken} not found or not DEMO type.`);
            }
        } catch (dbError) {
            console.error("[Demo Auth DB Error]", dbError);
            req.authDbError = true;
            req.authenticationFailed = true;
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
            'SELECT id, username, user_type, status, password_hash, demo_flux_max_monthly_used, demo_flux_pro_monthly_used, demo_flux_lora_monthly_used, demo_imagen_monthly_used, demo_tts_monthly_chars_used, demo_flux_dev_monthly_used, demo_kling_video_monthly_used, demo_wani2v_monthly_used, demo_wani2v_v22_monthly_used, demo_usage_last_reset_month, paid_flux_pro_monthly_used, paid_flux_max_monthly_used, paid_flux_lora_monthly_used, paid_flux_dev_monthly_used, paid_kling_video_monthly_used, paid_wani2v_monthly_used, paid_wani2v_v22_monthly_used, paid_imagen3_monthly_used, paid_usage_last_reset_month FROM users WHERE username = ?',
            [code]
        );

        if (users.length === 0) {
            console.log(`[Login] Username "${code}" not found in DB.`);
            return res.status(401).json({ success: false, message: "Invalid username or code." });
        }
        const user = users[0];

        if (user.status === 'suspended') {
            console.log(`[Login] User "${user.username}" is suspended.`);
            return res.status(403).json({ success: false, message: "Account suspended." });
        }

        if (user.user_type === 'PAID') {
            console.log(`[Paid Login Attempt] User "${user.username}" (PAID type) found.`);
            const [subscriptions] = await pool.execute(
                'SELECT end_date FROM subscriptions WHERE user_id = ? AND status = "active" AND end_date > NOW()',
                [user.id]
            );
            if (subscriptions.length > 0) {
                const subEndDate = new Date(subscriptions[0].end_date);
                console.log(`[Paid Login] User ${user.username} has active subscription until ${subEndDate.toISOString()}.`);

                const currentYearMonth = getCurrentYearMonth();
                let {
                    paid_flux_pro_monthly_used: fluxProUsed = 0,
                    paid_flux_max_monthly_used: fluxMaxUsed = 0,
                    paid_flux_lora_monthly_used: fluxLoraUsed = 0,
                    paid_flux_dev_monthly_used: fluxDevUsed = 0,
                    paid_kling_video_monthly_used: klingVideoUsed = 0,
                    paid_wani2v_monthly_used: wanI2vUsed = 0,
                    paid_wani2v_v22_monthly_used: wanI2vV22Used = 0,
                    paid_imagen3_monthly_used: imagen3Used = 0,
                    paid_usage_last_reset_month: lastResetMonth
                } = user;

                if (lastResetMonth !== currentYearMonth) {
                    console.log(`[Paid Login] Resetting monthly limits for PAID user ${user.username} for new month ${currentYearMonth}. Old month: ${lastResetMonth}`);
                    fluxProUsed = 0; fluxMaxUsed = 0; fluxLoraUsed = 0; fluxDevUsed = 0; klingVideoUsed = 0; wanI2vUsed = 0; wanI2vV22Used = 0; imagen3Used = 0;
                    try {
                        await pool.execute(
                            'UPDATE users SET paid_flux_pro_monthly_used=0, paid_flux_max_monthly_used=0, paid_flux_lora_monthly_used=0, paid_flux_dev_monthly_used=0, paid_kling_video_monthly_used=0, paid_wani2v_monthly_used=0, paid_wani2v_v22_monthly_used=0, paid_imagen3_monthly_used=0, paid_usage_last_reset_month=? WHERE id=?',
                            [currentYearMonth, user.id]
                        );
                    } catch (dbResetError) {
                        console.error(`[Paid Login DB Reset Error] Failed to reset limits for user ${user.username}:`, dbResetError);
                    }
                }

                return res.json({
                    success: true, isPaidUser: true, username: user.username,
                    paidUserToken: user.username, // Using username as token for simplicity
                    subscriptionEndDate: subEndDate.toISOString(),
                    limits: {
                        imagen3ImagesLeft: PAID_USER_MAX_LIMITS_CONFIG.IMAGEN3_MONTHLY_MAX_IMAGES - imagen3Used,
                        imagen3MaxImages: PAID_USER_MAX_LIMITS_CONFIG.IMAGEN3_MONTHLY_MAX_IMAGES,
                        openaiTtsCharsLeft: PAID_USER_MAX_LIMITS_CONFIG.OPENAI_TTS_MAX_CHARS_TOTAL, // For paid, this is a per-use limit on proxy, not monthly.
                        openaiTtsMaxChars: PAID_USER_MAX_LIMITS_CONFIG.OPENAI_TTS_MAX_CHARS_TOTAL,
                        fluxKontextMaxMonthlyUsesLeft: PAID_USER_MAX_LIMITS_CONFIG.FLUX_KONTEX_MAX_MONTHLY_MAX_USES - fluxMaxUsed,
                        fluxKontextMaxMonthlyMaxUses: PAID_USER_MAX_LIMITS_CONFIG.FLUX_KONTEX_MAX_MONTHLY_MAX_USES,
                        fluxKontextProMonthlyUsesLeft: PAID_USER_MAX_LIMITS_CONFIG.FLUX_KONTEX_PRO_MONTHLY_MAX_USES - fluxProUsed,
                        fluxKontextProMonthlyMaxUses: PAID_USER_MAX_LIMITS_CONFIG.FLUX_KONTEX_PRO_MONTHLY_MAX_USES,
                        fluxKontextLoraMonthlyUsed: fluxLoraUsed,
                        fluxKontextLoraMonthlyMaxGenerations: PAID_USER_MAX_LIMITS_CONFIG.FLUX_KONTEX_LORA_MONTHLY_MAX_USES,
                        fluxDevMonthlyImagesLeft: PAID_USER_MAX_LIMITS_CONFIG.FLUX_DEV_MONTHLY_MAX_IMAGES - fluxDevUsed,
                        fluxDevMonthlyMaxImages: PAID_USER_MAX_LIMITS_CONFIG.FLUX_DEV_MONTHLY_MAX_IMAGES,
                        klingVideoMonthlyUsed: klingVideoUsed, // Send current usage for the month
                        klingVideoMonthlyMaxGenerations: PAID_USER_MAX_LIMITS_CONFIG.KLING_VIDEO_MONTHLY_MAX_GENERATIONS,
                        wanI2vMonthlyUsed: wanI2vUsed,
                        wanI2vMonthlyMaxGenerations: PAID_USER_MAX_LIMITS_CONFIG.WAN_I2V_MONTHLY_MAX_GENERATIONS,
                        wanI2vV22MonthlyUsed: wanI2vV22Used,
                        wanI2vV22MonthlyMaxGenerations: PAID_USER_MAX_LIMITS_CONFIG.WAN_I2V_V22_MONTHLY_MAX_GENERATIONS,
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
                demo_flux_lora_monthly_used: fluxLoraUsed = 0,
                demo_imagen_monthly_used: imagenUsed = 0,
                demo_tts_monthly_chars_used: ttsCharsUsed = 0,
                demo_flux_dev_monthly_used: fluxDevUsed = 0,
                demo_kling_video_monthly_used: klingVideoUsed = 0,
                demo_wani2v_monthly_used: wanI2vUsed = 0,
                demo_wani2v_v22_monthly_used: wanI2vV22Used = 0,
                demo_usage_last_reset_month: lastResetMonth
            } = user;

            if (lastResetMonth !== currentYearMonth) {
                console.log(`[DEMO Login] Resetting monthly limits for DEMO user ${user.username} for new month ${currentYearMonth}. Old month: ${lastResetMonth}`);
                fluxMaxUsed = 0; fluxProUsed = 0; fluxLoraUsed = 0; imagenUsed = 0; ttsCharsUsed = 0; fluxDevUsed = 0; klingVideoUsed = 0; wanI2vUsed = 0; wanI2vV22Used = 0;
                try {
                    await pool.execute(
                        'UPDATE users SET demo_flux_max_monthly_used=0, demo_flux_pro_monthly_used=0, demo_flux_lora_monthly_used=0, demo_imagen_monthly_used=0, demo_tts_monthly_chars_used=0, demo_flux_dev_monthly_used=0, demo_kling_video_monthly_used=0, demo_wani2v_monthly_used=0, demo_wani2v_v22_monthly_used=0, demo_usage_last_reset_month=? WHERE id=?',
                        [currentYearMonth, user.id]
                    );
                } catch (dbResetError) {
                     console.error(`[DEMO Login DB Reset Error] Failed to reset limits for user ${user.username}:`, dbResetError);
                }
            }

            const limits = {
                fluxKontextMaxMonthlyUsesLeft: Math.max(0, DEMO_USER_MONTHLY_LIMITS.FLUX_KONTEX_MAX_MONTHLY - fluxMaxUsed),
                fluxKontextMaxMonthlyMaxUses: DEMO_USER_MONTHLY_LIMITS.FLUX_KONTEX_MAX_MONTHLY,
                fluxKontextProMonthlyUsesLeft: Math.max(0, DEMO_USER_MONTHLY_LIMITS.FLUX_KONTEX_PRO_MONTHLY - fluxProUsed),
                fluxKontextProMonthlyMaxUses: DEMO_USER_MONTHLY_LIMITS.FLUX_KONTEX_PRO_MONTHLY,
                fluxKontextLoraMonthlyUsed: fluxLoraUsed,
                fluxKontextLoraMonthlyMaxUses: DEMO_USER_MONTHLY_LIMITS.FLUX_KONTEX_LORA_MONTHLY,
                imagen3MonthlyImagesLeft: Math.max(0, DEMO_USER_MONTHLY_LIMITS.IMAGEN3_MONTHLY_IMAGES - imagenUsed),
                imagen3MonthlyMaxImages: DEMO_USER_MONTHLY_LIMITS.IMAGEN3_MONTHLY_IMAGES,
                openaiTtsMonthlyCharsLeft: Math.max(0, DEMO_USER_MONTHLY_LIMITS.OPENAI_TTS_MONTHLY_CHARS - ttsCharsUsed),
                openaiTtsMonthlyMaxChars: DEMO_USER_MONTHLY_LIMITS.OPENAI_TTS_MONTHLY_CHARS,
                fluxDevMonthlyImagesLeft: Math.max(0, DEMO_USER_MONTHLY_LIMITS.FLUX_DEV_MONTHLY_IMAGES - fluxDevUsed),
                fluxDevMonthlyMaxImages: DEMO_USER_DEFAULT_MONTHLY_LIMITS.FLUX_DEV_MONTHLY_IMAGES,
                klingVideoMonthlyUsed: klingVideoUsed, // Send current usage for the month
                klingVideoMonthlyMaxUses: DEMO_USER_DEFAULT_MONTHLY_LIMITS.KLING_VIDEO_MONTHLY_MAX_USES,
                wanI2vMonthlyUsed: wanI2vUsed,
                wanI2vMonthlyMaxUses: DEMO_USER_DEFAULT_MONTHLY_LIMITS.WAN_I2V_MONTHLY_MAX_USES,
                wanI2vV22MonthlyUsed: wanI2vV22Used,
                wanI2vV22MonthlyMaxUses: DEMO_USER_DEFAULT_MONTHLY_LIMITS.WAN_I2V_V22_MONTHLY_MAX_USES,
            };
            return res.json({
                success: true, isDemoUser: true, username: user.username,
                demoUserToken: user.username, // Using username as token for simplicity
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

app.post('/api/auth/validate-trading-code', async (req, res) => {
    const { demoUserToken, tradingCode } = req.body;

    if (!demoUserToken || !tradingCode) {
        return res.status(400).json({ success: false, message: "Missing demo user token or trading code." });
    }
    if (!pool) {
        return res.status(503).json({ success: false, message: "Database service unavailable." });
    }

    try {
        const [users] = await pool.execute(
            'SELECT code_trading, status FROM users WHERE username = ? AND user_type = "DEMO"', // Added code_trading to SELECT
            [demoUserToken]
        );

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "Demo user not found." });
        }

        const user = users[0];

        if (user.status !== 'active') {
            return res.status(403).json({ success: false, message: "Demo user account is not active." });
        }

        // Compare the provided tradingCode with the one from the database
        if (user.code_trading && user.code_trading === tradingCode) {
            console.log(`[Trading Code Validation] SUCCESS: Demo user ${demoUserToken} validated trading code.`);
            return res.json({ success: true });
        } else {
            console.log(`[Trading Code Validation] FAILED: Demo user ${demoUserToken} provided invalid trading code. Expected: '${user.code_trading}', Got: '${tradingCode}'`);
            return res.status(401).json({ success: false, message: "Invalid trading access code." });
        }
    } catch (dbError) {
        console.error("[DB Trading Code Validation Error]", dbError);
        return res.status(500).json({ success: false, message: "Database error during trading code validation." });
    }
});


const GEMINI_API_KEY_PROXY = process.env.GEMINI_API_KEY;
const GOOGLE_MAPS_API_KEY_PROXY = process.env.GOOGLE_MAPS_API_KEY;
let ai;

if (GEMINI_API_KEY_PROXY) {
  ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY_PROXY });
  console.log("Google GenAI SDK initialized.");
} else console.warn("PROXY WARNING: GEMINI_API_KEY missing. Gemini and Imagen models will not function.");

if (GOOGLE_MAPS_API_KEY_PROXY) {
    console.log("GOOGLE_MAPS_API_KEY found in environment. This is relevant for AI Agent Smart backend operations.");
} else {
    console.warn("PROXY WARNING: GOOGLE_MAPS_API_KEY missing. The AI Agent Smart's location-based features (e.g., finding places, directions) might be impaired as the backend system it relies on may require this key.");
}


app.post('/api/gemini/chat/stream', async (req, res) => {
    if (req.authDbError) {
        console.log(`[Gemini Stream] Access denied due to database error during authentication (IP: ${getClientIp(req)}).`);
        return res.status(503).json({ error: "Service temporarily unavailable due to a database issue during authentication. Please try again later." });
    }
    if (req.authenticationAttempted && req.authenticationFailed) {
        console.log(`[Gemini Stream] Access denied due to failed authentication (IP: ${getClientIp(req)}).`);
        return res.status(403).json({ error: "Access Denied. Your session token is invalid, expired, account suspended, or access restricted." });
    }

    const isActualAdmin = !req.isPaidUser && !req.isDemoUser && !req.authenticationAttempted;
    const isAuthenticUser = req.isPaidUser || req.isDemoUser;

    if (!isAuthenticUser && !isActualAdmin) {
        console.log(`[Gemini Stream] Unauthenticated access attempt (IP: ${getClientIp(req)}). No valid user session or admin privileges.`);
        return res.status(401).json({ error: "Unauthorized access. Please log in." });
    }

    if (isActualAdmin) console.log(`[Gemini Stream] Admin access validated (IP: ${getClientIp(req)}).`);
    else if (req.isPaidUser) console.log(`[Gemini Stream] Paid user ${req.paidUser.username} validated.`);
    else if (req.isDemoUser) console.log(`[Gemini Stream] Demo user ${req.demoUser.username} validated.`);


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
    if (req.authDbError) {
        console.log(`[Imagen Gen] DB error during auth (IP: ${getClientIp(req)}).`);
        return res.status(503).json({ error: "Service temporarily unavailable (DB auth)." });
    }
    if (req.authenticationAttempted && req.authenticationFailed) {
        console.log(`[Imagen Gen] Auth failed (IP: ${getClientIp(req)}).`);
        return res.status(403).json({ error: "Access Denied (auth failed)." });
    }

    const isActualAdmin = !req.isPaidUser && !req.isDemoUser && !req.authenticationAttempted;
    const isAuthenticUser = req.isPaidUser || req.isDemoUser;

    if (!isAuthenticUser && !isActualAdmin) {
        console.log(`[Imagen Gen] Unauthenticated access (IP: ${getClientIp(req)}).`);
        return res.status(401).json({ error: "Unauthorized access." });
    }

  try {
    if (!ai) return res.status(500).json({ error: "Google GenAI SDK not initialized." });
    const { modelName, prompt, modelSettings } = req.body;
    if (!modelName || !prompt || !modelSettings) return res.status(400).json({ error: "Missing fields for Imagen." });

    const numImagesToGenerate = Math.max(1, Math.min(4, modelSettings?.numberOfImages || 1));

    if (req.isPaidUser && !isActualAdmin) {
      if (!req.paidUser || !pool) {
          return res.status(500).json({ error: "Internal server error: Paid user data or DB not found."});
      }
      const currentUsed = req.paidUser.paid_imagen3_monthly_used || 0;
      if (currentUsed + numImagesToGenerate > PAID_USER_MAX_LIMITS_CONFIG.IMAGEN3_MONTHLY_MAX_IMAGES) {
        return res.status(429).json({ error: `Monthly Imagen3 limit for Paid user reached. Used: ${currentUsed}/${PAID_USER_MAX_LIMITS_CONFIG.IMAGEN3_MONTHLY_MAX_IMAGES}, Requested: ${numImagesToGenerate}`, limitReached: true });
      }
      console.log(`[Imagen Proxy] Paid user ${req.paidUser.username} generating ${numImagesToGenerate} image(s). Current monthly used: ${currentUsed}.`);
    } else if (req.isDemoUser && !isActualAdmin) {
      if (!req.demoUser || !pool) {
          return res.status(500).json({ error: "Internal server error: Demo user data or DB not found."});
      }
      const remainingUses = DEMO_USER_MONTHLY_LIMITS.IMAGEN3_MONTHLY_IMAGES - (req.demoUser.imagenMonthlyUsed || 0);
      if (numImagesToGenerate > remainingUses) {
        return res.status(429).json({ error: `Monthly Imagen3 limit for DEMO user reached. You have ${remainingUses} image(s) left (requested ${numImagesToGenerate}).`, limitReached: true, usesLeft: remainingUses });
      }
    } else if (isActualAdmin) {
      console.log(`[Imagen Proxy] Admin user (IP: ${getClientIp(req)}) generating ${numImagesToGenerate} image(s). No specific limits applied.`);
    }

    const config = {
        numberOfImages: numImagesToGenerate,
        outputMimeType: modelSettings.outputMimeType || 'image/jpeg',
        ...(modelSettings.aspectRatio && modelSettings.aspectRatio !== 'default' && { aspectRatio: modelSettings.aspectRatio }),
    };
    const response = await ai.models.generateImages({ model: modelName, prompt: prompt, config: config });

    if (response.generatedImages?.length > 0) {
        const numGenerated = response.generatedImages.length;
        if (req.isPaidUser && !isActualAdmin && req.paidUser) {
            try {
                await pool.execute(
                    'UPDATE users SET paid_imagen3_monthly_used = paid_imagen3_monthly_used + ? WHERE id = ?',
                    [numGenerated, req.paidUser.id]
                );
                console.log(`[Paid Usage Update - Imagen3] SUCCESS: User ${req.paidUser.username} used ${numGenerated} images.`);
            } catch (dbUpdateError) {
                console.error(`[Paid Usage Update - Imagen3] FAILED DB update for user ${req.paidUser.username}:`, dbUpdateError);
            }
        } else if (req.isDemoUser && !isActualAdmin && req.demoUser) {
            try {
                await pool.execute(
                    'UPDATE users SET demo_imagen_monthly_used = demo_imagen_monthly_used + ? WHERE id = ?',
                    [numGenerated, req.demoUser.id]
                );
                console.log(`[Demo Usage Update - Imagen3] SUCCESS: User ${req.demoUser.username} used ${numGenerated} images.`);
            } catch (dbUpdateError) {
                console.error(`[Demo Usage Update - Imagen3] FAILED DB update for user ${req.demoUser.username}:`, dbUpdateError);
            }
        }
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
const OPENAI_STT_URL = 'https://api.openai.com/v1/audio/transcriptions';
if (OPENAI_API_KEY) console.log("OpenAI API Key found."); else console.warn("PROXY WARNING: OPENAI_API_KEY missing.");

app.post('/api/openai/chat/stream', async (req, res) => {
    if (req.authDbError) return res.status(503).json({ error: "Service temporarily unavailable (DB auth)." });
    if (req.authenticationAttempted && req.authenticationFailed) return res.status(403).json({ error: "Access Denied (auth failed)." });

    const isActualAdmin = !req.isPaidUser && !req.isDemoUser && !req.authenticationAttempted;
    const isAuthenticUser = req.isPaidUser || req.isDemoUser;

    if (!isAuthenticUser && !isActualAdmin) return res.status(401).json({ error: "Unauthorized access." });

    if (isActualAdmin) console.log(`[OpenAI Chat Stream Proxy] Admin access granted (IP: ${getClientIp(req)}).`);
    else if (req.isPaidUser) console.log(`[OpenAI Stream] Paid user ${req.paidUser.username} validated.`);
    else if (req.isDemoUser) console.log(`[OpenAI Stream] Demo user ${req.demoUser.username} validated.`);

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
    if (req.authDbError) return res.status(503).json({ error: "Service temporarily unavailable (DB auth)." });
    if (req.authenticationAttempted && req.authenticationFailed) return res.status(403).json({ error: "Access Denied (auth failed)." });

    const isActualAdmin = !req.isPaidUser && !req.isDemoUser && !req.authenticationAttempted;
    const isAuthenticUser = req.isPaidUser || req.isDemoUser;

    if (!isAuthenticUser && !isActualAdmin) return res.status(401).json({ error: "Unauthorized access." });

  try {
    if (!OPENAI_API_KEY) return res.status(500).json({ error: "OpenAI API Key not configured." });
    const { modelIdentifier, textInput, voice, speed, responseFormat = 'mp3' } = req.body;
    if (!modelIdentifier || !textInput || !voice || speed === undefined) return res.status(400).json({ error: "Missing fields for OpenAI TTS." });

    const currentChars = textInput ? textInput.length : 0;

    if (req.isPaidUser && !isActualAdmin) {
      if (currentChars > PAID_USER_MAX_LIMITS_CONFIG.OPENAI_TTS_MAX_CHARS_TOTAL) {
          return res.status(413).json({ error: `Input too long for Paid user TTS. Max: ${PAID_USER_MAX_LIMITS_CONFIG.OPENAI_TTS_MAX_CHARS_TOTAL}`, limitReached: true });
      }
      console.log(`[OpenAI TTS Proxy] Paid user ${req.paidUser.username} generating audio for ${currentChars} chars.`);
    } else if (req.isDemoUser && !isActualAdmin) {
      if (!req.demoUser || !pool) {
          return res.status(500).json({ error: "Internal server error: Demo user data or DB not found."});
      }
      const remainingChars = DEMO_USER_MONTHLY_LIMITS.OPENAI_TTS_MONTHLY_CHARS - (req.demoUser.ttsMonthlyCharsUsed || 0);
      if (currentChars > remainingChars) {
        return res.status(429).json({ error: `Monthly TTS character limit for DEMO user reached. Remaining: ${remainingChars}, requested: ${currentChars}`, limitReached: true });
      }
    } else if (isActualAdmin) {
      console.log(`[OpenAI TTS Proxy] Admin user (IP: ${getClientIp(req)}) generating audio for ${currentChars} chars.`);
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

    if (req.isDemoUser && !isActualAdmin && req.demoUser && currentChars > 0) {
      try {
        await pool.execute(
            'UPDATE users SET demo_tts_monthly_chars_used = demo_tts_monthly_chars_used + ? WHERE id = ?',
            [currentChars, req.demoUser.id]
        );
        console.log(`[Demo Usage Update - TTS] SUCCESS: User ${req.demoUser.username} used ${currentChars} chars.`);
      } catch (dbUpdateError) {
        console.error(`[Demo Usage Update - TTS] FAILED DB update for user ${req.demoUser.username}:`, dbUpdateError);
      }
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

app.post('/api/openai/stt/transcribe', upload.single('audio_file'), async (req, res) => {
    if (req.authDbError) return res.status(503).json({ error: "Service temporarily unavailable (DB auth)." });
    if (req.authenticationAttempted && req.authenticationFailed) return res.status(403).json({ error: "Access Denied (auth failed)." });
    
    const isActualAdmin = !req.isPaidUser && !req.isDemoUser && !req.authenticationAttempted;
    const isAuthenticUser = req.isPaidUser || req.isDemoUser;

    if (!isAuthenticUser && !isActualAdmin) return res.status(401).json({ error: "Unauthorized access." });

    if (!OPENAI_API_KEY) return res.status(500).json({ error: "OpenAI API Key not configured." });
    if (!req.file) return res.status(400).json({ error: "No audio file provided." });
    
    if (isActualAdmin) console.log(`[OpenAI STT Proxy] Admin access granted (IP: ${getClientIp(req)}).`);
    else if (req.isPaidUser) console.log(`[OpenAI STT] Paid user ${req.paidUser.username} validated.`);
    else if (req.isDemoUser) console.log(`[OpenAI STT] Demo user ${req.demoUser.username} validated.`);

    try {
        const formData = new FormData();
        formData.append('file', req.file.buffer, { filename: req.file.originalname, contentType: req.file.mimetype });
        formData.append('model', 'whisper-1');

        const openaiResponse = await fetch(OPENAI_STT_URL, {
            method: 'POST',
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: formData,
        });
        
        const responseData = await openaiResponse.json();

        if (!openaiResponse.ok) {
            console.error("[OpenAI STT Proxy Error] OpenAI API returned an error:", responseData);
            return res.status(openaiResponse.status).json({ error: responseData.error?.message || "Failed to transcribe audio." });
        }

        res.json({ transcription: responseData.text });
    } catch (error) {
        console.error("[OpenAI STT Proxy Error]", error);
        res.status(500).json({ error: `STT failed on proxy: ${error.message || "Internal server error"}` });
    }
});

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/chat/completions';
if (DEEPSEEK_API_KEY) console.log("Deepseek API Key found."); else console.warn("PROXY WARNING: DEEPSEEK_API_KEY missing.");

app.post('/api/deepseek/chat/stream', async (req, res) => {
    if (req.authDbError) return res.status(503).json({ error: "Service temporarily unavailable (DB auth)." });
    if (req.authenticationAttempted && req.authenticationFailed) return res.status(403).json({ error: "Access Denied (auth failed)." });

    const isActualAdmin = !req.isPaidUser && !req.isDemoUser && !req.authenticationAttempted;
    const isAuthenticUser = req.isPaidUser || req.isDemoUser;

    if (!isAuthenticUser && !isActualAdmin) return res.status(401).json({ error: "Unauthorized access." });

    if (isActualAdmin) console.log(`[Deepseek Chat Stream Proxy] Admin access granted (IP: ${getClientIp(req)}).`);
    else if (req.isPaidUser) console.log(`[Deepseek Stream] Paid user ${req.paidUser.username} validated.`);
    else if (req.isDemoUser) console.log(`[Deepseek Stream] Demo user ${req.demoUser.username} validated.`);


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
    if (req.authDbError) return res.status(503).json({ error: "Service temporarily unavailable (DB auth)." });
    if (req.authenticationAttempted && req.authenticationFailed) return res.status(403).json({ error: "Access Denied (auth failed)." });

    const isActualAdmin = !req.isPaidUser && !req.isDemoUser && !req.authenticationAttempted;
    const isAuthenticUser = req.isPaidUser || req.isDemoUser;

    if (!isAuthenticUser && !isActualAdmin) return res.status(401).json({ error: "Unauthorized access." });

  try {
    if (!FAL_KEY) return res.status(500).json({ error: "Fal.ai API Key not configured." });
    const { modelIdentifier, prompt, image_base_64, image_mime_type, images_data, ...clientSettings } = req.body;
    if (!modelIdentifier || !prompt) return res.status(400).json({ error: "Missing modelIdentifier or prompt for Flux." });

    const isFluxMax = modelIdentifier === 'fal-ai/flux-pro/kontext/max/multi';
    const num_images_requested = clientSettings.num_images || PROXY_DEFAULT_FLUX_KONTEX_SETTINGS.num_images || 1;

    if (!isActualAdmin) {
        if (isFluxMax) {
            if (!req.isPaidUser) {
                console.log(`[Fal Flux MAX Proxy] Access DENIED. Not a paid user. User: ${req.demoUser?.username || 'None'}, IP: ${getClientIp(req)}`);
                return res.status(403).json({ error: "Flux Kontext Max is exclusively for Paid Users." });
            }
            if (!pool) return res.status(500).json({ error: "DB not available for PAID user Flux MAX limit check." });
            const currentUsed = req.paidUser.fluxMaxMonthlyUsed || 0;
            if (currentUsed + num_images_requested > PAID_USER_MAX_LIMITS_CONFIG.FLUX_KONTEX_MAX_MONTHLY_MAX_USES) {
                return res.status(429).json({ error: `Monthly Flux Max limit reached. Used: ${currentUsed}/${PAID_USER_MAX_LIMITS_CONFIG.FLUX_KONTEX_MAX_MONTHLY_MAX_USES}, Requested: ${num_images_requested}`, limitReached: true });
            }
        } else {
            if (req.isPaidUser && req.paidUser) {
                if (!pool) return res.status(500).json({ error: "DB not available for PAID user Flux Pro limit check." });
                const currentUsed = req.paidUser.fluxProMonthlyUsed || 0;
                if (currentUsed + num_images_requested > PAID_USER_MAX_LIMITS_CONFIG.FLUX_KONTEX_PRO_MONTHLY_MAX_USES) {
                    return res.status(429).json({ error: `Monthly Flux Pro limit reached for paid user. Used: ${currentUsed}/${PAID_USER_MAX_LIMITS_CONFIG.FLUX_KONTEX_PRO_MONTHLY_MAX_USES}, Requested: ${num_images_requested}`, limitReached: true });
                }
            } else if (req.isDemoUser && req.demoUser) {
                if (!pool) return res.status(500).json({ error: "DB not available for DEMO limit check." });
                const usedCount = req.demoUser.fluxProMonthlyUsed || 0;
                if (usedCount + num_images_requested > DEMO_USER_MONTHLY_LIMITS.FLUX_KONTEX_PRO_MONTHLY) {
                    return res.status(429).json({ error: `Monthly Flux Pro limit for DEMO user reached. Used: ${usedCount}/${DEMO_USER_MONTHLY_LIMITS.FLUX_KONTEX_PRO_MONTHLY}, Requested: ${num_images_requested}`, limitReached: true });
                }
            }
        }
    } else {
        console.log(`[Fal Flux Edit Proxy] Admin access granted (IP: ${getClientIp(req)}). Bypassing limits for ${isFluxMax ? 'Max' : 'Pro'}.`);
    }

    const effectiveSettings = { ...PROXY_DEFAULT_FLUX_KONTEX_SETTINGS, ...clientSettings, num_images: num_images_requested };
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
    falInputPayload.num_images = effectiveSettings.num_images;
    if (effectiveSettings.aspect_ratio && effectiveSettings.aspect_ratio !== 'default') falInputPayload.aspect_ratio = effectiveSettings.aspect_ratio;
    if (effectiveSettings.output_format) falInputPayload.output_format = effectiveSettings.output_format;
    if (clientSettings.num_inference_steps !== undefined && !isFluxMax) falInputPayload.num_inference_steps = clientSettings.num_inference_steps;
    if (clientSettings.safety_tolerance !== undefined) falInputPayload.safety_tolerance = clientSettings.safety_tolerance;

    const queueResult = await fal.queue.submit(modelIdentifier, { input: falInputPayload });
    if (!queueResult?.request_id) return res.status(500).json({ error: "Fal.ai submission failed (no request ID)." });

    if (!isActualAdmin) {
        if (req.isPaidUser && req.paidUser) {
            const fieldToUpdate = isFluxMax ? 'paid_flux_max_monthly_used' : 'paid_flux_pro_monthly_used';
            try {
                await pool.execute(`UPDATE users SET ${fieldToUpdate} = ${fieldToUpdate} + ? WHERE id = ?`, [num_images_requested, req.paidUser.id]);
                console.log(`[Paid Usage Update - Flux ${isFluxMax ? 'Max' : 'Pro'}] SUCCESS: User ${req.paidUser.username} used ${num_images_requested}.`);
            } catch (dbUpdateError) {
                console.error(`[Paid Usage Update - Flux ${isFluxMax ? 'Max' : 'Pro'}] FAILED DB update for user ${req.paidUser.username}:`, dbUpdateError);
            }
        } else if (req.isDemoUser && req.demoUser && !isFluxMax) {
            try {
                await pool.execute(`UPDATE users SET demo_flux_pro_monthly_used = demo_flux_pro_monthly_used + ? WHERE id = ?`, [num_images_requested, req.demoUser.id]);
                console.log(`[Demo Usage Update - Flux Pro] SUCCESS: User ${req.demoUser.username} used ${num_images_requested}.`);
            } catch (dbUpdateError) {
                 console.error(`[Demo Usage Update - Flux Pro] FAILED DB update for user ${req.demoUser.username}:`, dbUpdateError);
            }
        }
    }
    res.json({ requestId: queueResult.request_id, message: "Image editing request submitted." });
  } catch (error) {
    console.error("[Flux Edit Proxy Error]", error);
    res.status(500).json({ error: `Flux Edit Error: ${error.message || "Internal server error"}` });
  }
});

app.post('/api/fal/image/edit/flux-kontext-lora', async (req, res) => {
    if (req.authDbError) return res.status(503).json({ error: "Service temporarily unavailable (DB auth)." });
    if (req.authenticationAttempted && req.authenticationFailed) return res.status(403).json({ error: "Access Denied (auth failed)." });

    const isActualAdmin = !req.isPaidUser && !req.isDemoUser && !req.authenticationAttempted;
    const isAuthenticUser = req.isPaidUser || req.isDemoUser;

    if (!isAuthenticUser && !isActualAdmin) return res.status(401).json({ error: "Unauthorized access." });

  try {
    if (!FAL_KEY) return res.status(500).json({ error: "Fal.ai API Key not configured." });
    const { modelIdentifier, prompt, image_base_64, image_mime_type, settings } = req.body;
    if (!modelIdentifier || !prompt || !settings || !image_base_64 || !image_mime_type) {
        return res.status(400).json({ error: "Missing required fields for Flux Kontext Lora." });
    }
    const num_images_requested = settings.num_images || 1;

    if (!isActualAdmin) {
        if (!req.isPaidUser) {
            console.log(`[Fal Flux Lora Proxy] Access DENIED. Not a paid user. User: ${req.demoUser?.username || 'None'}, IP: ${getClientIp(req)}`);
            return res.status(403).json({ error: "Flux Kontext Lora is exclusively for Paid Users." });
        }
        if (!pool) return res.status(500).json({ error: "DB not available for PAID user Flux Lora limit check." });
        const currentUsed = req.paidUser.fluxLoraMonthlyUsed || 0;
        if (currentUsed + num_images_requested > PAID_USER_MAX_LIMITS_CONFIG.FLUX_KONTEX_LORA_MONTHLY_MAX_USES) {
            return res.status(429).json({ error: `Monthly Flux Lora limit reached. Used: ${currentUsed}/${PAID_USER_MAX_LIMITS_CONFIG.FLUX_KONTEX_LORA_MONTHLY_MAX_USES}, Requested: ${num_images_requested}`, limitReached: true });
        }
    } else {
        console.log(`[Fal Flux Lora Proxy] Admin access granted (IP: ${getClientIp(req)}). Bypassing limits.`);
    }
    
    const falInputPayload = {
      prompt,
      image_url: `data:${image_mime_type};base64,${image_base_64}`,
    };

    if (settings.negative_prompt !== undefined) falInputPayload.negative_prompt = settings.negative_prompt;
    if (settings.num_inference_steps !== undefined) falInputPayload.num_inference_steps = settings.num_inference_steps;
    if (settings.seed !== undefined && settings.seed !== null) falInputPayload.seed = settings.seed;
    if (settings.guidance_scale !== undefined) falInputPayload.guidance_scale = settings.guidance_scale;
    if (settings.num_images !== undefined) falInputPayload.num_images = settings.num_images;
    if (settings.output_format !== undefined) falInputPayload.output_format = settings.output_format;
    if (settings.loras !== undefined && Array.isArray(settings.loras)) falInputPayload.loras = settings.loras;
    if (settings.acceleration !== undefined) falInputPayload.acceleration = settings.acceleration;
    if (settings.resolution_mode !== undefined) falInputPayload.resolution_mode = settings.resolution_mode;
    if (settings.enable_safety_checker !== undefined) falInputPayload.enable_safety_checker = settings.enable_safety_checker;
    if (settings.sampler_name !== undefined) falInputPayload.sampler_name = settings.sampler_name;
    if (settings.scheduler !== undefined) falInputPayload.scheduler = settings.scheduler;
    if (settings.denoising_strength !== undefined) falInputPayload.denoising_strength = settings.denoising_strength;
    if (settings.clip_skip !== undefined) falInputPayload.clip_skip = settings.clip_skip;
    
    const queueResult = await fal.queue.submit(modelIdentifier, { input: falInputPayload });
    if (!queueResult?.request_id) return res.status(500).json({ error: "Fal.ai submission failed (no request ID)." });

    if (req.isPaidUser && !isActualAdmin && req.paidUser) {
      try {
        await pool.execute('UPDATE users SET paid_flux_lora_monthly_used = paid_flux_lora_monthly_used + ? WHERE id = ?', [num_images_requested, req.paidUser.id]);
        console.log(`[Paid Usage Update - Flux Lora] SUCCESS: User ${req.paidUser.username} used ${num_images_requested}.`);
      } catch (dbUpdateError) {
        console.error(`[Paid Usage Update - Flux Lora] FAILED DB update for user ${req.paidUser.username}:`, dbUpdateError);
      }
    }
    res.json({ requestId: queueResult.request_id, message: "Image editing request with Lora submitted." });
  } catch (error) {
    console.error("[Flux Lora Edit Proxy Error]", error);
    res.status(500).json({ error: `Flux Lora Edit Error: ${error.message || "Internal server error"}` });
  }
});

app.post('/api/fal/image/generate/flux-dev', async (req, res) => {
    if (req.authDbError) return res.status(503).json({ error: "Service temporarily unavailable (DB auth)." });
    if (req.authenticationAttempted && req.authenticationFailed) return res.status(403).json({ error: "Access Denied (auth failed)." });

    const isActualAdmin = !req.isPaidUser && !req.isDemoUser && !req.authenticationAttempted;
    const isAuthenticUser = req.isPaidUser || req.isDemoUser;

    if (!isAuthenticUser && !isActualAdmin) return res.status(401).json({ error: "Unauthorized access." });

  try {
    if (!FAL_KEY) return res.status(500).json({ error: "Fal.ai API Key not configured." });
    const { modelIdentifier, prompt, ...clientSettings } = req.body;

    if (modelIdentifier !== 'fal-ai/flux-1/dev') {
        return res.status(400).json({ error: "Invalid modelIdentifier for Flux Dev." });
    }
    if (!prompt) return res.status(400).json({ error: "Missing prompt for Flux Dev." });

    const numImagesToGenerate = Math.max(1, Math.min(4, clientSettings?.num_images || PROXY_DEFAULT_FLUX_DEV_SETTINGS.num_images || 1));

    if (!isActualAdmin) {
        if (!req.isPaidUser) {
            console.log(`[Fal Flux Dev Proxy] Access DENIED. Not a paid user. User: ${req.demoUser?.username || 'None'}, IP: ${getClientIp(req)}`);
            return res.status(403).json({ error: "Flux Dev is exclusively for Paid Users." });
        }
        if (!pool) return res.status(500).json({ error: "DB not available for PAID user Flux Dev limit check." });
        const currentUsed = req.paidUser.fluxDevMonthlyUsed || 0;
        if (currentUsed + numImagesToGenerate > PAID_USER_MAX_LIMITS_CONFIG.FLUX_DEV_MONTHLY_MAX_IMAGES) {
            return res.status(429).json({ error: `Monthly Flux Dev image limit reached for paid user. Used: ${currentUsed}/${PAID_USER_MAX_LIMITS_CONFIG.FLUX_DEV_MONTHLY_MAX_IMAGES}, Requested: ${numImagesToGenerate}`, limitReached: true });
        }
    } else {
        console.log(`[Fal Flux Dev Proxy] Admin access granted (IP: ${getClientIp(req)}). Bypassing limits.`);
    }

    const falInput = { prompt, ...PROXY_DEFAULT_FLUX_DEV_SETTINGS, ...clientSettings, num_images: numImagesToGenerate };
    if ('aspect_ratio' in falInput) {
        delete falInput.aspect_ratio;
    }

    const queueResult = await fal.queue.submit(modelIdentifier, { input: falInput });
    if (!queueResult?.request_id) return res.status(500).json({ error: "Fal.ai Flux Dev submission failed (no request ID)." });

    if (req.isPaidUser && !isActualAdmin && req.paidUser) {
      try {
        await pool.execute('UPDATE users SET paid_flux_dev_monthly_used = paid_flux_dev_monthly_used + ? WHERE id = ?', [numImagesToGenerate, req.paidUser.id]);
        console.log(`[Paid Usage Update - Flux Dev] SUCCESS: User ${req.paidUser.username} generated ${numImagesToGenerate} images.`);
      } catch (dbUpdateError) {
        console.error(`[Paid Usage Update - Flux Dev] FAILED DB update for user ${req.paidUser.username}:`, dbUpdateError);
      }
    }

    res.json({ requestId: queueResult.request_id, message: "Flux Dev image generation request submitted." });
  } catch (error) {
    console.error("[Flux Dev Gen Proxy Error]", error);
    res.status(500).json({ error: `Flux Dev Gen Error: ${error.message || "Internal server error"}` });
  }
});

app.post('/api/fal/video/generate/kling', async (req, res) => {
    if (req.authDbError) return res.status(503).json({ error: "Service temporarily unavailable (DB auth)." });
    if (req.authenticationAttempted && req.authenticationFailed) return res.status(403).json({ error: "Access Denied (auth failed)." });

    const isActualAdmin = !req.isPaidUser && !req.isDemoUser && !req.authenticationAttempted;
    const isAuthenticUser = req.isPaidUser || req.isDemoUser;

    if (!isAuthenticUser && !isActualAdmin) return res.status(401).json({ error: "Unauthorized access." });

    try {
        if (!FAL_KEY) return res.status(500).json({ error: "Fal.ai API Key not configured." });
        const { modelIdentifier, prompt, settings, image_base_64, image_mime_type } = req.body;
        if (!modelIdentifier || !prompt || !settings || !image_base_64 || !image_mime_type) {
            return res.status(400).json({ error: "Missing fields for Kling AI video generation." });
        }

        if (!isActualAdmin) {
            if (!req.isPaidUser) {
                console.log(`[Fal Kling Video Proxy] Access DENIED. Not a paid user. User: ${req.demoUser?.username || 'None'}, IP: ${getClientIp(req)}`);
                return res.status(403).json({ error: "Kling AI Video generation is exclusively for Paid Users." });
            }
            if (!pool) return res.status(500).json({ error: "DB not available for PAID user Kling AI Video limit check." });
            const currentUsed = req.paidUser.klingVideoMonthlyUsed || 0;
            if (currentUsed >= PAID_USER_MAX_LIMITS_CONFIG.KLING_VIDEO_MONTHLY_MAX_GENERATIONS) {
                return res.status(429).json({
                    error: `Monthly Kling AI Video generation limit reached. Used: ${currentUsed}/${PAID_USER_MAX_LIMITS_CONFIG.KLING_VIDEO_MONTHLY_MAX_GENERATIONS}`,
                    limitReached: true
                });
            }
        } else {
            console.log(`[Fal Kling Video Proxy] Admin access granted (IP: ${getClientIp(req)}). Bypassing limits.`);
        }

        const falInput = {
            prompt: prompt,
            image_url: `data:${image_mime_type};base64,${image_base_64}`,
            duration: settings.duration || PROXY_DEFAULT_KLING_AI_SETTINGS.duration,
            aspect_ratio: settings.aspect_ratio || PROXY_DEFAULT_KLING_AI_SETTINGS.aspect_ratio,
            negative_prompt: settings.negative_prompt || PROXY_DEFAULT_KLING_AI_SETTINGS.negative_prompt,
            cfg_scale: settings.cfg_scale || PROXY_DEFAULT_KLING_AI_SETTINGS.cfg_scale,
        };

        const queueResult = await fal.queue.submit(modelIdentifier, { input: falInput });
        if (!queueResult?.request_id) return res.status(500).json({ error: "Fal.ai Kling AI video submission failed (no request ID)." });

        if (req.isPaidUser && !isActualAdmin && req.paidUser) {
            const currentUsedInMiddleware = req.paidUser.klingVideoMonthlyUsed;
            console.log(`[Paid Usage Update - Kling Video] Attempting to increment count for user ${req.paidUser.username} (ID: ${req.paidUser.id}). Current DB value (from middleware snapshot) was: ${currentUsedInMiddleware}`);
            try {
                const [updateResult] = await pool.execute('UPDATE users SET paid_kling_video_monthly_used = paid_kling_video_monthly_used + 1 WHERE id = ?', [req.paidUser.id]);
                if (updateResult.affectedRows > 0) {
                    console.log(`[Paid Usage Update - Kling Video] SUCCESS: User ${req.paidUser.username} (ID: ${req.paidUser.id}) count incremented. Affected rows: ${updateResult.affectedRows}`);
                } else {
                    console.warn(`[Paid Usage Update - Kling Video] WARNING: User ${req.paidUser.username} (ID: ${req.paidUser.id}) count increment query ran but affected 0 rows. This might indicate the user ID was not found or other issues.`);
                }
            } catch (dbUpdateError) {
                console.error(`[Paid Usage Update - Kling Video] FAILED DB update for user ${req.paidUser.username} (ID: ${req.paidUser.id}):`, dbUpdateError);
            }
        }

        res.json({ requestId: queueResult.request_id, message: "Kling AI video request submitted." });
    } catch (error) {
        console.error("[Kling Video Gen Proxy Error]", error);
        res.status(500).json({ error: `Kling Video Gen Error: ${error.message || "Internal server error"}` });
    }
});

app.post('/api/fal/video/generate/wan-i2v', async (req, res) => {
    if (req.authDbError) return res.status(503).json({ error: "Service temporarily unavailable (DB auth)." });
    if (req.authenticationAttempted && req.authenticationFailed) return res.status(403).json({ error: "Access Denied (auth failed)." });

    const isActualAdmin = !req.isPaidUser && !req.isDemoUser && !req.authenticationAttempted;
    const isAuthenticUser = req.isPaidUser || req.isDemoUser;

    if (!isAuthenticUser && !isActualAdmin) return res.status(401).json({ error: "Unauthorized access." });

    try {
        if (!FAL_KEY) return res.status(500).json({ error: "Fal.ai API Key not configured." });
        const { modelIdentifier, prompt, settings, image_base_64, image_mime_type } = req.body;
        if (!modelIdentifier || !prompt || !settings || !image_base_64 || !image_mime_type) {
            return res.status(400).json({ error: "Missing fields for Wan I2V video generation." });
        }

        if (!isActualAdmin) {
            if (!req.isPaidUser) {
                console.log(`[Fal Wan I2V Proxy] Access DENIED. Not a paid user. User: ${req.demoUser?.username || 'None'}, IP: ${getClientIp(req)}`);
                return res.status(403).json({ error: "Wan I2V video generation is exclusively for Paid Users." });
            }
            if (!pool) return res.status(500).json({ error: "DB not available for PAID user Wan I2V limit check." });
            const currentUsed = req.paidUser.wanI2vMonthlyUsed || 0;
            if (currentUsed >= PAID_USER_MAX_LIMITS_CONFIG.WAN_I2V_MONTHLY_MAX_GENERATIONS) {
                return res.status(429).json({
                    error: `Monthly Wan I2V video generation limit reached. Used: ${currentUsed}/${PAID_USER_MAX_LIMITS_CONFIG.WAN_I2V_MONTHLY_MAX_GENERATIONS}`,
                    limitReached: true
                });
            }
        } else {
            console.log(`[Fal Wan I2V Proxy] Admin access granted (IP: ${getClientIp(req)}). Bypassing limits.`);
        }

        const falInput = {
            prompt,
            image_url: `data:${image_mime_type};base64,${image_base_64}`,
            ...PROXY_DEFAULT_WAN_I2V_SETTINGS,
            ...settings, // Client settings override defaults
        };

        const queueResult = await fal.queue.submit(modelIdentifier, { input: falInput });
        if (!queueResult?.request_id) return res.status(500).json({ error: "Fal.ai Wan I2V video submission failed (no request ID)." });

        if (req.isPaidUser && !isActualAdmin && req.paidUser) {
            try {
                await pool.execute('UPDATE users SET paid_wani2v_monthly_used = paid_wani2v_monthly_used + 1 WHERE id = ?', [req.paidUser.id]);
                console.log(`[Paid Usage Update - Wan I2V] SUCCESS: User ${req.paidUser.username} count incremented.`);
            } catch (dbUpdateError) {
                console.error(`[Paid Usage Update - Wan I2V] FAILED DB update for user ${req.paidUser.username}:`, dbUpdateError);
            }
        }

        res.json({ requestId: queueResult.request_id, message: "Wan I2V video request submitted." });
    } catch (error) {
        console.error("[Wan I2V Gen Proxy Error]", error);
        res.status(500).json({ error: `Wan I2V Gen Error: ${error.message || "Internal server error"}` });
    }
});

app.post('/api/fal/video/generate/wan-i2v-v22', async (req, res) => {
    if (req.authDbError) return res.status(503).json({ error: "Service temporarily unavailable (DB auth)." });
    if (req.authenticationAttempted && req.authenticationFailed) return res.status(403).json({ error: "Access Denied (auth failed)." });

    const isActualAdmin = !req.isPaidUser && !req.isDemoUser && !req.authenticationAttempted;
    const isAuthenticUser = req.isPaidUser || req.isDemoUser;

    if (!isAuthenticUser && !isActualAdmin) return res.status(401).json({ error: "Unauthorized access." });

    try {
        if (!FAL_KEY) return res.status(500).json({ error: "Fal.ai API Key not configured." });
        const { modelIdentifier, prompt, settings, image_base_64, image_mime_type } = req.body;
        if (!modelIdentifier || !prompt || !settings || !image_base_64 || !image_mime_type) {
            return res.status(400).json({ error: "Missing fields for Wan I2V v2.2 video generation." });
        }

        if (!isActualAdmin) {
            if (!req.isPaidUser) {
                console.log(`[Fal Wan I2V v2.2 Proxy] Access DENIED. Not a paid user. User: ${req.demoUser?.username || 'None'}, IP: ${getClientIp(req)}`);
                return res.status(403).json({ error: "Wan I2V v2.2 video generation is exclusively for Paid Users." });
            }
            if (!pool) return res.status(500).json({ error: "DB not available for PAID user Wan I2V v2.2 limit check." });
            const currentUsed = req.paidUser.wanI2vV22MonthlyUsed || 0;
            if (currentUsed >= PAID_USER_MAX_LIMITS_CONFIG.WAN_I2V_V22_MONTHLY_MAX_GENERATIONS) {
                return res.status(429).json({
                    error: `Monthly Wan I2V v2.2 video generation limit reached. Used: ${currentUsed}/${PAID_USER_MAX_LIMITS_CONFIG.WAN_I2V_V22_MONTHLY_MAX_GENERATIONS}`,
                    limitReached: true
                });
            }
        } else {
            console.log(`[Fal Wan I2V v2.2 Proxy] Admin access granted (IP: ${getClientIp(req)}). Bypassing limits.`);
        }

        const falInput = {
            prompt,
            image_url: `data:${image_mime_type};base64,${image_base_64}`,
            ...PROXY_DEFAULT_WAN_I2V_V22_SETTINGS,
            ...settings,
        };

        const queueResult = await fal.queue.submit(modelIdentifier, { input: falInput });
        if (!queueResult?.request_id) return res.status(500).json({ error: "Fal.ai Wan I2V v2.2 video submission failed (no request ID)." });

        if (req.isPaidUser && !isActualAdmin && req.paidUser) {
            try {
                await pool.execute('UPDATE users SET paid_wani2v_v22_monthly_used = paid_wani2v_v22_monthly_used + 1 WHERE id = ?', [req.paidUser.id]);
                console.log(`[Paid Usage Update - Wan I2V v2.2] SUCCESS: User ${req.paidUser.username} count incremented.`);
            } catch (dbUpdateError) {
                console.error(`[Paid Usage Update - Wan I2V v2.2] FAILED DB update for user ${req.paidUser.username}:`, dbUpdateError);
            }
        }

        res.json({ requestId: queueResult.request_id, message: "Wan I2V v2.2 video request submitted." });
    } catch (error) {
        console.error("[Wan I2V v2.2 Gen Proxy Error]", error);
        res.status(500).json({ error: `Wan I2V v2.2 Gen Error: ${error.message || "Internal server error"}` });
    }
});



app.post('/api/fal/queue/status', async (req, res) => {
  try {
    if (!FAL_KEY) return res.status(500).json({ error: "Fal.ai API Key not configured." });
    const { requestId, modelIdentifier } = req.body;
    if (!requestId || !modelIdentifier) return res.status(400).json({ error: "Missing requestId or modelIdentifier." });

    const statusResult = await fal.queue.status(modelIdentifier, { requestId, logs: true });
    let responsePayload = { status: statusResult?.status, rawResult: statusResult, imageUrl: undefined, imageUrls: undefined, videoUrl: undefined, message: undefined, error: undefined };


    if (statusResult?.status === 'COMPLETED') {
        const jobResult = await fal.queue.result(modelIdentifier, { requestId });
        responsePayload.rawResult = jobResult;

        const isVideoModel = modelIdentifier.includes('kling-video') || modelIdentifier.includes('wan-i2v') || modelIdentifier.includes('wan/v2.2-5b');

        if (isVideoModel) {
            let videoUrlResult;
            if (jobResult?.video?.url) { // wan-i2v format
                videoUrlResult = jobResult.video.url;
            } else if (jobResult?.data?.video?.url) { // kling format
                videoUrlResult = jobResult.data.video.url;
            }

            if (videoUrlResult) {
                responsePayload.videoUrl = videoUrlResult;
                responsePayload.message = "Video processing completed successfully.";
            } else {
                responsePayload.status = 'COMPLETED_NO_VIDEO';
                responsePayload.message = "Processing completed, but no video URL was found in the result.";
                responsePayload.error = "Fal.ai video result did not contain expected video URL. Raw result logged on proxy.";
                console.warn(`[Fal Status] COMPLETED_NO_VIDEO for ${modelIdentifier}, reqId ${requestId}. Raw result:`, JSON.stringify(jobResult, null, 2));
            }
        } else { // Assume image model
            let imageUrlsResult = [];
            if (jobResult?.images && Array.isArray(jobResult.images)) { 
                imageUrlsResult = jobResult.images.map((img) => img?.url).filter(Boolean);
            } else if (jobResult?.data?.images && Array.isArray(jobResult.data.images)) { // Fallback if nested under 'data'
                imageUrlsResult = jobResult.data.images.map((img) => img?.url).filter(Boolean);
            }
            
            if (imageUrlsResult.length === 0 && jobResult?.image_url && typeof jobResult.image_url === 'string') { 
                imageUrlsResult.push(jobResult.image_url);
            } else if (imageUrlsResult.length === 0 && jobResult?.data?.image_url && typeof jobResult.data.image_url === 'string') {
                imageUrlsResult.push(jobResult.data.image_url);
            }


            if (imageUrlsResult.length > 0) {
                responsePayload.imageUrls = imageUrlsResult; 
                responsePayload.imageUrl = imageUrlsResult[0]; 
                if (!responsePayload.message) responsePayload.message = "Image processing completed successfully.";
            } else {
                responsePayload.status = 'COMPLETED_NO_IMAGE'; 
                if (!responsePayload.message) responsePayload.message = "Processing completed, but no image URL found in the result.";
                if (!responsePayload.error) responsePayload.error = "Fal.ai image result did not contain expected image URL(s). Raw result logged on proxy.";
                console.warn(`[Fal Status] COMPLETED_NO_IMAGE for ${modelIdentifier}, reqId ${requestId}. Raw result:`, JSON.stringify(jobResult, null, 2));
            }
        }
    } else if (statusResult?.status === 'ERROR') {
        responsePayload.error = statusResult.error?.message || "Fal.ai reported an error.";
        responsePayload.message = "Processing failed.";
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

// AlphaVantage endpoint removed.

app.post('/api/gemini/trading-analysis', async (req, res) => {
    if (req.authDbError) {
        console.log(`[Trading Analysis] Access denied due to database error during authentication (IP: ${getClientIp(req)}).`);
        return res.status(503).json({ error: "Service temporarily unavailable (DB auth)." });
    }
    if (req.authenticationAttempted && req.authenticationFailed) {
        console.log(`[Trading Analysis] Access denied due to failed authentication (IP: ${getClientIp(req)}).`);
        return res.status(403).json({ error: "Access Denied (auth failed)." });
    }

    const isActualAdmin = !req.isPaidUser && !req.isDemoUser && !req.authenticationAttempted;
    const isAuthenticUser = req.isPaidUser || req.isDemoUser;

    if (!isAuthenticUser && !isActualAdmin) {
        console.log(`[Trading Analysis] Unauthenticated access attempt (IP: ${getClientIp(req)}).`);
        return res.status(401).json({ error: "Unauthorized access." });
    }

    if (isActualAdmin) console.log(`[Trading Analysis] Admin access validated (IP: ${getClientIp(req)}).`);
    else if (req.isPaidUser) console.log(`[Trading Analysis] Paid user ${req.paidUser.username} validated.`);
    else if (req.isDemoUser) {
        if (!req.body.demoTradingProAccessGranted) { // A flag indicating client-side code validation was successful
            console.log(`[Trading Analysis] DEMO User ${req.demoUser.username} attempted Trading Pro without access code. IP: ${getClientIp(req)}`);
            return res.status(403).json({ error: "Trading Pro access for DEMO users requires a valid access code."});
        }
        console.log(`[Trading Analysis] Demo user ${req.demoUser.username} validated (with access code).`);
    }


    if (!ai) return res.status(500).json({ error: "Google GenAI SDK not initialized for Trading Analysis." });
    const { chartImageBase64, pairLabel } = req.body; // Text prompt is now generated on proxy

    if (!pairLabel) {
        return res.status(400).json({ error: "Missing required field: pairLabel." });
    }

    const today = new Date().toISOString().split('T')[0];

    // Construct the detailed prompt for the AI
    let analysisPrompt = `You are an expert financial market analyst for ${pairLabel}.
Current date is ${today}.

USER UPLOADED IMAGE HANDLING:
${chartImageBase64 ? 
`An image has been provided. First, carefully determine if this image is a relevant TradingView chart screenshot that clearly displays price action (candlesticks/bars), and ideally indicators like RSI or MA for ${pairLabel}. The image must be legible and directly related to financial chart analysis.
- IF THE IMAGE IS INVALID (e.g., not a TradingView chart, a picture of a cat, unreadable, completely irrelevant content for financial analysis of ${pairLabel}):
  Your response MUST START with the exact phrase: "IMAGE_INVALID_TRADING_CHART".
  After this phrase, on a new line, proceed with the full market analysis based ON WEB RESEARCH ONLY as detailed below, completely ignoring the invalid image.
- IF THE IMAGE IS VALID (a clear, relevant TradingView chart for ${pairLabel}):
  Use the information from this valid TradingView chart in conjunction with your web research for the analysis detailed below. Do NOT include the "IMAGE_INVALID_TRADING_CHART" phrase in this case.` 
: 
"No image has been provided. Proceed with web research only."
}

MARKET ANALYSIS TASK (Based on valid image + web research, or web research only if no/invalid image):
You MUST research and include the following information. Be thorough and precise:
1.  Today's Date: (Confirm ${today})
2.  H4 Chart Analysis (TradingView): Describe current H4 chart patterns (e.g., head and shoulders, triangles, flags), current price action relative to key levels, and any visible trendlines or channels. If a valid image was provided, integrate its visual information. If no image or an invalid image was provided, you MUST research this information from TradingView or similar reputable financial charting sites.
3.  H1 Chart Analysis (TradingView): Describe current H1 chart patterns, price action, and key short-term levels. Research this from TradingView or similar.
4.  Technical Indicators:
    *   RSI (Relative Strength Index): Current values on H4 and H1, and whether they indicate overbought/oversold conditions or divergence.
    *   MA20 (20-period Moving Average): Current values on H4 and H1. Is the price above or below the MA20? Is the MA20 acting as support/resistance?
    *   Buy/Sell Pressure: Summarize overall buy/sell pressure or market sentiment if discernible from web research or volume indicators (if you can find this info).
5.  News Impact (Next 1-7 Days): Identify significant upcoming economic news, announcements (e.g., FOMC for XAUUSD, major crypto news for BTCUSD), or geopolitical events scheduled for the next 1 to 7 days that could directly impact ${pairLabel}. Explain the potential direction of impact.
6.  Support & Resistance (H4): Identify key support and resistance levels on the H4 timeframe based on your chart analysis (from valid image or web research). List at least 2 support and 2 resistance levels.
7.  Trading Recommendations: Based on ALL the above information, provide specific, actionable recommendations:
    *   Recommended entry price range(s) for buying.
    *   Recommended entry price range(s) for selling (shorting).
    *   Suggested take profit levels for both buy and sell recommendations.
    *   Suggested stop-loss levels for both buy and sell recommendations.
    *   Provide a brief rationale for these recommendations, linking them to your chart analysis, indicators, and news.

Conclude your entire response with a price prediction for the near future (next 1-7 days, considering H4 trends) in the following JSON format, embedded within your text response using a JSON code block. Ensure this JSON block is the LAST part of your textual response before any sources.
\`\`\`json
{
  "trend_prediction": {
    "up_percentage": <integer between 0-100>,
    "down_percentage": <integer between 0-100>,
    "sideways_percentage": <integer between 0-100>
  },
  "detailed_analysis": "<Your complete, detailed textual analysis here, incorporating all 7 points above. This should be a comprehensive report.>"
}
\`\`\`
Ensure the sum of percentages for up, down, and sideways is 100.
If you list web sources, use the term "Sources:" followed by a list. Do NOT list 'vertexaisearch.cloud.google.com' as a source.
The "detailed_analysis" field in the JSON should be a complete summary of your findings. The text part of your response leading up to the JSON block should also contain this full analysis.
`;

    try {
        const textPart = { text: analysisPrompt };
        let geminiContents;

        if (chartImageBase64) {
            const imagePart = {
                inlineData: { mimeType: 'image/png', data: chartImageBase64 }, // Assuming PNG, client should ensure
            };
            geminiContents = { parts: [textPart, imagePart] };
            console.log(`[Trading Analysis Proxy] Performing analysis for ${pairLabel} WITH UPLOADED chart image.`);
        } else {
            geminiContents = { parts: [textPart] };
            console.log(`[Trading Analysis Proxy] Performing analysis for ${pairLabel} WITHOUT chart image (web research only).`);
        }

        const geminiResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: geminiContents,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });

        let analysisText = "Analysis text not available.";
        let trendPredictions = null;
        let groundingSources = [];
        let imageValidationError = null;

        const responseTextFromGemini = geminiResponse.text;

        if (responseTextFromGemini) {
            let rawText = responseTextFromGemini.trim();
            
            // Check for image invalidation marker
            if (rawText.startsWith("IMAGE_INVALID_TRADING_CHART")) {
                imageValidationError = "IMAGE_INVALID_TRADING_CHART";
                console.log(`[Trading Analysis Proxy] Gemini flagged uploaded image as invalid for ${pairLabel}.`);
                // Remove the marker and the newline following it for further processing
                const newlineIndex = rawText.indexOf('\n');
                rawText = newlineIndex !== -1 ? rawText.substring(newlineIndex + 1).trim() : "";
                 // Return the error to the client immediately if the image is invalid, along with any subsequent analysis.
                 // The client will then decide how to display this.
            }

            let jsonContentString = "";
            let textBeforeJson = ""; // This will be the main analysis text
            // The AI is instructed to put the JSON at the end.

            const jsonStartMarker = "```json";
            const jsonEndMarker = "```";
            const lastJsonStartIndex = rawText.lastIndexOf(jsonStartMarker);

            if (lastJsonStartIndex !== -1) {
                const jsonBlockStartIndex = lastJsonStartIndex + jsonStartMarker.length;
                const jsonBlockEndIndex = rawText.indexOf(jsonEndMarker, jsonBlockStartIndex);

                if (jsonBlockEndIndex !== -1) {
                    jsonContentString = rawText.substring(jsonBlockStartIndex, jsonBlockEndIndex).trim();
                    analysisText = rawText.substring(0, lastJsonStartIndex).trim(); // Text before the JSON block is the main analysis

                    try {
                        const parsedData = JSON.parse(jsonContentString);
                        if (parsedData.trend_prediction) {
                            const { up_percentage, down_percentage, sideways_percentage } = parsedData.trend_prediction;
                            if (typeof up_percentage === 'number' && typeof down_percentage === 'number' && typeof sideways_percentage === 'number') {
                                trendPredictions = { up_percentage, down_percentage, sideways_percentage };
                                let sum = up_percentage + down_percentage + sideways_percentage;
                                if (sum > 0 && Math.abs(sum - 100) <= 5) { // Allow small tolerance
                                    if (sum !== 100) {
                                         console.warn(`[Trading Analysis Proxy] Normalizing trend prediction percentages. Original sum: ${sum}, Original values:`, JSON.stringify(trendPredictions));
                                         trendPredictions.up_percentage = Math.round((up_percentage / sum) * 100);
                                         trendPredictions.down_percentage = Math.round((down_percentage / sum) * 100);
                                         trendPredictions.sideways_percentage = 100 - trendPredictions.up_percentage - trendPredictions.down_percentage;
                                    }
                                } else {
                                    console.warn(`[Trading Analysis Proxy] Invalid trend prediction sum (${sum}) or structure. Invalidating. Original:`, JSON.stringify(parsedData.trend_prediction));
                                    trendPredictions = null;
                                }
                            } else {
                                console.warn("[Trading Analysis Proxy] Trend prediction percentages are not all numbers. Invalidating.", JSON.stringify(parsedData.trend_prediction));
                                trendPredictions = null;
                            }
                        } else {
                             trendPredictions = null;
                        }
                        // The detailed_analysis in JSON is a repeat, the main text is `analysisText`
                    } catch (e) {
                        console.error("[Trading Analysis Proxy] Failed to parse extracted JSON:", e, "Extracted JSON string:", jsonContentString, "Full raw text (first 500 chars):", rawText.substring(0, 500));
                        // analysisText is already set to text before JSON block, or full rawText if no JSON
                        trendPredictions = null;
                    }
                } else {
                    console.warn("[Trading Analysis Proxy] Found JSON start marker but no end marker. Treating entire response as text.");
                    analysisText = rawText;
                }
            } else {
                console.warn("[Trading Analysis Proxy] No JSON block (```json ... ```) found in Gemini response. Treating entire response as text.");
                analysisText = rawText;
            }
        }


        if (geminiResponse.candidates?.[0]?.groundingMetadata?.groundingChunks) {
            groundingSources = geminiResponse.candidates[0].groundingMetadata.groundingChunks
                .filter(gc => gc.web?.uri && !gc.web.uri.includes('vertexaisearch.cloud.google.com'))
                .map(gc => ({
                    uri: gc.web.uri,
                    title: gc.web.title || gc.web.uri
                }));
        }
        // If imageValidationError is set, it means the AI indicated the image was invalid.
        // The client will handle displaying this error. The analysisText should be the web-researched part.
        res.json({ 
            analysisText: analysisText || "No textual analysis provided.", 
            trendPredictions, 
            groundingSources,
            error: imageValidationError // Send "IMAGE_INVALID_TRADING_CHART" or null
        });

    } catch (error) {
        console.error("[Gemini Trading Analysis Proxy Error]", error);
        const errorMessage = String(error.statusInfo?.message || error.message || "Gemini trading analysis failed due to an internal server error.");
        const errorStatus = error.status || 500;
        res.status(errorStatus).json({ error: errorMessage, analysisText: null, trendPredictions: null, groundingSources: [] });
    }
});

// ===================================
// ADVANCED TOOLS ROUTES
// ===================================

// 1. IP Info Tool
app.post('/api/tools/ip-info', (req, res) => {
  const ip = getClientIp(req);
  const apiUrl = (ip && ip !== '::1' && ip !== '127.0.0.1') ? `http://ip-api.com/json/${ip}` : 'http://ip-api.com/json/';
  
  console.log(`[IP Info Tool] Fetching info for IP: ${ip || 'auto-detected'}`);
  
  fetch(apiUrl)
    .then(apiRes => apiRes.json())
    .then(data => {
      if (data.status === 'success') {
        console.log(`[IP Info Tool] Successfully fetched data for ${data.query}`);
        res.json({
          ip: data.query,
          country: data.country,
          countryCode: data.countryCode
        });
      } else {
        throw new Error(data.message || 'Failed to get IP details from external service.');
      }
    })
    .catch(error => {
      console.error("[IP Info Tool Error]", error);
      res.status(500).json({ error: error.message || 'Could not fetch IP information.' });
    });
});

// 2. Video Downloader Tool
app.post('/api/tools/download-video', async (req, res) => {
  const { url, format } = req.body;
  if (!url || !format) {
    return res.status(400).json({ error: 'Missing URL or format.' });
  }

  try {
    const isBilibili = url.includes('bilibili.com');

    if (isBilibili) {
      console.log(`[Video Downloader] Bilibili request for URL: ${url} (format: ${format})`);
      const validation = await play.validate(url);
      if (!validation || !validation.includes('bilibili')) {
        return res.status(400).json({ error: 'Invalid or unsupported Bilibili URL.' });
      }
      const videoInfo = await play.video_info(url);
      const title = videoInfo.video_details.title || 'bilibili_video';
      const safeTitle = title.replace(/[^a-z0-9_.-]/gi, '_').substring(0, 100);
      const extension = format === 'mp3' ? 'mp3' : 'mp4';
      const filename = `${safeTitle}.${extension}`;
      
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      const stream = await play.stream(url, { quality: format === 'mp3' ? 0 : 2 });
      res.setHeader('Content-Type', format === 'mp3' ? 'audio/mpeg' : 'video/mp4');
      stream.stream.pipe(res);

      stream.stream.on('error', (err) => {
        console.error('[Video Downloader - Bilibili] Stream error:', err.message);
        if (!res.headersSent) res.status(500).json({ error: `Bilibili stream error: ${err.message}` });
      });
      stream.stream.on('close', () => res.end());
      
    } else { // Handle YouTube with ytdl-core
      console.log(`[Video Downloader] YouTube request for URL: ${url} (format: ${format})`);
      if (!ytdl.validateURL(url)) {
        return res.status(400).json({ error: 'Invalid or unsupported YouTube URL.' });
      }
      
      const info = await ytdl.getInfo(url, { agent: ytdlAgent });
      const title = info.videoDetails.title || 'youtube_video';
      const safeTitle = title.replace(/[^a-z0-9_.-]/gi, '_').substring(0, 100);
      const extension = format === 'mp3' ? 'mp3' : 'mp4';
      const filename = `${safeTitle}.${extension}`;

      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

      let formatInfo;
      if (format === 'mp3') {
        res.setHeader('Content-Type', 'audio/mpeg');
        formatInfo = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
      } else {
        res.setHeader('Content-Type', 'video/mp4');
        formatInfo = ytdl.chooseFormat(info.formats, { quality: 'highest', filter: 'videoandaudio' });
      }

      if (!formatInfo) {
        throw new Error(`No suitable ${format} format found for this YouTube video.`);
      }

      const downloadStream = ytdl.downloadFromInfo(info, { format: formatInfo, agent: ytdlAgent });
      
      downloadStream.pipe(res);
      downloadStream.on('error', (err) => {
        console.error('[Video Downloader - YouTube] Stream error:', err.message);
        if (!res.headersSent) res.status(500).json({ error: `YouTube stream error: ${err.message}` });
      });
      downloadStream.on('end', () => res.end());
    }
  } catch (error) {
    console.error('[Video Downloader] Main catch block error:', error.message);
    if (!res.headersSent) {
      if (error.message.includes('private') || error.message.includes('unavailable') || error.message.includes('confirm your age')) {
        res.status(404).json({ error: 'This video is private, unavailable, or age-restricted.' });
      } else if (error.message.includes('Sign in')) {
          res.status(429).json({ error: 'YouTube requires sign-in (bot detection). Cookies might be required or expired.' });
      } else {
        res.status(500).json({ error: `Failed to process video request. Details: ${error.message.substring(0, 200)}...` });
      }
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

app.use((err, req, res, next) => {
    console.error("[Unhandled Error Middleware]", err.stack);
    if (!res.headersSent) {
        res.status(500).json({ error: 'Something broke on the proxy!' });
    }
});
