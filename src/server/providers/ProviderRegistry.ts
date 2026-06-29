import { AIProvider, ProviderHealthState, ProviderMetrics, ProviderSettings, ProviderStatus } from "./types";
import { ProviderCircuitBreaker } from "./ProviderCircuitBreaker";
import { ProviderHealthManager } from "./ProviderHealthManager";
import { GoogleGenAI } from "@google/genai";
import { OpenAI } from "openai";
import axios from "axios";

// Abstract base class for providers to share standard settings and health tracking
export abstract class BaseProvider implements AIProvider {
  abstract id: string;
  abstract name: string;
  abstract defaultModels: string[];
  abstract builtInKeyEnvName: string;
  
  protected _circuitBreaker?: ProviderCircuitBreaker;
  protected localSettings: Partial<ProviderSettings> = {};
  
  // Static dictionary to hold current rotating key index per user and provider
  protected static rotationIndices: Record<string, number> = {};

  protected get circuitBreaker(): ProviderCircuitBreaker {
    if (!this._circuitBreaker) {
      this._circuitBreaker = new ProviderCircuitBreaker(this.id);
    }
    return this._circuitBreaker;
  }

  // Resolves the API key to use with round-robin rotation over multiple keys
  async getApiKey(userId?: string): Promise<{ key: string; isUserKey: boolean }> {
    if (userId) {
      const persisted = await ProviderHealthManager.getProviderSettings(this.id, userId);
      if (persisted && persisted.enabled !== false) {
        const keys = persisted.apiKeys && persisted.apiKeys.length > 0
          ? persisted.apiKeys.filter((k: string) => k && k.trim() !== "")
          : (persisted.apiKey ? [persisted.apiKey] : []);

        if (keys.length > 0) {
          const cacheKey = `${this.id}_${userId}`;
          if (BaseProvider.rotationIndices[cacheKey] === undefined) {
            BaseProvider.rotationIndices[cacheKey] = 0;
          }
          const index = BaseProvider.rotationIndices[cacheKey] % keys.length;
          BaseProvider.rotationIndices[cacheKey]++;
          const selectedKey = keys[index];
          console.log(`[BaseProvider] Rotating keys for ${this.id}: using key ${index + 1} of ${keys.length}`);
          return { key: selectedKey, isUserKey: true };
        }
      }
    }
    if (this.localSettings.enabled !== false) {
      const keys = this.localSettings.apiKeys && this.localSettings.apiKeys.length > 0
        ? this.localSettings.apiKeys.filter((k: string) => k && k.trim() !== "")
        : (this.localSettings.apiKey ? [this.localSettings.apiKey] : []);

      if (keys.length > 0) {
        const cacheKey = `${this.id}_local`;
        if (BaseProvider.rotationIndices[cacheKey] === undefined) {
          BaseProvider.rotationIndices[cacheKey] = 0;
        }
        const index = BaseProvider.rotationIndices[cacheKey] % keys.length;
        BaseProvider.rotationIndices[cacheKey]++;
        return { key: keys[index], isUserKey: true };
      }
    }
    const envKey = process.env[this.builtInKeyEnvName];
    if (envKey && envKey !== "dummy-key") {
      return { key: envKey, isUserKey: false };
    }
    return { key: "", isUserKey: false };
  }

  getSettings(): ProviderSettings {
    return {
      id: this.id,
      name: this.name,
      enabled: this.localSettings.enabled ?? true,
      apiKey: this.localSettings.apiKey || "",
      apiKeys: this.localSettings.apiKeys || [],
      cloudflareAccountId: this.localSettings.cloudflareAccountId,
      huggingFaceModelId: this.localSettings.huggingFaceModelId,
      isUserKey: this.localSettings.isUserKey ?? false,
      priority: this.localSettings.priority ?? 5,
      models: this.localSettings.models || this.defaultModels,
      supportsStreaming: true
    };
  }

  updateSettings(settings: Partial<ProviderSettings>) {
    this.localSettings = { ...this.localSettings, ...settings };
  }

  getMetrics(): ProviderMetrics {
    return ProviderHealthManager.getInitialMetrics(); // Fallback if no user is provided, routing will load correctly
  }

  recordSuccess(latency: number) {
    this.circuitBreaker.recordSuccess();
  }

  recordFailure(isRateLimit?: boolean, isQuota?: boolean) {
    this.circuitBreaker.recordFailure();
  }

  getHealthState(): ProviderHealthState {
    if (this.localSettings.enabled === false) return 'disabled';
    if (!this.circuitBreaker.canExecute()) return 'offline';
    return 'healthy';
  }

  setHealthState(state: ProviderHealthState) {
    // Handled dynamically or via health manager
  }

  abstract generateStream(
    prompt: string,
    history: any[],
    systemPrompt: string,
    modelId: string,
    onChunk: (chunk: string) => void,
    userId?: string
  ): Promise<void>;

  abstract testKey(apiKey: string, accountId?: string): Promise<{ success: boolean; models: string[]; error?: string; quotaStatus?: string }>;
}

// 1. Google AI Studio Adapter
export class GoogleProvider extends BaseProvider {
  id = "google";
  name = "Google AI Studio";
  defaultModels = ["gemini-3.5-flash", "gemini-3.1-pro-preview"];
  builtInKeyEnvName = "GEMINI_API_KEY";

  async generateStream(prompt: string, history: any[], systemPrompt: string, modelId: string, onChunk: (chunk: string) => void, userId?: string) {
    const { key, isUserKey } = await this.getApiKey(userId);
    if (!key) throw new Error(`API Key for ${this.name} is not configured.`);

    const start = Date.now();
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const contents = history.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content || "..." }]
      }));
      contents.push({ role: 'user', parts: [{ text: prompt }] });

      // Ensure the roles alternate user -> model -> user
      const validatedContents = [];
      for (const msg of contents) {
        if (validatedContents.length > 0 && validatedContents[validatedContents.length - 1].role === msg.role) {
          validatedContents[validatedContents.length - 1].parts[0].text += "\n\n" + msg.parts[0].text;
        } else {
          validatedContents.push(msg);
        }
      }
      if (validatedContents.length > 0 && validatedContents[0].role !== 'user') {
        validatedContents.unshift({ role: 'user', parts: [{ text: 'Hello' }] });
      }

      const stream = await ai.models.generateContentStream({
        model: modelId || "gemini-3.5-flash",
        contents: validatedContents,
        config: {
          systemInstruction: systemPrompt
        }
      });

      for await (const chunk of stream) {
        if (chunk.text) onChunk(chunk.text);
      }

      this.recordSuccess(Date.now() - start);
      await ProviderHealthManager.recordRequest(this.id, true, Date.now() - start, false, false, userId);
    } catch (err: any) {
      const isRate = err.message?.includes("429") || err.message?.toLowerCase().includes("rate limit");
      const isQuota = err.message?.toLowerCase().includes("quota");
      this.recordFailure(isRate, isQuota);
      await ProviderHealthManager.recordRequest(this.id, false, Date.now() - start, isRate, isQuota, userId);
      throw err;
    }
  }

  async testKey(apiKey: string) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      // Minimal inference test
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: "Ping"
      });
      if (response.text) {
        return { success: true, models: this.defaultModels, quotaStatus: "Active Free Tier" };
      }
      return { success: false, models: [], error: "Empty response from Google API" };
    } catch (err: any) {
      return { success: false, models: [], error: err.message || "Unknown validation error" };
    }
  }
}

// Helper base class for standard OpenAI compatible API providers
export abstract class BaseOpenAIProvider extends BaseProvider {
  abstract baseURL: string;

  async generateStream(prompt: string, history: any[], systemPrompt: string, modelId: string, onChunk: (chunk: string) => void, userId?: string) {
    const { key, isUserKey } = await this.getApiKey(userId);
    if (!key) throw new Error(`API Key for ${this.name} is not configured.`);

    const start = Date.now();
    try {
      const client = new OpenAI({ apiKey: key, baseURL: this.baseURL });
      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...history.map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
          content: msg.content || "..."
        })),
        { role: "user" as const, content: prompt }
      ];

      const stream = await client.chat.completions.create({
        model: modelId || this.defaultModels[0],
        messages,
        stream: true
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) onChunk(text);
      }

      this.recordSuccess(Date.now() - start);
      await ProviderHealthManager.recordRequest(this.id, true, Date.now() - start, false, false, userId);
    } catch (err: any) {
      const isRate = err.status === 429 || err.message?.toLowerCase().includes("rate limit");
      const isQuota = err.message?.toLowerCase().includes("quota") || err.message?.toLowerCase().includes("insufficient balance");
      this.recordFailure(isRate, isQuota);
      await ProviderHealthManager.recordRequest(this.id, false, Date.now() - start, isRate, isQuota, userId);
      throw err;
    }
  }

  async testKey(apiKey: string, accountId?: string) {
    try {
      const client = new OpenAI({ apiKey, baseURL: this.baseURL });
      const res = await client.chat.completions.create({
        model: this.defaultModels[0],
        messages: [{ role: "user", content: "Ping" }],
        max_tokens: 1
      });
      if (res.choices[0]) {
        return { success: true, models: this.defaultModels, quotaStatus: "Active" };
      }
      return { success: false, models: [], error: "No response choices returned" };
    } catch (err: any) {
      return { success: false, models: [], error: err.message || "Authentication failed" };
    }
  }
}

// 2. Groq Adapter
export class GroqProvider extends BaseOpenAIProvider {
  id = "groq";
  name = "Groq";
  defaultModels = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"];
  builtInKeyEnvName = "GROQ_API_KEY";
  baseURL = "https://api.groq.com/openai/v1";
}

// 3. OpenRouter Adapter
export class OpenRouterProvider extends BaseOpenAIProvider {
  id = "openrouter";
  name = "OpenRouter";
  defaultModels = ["google/gemini-2.0-flash-001", "anthropic/claude-3.5-sonnet", "meta-llama/llama-3.1-70b-instruct"];
  builtInKeyEnvName = "OPENROUTER_API_KEY";
  baseURL = "https://openrouter.ai/api/v1";
}

// 4. DeepSeek Adapter
export class DeepSeekProvider extends BaseOpenAIProvider {
  id = "deepseek";
  name = "DeepSeek";
  defaultModels = ["deepseek-chat", "deepseek-coder"];
  builtInKeyEnvName = "DEEPSEEK_API_KEY";
  baseURL = "https://api.deepseek.com/v1";
}

// 5. Mistral Adapter
export class MistralProvider extends BaseOpenAIProvider {
  id = "mistral";
  name = "Mistral";
  defaultModels = ["mistral-large-latest", "mistral-small-latest", "pixtral-12b-2409"];
  builtInKeyEnvName = "MISTRAL_API_KEY";
  baseURL = "https://api.mistral.ai/v1";
}

// 6. Hugging Face Adapter
export class HuggingFaceProvider extends BaseProvider {
  id = "huggingface";
  name = "Hugging Face";
  defaultModels = ["google/gemma-2-9b-it", "mistralai/Mistral-Nemo-Instruct-2407", "meta-llama/Llama-3.2-11B-Vision-Instruct"];
  builtInKeyEnvName = "HUGGINGFACE_API_KEY";

  async generateStream(prompt: string, history: any[], systemPrompt: string, modelId: string, onChunk: (chunk: string) => void, userId?: string) {
    const { key } = await this.getApiKey(userId);
    if (!key) throw new Error(`API Key for ${this.name} is not configured.`);

    const start = Date.now();
    try {
      const hfHistory = history.length > 4 ? history.slice(-4) : history;
      const messages = [
        { role: "system" as const, content: systemPrompt.substring(0, 1000) },
        ...hfHistory.map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
          content: (msg.content || "...").substring(0, 1000)
        })),
        { role: "user" as const, content: prompt }
      ];

      let model = modelId;
      if (userId) {
        const persisted = await ProviderHealthManager.getProviderSettings(this.id, userId);
        if (persisted && persisted.huggingFaceModelId) {
          model = persisted.huggingFaceModelId;
        }
      }
      if (!model || model === "huggingface" || model.startsWith("omni-")) {
        model = this.defaultModels[0];
      }

      const response = await axios.post(
        `https://api-inference.huggingface.co/models/${model}`,
        { inputs: prompt, parameters: { max_new_tokens: 512 } },
        { headers: { Authorization: `Bearer ${key}` } }
      );

      const text = response.data?.[0]?.generated_text || response.data?.generated_text || JSON.stringify(response.data);
      onChunk(text);

      this.recordSuccess(Date.now() - start);
      await ProviderHealthManager.recordRequest(this.id, true, Date.now() - start, false, false, userId);
    } catch (err: any) {
      const isRate = err.response?.status === 429 || err.message?.toLowerCase().includes("rate limit");
      this.recordFailure(isRate, false);
      await ProviderHealthManager.recordRequest(this.id, false, Date.now() - start, isRate, false, userId);
      throw err;
    }
  }

  async testKey(apiKey: string, customModelId?: string) {
    try {
      const model = customModelId || this.defaultModels[0];
      const res = await axios.post(
        `https://api-inference.huggingface.co/models/${model}`,
        { inputs: "Hello" },
        { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10000 }
      );
      if (res.data) {
        return { success: true, models: [model, ...this.defaultModels.filter(m => m !== model)], quotaStatus: "Active Token" };
      }
      return { success: false, models: [], error: "No response from Hugging Face model" };
    } catch (err: any) {
      return { success: false, models: [], error: err.response?.data?.error || err.message || "Authentication failed" };
    }
  }
}

// 7. Cerebras Adapter
export class CerebrasProvider extends BaseOpenAIProvider {
  id = "cerebras";
  name = "Cerebras";
  defaultModels = ["llama3.1-70b", "llama3.1-8b"];
  builtInKeyEnvName = "CEREBRAS_API_KEY";
  baseURL = "https://api.cerebras.ai/v1";
}

// 8. GitHub Models Adapter
export class GitHubModelsProvider extends BaseOpenAIProvider {
  id = "github";
  name = "GitHub Models";
  defaultModels = ["gpt-4o", "gpt-4o-mini", "cohere-command-r-plus"];
  builtInKeyEnvName = "GITHUB_MODELS_TOKEN";
  baseURL = "https://models.inference.ai.azure.com";
}

// 9. Cloudflare Workers AI Adapter
export class CloudflareProvider extends BaseProvider {
  id = "cloudflare";
  name = "Cloudflare Workers AI";
  defaultModels = ["@cf/meta/llama-3.1-8b-instruct", "@cf/meta/llama-3.3-70b-instruct", "@cf/qwen/qwen1.5-14b-chat"];
  builtInKeyEnvName = "CLOUDFLARE_API_KEY";

  private async getAccountId(userId?: string): Promise<string> {
    if (userId) {
      const persisted = await ProviderHealthManager.getProviderSettings(this.id, userId);
      if (persisted && persisted.cloudflareAccountId) {
        return persisted.cloudflareAccountId;
      }
    }
    return this.localSettings.cloudflareAccountId || process.env.CLOUDFLARE_ACCOUNT_ID || "dummy-account";
  }

  async generateStream(prompt: string, history: any[], systemPrompt: string, modelId: string, onChunk: (chunk: string) => void, userId?: string) {
    const { key } = await this.getApiKey(userId);
    if (!key) throw new Error(`API Key for ${this.name} is not configured.`);
    const accountId = await this.getAccountId(userId);

    const start = Date.now();
    try {
      const model = modelId || this.defaultModels[0];
      const res = await axios.post(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
        {
          messages: [
            { role: "system", content: systemPrompt },
            ...history.map(msg => ({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content || "..." })),
            { role: "user", content: prompt }
          ]
        },
        { headers: { Authorization: `Bearer ${key}` } }
      );

      if (res.data?.result?.response) {
        onChunk(res.data.result.response);
      } else {
        throw new Error("No output response from Cloudflare AI");
      }

      this.recordSuccess(Date.now() - start);
      await ProviderHealthManager.recordRequest(this.id, true, Date.now() - start, false, false, userId);
    } catch (err: any) {
      const isRate = err.response?.status === 429 || err.message?.toLowerCase().includes("rate limit");
      this.recordFailure(isRate, false);
      await ProviderHealthManager.recordRequest(this.id, false, Date.now() - start, isRate, false, userId);
      throw err;
    }
  }

  async testKey(apiKey: string, accountId?: string) {
    try {
      const resolvedAccountId = accountId || await this.getAccountId();
      const res = await axios.post(
        `https://api.cloudflare.com/client/v4/accounts/${resolvedAccountId}/ai/run/${this.defaultModels[0]}`,
        { messages: [{ role: "user", content: "Ping" }] },
        { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10000 }
      );
      if (res.data) {
        return { success: true, models: this.defaultModels, quotaStatus: "Active" };
      }
      return { success: false, models: [], error: "No response from Cloudflare" };
    } catch (err: any) {
      return { success: false, models: [], error: err.response?.data?.errors?.[0]?.message || err.message || "Authentication failed" };
    }
  }
}

// 10. Together AI Adapter
export class TogetherProvider extends BaseOpenAIProvider {
  id = "together";
  name = "Together AI";
  defaultModels = ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "mistralai/Mixtral-8x22B-Instruct-v0.1"];
  builtInKeyEnvName = "TOGETHER_API_KEY";
  baseURL = "https://api.together.xyz/v1";
}

// 11. Fireworks AI Adapter
export class FireworksProvider extends BaseOpenAIProvider {
  id = "fireworks";
  name = "Fireworks AI";
  defaultModels = ["accounts/fireworks/models/llama-v3p1-70b-instruct", "accounts/fireworks/models/mixtral-8x22b-instruct"];
  builtInKeyEnvName = "FIREWORKS_API_KEY";
  baseURL = "https://api.fireworks.ai/inference/v1";
}

// 12. NVIDIA Build Adapter
export class NvidiaProvider extends BaseOpenAIProvider {
  id = "nvidia";
  name = "NVIDIA Build";
  defaultModels = ["meta/llama-3.1-70b-instruct", "nvidia/llama-3.1-nemotron-70b-instruct"];
  builtInKeyEnvName = "NVIDIA_API_KEY";
  baseURL = "https://integrate.api.nvidia.com/v1";
}

// Registry singleton to manage and access adapters
export class ProviderRegistry {
  private static providers: Record<string, BaseProvider> = {
    google: new GoogleProvider(),
    groq: new GroqProvider(),
    openrouter: new OpenRouterProvider(),
    deepseek: new DeepSeekProvider(),
    mistral: new MistralProvider(),
    huggingface: new HuggingFaceProvider(),
    cerebras: new CerebrasProvider(),
    github: new GitHubModelsProvider(),
    cloudflare: new CloudflareProvider(),
    together: new TogetherProvider(),
    fireworks: new FireworksProvider(),
    nvidia: new NvidiaProvider()
  };

  static getProvider(id: string): BaseProvider | undefined {
    return this.providers[id];
  }

  static getAllProviders(): BaseProvider[] {
    return Object.values(this.providers);
  }

  static async getProviderStatuses(userId?: string): Promise<ProviderStatus[]> {
    const statuses: ProviderStatus[] = [];
    for (const p of this.getAllProviders()) {
      const persisted = userId ? await ProviderHealthManager.getProviderSettings(p.id, userId) : null;
      const settings = p.getSettings();
      const metrics = await ProviderHealthManager.getMetrics(p.id, userId);
      const healthState = await ProviderHealthManager.getHealthState(p.id, userId);

      // Check key configurations
      const { key: userKey } = await p.getApiKey(userId);
      const builtInKey = process.env[p.builtInKeyEnvName];
      
      const hasUserKey = !!(persisted && (persisted.apiKey || (persisted.apiKeys && persisted.apiKeys.length > 0)));
      const hasBuiltInKey = !!(builtInKey && builtInKey !== "dummy-key");

      statuses.push({
        id: p.id,
        name: p.name,
        enabled: persisted?.enabled ?? settings.enabled,
        healthState: (persisted?.enabled ?? settings.enabled) ? healthState : 'disabled',
        hasUserKey,
        hasBuiltInKey,
        apiKeys: persisted?.apiKeys || (persisted?.apiKey ? [persisted.apiKey] : []),
        cloudflareAccountId: persisted?.cloudflareAccountId,
        huggingFaceModelId: persisted?.huggingFaceModelId,
        metrics,
        quotaStatus: hasUserKey ? `User BYOK Quota (${persisted?.apiKeys?.length || 1} key(s))` : (hasBuiltInKey ? "Built-in API Mesh quota" : "No Key Set")
      });
    }
    return statuses;
  }
}
