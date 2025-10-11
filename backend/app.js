const express = require("express");
const mongoose = require("mongoose");
const router = require("./Route/CounterRoute");
const authRouter = require("./Route/AuthRoute");
const serviceRouter = require("./Route/ServiceRoute");

const app = express();
const cors = require("cors");

app.use(express.json());
app.use(cors());
app.use("/counters", router);
app.use("/auth", authRouter);
app.use("/services", serviceRouter);

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/counters")
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
