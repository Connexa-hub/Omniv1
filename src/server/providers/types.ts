export type ProviderHealthState = 'healthy' | 'rate_limited' | 'quota_low' | 'offline' | 'disabled';
export type PriorityMode = 'fastest' | 'cheapest' | 'best_quality' | 'balanced';

export interface ProviderMetrics {
  successRate: number;
  failureRate: number;
  latency: number; // Average in ms
  rateLimitCount: number;
  consecutiveFailures: number;
  totalRequests: number;
  totalSuccesses: number;
}

export interface ProviderSettings {
  id: string;
  name: string;
  enabled: boolean;
  apiKey: string; // Stored user key (primary or first key)
  apiKeys?: string[]; // Multiple stored user keys
  cloudflareAccountId?: string; // For Cloudflare BYOK
  huggingFaceModelId?: string; // For Hugging Face BYOK custom model
  isUserKey: boolean; // True if it's a BYOK key
  priority: number;
  models: string[];
  supportsStreaming: boolean;
}

export interface ProviderStatus {
  id: string;
  name: string;
  enabled: boolean;
  healthState: ProviderHealthState;
  hasUserKey: boolean;
  hasBuiltInKey: boolean;
  apiKeys?: string[]; // Multiple keys configured
  cloudflareAccountId?: string;
  huggingFaceModelId?: string;
  metrics: ProviderMetrics;
  quotaStatus?: string;
  lastCheck?: string;
}

export interface AIProvider {
  id: string;
  name: string;
  getSettings(): ProviderSettings;
  updateSettings(settings: Partial<ProviderSettings>): void;
  getMetrics(): ProviderMetrics;
  recordSuccess(latency: number): void;
  recordFailure(isRateLimit?: boolean, isQuota?: boolean): void;
  getHealthState(): ProviderHealthState;
  setHealthState(state: ProviderHealthState): void;
  
  // High-level API
  generateStream(
    prompt: string,
    history: any[],
    systemPrompt: string,
    modelId: string,
    onChunk: (chunk: string) => void
  ): Promise<void>;
  
  testKey(apiKey: string, accountId?: string): Promise<{ success: boolean; models: string[]; error?: string; quotaStatus?: string }>;
}
