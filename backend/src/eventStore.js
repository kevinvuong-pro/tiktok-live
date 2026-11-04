import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultDataDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
);

class EventStore {
  constructor({ dataDir = defaultDataDir } = {}) {
    this.dataDir = dataDir;
    this.filePath = null;
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
    let filePath = path.join(this.dataDir, `${timestamp}.json`);

    while (true) {
      try {
        await fs.access(filePath);
        timestamp += 1;
        filePath = path.join(this.dataDir, `${timestamp}.json`);
      } catch (error) {
        if (error.code === "ENOENT") break;
        throw error;
      }
    }

    this.filePath = filePath;
    this.events = [];
    this.writeQueue = Promise.resolve();
    await this.writeSessionFile();

    return this.filePath;
  }

  append(event) {
    this.writeQueue = this.writeQueue.then(async () => {
      if (!this.initialized || !this.filePath) {
        throw new Error("EventStore chưa có phiên lưu trữ");
      }

      this.events.push(event);
      try {
        await this.writeSessionFile();
      } catch (error) {
        this.events.pop();
        throw error;
      }
    });

    return this.writeQueue;
  }

  async writeSessionFile() {
    const tempPath = `${this.filePath}.tmp`;
    const content = `${JSON.stringify(this.events, null, 2)}\n`;

    try {
      await fs.writeFile(tempPath, content, "utf8");
      await fs.rename(tempPath, this.filePath);
    } catch (error) {
      await fs.unlink(tempPath).catch(() => {});
      throw error;
    }
  }

  async flush() {
    await this.writeQueue;
  }

  resetSession() {
    this.events = [];
    this.filePath = null;
    this.writeQueue = Promise.resolve();
  }

  getEvents() {
    return [...this.events];
  }
}

export default EventStore;
