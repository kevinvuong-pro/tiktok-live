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

test("tạo file JSON theo từng phiên và khôi phục đúng dữ liệu trên đĩa", async () => {
  const store = await createStore();
  const filePath = await store.startSession();

  assert.match(path.basename(filePath), /^\d+\.json$/);

  await store.append({ id: "event-1", type: "chat" });
  await store.flush();

  assert.deepEqual(JSON.parse(await fs.readFile(filePath, "utf8")), [
    { id: "event-1", type: "chat" },
  ]);
});

test("mỗi phiên tạo một file JSON mới và không xóa phiên trước", async () => {
  const store = await createStore();
  const firstFile = await store.startSession();
  await store.append({ id: "event-1" });
  await store.flush();

  const secondFile = await store.startSession();
  await store.append({ id: "event-2" });
  await store.flush();

  assert.notEqual(firstFile, secondFile);
  assert.deepEqual(JSON.parse(await fs.readFile(firstFile, "utf8")), [
    { id: "event-1" },
  ]);
  assert.deepEqual(JSON.parse(await fs.readFile(secondFile, "utf8")), [
    { id: "event-2" },
  ]);
});

test("flush chờ toàn bộ event được ghi", async () => {
  const store = await createStore();
  await store.startSession();

  await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      store.append({ id: `event-${index + 1}` }),
    ),
  );
  await store.flush();

  assert.equal(store.getEvents().length, 20);
});
