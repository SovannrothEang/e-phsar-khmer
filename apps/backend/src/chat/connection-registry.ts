import { Injectable } from '@nestjs/common';
import type WebSocket from 'ws';

export type ConnectionInfo = {
  socket: WebSocket;
  userId: string;
  /** Device revocation epoch from the JWT/WsTicket `sid`, if any. */
  sessionId: string | null;
  lastPongAt: number;
};

@Injectable()
export class ConnectionRegistry {
  // Safe as a plain Map — single-threaded, no race between connect/disconnect
  private readonly byUser = new Map<string, Set<ConnectionInfo>>();

  add(userId: string, conn: ConnectionInfo) {
    if (!this.byUser.has(userId)) this.byUser.set(userId, new Set());
    this.byUser.get(userId)!.add(conn);
  }

  remove(userId: string, conn: ConnectionInfo) {
    this.byUser.get(userId)?.delete(conn);
    if (this.byUser.get(userId)?.size === 0) this.byUser.delete(userId);
  }

  isOnline(userId: string): boolean {
    return this.byUser.has(userId);
  }

  connectionsFor(userId: string): ConnectionInfo[] {
    return [...(this.byUser.get(userId) ?? [])];
  }

  allConnections(): ConnectionInfo[] {
    return [...this.byUser.values()].flatMap((set) => [...set]);
  }
}
