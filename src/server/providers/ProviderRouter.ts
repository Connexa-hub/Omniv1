import { ProviderRegistry } from "./ProviderRegistry";
import { ProviderHealthManager } from "./ProviderHealthManager";
import { PriorityMode, ProviderStatus } from "./types";
import { db } from "../firebaseAdmin";

export interface RoutingConfig {
  preferredProviderId: string | null;
  priorityMode: PriorityMode;
  autoFailover: boolean;
  autoHealthCheck: boolean;
}

export class ProviderRouter {
  // Load routing config from Firestore or default
  static async getRoutingConfig(userId?: string): Promise<RoutingConfig> {
    const defaultConfig: RoutingConfig = {
      preferredProviderId: null,
      priorityMode: 'balanced',
      autoFailover: true,
      autoHealthCheck: true
    };

    if (!userId || !db) return defaultConfig;

    try {
      const docRef = db.collection('users').doc(userId).collection('provider_config').doc('routing');
      const snapshot = await docRef.get();
      if (snapshot.exists) {
        return { ...defaultConfig, ...snapshot.data() } as RoutingConfig;
      }
    } catch (e) {
      console.error("[ProviderRouter] Failed to load routing config:", e);
    }
    return defaultConfig;
  }

  static async saveRoutingConfig(userId: string, config: Partial<RoutingConfig>) {
    if (!userId || !db) return;
    try {
      await db.collection('users').doc(userId).collection('provider_config').doc('routing').set(config, { merge: true });
    } catch (e) {
      console.error("[ProviderRouter] Failed to save routing config:", e);
    }
  }

  // Get ranked list of healthy providers based on priority mode and status
  static async getRankedProviders(userId?: string): Promise<ProviderStatus[]> {
    const config = await this.getRoutingConfig(userId);
    const statuses = await ProviderRegistry.getProviderStatuses(userId);

    // Filter to enabled providers with configured keys
    const available = statuses.filter(s => s.enabled && (s.hasUserKey || s.hasBuiltInKey));

    // Sort function depending on Priority Mode
    available.sort((a, b) => {
      // 1. PIN preferred provider to top (if healthy or not offline)
      if (config.preferredProviderId) {
        if (a.id === config.preferredProviderId && a.healthState !== 'offline') return -1;
        if (b.id === config.preferredProviderId && b.healthState !== 'offline') return 1;
      }

      // 2. Put healthy / online providers above offline/rate-limited
      const stateScore = (state: string) => {
        if (state === 'healthy') return 100;
        if (state === 'quota_low') return 50;
        if (state === 'rate_limited') return 20;
        return 0; // offline / disabled
      };
      const scoreDiff = stateScore(b.healthState) - stateScore(a.healthState);
      if (scoreDiff !== 0) return scoreDiff;

      // 3. User Key (BYOK) preferred over built-in key
      if (a.hasUserKey && !b.hasUserKey) return -1;
      if (!a.hasUserKey && b.hasUserKey) return 1;

      // 4. Apply Priority Mode sorting
      if (config.priorityMode === 'fastest') {
        // Sort by latency (lowest first)
        return a.metrics.latency - b.metrics.latency;
      } else if (config.priorityMode === 'cheapest') {
        // Groq, Cerebras, DeepSeek are cheap
        const costWeight = (id: string) => {
          if (['groq', 'cerebras', 'deepseek'].includes(id)) return 1;
          if (['cloudflare', 'together', 'fireworks', 'huggingface'].includes(id)) return 2;
          return 3; // google, openrouter, nvidia, github, mistral
        };
        return costWeight(a.id) - costWeight(b.id);
      } else if (config.priorityMode === 'best_quality') {
        // Quality weights
        const qualityWeight = (id: string) => {
          if (['google', 'mistral', 'openrouter', 'github', 'nvidia'].includes(id)) return 3;
          if (['deepseek', 'groq', 'together', 'fireworks'].includes(id)) return 2;
          return 1;
        };
        return qualityWeight(b.id) - qualityWeight(a.id);
      } else {
        // Balanced (Latency + Success Rate)
        const scoreA = a.metrics.successRate * 100 - (a.metrics.latency / 20);
        const scoreB = b.metrics.successRate * 100 - (b.metrics.latency / 20);
        return scoreB - scoreA;
      }
    });

    return available;
  }

  // Orchestrate prompt streaming with automatic transparent failover
  static async routeStream(
    prompt: string,
    history: any[],
    systemPrompt: string,
    initialModelId: string, // E.g., 'omni-google' or 'google/gemini-3.5-flash'
    onChunk: (chunk: string) => void,
    userId?: string
  ): Promise<{ modelUsed: string; providerId: string; responseTime: number; isUserKey: boolean }> {
    const config = await this.getRoutingConfig(userId);
    const ranked = await this.getRankedProviders(userId);

    if (ranked.length === 0) {
      throw new Error("No healthy or configured providers available in the AI Mesh!");
    }

    // Determine starting provider
    let initialProviderId = "google";
    let initialModel = "gemini-3.5-flash";

    if (initialModelId.startsWith("omni-")) {
      initialProviderId = initialModelId.replace("omni-", "");
    } else {
      // Direct model mapping or custom
      const providerMatch = ProviderRegistry.getAllProviders().find(p => p.defaultModels.includes(initialModelId) || p.id === initialModelId);
      if (providerMatch) {
        initialProviderId = providerMatch.id;
        initialModel = initialModelId;
      }
    }

    // Sort providers so the starting provider is first if auto-failover is off or if it is healthy
    const providerIndex = ranked.findIndex(r => r.id === initialProviderId);
    let providersToTry = [...ranked];
    if (providerIndex !== -1) {
      const [startP] = providersToTry.splice(providerIndex, 1);
      providersToTry.unshift(startP);
    }

    if (!config.autoFailover) {
      // If auto-failover is off, we only try the first selected provider
      providersToTry = [providersToTry[0]];
    }

    let lastError: any = null;
    for (const status of providersToTry) {
      const provider = ProviderRegistry.getProvider(status.id);
      if (!provider) continue;

      const modelToUse = status.id === initialProviderId && !initialModelId.startsWith("omni-") 
        ? initialModelId 
        : provider.getSettings().models[0];

      console.log(`[ProviderRouter] Routing request to: ${provider.name} with model: ${modelToUse}...`);
      const startTime = Date.now();
      try {
        await provider.generateStream(prompt, history, systemPrompt, modelToUse, onChunk, userId);
        
        // Return metrics of successful execution
        const { isUserKey } = await provider.getApiKey(userId);
        return {
          modelUsed: modelToUse,
          providerId: provider.id,
          responseTime: Date.now() - startTime,
          isUserKey
        };
      } catch (err: any) {
        console.error(`[ProviderRouter] Provider ${provider.name} failed during streaming:`, err.message);
        lastError = err;
        // Let user know fallback is happening in the stream metadata
        onChunk(`\n\n*[AI Mesh Failover: ${provider.name} rate limited or unavailable. Switching provider...]*\n\n`);
      }
    }

    throw new Error(`All providers failed in the AI Mesh! Last error: ${lastError?.message || "Unknown"}`);
  }
}
