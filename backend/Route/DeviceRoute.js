const express = require("express");
const router = express.Router();
const DeviceData = require("../Model/DeviceDataModel");

// Map SIM registration codes to human-readable meanings
function regMeaning(code) {
  const map = {
    "0": "Not registered, not searching",
    "1": "Registered, home network",
    "2": "Not registered, searching",
    "3": "Registration denied",
    "4": "Unknown",
    "5": "Registered, roaming",
  };
  return map[code] || String(code || "");
}

function dataMeaning(code) {
  if (code === "1" || code === 1) return "Attached";
  if (code === "0" || code === 0) return "Detached";
  return String(code || "");
}

function rsriToRssiDbm(rsri) {
  const n = Number(rsri);
  if (!Number.isFinite(n)) return null;
  return -113 + n * 2;
}

router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const twoG = body["2g"] || {};
    const wifi = body.wifi || {};
    const rssiDbm = rsriToRssiDbm(twoG.rsri);

    const doc = await DeviceData.create({
      device_name: body.device_name || "",
      generated_date: body.generated_date || "",
      generated_time: body.generated_time || "",
      "2g": {
        operator: twoG.operator || "",
        sim: twoG.sim || "",
        data: dataMeaning(twoG.data),
        voice: regMeaning(twoG.voice),
        rssi: rssiDbm,
      },
      wifi: {
        ssid: wifi.ssid || "",
        rssi: wifi.rssi || "",
        ip: wifi.ip || "",
      },
    });

    return res.status(201).json({ message: "stored", id: doc._id });
  } catch (err) {
    console.error("/device_data error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Read recent device telemetry for dashboard use
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const docs = await DeviceData.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return res.json({ device_data: docs });
  } catch (err) {
    console.error("/device_data GET error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
