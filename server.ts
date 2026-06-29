import "dotenv/config";
import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import fs from "fs/promises";
import { seedAgents } from "./src/server/seed";
import { Orchestrator } from "./src/server/orchestrator";
import { OmniBrain } from "./src/server/brain";

interface RuntimeConfig {
  name: string;
  checkCmd: string;           // Command to check if runtime is installed
  runCmd: (file: string) => string;  // How to run a file
  installCmd: string;          // Package manager install command
  fileExtension: string[];
  startServerCmd?: (port: number) => string; // Start a dev server
  buildCmd?: string;
  icon: string;
}

const RUNTIME_REGISTRY: Record<string, RuntimeConfig> = {
  python: {
    name: 'Python',
    checkCmd: 'python3 --version',
    runCmd: (file) => `python3 ${file}`,
    installCmd: 'pip install',
    fileExtension: ['.py'],
    startServerCmd: (port) => `python3 -m uvicorn main:app --host 0.0.0.0 --port ${port} --reload`,
    icon: '🐍',
  },
  node: {
    name: 'Node.js',
    checkCmd: 'node --version',
    runCmd: (file) => `node ${file}`,
    installCmd: 'npm install',
    fileExtension: ['.js', '.mjs', '.cjs'],
    startServerCmd: (port) => `PORT=${port} node server.js`,
    icon: '🟢',
  },
  typescript: {
    name: 'TypeScript',
    checkCmd: 'tsx --version',
    runCmd: (file) => `tsx ${file}`,
    installCmd: 'npm install',
    fileExtension: ['.ts', '.tsx'],
    startServerCmd: (port) => `PORT=${port} tsx server.ts`,
    icon: '🔷',
  },
  go: {
    name: 'Go',
    checkCmd: 'go version',
    runCmd: (file) => `go run ${file}`,
    installCmd: 'go get',
    fileExtension: ['.go'],
    startServerCmd: (port) => `PORT=${port} go run main.go`,
    buildCmd: 'go build -o ./bin/app .',
    icon: '🔵',
  },
  rust: {
    name: 'Rust',
    checkCmd: 'rustc --version',
    runCmd: (file) => `rustc ${file} -o /tmp/rustout && /tmp/rustout`,
    installCmd: 'cargo add',
    fileExtension: ['.rs'],
    startServerCmd: (port) => `PORT=${port} cargo run`,
    buildCmd: 'cargo build --release',
    icon: '🦀',
  },
  java: {
    name: 'Java',
    checkCmd: 'java --version',
    runCmd: (file) => `javac ${file} && java ${file.replace('.java', '')}`,
    installCmd: 'mvn install',
    fileExtension: ['.java'],
    icon: '☕',
  },
  php: {
    name: 'PHP',
    checkCmd: 'php --version',
    runCmd: (file) => `php ${file}`,
    installCmd: 'composer require',
    fileExtension: ['.php'],
    startServerCmd: (port) => `php -S 0.0.0.0:${port}`,
    icon: '🐘',
  },
  ruby: {
    name: 'Ruby',
    checkCmd: 'ruby --version',
    runCmd: (file) => `ruby ${file}`,
    installCmd: 'gem install',
    fileExtension: ['.rb'],
    startServerCmd: (port) => `PORT=${port} ruby server.rb`,
    icon: '💎',
  },
  cpp: {
    name: 'C++',
    checkCmd: 'g++ --version',
    runCmd: (file) => `g++ -o /tmp/cppout ${file} && /tmp/cppout`,
    installCmd: '',
    fileExtension: ['.cpp', '.cc', '.cxx'],
    buildCmd: 'g++ -O2 -o ./bin/app main.cpp',
    icon: '⚙️',
  },
  c: {
    name: 'C',
    checkCmd: 'gcc --version',
    runCmd: (file) => `gcc -o /tmp/cout ${file} && /tmp/cout`,
    installCmd: '',
    fileExtension: ['.c'],
    icon: '🔧',
  },
  dart: {
    name: 'Dart',
    checkCmd: 'dart --version',
    runCmd: (file) => `dart run ${file}`,
    installCmd: 'dart pub add',
    fileExtension: ['.dart'],
    startServerCmd: (port) => `dart run bin/server.dart`,
    icon: '🎯',
  },
  flutter: {
    name: 'Flutter',
    checkCmd: 'flutter --version',
    runCmd: (file) => `flutter run`,
    installCmd: 'flutter pub add',
    fileExtension: ['.dart'],
    startServerCmd: (port) => `flutter run -d web-server --web-port ${port}`,
    buildCmd: 'flutter build web',
    icon: '💙',
  },
};

// Detect project language from files in the workspace
async function detectProjectLanguage(projectDir: string): Promise<string> {
  const fsSync = require('fs');
  const path = require('path');
  
  try {
    const files = fsSync.readdirSync(projectDir);
    
    // Check config files first (most specific)
    if (files.includes('pubspec.yaml')) return 'flutter';
    if (files.includes('Cargo.toml')) return 'rust';
    if (files.includes('go.mod')) return 'go';
    if (files.includes('pom.xml') || files.includes('build.gradle')) return 'java';
    if (files.includes('composer.json')) return 'php';
    if (files.includes('Gemfile')) return 'ruby';
    if (files.includes('requirements.txt') || files.includes('pyproject.toml')) return 'python';
    if (files.includes('package.json')) {
      const pkg = JSON.parse(fsSync.readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['typescript'] || deps['tsx']) return 'typescript';
      return 'node';
    }
    
    // Fall back to file extension counting
    const extCount: Record<string, number> = {};
    for (const file of files) {
      const ext = path.extname(file);
      if (ext) extCount[ext] = (extCount[ext] || 0) + 1;
    }
    
    for (const [runtime, config] of Object.entries(RUNTIME_REGISTRY)) {
      if (config.fileExtension.some((ext: string) => extCount[ext] > 0)) {
        return runtime;
      }
    }
  } catch (e) {}
  
  return 'node'; // default
}

// Check which runtimes are available on the system
async function getAvailableRuntimes(): Promise<Record<string, boolean>> {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  const available: Record<string, boolean> = {};
  for (const [runtime, config] of Object.entries(RUNTIME_REGISTRY)) {
    try {
      await execAsync(config.checkCmd, { timeout: 3000 });
      available[runtime] = true;
    } catch {
      available[runtime] = false;
    }
  }
  return available;
}

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
    console.log("[Server] Fetching files list...");
    try {
      const projectId = req.query.projectId as string;
      const baseDir = await getProjectDir(projectId);
      console.log(`[Server] Base directory: ${baseDir}`);
      
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
      console.log(`[Server] Found ${fileTree.length} top-level items`);
      res.json(fileTree);
    } catch (error: any) {
      console.error("[Server] Error fetching files:", error);
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

  // ==========================================
  // MULTI-PROVIDER AI MESH ENDPOINTS
  // ==========================================
  app.get("/api/provider/status", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      const { ProviderRegistry } = await import("./src/server/providers/ProviderRegistry");
      const statuses = await ProviderRegistry.getProviderStatuses(userId);
      res.json({ success: true, providers: statuses });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/provider/settings/save", async (req, res) => {
    try {
      const { userId, providerId, enabled, apiKey, apiKeys, priority, cloudflareAccountId, huggingFaceModelId } = req.body;
      if (!userId) return res.status(400).json({ error: "User ID required" });
      const { ProviderHealthManager } = await import("./src/server/providers/ProviderHealthManager");
      const { ProviderRegistry } = await import("./src/server/providers/ProviderRegistry");
      const provider = ProviderRegistry.getProvider(providerId);
      if (!provider) return res.status(404).json({ error: "Provider not found" });

      const settingsUpdate: any = {
        enabled,
        priority: Number(priority || 5),
        isUserKey: !!(apiKey || (apiKeys && apiKeys.length > 0))
      };
      if (apiKey !== undefined) {
        settingsUpdate.apiKey = apiKey;
      }
      if (apiKeys !== undefined) {
        settingsUpdate.apiKeys = apiKeys;
      }
      if (cloudflareAccountId !== undefined) {
        settingsUpdate.cloudflareAccountId = cloudflareAccountId;
      }
      if (huggingFaceModelId !== undefined) {
        settingsUpdate.huggingFaceModelId = huggingFaceModelId;
      }
      
      await ProviderHealthManager.saveProviderSettings(providerId, settingsUpdate, userId);
      provider.updateSettings(settingsUpdate);

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/provider/test-key", async (req, res) => {
    try {
      const { providerId, apiKey, accountId } = req.body;
      if (!providerId || !apiKey) return res.status(400).json({ error: "Provider ID and API key are required" });
      const { ProviderRegistry } = await import("./src/server/providers/ProviderRegistry");
      const provider = ProviderRegistry.getProvider(providerId);
      if (!provider) return res.status(404).json({ error: "Provider not found" });

      console.log(`[Server] Testing API Key for provider: ${providerId}`);
      const testResult = await provider.testKey(apiKey, accountId);
      res.json(testResult);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/provider/config/save", async (req, res) => {
    try {
      const { userId, preferredProviderId, priorityMode, autoFailover, autoHealthCheck } = req.body;
      if (!userId) return res.status(400).json({ error: "User ID required" });
      const { ProviderRouter } = await import("./src/server/providers/ProviderRouter");
      await ProviderRouter.saveRoutingConfig(userId, {
        preferredProviderId,
        priorityMode,
        autoFailover,
        autoHealthCheck
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/provider/config", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      const { ProviderRouter } = await import("./src/server/providers/ProviderRouter");
      const config = await ProviderRouter.getRoutingConfig(userId);
      res.json({ success: true, config });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Runtimes and Language Detection APIs
  app.get("/api/runtimes", async (req, res) => {
    const available = await getAvailableRuntimes();
    const runtimes = Object.entries(RUNTIME_REGISTRY).map(([id, config]) => ({
      id,
      name: config.name,
      icon: config.icon,
      available: available[id] || false,
      extensions: config.fileExtension,
      hasPackageManager: !!config.installCmd,
      hasDevServer: !!config.startServerCmd,
    }));
    res.json({ runtimes });
  });

  app.post("/api/run-file", async (req, res) => {
    try {
      const { filePath, projectId } = req.body;
      const baseDir = await getProjectDir(projectId);
      const pathModule = require('path');
      const ext = pathModule.extname(filePath);
      
      // Find runtime for this file extension
      let runtime = 'node';
      for (const [r, config] of Object.entries(RUNTIME_REGISTRY)) {
        if (config.fileExtension.includes(ext)) { runtime = r; break; }
      }
      
      const config = RUNTIME_REGISTRY[runtime];
      const fullPath = pathModule.join(baseDir, filePath.startsWith('/') ? filePath.slice(1) : filePath);
      const command = config.runCmd(fullPath);
      
      const { exec } = require('child_process');
      exec(command, { timeout: 30000, cwd: baseDir }, (error: any, stdout: any, stderr: any) => {
        res.json({
          output: (stdout || '') + (stderr || ''),
          error: error ? error.message : null,
          runtime,
          runtimeName: config.name,
          command,
        });
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/install-package", async (req, res) => {
    try {
      const { packageName, projectId } = req.body;
      const baseDir = await getProjectDir(projectId);
      const lang = await detectProjectLanguage(baseDir);
      const config = RUNTIME_REGISTRY[lang];
      
      if (!config?.installCmd) {
        return res.json({ error: `No package manager for ${lang}` });
      }
      
      const command = `${config.installCmd} ${packageName}`;
      const { exec } = require('child_process');
      exec(command, { timeout: 120000, cwd: baseDir }, (error: any, stdout: any, stderr: any) => {
        res.json({
          output: (stdout || '') + (stderr || ''),
          success: !error,
          command,
        });
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/deploy/vercel", async (req, res) => {
    const { token, projectId } = req.body;
    try {
      const baseDir = await getProjectDir(projectId);
      const files: any[] = [];
      const fsSync = require('fs');
      const pathModule = require('path');
      
      // Read all files
      function readFiles(dir: string, base: string) {
        const items = fsSync.readdirSync(dir);
        for (const item of items) {
          const fullPath = pathModule.join(dir, item);
          const relPath = pathModule.relative(base, fullPath);
          if (fsSync.statSync(fullPath).isDirectory()) {
            if (!['node_modules', '.git', 'dist', '.next'].includes(item)) readFiles(fullPath, base);
          } else {
            try {
              const content = fsSync.readFileSync(fullPath, 'utf8');
              files.push({ file: relPath, data: content });
            } catch {}
          }
        }
      }
      readFiles(baseDir, baseDir);
      
      const axios = require('axios');
      const response = await axios.post('https://api.vercel.com/v13/deployments', {
        name: `omniv1-project-${(projectId || 'local').slice(0, 8).toLowerCase()}`,
        files: files.slice(0, 100),
        projectSettings: { framework: null },
      }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      
      const url = `https://${response.data.url}`;
      res.json({ success: true, url, id: response.data.id });
    } catch (err: any) {
      res.status(500).json({ error: err.response?.data?.error?.message || err.message });
    }
  });

  app.get("/api/detect-language", async (req, res) => {
    try {
      const { projectId } = req.query;
      const baseDir = await getProjectDir(projectId as string);
      const lang = await detectProjectLanguage(baseDir);
      res.json({ language: lang, config: RUNTIME_REGISTRY[lang] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
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
      const { message, agentId, modelId, mode, history, userEmail, userDisplayName, localTime, timezone, projectId, userId } = req.body;
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
        projectId,
        userId
      });
      res.json(data);
    } catch (error: any) {
      console.error("Orchestration Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/chat-stream", async (req, res) => {
    try {
      const { message, agentId, modelId, mode, history, userEmail, userDisplayName, localTime, timezone, projectId, userId } = req.body;
      
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
        projectId,
        userId
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

  // Start AI Mesh periodic background health checks
  import("./src/server/providers/ProviderHealthManager")
    .then(({ ProviderHealthManager }) => {
      ProviderHealthManager.startBackgroundHealthCheck(undefined);
    })
    .catch(err => console.error("[Server] Failed to start background health checks:", err));

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Project Omni running at http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("CRITICAL: Server failed to start:", err);
  process.exit(1);
});
