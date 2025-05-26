
// File: config.js

// API keys and LOGIN_CODE_AUTH are now managed by the backend proxy server (proxy-server/.env).
// This file is no longer used for sensitive configuration for the client.
// It can be used for other non-sensitive client-side configurations if needed.

window.process = {
  env: {
    // API_KEY: '', // REMOVED - Handled by proxy
    // VITE_OPENAI_API_KEY: '', // REMOVED - Handled by proxy
    // VITE_DEEPSEEK_API_KEY: '', // REMOVED - Handled by proxy
    // VITE_CLAUDE_API_KEY: '', // REMOVED - Handled by proxy (if it were live)
    // LOGIN_CODE_AUTH: '' // REMOVED - Handled by proxy
  }
};

console.log('[config.js] Loaded. API keys and LOGIN_CODE_AUTH are now managed by the backend proxy.');
// console.log('[config.js] LOGIN_CODE_AUTH for simple login is set in env:', window.process?.env?.LOGIN_CODE_AUTH ? '********' : 'NOT SET'); // REMOVED

// if (!window.process?.env?.LOGIN_CODE_AUTH || window.process.env.LOGIN_CODE_AUTH.includes('YOUR_')) { // REMOVED
//     console.warn('[config.js] WARNING: LOGIN_CODE_AUTH is not set or is a placeholder. Simple login feature will require this to be set in config.js if used.'); // REMOVED
// }
