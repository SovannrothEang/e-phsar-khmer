import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConnectionRegistry } from "./connection-registry";

@Injectable()
export class HeartbeatService implements OnModuleInit {
  private readonly PING_INTERVAL_MS = 30_000;
  private readonly PONG_TIMEOUT_MS = 10_000;

  constructor(private readonly registry: ConnectionRegistry) {}

  onModuleInit() {
    setInterval(() => this.sweep(), this.PING_INTERVAL_MS);
  }

  private sweep() {
    const now = Date.now();
    for (const conn of this.registry.allConnections()) {
      if (now - conn.lastPongAt > this.PING_INTERVAL_MS + this.PONG_TIMEOUT_MS) {
        conn.socket.close();
        continue;
      }
      conn.socket.ping();
    }
  }
}
