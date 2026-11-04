import { randomUUID } from "node:crypto";
import {
  TikTokLiveConnection,
  WebcastEvent,
  ControlEvent,
} from "tiktok-live-connector";
import EventStore from "./eventStore.js";
import { extractUsername } from "./utils.js";
import { selectEventData } from "./eventData.js";

const MAX_EVENT_BUFFER = 2000;
const RECONNECT_BASE_DELAY = 2000;
const RECONNECT_MAX_DELAY = 30000;
const DIAGNOSTIC_DELAY_MS = 50;

class LiveManager {
  constructor(io) {
    this.io = io;

    this.connection = null;
    this.username = null;
    this.status = "disconnected";
    this.roomInfo = null;

    this.eventBuffer = [];
    this.eventSequence = 0;

    this.manualDisconnect = false;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.connectionGeneration = 0;
    this.dispatchedPayloads = new WeakSet();
    this.eventStore = new EventStore();

    this.initializationPromise = null;
  }

  async initialize() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      await this.eventStore.init();
      return this.eventBuffer;
    })();

    try {
      return await this.initializationPromise;
    } catch (error) {
      this.initializationPromise = null;
      throw error;
    }
  }

  emitStatus() {
    this.io.emit("live:status", this.getStatus());
  }

  getStatus() {
    return {
      status: this.status,
      username: this.username,
      eventCount: this.eventBuffer.length,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  addEvent(type, data) {
    const event = {
      id: randomUUID(),
      sequence: ++this.eventSequence,
      type,
      username: this.username,
      timestamp: Date.now(),
      data: selectEventData(type, data),
    };

    this.eventBuffer.push(event);

    if (this.eventBuffer.length > MAX_EVENT_BUFFER) {
      this.eventBuffer.shift();
    }

    this.eventStore.append(event).catch((error) => {
      console.error("[LiveManager] Failed to persist event:", error);
    });

    this.io.emit("live:event", event);

    return event;
  }

  getEventsSince(lastEventId) {
    if (!lastEventId) {
      return {
        events: this.eventBuffer.slice(),
        resetRequired: false,
      };
    }

    const index = this.eventBuffer.findIndex(
      (event) => event.id === lastEventId,
    );

    if (index === -1) {
      return {
        events: this.eventBuffer.slice(),
        resetRequired: true,
      };
    }

    return {
      events: this.eventBuffer.slice(index + 1),
      resetRequired: false,
    };
  }

  markDispatched(data) {
    if (!data || typeof data !== "object") {
      return;
    }

    this.dispatchedPayloads.add(data);
  }

  registerDiagnostics(connection) {
    if (!ControlEvent.DECODED_DATA) {
      return;
    }

    connection.on(ControlEvent.DECODED_DATA, (method, decodedData) => {
      const payload = decodedData?.data;

      if (!payload || typeof payload !== "object") {
        return;
      }

      setTimeout(() => {
        if (this.connection !== connection || this.manualDisconnect) {
          return;
        }

        if (this.dispatchedPayloads.has(payload)) {
          return;
        }

        this.addEvent(`decoded:${method}`, payload);
      }, DIAGNOSTIC_DELAY_MS);
    });
  }

  registerEvents(connection) {
    const eventNames = [...new Set(Object.values(WebcastEvent))];

    for (const eventName of eventNames) {
      connection.on(eventName, (data) => {
        if (this.connection !== connection || this.manualDisconnect) {
          return;
        }

        this.markDispatched(data);
        this.addEvent(eventName, data);
      });
    }
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  scheduleReconnect() {
    if (this.manualDisconnect || !this.username) return;
    if (this.reconnectTimer) return;
    if (this.status === "connected" || this.status === "connecting") return;

    const delay = Math.min(
      RECONNECT_BASE_DELAY * 2 ** this.reconnectAttempts,
      RECONNECT_MAX_DELAY,
    );

    this.reconnectAttempts += 1;
    this.status = "reconnecting";

    this.emitStatus();

    console.log(
      `[TikTok] Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts})`,
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;

      if (this.manualDisconnect || !this.username) return;

      try {
        await this.connectAttempt(this.username, true);
      } catch (error) {
        console.error("[TikTok] Reconnect failed:", error.message);
        this.scheduleReconnect();
      }
    }, delay);
  }

  async connectAttempt(username, isReconnect = false) {
    const generation = ++this.connectionGeneration;

    this.status = isReconnect ? "reconnecting" : "connecting";
    this.emitStatus();

    const previousConnection = this.connection;
    const connection = new TikTokLiveConnection(username, {
      processInitialData: true,
    });

    this.connection = connection;

    if (previousConnection) {
      previousConnection.disconnect().catch(() => {});
    }

    this.registerEvents(connection);
    this.registerDiagnostics(connection);

    connection.on(ControlEvent.ERROR, (error) => {
      if (this.connection !== connection) return;

      const message =
        error?.exception?.message ||
        error?.info ||
        error?.message ||
        "TikTok connection error";

      console.error("[TikTok] Connection error:", message);

      this.io.emit("live:error", {
        message: String(message),
      });
    });

    connection.on(ControlEvent.DISCONNECTED, (details) => {
      if (this.connection !== connection || this.manualDisconnect) {
        return;
      }

      console.warn("[TikTok] Disconnected:", details);

      this.connection = null;
      this.status = "reconnecting";

      this.io.emit("live:error", {
        message: "TikTok LIVE connection lost. Reconnecting...",
      });

      this.scheduleReconnect();
    });

    try {
      const state = await connection.connect();

      if (
        generation !== this.connectionGeneration ||
        this.manualDisconnect ||
        this.connection !== connection
      ) {
        await connection.disconnect().catch(() => {});
        return null;
      }

      this.reconnectAttempts = 0;
      this.status = "connected";

      this.roomInfo = state?.roomInfo || null;

      this.emitStatus();

      if (this.roomInfo) {
        this.io.emit("live:room", this.roomInfo);
      }

      this.io.emit("live:connected", {
        username,
        roomId: state?.roomId || null,
      });

      console.log(`[TikTok] Connected to @${username}`);

      return state;
    } catch (error) {
      if (
        generation !== this.connectionGeneration ||
        this.connection !== connection
      ) {
        return null;
      }

      this.connection = null;

      await connection.disconnect().catch(() => {});

      this.status = isReconnect ? "reconnecting" : "error";
      this.emitStatus();

      throw error;
    }
  }

  async connect(input) {
    await this.initialize();

    const username = extractUsername(input);

    if (this.username === username && this.status === "connected") {
      return this.getStatus();
    }

    await this.disconnect();

    this.manualDisconnect = false;
    this.username = username;
    this.reconnectAttempts = 0;
    this.roomInfo = null;
    this.eventBuffer = [];
    this.eventSequence = 0;
    await this.eventStore.startSession();

    try {
      const state = await this.connectAttempt(this.username, false);

      if (this.manualDisconnect || this.username !== username) {
        throw new Error("Kết nối đã bị hủy");
      }

      if (this.status !== "connected") {
        throw new Error("Unable to connect to TikTok LIVE");
      }

      return state;
    } catch (error) {
      if (this.manualDisconnect || this.username !== username) {
        throw error;
      }

      if (this.connection) {
        throw error;
      }

      this.status = "error";
      this.emitStatus();
      this.scheduleReconnect();

      throw error;
    }
  }

  async disconnect() {
    this.manualDisconnect = true;

    this.clearReconnectTimer();

    this.connectionGeneration += 1;

    const connection = this.connection;

    this.connection = null;
    this.username = null;
    this.roomInfo = null;
    this.reconnectAttempts = 0;
    this.status = "disconnected";
    this.eventBuffer = [];

    this.emitStatus();

    if (connection) {
      try {
        await connection.disconnect();
      } catch (error) {
        console.warn("[TikTok] Disconnect warning:", error.message);
      }
    }
    await this.eventStore.flush();
    this.eventStore.resetSession();

    return { success: true };
  }

}

export { LiveManager };
