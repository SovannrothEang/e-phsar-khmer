"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const WS_RECONNECT_BASE_MS = 1_000;
const WS_RECONNECT_MAX_MS = 30_000;
const WS_RECONNECT_ATTEMPTS = 10;

interface WsMessage {
  type: "message";
  payload: {
    id: string;
    conversationId: string;
    senderId: string;
    body: string | null;
    listingId: string | null;
    imageUrl: string | null;
    imagePath: string | null;
    readAt: string | null;
    createdAt: string;
  };
}

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
 * WebSocket hook for real-time chat. Connects to the backend gateway using the
 * httpOnly `user_access_token` cookie (same-origin WS upgrades send cookies
 * automatically — no token in the URL needed).
 *
 * The hook is intentionally dumb: it receives an `onMessage` callback and
 * forwards every incoming message to it. All state management lives in the
 * consumer (`use-chat-thread.ts`).
 */
export function useChatWs({
  enabled,
  onMessage,
}: {
  enabled: boolean;
  onMessage: (msg: WsMessage["payload"]) => void;
}): ChatWsState {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);

  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (!enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

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
    wsRef.current = ws;

    ws.onopen = () => {
      attemptRef.current = 0;
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsMessage;
        if (data.type === "message") {
          onMessageRef.current(data.payload);
        }
      } catch {
        // malformed frame — ignore
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose fires after onerror — reconnect happens there.
      ws.close();
    };
  }, [enabled]);

  const scheduleReconnect = useCallback(() => {
    if (!enabled) return;
    if (attemptRef.current >= WS_RECONNECT_ATTEMPTS) return;

    const delay = Math.min(
      WS_RECONNECT_BASE_MS * 2 ** attemptRef.current,
      WS_RECONNECT_MAX_MS,
    );
    attemptRef.current += 1;
    reconnectTimer.current = setTimeout(connect, delay);
  }, [enabled, connect]);

  // Connect / disconnect on enable toggle.
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      wsRef.current?.close();
    }
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
      setIsConnected(false);
    };
  }, [enabled, connect]);

  const send = useCallback(
    (envelope: {
      recipientId: string;
      body?: string;
      listingId?: string;
      imagePath?: string;
    }) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(
        JSON.stringify({ event: "send_message", data: { payload: envelope } }),
      );
    },
    [],
  );

  return { isConnected, send };
}
