"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/types/chat";

const WS_RECONNECT_BASE_MS = 1_000;
const WS_RECONNECT_MAX_MS = 30_000;
const WS_RECONNECT_ATTEMPTS = 10;

export type ChatWsEvent =
  | { type: "message"; payload: ChatMessage }
  | { type: "inbox_update" }
  | { type: "unread_count" };

type Listener = (event: ChatWsEvent) => void;
type ConnectedListener = (connected: boolean) => void;

/**
 * One physical WebSocket per browser tab, ref-counted across every mounted
 * consumer (nav unread badge, inbox list, an open thread) instead of one
 * socket per component. The badge is mounted on every page, so in practice
 * this keeps a single connection open for the whole session whenever the
 * user is signed in — which is what lets `inbox_update` / `unread_count`
 * replace their flat-interval polls instead of only helping while a thread
 * happens to be open.
 *
 * Bounded reconnect (10 attempts, exponential backoff up to 30s, then it
 * gives up) covers both a real disconnect and a signed-out visitor whose
 * connection the server rejects — it is not tied to auth state, so there is
 * no stale "not authenticated" flag to invalidate after a client-side login.
 */
class ChatSocket {
  private ws: WebSocket | null = null;
  private readonly listeners = new Set<Listener>();
  private readonly connectedListeners = new Set<ConnectedListener>();
  private refCount = 0;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  isConnected = false;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    this.refCount += 1;
    this.ensureConnected();
    return () => {
      this.listeners.delete(listener);
      this.refCount = Math.max(0, this.refCount - 1);
      if (this.refCount === 0) this.teardown();
    };
  }

  onConnectedChange(cb: ConnectedListener): () => void {
    this.connectedListeners.add(cb);
    cb(this.isConnected);
    return () => this.connectedListeners.delete(cb);
  }

  send(envelope: {
    recipientId: string;
    body?: string;
    listingId?: string;
    imagePath?: string;
  }) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({ event: "send_message", data: { payload: envelope } }),
    );
  }

  private ensureConnected() {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    )
      return;
    this.connect();
  }

  private connect() {
    // In dev the Next.js server (port 3001) and backend (port 3000) are on
    // different origins, so cookies won't travel — connect directly to the
    // backend. In production they share an origin and the default works.
    const isDev = window.location.port === "3001";
    const proto = isDev
      ? "ws:"
      : window.location.protocol === "https:"
        ? "wss:"
        : "ws:";
    const host = isDev ? "localhost:3000" : window.location.host;
    const ws = new WebSocket(`${proto}//${host}/ws/chat`);
    this.ws = ws;

    ws.onopen = () => {
      this.attempt = 0;
      this.setConnected(true);
    };

    ws.onmessage = (event) => {
      let data: ChatWsEvent;
      try {
        data = JSON.parse(event.data) as ChatWsEvent;
      } catch {
        return; // malformed frame — ignore
      }
      for (const listener of this.listeners) listener(data);
    };

    ws.onclose = () => {
      this.setConnected(false);
      this.ws = null;
      if (this.refCount > 0) this.scheduleReconnect();
    };

    ws.onerror = () => ws.close();
  }

  private scheduleReconnect() {
    if (this.attempt >= WS_RECONNECT_ATTEMPTS) return;
    const delay = Math.min(
      WS_RECONNECT_BASE_MS * 2 ** this.attempt,
      WS_RECONNECT_MAX_MS,
    );
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => {
      if (this.refCount > 0) this.connect();
    }, delay);
  }

  private setConnected(v: boolean) {
    this.isConnected = v;
    for (const cb of this.connectedListeners) cb(v);
  }

  private teardown() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close();
    this.ws = null;
    this.attempt = 0;
    this.setConnected(false);
  }
}

// Module-scoped singleton — deliberately not created per-hook-call. Every
// `useChatWs`/`useChatRealtime` instance across the app shares this one.
const chatSocket = new ChatSocket();

export interface ChatWsState {
  isConnected: boolean;
  send: (envelope: {
    recipientId: string;
    body?: string;
    listingId?: string;
    imagePath?: string;
  }) => void;
}

/**
 * Full per-thread hook: message delivery + send, on the shared connection.
 * `enabled` controls this consumer's own subscription — the underlying
 * socket may still be open because the badge or inbox list is also
 * subscribed elsewhere on the page.
 */
export function useChatWs({
  enabled,
  onMessage,
}: {
  enabled: boolean;
  onMessage: (msg: ChatMessage) => void;
}): ChatWsState {
  const [isConnected, setIsConnected] = useState(chatSocket.isConnected);
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = chatSocket.subscribe((event) => {
      if (event.type === "message") onMessageRef.current(event.payload);
    });
    const unsubscribeConnected = chatSocket.onConnectedChange(setIsConnected);
    return () => {
      unsubscribe();
      unsubscribeConnected();
    };
  }, [enabled]);

  const send = useCallback((envelope: Parameters<ChatWsState["send"]>[0]) => {
    chatSocket.send(envelope);
  }, []);

  return { isConnected: enabled && isConnected, send };
}

/**
 * Lightweight hook for consumers that only care about `inbox_update` /
 * `unread_count` signals and connection state — the nav badge and the inbox
 * list. Also keeps the shared socket's ref count alive, since both of these
 * are typically the only thing mounted outside an open thread.
 */
export function useChatRealtimeEvents({
  enabled,
  onEvent,
}: {
  enabled: boolean;
  onEvent: (event: Extract<ChatWsEvent, { type: "inbox_update" | "unread_count" }>) => void;
}): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState(chatSocket.isConnected);
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = chatSocket.subscribe((event) => {
      if (event.type === "inbox_update" || event.type === "unread_count")
        onEventRef.current(event);
    });
    const unsubscribeConnected = chatSocket.onConnectedChange(setIsConnected);
    return () => {
      unsubscribe();
      unsubscribeConnected();
    };
  }, [enabled]);

  return { isConnected: enabled && isConnected };
}
