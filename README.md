![Untitled](https://github.com/user-attachments/assets/0be0d945-e609-4237-aa84-ce0a05791a06)


# femi - Multimodel AI Chat

**femi** is a web app to chat with AI models like Gemini, OpenAI GPT, and Deepseek, featuring image uploads, image generation, TTS, and secure API key handling via a backend proxy.

## ✨ Core Features

*   Chat with Gemini, GPT-4.1, Deepseek, Imagen3 (Generate super-real images), OpenAI TTS.
*   Image & text file uploads for chat.
*   Web search grounding (Gemini).
*   Chat history, personas, and theme customization.
*   Secure API key management using a backend proxy.
*   Language learning (English, Japanese, Korean, Chinese, Vietnamese)
*   Mini entertainment games
*   Voice translation in real-time
*   Change Theme, Avatar
*   Optimize UX/UI design for a good experience on Windows / Mobile
*   AI agent with Voice chat by Elevenlabs
*   AI agent sets a plan for an individual plan, work on request, advice ... etc
*   Payment & Credit system
*   Flux Kontext Pro/Max Multi Editing Images **( NEW HOT )**
*   Flux 1.1 Ultra - Very Ultra 2K Images Generate **( NEW HOT )**
*   Kling AI 2.1 - High-quality video generation **( NEW HOT )**

## 🛠️ Tech Stack

*   **Frontend:** React, Vite, TypeScript, Tailwind CSS
*   **Backend Proxy:** Node.js, Express.js

## Prerequisites

*   Node.js (v18.x or later)
*   npm or yarn
*   API Keys:
    *   Google AI Studio (for Gemini/Imagen)
    *   OpenAI (for GPT/TTS)
    *   Deepseek

## 🚀 Getting Started (Local Development)

**1. Clone Repository:**

```bash
git clone https://github.com/HeriSoft/femi.git
cd femi
```

**2. Setup Backend Proxy:**

1. Go to proxy-server directory: cd proxy-server
2. Copy .env.example to .env: cp .env.example .env
3. Edit proxy-server/.env with your API keys and a LOGIN_CODE_AUTH.
4. Install dependencies: npm install
5. Start proxy (in its own terminal): npm run dev (usually on http://localhost:3001)

**3. Setup Frontend:**

1. Go back to the project root: cd femi
2. Install dependencies: npm install
3. Start frontend (in a new terminal): npm run dev (usually on http://localhost:5173)
   
   (Ensure vite.config.js in root has /api proxy to http://localhost:3001)

**4. Access:**

Open http://localhost:5173 in your browser. Log in with your LOGIN_CODE_AUTH.

**🔑 Environment Variables (for proxy-server/.env)**

The proxy server needs these:
```bash
GEMINI_API_KEY: Your Google AI Studio key.
OPENAI_API_KEY: Your OpenAI key.
DEEPSEEK_API_KEY: Your Deepseek key.
LOGIN_CODE_AUTH: Your chosen login code (e.g., ADMIN123).
CORS_ALLOWED_ORIGINS: For local dev, http://localhost:5173. For deployment, your Vercel frontend URL.
```

**🌐 Deployment (Vercel Example)**

Push your code (including vercel.json) to GitHub.

Import project into Vercel.

In Vercel project settings, add the Environment Variables listed above.

CORS_ALLOWED_ORIGINS must be your Vercel frontend URL(s).

Vercel will build and deploy using vercel.json (frontend as static, backend proxy as serverless function). Redeploy if you change Environment Variables.
______________________________________________
**🛡️ API Key Security**

API keys are only used by the backend proxy and are read from its environment variables. They are never exposed to the frontend. Ensure proxy-server/.env is in your .gitignore.

Remember to replace your-username/femi-multimodel-ai-chat with your actual GitHub repository path.
