// File: config.js

// For Vite projects, API keys and other environment variables should be managed
// using .env files (e.g., .env.local) and accessed via `import.meta.env`.
// Variables in .env files must be prefixed with `VITE_` to be exposed to the client.
//
// Example .env.local content:
// VITE_API_KEY=YOUR_GEMINI_API_KEY_FROM_AI_STUDIO_HERE
// VITE_OPENAI_API_KEY=YOUR_OPENAI_KEY_HERE
//
// Make sure to add your .env.local file to .gitignore.
//
// The `window.process` object below is a fallback or for non-Vite environments.
// Gemini models will now use the API_KEY for Google AI Studio (Generative Language API).

window.process = {
  env: {
    // Configuration for Gemini models (using Google AI Studio API Key)
    API_KEY: '', // Replace with your Google AI Studio API Key

    // VERTEX_PROJECT_ID and VERTEX_LOCATION are no longer used by geminiService.ts
    // They are commented out to avoid confusion.
    // VERTEX_PROJECT_ID: '', 
    // VERTEX_LOCATION: 'us-central1',                 

    // Keys for other services
    VITE_OPENAI_API_KEY: '', 
    VITE_DEEPSEEK_API_KEY: '',
    VITE_CLAUDE_API_KEY: '' // Mock model, key not strictly needed unless implementing live
  }
};

console.log('[config.js] Loaded. Full window.process structure:', JSON.stringify(window.process, null, 2));
console.log('[config.js] API_KEY for Gemini (Google AI Studio) is set in env:', window.process?.env?.API_KEY ? '********' : 'NOT SET');


if (window.process?.env?.API_KEY && (window.process.env.API_KEY.includes('YOUR_') || window.process.env.API_KEY.length < 30 )) {
    console.warn('[config.js] WARNING: API_KEY for Gemini (Google AI Studio) seems to be a placeholder or very short. Please replace it with your actual API Key from Google AI Studio.');
}
