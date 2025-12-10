require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
const fs = require("fs");

const app = express();

// Enable CORS
app.use(cors());

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({ 
    message: "JobVibes API Server", 
    status: "running",
    timestamp: new Date().toISOString() 
  });
});

// Health check endpoint for Cloud Run
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

// Serve static files (only if directory exists)
const uploadsPath = path.resolve("src/uploads");
if (fs.existsSync(uploadsPath)) {
  app.use("/uploads", express.static(uploadsPath));
} else {
  console.log("⚠️ Uploads directory not found, skipping static file serving");
}

// MongoDB connection (non-blocking)
const URL = process.env.MONGO_URI || "mongodb://localhost:27017/jobvibes";
mongoose.set("strictQuery", false);

async function connectDB() {
  try {
    await mongoose.connect(URL, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000,
    });
    console.log("--- MongoDB connected successfully ---");
  } catch (err) {
    console.error("--- DB Connection ERROR ---", err.message);
    console.log("⏳ Retrying MongoDB connection in 5s...");
    setTimeout(connectDB, 5000);
  }
}

// Start MongoDB connection (non-blocking, server will start regardless)
if (process.env.MONGO_URI) {
  connectDB();
  
  // Reconnect on disconnect/error
  mongoose.connection.on("disconnected", () => {
    console.error("⚠️ MongoDB disconnected! Reconnecting...");
    setTimeout(connectDB, 5000);
  });

  mongoose.connection.on("error", (err) => {
    console.error("❌ MongoDB error:", err.message);
  });
} else {
  console.log("⚠️ MONGO_URI not set, skipping MongoDB connection");
}

// Load routes with error handling
try {
  const router = require("./src/api/router");
  app.use("/api", router);
  console.log("✅ API routes loaded successfully");
} catch (err) {
  console.error("❌ Error loading routes:", err.message);
  // Add a fallback route
  app.use("/api", (req, res) => {
    res.status(503).json({ error: "API routes not available", message: err.message });
  });
}

// Start server
// Cloud Run provides PORT environment variable (defaults to 8080)
const PORT = process.env.PORT || process.env.NODE_PORT || 8080;
const HOST = process.env.HOST || "0.0.0.0"; // Listen on all interfaces for Cloud Run

console.log(`🔧 Starting server...`);
console.log(`🔧 PORT environment variable: ${process.env.PORT || "not set"}`);
console.log(`🔧 Using PORT: ${PORT}, HOST: ${HOST}`);

let server;
try {
  server = app.listen(PORT, HOST, () => {
    console.log(`🚀 Server running on ${HOST}:${PORT}`);
    console.log(`📡 Health check available at http://${HOST}:${PORT}/health`);
    console.log(`✅ Server is ready to accept connections`);
  });
  
  server.on("error", (err) => {
    console.error("❌ Server error:", err);
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use`);
    }
    process.exit(1);
  });
  
  // Verify server is listening
  server.on("listening", () => {
    const addr = server.address();
    console.log(`✅ Server listening on ${addr.address}:${addr.port}`);
  });
} catch (err) {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
}

// Graceful shutdown
async function cleanup(signal) {
  console.log(`\nReceived ${signal}, closing server...`);
  try {
    await mongoose.connection.close();
    console.log("✅ Mongoose connection closed.");
    server.close(() => {
      console.log("✅ Express server closed.");
      process.exit(0); // Render or PM2/systemd will restart
    });
  } catch (err) {
    console.error("❌ Error during shutdown:", err);
    process.exit(1);
  }
}

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => cleanup(signal));
});

// Crash handlers (let Render/PM2 restart the app)
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});
