import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";

import { LiveManager } from "./liveManager.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const frontendOrigin = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(
  cors({
    origin: frontendOrigin,
  }),
);

app.use(express.json());

const io = new Server(httpServer, {
  cors: {
    origin: frontendOrigin,
    methods: ["GET", "POST"],
  },
});

const live = new LiveManager(io);

app.get("/api/status", (req, res) => {
  res.json(live.getStatus());
});

// Lấy lại event bị thiếu
app.get("/api/events", (req, res) => {
  const lastEventId = req.query.lastEventId || null;

  res.json({
    success: true,
    data: live.getEventsSince(lastEventId),
  });
});

app.post("/api/connect", async (req, res) => {
  try {
    const result = await live.connect(req.body.username);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[API /connect] Full error:", error);

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

app.post("/api/disconnect", async (req, res) => {
  await live.disconnect();

  res.json({
    success: true,
    data: live.getStatus(),
  });
});

io.on("connection", (socket) => {
  socket.emit("live:status", live.getStatus());

  socket.on("live:sync", (lastEventId, callback) => {
    const ack =
      typeof callback === "function"
        ? callback
        : () => {};

    try {
      const result = live.getEventsSince(lastEventId);

      ack({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("[Socket] Sync failed:", error);

      ack({
        success: false,
        message: error.message,
      });
    }
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    ...live.getStatus(),
  });
});

const PORT = process.env.PORT || 3000;

let isShuttingDown = false;

async function startServer() {
  try {
    await live.initialize();

    // Không mở server nếu đã nhận tín hiệu shutdown.
    if (isShuttingDown) return;

    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`[Server] Restored ${live.eventBuffer.length} events`);
    });
  } catch (error) {
    console.error("[Server] Failed to initialize:", error);
    process.exit(1);
  }
}

async function shutdown(signal) {
  if (isShuttingDown) return;

  isShuttingDown = true;
  console.log(`\n[Server] Received ${signal}, shutting down...`);

  const forceExit = setTimeout(() => {
    console.error("[Server] Shutdown timed out");
    process.exit(1);
  }, 8000);

  forceExit.unref?.();

  try {
    await live.disconnect();
    await live.eventStore.flush();

    await new Promise((resolve, reject) => {
      io.close();
      httpServer.close((error) => {
        if (error && error.code !== "ERR_SERVER_NOT_RUNNING") {
          reject(error);
          return;
        }

        resolve();
      });
    });

    clearTimeout(forceExit);
    console.log("[Server] Shutdown complete");
    process.exit(0);
  } catch (error) {
    console.error("[Server] Shutdown error:", error);
    clearTimeout(forceExit);
    process.exit(1);
  }
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

startServer();
