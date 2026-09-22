import { Injectable } from '@nestjs/common';

const MAX_SAMPLES = 500;

export interface ChatSendMetricsSnapshot {
  activeSends: number;
  sampleCount: number;
  avgMs: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
  maxMs: number | null;
}

/**
 * In-process send-latency metrics for `ChatService.sendMessage` — enough to
 * answer "is chat slow right now" from a running instance without a live
 * debugging session (which is how the connection-pool bottleneck this was
 * added for got found in the first place). Deliberately not a real
 * metrics/tracing stack: no Prometheus, no persistence, no cross-instance
 * aggregation — just a bounded rolling window kept in memory, read on demand
 * via `GET /admin/chat-metrics`. Resets on restart; that's fine for "is it
 * slow right now", not meant for historical analysis.
 */
@Injectable()
export class ChatMetricsService {
  private activeSends = 0;
  private readonly samples: number[] = [];

  beginSend(): void {
    this.activeSends += 1;
  }

  endSend(durationMs: number): void {
    this.activeSends = Math.max(0, this.activeSends - 1);
    this.samples.push(durationMs);
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
  }

  snapshot(): ChatSendMetricsSnapshot {
    const sorted = [...this.samples].sort((a, b) => a - b);
    const percentile = (p: number): number | null => {
      if (sorted.length === 0) return null;
      const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
      return Math.round(sorted[idx]);
    };
    const sum = sorted.reduce((a, b) => a + b, 0);
    return {
      activeSends: this.activeSends,
      sampleCount: sorted.length,
      avgMs: sorted.length ? Math.round(sum / sorted.length) : null,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      p99Ms: percentile(0.99),
      maxMs: sorted.length ? Math.round(sorted[sorted.length - 1]) : null,
    };
  }
}
