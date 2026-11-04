import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import EventStore from "../eventStore.js";

const tempDirs = [];

async function createStore() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tiktok-event-store-"));
  tempDirs.push(dir);

  const store = new EventStore({ dataDir: dir });
  await store.init();
  return store;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) =>
      fs.rm(dir, { recursive: true, force: true }),
    ),
  );
});

test("phân event vào file JSONL theo ngày và type", async () => {
  const store = await createStore();
  await store.startSession();

  await Promise.all([
    store.append({ id: "event-1", type: "chat" }),
    store.append({ id: "event-2", type: "gift" }),
    store.append({ id: "event-3", type: "chat" }),
  ]);
  await store.flush();

  const dateFolder = (await fs.readdir(tempDirs[0]))[0];
  assert.match(dateFolder, /^\d{2}-\d{2}-\d{4}$/);

  const sessionTimestamp = store.sessionTimestamp;
  const chatPath = path.join(
    tempDirs[0],
    dateFolder,
    "chat",
    `${sessionTimestamp}.jsonl`,
  );
  const giftPath = path.join(
    tempDirs[0],
    dateFolder,
    "gift",
    `${sessionTimestamp}.jsonl`,
  );

  assert.deepEqual(
    (await fs.readFile(chatPath, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line).id),
    ["event-1", "event-3"],
  );
  assert.deepEqual(
    (await fs.readFile(giftPath, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line).id),
    ["event-2"],
  );
});

test("mỗi phiên dùng timestamp riêng và giữ lại file phiên trước", async () => {
  const store = await createStore();

  await store.startSession();
  await store.append({ id: "event-1", type: "chat" });
  await store.flush();
  const firstTimestamp = store.sessionTimestamp;

  await store.startSession();
  await store.append({ id: "event-2", type: "chat" });
  await store.flush();

  assert.notEqual(firstTimestamp, store.sessionTimestamp);
  const dateFolders = await fs.readdir(tempDirs[0]);
  const chatFiles = [];
  for (const dateFolder of dateFolders) {
    chatFiles.push(...(await fs.readdir(path.join(tempDirs[0], dateFolder, "chat"))));
  }

  assert.equal(chatFiles.length, 2);
  assert.ok(chatFiles.includes(`${firstTimestamp}.jsonl`));
  assert.ok(chatFiles.includes(`${store.sessionTimestamp}.jsonl`));
});

test("sanitize type không cho phép thoát khỏi thư mục dữ liệu", async () => {
  const store = await createStore();
  await store.startSession();
  await store.append({ id: "event-1", type: "../secret/type" });
  await store.flush();

  const dateFolder = (await fs.readdir(tempDirs[0]))[0];
  const eventFolders = await fs.readdir(path.join(tempDirs[0], dateFolder));
  assert.deepEqual(eventFolders, ["_secret_type"]);
});
