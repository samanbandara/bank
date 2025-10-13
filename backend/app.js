const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const router = require("./Route/CounterRoute");
const authRouter = require("./Route/AuthRoute");
const serviceRouter = require("./Route/ServiceRoute");
const customerRouter = require("./Route/CustomerRoute");

const app = express();
const cors = require("cors");

app.use(express.json());
app.use(cors());
app.use("/counters", router);
app.use("/auth", authRouter);
app.use("/services", serviceRouter);
app.use("/customers", customerRouter);

// Connect to MongoDB
mongoose
  .connect(
    "mongodb+srv://samanbandara10360_db_user:SEFKnKECYxUy9BRi@cluster0.5mrgcew.mongodb.net/counters"
  )
  .then(() => {
    console.log("MongoDB connected");
    app.listen(5000, "0.0.0.0", () => {
      console.log("Server is running on http://0.0.0.0:5000 (LAN accessible)");
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

//console.log("Hello World");

// Serve frontend build (production) on the same port (5000)
// This should come AFTER API routes so API calls are not intercepted.
try {
  const buildPath = path.join(__dirname, "..", "frontend", "build");
  app.use(express.static(buildPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(buildPath, "index.html"));
  });
} catch (_) {
  // If build folder doesn't exist (dev mode), ignore.
}
