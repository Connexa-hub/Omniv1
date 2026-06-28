import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import fs from "fs/promises";
import { seedAgents } from "./src/server/seed";
import { Orchestrator } from "./src/server/orchestrator";
import { OmniBrain } from "./src/server/brain";

async function getProjectDir(projectId?: string): Promise<string> {
  const root = process.cwd();
  if (!projectId || projectId === 'null') {
    return root;
  }
  
  // Sanitize projectId to prevent traversal
  const sanitizedId = path.basename(projectId);
  const dir = path.join(root, '.projects', sanitizedId);
  
  // Ensure the directory is actually within .projects
  const projectsDir = path.join(root, '.projects');
  await fs.mkdir(projectsDir, { recursive: true });
  
  const absoluteDir = path.resolve(dir);
  if (!absoluteDir.startsWith(path.resolve(projectsDir))) {
    throw new Error("Invalid project access");
  }

  await fs.mkdir(absoluteDir, { recursive: true });
  return absoluteDir;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Simple Request Logger
  app.use((req, res, next) => {
    if (req.url.startsWith("/api")) {
      console.log(`[Server] ${req.method} ${req.url}`);
    }
    next();
  });

  // AI Configuration & Orchestration
  const apiKey = process.env.GEMINI_API_KEY || "dummy-key";
  const brain = new OmniBrain(apiKey);
  const orchestrator = new Orchestrator(brain);

  // Seed Agents
  seedAgents().catch(err => console.error('[Server] Failed to seed agents:', err));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", version: "1.0.0-omni", engine: "OmniBrain v1" });
  });

  app.get("/api/agents", async (req, res) => {
    try {
      const { db } = await import("./src/server/firebaseAdmin");
      const snapshot = await db.collection('agents').get();
      const agents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(agents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agents" });
    }
  });

  app.get("/api/system/status", async (req, res) => {
    try {
      const status = await orchestrator.getSystemStatus();
      res.json(status);
    } catch (error: any) {
      console.error("[Server] Error in /api/system/status:", error);
      res.status(500).json({
        error: true,
        message: error.message || "Failed to fetch system status",
        brain: {
          status: "degraded",
          agents: ["omni-core"],
          trainingQueue: 0
        },
        orchestrator: {
          activeStreams: 0,
          uptime: process.uptime()
        }
      });
    }
  });

  // Workspace API
  app.get("/api/files", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      const baseDir = await getProjectDir(projectId);
      
      const getFiles = async (dir: string): Promise<any[]> => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(entries.map(async (entry) => {
          const resPath = path.resolve(dir, entry.name);
          const relativePath = path.relative(baseDir, resPath);
          
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '.projects') return null;

          if (entry.isDirectory()) {
            return {
              name: entry.name,
              type: 'directory',
              path: '/' + relativePath,
              children: await getFiles(resPath)
            };
          }
          return {
            name: entry.name,
            type: 'file',
            path: '/' + relativePath
          };
        }));
        return files.filter(Boolean);
      };

      const fileTree = await getFiles(baseDir);
      res.json(fileTree);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/files/content", async (req, res) => {
    try {
      const filePath = req.query.path as string;
      const projectId = req.query.projectId as string;
      if (!filePath) return res.status(400).json({ error: "Missing path" });
      const baseDir = await getProjectDir(projectId);
      const fullPath = path.join(baseDir, filePath.startsWith('/') ? filePath.slice(1) : filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      res.json({ content });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/files/write", async (req, res) => {
    try {
      const { path: filePath, content, projectId } = req.body;
      const baseDir = await getProjectDir(projectId);
      const fullPath = path.join(baseDir, filePath.startsWith('/') ? filePath.slice(1) : filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
      
      // Notify orchestrator so AI is aware of physical edits
      orchestrator.notifyFileChange(filePath, content);
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Secrets management - stored per-user in Firestore  
  app.get("/api/secrets", async (req, res) => {
    try {
      const { db } = await import("./src/server/firebaseAdmin");
      const userId = req.query.userId as string;
      if (!userId) return res.json({ secrets: [] });
      
      const doc = await db.collection('users').doc(userId).get();
      const data = doc.data();
      const secrets = data?.secrets || [];
      // Return user's secrets (keys only, not values for security)  
      res.json({ secrets: secrets.map((s: any) => ({ key: s.key, scope: s.scope })) });
    } catch (error) {
      res.json({ secrets: [] });
    }
  });

  app.post("/api/secrets/save", async (req, res) => {
    try {
      const { userId, secrets } = req.body; // Array of {key, value, scope}  
      if (!userId) return res.status(400).json({ error: "User ID required" });
      
      const { db } = await import("./src/server/firebaseAdmin");
      await db.collection('users').doc(userId).set({ secrets }, { merge: true });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // User API keys management  
  app.post("/api/user-keys/save", async (req, res) => {
    try {
      const { userId, platform, apiKey, enabled } = req.body;
      if (!userId) return res.status(400).json({ error: "User ID required" });
      
      const { db } = await import("./src/server/firebaseAdmin");
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      const userData = userDoc.data() || {};
      const userKeys = userData.userKeys || {};
      
      userKeys[platform] = { apiKey, enabled };
      await userRef.set({ userKeys }, { merge: true });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/user-keys", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) return res.json({ keys: [] });
      
      const { db } = await import("./src/server/firebaseAdmin");
      const doc = await db.collection('users').doc(userId).get();
      const data = doc.data();
      const userKeys = data?.userKeys || {};
      
      // Return user's configured API keys (masked)  
      const maskedKeys = Object.entries(userKeys).map(([platform, data]: [string, any]) => ({
        platform,
        enabled: data.enabled,
        apiKey: data.apiKey ? `${data.apiKey.substring(0, 4)}...${data.apiKey.substring(data.apiKey.length - 4)}` : ''
      }));
      res.json({ keys: maskedKeys });
    } catch (error) {
      res.json({ keys: [] });
    }
  });

  // Port/environment configuration  
  app.get("/api/config/ports", async (req, res) => {
    res.json({
      frontend: 3000,
      backend: 3001,
      preview: 3002
    });
  });

  app.post("/api/terminal/run", async (req, res) => {
    try {
      const { command, projectId } = req.body;
      if (!command) return res.status(400).json({ error: "Missing command" });

      const baseDir = await getProjectDir(projectId);
      const { exec } = require("child_process");
      exec(command, { timeout: 20000, cwd: baseDir }, (error: any, stdout: any, stderr: any) => {
        const output = (stdout || "") + (stderr || "");
        
        // Notify the orchestrator brain of the command run & output!
        orchestrator.notifyFileChange(`TerminalCommandRun_${Date.now()}`, `Ran command: "${command}"\nOutput: ${output.substring(0, 500)}`);
        
        res.json({
          success: !error,
          output: output || (error ? `Error: ${error.message}` : "(No output)")
        });
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, agentId, modelId, mode, history, userEmail, userDisplayName, localTime, timezone, projectId } = req.body;
      const data = await orchestrator.route({ 
        message, 
        agentId, 
        modelId, 
        mode, 
        history,
        userEmail,
        userDisplayName,
        localTime,
        timezone,
        projectId
      });
      res.json(data);
    } catch (error: any) {
      console.error("Orchestration Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/chat-stream", async (req, res) => {
    try {
      const { message, agentId, modelId, mode, history, userEmail, userDisplayName, localTime, timezone, projectId } = req.body;
      
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      await orchestrator.routeStream({ 
        message, 
        agentId, 
        modelId, 
        mode, 
        history,
        userEmail,
        userDisplayName,
        localTime,
        timezone,
        projectId
      }, (chunk) => {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      });
      
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      console.error("Orchestration Stream Error:", error);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  });

  app.post("/api/learn-feedback", async (req, res) => {
    try {
      const { msgId, type, content } = req.body;
      orchestrator.learnFromFeedback(msgId, type, content);
      res.json({ success: true, message: "Omni successfully learned from user feedback reinforcement loop." });
    } catch (error: any) {
      console.error("Feedback Learning Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite Integration
  const distPath = path.join(process.cwd(), "dist");
  let useViteDev = process.env.NODE_ENV !== "production";
  
  try {
    await fs.access(path.join(distPath, "index.html"));
  } catch {
    console.log("[Server] dist/index.html not found. Falling back to Vite Dev Server middleware.");
    useViteDev = true;
  }

  if (useViteDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Project Omni running at http://localhost:${PORT}`);
  });
}

startServer();
