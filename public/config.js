window.process = {
  env: {
    // Configuration for Gemini models (using Google AI Studio API Key)
    API_KEY: '', // Replace with your Google AI Studio API Key            
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