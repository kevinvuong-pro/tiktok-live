import { test } from "node:test";
import assert from "node:assert/strict";

import { selectEventData } from "../eventData.js";

test("chỉ giữ các field cần thiết để hiển thị event", () => {
  const result = selectEventData("chat", {
    comment: "Xin chào",
    user: {
      uniqueId: "viewer_1",
      nickname: "Viewer",
      avatarThumb: "https://example.test/avatar.jpg",
      secretInternalField: "remove me",
    },
    common: {
      signature: "large payload",
      roomId: "room-1",
    },
    content: "duplicate",
  });

  assert.deepEqual(result, {
    user: {
      uniqueId: "viewer_1",
      nickname: "Viewer",
      avatar: "https://example.test/avatar.jpg",
    },
    comment: "Xin chào",
    room: { roomId: "room-1" },
  });
  assert.equal(JSON.stringify(result).includes("large payload"), false);
  assert.equal(JSON.stringify(result).includes("secretInternalField"), false);
});
