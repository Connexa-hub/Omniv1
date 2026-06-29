import { ProviderHealthState, ProviderMetrics, ProviderSettings } from "./types";
import { db } from "../firebaseAdmin";

export class ProviderHealthManager {
  private static metricsCache: Record<string, ProviderMetrics> = {};
  private static healthCache: Record<string, ProviderHealthState> = {};
  private static consecutiveFailures: Record<string, number> = {};
  private static rateLimitCount: Record<string, number> = {};

  static getInitialMetrics(): ProviderMetrics {
    return {
      successRate: 1.0,
      failureRate: 0.0,
      latency: 200,
      rateLimitCount: 0,
      consecutiveFailures: 0,
      totalRequests: 0,
      totalSuccesses: 0
    };
  }

  static async getMetrics(providerId: string, userId?: string): Promise<ProviderMetrics> {
    const cacheKey = `${providerId}_${userId || 'global'}`;
    if (this.metricsCache[cacheKey]) {
      return this.metricsCache[cacheKey];
    }

    try {
      if (userId && db) {
        const docRef = db.collection('users').doc(userId).collection('provider_metrics').doc(providerId);
        const snapshot = await docRef.get();
        if (snapshot.exists) {
          const data = snapshot.data() as ProviderMetrics;
          this.metricsCache[cacheKey] = data;
          return data;
        }
      }
    } catch (e) {
      console.error(`[HealthManager] Failed to load metrics for ${providerId}:`, e);
    }

    const initial = this.getInitialMetrics();
    this.metricsCache[cacheKey] = initial;
    return initial;
  }

  static async recordRequest(providerId: string, success: boolean, latency: number, isRateLimit: boolean = false, isQuota: boolean = false, userId?: string) {
    const cacheKey = `${providerId}_${userId || 'global'}`;
    const metrics = await this.getMetrics(providerId, userId);

    metrics.totalRequests++;
    if (success) {
      metrics.totalSuccesses++;
      this.consecutiveFailures[cacheKey] = 0;
      // Calculate running average for latency
      metrics.latency = Math.round((metrics.latency * 4 + latency) / 5);
    } else {
      this.consecutiveFailures[cacheKey] = (this.consecutiveFailures[cacheKey] || 0) + 1;
      if (isRateLimit) {
        this.rateLimitCount[cacheKey] = (this.rateLimitCount[cacheKey] || 0) + 1;
      }
    }

    metrics.consecutiveFailures = this.consecutiveFailures[cacheKey] || 0;
    metrics.rateLimitCount = this.rateLimitCount[cacheKey] || 0;
    metrics.successRate = metrics.totalSuccesses / metrics.totalRequests;
    metrics.failureRate = 1 - metrics.successRate;

    this.metricsCache[cacheKey] = metrics;

    // Determine and update health state
    let health: ProviderHealthState = 'healthy';
    if (metrics.consecutiveFailures >= 3) {
      health = 'offline';
    } else if (isRateLimit || (this.rateLimitCount[cacheKey] || 0) > 3) {
      health = 'rate_limited';
    } else if (isQuota) {
      health = 'quota_low';
    }

    await this.setHealthState(providerId, health, userId);

    // Save to Firestore in background
    if (userId && db) {
      try {
        await db.collection('users').doc(userId).collection('provider_metrics').doc(providerId).set(metrics, { merge: true });
      } catch (err) {
        console.error(`[HealthManager] Failed to save metrics for ${providerId} to Firestore:`, err);
      }
    }
  }

  static async getHealthState(providerId: string, userId?: string): Promise<ProviderHealthState> {
    const cacheKey = `${providerId}_${userId || 'global'}`;
    if (this.healthCache[cacheKey]) {
      return this.healthCache[cacheKey];
    }

    try {
      if (userId && db) {
        const docRef = db.collection('users').doc(userId).collection('provider_health').doc(providerId);
        const snapshot = await docRef.get();
        if (snapshot.exists) {
          const data = snapshot.data();
          if (data && data.state) {
            this.healthCache[cacheKey] = data.state as ProviderHealthState;
            return data.state as ProviderHealthState;
          }
        }
      }
    } catch (e) {
      console.error(`[HealthManager] Failed to load health for ${providerId}:`, e);
    }

    return 'healthy';
  }

  static async setHealthState(providerId: string, state: ProviderHealthState, userId?: string) {
    const cacheKey = `${providerId}_${userId || 'global'}`;
    this.healthCache[cacheKey] = state;

    if (userId && db) {
      try {
        await db.collection('users').doc(userId).collection('provider_health').doc(providerId).set({
          state,
          lastCheck: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error(`[HealthManager] Failed to save health state for ${providerId} to Firestore:`, err);
      }
    }
  }

  static async getProviderSettings(providerId: string, userId?: string): Promise<ProviderSettings | null> {
    if (!userId || !db) return null;
    try {
      const docRef = db.collection('users').doc(userId).collection('provider_settings').doc(providerId);
      const snapshot = await docRef.get();
      if (snapshot.exists) {
        return snapshot.data() as ProviderSettings;
      }
    } catch (e) {
      console.error(`[HealthManager] Failed to load settings for ${providerId}:`, e);
    }
    return null;
  }

  static async saveProviderSettings(providerId: string, settings: Partial<ProviderSettings>, userId: string) {
    if (!userId || !db) return;
    try {
      await db.collection('users').doc(userId).collection('provider_settings').doc(providerId).set(settings, { merge: true });
    } catch (e) {
      console.error(`[HealthManager] Failed to save settings for ${providerId}:`, e);
    }
  }

  // Active health check runner to validate all configured providers in background
  static startBackgroundHealthCheck(userId?: string) {
    console.log(`[HealthManager] Starting background health checks loop (every 5 minutes)...`);
    setInterval(async () => {
      try {
        const { ProviderRegistry } = await import("./ProviderRegistry");
        const providers = ProviderRegistry.getAllProviders();
        for (const p of providers) {
          const { key } = await p.getApiKey(userId);
          if (key) {
            console.log(`[HealthManager] Running active health check for ${p.name}...`);
            const startTime = Date.now();
            try {
              const testResult = await p.testKey(key);
              if (testResult.success) {
                await this.recordRequest(p.id, true, Date.now() - startTime, false, false, userId);
              } else {
                await this.recordRequest(p.id, false, Date.now() - startTime, false, false, userId);
              }
            } catch {
              await this.recordRequest(p.id, false, 1000, false, false, userId);
            }
          }
        }
      } catch (err) {
        console.error("[HealthManager] Error during periodic health checks:", err);
      }
    }, 5 * 60 * 1000);
  }
}
