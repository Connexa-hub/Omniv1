/**
 * Project Omni - Core Type Definitions
 */

export interface ThinkingStep {
  id: string;
  type: 'thinking' | 'writing' | 'testing' | 'handoff';
  label: string;
  detail?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  thought?: string;
  steps?: ThinkingStep[];
  suggestions?: string[];
  modelId?: string;        // which model responded (e.g. "omni-google", "omni-groq")
  providerName?: string;   // display name (e.g. "Gemini 2.0 Flash", "Claude 3.5 Sonnet")
  providerPlatform?: string; // platform (e.g. "Google", "Anthropic", "OpenAI", "Groq")
  mode?: string;           // which mode was used (e.g. "fast", "thinking", "search", "research")
}

export type AIMode = 'fast' | 'thinking' | 'agent' | 'search' | 'deep_research' | 'plan' | 'research' | 'learn' | 'study';

// Add new Project interface:
export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string;
  purpose: string;         // what user wants to build it for
  createdAt: Date;
  lastModified: Date;
  messages: Message[];
  files: FileNode[];
  status: 'idle' | 'generating' | 'building' | 'error' | 'initializing';
  activeFile?: string;
}
export interface UserApiKey {
  platform: string;        // "openai", "anthropic", "groq", etc.
  platformName: string;    // "OpenAI", "Anthropic", "Groq"
  apiKey: string;
  enabled: boolean;
  models: string[];        // list of available models for this platform
}

// Add new SecretVar interface:
export interface SecretVar {
  key: string;
  value: string;
  scope: 'frontend' | 'backend' | 'both';
}

export interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  content?: string;
  children?: FileNode[];
}

export interface ProjectState {
  name: string;
  description: string;
  files: FileNode[];
  activeFile?: string;
  messages: Message[];
  status: 'idle' | 'generating' | 'building' | 'error' | 'initializing';
  lastBuildAt?: number;
}

export interface BuildLog {
  timestamp: number;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
}

export interface AppMetadata {
  name: string;
  description: string;
  version: string;
}
