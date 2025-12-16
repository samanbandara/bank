const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Button = require("../Model/ButtonModel");
const Customer = require("../Model/CustomerModel");
const OldCustomer = require("../Model/OldCustomerModel");

const Counter = require("../Model/CounterModel");
const Service = require("../Model/ServiceModel");

// Remove the oldest queued customer for a counter and return the new head token
async function deleteLatest(counterKey) {
  // Resolve counter by counterid or _id
  let counter = null;
  try {
    const byId = mongoose.Types.ObjectId.isValid(counterKey)
      ? await Counter.findById(counterKey, { countername: 1, counterid: 1 }).lean()
      : null;
    const byCounterId = await Counter.findOne({ counterid: counterKey }, { countername: 1, counterid: 1 }).lean();
    counter = byCounterId || byId;
  } catch (_) {}

  const counterId = counter?.counterid || String(counterKey);

  const latest = await Customer.findOne({ counterid: counterId })
    .sort({ createdAt: 1 })
    .lean();

  if (!latest) {
    const label = counter?.countername || counterId;
    return { ok: false, message: `No customer in queue for counter ${label}` };
  }

  // Optionally archive what was removed
  try {
    await OldCustomer.create({
      userid: latest.userid,
      date: latest.date,
      services: latest.services || [],
      counterid: latest.counterid,
      token: latest.token,
      access_type: latest.access_type,
      arrival_time: latest.arrival_time,
      completedAt: new Date(),
    });
  } catch (_) {}

  await Customer.deleteOne({ _id: latest._id });

  const next = await Customer.findOne({ counterid: counterId })
    .sort({ createdAt: 1 })
    .lean();

  return {
    ok: true,
    deleted_token: latest.token,
    next_token: next ? next.token : null,
    next_customer: next || null,
    deleted_customer: latest,
  };
}

async function enqueueFollowUpIfNeeded(latest) {
  try {
    const needsSv01 = (latest.services || []).some((s) => String(s).toLowerCase() === "sv01");
    const needsSv06 = (latest.services || []).some((s) => String(s).toLowerCase() === "sv06");
    if (!(needsSv01 && needsSv06)) return null;

    const counters = await Counter.find({ counterservices: { $in: ["sv06", "SV06", "Sv06"] } }).lean();
    if (!counters.length) return null;
    const target = counters.find((c) => String(c.counterid || "").toLowerCase().includes("5")) || counters[0];
    const targetCounterId = target.counterid || String(target._id);

    const sv06 = await Service.findOne({ serviceid: /sv06/i }).lean();
    const avgMinutes = Number(sv06?.average_minutes) || 5;
    const queueLen = await Customer.countDocuments({ counterid: targetCounterId });
    const now = new Date();
    const eta = new Date(now.getTime() + queueLen * avgMinutes * 60000);
    const pad2 = (n) => String(n).padStart(2, "0");
    const arrival_time = `${pad2(eta.getHours())}:${pad2(eta.getMinutes())}`;

    const followUp = await Customer.create({
      userid: latest.userid,
      date: latest.date,
      services: ["sv06"],
      counterid: targetCounterId,
      token: latest.token,
      access_type: latest.access_type,
      arrival_time,
    });

    return followUp;
  } catch (e) {
    console.error("enqueueFollowUpIfNeeded error", e);
    return null;
  }
}

router.post("/", async (req, res) => {
  try {
    const { device_name, device_id, button_count } = req.body || {};

    if (!device_name && !device_id) {
      return res.status(400).json({ message: "device_name or device_id is required" });
    }

    if (button_count === undefined) {
      return res.status(400).json({ message: "button_count is required" });
    }

    const parsedCount = Number(button_count);
    if (!Number.isFinite(parsedCount) || parsedCount < 0) {
      return res.status(400).json({ message: "button_count must be a non-negative number" });
    }

    const filter = device_id ? { deviceid: device_id } : { devicename: device_name };
    const update = {
      devicename: device_name || "",
      deviceid: device_id || "",
      button_count: parsedCount,
      online: true,
      lastHeartbeatAt: new Date(),
    };

    const doc = await Button.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });

    // If a button press is reported, remove the latest queued customer and return current head
    const pressed = (() => {
      const b1 = req.body?.button1;
      const b2 = req.body?.button2;
      const truthy = (v) => v === true || v === "true" || v === 1 || v === "1";
      return truthy(b1) || truthy(b2);
    })();

    if (pressed) {
      if (!doc.assignedCounterId) {
        return res.status(400).json({ message: `Device is not assigned to a counter (device ${doc._id || device_id || device_name || ""})` });
      }
      const result = await deleteLatest(doc.assignedCounterId);
      if (!result.ok) return res.status(404).json({ message: result.message });
      await enqueueFollowUpIfNeeded(result.deleted_customer || {});
      return res.status(200).json({ message: "stored", id: doc._id, ...result });
    }

    return res.status(201).json({ message: "stored", id: doc._id });
  } catch (err) {
    console.error("/buttons error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const docs = await Button.find({}).sort({ updatedAt: -1 }).limit(limit).lean();

    const now = Date.now();
    const FIVE_MIN_MS = 5 * 60 * 1000;
    const fmtAgo = (ms) => {
      if (!Number.isFinite(ms) || ms < 0) return "unknown";
      const sec = Math.floor(ms / 1000);
      if (sec < 60) return `${sec}s ago`;
      const min = Math.floor(sec / 60);
      if (min < 60) return `${min}m ago`;
      const hr = Math.floor(min / 60);
      if (hr < 24) return `${hr}h ago`;
      const day = Math.floor(hr / 24);
      return `${day}d ago`;
    };

    const buttons = docs.map((d) => {
      const last = d.lastHeartbeatAt ? new Date(d.lastHeartbeatAt).getTime() : 0;
      const diff = now - last;
      const online = diff <= FIVE_MIN_MS;
      return {
        ...d,
        online,
        lastSeen: online ? "online" : fmtAgo(diff),
      };
    });

    return res.json({ buttons });
  } catch (err) {
    console.error("/buttons GET error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Physical button press: close current customer for the assigned counter and return next token
router.post("/:id/press", async (req, res) => {
  try {
    const { id } = req.params;

    const orFilters = [{ deviceid: id }, { devicename: id }];
    if (mongoose.Types.ObjectId.isValid(id)) {
      orFilters.push({ _id: id });
    }

    const device = await Button.findOne({ $or: orFilters }).lean();
    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }
    if (!device.assignedCounterId) {
      return res.status(400).json({ message: `Device is not assigned to a counter (device ${device._id || id})` });
    }

    const result = await deleteLatest(device.assignedCounterId);
    if (!result.ok) return res.status(404).json({ message: result.message });
    await enqueueFollowUpIfNeeded(result.deleted_customer || {});
    return res.json(result);
  } catch (err) {
    console.error("/buttons/:id/press error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Update device fields (assign counter, toggle online, update button count)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const update = {};
    if (Object.prototype.hasOwnProperty.call(body, "assignedCounterId")) {
      update.assignedCounterId = body.assignedCounterId || "";
    }
    if (Object.prototype.hasOwnProperty.call(body, "online")) {
      update.online = !!body.online;
    }
    if (Object.prototype.hasOwnProperty.call(body, "button_count")) {
      const parsed = Number(body.button_count);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return res.status(400).json({ message: "button_count must be a non-negative number" });
      }
      update.button_count = parsed;
    }

    if (!Object.keys(update).length) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const orFilters = [{ deviceid: id }, { devicename: id }];
    if (mongoose.Types.ObjectId.isValid(id)) {
      orFilters.push({ _id: id });
    }

    const doc = await Button.findOneAndUpdate(
      { $or: orFilters },
      { $set: update },
      { new: true }
    );

    if (!doc) {
      return res.status(404).json({ message: "Device not found" });
    }

    return res.json({ ok: true, button: doc });
  } catch (err) {
    console.error("/buttons PUT error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;