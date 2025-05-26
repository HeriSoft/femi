![Untitled](https://github.com/user-attachments/assets/460db9ab-3804-4e7c-bddc-42fadeb96462)

# femi - Multimodel AI Chat

**femi** is a web app to chat with AI models like Gemini, OpenAI GPT, and Deepseek, featuring image uploads, image generation, TTS, and secure API key handling via a backend proxy.

## ✨ Core Features

*   Chat with Gemini, GPT-4o, Deepseek, Imagen3 (images), OpenAI TTS.
*   Image & text file uploads for chat.
*   Web search grounding (Gemini).
*   Chat history, personas, and theme customization.
*   Secure API key management using a backend proxy.

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
git clone https://github.com/your-username/femi-multimodel-ai-chat.git
cd femi-multimodel-ai-chat
```

**2. Setup Backend Proxy:**

Go to proxy-server directory: cd proxy-server
Copy .env.example to .env: cp .env.example .env
Edit proxy-server/.env with your API keys and a LOGIN_CODE_AUTH.
Install dependencies: npm install
Start proxy (in its own terminal): npm run dev (usually on http://localhost:3001)

**3. Setup Frontend:**

Go back to the project root: cd ..
Install dependencies: npm install
Start frontend (in a new terminal): npm run dev (usually on http://localhost:5173)
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
