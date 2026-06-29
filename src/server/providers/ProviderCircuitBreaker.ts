export class ProviderCircuitBreaker {
  private providerId: string;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private consecutiveFailures: number = 0;
  private failureThreshold: number = 3;
  private cooldownMs: number = 5 * 60 * 1000; // 5 minutes
  private lastFailureTime: number = 0;

  constructor(providerId: string) {
    this.providerId = providerId;
  }

  getState() {
    this.evaluateState();
    return this.state;
  }

  recordSuccess() {
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
  }

  recordFailure() {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'OPEN';
      console.warn(`[CircuitBreaker] Provider ${this.providerId} circuit breaker tripped to OPEN!`);
    }
  }

  canExecute(): boolean {
    this.evaluateState();
    return this.state !== 'OPEN';
  }

  getResetRemainingTimeMs(): number {
    if (this.state !== 'OPEN') return 0;
    const elapsed = Date.now() - this.lastFailureTime;
    return Math.max(0, this.cooldownMs - elapsed);
  }

  private evaluateState() {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.cooldownMs) {
        this.state = 'HALF_OPEN';
        console.log(`[CircuitBreaker] Provider ${this.providerId} circuit entered HALF_OPEN state (cooldown elapsed).`);
      }
    }
  }
}
