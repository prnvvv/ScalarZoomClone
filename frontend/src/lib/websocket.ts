import { MEETING_WS_PATH, toWebSocketUrl } from "@/lib/constants";
import type { ClientMessage, ServerMessage } from "@/types/realtime";

/** `ws://host:8000/ws/meetings/{id}` derived from the REST base URL. */
export function meetingWsUrl(meetingId: string): string {
  return toWebSocketUrl(MEETING_WS_PATH(meetingId));
}

export interface SocketHandlers {
  onMessage: (message: ServerMessage) => void;
  onStatus: (status: SocketStatus) => void;
}

export type SocketStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export interface SocketOptions {
  /** Automatic reconnect attempts before giving up. */
  maxRetries?: number;
  /** First retry delay; doubles each attempt up to `maxDelayMs`. */
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Keepalive interval; `0` disables the ping timer. */
  pingIntervalMs?: number;
  /** Injectable for tests. Defaults to the global `WebSocket`. */
  webSocketFactory?: (url: string) => WebSocket;
}

const DEFAULTS = {
  maxRetries: 8,
  baseDelayMs: 500,
  maxDelayMs: 8_000,
  pingIntervalMs: 25_000,
};

/** `WebSocket.readyState` values (avoids depending on the global class). */
const CONNECTING = 0;
const OPEN = 1;

/**
 * WebSocket client for a single meeting room.
 *
 * - Buffers sends until the socket opens.
 * - Pings on an interval for keepalive.
 * - Reconnects with exponential backoff after abnormal closes (network
 *   drops), but not after a deliberate `close()` or a clean server close
 *   (which follows contract errors like `MEETING_ENDED`).
 */
export class MeetingSocket {
  private ws: WebSocket | null = null;
  private retries = 0;
  private intentional = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private queue: ClientMessage[] = [];

  private readonly opts: Required<Omit<SocketOptions, "webSocketFactory">> &
    Pick<SocketOptions, "webSocketFactory">;

  constructor(
    private readonly meetingId: string,
    private readonly handlers: SocketHandlers,
    options: SocketOptions = {}
  ) {
    this.opts = {
      maxRetries: options.maxRetries ?? DEFAULTS.maxRetries,
      baseDelayMs: options.baseDelayMs ?? DEFAULTS.baseDelayMs,
      maxDelayMs: options.maxDelayMs ?? DEFAULTS.maxDelayMs,
      pingIntervalMs: options.pingIntervalMs ?? DEFAULTS.pingIntervalMs,
      webSocketFactory: options.webSocketFactory,
    };
  }

  connect(): void {
    this.clearTimers();
    this.intentional = false;
    this.retries = 0;
    this.handlers.onStatus("connecting");
    this.open();
  }

  /** Reconnect after the client gave up (user-triggered). */
  reconnect(): void {
    if (
      this.ws &&
      (this.ws.readyState === OPEN || this.ws.readyState === CONNECTING)
    ) {
      return;
    }
    this.connect();
  }

  send(message: ClientMessage): void {
    if (this.ws && this.ws.readyState === OPEN) {
      this.ws.send(JSON.stringify(message));
      return;
    }
    this.queue.push(message);
  }

  close(): void {
    this.intentional = true;
    this.clearTimers();
    this.queue = [];
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.handlers.onStatus("disconnected");
  }

  private open(): void {
    const factory =
      this.opts.webSocketFactory ?? ((url: string) => new WebSocket(url));
    let ws: WebSocket;
    try {
      ws = factory(meetingWsUrl(this.meetingId));
    } catch {
      this.scheduleRetry();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.retries = 0;
      this.handlers.onStatus("connected");
      this.startPing();
      const pending = this.queue.splice(0);
      for (const message of pending) {
        ws.send(JSON.stringify(message));
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (
        parsed &&
        typeof parsed === "object" &&
        "type" in parsed &&
        typeof (parsed as { type: unknown }).type === "string"
      ) {
        this.handlers.onMessage(parsed as ServerMessage);
      }
    };

    ws.onerror = () => {
      /* `onclose` always follows; recovery lives there. */
    };

    ws.onclose = (event: CloseEvent) => {
      this.stopPing();
      this.ws = null;
      if (this.intentional) {
        this.handlers.onStatus("disconnected");
        return;
      }
      // A clean close (1000) follows a contract error the app already saw.
      if (event.code === 1000) {
        this.handlers.onStatus("disconnected");
        return;
      }
      this.scheduleRetry();
    };
  }

  private scheduleRetry(): void {
    if (this.retries >= this.opts.maxRetries) {
      this.handlers.onStatus("disconnected");
      return;
    }
    const delay = Math.min(
      this.opts.baseDelayMs * 2 ** this.retries,
      this.opts.maxDelayMs
    );
    this.retries += 1;
    this.handlers.onStatus("reconnecting");
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.intentional) return;
      this.open();
    }, delay);
  }

  private startPing(): void {
    if (this.opts.pingIntervalMs <= 0) return;
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, this.opts.pingIntervalMs);
  }

  private stopPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private clearTimers(): void {
    this.stopPing();
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }
}
