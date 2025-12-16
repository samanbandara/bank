const express = require("express");
const router = express.Router();
const Sms = require("../Model/SmsModel");

router.post("/", async (req, res) => {
  try {
    const { sender, received_time, message, storage } = req.body || {};
    if (!sender) {
      return res.status(400).json({ message: "sender is required" });
    }
    const doc = await Sms.create({
      sender,
      received_time: received_time || "",
      message: message || "",
      storage: storage || "",
    });
    return res.status(201).json({ message: "stored", id: doc._id });
  } catch (err) {
    console.error("/sms error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// List recent SMS messages for dashboard use
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const docs = await Sms.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return res.json({ sms: docs });
  } catch (err) {
    console.error("/sms GET error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Delete a single SMS by id
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "id is required" });
    const result = await Sms.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ message: "SMS not found" });
    return res.json({ message: "deleted" });
  } catch (err) {
    console.error("/sms DELETE error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
