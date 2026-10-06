"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MeetingSocket, type SocketStatus } from "@/lib/websocket";
import type { ClientMessage, ServerMessage } from "@/types/realtime";

interface UseWebSocketOptions {
  meetingId: string;
  enabled: boolean;
  onMessage: (message: ServerMessage) => void;
}

/**
 * Binds a `MeetingSocket` to the component lifecycle. `onMessage` may change
 * every render; the socket always calls the latest one.
 */
export function useWebSocket({
  meetingId,
  enabled,
  onMessage,
}: UseWebSocketOptions): {
  status: SocketStatus;
  send: (message: ClientMessage) => void;
  reconnect: () => void;
} {
  // Starts as "connecting" so a room that just entered `joining` never
  // flashes a disconnected screen before the socket effect runs.
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const socketRef = useRef<MeetingSocket | null>(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!enabled) return;
    // `connect()` reports "connecting" first, which resets a stale status left
    // by a previous session so the join effect fires again for this socket.
    const socket = new MeetingSocket(meetingId, {
      onMessage: (message) => onMessageRef.current(message),
      onStatus: setStatus,
    });
    socketRef.current = socket;
    socket.connect();
    return () => {
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [meetingId, enabled]);

  const send = useCallback((message: ClientMessage) => {
    socketRef.current?.send(message);
  }, []);

  const reconnect = useCallback(() => {
    socketRef.current?.reconnect();
  }, []);

  return { status, send, reconnect };
}
