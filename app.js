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
  const connectionState = mongoose.connection.readyState;
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting"
  };
  
  res.status(200).json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    mongodb: {
      state: states[connectionState] || "unknown",
      readyState: connectionState,
      connected: connectionState === 1,
      host: mongoose.connection.host || "N/A",
      name: mongoose.connection.name || "N/A"
    },
    mongo_uri_set: !!process.env.MONGO_URI
  });
});

// Serve static files - use the same path as multer uploads
// This matches the path used in userRoutes.js: path.resolve(__dirname, "../../../uploads")
const uploadsPath = path.resolve(__dirname, "uploads");

if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
  console.log(`✅ Created uploads directory: ${uploadsPath}`);
}

app.use("/uploads", express.static(uploadsPath));
console.log(`✅ Static file serving enabled for uploads: ${uploadsPath}`);

// MongoDB connection (non-blocking)
const URL = process.env.MONGO_URI || "mongodb://localhost:27017/jobvibes";
mongoose.set("strictQuery", false);

// Track connection attempts
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS_LOG = 10;

async function connectDB() {
  // Don't reconnect if already connected or connecting
  if (mongoose.connection.readyState === 1) {
    console.log("✅ MongoDB already connected");
    return;
  }
  if (mongoose.connection.readyState === 2) {
    console.log("⏳ MongoDB connection in progress, skipping...");
    return;
  }

  connectionAttempts++;
  if (connectionAttempts <= MAX_CONNECTION_ATTEMPTS_LOG) {
    console.log(`🔌 Attempting MongoDB connection (attempt ${connectionAttempts})...`);
    console.log(`📍 Connection string: ${URL.substring(0, 20)}...${URL.length > 20 ? '***' : ''}`);
  }

  try {
    // Close existing connection if any before reconnecting
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }

    await mongoose.connect(URL, {
      serverSelectionTimeoutMS: 30000, // Timeout after 30s
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      maxPoolSize: 10,
      minPoolSize: 1,
    });
    
    connectionAttempts = 0; // Reset on success
    console.log("✅ MongoDB connected successfully");
    console.log(`📊 Connection state: ${getConnectionState(mongoose.connection.readyState)}`);
  } catch (err) {
    if (connectionAttempts <= MAX_CONNECTION_ATTEMPTS_LOG) {
      console.error("❌ DB Connection ERROR:", err.message);
      console.error("❌ Error details:", err.name, err.code);
    }
    console.log(`⏳ Retrying MongoDB connection in 5s... (attempt ${connectionAttempts})`);
    setTimeout(connectDB, 5000);
  }
}

function getConnectionState(state) {
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting"
  };
  return states[state] || "unknown";
}

// Start MongoDB connection (non-blocking, server will start regardless)
if (process.env.MONGO_URI) {
  console.log("🔧 MONGO_URI detected, initializing MongoDB connection...");
  
  // Set up connection event listeners BEFORE connecting
  mongoose.connection.on("connected", () => {
    console.log("✅ MongoDB connection event: connected");
  });

  mongoose.connection.on("error", (err) => {
    console.error("❌ MongoDB connection error event:", err.message);
  });

  mongoose.connection.on("disconnected", () => {
    console.error("⚠️ MongoDB disconnected event - will attempt reconnection");
    // Don't reconnect here, let the retry logic handle it
  });

  mongoose.connection.on("reconnected", () => {
    console.log("🔄 MongoDB reconnected");
  });

  // Start connection
  connectDB();
} else {
  console.log("⚠️ MONGO_URI not set, skipping MongoDB connection");
  console.log("⚠️ Server will start but database operations will fail");
}

// Start server FIRST (before loading routes)
// Cloud Run provides PORT environment variable (defaults to 8080 for Cloud Run, 3000 for local)
const PORT = process.env.PORT || process.env.NODE_PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0"; // Listen on all interfaces for Cloud Run

console.log(`🔧 Starting server...`);
console.log(`🔧 PORT environment variable: ${process.env.PORT || "not set"}`);
console.log(`🔧 Using PORT: ${PORT}, HOST: ${HOST}`);

let server;
let serverStarted = false;

try {
  server = app.listen(PORT, HOST, () => {
    serverStarted = true;
    console.log(`🚀 Server running on ${HOST}:${PORT}`);
    console.log(`📡 Health check available at http://${HOST}:${PORT}/health`);
    console.log(`✅ Server is ready to accept connections`);
    
    // Load routes AFTER server starts (non-blocking)
    loadRoutes();
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
  console.error("❌ Error details:", err.stack);
  process.exit(1);
}

// Load routes asynchronously after server starts
function loadRoutes() {
  console.log("📦 Loading API routes...");
  try {
    const router = require("./src/api/router");
    app.use("/api", router);
    console.log("✅ API routes loaded successfully");
  } catch (err) {
    console.error("❌ Error loading routes:", err.message);
    console.error("❌ Route error stack:", err.stack);
    // Add a fallback route
    app.use("/api", (req, res) => {
      res.status(503).json({ 
        error: "API routes not available", 
        message: err.message,
        timestamp: new Date().toISOString()
      });
    });
  }
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
  console.error("💥 Stack:", err.stack);
  // Only exit if server hasn't started yet
  if (!serverStarted) {
    console.error("💥 Server not started yet, exiting...");
    process.exit(1);
  } else {
    console.error("💥 Server already started, logging error but continuing...");
  }
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection at:", promise);
  console.error("💥 Reason:", reason);
  // Don't exit on unhandled rejection - log it but keep server running
  // This is especially important during startup when MongoDB might fail
  if (!serverStarted) {
    console.error("💥 Server not started yet, but continuing anyway...");
  }
});
