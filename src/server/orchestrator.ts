import { OmniBrain } from "./brain";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Orchestrator - The Agent Coordinator
 * Manages communication between the frontend, agents, and the OmniBrain.
 */
export class Orchestrator {
  private brain: OmniBrain;

  constructor(brain: OmniBrain) {
    this.brain = brain;
  }

  async route(payload: { 
    message: string; 
    agentId?: string; 
    modelId?: string; 
    mode?: string; 
    history?: any[];
    userEmail?: string;
    userDisplayName?: string;
    localTime?: string;
    timezone?: string;
    projectId?: string;
    userId?: string;
  }) {
    const { 
      message, 
      agentId = 'omni-core', 
      modelId = 'omni-google', 
      mode = 'thinking', 
      history = [],
      userEmail,
      userDisplayName,
      localTime,
      timezone,
      projectId,
      userId
    } = payload;
    
    // Pass modelId and user context to brain
    const responseJson = await this.brain.process(
      message, 
      agentId, 
      mode, 
      history, 
      modelId,
      userEmail,
      userDisplayName,
      localTime,
      timezone
    );

    try {
      const data = JSON.parse(responseJson);
      
      // AI Response Parsing for File Changes within the content string
      await this.applyFileChanges(data.content || "", projectId);

      return data;
    } catch (e) {
      console.warn("[Orchestrator] Response was not valid JSON, returning as fallback");
      
      // Clean up fallback content so the user never gets raw JSON dumps with escaped strings
      const cleanedContent = this.cleanFallbackContent(responseJson);
      await this.applyFileChanges(cleanedContent, projectId);
      
      return {
        content: cleanedContent,
        thought: "Restructuring...",
        steps: [{ id: "1", type: "thinking", label: "System Recovery", status: "completed" }],
        suggestions: ["Could you clarify that explanation?", "Show me a visual diagram of this concept", "Can we write code to simulate this?"]
      };
    }
  }

  async routeStream(
    payload: { 
      message: string; 
      agentId?: string; 
      modelId?: string; 
      mode?: string; 
      history?: any[];
      userEmail?: string;
      userDisplayName?: string;
      localTime?: string;
      timezone?: string;
      projectId?: string;
      userId?: string;
    }, 
    onChunk: (chunk: any) => void
  ) {
    const { 
      message, 
      agentId = 'omni-core', 
      modelId = 'omni-google', 
      mode = 'thinking', 
      history = [],
      userEmail,
      userDisplayName,
      localTime,
      timezone,
      projectId,
      userId
    } = payload;
    
    let fullResponse = "";
    await this.brain.processStream(
      message, 
      agentId, 
      mode, 
      history, 
      (chunkText) => {
        fullResponse += chunkText;
        onChunk({ raw: chunkText, full: fullResponse });
      }, 
      modelId,
      userEmail,
      userDisplayName,
      localTime,
      timezone,
      projectId,
      userId
    );
    
    // Once stream finishes, apply files & run commands in the background
    await this.applyFileChanges(fullResponse, projectId);
  }

  learnFromFeedback(msgId: string, type: 'up' | 'down', content: string) {
    this.brain.learnFromFeedback(msgId, type, content);
  }

  private cleanFallbackContent(raw: string): string {
    // Try to extract content string if possible
    const contentMatch = raw.match(/"content"\s*:\s*"([\s\S]*?)"\s*(?:,\s*"files"|,\s*"thought"|,\s*"steps"|\s*\})/);
    if (contentMatch) {
      try {
        // Unescape the JSON string
        return JSON.parse(`"${contentMatch[1]}"`);
      } catch {
        return contentMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      }
    }

    // If that fails, let's strip out the outer json braces and return a clean representation
    let cleaned = raw;
    if (cleaned.startsWith('{')) {
      cleaned = cleaned.replace(/^\{\s*/, '').replace(/\s*\}$/, '');
      // Try to remove "thought" and "steps" keys
      cleaned = cleaned.replace(/"thought"\s*:\s*"[\s\S]*?",\s*/g, '');
      cleaned = cleaned.replace(/"steps"\s*:\s*\[[\s\S]*?\],\s*/g, '');
      cleaned = cleaned.replace(/"content"\s*:\s*/g, '');
    }
    
    // Unescape standard JSON sequences
    return cleaned
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\');
  }

  private async applyFileChanges(content: string, projectId?: string) {
    // Regex to match <file path="...">...</file>
    const fileRegex = /<file\s+path="([^"]+)">([\s\S]*?)<\/file>/g;
    let match;

    let baseDir = process.cwd();
    if (projectId && projectId !== 'null') {
      baseDir = path.join(process.cwd(), '.projects', projectId);
      await fs.mkdir(baseDir, { recursive: true });
    }

    while ((match = fileRegex.exec(content)) !== null) {
      const filePath = match[1].trim();
      const fileContent = match[2].trim();
      
      const fullPath = path.join(baseDir, filePath.startsWith('/') ? filePath.slice(1) : filePath);
      
      console.log(`[Orchestrator] Applying changes to: ${filePath}`);
      
      try {
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, fileContent, 'utf-8');
      } catch (e) {
        console.error(`[Orchestrator] Failed to write file ${filePath}:`, e);
      }
    }

    // Process commands as well
    const cmdRegex = /<command>([\s\S]*?)<\/command>/g;
    let cmdMatch;

    while ((cmdMatch = cmdRegex.exec(content)) !== null) {
      const command = cmdMatch[1].trim();
      console.log(`[Orchestrator] Running background command: ${command}`);
      try {
        execAsync(command, { cwd: baseDir });
      } catch (e) {
        console.error(`[Orchestrator] Failed to run command ${command}:`, e);
      }
    }
  }

  notifyFileChange(filePath: string, content: string) {
    this.brain.learnFromFileChange(filePath, content);
  }

  async getSystemStatus() {
    return {
      brain: this.brain.getHealth(),
      orchestrator: {
        activeStreams: 0,
        uptime: process.uptime()
      }
    };
  }
}
