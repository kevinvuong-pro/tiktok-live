import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultDataDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
);

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${date.getFullYear()}`;
}

function normalizeEventType(type) {
  const value = String(type || "unknown")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^[^a-zA-Z0-9_-]+|[^a-zA-Z0-9_-]+$/g, "");

  return value || "unknown";
}

class EventStore {
  constructor({ dataDir = defaultDataDir } = {}) {
    this.dataDir = dataDir;
    this.sessionTimestamp = null;
    this.sessionDate = null;
    this.events = [];
    this.writeQueue = Promise.resolve();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) {
      return this.events;
    }

    await fs.mkdir(this.dataDir, { recursive: true });
    this.initialized = true;
    return this.events;
  }

  async startSession() {
    await this.init();

    let timestamp = Date.now();
    if (this.sessionTimestamp !== null && timestamp <= this.sessionTimestamp) {
      timestamp = this.sessionTimestamp + 1;
    }
    let date = new Date(timestamp);
    let filePath = this.getFilePath(date, "session");

    while (await this.pathExists(filePath)) {
      timestamp += 1;
      date = new Date(timestamp);
      filePath = this.getFilePath(date, "session");
    }

    this.sessionTimestamp = timestamp;
    this.sessionDate = formatDate(date);
    this.events = [];
    this.writeQueue = Promise.resolve();

    await fs.mkdir(path.join(this.dataDir, this.sessionDate), {
      recursive: true,
    });

    return this.getSessionPath();
  }

  append(event) {
    this.writeQueue = this.writeQueue.then(async () => {
      if (!this.initialized || this.sessionTimestamp === null) {
        throw new Error("EventStore chưa có phiên lưu trữ");
      }

      const eventType = normalizeEventType(event?.type);
      const filePath = this.getFilePath(new Date(this.sessionTimestamp), eventType);
      const line = `${JSON.stringify(event)}\n`;

      this.events.push(event);
      try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.appendFile(filePath, line, "utf8");
      } catch (error) {
        this.events.pop();
        throw error;
      }
    });

    return this.writeQueue;
  }

  getFilePath(date, eventType) {
    const dateFolder = formatDate(date);
    return path.join(
      this.dataDir,
      dateFolder,
      normalizeEventType(eventType),
      `${this.sessionTimestamp ?? date.getTime()}.jsonl`,
    );
  }

  getSessionPath() {
    return path.join(
      this.dataDir,
      this.sessionDate,
      "<event-type>",
      `${this.sessionTimestamp}.jsonl`,
    );
  }

  async pathExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  }

  async flush() {
    await this.writeQueue;
  }

  resetSession() {
    this.sessionTimestamp = null;
    this.sessionDate = null;
    this.events = [];
    this.writeQueue = Promise.resolve();
  }

  getEvents() {
    return [...this.events];
  }
}

export { normalizeEventType };
export default EventStore;
