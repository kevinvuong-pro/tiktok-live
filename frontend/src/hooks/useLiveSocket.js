import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const MAX_EVENTS = 500;
const MAX_SEEN_IDS = 3000;

function toEventList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function useLiveSocket() {
  const [status, setStatus] = useState({
    status: "disconnected",
    username: null,
    eventCount: 0,
  });

  const [events, setEvents] = useState([]);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");

  const lastEventIdRef = useRef(null);
  const lastSequenceRef = useRef(0);

  const seenIdsRef = useRef(new Set());
  const pendingEventsRef = useRef([]);
  const isSyncingRef = useRef(false);
  const syncGenerationRef = useRef(0);
  const socketRef = useRef(null);

  const resetEventState = useCallback(() => {
    syncGenerationRef.current += 1;
    lastEventIdRef.current = null;
    lastSequenceRef.current = 0;
    seenIdsRef.current = new Set();
    pendingEventsRef.current = [];
    isSyncingRef.current = false;
    setEvents([]);
    setRoom(null);
  }, []);

  const ingestEvents = useCallback((incoming, { reset = false } = {}) => {
    const incomingEvents = toEventList(incoming);

    if (reset) {
      seenIdsRef.current = new Set();
      lastSequenceRef.current = 0;
      lastEventIdRef.current = null;
    }

    const seen = seenIdsRef.current;
    const accepted = [];

    for (const event of incomingEvents) {
      if (!event?.id || seen.has(event.id)) continue;

      seen.add(event.id);
      accepted.push(event);

      const sequence = Number(event.sequence || 0);

      if (sequence >= lastSequenceRef.current) {
        lastSequenceRef.current = sequence;
        lastEventIdRef.current = event.id;
      }
    }

    while (seen.size > MAX_SEEN_IDS) {
      const oldestId = seen.values().next().value;
      seen.delete(oldestId);
    }

    if (!reset && accepted.length === 0) {
      return;
    }

    setEvents((prev) => {
      const merged = reset ? accepted : [...accepted, ...prev];

      merged.sort(
        (a, b) => Number(b.sequence || 0) - Number(a.sequence || 0),
      );

      return merged.slice(0, MAX_EVENTS);
    });
  }, []);

  const fetchMissedEvents = useCallback(async (cursor) => {
    const params = new URLSearchParams();

    if (cursor) {
      params.set("lastEventId", cursor);
    }

    const query = params.toString();
    const response = await fetch(
      `${URL}/api/events${query ? `?${query}` : ""}`,
    );
    const result = await response.json();

    if (!response.ok || !result?.success) {
      throw new Error(result?.message || "Unable to sync events");
    }

    return result.data;
  }, []);

  const finishSync = useCallback(
    (generation, result) => {
      if (generation !== syncGenerationRef.current) {
        return;
      }

      const pending = pendingEventsRef.current;
      pendingEventsRef.current = [];
      isSyncingRef.current = false;

      ingestEvents([...toEventList(result?.events), ...pending], {
        reset: Boolean(result?.resetRequired),
      });
    },
    [ingestEvents],
  );

  const syncEvents = useCallback(
    (socket) => {
      const generation = ++syncGenerationRef.current;

      isSyncingRef.current = true;
      pendingEventsRef.current = [];

      const cursor = lastEventIdRef.current;

      socket.timeout(10000).emit("live:sync", cursor, async (err, response) => {
        if (generation !== syncGenerationRef.current) {
          return;
        }

        try {
          if (err || !response?.success) {
            const data = await fetchMissedEvents(cursor);
            finishSync(generation, data);
            return;
          }

          finishSync(generation, response.data);
        } catch (error) {
          if (generation !== syncGenerationRef.current) {
            return;
          }

          const pending = pendingEventsRef.current;
          pendingEventsRef.current = [];
          isSyncingRef.current = false;

          ingestEvents(pending);
          setError(error?.message || "Event sync failed");
        }
      });
    },
    [fetchMissedEvents, finishSync, ingestEvents],
  );

  useEffect(() => {
    const socket = io(URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      syncEvents(socket);
    });

    socket.on("live:status", (data) => {
      setStatus(data);

      if (data?.status === "disconnected") {
        resetEventState();
      }
    });

    socket.on("live:room", (data) => {
      setRoom(data);
    });

    socket.on("live:event", (event) => {
      if (isSyncingRef.current) {
        pendingEventsRef.current.push(event);
        return;
      }

      ingestEvents([event]);
    });

    socket.on("live:error", (data) => {
      setError(data?.message || "TikTok connection error");
    });

    socket.on("live:connected", () => {
      setError("");
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket] Connect error:", err);
      setError(err.message || "Socket connection error");
    });

    socket.on("disconnect", () => {
      syncGenerationRef.current += 1;
      isSyncingRef.current = false;
      pendingEventsRef.current = [];
    });

    return () => {
      syncGenerationRef.current += 1;
      socket.removeAllListeners();
      socket.disconnect();

      socketRef.current = null;
      isSyncingRef.current = false;
      pendingEventsRef.current = [];
    };
  }, [ingestEvents, resetEventState, syncEvents]);

  async function connect(username) {
    setError("");

    try {
      const response = await fetch(`${URL}/api/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to connect");
      }

      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  async function disconnect() {
    try {
      const response = await fetch(`${URL}/api/disconnect`, {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to disconnect");
      }

      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  return {
    status,
    events,
    room,
    error,
    connect,
    disconnect,
  };
}
