const express = require("express");
const router = express.Router();
const CallLog = require("../Model/CallLogModel");

// Store received call data: date, time, phone_number, id_number, service_number
router.post("/", async (req, res) => {
  try {
    const { date, time, phone_number, id_number, service_number, token } = req.body || {};
    if (!date || !time || !phone_number) {
      return res.status(400).json({ message: "date, time, and phone_number are required" });
    }
    const doc = await CallLog.create({
      date: String(date),
      time: String(time),
      phone_number: String(phone_number || ""),
      id_number: String(id_number || ""),
      service_number: String(service_number || ""),
      token: String(token || ""),
    });
    return res.status(201).json({ message: "stored", id: doc._id });
  } catch (err) {
    console.error("/calllogs error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// List recent call logs for dashboard use
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const docs = await CallLog.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return res.json({ calllogs: docs });
  } catch (err) {
    console.error("/calllogs GET error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
