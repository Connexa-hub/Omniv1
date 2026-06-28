# OMNI: The AI Coding OS - User Guide

Welcome to **OMNI**, your enterprise-grade AI architect and coding platform. This guide is designed to help anyone—from absolute beginners to expert developers—get the most out of OMNI.

## 🚀 Getting Started

1.  **Login**: Use your Google account to sign in.
2.  **Create Workspace**: Click the "Create Workspace" button or the "OMNI" logo.
    *   **Name**: Give your project a name.
    *   **Vision**: Describe what you want to build. Be as specific as possible!
    *   **Stack**: Optional. You can specify "React", "Python", etc., or let OMNI decide.
3.  **Chat & Build**: Use the chat interface to talk to OMNI.
    *   **Agent Mode**: Best for building full-stack apps and complex features.
    *   **Fast Mode**: Best for quick questions or simple UI tweaks.
    *   **Thinking Mode**: Best for deep research, logic analysis, and debugging.

---

## 🛠 Advanced Configuration

### 1. Using Another Database (Firestore / MongoDB)

OMNI is built to be flexible. By default, it uses Firebase (Firestore) for lightning-fast real-time data.

**To switch to another Firestore account:**
- Update the configuration in `/src/lib/firebase.ts` with your new project's credentials.
- Ensure you have the corresponding `serviceAccountKey.json` for the backend in the root directory.

**To switch to MongoDB:**
1.  Install the `mongodb` driver: `npm install mongodb`.
2.  Create a new file `/src/lib/mongodb.ts` to handle the connection.
3.  Update the server routes in `server.ts` to use your MongoDB client instead of `firebaseAdmin.ts`.

### 2. The LLM "Big Brain" Source Engine

The "Brain" of OMNI is located in `/src/server/brain.ts` and managed by `/src/server/orchestrator.ts`.

**How it works:**
- **Orchestrator**: Acts as the traffic controller, deciding which agent (Core, Study, etc.) should handle your request.
- **Brain**: The core logic that communicates with AI models (like Gemini, OpenAI, or local models).

**Using Local Models (Self-Hosting):**
If you want to stop using online API keys and use your own server:
1.  **Set up an Inference Server**: Use tools like **Ollama**, **vLLM**, or **LocalAI** on your server.
2.  **Update the Base URL**: In `src/server/brain.ts`, change the API endpoint from Google's servers to your own local endpoint (e.g., `http://your-server-ip:11434/v1`).
3.  **Deployment**: Deploy your OMNI instance to a cloud provider (Google Cloud, AWS, or a private VPS) and point it to your inference server.

---

## 🔒 Security & Performance Audit

OMNI has been audited for:
- **Path Traversal Protection**: Ensures users can only access files within their project workspace.
- **API Key Masking**: Your sensitive keys are never fully exposed in the browser.
- **Sandboxed Execution**: Terminal commands are restricted to the project directory.

---

## 📈 Auto-Deployment

OMNI supports "Deploy" functionality (see the Rocket icon in the header).
- **Frontend**: Can be deployed to Vercel, Netlify, or Firebase Hosting.
- **Backend**: Can be deployed to Cloud Run, Heroku, or any Docker-compatible environment.

To configure auto-deployment, add your deployment scripts to `package.json` and trigger them via the OMNI terminal.

---

*Crafted with precision by the OMNI Neural Architect.*
