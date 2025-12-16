// ===================== IMPORT REQUIRED MODULES =====================
const express = require("express");     // Web framework for Node.js
const path = require("path");           // Helps handle file & folder paths
const mongoose = require("mongoose");   // MongoDB object modeling tool
const cors = require("cors");           // Allows cross-origin requests
const os = require("os");               // Provides OS/network information

// ===================== IMPORT ROUTES =====================
// Each route handles a specific feature of the system
const counterRouter = require("./Route/CounterRoute");
const authRouter = require("./Route/AuthRoute");
const serviceRouter = require("./Route/ServiceRoute");
const customerRouter = require("./Route/CustomerRoute");
const callRouter = require("./Route/CallRoute");
const deviceDataRouter = require("./Route/DeviceRoute");
const smsRouter = require("./Route/SmsRoute");
const callLogRouter = require("./Route/CallLogRoute");
const buttonRouter = require("./Route/ButtonRoute");
const bankScheduleRouter = require("./Route/BankScheduleRoute");

// Create Express application
const app = express();

/* ===================== GLOBAL MIDDLEWARE ===================== */

// Parse incoming JSON data (req.body)
app.use(express.json());

// Enable CORS so frontend can access backend APIs
app.use(cors());

// ===================== API ROUTES =====================
// All requests starting with these paths go to their respective routers

app.use("/counters", counterRouter);   // Counter management APIs
app.use("/auth", authRouter);           // Login / authentication APIs
app.use("/services", serviceRouter);    // Service-related APIs
app.use("/customers", customerRouter);  // Customer APIs
app.use("/calls", callRouter);           // Call / queue APIs
app.use("/device_data", deviceDataRouter); // Device telemetry ingest
app.use("/sms", smsRouter); // SMS ingest
app.use("/calllogs", callLogRouter); // Call log ingest
app.use("/buttons", buttonRouter); // Button device ingest
app.use("/bank-schedule", bankScheduleRouter); // Bank opening hours

/* ===================== GET LOCAL IP ADDRESS ===================== */
/*
 This function finds the local LAN IP address of the machine.
 Useful for accessing the backend from another device on the same network.
*/
function getLocalIP() {
  const interfaces = os.networkInterfaces();

  // Common network adapter names (Windows + Linux)
  const preferred = ["Wi-Fi", "Ethernet", "wlan0", "eth0"];

  // First try preferred adapters
  for (const name of preferred) {
    if (interfaces[name]) {
      for (const iface of interfaces[name]) {
        // Check for valid IPv4 address (not internal/loopback)
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }
  }

  // Fallback: scan all interfaces except virtual ones
  for (const name of Object.keys(interfaces)) {
    if (
      name.toLowerCase().includes("virtual") ||
      name.toLowerCase().includes("vmware") ||
      name.toLowerCase().includes("docker") ||
      name.toLowerCase().includes("bluetooth") ||
      name.toLowerCase().includes("loopback")
    ) {
      continue; // Skip virtual interfaces
    }

    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }

  // If nothing found, fallback to localhost
  return "localhost";
}

// Store detected local IP
const IP = getLocalIP();

/* ===================== MONGODB CONNECTION ===================== */
/*
 Connect to MongoDB Atlas using mongoose.
 Server starts only after successful DB connection.
*/
mongoose
  .connect(
    "mongodb+srv://samanbandara10360_db_user:SEFKnKECYxUy9BRi@cluster0.5mrgcew.mongodb.net/counters"
  )
  .then(() => {
    console.log("✅ MongoDB connected");

    // Use PORT from environment or default to 5000
    const PORT = process.env.PORT || 5000;

    // Start server and listen on all network interfaces
    app.listen(PORT, "0.0.0.0", () => {
      console.log("\n🚀 Server running at:");
      console.log(`➡ http://localhost:${PORT}`);
      console.log(`➡ http://${IP}:${PORT}\n`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });

/* ===================== SERVE FRONTEND BUILD ===================== */
/*
 Serves React frontend build files.
 If frontend is not built yet, the try/catch prevents crashes.
*/
try {
  // Path to React build folder
  const buildPath = path.join(__dirname, "..", "frontend", "build");

  // Serve static files (JS, CSS, images)
  app.use(express.static(buildPath));

  // For React Router: return index.html for any unknown route
  app.get("*", (req, res) => {
    res.sendFile(path.join(buildPath, "index.html"));
  });
} catch (err) {
  // Ignore error if frontend build does not exist
}
